from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from uuid import UUID

class UserBase(BaseModel):
    email: EmailStr
    name: Optional[str] = None

class UserCreate(UserBase):
    password: str
    organization_name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(UserBase):
    id: UUID
    role: str
    created_at: datetime

    class Config:
        from_attributes = True

class OrganizationBase(BaseModel):
    name: str

class OrganizationCreate(OrganizationBase):
    pass

class Organization(OrganizationBase):
    id: UUID
    created_by: Optional[UUID]
    created_at: datetime

    class Config:
        from_attributes = True

class OrganizationSearch(BaseModel):
    id: str
    name: str
    created_at: datetime
    member_count: int
    is_member: bool
    membership_status: Optional[str]

    class Config:
        from_attributes = True

class MembershipBase(BaseModel):
    user_id: UUID
    organization_id: UUID
    status: str
    role_in_org: str

class Membership(MembershipBase):
    id: UUID
    requested_at: datetime
    approved_at: Optional[datetime]

    class Config:
        from_attributes = True

class PaperBase(BaseModel):
    title: Optional[str]
    file_url: str

class PaperCreate(PaperBase):
    organization_id: UUID

class Paper(PaperBase):
    id: UUID
    uploaded_by: UUID
    organization_id: UUID
    uploaded_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: User

class TokenData(BaseModel):
    email: Optional[str] = None

class QueryRequest(BaseModel):
    question: str
    organization_id: UUID

class QueryResponse(BaseModel):
    answer: str
    sources: Optional[List[str]] = None

class UserOrganization(BaseModel):
    organization: Organization
    role: str
    joined_at: datetime

    class Config:
        from_attributes = True 