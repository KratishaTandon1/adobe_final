from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import uvicorn
import os
import shutil
from datetime import datetime
import json
import requests
import PyPDF2
from dotenv import load_dotenv
import io
import base64
import urllib.parse  # For URL encoding/decoding
import re
from collections import Counter
import numpy as np

# Try to import Azure Speech SDK, but continue without it if not available
try:
    import azure.cognitiveservices.speech as speechsdk
    AZURE_SDK_AVAILABLE = True
except ImportError:
    print("⚠️ Azure Cognitive Services Speech SDK not available. Using REST API only.")
    AZURE_SDK_AVAILABLE = False

# Enhanced PDF analysis imports
try:
    import fitz  # PyMuPDF
    from sentence_transformers import SentenceTransformer, util
    from sklearn.metrics.pairwise import cosine_similarity
    ENHANCED_PDF_ANALYSIS = True
    print("✅ Enhanced PDF analysis dependencies loaded successfully")
except ImportError as e:
    print(f"⚠️ Enhanced PDF analysis not available: {e}")
    print("Install with: pip install PyMuPDF sentence-transformers scikit-learn")
    ENHANCED_PDF_ANALYSIS = False

# Load environment variables from .env file
load_dotenv()

# Initialize the semantic model for enhanced analysis (only if dependencies available)
semantic_model = None
if ENHANCED_PDF_ANALYSIS:
    try:
        print("🧠 Loading semantic model for intelligent document analysis...")
        semantic_model = SentenceTransformer('all-MiniLM-L6-v2')
        print("✅ Semantic model loaded successfully")
    except Exception as e:
        print(f"❌ Failed to load semantic model: {e}")
        ENHANCED_PDF_ANALYSIS = False


app = FastAPI(title="PDF Viewer API", version="1.0.0")

# Serve static frontend files from 'dist' directory at '/static' to avoid shadowing API routes
import pathlib
from fastapi.responses import RedirectResponse
DIST_DIR = pathlib.Path(__file__).parent / "dist"
print(f"🔍 Checking for frontend directory: {DIST_DIR}")
print(f"✅ Serving frontend from: {DIST_DIR}")
app.mount("/static", StaticFiles(directory=str(DIST_DIR / "static")), name="static")
# app.mount("/static", StaticFiles(directory=str(DIST_DIR), html=True), name="frontend")
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Document loading functions
def load_documents_from_uploads(existing_docs: Optional[List] = None):
    """Load documents by scanning the uploads folder"""
    if existing_docs is None:
        existing_docs = []
        
    try:
        documents = []
        print(f"🔍 Checking uploads directory: {UPLOAD_DIR}")
        if not os.path.exists(UPLOAD_DIR):
            print(f"⚠️ Uploads directory does not exist: {UPLOAD_DIR}")
            return documents
            
        pdf_files = [f for f in os.listdir(UPLOAD_DIR) if f.lower().endswith('.pdf')]
        print(f"📁 Found {len(pdf_files)} PDF files in uploads directory")
        
        for i, filename in enumerate(sorted(pdf_files), 1):
            file_path = os.path.join(UPLOAD_DIR, filename)
            print(f"📄 Processing file {i}: {filename}")
            try:
                file_size = os.path.getsize(file_path)
                file_stat = os.stat(file_path)
                upload_date = datetime.fromtimestamp(file_stat.st_ctime).isoformat()
                
                # Check if document already exists in memory to preserve upload_type
                existing_doc = next((doc for doc in existing_docs if doc.filename == filename), None)
                upload_type = existing_doc.upload_type if existing_doc else "bulk"
                
                document = PDFDocument(
                    id=i,
                    filename=filename,
                    original_name=filename,
                    upload_date=upload_date,
                    file_size=file_size,
                    file_url=f"http://localhost:8080/api/pdf/{urllib.parse.quote(filename)}",
                    indexed_content=False,
                    upload_type=upload_type
                )
                documents.append(document)
                print(f"✅ Successfully loaded: {filename} as {upload_type}")
                
            except Exception as e:
                print(f"⚠️ Error processing file {filename}: {e}")
                print(f"⚠️ Error type: {type(e).__name__}")
                print(f"⚠️ Error details: {str(e)}")
                continue
        
        print(f"✅ Loaded {len(documents)} documents from uploads folder")
        return documents
        
    except Exception as e:
        print(f"⚠️ Error scanning uploads folder: {e}")
        return []

# Custom static file serving with proper headers for PDFs
class PDFStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)
        if path.endswith('.pdf'):
            response.headers["Accept-Ranges"] = "bytes"
            response.headers["Content-Type"] = "application/pdf"
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Headers"] = "*"
            response.headers["Access-Control-Allow-Methods"] = "GET, HEAD, OPTIONS"
        return response

# Serve static files (uploaded PDFs) with custom headers
app.mount("/uploads", PDFStaticFiles(directory=UPLOAD_DIR), name="uploads")

# Add CORS middleware to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PDFDocument(BaseModel):
    id: Optional[int] = None
    filename: str
    original_name: str
    upload_date: str
    file_size: int
    file_url: str
    # Enhanced document metadata
    extracted_sections: Optional[List[Dict[str, Any]]] = None
    indexed_content: Optional[bool] = False
    # Document categorization
    upload_type: str = "fresh"  # "bulk" or "fresh"

# Initialize documents after class definition
pdf_documents: List[PDFDocument] = load_documents_from_uploads()

class SummaryRequest(BaseModel):
    document_id: int
    document_name: str

class TextSummaryRequest(BaseModel):
    selected_text: str
    context: Optional[str] = None  # Optional document context

class SummaryResponse(BaseModel):
    summary: str

# New models for intelligent document analysis
class DocumentSection(BaseModel):
    id: str
    title: str
    content: str
    page: int
    level: str  # H1, H2, H3, H4
    font_size: Optional[float] = None
    position: Optional[Dict[str, float]] = None

class RelatedSnippet(BaseModel):
    id: str
    title: str
    content: str
    document_id: int
    document_name: str
    page: int
    section_id: str
    similarity_score: float
    snippet_type: str  # "related", "contradictory", "supporting"

class IntelligentAnalysisRequest(BaseModel):
    selected_text: str
    current_document_id: int
    max_results: Optional[int] = 5

class IntelligentAnalysisResponse(BaseModel):
    query_text: str
    related_snippets: List[RelatedSnippet]
    analysis_summary: str
    processing_time: float

class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = "alloy"  # Azure OpenAI TTS voices: alloy, echo, fable, onyx, nova, shimmer
    speed: Optional[str] = "medium"  # slow, medium, fast

class TTSResponse(BaseModel):
    audio_data: str  # Base64 encoded audio
    content_type: str

# Insights models
class InsightsRequest(BaseModel):
    selected_text: str
    document_name: str
    context: Optional[str] = None

class InsightsResponse(BaseModel):
    key_takeaways: List[str]
    did_you_know: List[str]
    contradictions: List[str]
    examples: List[str]
    cross_document_inspirations: List[str]
    processing_time: float

# Upload response models
class UploadResponse(BaseModel):
    status: str
    message: str
    document: PDFDocument
    upload_payload: Dict[str, Any]  # Contains the original upload parameters

class BulkUploadResponse(BaseModel):
    status: str
    message: str
    total_files: int
    successful_uploads: int
    failed_uploads: int
    uploaded_documents: List[PDFDocument]
    upload_payload: Dict[str, Any]  # Contains the original upload parameters

# Podcast models
class PodcastRequest(BaseModel):
    selected_text: str
    document_name: str
    context: Optional[str] = None
    duration: Optional[str] = "3-min"  # "2-min", "3-min", "5-min"
    style: Optional[str] = "podcast"  # "podcast" or "overview"

class PodcastResponse(BaseModel):
    audio_data: str  # Base64 encoded audio
    script: str
    content_type: str
    duration_seconds: Optional[float] = None

class AudioOverviewRequest(BaseModel):
    document_id: int
    section_text: Optional[str] = None
    insights_data: Optional[Dict] = None
    audio_type: str = "overview"  # "overview" or "podcast"

# In-memory storage - will be initialized after PDFDocument class is defined

# Enhanced storage for intelligent analysis
document_sections: Dict[int, List[DocumentSection]] = {}  # document_id -> sections
section_embeddings: Dict[str, np.ndarray] = {}  # section_id -> embedding vector


# Redirect root to /static/index.html if frontend is served
@app.get("/")
async def root():
    index_file = DIST_DIR / "index.html"
    if index_file.exists():
        print(f"📄 Serving index.html from: {index_file}")
        return FileResponse(index_file)
    return {"message": "Welcome to the PDF Viewer API"}

