from supabase import create_client, Client
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from database import get_db, User, Organization, Membership, UserRole, MembershipRole, MembershipStatus
import os
from typing import Optional
from datetime import datetime
import uuid

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_ANON_KEY")

if not supabase_url or not supabase_key:
    raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment variables")

supabase: Client = create_client(supabase_url, supabase_key)

class SupabaseAuth:
    @staticmethod
    async def sign_up(email: str, password: str, name: Optional[str] = None):
        """Sign up a new user with email and password"""
        print(f"SupabaseAuth.sign_up called with email: {email}")
        try:
            response = supabase.auth.sign_up({
                "email": email,
                "password": password,
                "options": {
                    "data": {
                        "name": name or email.split('@')[0]
                    }
                }
            })
            
            if response.user:
                print(f"Creating user in database with ID: {response.user.id}")
                db = next(get_db())
                try:
                    user = User(
                        id=uuid.UUID(response.user.id),
                        email=email,
                        name=name or email.split('@')[0],
                        role=UserRole.MEMBER.value
                    )
                    print(f"User object created: {user}")
                    db.add(user)
                    print("User added to session")
                    db.commit()
                    print("Database committed successfully")
                    db.refresh(user)
                    print(f"User refreshed: {user}")
                    
                    return {
                        "user": user,
                        "session": response.session,
                        "message": "User created successfully. Please check your email for verification."
                    }
                except Exception as e:
                    print(f"Database error creating user: {str(e)}")
                    print(f"Error type: {type(e)}")
                    db.rollback()
                    try:
                        supabase.auth.admin.delete_user(response.user.id)
                        print("Supabase auth user deleted")
                    except Exception as delete_error:
                        print(f"Failed to delete Supabase user: {delete_error}")
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Failed to create user: {str(e)}"
                    )
                finally:
                    db.close()
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to create user"
                )
                
        except Exception as e:
            print(f"Supabase signup error: {str(e)}")
            print(f"Error type: {type(e)}")
            if "User already registered" in str(e):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="User with this email already exists"
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Signup failed: {str(e)}"
            )

    @staticmethod
    async def sign_in(email: str, password: str):
        """Sign in user with email and password"""
        try:
            response = supabase.auth.sign_in_with_password({
                "email": email,
                "password": password
            })
            
            if response.user and response.session:
                db = next(get_db())
                try:
                    user = db.query(User).filter(User.id == response.user.id).first()
                    if not user:
                        raise HTTPException(
                            status_code=status.HTTP_404_NOT_FOUND,
                            detail="User not found in database"
                        )
                    
                    return {
                        "user": user,
                        "session": response.session,
                        "access_token": response.session.access_token
                    }
                finally:
                    db.close()
            else:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid credentials"
                )
                
        except Exception as e:
            if "Invalid login credentials" in str(e):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid email or password"
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Login failed: {str(e)}"
            )

    @staticmethod
    async def get_user_by_token(access_token: str):
        """Get user from access token"""
        try:
            supabase.auth.set_session(access_token, access_token)
            response = supabase.auth.get_user()

            if not response or not response.user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token"
                )

            db = next(get_db())
            try:
                db_user = db.query(User).filter(User.id == response.user.id).first()
                if not db_user:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="User not found"
                    )
                return db_user
            finally:
                db.close()
                
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )


    @staticmethod
    async def sign_out(access_token: str):
        """Sign out user"""
        try:
            supabase.auth.set_session(access_token, access_token)
            supabase.auth.sign_out()
            return {"message": "Signed out successfully"}
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Sign out failed: {str(e)}"
            )

    @staticmethod
    async def reset_password(email: str):
        """Send password reset email"""
        try:
            supabase.auth.reset_password_email(email)
            return {"message": "Password reset email sent"}
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Password reset failed: {str(e)}"
            )

    @staticmethod
    async def create_organization(user_id: str, organization_name: str):
        """Create a new organization and add user as admin"""
        db = next(get_db())
        try:
            organization = Organization(
                id=uuid.uuid4(),
                name=organization_name,
                created_by=uuid.UUID(user_id)
            )
            db.add(organization)
            db.commit()
            db.refresh(organization)
            
            membership = Membership(
                id=uuid.uuid4(),
                user_id=uuid.UUID(user_id),
                organization_id=organization.id,
                status=MembershipStatus.APPROVED.value,
                role_in_org=MembershipRole.ORG_ADMIN.value,
                approved_at=datetime.utcnow()
            )
            db.add(membership)
            db.commit()
            
            return organization
            
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to create organization: {str(e)}"
            )
        finally:
            db.close()

    @staticmethod
    async def get_user_organizations(user_id: str):
        """Get all organizations a user belongs to"""
        db = next(get_db())
        try:
            memberships = db.query(Membership).filter(
                Membership.user_id == uuid.UUID(user_id),
                Membership.status == MembershipStatus.APPROVED
            ).all()
            
            organizations = []
            for membership in memberships:
                org = db.query(Organization).filter(Organization.id == membership.organization_id).first()
                if org:
                    organizations.append({
                        "organization": org,
                        "role": membership.role_in_org,
                        "joined_at": membership.approved_at
                    })
            
            return organizations
            
        finally:
            db.close() 