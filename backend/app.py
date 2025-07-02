from fastapi import FastAPI, UploadFile, Form, Depends, HTTPException, status
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
import os
from paperqa import Docs
from dotenv import load_dotenv
from datetime import timedelta, datetime
import uuid
import json
import asyncio
from typing import List
from database import get_db, User, Organization, Paper, Membership, MembershipStatus, MembershipRole
from supabase_auth import SupabaseAuth
from schemas import UserCreate, UserLogin, Token, QueryRequest, QueryResponse, UserOrganization, OrganizationSearch
import re

load_dotenv()

UPLOAD_DIR = "uploaded_pdfs"
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = FastAPI(title="PaperQA Multi-Tenant API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

org_docs = {}

security = HTTPBearer()

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
        Membership.status == "approved"
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this organization"
        )
    
    if not file.filename or not file.filename.endswith('.pdf'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are supported"
        )
    
    # Create organization-specific folder
    org_upload_dir = os.path.join(UPLOAD_DIR, str(organization_id))
    os.makedirs(org_upload_dir, exist_ok=True)
    
    unique_filename = f"{uuid.uuid4()}_{file.filename}"
    file_path = os.path.join(org_upload_dir, unique_filename)
    
    with open(file_path, "wb") as f:
        f.write(await file.read())
    
    paper = Paper(
        id=uuid.uuid4(),
        title=title,
        file_url=file_path,
        uploaded_by=current_user.id,
        organization_id=organization_id
    )
    db.add(paper)
    db.commit()
    db.refresh(paper)
    
    if organization_id in org_docs:
        del org_docs[organization_id]
    
    return {"message": "Paper uploaded successfully", "paper_id": str(paper.id)}

@app.post("/query", response_model=QueryResponse)
async def query_organization_papers(
    query_data: QueryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Query papers in an organization"""
    
    membership = db.query(Membership).filter(
        Membership.user_id == current_user.id,
        Membership.organization_id == query_data.organization_id,
        Membership.status == "approved"
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this organization"
        )
    
    org_id_str = str(query_data.organization_id)
    if org_id_str not in org_docs:
        papers = db.query(Paper).filter(
            Paper.organization_id == query_data.organization_id
        ).all()
        
        if not papers:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No papers found in organization. Please upload some papers first."
            )
        
        docs = Docs()
        for paper in papers:
            await docs.aadd(str(paper.file_url))
        
        org_docs[org_id_str] = docs
    
    docs = org_docs[org_id_str]
    answer = await docs.aquery(query_data.question)
    
    # Clean up the answer - remove question repetition and format nicely
    formatted_answer = answer.formatted_answer
    # Remove question from start, ignoring whitespace, punctuation, and case
    def normalize(text):
        return re.sub(r'\W+', '', text).strip().lower()
    if normalize(formatted_answer).startswith(normalize(query_data.question)):
        # Remove the question part from the answer
        qlen = len(query_data.question)
        formatted_answer = formatted_answer[qlen:].lstrip(' .:\n-')
    
    return QueryResponse(
        answer=formatted_answer,
        sources=[str(source) for source in answer.sources] if hasattr(answer, 'sources') else None
    )

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
        Membership.status == "approved"
    ).first()
    
    if not membership:
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
                Membership.status == "approved"
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
        if existing_membership.status == MembershipStatus.APPROVED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You are already a member of this organization"
            )
        elif existing_membership.status == MembershipStatus.PENDING.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You already have a pending request to join this organization"
            )
        elif existing_membership.status == MembershipStatus.DENIED.value:
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
        status="pending",
        role_in_org="member"
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
        Membership.status == "approved",
        Membership.role_in_org == "org_admin"
    ).first()
    
    if not membership:
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
        Membership.status == "approved",
        Membership.role_in_org == "org_admin"
    ).first()
    
    if not admin_membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be an admin to approve members"
        )
    
    # Find the membership request
    membership = db.query(Membership).filter(
        Membership.user_id == user_id,
        Membership.organization_id == organization_id,
        Membership.status == "pending"
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership request not found"
        )
    
    membership.status = "approved"
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
        Membership.status == "approved",
        Membership.role_in_org == "org_admin"
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
        Membership.status == "pending"
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership request not found"
        )
    
    membership.status = "denied"
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

@app.post("/streaming-query")
async def streaming_query(
    query_data: QueryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Streaming query endpoint"""
    
    membership = db.query(Membership).filter(
        Membership.user_id == current_user.id,
        Membership.organization_id == query_data.organization_id,
        Membership.status == "approved"
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this organization"
        )
    
    org_id_str = str(query_data.organization_id)
    if org_id_str not in org_docs:
        papers = db.query(Paper).filter(
            Paper.organization_id == query_data.organization_id
        ).all()
        
        if not papers:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No papers found in organization. Please upload some papers first."
            )
        
        docs = Docs()
        for paper in papers:
            await docs.aadd(str(paper.file_url))
        
        org_docs[org_id_str] = docs
    
    docs = org_docs[org_id_str]
    
    async def stream_answers():
        try:
            # Get the full answer first
            answer = await docs.aquery(query_data.question)
            
            # Clean up the answer - remove question repetition
            formatted_answer = answer.formatted_answer
            # Remove question from start, ignoring whitespace, punctuation, and case
            def normalize(text):
                return re.sub(r'\W+', '', text).strip().lower()
            if normalize(formatted_answer).startswith(normalize(query_data.question)):
                # Remove the question part from the answer
                qlen = len(query_data.question)
                formatted_answer = formatted_answer[qlen:].lstrip(' .:\n-')
            
            # Simulate streaming by sending chunks
            words = formatted_answer.split()
            chunk_size = max(1, len(words) // 10)  # Send in ~10 chunks
            
            for i in range(0, len(words), chunk_size):
                chunk_words = words[i:i + chunk_size]
                chunk_text = ' '.join(chunk_words)
                
                yield f"data: {json.dumps({'answer': chunk_text, 'sources': None})}\n\n"
                await asyncio.sleep(0.1)  # Small delay to simulate typing
            
            # Send final chunk with sources
            yield f"data: {json.dumps({'answer': '', 'sources': [str(source) for source in answer.sources] if hasattr(answer, 'sources') else None})}\n\n"
            
        except Exception as e:
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