@app.get("/debug")
async def debug_info():
    return {
        "documents_count": len(pdf_documents),
        "upload_dir": UPLOAD_DIR,
        "upload_dir_exists": os.path.exists(UPLOAD_DIR),
        "files_in_dir": os.listdir(UPLOAD_DIR) if os.path.exists(UPLOAD_DIR) else [],
        "sample_document": pdf_documents[0].__dict__ if pdf_documents else None,
        "upload_types": [doc.upload_type for doc in pdf_documents],
        "debug": "trigger reload"
    }

@app.get("/reload")
async def manual_reload():
    global pdf_documents
    try:
        print("🔄 Starting manual reload...")
        pdf_documents = load_documents_from_uploads(pdf_documents)
        print(f"🔄 Manual reload completed. Loaded {len(pdf_documents)} documents")
        return {
            "status": "success", 
            "loaded_count": len(pdf_documents),
            "documents": [{"id": doc.id, "name": doc.original_name, "type": doc.upload_type} for doc in pdf_documents]
        }
    except Exception as e:
        print(f"❌ Manual reload failed: {e}")
        return {
            "status": "error",
            "error": str(e),
            "error_type": type(e).__name__
        }

@app.get("/test-files")
async def test_file_access():
    results = []
    try:
        if not os.path.exists(UPLOAD_DIR):
            return {"error": "Upload directory does not exist"}
            
        pdf_files = [f for f in os.listdir(UPLOAD_DIR) if f.lower().endswith('.pdf')]
        
        for filename in pdf_files[:3]:  # Test first 3 files
            file_path = os.path.join(UPLOAD_DIR, filename)
            try:
                file_size = os.path.getsize(file_path)
                file_stat = os.path.stat(file_path)
                
                upload_date = datetime.fromtimestamp(file_stat.st_ctime).isoformat()
                upload_type = "fresh"  # Always default to fresh
                
                results.append({
                    "filename": filename,
                    "file_size": file_size,
                    "upload_date": upload_date,
                    "upload_type": upload_type,
                    "status": "success"
                })
            except Exception as e:
                results.append({
                    "filename": filename,
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "status": "error"
                })
        
        return {"results": results}
        
    except Exception as e:
        return {"error": str(e), "error_type": type(e).__name__}

@app.get("/fix-documents")
async def fix_documents():
    """Alternative endpoint to manually create documents from uploads folder"""
    global pdf_documents
    try:
        pdf_documents = []  # Clear existing documents
        
        if not os.path.exists(UPLOAD_DIR):
            return {"error": "Upload directory does not exist"}
            
        pdf_files = [f for f in os.listdir(UPLOAD_DIR) if f.lower().endswith('.pdf')]
        
        for i, filename in enumerate(sorted(pdf_files), 1):
            file_path = os.path.join(UPLOAD_DIR, filename)
            try:
                file_size = os.path.getsize(file_path)
                # Use fixed date instead of file timestamp to avoid datetime issues
                upload_date = "2025-08-17T17:30:00"
                
                # Always default to fresh - users can manually categorize
                upload_type = "fresh"
                
                document = PDFDocument(
                    id=i,
                    filename=filename,
                    original_name=filename,
                    upload_date=upload_date,
                    file_size=file_size,
                    file_url=f"http://localhost:8080/api/pdf/{urllib.parse.quote(filename)}",
                    indexed_content=False,
                    upload_type=upload_type
                )
                pdf_documents.append(document)
                
            except Exception as e:
                continue
        
        return {
            "status": "success",
            "message": f"Successfully created {len(pdf_documents)} documents",
            "documents": [{"id": doc.id, "name": doc.original_name, "type": doc.upload_type} for doc in pdf_documents]
        }
        
    except Exception as e:
        return {
            "status": "error", 
            "error": str(e),
            "error_type": type(e).__name__
        }

@app.get("/api/documents", response_model=List[PDFDocument])
async def get_documents():
    # Only reload documents if there are changes in the uploads folder
    global pdf_documents
    
    if not os.path.exists(UPLOAD_DIR):
        return pdf_documents
    
    # Get current PDF files in uploads directory
    current_files = set(f for f in os.listdir(UPLOAD_DIR) if f.lower().endswith('.pdf'))
    # Get files already in memory
    memory_files = set(doc.filename for doc in pdf_documents)
    
    # Only reload if files have been added or removed
    if current_files != memory_files:
        print(f"📁 Files changed in uploads directory, reloading...")
        pdf_documents = load_documents_from_uploads(pdf_documents)
    
    return pdf_documents

# Serve PDF files with proper headers for Adobe SDK
@app.get("/api/pdf/{filename}")
async def serve_pdf(filename: str):
    # URL decode the filename to handle spaces and special characters
    decoded_filename = urllib.parse.unquote(filename)
    print(f"📄 Serving PDF: {filename} -> decoded: {decoded_filename}")
    
    file_path = os.path.join(UPLOAD_DIR, decoded_filename)
    if not os.path.exists(file_path):
        # Try with original filename if decoded doesn't exist
        file_path = os.path.join(UPLOAD_DIR, filename)
        if not os.path.exists(file_path):
            print(f"❌ File not found: {file_path}")
            # Clean up database entry if file doesn't exist
            doc_to_remove = None
            for doc in pdf_documents:
                if doc.filename == decoded_filename or doc.filename == filename:
                    doc_to_remove = doc
                    break
            
            if doc_to_remove:
                print(f"🗑️ Removing document from database (file not found): {doc_to_remove.original_name}")
                pdf_documents.remove(doc_to_remove)
                # Clean up intelligent analysis data
                if doc_to_remove.id in document_sections:
                    sections = document_sections[doc_to_remove.id]
                    for section in sections:
                        section_embeddings.pop(section.id, None)
                    del document_sections[doc_to_remove.id]
                # No need to save database - documents loaded from uploads folder
            
            raise HTTPException(status_code=404, detail=f"File not found: {decoded_filename}")
    
    print(f"✅ Serving file: {file_path}")
    return FileResponse(
        file_path,
        media_type="application/pdf",
        headers={
            "Accept-Ranges": "bytes",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
            "Content-Type": "application/pdf"
        }
    )

@app.get("/api/documents/{document_id}", response_model=PDFDocument)
async def get_document(document_id: int):
    for doc in pdf_documents:
        if doc.id == document_id:
            return doc
    raise HTTPException(status_code=404, detail="Document not found")

@app.post("/api/upload", response_model=UploadResponse)
async def upload_pdf(file: UploadFile = File(...), upload_type: str = "fresh"):
    # Validate file type
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    # Use original filename (no timestamp)
    filename = file.filename
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    # Store upload payload for response
    upload_payload = {
        "filename": filename,
        "upload_type": upload_type,
        "timestamp": datetime.now().isoformat()
    }
    
    # Check if file already exists
    if os.path.exists(file_path):
        # Check if document already exists in database
        existing_doc = next((doc for doc in pdf_documents if doc.filename == filename), None)
        if existing_doc:
            print(f"📄 Document already exists: {filename}")
            # Update upload_type if different
            if existing_doc.upload_type != upload_type:
                existing_doc.upload_type = upload_type
                print(f"🔄 Updated upload_type for {filename} to {upload_type}")
            
            return UploadResponse(
                status="success",
                message=f"Document already exists and updated to {upload_type} type",
                document=existing_doc,
                upload_payload=upload_payload
            )
    
    # Save file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Get file size
    file_size = os.path.getsize(file_path)
    
    # Create document record
    new_id = max([doc.id for doc in pdf_documents], default=0) + 1
    new_document = PDFDocument(
        id=new_id,
        filename=filename,
        original_name=file.filename,
        upload_date=datetime.now().isoformat(),
        file_size=file_size,
    file_url=f"http://localhost:8080/api/pdf/{urllib.parse.quote(filename)}",
        indexed_content=False,
        upload_type=upload_type
    )
    
    pdf_documents.append(new_document)
    # No need to save to database - documents loaded from uploads folder
    
    # Process document for intelligent analysis in background
    if ENHANCED_PDF_ANALYSIS:
        try:
            await process_document_for_intelligence(new_id, file_path)
            # Update the document to indicate it's been processed
            for doc in pdf_documents:
                if doc.id == new_id:
                    doc.indexed_content = True
                    break
            # No need to save database - documents loaded from uploads folder
        except Exception as e:
            print(f"⚠️ Failed to process document {new_id} for intelligence: {e}")
            # Don't fail the upload, just continue without intelligent features
    
    # Update upload payload with additional info
    upload_payload.update({
        "file_size": file_size,
        "document_id": new_id,
        "processing_status": "completed"
    })
    
    return UploadResponse(
        status="success",
        message=f"Document uploaded successfully as {upload_type} type",
        document=new_document,
        upload_payload=upload_payload
    )

