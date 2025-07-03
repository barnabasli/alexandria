import os
import uuid
from typing import Optional
import tempfile
import requests

class SupabaseStorageService:
    def __init__(self):
        self.supabase_url = os.getenv("SUPABASE_URL")
        # Use service role key for backend operations (bypasses RLS)
        self.supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
        
        if not self.supabase_url or not self.supabase_key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables")
        
        self.bucket_name = "uploadedpdfs"
        self.storage_url = f"{self.supabase_url}/storage/v1"
        self._ensure_bucket_exists()
    
    def _ensure_bucket_exists(self):
        """Ensure the storage bucket exists"""
        try:
            # Check if bucket exists
            response = requests.get(
                f"{self.storage_url}/bucket/{self.bucket_name}",
                headers={
                    "apikey": self.supabase_key,
                    "Authorization": f"Bearer {self.supabase_key}"
                }
            )
            
            if response.status_code == 404:
                # Create bucket
                create_response = requests.post(
                    f"{self.storage_url}/bucket",
                    headers={
                        "apikey": self.supabase_key,
                        "Authorization": f"Bearer {self.supabase_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "id": self.bucket_name,
                        "public": False
                    }
                )
                
                if create_response.status_code == 200:
                    print(f"✅ Bucket '{self.bucket_name}' created successfully")
                else:
                    print(f"⚠️  Bucket creation failed: {create_response.text}")
            else:
                print(f"✅ Bucket '{self.bucket_name}' already exists")
                
        except Exception as e:
            print(f"⚠️  Error checking/creating bucket: {e}")
    
    def upload_pdf(self, file_content: bytes, filename: str, organization_id: str) -> str:
        """Upload a PDF file to Supabase Storage"""
        try:
            # Generate unique filename
            unique_filename = f"{uuid.uuid4()}_{filename}"
            
            # Create organization-specific path with org_ prefix to match RLS policy
            file_path = f"org_{organization_id}/{unique_filename}"
            
            print(f"🔍 Debug: Uploading to path: {file_path}")
            print(f"🔍 Debug: Using key type: {'service_role' if self.supabase_key and 'service_role' in str(self.supabase_key) else 'anon'}")
            print(f"🔍 Debug: Organization ID: {organization_id}")
            
            # Upload to Supabase Storage
            response = requests.post(
                f"{self.storage_url}/object/{self.bucket_name}/{file_path}",
                headers={
                    "apikey": self.supabase_key,
                    "Authorization": f"Bearer {self.supabase_key}",
                    "Content-Type": "application/pdf"
                },
                data=file_content
            )
            
            print(f"🔍 Debug: Response status: {response.status_code}")
            print(f"🔍 Debug: Response body: {response.text}")
            
            if response.status_code == 200:
                print(f"✅ PDF uploaded successfully: {file_path}")
                return file_path
            else:
                raise Exception(f"Upload failed: {response.text}")
                
        except Exception as e:
            print(f"❌ Error uploading PDF: {e}")
            raise
    
    def download_pdf(self, file_path: str) -> bytes:
        """Download a PDF file from Supabase Storage"""
        try:
            # Download from Supabase Storage
            response = requests.get(
                f"{self.storage_url}/object/{self.bucket_name}/{file_path}",
                headers={
                    "apikey": self.supabase_key,
                    "Authorization": f"Bearer {self.supabase_key}"
                }
            )
            
            if response.status_code == 200:
                print(f"✅ PDF downloaded successfully: {file_path}")
                return response.content
            else:
                raise Exception(f"Download failed: {response.text}")
                
        except Exception as e:
            print(f"❌ Error downloading PDF: {e}")
            raise
    
    def get_pdf_url(self, file_path: str, expires_in: int = 3600) -> str:
        """Get a signed URL for PDF access"""
        try:
            # Generate signed URL for secure access
            response = requests.post(
                f"{self.storage_url}/object/sign/{self.bucket_name}/{file_path}",
                headers={
                    "apikey": self.supabase_key,
                    "Authorization": f"Bearer {self.supabase_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "expiresIn": expires_in
                }
            )
            
            if response.status_code == 200:
                result = response.json()
                return result.get("signedURL", "")
            else:
                raise Exception(f"Failed to generate signed URL: {response.text}")
                
        except Exception as e:
            print(f"❌ Error generating signed URL: {e}")
            raise
    
    def delete_pdf(self, file_path: str) -> bool:
        """Delete a PDF file from Supabase Storage"""
        try:
            # Delete from Supabase Storage
            response = requests.delete(
                f"{self.storage_url}/object/{self.bucket_name}/{file_path}",
                headers={
                    "apikey": self.supabase_key,
                    "Authorization": f"Bearer {self.supabase_key}"
                }
            )
            
            if response.status_code == 200:
                print(f"✅ PDF deleted successfully: {file_path}")
                return True
            else:
                print(f"⚠️  Delete failed: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Error deleting PDF: {e}")
            return False
    
    def list_organization_pdfs(self, organization_id: str) -> list:
        """List all PDFs for an organization"""
        try:
            # List files in organization folder
            response = requests.get(
                f"{self.storage_url}/object/list/{self.bucket_name}",
                headers={
                    "apikey": self.supabase_key,
                    "Authorization": f"Bearer {self.supabase_key}"
                },
                params={
                    "prefix": f"org_{organization_id}/",
                    "limit": 100
                }
            )
            
            if response.status_code == 200:
                result = response.json()
                return [item["name"] for item in result.get("data", [])]
            else:
                print(f"⚠️  List failed: {response.text}")
                return []
                
        except Exception as e:
            print(f"❌ Error listing PDFs: {e}")
            return []
    
    def get_pdf_info(self, file_path: str) -> Optional[dict]:
        """Get information about a PDF file"""
        try:
            # Get file info
            response = requests.head(
                f"{self.storage_url}/object/{self.bucket_name}/{file_path}",
                headers={
                    "apikey": self.supabase_key,
                    "Authorization": f"Bearer {self.supabase_key}"
                }
            )
            
            if response.status_code == 200:
                return {
                    "name": os.path.basename(file_path),
                    "size": int(response.headers.get("content-length", 0)),
                    "content_type": response.headers.get("content-type", "application/pdf")
                }
            else:
                return None
                
        except Exception as e:
            print(f"❌ Error getting PDF info: {e}")
            return None

    def upload_profile_image(self, file_content: bytes, filename: str) -> str:
        """Upload a profile image to Supabase Storage"""
        try:
            # Use the profilepictures bucket
            profile_bucket = "profilepictures"
            
            # Create profile image path
            file_path = f"profiles/{filename}"
            
            print(f"🔍 Debug: Uploading profile image to path: {file_path}")
            
            # Upload to Supabase Storage
            response = requests.post(
                f"{self.storage_url}/object/{profile_bucket}/{file_path}",
                headers={
                    "apikey": self.supabase_key,
                    "Authorization": f"Bearer {self.supabase_key}",
                    "Content-Type": "image/jpeg"
                },
                data=file_content
            )
            
            print(f"🔍 Debug: Profile image upload response status: {response.status_code}")
            print(f"🔍 Debug: Profile image upload response body: {response.text}")
            
            if response.status_code == 200:
                print(f"✅ Profile image uploaded successfully: {file_path}")
                return file_path
            else:
                raise Exception(f"Profile image upload failed: {response.text}")
                
        except Exception as e:
            print(f"❌ Error uploading profile image: {e}")
            raise

    def get_profile_image_url(self, file_path: str) -> str:
        """Get the public URL for a profile image"""
        try:
            # Use the profilepictures bucket
            profile_bucket = "profilepictures"
            
            # Construct the public URL
            public_url = f"{self.supabase_url}/storage/v1/object/public/{profile_bucket}/{file_path}"
            
            print(f"✅ Profile image URL generated: {public_url}")
            return public_url
                
        except Exception as e:
            print(f"❌ Error generating profile image URL: {e}")
            raise

    def delete_profile_image(self, file_path: str) -> bool:
        """Delete a profile image from Supabase Storage"""
        try:
            # Use the profilepictures bucket
            profile_bucket = "profilepictures"
            
            # Delete from Supabase Storage
            response = requests.delete(
                f"{self.storage_url}/object/{profile_bucket}/{file_path}",
                headers={
                    "apikey": self.supabase_key,
                    "Authorization": f"Bearer {self.supabase_key}"
                }
            )
            
            if response.status_code == 200:
                print(f"✅ Profile image deleted successfully: {file_path}")
                return True
            else:
                print(f"⚠️  Profile image delete failed: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Error deleting profile image: {e}")
            return False 