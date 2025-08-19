import React, { useState, useEffect } from 'react';
import axios from 'axios';
import PDFViewer from './PDFViewer';
import IntelligentAnalysis from './IntelligentAnalysis';
import './App.css';

const API_BASE_URL = 'http://localhost:8000/api';

function App() {
  const [documents, setDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [loading, setLoading] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [isPanelMinimized, setIsPanelMinimized] = useState(false);

  // Fetch documents from backend
  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/documents`);
      setDocuments(response.data);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  // Upload single PDF file
  const uploadPDF = async (file) => {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploading(true);
      const response = await axios.post(`${API_BASE_URL}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      setDocuments([...documents, response.data]);
      alert('PDF uploaded successfully!');
    } catch (error) {
      console.error('Error uploading PDF:', error);
      alert('Error uploading PDF. Please make sure it\'s a valid PDF file.');
    } finally {
      setUploading(false);
    }
  };

  // Delete document
  const deleteDocument = async (id) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;

    try {
      await axios.delete(`${API_BASE_URL}/documents/${id}`);
      setDocuments(documents.filter(doc => doc.id !== id));
      if (selectedDocument && selectedDocument.id === id) {
        setSelectedDocument(null);
      }
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  // Handle text selection from PDFViewer
  const handleTextSelection = (text) => {
    setSelectedText(text);
  };

  // Handle single file selection
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      uploadPDF(file);
    } else {
      alert('Please select a PDF file');
    }
    event.target.value = '';
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>📄 PDF Viewer with Adobe Embed API</h1>
        
        <div className="main-content">
          {/* Sidebar - Hide when PDF is selected */}
          <div className={`sidebar ${selectedDocument ? 'hidden' : ''}`}>
            {/* Upload Section */}
            <div className="upload-section">
              <h2>Upload PDF(s)</h2>
              
              {/* Single Upload */}
              <div className="upload-area">
                <h3>📄 Single Upload</h3>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  disabled={uploading || bulkUploading}
                  id="single-file-input"
                  style={{ display: 'none' }}
                />
                <label htmlFor="single-file-input" className={`upload-btn ${uploading || bulkUploading ? 'disabled' : ''}`}>
                  {uploading ? '⏳ Uploading...' : '📁 Choose PDF File'}
                </label>
              </div>
            </div>

            {/* Documents List */}
            <div className="documents-section">
              <h2>Documents ({documents.length})</h2>
              {loading ? (
                <p>Loading...</p>
              ) : (
                <div className="documents-list">
                  {documents.map(doc => (
                    <div 
                      key={doc.id} 
                      className={`document-item ${selectedDocument?.id === doc.id ? 'selected' : ''}`}
                    >
                      <div className="document-info" onClick={() => setSelectedDocument(doc)}>
                        <h4>{doc.original_name}</h4>
                        <p className="document-meta">
                          Size: {(doc.file_size / 1024 / 1024).toFixed(2)} MB<br/>
                          Uploaded: {new Date(doc.upload_date).toLocaleDateString()}
                        </p>
                      </div>
                      <button 
                        onClick={() => deleteDocument(doc.id)}
                        className="delete-btn"
                        title="Delete document"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                  {documents.length === 0 && !loading && (
                    <p className="no-documents">No documents uploaded yet</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* PDF Viewer Section */}
          <div className={`pdf-viewer-section ${selectedDocument ? 'with-text-panel' : ''}`}>
            {selectedDocument ? (
              <div className="pdf-layout">
                {/* PDF Viewer */}
                <div className="pdf-viewer-container">
                  <PDFViewer 
                    document={selectedDocument} 
                    onTextSelection={handleTextSelection}
                  />
                </div>
                
                {/* Selected Text Panel */}
                <div className={`selected-text-panel ${isPanelMinimized ? 'minimized' : ''}`}>
                  <div className="panel-header">
                    <div className="panel-header-content">
                      <h3>📄 Content Panel</h3>
                      <button 
                        className="panel-minimize-btn"
                        onClick={() => setIsPanelMinimized(!isPanelMinimized)}
                        title={isPanelMinimized ? "Expand panel" : "Minimize panel"}
                      >
                        {isPanelMinimized ? '📂' : '📁'}
                      </button>
                    </div>
                  </div>
                  
                  {!isPanelMinimized && (
                    <div className="panel-content">
                      {selectedText ? (
                        <div className="text-content">
                          <h4>Selected Text:</h4>
                          <p>{selectedText}</p>
                        </div>
                      ) : (
                        <p>Select text in the PDF to see it here</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="no-pdf-selected">
                <h2>📖 Select a PDF to view</h2>
                <p>Choose a document from the sidebar to start viewing</p>
              </div>
            )}
          </div>
        </div>
      </header>
    </div>
  );
}

export default App;