@app.post("/api/bulk-upload", response_model=BulkUploadResponse)
async def bulk_upload_pdfs(files: List[UploadFile] = File(...)):
    """Upload multiple PDF files as bulk/background documents"""
    uploaded_docs = []
    failed_count = 0
    total_files = len(files)
    
    # Store upload payload for response
    upload_payload = {
        "upload_type": "bulk",
        "total_files": total_files,
        "timestamp": datetime.now().isoformat(),
        "file_details": []
    }
    
    for file in files:
        file_payload = {
            "filename": file.filename,
            "status": "pending"
        }
        
        try:
            # Validate file type
            if not file.filename.lower().endswith('.pdf'):
                file_payload.update({
                    "status": "skipped",
                    "reason": "Not a PDF file"
                })
                upload_payload["file_details"].append(file_payload)
                continue  # Skip non-PDF files
            
            # Use original filename (no timestamp)
            filename = file.filename
            file_path = os.path.join(UPLOAD_DIR, filename)
            
            # Check if file already exists
            if os.path.exists(file_path):
                # Check if document already exists in database
                existing_doc = next((doc for doc in pdf_documents if doc.filename == filename), None)
                if existing_doc:
                    print(f"📄 Document already exists, updating type: {filename}")
                    # Update to bulk type if different
                    if existing_doc.upload_type != "bulk":
                        existing_doc.upload_type = "bulk"
                        print(f"🔄 Updated {filename} to bulk type")
                    
                    uploaded_docs.append(existing_doc)
                    file_payload.update({
                        "status": "updated",
                        "document_id": existing_doc.id,
                        "upload_type": "bulk"
                    })
                    upload_payload["file_details"].append(file_payload)
                    continue
            
            # Save file
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            # Get file size
            file_size = os.path.getsize(file_path)
            
            # Create document record
            new_id = max([doc.id for doc in pdf_documents], default=0) + 1
            new_document = PDFDocument(
                id=new_id,
                filename=filename,
                original_name=file.filename,
                upload_date=datetime.now().isoformat(),
                file_size=file_size,
                file_url=f"http://localhost:8080/api/pdf/{urllib.parse.quote(filename)}",
                indexed_content=False,
                upload_type="bulk"  # Mark as bulk upload
            )
            
            pdf_documents.append(new_document)
            uploaded_docs.append(new_document)
            
            file_payload.update({
                "status": "success",
                "document_id": new_id,
                "file_size": file_size,
                "upload_type": "bulk"
            })
            
            # Process document for intelligent analysis in background
            if ENHANCED_PDF_ANALYSIS:
                try:
                    await process_document_for_intelligence(new_id, file_path)
                    # Update the document to indicate it's been processed
                    new_document.indexed_content = True
                    file_payload["processing_status"] = "analyzed"
                except Exception as e:
                    print(f"⚠️ Failed to process document {new_id} for intelligence: {e}")
                    file_payload["processing_status"] = "basic"
                    # Don't fail the upload, just continue without intelligent features
                    
        except Exception as e:
            print(f"⚠️ Failed to upload {file.filename}: {e}")
            failed_count += 1
            file_payload.update({
                "status": "failed",
                "error": str(e)
            })
        
        upload_payload["file_details"].append(file_payload)
    
    # Update final payload stats
    successful_uploads = len(uploaded_docs)
    upload_payload.update({
        "successful_uploads": successful_uploads,
        "failed_uploads": failed_count,
        "processing_completed": datetime.now().isoformat()
    })
    
    return BulkUploadResponse(
        status="completed",
        message=f"Bulk upload completed: {successful_uploads} successful, {failed_count} failed",
        total_files=total_files,
        successful_uploads=successful_uploads,
        failed_uploads=failed_count,
        uploaded_documents=uploaded_docs,
        upload_payload=upload_payload
    )

@app.delete("/api/documents/{document_id}")
async def delete_document(document_id: int):
    for i, doc in enumerate(pdf_documents):
        if doc.id == document_id:
            deleted_doc = pdf_documents.pop(i)
            # Delete physical file
            file_path = os.path.join(UPLOAD_DIR, deleted_doc.filename)
            if os.path.exists(file_path):
                os.remove(file_path)
            # Clean up intelligent analysis data
            if document_id in document_sections:
                # Remove section embeddings
                sections = document_sections[document_id]
                for section in sections:
                    section_embeddings.pop(section.id, None)
                # Remove document sections
                del document_sections[document_id]
            # No need to save database - documents loaded from uploads folder
            return {"message": f"Document {deleted_doc.original_name} deleted successfully"}
    raise HTTPException(status_code=404, detail="Document not found")

@app.put("/api/documents/{document_id}/type")
async def update_document_type(document_id: int, upload_type: str):
    """Update document upload_type for testing visual differentiation"""
    for doc in pdf_documents:
        if doc.id == document_id:
            doc.upload_type = upload_type
            return {"message": f"Document {doc.original_name} updated to {upload_type}"}
    raise HTTPException(status_code=404, detail="Document not found")

@app.post("/api/intelligent-analysis", response_model=IntelligentAnalysisResponse)
async def intelligent_analysis(request: IntelligentAnalysisRequest):
    """
    Find related, overlapping, and contradictory content from the document library
    based on selected text using advanced semantic analysis
    """
    if not ENHANCED_PDF_ANALYSIS:
        raise HTTPException(status_code=503, detail="Enhanced PDF analysis not available. Please install required dependencies.")
    
    start_time = datetime.now()
    
    try:
        print(f"🧠 Starting intelligent analysis for text: {request.selected_text[:100]}...")
        
        # Get query embedding
        query_embedding = semantic_model.encode([request.selected_text])
        
        # Find related snippets from all documents
        related_snippets = []
        
        for doc_id, sections in document_sections.items():
            # Skip current document to find content from OTHER documents
            if doc_id == request.current_document_id:
                continue
                
            doc = next((d for d in pdf_documents if d.id == doc_id), None)
            if not doc:
                continue
            
            for section in sections:
                if section.id not in section_embeddings:
                    continue
                
                # Calculate semantic similarity
                section_embedding = section_embeddings[section.id].reshape(1, -1)
                query_embedding_reshaped = query_embedding.reshape(1, -1)
                similarity = cosine_similarity(query_embedding_reshaped, section_embedding)[0][0]
                
                # Only include highly relevant sections (threshold 0.3)
                if similarity > 0.3:
                    # Generate snippet (2-4 sentences)
                    snippet_content = generate_snippet(section.content)
                    
                    # Determine snippet type based on similarity and content analysis
                    snippet_type = determine_snippet_type(request.selected_text, section.content, similarity)
                    
                    related_snippet = RelatedSnippet(
                        id=section.id,
                        title=section.title,
                        content=snippet_content,
                        document_id=doc_id,
                        document_name=doc.original_name,
                        page=section.page,
                        section_id=section.id,
                        similarity_score=similarity,
                        snippet_type=snippet_type
                    )
                    related_snippets.append(related_snippet)
        
        # Sort by similarity score (highest first) and limit results
        related_snippets.sort(key=lambda x: x.similarity_score, reverse=True)
        related_snippets = related_snippets[:request.max_results]
        
        # Generate analysis summary
        analysis_summary = await generate_analysis_summary(request.selected_text, related_snippets)
        
        processing_time = (datetime.now() - start_time).total_seconds()
        
        print(f"✅ Intelligent analysis completed in {processing_time:.2f}s, found {len(related_snippets)} related snippets")
        
        return IntelligentAnalysisResponse(
            query_text=request.selected_text,
            related_snippets=related_snippets,
            analysis_summary=analysis_summary,
            processing_time=processing_time
        )
        
    except Exception as e:
        print(f"❌ Error in intelligent analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Intelligent analysis failed: {str(e)}")

@app.get("/api/document-sections/{document_id}")
async def get_document_sections(document_id: int):
    """Get extracted sections for a document"""
    if document_id not in document_sections:
        raise HTTPException(status_code=404, detail="Document sections not found")
    
    return {
        "document_id": document_id,
        "sections": [section.dict() for section in document_sections[document_id]]
    }

@app.get("/api/navigate-to-section/{document_id}/{section_id}")
async def navigate_to_section(document_id: int, section_id: str):
    """Get navigation info for a specific section"""
    if document_id not in document_sections:
        raise HTTPException(status_code=404, detail="Document not found")
    
    section = next((s for s in document_sections[document_id] if s.id == section_id), None)
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    
    return {
        "document_id": document_id,
        "section": section.dict(),
        "navigation": {
            "page": section.page,
            "title": section.title,
            "level": section.level
        }
    }

