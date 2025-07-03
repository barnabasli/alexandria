import os
import uuid
from typing import List, Dict, Any
import pinecone
from openai import OpenAI
import PyPDF2
import io
from tiktoken import encoding_for_model
import re

class PineconeService:
    def __init__(self):
        self.pinecone_api_key = os.getenv("PINECONE_API_KEY")
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        
        if not all([self.pinecone_api_key, self.openai_api_key]):
            raise ValueError("Missing required environment variables for Pinecone/OpenAI")
        
        # Initialize Pinecone v3 client
        self.pc = pinecone.Pinecone(api_key=self.pinecone_api_key)
        
        # Initialize OpenAI client
        self.openai_client = OpenAI(api_key=self.openai_api_key)
        
        # Get or create index
        self.index_name = "alexandria-documents"
        self._ensure_index_exists()
        
    def _ensure_index_exists(self):
        """Ensure the Pinecone index exists, create if it doesn't"""
        try:
            # Check if index exists
            if self.index_name not in [index.name for index in self.pc.list_indexes()]:
                print(f"Creating index '{self.index_name}'...")
                self.pc.create_index(
                    name=self.index_name,
                    dimension=1536,  # OpenAI ada-002 embedding dimension
                    metric="cosine",
                    spec=pinecone.ServerlessSpec(
                        cloud="aws",
                        region="us-east-1"
                    )
                )
                print(f"Index '{self.index_name}' created successfully")
            
            self.index = self.pc.Index(self.index_name)
            print(f"Connected to index '{self.index_name}'")
            
        except Exception as e:
            print(f"Error ensuring index exists: {e}")
            raise
    
    def extract_text_from_pdf(self, file_path: str) -> str:
        """Extract text content from PDF file"""
        try:
            with open(file_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                text = ""
                for page in pdf_reader.pages:
                    text += page.extract_text() + "\n"
                return text
        except Exception as e:
            print(f"Error extracting text from PDF: {e}")
            return ""
    
    def chunk_text(self, text: str, chunk_size: int = 800, overlap: int = 100) -> List[str]:
        """Split text into overlapping chunks optimized for context windows"""
        # Use tiktoken to count tokens accurately
        enc = encoding_for_model("gpt-3.5-turbo")
        
        chunks = []
        current_chunk = ""
        current_tokens = 0
        
        sentences = re.split(r'[.!?]+', text)
        
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
                
            sentence_tokens = len(enc.encode(sentence))
            
            # If adding this sentence would exceed chunk size, save current chunk
            if current_tokens + sentence_tokens > chunk_size and current_chunk:
                chunks.append(current_chunk.strip())
                # Start new chunk with minimal overlap (just last sentence)
                current_chunk = sentence + ". "
                current_tokens = sentence_tokens
            else:
                current_chunk += sentence + ". "
                current_tokens += sentence_tokens
        
        if current_chunk.strip():
            chunks.append(current_chunk.strip())
        
        return chunks
    
    def generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for text chunks using OpenAI"""
        try:
            response = self.openai_client.embeddings.create(
                model="text-embedding-ada-002",
                input=texts
            )
            return [embedding.embedding for embedding in response.data]
        except Exception as e:
            print(f"Error generating embeddings: {e}")
            return []
    
    def store_document_vectors(self, organization_id: str, paper_id: str, file_path: str, title: str) -> bool:
        """Process PDF and store vectors in Pinecone"""
        try:
            # Extract text from PDF
            text = self.extract_text_from_pdf(file_path)
            if not text.strip():
                print(f"No text extracted from PDF: {file_path}")
                return False
            
            # Chunk the text
            chunks = self.chunk_text(text)
            if not chunks:
                print(f"No chunks created from text")
                return False
            
            # Generate embeddings
            embeddings = self.generate_embeddings(chunks)
            if not embeddings:
                print(f"No embeddings generated")
                return False
            
            # Prepare vectors for Pinecone v3
            vectors = []
            for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
                vector_id = f"{paper_id}_{i}"
                metadata = {
                    "organization_id": organization_id,
                    "paper_id": paper_id,
                    "title": title,
                    "chunk_index": i,
                    "text": chunk,
                    "file_path": f"org_{organization_id}/{paper_id}_{os.path.basename(file_path)}"  # Store the actual file path format
                }
                vectors.append({
                    "id": vector_id,
                    "values": embedding,
                    "metadata": metadata
                })
            
            # Upsert to Pinecone v3
            self.index.upsert(vectors=vectors)
            print(f"Stored {len(vectors)} vectors for paper {paper_id}")
            return True
            
        except Exception as e:
            print(f"Error storing document vectors: {e}")
            return False
    
    def search_similar_chunks(self, query: str, organization_id: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """Search for similar chunks using vector similarity"""
        try:
            # Handle empty query case
            if not query or not query.strip():
                # For empty queries, we can't do semantic search, so return empty
                print("Empty query provided, cannot perform semantic search")
                return []
            
            # Generate embedding for the query
            query_embedding = self.generate_embeddings([query])
            if not query_embedding:
                print("Failed to generate query embedding")
                return []
            
            print(f"Searching for query: '{query}' in organization: {organization_id}")
            
            # Search in Pinecone v3
            results = self.index.query(
                vector=query_embedding[0],
                filter={"organization_id": organization_id},
                top_k=top_k,
                include_metadata=True
            )
                        
            # Format results for v3 - handle the response properly
            formatted_results = []
            try:
                # Try to access matches directly
                matches = results.matches
                print(f"Found {len(matches)} matches")
                for match in matches:
                    formatted_results.append({
                        "score": match.score,
                        "text": match.metadata["text"],
                        "paper_id": match.metadata["paper_id"],
                        "title": match.metadata["title"],
                        "chunk_index": match.metadata["chunk_index"],
                        "file_path": match.metadata["file_path"]
                    })
            except AttributeError:
                # Fallback: try to access as dictionary
                if isinstance(results, dict) and 'matches' in results:
                    matches = results['matches']
                    print(f"Found {len(matches)} matches (dict access)")
                    for match in matches:
                        formatted_results.append({
                            "score": match.get('score', 0.0),
                            "text": match.get('metadata', {}).get('text', ''),
                            "paper_id": match.get('metadata', {}).get('paper_id', ''),
                            "title": match.get('metadata', {}).get('title', ''),
                            "chunk_index": match.get('metadata', {}).get('chunk_index', 0),
                            "file_path": match.get('metadata', {}).get('file_path', '')
                        })
                else:
                    print(f"Unexpected results format: {type(results)}")
                    print(f"Results content: {results}")
            
            print(f"Returning {len(formatted_results)} formatted results")
            return formatted_results
            
        except Exception as e:
            print(f"Error searching similar chunks: {e}")
            return []
    
    def delete_document_vectors(self, paper_id: str) -> bool:
        """Delete all vectors for a specific paper"""
        try:
            # Get all vectors for this paper
            results = self.index.query(
                vector=[0.0] * 1536,  # Dummy vector as float
                filter={"paper_id": paper_id},
                top_k=10000,  # Large number to get all
                include_metadata=False
            )
            
            # Delete the vectors
            try:
                matches = results.matches
                if matches:
                    vector_ids = [match.id for match in matches]
                    self.index.delete(ids=vector_ids)
                    print(f"Deleted {len(vector_ids)} vectors for paper {paper_id}")
            except AttributeError:
                # Fallback: try to access as dictionary
                if isinstance(results, dict) and 'matches' in results:
                    vector_ids = [match.get('id') for match in results['matches']]
                    if vector_ids:
                        self.index.delete(ids=vector_ids)
                        print(f"Deleted {len(vector_ids)} vectors for paper {paper_id}")
            
            return True
            
        except Exception as e:
            print(f"Error deleting document vectors: {e}")
            return False
    
    def get_document_stats(self, organization_id: str) -> Dict[str, Any]:
        """Get statistics about stored vectors for an organization"""
        try:
            # Get index stats
            stats = self.index.describe_index_stats()
            return {
                "organization_id": organization_id,
                "total_vector_count": stats.total_vector_count,
                "dimension": stats.dimension,
                "index_fullness": stats.index_fullness,
                "namespaces": stats.namespaces
            }
        except Exception as e:
            print(f"Error getting document stats: {e}")
            return {} 