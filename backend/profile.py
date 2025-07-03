from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import Optional
import os
import uuid
from datetime import datetime
from PIL import Image
import io

from database import get_db
from auth import get_current_user
from schemas import User
from supabase_storage import SupabaseStorageService

router = APIRouter()

# Configure upload settings
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif"}

# Initialize Supabase Storage service
storage_service = SupabaseStorageService()

def validate_image_file(file: UploadFile) -> bool:
    """Validate uploaded image file"""
    if not file.filename:
        return False
    
    # Check file extension
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        return False
    
    return True

def process_image(image_data: bytes, filename: str) -> str:
    """Process and save image with compression"""
    try:
        # Open image with PIL
        image = Image.open(io.BytesIO(image_data))
        
        # Convert to RGB if necessary
        if image.mode in ('RGBA', 'LA', 'P'):
            image = image.convert('RGB')
        
        # Resize if too large (max 512x512)
        if image.width > 512 or image.height > 512:
            image.thumbnail((512, 512), Image.Resampling.LANCZOS)
        
        # Generate unique filename
        file_ext = os.path.splitext(filename)[1].lower()
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        
        # Save compressed image to bytes
        img_byte_arr = io.BytesIO()
        image.save(img_byte_arr, format='JPEG', quality=85, optimize=True)
        img_byte_arr = img_byte_arr.getvalue()
        
        # Upload to Supabase Storage
        storage_path = storage_service.upload_profile_image(
            file_content=img_byte_arr,
            filename=unique_filename
        )
        
        return storage_path
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Image processing failed: {str(e)}")

@router.post("/upload-profile-image")
async def upload_profile_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload and process profile image"""
    
    # Validate file
    if not validate_image_file(file):
        raise HTTPException(
            status_code=400, 
            detail="Invalid file type. Please upload JPG, PNG, or GIF files only."
        )
    
    # Check file size
    file_size = 0
    file_content = b""
    while chunk := await file.read(8192):
        file_size += len(chunk)
        file_content += chunk
        if file_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400, 
                detail="File too large. Maximum size is 5MB."
            )
    
    try:
        # Process and save image
        if not file.filename:
            raise HTTPException(status_code=400, detail="No filename provided")
        filename = process_image(file_content, file.filename)
        
        # Update user profile in database
        current_user.profile_image_url = filename  # This is now the Supabase URL
        current_user.updated_at = datetime.utcnow()
        db.commit()
        
        return JSONResponse({
            "message": "Profile image uploaded successfully",
            "profile_image_url": current_user.profile_image_url
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.get("/profile-images/{filename}")
async def get_profile_image(filename: str):
    """Get profile image URL from Supabase"""
    try:
        # Get the public URL from Supabase Storage
        public_url = storage_service.get_profile_image_url(filename)
        return {"url": public_url}
    except Exception as e:
        raise HTTPException(status_code=404, detail="Image not found")

@router.put("/update-profile")
async def update_profile(
    name: Optional[str] = Form(None),
    bio: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user profile information"""
    
    try:
        if name is not None:
            current_user.name = name
        if bio is not None:
            current_user.bio = bio
        
        current_user.updated_at = datetime.utcnow()
        db.commit()
        
        return JSONResponse({
            "message": "Profile updated successfully",
            "user": {
                "id": current_user.id,
                "name": current_user.name,
                "email": current_user.email,
                "bio": current_user.bio,
                "profile_image_url": current_user.profile_image_url
            }
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Profile update failed: {str(e)}")

@router.get("/profile")
async def get_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's profile"""
    
    return JSONResponse({
        "user": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "bio": current_user.bio,
            "profile_image_url": current_user.profile_image_url,
            "created_at": current_user.created_at,
            "updated_at": current_user.updated_at
        }
    }) 