@app.post("/api/generate-summary")
async def generate_summary(request: SummaryRequest):
    """Generate AI summary of PDF document using Gemini API"""
    try:
        print(f"🔍 Looking for document ID: {request.document_id}")
        print(f"📚 Available documents: {[doc.id for doc in pdf_documents]}")
        
        # Find the document
        document = None
        for doc in pdf_documents:
            if doc.id == request.document_id:
                document = doc
                break
        
        if not document:
            print(f"❌ Document not found! Available IDs: {[doc.id for doc in pdf_documents]}")
            raise HTTPException(status_code=404, detail=f"Document not found. Available IDs: {[doc.id for doc in pdf_documents]}")
        
        print(f"✅ Found document: {document.original_name}")
        
        # Extract text from PDF
        pdf_path = os.path.join(UPLOAD_DIR, document.filename)
        if not os.path.exists(pdf_path):
            print(f"❌ PDF file not found at: {pdf_path}")
            raise HTTPException(status_code=404, detail="PDF file not found")
        
        print(f"📄 Extracting text from: {pdf_path}")
        pdf_text = extract_pdf_text(pdf_path)
        print(f"📄 Extracted text length: {len(pdf_text)} characters")
        print(f"📄 First 200 characters: {pdf_text[:200]}")
        
        if not pdf_text.strip():
            print("❌ No text extracted from PDF")
            raise HTTPException(status_code=400, detail="Could not extract text from PDF")
        
        print("🤖 Calling Gemini API...")
        # Generate summary using Gemini API
        summary = await generate_gemini_summary(pdf_text, document.original_name)
        print(f"✅ Summary generated: {summary[:100]}...")
        
        return SummaryResponse(summary=summary)
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        print(f"❌ Unexpected error generating summary: {str(e)}")
        print(f"❌ Error type: {type(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/api/available-voices")
async def get_available_voices():
    """Get available TTS voices"""
    try:
        # Azure OpenAI TTS voices
        azure_voices = [
            {"id": "alloy", "name": "Alloy (Neutral)", "provider": "azure"},
            {"id": "echo", "name": "Echo (Male)", "provider": "azure"},
            {"id": "fable", "name": "Fable (British Male)", "provider": "azure"},
            {"id": "onyx", "name": "Onyx (Deep Male)", "provider": "azure"},
            {"id": "nova", "name": "Nova (Female)", "provider": "azure"},
            {"id": "shimmer", "name": "Shimmer (Female)", "provider": "azure"}
        ]
        
        # Local Windows voices (simplified mapping)
        windows_voices = [
            {"id": "male", "name": "David (Male)", "provider": "local"},
            {"id": "female", "name": "Zira (Female)", "provider": "local"}
        ]
        
        # Check if Azure is configured
        azure_key = os.getenv("AZURE_TTS_KEY")
        azure_endpoint = os.getenv("AZURE_TTS_ENDPOINT")
        
        if azure_key and azure_endpoint:
            return {"voices": azure_voices + windows_voices, "default": "alloy", "providers": ["azure", "local"]}
        else:
            return {"voices": windows_voices, "default": "female", "providers": ["local"]}
            
    except Exception as e:
        print(f"❌ Error getting available voices: {e}")
        return {"voices": [{"id": "female", "name": "Default (Female)", "provider": "local"}], "default": "female", "providers": ["local"]}

