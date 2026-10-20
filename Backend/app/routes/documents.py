from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.document import Folder, Document
import io

router = APIRouter(prefix="/documents", tags=["Documents"])

# --- FOLDERS ---

@router.get("/folders")
def get_folders(parent_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(Folder)
    if parent_id is not None:
        if parent_id == 0:
            query = query.filter(Folder.parent_id == None)
        else:
            query = query.filter(Folder.parent_id == parent_id)
    return query.all()

@router.post("/folders")
def create_folder(name: str = Form(...), parent_id: Optional[int] = Form(None), db: Session = Depends(get_db)):
    if not parent_id:
        parent_id = None
        
    new_folder = Folder(name=name, parent_id=parent_id)
    db.add(new_folder)
    db.commit()
    db.refresh(new_folder)
    return new_folder

@router.put("/folders/{folder_id}")
def update_folder(folder_id: int, name: Optional[str] = Form(None), parent_id: Optional[int] = Form(None), db: Session = Depends(get_db)):
    folder = db.query(Folder).filter(Folder.id == folder_id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    if name:
        folder.name = name
    if parent_id is not None:
        folder.parent_id = parent_id if parent_id > 0 else None
    db.commit()
    db.refresh(folder)
    return folder

@router.delete("/folders/{folder_id}")
def delete_folder(folder_id: int, db: Session = Depends(get_db)):
    folder = db.query(Folder).filter(Folder.id == folder_id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    db.delete(folder)
    db.commit()
    return {"message": "Folder deleted"}

# --- DOCUMENTS ---

@router.get("/files")
def get_documents(folder_id: Optional[int] = None, db: Session = Depends(get_db)):
    # Don't fetch file_data in the list to save bandwidth
    query = db.query(
        Document.id, Document.name, Document.folder_id, 
        Document.file_type, Document.file_size, 
        Document.uploaded_by, Document.created_at, Document.updated_at
    )
    if folder_id is not None:
        if folder_id == 0:
            query = query.filter(Document.folder_id == None)
        else:
            query = query.filter(Document.folder_id == folder_id)
            
    documents = query.all()
    # Format the result to match the model output structure without file_data
    return [
        {
            "id": doc.id,
            "name": doc.name,
            "folder_id": doc.folder_id,
            "file_type": doc.file_type,
            "file_size": doc.file_size,
            "uploaded_by": doc.uploaded_by,
            "created_at": doc.created_at,
            "updated_at": doc.updated_at
        } for doc in documents
    ]

@router.get("/files/{file_id}/download")
def download_document(file_id: int, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == file_id).first()
    if not doc or not doc.file_data:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return Response(
        content=doc.file_data,
        media_type=doc.file_type or "application/octet-stream",
        headers={"Content-Disposition": f'inline; filename="{doc.name}"'}
    )

@router.post("/files")
async def upload_document(
    file: UploadFile = File(...),
    folder_id: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    if not folder_id:
        folder_id = None

    file_data = await file.read()
    file_size = len(file_data)
    
    new_doc = Document(
        name=file.filename,
        folder_id=folder_id,
        file_data=file_data,
        file_type=file.content_type,
        file_size=file_size,
        uploaded_by="Admin"
    )
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)
    
    return {
        "id": new_doc.id,
        "name": new_doc.name,
        "folder_id": new_doc.folder_id,
        "file_type": new_doc.file_type,
        "file_size": new_doc.file_size,
        "uploaded_by": new_doc.uploaded_by,
        "created_at": new_doc.created_at,
        "updated_at": new_doc.updated_at
    }

@router.put("/files/{file_id}")
def update_document(file_id: int, name: Optional[str] = Form(None), folder_id: Optional[int] = Form(None), db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == file_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if name:
        doc.name = name
    if folder_id is not None:
        doc.folder_id = folder_id if folder_id > 0 else None
    db.commit()
    db.refresh(doc)
    return {
        "id": doc.id,
        "name": doc.name,
        "folder_id": doc.folder_id,
        "file_type": doc.file_type,
        "file_size": doc.file_size,
        "uploaded_by": doc.uploaded_by,
        "created_at": doc.created_at,
        "updated_at": doc.updated_at
    }

@router.delete("/files/{file_id}")
def delete_document(file_id: int, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == file_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    db.delete(doc)
    db.commit()
    return {"message": "Document deleted"}
