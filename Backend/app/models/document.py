from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, LargeBinary
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Folder(Base):
    __tablename__ = "folders"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), index=True)
    parent_id = Column(Integer, ForeignKey("folders.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    subfolders = relationship("Folder", back_populates="parent", cascade="all, delete-orphan")
    parent = relationship("Folder", back_populates="subfolders", remote_side=[id])
    documents = relationship("Document", back_populates="folder", cascade="all, delete-orphan")

class Document(Base):
    __tablename__ = "documents"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), index=True)
    folder_id = Column(Integer, ForeignKey("folders.id"), nullable=True)
    file_data = Column(LargeBinary(length=(2**32)-1))
    file_type = Column(String(50))
    file_size = Column(Integer) # in bytes
    uploaded_by = Column(String(100), default="Admin")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    folder = relationship("Folder", back_populates="documents")