@app.get("/test-tts")
async def test_tts():
    """Test TTS system with a simple message"""
    try:
        print("🧪 Testing TTS system...")
        test_text = "Hello, this is a test of the text-to-speech system."
        
        # Generate speech using local TTS
        audio_data = await generate_local_speech(test_text, "alloy", "medium")
        
        if audio_data and len(audio_data) > 1000:
            return {"status": "success", "message": f"TTS test successful - generated {len(audio_data)} bytes"}
        else:
            return {"status": "failed", "message": f"TTS test failed - generated {len(audio_data) if audio_data else 0} bytes"}
            
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/text-to-speech")
async def text_to_speech(request: TTSRequest):
    """Convert text to speech using Azure TTS"""
    try:
        print(f"🎙️ TTS Request received: {request.text[:100]}...")
        print(f"🔊 Voice: {request.voice}, Speed: {request.speed}")
        
        if not request.text.strip():
            print("❌ Empty text provided")
            raise HTTPException(status_code=400, detail="Text cannot be empty")
        
        print(f"🎙️ Converting text to speech: {request.text[:100]}...")
        print(f"🔊 Voice: {request.voice}, Speed: {request.speed}")
        
        # Generate speech using Azure TTS
        audio_data = await generate_azure_speech(request.text, request.voice, request.speed)
        
        if audio_data:
            # Convert audio to base64 for JSON response
            audio_base64 = base64.b64encode(audio_data).decode('utf-8')
            print(f"✅ Speech generated successfully: {len(audio_data)} bytes -> {len(audio_base64)} base64 chars")
            
            return TTSResponse(
                audio_data=audio_base64,
                content_type="audio/wav"
            )
        else:
            print("❌ No audio data generated")
            raise HTTPException(status_code=500, detail="Failed to generate speech")
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Unexpected error generating speech: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/api/generate-insights", response_model=InsightsResponse)
async def generate_insights(request: InsightsRequest):
    """Generate AI-powered insights using Gemini API"""
    start_time = datetime.now()
    
    try:
        if not request.selected_text.strip():
            raise HTTPException(status_code=400, detail="Selected text cannot be empty")
        
        print(f"🔍 Generating insights for: {request.selected_text[:100]}...")
        
        # Generate insights using Gemini API
        insights = await generate_gemini_insights(request.selected_text, request.document_name, request.context)
        
        processing_time = (datetime.now() - start_time).total_seconds()
        print(f"💡 Insights generated in {processing_time:.2f}s")
        
        return InsightsResponse(
            key_takeaways=insights.get("key_takeaways", []),
            did_you_know=insights.get("did_you_know", []),
            contradictions=insights.get("contradictions", []),
            examples=insights.get("examples", []),
            cross_document_inspirations=insights.get("cross_document_inspirations", []),
            processing_time=processing_time
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error generating insights: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate insights: {str(e)}")

@app.post("/api/generate-podcast")
async def generate_podcast(request: PodcastRequest):
    """Generate AI-powered podcast or audio overview"""
    try:
        if not request.selected_text.strip():
            raise HTTPException(status_code=400, detail="Selected text cannot be empty")
        
        print(f"🎙️ Generating {request.style} for: {request.selected_text[:100]}...")
        
        # Generate podcast script using Gemini API
        script = await generate_podcast_script(request.selected_text, request.document_name, request.context, request.duration, request.style)
        
        # Convert script to audio using Azure TTS
        audio_data = await generate_podcast_audio(script, request.style)
        
        if not audio_data:
            raise HTTPException(status_code=500, detail="Failed to generate audio")
        
        # Convert audio to base64
        audio_base64 = base64.b64encode(audio_data).decode('utf-8')
        
        return PodcastResponse(
            audio_data=audio_base64,
            script=script,
            content_type="audio/wav"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error generating podcast: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate podcast: {str(e)}")

@app.post("/api/generate-text-summary")
async def generate_text_summary(request: TextSummaryRequest):
    """Generate AI summary of selected text using Gemini API"""
    try:
        if not request.selected_text.strip():
            raise HTTPException(status_code=400, detail="Selected text cannot be empty")
        
        # Check for at least 1 word to ensure meaningful content
        words = request.selected_text.strip().split()
        word_count = len([word for word in words if word.strip()])
        if word_count < 1:
            raise HTTPException(status_code=400, detail=f"Selected text must contain at least 1 word. Current: {word_count} words.")
        
        print(f"🔍 Generating summary for selected text: {request.selected_text[:100]}...")
        print(f"📄 Selected text length: {len(request.selected_text)} characters, {word_count} words")
        
        # Generate summary using Gemini API specifically for selected text
        summary = await generate_gemini_text_summary(request.selected_text, request.context)
        print(f"✅ Text summary generated: {summary[:100]}...")
        
        return SummaryResponse(summary=summary)
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        print(f"❌ Unexpected error generating text summary: {str(e)}")
        print(f"❌ Error type: {type(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

def extract_pdf_text(pdf_path: str) -> str:
    """Extract text from PDF using PyPDF2"""
    try:
        text = ""
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            for page_num in range(len(pdf_reader.pages)):
                page = pdf_reader.pages[page_num]
                text += page.extract_text() + "\n"
        return text
    except Exception as e:
        print(f"Error extracting PDF text: {str(e)}")
        return ""

async def generate_gemini_summary(text: str, document_name: str) -> str:
    """Generate summary using Gemini API"""
    try:
        # You'll need to set your Gemini API key as an environment variable
        # Get your key from: https://makersuite.google.com/app/apikey
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            return "⚠️ Gemini API key not configured. Please set GOOGLE_API_KEY environment variable."
        
        # Use the correct Gemini API endpoint
        model_name = os.getenv("GEMINI_MODEL", "gemini-2.0-flash-exp")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        
        # Truncate text if too long (Gemini has token limits)
        max_chars = 20000  # Roughly 4000-5000 tokens
        if len(text) > max_chars:
            text = text[:max_chars] + "..."
        
        payload = {
            "contents": [{
                "parts": [{
                    "text": f"""Please provide a comprehensive summary of the following document titled "{document_name}":

{text}

Please structure your summary to include:
1. Main topic and purpose
2. Key points and findings
3. Important details and conclusions
4. Any recommendations or next steps mentioned

Keep the summary concise but informative, around 200-300 words."""
                }]
            }]
        }
        
        headers = {
            "Content-Type": "application/json"
        }
        
        print(f"🌐 Making request to: {url}")
        print(f"📝 Payload size: {len(str(payload))} characters")
        
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        
        print(f"📊 Response status: {response.status_code}")
        print(f"📄 Response headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Success response: {result}")
            if 'candidates' in result and len(result['candidates']) > 0:
                return result['candidates'][0]['content']['parts'][0]['text']
            else:
                return "❌ Failed to generate summary - no content returned"
        else:
            print(f"❌ Gemini API error: {response.status_code}")
            print(f"📄 Error response: {response.text}")
            return f"❌ Failed to generate summary - API error: {response.status_code} - {response.text}"
            
    except Exception as e:
        print(f"Error calling Gemini API: {str(e)}")
        return f"❌ Failed to generate summary: {str(e)}"

async def generate_gemini_text_summary(selected_text: str, context: Optional[str] = None) -> str:
    """Generate summary of selected text using Gemini API"""
    try:
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            return "⚠️ Gemini API key not configured. Please set GOOGLE_API_KEY environment variable."
        
        # Use the correct Gemini API endpoint
        model_name = os.getenv("GEMINI_MODEL", "gemini-2.0-flash-exp")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        
        # Truncate text if too long
        max_chars = 10000  # Smaller limit for selected text
        if len(selected_text) > max_chars:
            selected_text = selected_text[:max_chars] + "..."
        
        # Create context-aware prompt
        context_part = ""
        if context:
            context_part = f"\n\nDocument context: {context[:500]}..."
        
        payload = {
            "contents": [{
                "parts": [{
                    "text": f"""Please analyze and summarize the following selected text:{context_part}

Selected text:
"{selected_text}"

Please provide:
1. A concise summary of the main points
2. Key insights or important information
3. Any conclusions or implications
4. Context and relevance (if applicable)

Keep the summary focused and concise, around 100-150 words, highlighting the most important aspects of the selected content."""
                }]
            }]
        }
        
        headers = {
            "Content-Type": "application/json"
        }
        
        print(f"🌐 Making request for text summary to: {url}")
        print(f"📝 Selected text length: {len(selected_text)} characters")
        
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        
        print(f"📊 Text summary response status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Text summary success response received")
            if 'candidates' in result and len(result['candidates']) > 0:
                return result['candidates'][0]['content']['parts'][0]['text']
            else:
                return "❌ Failed to generate text summary - no content returned"
        else:
            print(f"❌ Gemini API error for text summary: {response.status_code}")
            print(f"📄 Error response: {response.text}")
            return f"❌ Failed to generate text summary - API error: {response.status_code}"
            
    except Exception as e:
        print(f"Error calling Gemini API for text summary: {str(e)}")
        return f"❌ Failed to generate text summary: {str(e)}"

async def generate_gemini_insights(selected_text: str, document_name: str, context: Optional[str] = None, related_context: str = "") -> Dict:
    """Generate comprehensive insights using Gemini API"""
    try:
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            return {
                "key_takeaways": ["⚠️ Gemini API key not configured"],
                "did_you_know": [],
                "contradictions": [],
                "examples": [],
                "cross_document_inspirations": []
            }
        
        model_name = os.getenv("GEMINI_MODEL", "gemini-2.0-flash-exp")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        
        # Truncate text if too long
        max_chars = 8000
        if len(selected_text) > max_chars:
            selected_text = selected_text[:max_chars] + "..."
        
        context_part = f"\n\nDocument context: {context[:500]}..." if context else ""
        
        payload = {
            "contents": [{
                "parts": [{
                    "text": f"""Analyze the following text from "{document_name}" and provide comprehensive insights:{context_part}{related_context}

Selected text:
"{selected_text}"

Please provide insights in the following categories. Return your response as valid JSON with these exact keys:

{{
    "key_takeaways": ["List 3-5 main takeaways from this text"],
    "did_you_know": ["List 2-3 interesting or surprising facts"],
    "contradictions": ["List any contradictions, counterpoints, or alternative viewpoints (if any)"],
    "examples": ["List 2-3 concrete examples or use cases mentioned"],
    "cross_document_inspirations": ["List connections or inspirations based on related documents (if any)"]
}}

Focus on actionable insights and interesting connections. If a category doesn't apply, return an empty array."""
                }]
            }]
        }
        
        headers = {"Content-Type": "application/json"}
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            if 'candidates' in result and len(result['candidates']) > 0:
                content = result['candidates'][0]['content']['parts'][0]['text']
                
                # Try to parse as JSON
                try:
                    # Clean the response (remove markdown formatting if present)
                    content = content.strip()
                    if content.startswith('```json'):
                        content = content[7:]
                    if content.endswith('```'):
                        content = content[:-3]
                    content = content.strip()
                    
                    insights = json.loads(content)
                    
                    # Validate structure
                    required_keys = ["key_takeaways", "did_you_know", "contradictions", "examples", "cross_document_inspirations"]
                    for key in required_keys:
                        if key not in insights:
                            insights[key] = []
                    
                    return insights
                    
                except json.JSONDecodeError:
                    print(f"⚠️ Failed to parse JSON response: {content[:200]}")
                    # Fallback: parse manually
                    return parse_insights_fallback(content)
            else:
                return {"key_takeaways": ["❌ No insights generated"], "did_you_know": [], "contradictions": [], "examples": [], "cross_document_inspirations": []}
        else:
            print(f"❌ Gemini API error for insights: {response.status_code}")
            return {"key_takeaways": [f"❌ API error: {response.status_code}"], "did_you_know": [], "contradictions": [], "examples": [], "cross_document_inspirations": []}
            
    except Exception as e:
        print(f"Error generating insights: {str(e)}")
        return {"key_takeaways": [f"❌ Error: {str(e)}"], "did_you_know": [], "contradictions": [], "examples": [], "cross_document_inspirations": []}

def parse_insights_fallback(content: str) -> Dict:
    """Fallback parser for insights when JSON parsing fails"""
    insights = {
        "key_takeaways": [],
        "did_you_know": [],
        "contradictions": [],
        "examples": [],
        "cross_document_inspirations": []
    }
    
    lines = content.split('\n')
    current_category = None
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        # Detect category headers
        if 'takeaway' in line.lower():
            current_category = 'key_takeaways'
        elif 'did you know' in line.lower():
            current_category = 'did_you_know'
        elif 'contradiction' in line.lower() or 'counterpoint' in line.lower():
            current_category = 'contradictions'
        elif 'example' in line.lower():
            current_category = 'examples'
        elif 'inspiration' in line.lower() or 'cross' in line.lower():
            current_category = 'cross_document_inspirations'
        elif line.startswith('-') or line.startswith('•') or line.startswith('*'):
            # This is a list item
            if current_category:
                insights[current_category].append(line[1:].strip())
    
    return insights

async def generate_azure_speech(text: str, voice: str = "alloy", speed: str = "medium") -> bytes:
    """Generate speech using Azure OpenAI TTS with local fallback"""
    try:
        # Check for Azure OpenAI TTS configuration
        azure_key = os.getenv("AZURE_TTS_KEY")
        azure_endpoint = os.getenv("AZURE_TTS_ENDPOINT")
        
        if azure_key and azure_endpoint:
            print("🔊 Using Azure OpenAI TTS")
            try:
                return await generate_azure_openai_speech(text, voice, speed)
            except Exception as e:
                print(f"⚠️ Azure OpenAI TTS failed, using local TTS: {e}")
                return await generate_local_speech(text, voice, speed)
        else:
            print("🔊 Using local TTS (Azure OpenAI credentials not configured)")
            return await generate_local_speech(text, voice, speed)
            
    except Exception as e:
        print(f"❌ Error with TTS, using local fallback: {str(e)}")
        return await generate_local_speech(text, voice, speed)

async def generate_azure_openai_speech(text: str, voice: str = "alloy", speed: str = "medium") -> bytes:
    """Generate speech using Azure OpenAI TTS API"""
    try:
        azure_key = os.getenv("AZURE_TTS_KEY")
        azure_endpoint = os.getenv("AZURE_TTS_ENDPOINT")
        deployment = os.getenv("AZURE_TTS_DEPLOYMENT", "tts")
        api_version = os.getenv("AZURE_TTS_API_VERSION", "2025-03-01-preview")
        
        # Map speed to Azure OpenAI TTS speed values
        speed_map = {
            "slow": "0.75",
            "medium": "1.0",
            "fast": "1.25"
        }
        tts_speed = speed_map.get(speed, "1.0")
        
        # Azure OpenAI TTS endpoint
        url = f"{azure_endpoint.rstrip('/')}/openai/deployments/{deployment}/audio/speech?api-version={api_version}"
        
        headers = {
            "api-key": azure_key,
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": "tts-1",
            "input": text,
            "voice": voice,
            "speed": float(tts_speed),
            "response_format": "wav"
        }
        
        print(f"🌐 Making Azure OpenAI TTS request to: {url}")
        print(f"🎙️ Voice: {voice}, Speed: {tts_speed}")
        
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        
        if response.status_code == 200:
            audio_data = response.content
            print(f"✅ Azure OpenAI TTS: Generated {len(audio_data)} bytes of audio")
            return audio_data
        else:
            print(f"❌ Azure OpenAI TTS error: {response.status_code}")
            print(f"📄 Error response: {response.text}")
            raise Exception(f"Azure OpenAI TTS API error: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error calling Azure OpenAI TTS API: {str(e)}")
        raise

async def generate_local_speech(text: str, voice: str = "alloy", speed: str = "medium") -> bytes:
    """Generate speech using local Windows TTS (no external dependencies)"""
    try:
        import subprocess
        import tempfile
        import wave
        import threading
        import time
        
        print(f"🎤 Generating local TTS for: {text[:50]}...")
        
        # Truncate text if too long to avoid timeout
        if len(text) > 1500:
            text = text[:1500] + "..."
        
        # Clean text for PowerShell - remove problematic characters
        clean_text = text.replace('"', "'").replace('`', "'").replace('\n', ' ').replace('\r', ' ')
        clean_text = ''.join(char for char in clean_text if ord(char) < 127)  # ASCII only
        
        # Map Azure voice names to Windows TTS voices for dual-voice support
        windows_voice_map = {
            # Azure OpenAI voices to Windows voices
            "alloy": "Microsoft David Desktop",      # Neutral male voice
            "echo": "Microsoft Zira Desktop",       # Female voice  
            "fable": "Microsoft Mark Desktop",      # British male voice
            "onyx": "Microsoft David Desktop",      # Deep male voice (EXPERT in dual-voice)
            "nova": "Microsoft Zira Desktop",       # Warm female voice (HOST in dual-voice)
            "shimmer": "Microsoft Hazel Desktop",   # Female voice (if available)
            # Direct voice selection
            "male": "Microsoft David Desktop",
            "female": "Microsoft Zira Desktop"
        }
        
        # Get Windows voice name, default to Zira (female)
        windows_voice = windows_voice_map.get(voice.lower(), "Microsoft Zira Desktop")
        print(f"🎭 Using Windows voice: {windows_voice} (mapped from: {voice})")
        
        # Map speed to rate (PowerShell TTS rates are -10 to 10)
        speed_map = {
            "slow": "-2",
            "medium": "0", 
            "fast": "3"
        }
        rate = speed_map.get(speed, "0")
        
        # Create temporary WAV file with a simple name
        import random
        temp_name = f"tts_{random.randint(1000, 9999)}.wav"
        temp_dir = tempfile.gettempdir()
        temp_path = os.path.join(temp_dir, temp_name)
        
        print(f"🗂️ Using temp file: {temp_path}")
        
        # Use Windows built-in PowerShell TTS with improved script
        escaped_path = temp_path.replace('\\', '\\\\')  # Escape backslashes for PowerShell
        powershell_script = f'''
        try {{
            Write-Host "Loading System.Speech assembly..."
            Add-Type -AssemblyName System.Speech -ErrorAction Stop
            
            Write-Host "Creating speech synthesizer..."
            $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
            
            # List available voices
            Write-Host "Available voices:"
            foreach ($voice in $synth.GetInstalledVoices()) {{
                Write-Host "  - $($voice.VoiceInfo.Name)"
            }}
            
            # Try to select the requested voice
            Write-Host "Attempting to select voice: {windows_voice}"
            try {{
                $synth.SelectVoice("{windows_voice}")
                Write-Host "Successfully selected voice: $($synth.Voice.Name)"
            }} catch {{
                Write-Host "Voice '{windows_voice}' not found, using default voice: $($synth.Voice.Name)"
            }}
            
            Write-Host "Setting speech rate to {rate}..."
            $synth.Rate = {rate}
            
            Write-Host "Setting output to file: {escaped_path}"
            $synth.SetOutputToWaveFile("{escaped_path}")
            
            Write-Host "Speaking text: {clean_text[:30]}..."
            $synth.Speak("{clean_text}")
            
            Write-Host "Disposing synthesizer..."
            $synth.Dispose()
            
            Write-Host "TTS completed successfully"
            
            # Verify file was created
            if (Test-Path "{escaped_path}") {{
                $fileSize = (Get-Item "{escaped_path}").Length
                Write-Host "Generated file size: $fileSize bytes"
            }} else {{
                Write-Error "Output file was not created"
            }}
        }} catch {{
            Write-Error "TTS failed: $($_.Exception.Message)"
            Write-Error "Error details: $($_.Exception)"
        }}
        '''
        
        print(f"🔧 Executing PowerShell TTS script...")
        
        # Run PowerShell script synchronously (Windows async subprocess has issues)
        def run_powershell():
            try:
                result = subprocess.run(
                    ['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', powershell_script],
                    capture_output=True,
                    text=True,
                    timeout=30,
                    cwd=temp_dir
                )
                return result
            except subprocess.TimeoutExpired:
                print("❌ PowerShell TTS timed out")
                return None
            except Exception as e:
                print(f"❌ PowerShell execution error: {e}")
                return None
        
        # Run in thread to avoid blocking the async event loop
        import concurrent.futures
        import asyncio
        
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, run_powershell)
        
        if result is None:
            print("❌ PowerShell script execution failed")
            return generate_simple_audio_fallback(text)
        
        # Decode output for debugging
        stdout_text = result.stdout if result.stdout else ""
        stderr_text = result.stderr if result.stderr else ""
        
        print(f"📊 PowerShell process completed:")
        print(f"   Return code: {result.returncode}")
        print(f"   Stdout: {stdout_text}")
        if stderr_text:
            print(f"   Stderr: {stderr_text}")
        
        if result.returncode == 0 and os.path.exists(temp_path):
            # Read the generated WAV file
            try:
                file_size = os.path.getsize(temp_path)
                print(f"📁 Generated audio file size: {file_size} bytes")
                
                if file_size < 1000:  # Too small to be valid audio
                    print(f"❌ Generated audio file is too small ({file_size} bytes)")
                    try:
                        os.unlink(temp_path)
                    except:
                        pass
                    return generate_simple_audio_fallback(text)
                
                with open(temp_path, 'rb') as f:
                    audio_data = f.read()
                
                # Clean up temp file
                try:
                    os.unlink(temp_path)
                except:
                    pass
                
                print(f"✅ Local TTS: Generated {len(audio_data)} bytes of real audio")
                return audio_data
            except Exception as file_error:
                print(f"❌ Error reading generated audio file: {file_error}")
                return generate_simple_audio_fallback(text)
        else:
            print(f"❌ PowerShell TTS failed:")
            print(f"   Return code: {result.returncode}")
            print(f"   File exists: {os.path.exists(temp_path) if 'temp_path' in locals() else 'temp_path not defined'}")
            print(f"   Stdout: {stdout_text}")
            print(f"   Stderr: {stderr_text}")
            return generate_simple_audio_fallback(text)
            
    except Exception as e:
        print(f"❌ Local TTS error: {e}")
        import traceback
        traceback.print_exc()
        return generate_simple_audio_fallback(text)

def generate_simple_audio_fallback(text: str) -> bytes:
    """Generate a simple audio file as fallback"""
    try:
        import wave
        import struct
        import math
        
        # Generate a simple tone sequence
        sample_rate = 44100
        duration = min(len(text) * 0.1, 5.0)  # Max 5 seconds
        
        # Create a simple sine wave
        frames = []
        for i in range(int(sample_rate * duration)):
            # Simple tone that varies with text length
            frequency = 440 + (len(text) % 200)
            value = int(32767 * math.sin(2 * math.pi * frequency * i / sample_rate) * 0.3)
            frames.append(struct.pack('<h', value))
        
        # Create WAV file in memory
        import io
        wav_buffer = io.BytesIO()
        with wave.open(wav_buffer, 'wb') as wav_file:
            wav_file.setnchannels(1)  # Mono
            wav_file.setsampwidth(2)  # 16-bit
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(b''.join(frames))
        
        wav_buffer.seek(0)
        audio_data = wav_buffer.read()
        
        print(f"📢 Fallback audio: Generated {len(audio_data)} bytes (tone for '{text[:20]}...')")
        return audio_data
        
    except Exception as e:
        print(f"❌ Fallback audio failed: {e}")
        # Return minimal WAV header as last resort
        return b'RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00D\xac\x00\x00\x88X\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00'


# ============================================================================
# ENHANCED PDF INTELLIGENCE FUNCTIONS
# ============================================================================

async def process_document_for_intelligence(document_id: int, pdf_path: str):
    """Extract sections and create embeddings for intelligent analysis"""
    if not ENHANCED_PDF_ANALYSIS:
        return
    
    try:
        print(f"🧠 Processing document {document_id} for intelligent analysis...")
        
        # Extract structured sections from PDF (Challenge 1A approach)
        sections = extract_pdf_sections(pdf_path)
        
        # Create embeddings for each section
        embeddings = {}
        for section in sections:
            try:
                # Create embedding for section content
                embedding = semantic_model.encode([section.content])
                embeddings[section.id] = embedding[0]  # Store as 1D array
            except Exception as e:
                print(f"⚠️ Failed to create embedding for section {section.id}: {e}")
        
        # Store in memory
        document_sections[document_id] = sections
        section_embeddings.update(embeddings)
        
        print(f"✅ Processed {len(sections)} sections with {len(embeddings)} embeddings for document {document_id}")
        
    except Exception as e:
        print(f"❌ Error processing document {document_id} for intelligence: {e}")
        raise

def extract_pdf_sections(pdf_path: str) -> List[DocumentSection]:
    """Extract structured sections from PDF using Challenge 1A methodology"""
    try:
        doc = fitz.open(pdf_path)
        sections = []
        
        # Extract text blocks with formatting information
        all_blocks = []
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            blocks = page.get_text("dict")
            
            for block in blocks.get("blocks", []):
                if "lines" in block:
                    for line in block["lines"]:
                        for span in line["spans"]:
                            text = span["text"].strip()
                            if text:
                                all_blocks.append({
                                    "text": text,
                                    "page": page_num + 1,
                                    "font_size": span["size"],
                                    "bbox": span["bbox"],
                                    "flags": span["flags"]
                                })
        
        # Determine body font size (most common)
        font_sizes = [block["font_size"] for block in all_blocks]
        if not font_sizes:
            return sections
        
        body_size = Counter(font_sizes).most_common(1)[0][0]
        
        # Extract headings and content
        current_section = None
        section_content = []
        section_id_counter = 0
        
        for block in all_blocks:
            font_size = block["font_size"]
            text = block["text"]
            page = block["page"]
            
            # Determine if this is a heading (significantly larger than body text)
            is_heading = font_size > body_size * 1.1 and len(text.split()) >= 2
            
            if is_heading and not is_generic_text(text):
                # Save previous section if exists
                if current_section and section_content:
                    current_section.content = " ".join(section_content).strip()
                    if current_section.content:
                        sections.append(current_section)
                
                # Start new section
                section_id_counter += 1
                heading_level = determine_heading_level(font_size, body_size)
                
                current_section = DocumentSection(
                    id=f"section_{section_id_counter}_{page}",
                    title=clean_text(text),
                    content="",
                    page=page,
                    level=heading_level,
                    font_size=font_size,
                    position={
                        "x": block["bbox"][0],
                        "y": block["bbox"][1],
                        "width": block["bbox"][2] - block["bbox"][0],
                        "height": block["bbox"][3] - block["bbox"][1]
                    }
                )
                section_content = []
            else:
                # Add to current section content
                if not is_generic_text(text):
                    section_content.append(clean_text(text))
        
        # Don't forget the last section
        if current_section and section_content:
            current_section.content = " ".join(section_content).strip()
            if current_section.content:
                sections.append(current_section)
        
        doc.close()
        print(f"📄 Extracted {len(sections)} sections from PDF")
        return sections
        
    except Exception as e:
        print(f"❌ Error extracting PDF sections: {e}")
        return []

def determine_heading_level(font_size: float, body_size: float) -> str:
    """Determine heading level based on font size relative to body text"""
    ratio = font_size / body_size
    
    if ratio >= 2.0:
        return "H1"
    elif ratio >= 1.5:
        return "H2"
    elif ratio >= 1.3:
        return "H3"
    else:
        return "H4"

def is_generic_text(text: str) -> bool:
    """Filter out generic metadata and noise"""
    text_lower = text.lower().strip()
    
    # Skip very short text
    if len(text_lower) < 3:
        return True
    
    # Generic patterns to ignore
    generic_patterns = [
        r'^(page|p\.?)\s*\d+',
        r'^(version|ver|v\.?)\s*[\d.]+',
        r'^(date|created|modified):\s*',
        r'^(contact|email|phone|address|website|url):\s*',
        r'^\d+$',  # Just numbers
        r'^[a-z]$',  # Single letters
        r'^\W+$',  # Just symbols
    ]
    
    for pattern in generic_patterns:
        if re.match(pattern, text_lower):
            return True
    
    return False

def clean_text(text: str) -> str:
    """Clean and normalize text"""
    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text.strip())
    # Remove special characters that might interfere
    text = re.sub(r'[^\w\s\-.,;:!?()]', ' ', text)
    return text

def generate_snippet(content: str) -> str:
    """Generate a 2-4 sentence snippet from section content"""
    if not content:
        return ""
    
    # Split into sentences
    sentences = re.split(r'[.!?]+', content)
    sentences = [s.strip() for s in sentences if s.strip() and len(s.strip()) > 10]
    
    if not sentences:
        # If no proper sentences, return first ~150 characters
        return content[:150] + "..." if len(content) > 150 else content
    
    # Return 2-4 sentences
    snippet_sentences = sentences[:min(4, len(sentences))]
    snippet = ". ".join(snippet_sentences)
    
    # Ensure snippet ends properly
    if not snippet.endswith(('.', '!', '?')):
        snippet += "."
    
    return snippet

def determine_snippet_type(query_text: str, section_content: str, similarity: float) -> str:
    """Determine if snippet is related, contradictory, or supporting"""
    query_lower = query_text.lower()
    content_lower = section_content.lower()
    
    # High similarity usually means related/supporting
    if similarity > 0.7:
        return "supporting"
    
    # Look for contradictory indicators
    contradiction_patterns = [
        (r'\bhowever\b', r'\bbut\b', r'\balthough\b', r'\bcontrary\b'),
        (r'\bnot\b', r'\bno\b', r'\bnever\b', r'\bdisagree\b'),
        (r'\bwrong\b', r'\bincorrect\b', r'\bmistaken\b', r'\bfalse\b')
    ]
    
    contradiction_score = 0
    for patterns in contradiction_patterns:
        for pattern in patterns:
            if re.search(pattern, content_lower) and re.search(r'\b\w+\b', query_lower):
                contradiction_score += 1
    
    if contradiction_score > 0 and similarity > 0.4:
        return "contradictory"
    
    return "related"

async def generate_analysis_summary(query_text: str, related_snippets: List[RelatedSnippet]) -> str:
    """Generate an AI summary of the intelligent analysis results"""
    if not related_snippets:
        return "No related content found in your document library."
    
    try:
        # Prepare summary of findings
        supporting_count = len([s for s in related_snippets if s.snippet_type == "supporting"])
        contradictory_count = len([s for s in related_snippets if s.snippet_type == "contradictory"]) 
        related_count = len([s for s in related_snippets if s.snippet_type == "related"])
        
        # Get top snippets for summary
        top_snippets = related_snippets[:3]
        snippets_text = "\n".join([f"- From '{s.document_name}': {s.content}" for s in top_snippets])
        
        # Use Gemini to generate intelligent summary
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            # Fallback summary without AI
            return f"""📊 Analysis Results:
Found {len(related_snippets)} related sections across your documents.
• {supporting_count} supporting content
• {related_count} related content  
• {contradictory_count} contradictory content

Top matches from: {', '.join([s.document_name for s in top_snippets])}"""
        
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
        
        payload = {
            "contents": [{
                "parts": [{
                    "text": f"""Analyze the following intelligent document search results:

Selected Text: "{query_text}"

Related Content Found:
{snippets_text}

Statistics:
- Supporting content: {supporting_count} sections
- Related content: {related_count} sections  
- Contradictory content: {contradictory_count} sections
- Total: {len(related_snippets)} sections

Provide a concise analysis summary highlighting:
1. Key themes and connections found
2. Any contradictions or differing viewpoints
3. Most relevant insights from the related content
4. Recommendations based on the findings

Keep it under 150 words and focus on actionable insights."""
                }]
            }]
        }
        
        response = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=15)
        
        if response.status_code == 200:
            result = response.json()
            if 'candidates' in result and len(result['candidates']) > 0:
                return result['candidates'][0]['content']['parts'][0]['text']
        
        # Fallback if API fails
        return f"""📊 Analysis Results:
Found {len(related_snippets)} related sections across your documents.
• {supporting_count} supporting • {related_count} related • {contradictory_count} contradictory

Key documents: {', '.join(set([s.document_name for s in top_snippets]))}
Average relevance: {sum([s.similarity_score for s in related_snippets])/len(related_snippets):.1%}"""
        
    except Exception as e:
        print(f"❌ Error generating analysis summary: {e}")
        return f"Analysis complete: Found {len(related_snippets)} related sections across your document library."

