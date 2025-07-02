from sqlalchemy import create_engine, Column, String, DateTime, ForeignKey, Text, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os
import enum
from dotenv import load_dotenv

load_dotenv()
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./database/app.db")

if DATABASE_URL.startswith("sqlite"):
    os.makedirs("database", exist_ok=True)
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class MembershipStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    DENIED = "denied"

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    ORG_ADMIN = "org_admin"
    MEMBER = "member"

class MembershipRole(str, enum.Enum):
    ORG_ADMIN = "org_admin"
    MEMBER = "member"

class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True)
    email = Column(String, unique=True, nullable=False)
    name = Column(String)
    role = Column(Enum(UserRole), default=UserRole.MEMBER.value, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    created_organizations = relationship("Organization", back_populates="created_by_user")
    memberships = relationship("Membership", back_populates="user")
    uploaded_papers = relationship("Paper", back_populates="uploaded_by_user")

class Organization(Base):
    __tablename__ = "organizations"
    
    id = Column(UUID(as_uuid=True), primary_key=True)
    name = Column(String, nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    created_by_user = relationship("User", back_populates="created_organizations")
    memberships = relationship("Membership", back_populates="organization")
    papers = relationship("Paper", back_populates="organization")

class Membership(Base):
    __tablename__ = "memberships"
    
    id = Column(UUID(as_uuid=True), primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"))
    status = Column(Enum(MembershipStatus), default=MembershipStatus.PENDING.value)
    role_in_org = Column(Enum(MembershipRole), default=MembershipRole.MEMBER.value)
    requested_at = Column(DateTime, default=datetime.utcnow)
    approved_at = Column(DateTime)
    
    # Relationships
    user = relationship("User", back_populates="memberships")
    organization = relationship("Organization", back_populates="memberships")

class Paper(Base):
    __tablename__ = "papers"
    
    id = Column(UUID(as_uuid=True), primary_key=True)
    title = Column(String)
    file_url = Column(String)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"))
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    uploaded_by_user = relationship("User", back_populates="uploaded_papers")
    organization = relationship("Organization", back_populates="papers")

# Create tables
Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close() 