from fastapi import FastAPI, UploadFile, Form, Depends, HTTPException, status, Request
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
import os
import tempfile
from paperqa import Docs
from dotenv import load_dotenv
from datetime import timedelta, datetime
import uuid
import json
import asyncio
from typing import List, Dict, AsyncGenerator, Any
from database import get_db, User, Organization, Paper, Membership, MembershipStatus, MembershipRole
from supabase_auth import SupabaseAuth
from schemas import UserCreate, UserLogin, Token, QueryRequest, QueryResponse, UserOrganization, OrganizationSearch
from pinecone_service import PineconeService
from supabase_storage import SupabaseStorageService
from profile import router as profile_router
import re
import tiktoken
import difflib
from difflib import SequenceMatcher

load_dotenv()

UPLOAD_DIR = "uploaded_pdfs"
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = FastAPI(title="Alexandria Multi-Tenant API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include profile router
app.include_router(profile_router, prefix="/api", tags=["profile"])

# Initialize Pinecone service
try:
    pinecone_service = PineconeService()
    print("Pinecone service initialized successfully")
except Exception as e:
    print(f"Failed to initialize Pinecone service: {e}")
    pinecone_service = None

# Initialize Supabase Storage service
try:
    storage_service = SupabaseStorageService()
    print("Supabase Storage service initialized successfully")
except Exception as e:
    print(f"Failed to initialize Supabase Storage service: {e}")
    storage_service = None

# Cache for Alexandria docs with timestamps for invalidation
org_docs = {}
org_docs_timestamps = {}

# Enhanced caching for processed documents
processed_docs_cache = {}
doc_vectors_cache = {}
cache_ttl = 3600  # 1 hour cache TTL

# Advanced preprocessing configuration
CHUNK_SIZE = 1000  # Optimal chunk size for semantic search
CHUNK_OVERLAP = 200  # Overlap to maintain context
MAX_TOKENS_PER_QUERY = 4000  # Token limit for query processing
RELEVANCE_THRESHOLD = 0.7  # Minimum relevance score for chunks

security = HTTPBearer()

def intelligent_chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> List[str]:
    """Intelligently chunk text while preserving semantic boundaries"""
    chunks = []
    
    # Split by sentences first to maintain semantic coherence
    sentences = re.split(r'[.!?]+', text)
    current_chunk = ""
    
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
            
        # If adding this sentence would exceed chunk size
        if len(current_chunk) + len(sentence) > chunk_size and current_chunk:
            chunks.append(current_chunk.strip())
            # Start new chunk with overlap
            overlap_text = current_chunk[-overlap:] if overlap > 0 else ""
            current_chunk = overlap_text + " " + sentence
        else:
            current_chunk += " " + sentence if current_chunk else sentence
    
    # Add the last chunk
    if current_chunk.strip():
        chunks.append(current_chunk.strip())
    
    return chunks

def optimize_context_for_tokens(chunks: List[Dict], max_tokens: int = MAX_TOKENS_PER_QUERY) -> str:
    """Optimize context selection based on relevance and token limits"""
    # Sort chunks by relevance score
    sorted_chunks = sorted(chunks, key=lambda x: x.get('score', 0), reverse=True)
    
    optimized_context = ""
    current_tokens = 0
    
    for chunk in sorted_chunks:
        chunk_text = chunk.get('text', '')
        estimated_tokens = len(chunk_text.split()) * 1.3  # Rough token estimation
        
        if current_tokens + estimated_tokens <= max_tokens:
            optimized_context += chunk_text + "\n\n"
            current_tokens += estimated_tokens
        else:
            break
    
    return optimized_context.strip()

def enhanced_question_cleaning(answer_text: str, question_text: str) -> str:
    """Enhanced cleaning to remove question repetition and improve answer quality, even if paraphrased."""
    def normalize(text):
        return re.sub(r'\W+', '', text).strip().lower()
    
    # Remove exact matches and common patterns
    patterns_to_remove = [
        rf"^{re.escape(question_text)}",
        rf"question:\s*{re.escape(question_text)}",
        rf"the question is:\s*{re.escape(question_text)}",
        rf"regarding your question about\s*{re.escape(question_text)}",
        rf"to answer your question:\s*{re.escape(question_text)}"
    ]
    cleaned_answer = answer_text
    for pattern in patterns_to_remove:
        cleaned_answer = re.sub(pattern, "", cleaned_answer, flags=re.IGNORECASE)
    
    # Fuzzy match: remove first sentence if very similar to question
    sentences = re.split(r'(?<=[.!?])\s+', cleaned_answer)
    norm_question = normalize(question_text)
    if sentences:
        norm_first = normalize(sentences[0])
        similarity = SequenceMatcher(None, norm_first, norm_question).ratio()
        if similarity > 0.7:
            # Remove the first sentence
            cleaned_answer = ' '.join(sentences[1:]).strip()
        else:
            # Also check the first two sentences combined
            if len(sentences) > 1:
                norm_first_two = normalize(' '.join(sentences[:2]))
                similarity2 = SequenceMatcher(None, norm_first_two, norm_question).ratio()
                if similarity2 > 0.7:
                    cleaned_answer = ' '.join(sentences[2:]).strip()
    
    # Remove leading/trailing whitespace and punctuation
    cleaned_answer = re.sub(r'^[\s\.,:;\-\n]+', '', cleaned_answer)
    cleaned_answer = re.sub(r'[\s\.,:;\-\n]+$', '', cleaned_answer)
    
    # If answer is too short after cleaning, return original
    if len(cleaned_answer.strip()) < 50:
        return answer_text
    
    return cleaned_answer.strip()

async def get_cached_documents(org_id: str, db: Session) -> tuple:
    """Get cached documents or load them efficiently"""
    current_time = datetime.utcnow()
    
    # Check if we have valid cached docs
    if (org_id in org_docs and 
        org_id in org_docs_timestamps and 
        (current_time - org_docs_timestamps[org_id]).seconds < cache_ttl):
        print(f"Using cached documents for organization {org_id}")
        return org_docs[org_id], True
    
    # Load documents efficiently
    print(f"Loading documents for organization {org_id}...")
    papers = db.query(Paper).filter(Paper.organization_id == org_id).all()
    
    if not papers:
        return None, False
    
    docs = Docs()
    
    # Batch process documents for efficiency
    for paper in papers:
        if storage_service:
            try:
                # Check if we have cached PDF content
                cache_key = f"{org_id}_{paper.id}"
                if cache_key in processed_docs_cache:
                    pdf_content = processed_docs_cache[cache_key]
                else:
                    print(f"Downloading PDF for PaperQA: {paper.title}")
                    pdf_content = storage_service.download_pdf(str(paper.file_url))
                    # Cache the PDF content
                    processed_docs_cache[cache_key] = pdf_content
                
                with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
                    temp_file.write(pdf_content)
                    temp_file_path = temp_file.name
                await docs.aadd(temp_file_path)
                os.unlink(temp_file_path)
            except Exception as e:
                print(f"Error loading PDF {paper.id} for PaperQA: {e}")
        else:
            await docs.aadd(str(paper.file_url))
    
    # Cache the docs
    org_docs[org_id] = docs
    org_docs_timestamps[org_id] = current_time
    print(f"Cached {len(papers)} documents for organization {org_id}")
    
    return docs, False

async def get_current_user(credentials = Depends(security)):
    """Get current user from Supabase token"""
    return await SupabaseAuth.get_user_by_token(credentials.credentials)

@app.post("/register", response_model=Token)
async def register(user_data: UserCreate):
    """Register a new user with email and password"""
    print(f"Registration attempt for email: {user_data.email}")
    print(f"User data: {user_data}")
    
    result = await SupabaseAuth.sign_up(
        email=user_data.email,
        password=user_data.password,
        name=user_data.name
    )
    
    if user_data.organization_name:
        organization = await SupabaseAuth.create_organization(
            user_id=str(result["user"].id),
            organization_name=user_data.organization_name
        )
    
    return Token(
        access_token=result["session"].access_token,
        user=result["user"]
    )

@app.post("/login", response_model=Token)
async def login(user_data: UserLogin):
    """Login user with email and password"""
    result = await SupabaseAuth.sign_in(
        email=user_data.email,
        password=user_data.password
    )
    
    return Token(
        access_token=result["access_token"],
        user=result["user"]
    )

@app.post("/logout")
async def logout(current_user: User = Depends(get_current_user)):
    """Logout user"""
    return await SupabaseAuth.sign_out(str(current_user.id))

@app.post("/upload")
async def upload_paper(
    file: UploadFile,
    title: str = Form(...),
    organization_id: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload a paper to an organization"""
    
    membership = db.query(Membership).filter(
        Membership.user_id == current_user.id,
        Membership.organization_id == organization_id,
        Membership.status == MembershipStatus.APPROVED.value
    ).first()
    
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this organization"
        )
    
    if not file.filename or not file.filename.endswith('.pdf'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are supported"
        )
    
    # Read file content
    file_content = await file.read()
    
    # Upload to Supabase Storage
    if not storage_service:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Storage service not available"
        )
    
    try:
        storage_path = storage_service.upload_pdf(
            file_content=file_content,
            filename=file.filename,
            organization_id=str(organization_id)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload PDF: {str(e)}"
        )
    
    paper = Paper(
        id=uuid.uuid4(),
        title=title,
        file_url=storage_path,  # Store the Supabase storage path
        uploaded_by=current_user.id,
        organization_id=organization_id
    )
    db.add(paper)
    db.commit()
    db.refresh(paper)
    
    # Process PDF with Pinecone for vectorization
    if pinecone_service:
        try:
            # Create temporary file for Pinecone processing
            with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
                temp_file.write(file_content)
                temp_file_path = temp_file.name
            
            success = pinecone_service.store_document_vectors(
                organization_id=str(organization_id),
                paper_id=str(paper.id),
                file_path=temp_file_path,
                title=title
            )
            if not success:
                print(f"Warning: Failed to vectorize PDF {paper.id}")
            
            # Clean up temporary file
            os.unlink(temp_file_path)
        except Exception as e:
            print(f"Error during PDF vectorization: {e}")
    
    if organization_id in org_docs:
        del org_docs[organization_id]
        if organization_id in org_docs_timestamps:
            del org_docs_timestamps[organization_id]
        print(f"Invalidated cache for organization {organization_id}")
    
    return {"message": "Paper uploaded successfully", "paper_id": str(paper.id)}

@app.post("/query", response_model=QueryResponse)
async def query_organization_papers(
    query_data: QueryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Query papers in an organization using hybrid search (Pinecone + Alexandria)"""
    
    membership = db.query(Membership).filter(
        Membership.user_id == current_user.id,
        Membership.organization_id == query_data.organization_id,
        Membership.status == MembershipStatus.APPROVED.value
    ).first()
    
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this organization"
        )
    
    # Step 1: Use Pinecone for fast semantic search to get relevant context
    relevant_chunks = []
    pinecone_context = ""  # Initialize here to fix scope issue
    if pinecone_service:
        try:
            relevant_chunks = pinecone_service.search_similar_chunks(
                query=query_data.question,
                organization_id=str(query_data.organization_id),
                top_k=8  # Reduced from 15 to 8 for better performance
            )
            
            # Build context from Pinecone results with token limit
            if relevant_chunks:
                pinecone_context = optimize_context_for_tokens(relevant_chunks, max_tokens=MAX_TOKENS_PER_QUERY)
                print(f"Found {len(relevant_chunks)} relevant chunks from Pinecone")
            else:
                print("No relevant chunks found from Pinecone")
        except Exception as e:
            print(f"Error in Pinecone search: {e}")
    
    # Step 2: Use PaperQA for detailed analysis with enhanced context
    org_id_str = str(query_data.organization_id)
    if org_id_str not in org_docs:
        print(f"Loading documents for organization {org_id_str}...")
        papers = db.query(Paper).filter(
            Paper.organization_id == query_data.organization_id
        ).all()
        
        if not papers:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No papers found in organization. Please upload some papers first."
            )
        
        docs, _ = await get_cached_documents(org_id_str, db)
    else:
        print(f"Using cached documents for organization {org_id_str}")
    
    docs = org_docs[org_id_str]
    
    # Ensure pinecone_context is properly defined for the nested function
    final_pinecone_context = pinecone_context
    
    async def stream_answers():
        try:
            print("Starting enhanced streaming query...")
            start_time = datetime.utcnow()
            
            # Stream thinking indicators first
            thinking_phrases = [
                "Analyzing documents",
                "Processing your question", 
                "Searching through sources",
                "Generating response"
            ]
            
            for phrase in thinking_phrases:
                yield f"data: {json.dumps({'answer': phrase, 'thinking': True})}\n\n"
                await asyncio.sleep(0.8)  # Shorter thinking time
            
            # Now use PaperQA with better answer cleaning
            try:
                print("Running PaperQA query...")
                answer = await docs.aquery(query_data.question)
                
                # Check if the answer indicates insufficient information
                answer_lower = answer.formatted_answer.lower()
                cannot_answer_patterns = [
                    "i cannot answer",
                    "i can't answer", 
                    "cannot answer",
                    "can't answer",
                    "don't have enough information",
                    "not enough information",
                    "insufficient information",
                    "no relevant information found"
                ]
                
                has_insufficient_info = any(pattern in answer_lower for pattern in cannot_answer_patterns)
                
                if has_insufficient_info:
                    # Return custom message for insufficient information
                    custom_message = "I'm sorry, but I don't have enough information to answer your question. Could you please upload a document to your organization to provide some context?"
                    yield f"data: {json.dumps({'answer': custom_message, 'thinking': False, 'insufficient_info': True})}\n\n"
                    print("Detected insufficient information response, sent custom message")
                    return
                
                # Clean the answer more aggressively to remove references and extra content
                cleaned_answer = enhanced_question_cleaning(answer.formatted_answer, query_data.question)
                
                # Remove any remaining references section
                references_patterns = [
                    r'\n\s*References?\s*:?\s*\n.*',
                    r'\n\s*Sources?\s*:?\s*\n.*',
                    r'\n\s*Bibliography\s*:?\s*\n.*',
                    r'\n\s*\d+\.\s*\([^)]+\):.*',
                    r'\n\s*\[[^\]]+\].*'
                ]
                
                for pattern in references_patterns:
                    cleaned_answer = re.sub(pattern, '', cleaned_answer, flags=re.IGNORECASE | re.DOTALL)
                
                # Clean up extra whitespace
                cleaned_answer = re.sub(r'\n\s*\n\s*\n', '\n\n', cleaned_answer)
                cleaned_answer = cleaned_answer.strip()
                
                print(f"Answer cleaned, length: {len(cleaned_answer)} characters")
                
                # Stream the cleaned answer in smaller chunks for smoother experience
                # Split by sentences to preserve formatting
                sentences = re.split(r'(?<=[.!?])\s+', cleaned_answer)
                chunk_size = max(1, len(sentences) // 20)  # 20 chunks for smooth streaming
                
                for i in range(0, len(sentences), chunk_size):
                    chunk_sentences = sentences[i:i + chunk_size]
                    chunk_text = ' '.join(chunk_sentences)
                    yield f"data: {json.dumps({'answer': chunk_text, 'thinking': False})}\n\n"
                    await asyncio.sleep(0.05)  # Slightly longer for sentence chunks
                
                print(f"Enhanced streaming completed in {(datetime.utcnow() - start_time).total_seconds():.2f}s")
                
            except Exception as e:
                print(f"Error in PaperQA query: {e}")
                yield f"data: {json.dumps({'error': f'Error generating response: {str(e)}'})}\n\n"
                return
            
            # Build sources (only if we didn't return early due to insufficient info)
            sources = []
            enhanced_sources = []
            
            # Get paper information
            papers = db.query(Paper).filter(
                Paper.organization_id == query_data.organization_id
            ).all()
            
            paper_map = {str(paper.id): paper for paper in papers}
            
            # Add Pinecone sources
            if relevant_chunks:
                print(f"Processing {len(relevant_chunks)} Pinecone chunks for sources")
                for chunk in relevant_chunks[:5]:
                    paper_id = chunk.get("paper_id", "")
                    paper = paper_map.get(paper_id)
                    
                    if paper:
                        filename = os.path.basename(str(paper.file_url))
                        source_url = f"/papers/{query_data.organization_id}/file/{filename}"
                        
                        # Create citation
                        author_year = ""
                        if paper.title:
                            author_match = re.search(r'^([^(]+?)\s*\((\d{4})\)', paper.title)
                            if author_match:
                                author = author_match.group(1).strip()
                                year = author_match.group(2)
                                author_year = f"{author} ({year})"
                            else:
                                author_year = paper.title.split()[0] if paper.title.split() else "Unknown"
                        
                        chunk_index = chunk.get("chunk_index", 0)
                        citation = f"{author_year}, page {chunk_index + 1}" if author_year else f"{paper.title} (page {chunk_index + 1})"
                        
                        # Only add if not already present
                        if source_url not in [s["url"] for s in sources]:
                            sources.append({
                                "url": source_url,
                                "title": paper.title,
                                "citation": citation
                            })
                            
                            enhanced_sources.append({
                                "url": source_url,
                                "title": paper.title,
                                "citation": citation,
                                "paper_id": str(paper.id),
                                "chunk_index": chunk_index,
                                "relevance_score": chunk.get("score", 0.0)
                            })
            
            # Send sources
            if sources:
                yield f"data: {json.dumps({'sources': sources})}\n\n"
            
            if enhanced_sources:
                yield f"data: {json.dumps({'enhanced_sources': enhanced_sources})}\n\n"
                
        except Exception as e:
            print(f"Error in streaming query: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
    
    return StreamingResponse(
        stream_answers(), 
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream"
        }
    )

def build_optimized_context(chunks: List[Dict], max_tokens: int = 2500) -> str:
    """Build optimized context from chunks with token limits"""
    if not chunks:
        return ""
    
    # Sort chunks by relevance score
    sorted_chunks = sorted(chunks, key=lambda x: x.get('score', 0.0), reverse=True)
    
    context_parts = []
    total_tokens = 0
    
    for i, chunk in enumerate(sorted_chunks):
        # Estimate tokens in this chunk
        chunk_tokens = estimate_tokens(chunk['text'])
        
        # Check if adding this chunk would exceed the limit
        if total_tokens + chunk_tokens > max_tokens:
            print(f"Stopping at chunk {i+1} to stay within token limit")
            break
        
        # Only include chunks with reasonable relevance scores
        if chunk.get('score', 0.0) > 0.3:  # Minimum relevance threshold
            context_parts.append(f"Document {i+1} (Title: {chunk['title']}, Score: {chunk.get('score', 0.0):.2f}):\n{chunk['text']}\n")
            total_tokens += chunk_tokens
    
    context = "\n".join(context_parts)
    print(f"Using {len(context_parts)} chunks for context ({total_tokens} estimated tokens)")
    return context 

def estimate_tokens(text: str) -> int:
    """Estimate token count for text using tiktoken"""
    try:
        enc = tiktoken.encoding_for_model("gpt-3.5-turbo")
        return len(enc.encode(text))
    except:
        # Fallback: rough estimate of 4 characters per token
        return len(text) // 4 

@app.get("/papers/{organization_id}")
async def list_papers(
    organization_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all papers in an organization"""
    
    membership = db.query(Membership).filter(
        Membership.user_id == current_user.id,
        Membership.organization_id == organization_id,
        Membership.status == MembershipStatus.APPROVED.value
    ).first()
    
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this organization"
        )
    
    papers = db.query(Paper).filter(
        Paper.organization_id == organization_id
    ).all()
    
    return [
        {
            "id": str(paper.id),
            "title": paper.title,
            "file_url": paper.file_url,
            "uploaded_at": paper.uploaded_at,
            "uploaded_by": paper.uploaded_by_user.email if paper.uploaded_by_user else "Unknown"
        }
        for paper in papers
    ]

@app.get("/organizations", response_model=List[UserOrganization])
async def get_user_organizations(current_user: User = Depends(get_current_user)):
    """Get all organizations the user belongs to"""
    organizations = await SupabaseAuth.get_user_organizations(str(current_user.id))
    return organizations

@app.get("/organizations/search")
async def search_organizations(
    query: str = "",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Search for organizations by name"""
    organizations = db.query(Organization).filter(
        Organization.name.ilike(f"%{query}%")
    ).limit(20).all()
    
    # Check if user is already a member of each organization
    result = []
    for org in organizations:
        membership = db.query(Membership).filter(
            Membership.user_id == current_user.id,
            Membership.organization_id == org.id
        ).first()
        
        result.append({
            "id": str(org.id),
            "name": org.name,
            "created_at": org.created_at,
            "member_count": db.query(Membership).filter(
                Membership.organization_id == org.id,
                Membership.status == MembershipStatus.APPROVED.value
            ).count(),
            "is_member": membership is not None,
            "membership_status": membership.status if membership else None
        })
    
    return result

@app.post("/organizations/{organization_id}/join")
async def join_organization(
    organization_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Request to join an organization"""
    
    # Check if organization exists
    organization = db.query(Organization).filter(Organization.id == organization_id).first()
    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    
    # Check if user is already a member
    existing_membership = db.query(Membership).filter(
        Membership.user_id == current_user.id,
        Membership.organization_id == organization_id
    ).first()
    
    if existing_membership:
        status_value = existing_membership.status
        if status_value == MembershipStatus.APPROVED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You are already a member of this organization"
            )
        elif status_value == MembershipStatus.PENDING.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You already have a pending request to join this organization"
            )
        elif status_value == MembershipStatus.DENIED.value:
            # Update existing denied request to pending
            existing_membership.status = MembershipStatus.PENDING.value
            existing_membership.requested_at = datetime.utcnow()
            db.commit()
            return {"message": "Request to join organization submitted"}
    
    # Create new membership request
    membership = Membership(
        id=uuid.uuid4(),
        user_id=current_user.id,
        organization_id=organization_id,
        status=MembershipStatus.PENDING.value,
        role_in_org=MembershipRole.MEMBER.value
    )
    db.add(membership)
    db.commit()
    
    return {"message": "Request to join organization submitted"}

@app.get("/organizations/{organization_id}/members")
async def get_organization_members(
    organization_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all members of an organization (admin only)"""
    
    # Check if user is admin of the organization
    membership = db.query(Membership).filter(
        Membership.user_id == current_user.id,
        Membership.organization_id == organization_id,
        Membership.status == MembershipStatus.APPROVED.value,
        Membership.role_in_org == MembershipRole.ORG_ADMIN.value
    ).first()
    
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be an admin to view organization members"
        )
    
    memberships = db.query(Membership).filter(
        Membership.organization_id == organization_id
    ).all()
    
    return [
        {
            "id": str(m.user.id),
            "email": m.user.email,
            "name": m.user.name,
            "role": m.role_in_org,
            "status": m.status,
            "requested_at": m.requested_at,
            "approved_at": m.approved_at
        }
        for m in memberships
    ]

@app.post("/organizations/{organization_id}/members/{user_id}/approve")
async def approve_member(
    organization_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Approve a membership request (admin only)"""
    
    # Check if user is admin of the organization
    admin_membership = db.query(Membership).filter(
        Membership.user_id == current_user.id,
        Membership.organization_id == organization_id,
        Membership.status == MembershipStatus.APPROVED.value,
        Membership.role_in_org == MembershipRole.ORG_ADMIN.value
    ).first()
    
    if admin_membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be an admin to approve members"
        )
    
    # Find the membership request
    membership = db.query(Membership).filter(
        Membership.user_id == user_id,
        Membership.organization_id == organization_id,
        Membership.status == MembershipStatus.PENDING.value
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership request not found"
        )
    
    membership.status = MembershipStatus.APPROVED.value
    membership.approved_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Member approved successfully"}

@app.post("/organizations/{organization_id}/members/{user_id}/deny")
async def deny_member(
    organization_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Deny a membership request (admin only)"""
    
    # Check if user is admin of the organization
    admin_membership = db.query(Membership).filter(
        Membership.user_id == current_user.id,
        Membership.organization_id == organization_id,
        Membership.status == MembershipStatus.APPROVED.value,
        Membership.role_in_org == MembershipRole.ORG_ADMIN.value
    ).first()
    
    if not admin_membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be an admin to deny members"
        )
    
    # Find the membership request
    membership = db.query(Membership).filter(
        Membership.user_id == user_id,
        Membership.organization_id == organization_id,
        Membership.status == MembershipStatus.PENDING.value
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership request not found"
        )
    
    membership.status = MembershipStatus.DENIED.value
    db.commit()
    
    return {"message": "Member denied successfully"}

@app.get("/me")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user information"""
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "name": current_user.name,
        "role": current_user.role,
        "created_at": current_user.created_at
    }

@app.post("/organizations")
async def create_organization(
    name: str,
    current_user: User = Depends(get_current_user)
):
    """Create a new organization"""
    organization = await SupabaseAuth.create_organization(
        user_id=str(current_user.id),
        organization_name=name
    )
    return organization

@app.get("/papers/{organization_id}/file/{filename}")
async def get_paper_file(
    organization_id: str,
    filename: str,
    token: str | None = None,
    request: Request = None,
    db: Session = Depends(get_db)
):
    """Serve a PDF file securely if the user is a member of the organization"""
    print(f"=== PDF Request Debug ===")
    print(f"Organization ID: {organization_id}")
    print(f"Filename: {filename}")
    print(f"Token from query param: {'present' if token else 'missing'}")
    
    # Validate token and get current user
    current_user = None
    
    # Try to get token from Authorization header first
    auth_header = request.headers.get("Authorization") if request else None
    print(f"Authorization header: {'present' if auth_header else 'missing'}")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:]  # Remove "Bearer " prefix
        print(f"Using token from Authorization header")
    
    if token:
        try:
            current_user = await SupabaseAuth.get_user_by_token(token)
            print(f"User authenticated: {current_user.email if current_user else 'failed'}")
        except Exception as e:
            print(f"Error validating token: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
    
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    membership = db.query(Membership).filter(
        Membership.user_id == current_user.id,
        Membership.organization_id == organization_id,
        Membership.status == MembershipStatus.APPROVED.value
    ).first()
    print(f"Membership found: {'yes' if membership else 'no'}")
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this organization"
        )
    
    # Find the paper in the database
    # The file_url now contains the full Supabase path: org_{organization_id}/{uuid}_{filename}
    paper = db.query(Paper).filter(
        Paper.organization_id == organization_id,
        Paper.file_url.like(f"%{filename}")
    ).first()
    print(f"Paper found: {'yes' if paper else 'no'}")
    if paper:
        print(f"Paper file_url: {paper.file_url}")
        print(f"Paper title: {paper.title}")
    
    if not paper:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Download PDF from Supabase Storage
    if not storage_service:
        print("Storage service not available")
        raise HTTPException(status_code=500, detail="Storage service not available")
    
    try:
        print(f"Attempting to download PDF from Supabase: {paper.file_url}")
        pdf_content = storage_service.download_pdf(str(paper.file_url))
        print(f"PDF content downloaded, size: {len(pdf_content) if pdf_content else 0} bytes")
        
        if not pdf_content:
            print("PDF content is empty")
            raise HTTPException(status_code=500, detail="PDF content is empty")
            
    except Exception as e:
        print(f"Error downloading PDF: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to download PDF: {e}")
    
    print("Returning PDF response")
    
    return StreamingResponse(
        iter([pdf_content]),
        media_type="application/pdf",
        headers={
            "Cache-Control": "no-cache"
        }
    )

@app.delete("/papers/{paper_id}")
async def delete_paper(
    paper_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a paper and its vectors from the system"""
    
    # Find the paper
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Paper not found"
        )
    
    # Check if user has permission (must be member of the organization)
    membership = db.query(Membership).filter(
        Membership.user_id == current_user.id,
        Membership.organization_id == paper.organization_id,
        Membership.status == MembershipStatus.APPROVED.value
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to delete this paper"
        )
    
    # Delete vectors from Pinecone
    if pinecone_service:
        try:
            pinecone_service.delete_document_vectors(str(paper_id))
        except Exception as e:
            print(f"Error deleting vectors from Pinecone: {e}")
    
    # Delete the file from Supabase Storage
    if storage_service:
        try:
            storage_service.delete_pdf(str(paper.file_url))
        except Exception as e:
            print(f"Error deleting file from Supabase Storage: {e}")
    else:
        print("Storage service not available for file deletion")
    
    # Delete from database
    db.delete(paper)
    db.commit()
    
    # Clear cached docs for this organization
    org_id_str = str(paper.organization_id)
    if org_id_str in org_docs:
        del org_docs[org_id_str]
    
    return {"message": "Paper deleted successfully"}

@app.get("/papers/{organization_id}/stats")
async def get_paper_stats(
    organization_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get statistics about papers in an organization"""
    
    membership = db.query(Membership).filter(
        Membership.user_id == current_user.id,
        Membership.organization_id == organization_id,
        Membership.status == MembershipStatus.APPROVED.value
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this organization"
        )
    
    # Get basic stats from database
    total_papers = db.query(Paper).filter(
        Paper.organization_id == organization_id
    ).count()
    
    # Get vector stats from Pinecone
    vector_stats = {}
    if pinecone_service:
        try:
            vector_stats = pinecone_service.get_document_stats(str(organization_id))
        except Exception as e:
            print(f"Error getting vector stats: {e}")
    
    return {
        "total_papers": total_papers,
        "vector_stats": vector_stats
    }

@app.get("/organizations/{organization_id}/user-role")
async def get_user_role_in_organization(
    organization_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the current user's role in the specified organization"""
    
    membership = db.query(Membership).filter(
        Membership.user_id == current_user.id,
        Membership.organization_id == organization_id,
        Membership.status == MembershipStatus.APPROVED.value
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this organization"
        )
    
    return {
        "user_id": str(current_user.id),
        "organization_id": str(organization_id),
        "role": membership.role_in_org,
        "status": membership.status
    }

@app.get("/papers/{organization_id}/sources/{filename}/info")
async def get_source_info(
    organization_id: str,
    filename: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get detailed information about a source file including citation details"""
    
    membership = db.query(Membership).filter(
        Membership.user_id == current_user.id,
        Membership.organization_id == organization_id,
        Membership.status == MembershipStatus.APPROVED.value
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this organization"
        )
    
    # Find the paper in the database - handle both regular and temporary filenames
    paper = db.query(Paper).filter(
        Paper.organization_id == organization_id,
        Paper.file_url.like(f"%{filename}")
    ).first()
    
    # If not found, try to find by paper ID (for temporary filenames)
    if not paper and filename.startswith('tmp'):
        # Extract paper ID from temporary filename if possible
        # Format: tmp{paper_id}.pdf
        try:
            paper_id = filename.replace('tmp', '').replace('.pdf', '')
            paper = db.query(Paper).filter(
                Paper.organization_id == organization_id,
                Paper.id == paper_id
            ).first()
        except:
            pass
    
    if not paper:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Get vector information from Pinecone if available
    vector_info = {}
    if pinecone_service:
        try:
            # Get chunks for this paper
            chunks = pinecone_service.search_similar_chunks(
                query="",  # Empty query to get all chunks
                organization_id=str(organization_id),
                top_k=1000  # Get all chunks
            )
            
            # Filter chunks for this specific paper
            paper_chunks = [c for c in chunks if c.get("paper_id") == str(paper.id)]
            
            if paper_chunks:
                vector_info = {
                    "total_chunks": len(paper_chunks),
                    "chunk_details": [
                        {
                            "chunk_index": chunk.get("chunk_index", 0),
                            "text_preview": chunk.get("text", "")[:200] + "...",
                            "relevance_score": chunk.get("score", 0.0)
                        }
                        for chunk in paper_chunks[:10]  # Show first 10 chunks
                    ]
                }
        except Exception as e:
            print(f"Error getting vector info: {e}")
    
    return {
        "paper_id": str(paper.id),
        "title": paper.title,
        "filename": filename,
        "uploaded_at": paper.uploaded_at,
        "uploaded_by": paper.uploaded_by_user.email if paper.uploaded_by_user else "Unknown",
        "vector_info": vector_info,
        "citation_format": f"{paper.title} (uploaded {paper.uploaded_at.strftime('%Y-%m-%d')})"
    }

@app.post("/streaming-query")
async def streaming_query(
    query_data: QueryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Streaming query endpoint for real-time responses"""
    
    print(f"=== Starting streaming query for: {query_data.question[:50]}... ===")
    overall_start = datetime.utcnow()
    
    membership = db.query(Membership).filter(
        Membership.user_id == current_user.id,
        Membership.organization_id == query_data.organization_id,
        Membership.status == MembershipStatus.APPROVED.value
    ).first()
    
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this organization"
        )
    
    # Step 1: Use Pinecone for fast semantic search
    print("Step 1: Pinecone search...")
    pinecone_start = datetime.utcnow()
    relevant_chunks = []
    if pinecone_service:
        try:
            relevant_chunks = pinecone_service.search_similar_chunks(
                query=query_data.question,
                organization_id=str(query_data.organization_id),
                top_k=8
            )
            print(f"Found {len(relevant_chunks)} relevant chunks from Pinecone in {(datetime.utcnow() - pinecone_start).total_seconds():.2f}s")
        except Exception as e:
            print(f"Error in Pinecone search: {e}")
    else:
        print("Pinecone service not available")
    
    # Step 2: Load documents for PaperQA
    print("Step 2: Document loading...")
    doc_start = datetime.utcnow()
    org_id_str = str(query_data.organization_id)
    if org_id_str not in org_docs:
        print(f"Loading documents for organization {org_id_str}...")
        papers = db.query(Paper).filter(
            Paper.organization_id == query_data.organization_id
        ).all()
        
        if not papers:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No papers found in organization. Please upload some papers first."
            )
        
        docs, _ = await get_cached_documents(org_id_str, db)
        print(f"Document loading completed in {(datetime.utcnow() - doc_start).total_seconds():.2f}s")
    else:
        print(f"Using cached documents for organization {org_id_str}")
        docs = org_docs[org_id_str]
    
    print(f"Total setup time: {(datetime.utcnow() - overall_start).total_seconds():.2f}s")
    print("Step 3: Starting PaperQA processing...")
    
    async def stream_answers():
        try:
            print("Starting enhanced streaming query...")
            start_time = datetime.utcnow()
            
            # Stream thinking indicators first
            thinking_phrases = [
                "Analyzing documents",
                "Processing your question", 
                "Searching through sources",
                "Generating response"
            ]
            
            for phrase in thinking_phrases:
                yield f"data: {json.dumps({'answer': phrase, 'thinking': True})}\n\n"
                await asyncio.sleep(0.8)  # Shorter thinking time
            
            # Now use PaperQA with better answer cleaning
            try:
                print("Running PaperQA query...")
                answer = await docs.aquery(query_data.question)
                
                # Check if the answer indicates insufficient information
                answer_lower = answer.formatted_answer.lower()
                cannot_answer_patterns = [
                    "i cannot answer",
                    "i can't answer", 
                    "cannot answer",
                    "can't answer",
                    "don't have enough information",
                    "not enough information",
                    "insufficient information",
                    "no relevant information found"
                ]
                
                has_insufficient_info = any(pattern in answer_lower for pattern in cannot_answer_patterns)
                
                if has_insufficient_info:
                    # Return custom message for insufficient information
                    custom_message = "I'm sorry, but I don't have enough information to answer your question. Could you please upload a document to your organization to provide some context?"
                    yield f"data: {json.dumps({'answer': custom_message, 'thinking': False, 'insufficient_info': True})}\n\n"
                    print("Detected insufficient information response, sent custom message")
                    return
                
                # Clean the answer more aggressively to remove references and extra content
                cleaned_answer = enhanced_question_cleaning(answer.formatted_answer, query_data.question)
                
                # Remove any remaining references section
                references_patterns = [
                    r'\n\s*References?\s*:?\s*\n.*',
                    r'\n\s*Sources?\s*:?\s*\n.*',
                    r'\n\s*Bibliography\s*:?\s*\n.*',
                    r'\n\s*\d+\.\s*\([^)]+\):.*',
                    r'\n\s*\[[^\]]+\].*'
                ]
                
                for pattern in references_patterns:
                    cleaned_answer = re.sub(pattern, '', cleaned_answer, flags=re.IGNORECASE | re.DOTALL)
                
                # Clean up extra whitespace
                cleaned_answer = re.sub(r'\n\s*\n\s*\n', '\n\n', cleaned_answer)
                cleaned_answer = cleaned_answer.strip()
                
                print(f"Answer cleaned, length: {len(cleaned_answer)} characters")
                
                # Stream the cleaned answer in smaller chunks for smoother experience
                # Split by sentences to preserve formatting
                sentences = re.split(r'(?<=[.!?])\s+', cleaned_answer)
                chunk_size = max(1, len(sentences) // 20)  # 20 chunks for smooth streaming
                
                for i in range(0, len(sentences), chunk_size):
                    chunk_sentences = sentences[i:i + chunk_size]
                    chunk_text = ' '.join(chunk_sentences)
                    yield f"data: {json.dumps({'answer': chunk_text, 'thinking': False})}\n\n"
                    await asyncio.sleep(0.05)  # Slightly longer for sentence chunks
                
                print(f"Enhanced streaming completed in {(datetime.utcnow() - start_time).total_seconds():.2f}s")
                
            except Exception as e:
                print(f"Error in PaperQA query: {e}")
                yield f"data: {json.dumps({'error': f'Error generating response: {str(e)}'})}\n\n"
                return
            
            # Build sources (only if we didn't return early due to insufficient info)
            sources = []
            enhanced_sources = []
            
            # Get paper information
            papers = db.query(Paper).filter(
                Paper.organization_id == query_data.organization_id
            ).all()
            
            paper_map = {str(paper.id): paper for paper in papers}
            
            # Add Pinecone sources
            if relevant_chunks:
                print(f"Processing {len(relevant_chunks)} Pinecone chunks for sources")
                for chunk in relevant_chunks[:5]:
                    paper_id = chunk.get("paper_id", "")
                    paper = paper_map.get(paper_id)
                    
                    if paper:
                        filename = os.path.basename(str(paper.file_url))
                        source_url = f"/papers/{query_data.organization_id}/file/{filename}"
                        
                        # Create citation
                        author_year = ""
                        if paper.title:
                            author_match = re.search(r'^([^(]+?)\s*\((\d{4})\)', paper.title)
                            if author_match:
                                author = author_match.group(1).strip()
                                year = author_match.group(2)
                                author_year = f"{author} ({year})"
                            else:
                                author_year = paper.title.split()[0] if paper.title.split() else "Unknown"
                        
                        chunk_index = chunk.get("chunk_index", 0)
                        citation = f"{author_year}, page {chunk_index + 1}" if author_year else f"{paper.title} (page {chunk_index + 1})"
                        
                        # Only add if not already present
                        if source_url not in [s["url"] for s in sources]:
                            sources.append({
                                "url": source_url,
                                "title": paper.title,
                                "citation": citation
                            })
                            
                            enhanced_sources.append({
                                "url": source_url,
                                "title": paper.title,
                                "citation": citation,
                                "paper_id": str(paper.id),
                                "chunk_index": chunk_index,
                                "relevance_score": chunk.get("score", 0.0)
                            })
            
            # Send sources
            if sources:
                yield f"data: {json.dumps({'sources': sources})}\n\n"
            
            if enhanced_sources:
                yield f"data: {json.dumps({'enhanced_sources': enhanced_sources})}\n\n"
                
        except Exception as e:
            print(f"Error in streaming query: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
    
    return StreamingResponse(
        stream_answers(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream"
        }
    )