async def generate_podcast_script(selected_text: str, document_name: str, context: Optional[str], duration: str, style: str) -> str:
    """Generate podcast script using Gemini API"""
    try:
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            return "⚠️ Gemini API key not configured for podcast generation."
        
        model_name = os.getenv("GEMINI_MODEL", "gemini-2.0-flash-exp")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        
        # Determine word count based on duration (150 words per minute for natural speech)
        duration_map = {
            "2-min": 300,
            "3-min": 450,
            "5-min": 750
        }
        target_words = duration_map.get(duration, 450)
        
        if style == "podcast":
            prompt = f"""Create an engaging {duration} interactive podcast script (approximately {target_words} words) with 2 dynamic speakers discussing the following content from "{document_name}":

"{selected_text}"

Create a lively conversation between:
- HOST: A female podcast host who is enthusiastic, curious, and asks great questions (will be voiced by female TTS)
- EXPERT: A male expert who explains concepts clearly and shares insights (will be voiced by male TTS)

IMPORTANT FORMATTING REQUIREMENTS:
- Each line must start with exactly "HOST:" or "EXPERT:" 
- No other speaker labels or formats
- Each speaker line should be complete thoughts or sentences
- Separate each speaker's dialogue on its own line

Essential Elements for Interactive Dialogue:
- Natural conversation flow with interruptions, agreements, and follow-up questions
- Host asks "Wait, what does that mean exactly?" or "That's fascinating, tell me more about..."
- Expert builds on host's reactions: "Exactly! And here's what's really interesting..."
- Include spontaneous reactions: "Wow!", "Really?", "That makes sense!", "Hold on..."
- Back-and-forth discussion with multiple exchanges per topic
- Host summarizes key points: "So what you're saying is..."
- Expert clarifies and expands: "Right, but let me add this important detail..."

Content Structure:
- Engaging opening with HOST introducing the topic enthusiastically
- 3-4 main discussion points with interactive exchanges
- "Did you know" moments with HOST's surprised reactions
- Practical examples with HOST asking for clarification
- Wrap-up with HOST summarizing key takeaways

EXAMPLE FORMAT:
HOST: Welcome to our show! Today we're diving into something fascinating...
EXPERT: Thanks for having me! This topic is particularly interesting because...
HOST: Wait, that's amazing! Can you explain what you mean by...
EXPERT: Absolutely! Let me break that down for you...

Target {target_words} words with dynamic back-and-forth exchanges. Remember: female HOST voice, male EXPERT voice."""

        else:  # overview style
            prompt = f"""Create a {duration} audio overview script (approximately {target_words} words) for the following content from "{document_name}":

"{selected_text}"

Create a single-speaker narrative that includes:
- Clear introduction to the topic
- Main points and key takeaways
- Interesting facts and insights
- Practical implications
- Concise conclusion

Write in a professional but engaging tone, as if presenting to an interested audience. Target {target_words} words."""

        payload = {
            "contents": [{
                "parts": [{"text": prompt}]
            }]
        }
        
        response = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            if 'candidates' in result and len(result['candidates']) > 0:
                return result['candidates'][0]['content']['parts'][0]['text']
        
        return f"Unable to generate {style} script for the selected content."
        
    except Exception as e:
        print(f"Error generating podcast script: {str(e)}")
        return f"Error generating {style} script: {str(e)}"

async def generate_podcast_audio(script: str, style: str) -> bytes:
    """Generate audio from podcast script using dual voices (female host, male expert)"""
    try:
        print(f"🎙️ Generating podcast audio with dual voices...")
        
        if style == "podcast" and ("HOST:" in script and "EXPERT:" in script):
            # Parse script to separate HOST and EXPERT lines
            return await generate_dual_voice_audio(script)
        else:
            # For single voice content, use appropriate voice
            if style == "podcast":
                return await generate_azure_speech(script, "nova", "medium")  # Female voice
            else:
                return await generate_azure_speech(script, "alloy", "medium")  # Neutral voice
            
    except Exception as e:
        print(f"❌ Error generating podcast audio: {e}")
        return generate_simple_audio_fallback(script)

async def generate_dual_voice_audio(script: str) -> bytes:
    """Generate audio with different voices for HOST (female) and EXPERT (male)"""
    try:
        import io
        import wave
        
        print("🎭 Generating dual-voice podcast audio...")
        
        # Parse script lines
        lines = script.strip().split('\n')
        audio_segments = []
        
        # Voice mapping: HOST = female, EXPERT = male
        voice_map = {
            "HOST": "nova",      # Female voice - warm and engaging
            "EXPERT": "onyx"     # Male voice - deep and authoritative
        }
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            # Identify speaker and extract text
            speaker = None
            text = line
            
            if line.startswith("HOST:"):
                speaker = "HOST"
                text = line[5:].strip()
            elif line.startswith("EXPERT:"):
                speaker = "EXPERT"
                text = line[7:].strip()
            
            if not text:
                continue
            
            # Generate audio for this line
            voice = voice_map.get(speaker, "alloy")  # Default to alloy if speaker not identified
            
            print(f"🎙️ {speaker or 'NARRATOR'}: {text[:50]}... (voice: {voice})")
            
            try:
                line_audio = await generate_azure_speech(text, voice, "medium")
                if line_audio:
                    audio_segments.append(line_audio)
                    
                    # Add a small pause between speakers
                    if len(audio_segments) > 1:
                        pause_audio = generate_pause_audio(0.5)  # 0.5 second pause
                        audio_segments.append(pause_audio)
                        
            except Exception as line_error:
                print(f"⚠️ Error generating audio for line: {line_error}")
                continue
        
        if not audio_segments:
            print("❌ No audio segments generated")
            return generate_simple_audio_fallback(script)
        
        # Combine all audio segments
        combined_audio = combine_audio_segments(audio_segments)
        
        print(f"✅ Dual-voice podcast generated: {len(combined_audio)} bytes from {len(audio_segments)} segments")
        return combined_audio
        
    except Exception as e:
        print(f"❌ Error in dual-voice generation: {e}")
        return await generate_azure_speech(script, "nova", "medium")  # Fallback to single voice

def generate_pause_audio(duration_seconds: float) -> bytes:
    """Generate a silent pause of specified duration"""
    try:
        import wave
        import struct
        
        sample_rate = 44100  # 44.1 kHz
        frames = int(sample_rate * duration_seconds)
        
        # Generate silence (zeros)
        silent_frames = []
        for i in range(frames):
            silent_frames.append(struct.pack('<h', 0))  # 16-bit silence
        
        # Create WAV file in memory
        import io
        wav_buffer = io.BytesIO()
        with wave.open(wav_buffer, 'wb') as wav_file:
            wav_file.setnchannels(1)  # Mono
            wav_file.setsampwidth(2)  # 16-bit
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(b''.join(silent_frames))
        
        wav_buffer.seek(0)
        return wav_buffer.read()
        
    except Exception as e:
        print(f"❌ Error generating pause: {e}")
        return b''  # Return empty bytes if failed

def combine_audio_segments(audio_segments: list) -> bytes:
    """Combine multiple WAV audio segments into one"""
    try:
        import wave
        import io
        
        if not audio_segments:
            return b''
        
        if len(audio_segments) == 1:
            return audio_segments[0]
        
        # Create output buffer
        output_buffer = io.BytesIO()
        
        # Get parameters from first audio segment
        first_segment = io.BytesIO(audio_segments[0])
        with wave.open(first_segment, 'rb') as first_wav:
            params = first_wav.getparams()
        
        # Create output WAV file
        with wave.open(output_buffer, 'wb') as output_wav:
            output_wav.setparams(params)
            
            # Append all segments
            for segment_data in audio_segments:
                if not segment_data:
                    continue
                    
                try:
                    segment_buffer = io.BytesIO(segment_data)
                    with wave.open(segment_buffer, 'rb') as segment_wav:
                        # Read and write audio data
                        frames = segment_wav.readframes(segment_wav.getnframes())
                        output_wav.writeframes(frames)
                except Exception as segment_error:
                    print(f"⚠️ Error combining segment: {segment_error}")
                    continue
        
        output_buffer.seek(0)
        combined_data = output_buffer.read()
        
        print(f"🔗 Combined {len(audio_segments)} audio segments into {len(combined_data)} bytes")
        return combined_data
        
    except Exception as e:
        print(f"❌ Error combining audio segments: {e}")
        # Return the first segment as fallback
        return audio_segments[0] if audio_segments else b''

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)
