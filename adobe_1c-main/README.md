
# Demo Video
### here is the demo video of the project

https://youtu.be/XEmU8Nl5gr8?si=36tS8E_er9kRkeTn



# PDF Viewer Application with Adobe Embed API + Intelligent Document Analysis

A full stack PDF viewer application with React frontend and FastAPI backend, featuring Adobe's PDF Embed API for professional PDF viewing and **advanced intelligent document analysis** that finds related, contradictory, and supporting content across your entire document library.

## 🌟 Features

### Core PDF Features
- **📁 PDF Upload**: Drag and drop or select PDF files to upload
- **📄 Professional PDF Viewer**: Powered by Adobe PDF Embed API
- **🔍 Advanced Features**: Zoom, search, annotations, and navigation
- **📱 Responsive Design**: Works on desktop and mobile devices
- **💾 File Management**: Upload, view, and delete PDF documents
- **🔒 Secure**: Files stored securely on the server
- **⚡ Fast**: Real-time file uploads and instant viewing

### 🧠 NEW: Intelligent Document Analysis
- **🔍 Semantic Content Discovery**: Find related content across your entire document library
- **⚠️ Contradictory Content Detection**: Identify conflicting information and different viewpoints
- **✅ Supporting Evidence**: Discover content that supports your selected text
- **📊 Smart Snippets**: 2-4 sentence extracts with relevance scoring
- **⚡ Fast Navigation**: Click snippets to jump to relevant sections in other documents
- **🧠 AI-Powered Analysis**: Comprehensive summaries of findings with actionable insights
- **📈 Real-time Processing**: Results appear within seconds of text selection

## Project Structure

```
challenge-1c/
├── frontend/              # React frontend application
│   ├── src/
│   │   ├── App.js        # Main React component
│   │   ├── PDFViewer.js  # Adobe PDF Embed API component
│   │   ├── App.css       # Styling
│   │   ├── index.js      # React entry point
│   │   └── index.css     # Global styles
│   ├── public/
│   │   └── index.html    # HTML template
│   └── package.json      # Frontend dependencies
├── backend/              # FastAPI backend
│   ├── main.py          # FastAPI application with PDF upload
│   ├── requirements.txt # Python dependencies
│   └── uploads/         # PDF storage directory (created automatically)
├── start-app.ps1        # PowerShell startup script
├── start-app.bat        # Batch startup script
├── dev-start.ps1        # Development mode script
├── stop-app.ps1         # Stop all services script
├── ADOBE_SETUP.md       # Adobe PDF Embed API setup guide
└── README.md            # This file
```

## 🎯 Features

- **Frontend (React)**:
  - PDF file upload with drag & drop
  - Document management interface
  - Adobe PDF Embed API integration
  - Responsive sidebar with document list
  - Real-time file uploads

- **Backend (FastAPI)**:
  - RESTful API for PDF management
  - File upload handling with validation
  - Static file serving for PDFs
  - CORS enabled for frontend communication
  - Automatic API documentation

## Getting Started

### Prerequisites

- Python 3.8+ installed
- Node.js 16+ installed
- npm or yarn package manager

### Enhanced Setup (Recommended for Full Features)

To enable the intelligent document analysis features, run the enhanced setup:

```powershell
.\setup-enhanced-intelligence.ps1
```

This will install additional ML dependencies including:
- `sentence-transformers` - For semantic content analysis
- `PyMuPDF` - For advanced PDF structure extraction  
- `scikit-learn` - For similarity calculations
- Pre-trained semantic model (~90MB download)

### Quick Start

Use the provided scripts to start both frontend and backend with one command:

#### Option 1: PowerShell Script (Recommended)
```powershell
.\start-app.ps1
```

#### Option 2: Batch File
```cmd
start-app.bat
```

#### Option 3: Development Mode (Separate Windows)
```powershell
.\dev-start.ps1
```

#### Stop All Services
```powershell
.\stop-app.ps1
```

### Manual Setup

If you prefer to start services manually:

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Start the FastAPI server:
   ```bash
   python main.py
   ```

   The API will be available at `http://localhost:8000`
   - API Documentation: `http://localhost:8000/docs`
   - Alternative docs: `http://localhost:8000/redoc`

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the React development server:
   ```bash
   npm start
   ```

   The application will open at `http://localhost:3000`

## 🔧 Enhanced Intelligence Features

### How It Works

1. **Upload Multiple PDFs**: Build your document library by uploading various PDF documents
2. **Select Any Text**: While reading a PDF, select any text passage that interests you
3. **Instant Analysis**: The system automatically:
   - Extracts semantic meaning from your selected text
   - Searches through all other documents in your library
   - Identifies related, supporting, and contradictory content
   - Generates intelligent snippets and insights
4. **Navigate Instantly**: Click on any found snippet to jump directly to that section in the source document
5. **Generate Podcast**: Click on the generate podcast option it generate the podcast.

### Intelligence Types

- **🔗 Related Content**: Semantically similar content from other documents
- **✅ Supporting Content**: Information that supports or reinforces your selected text
- **⚠️ Contradictory Content**: Conflicting viewpoints or opposing information
- **📊 Smart Analysis**: AI-generated summary of all findings with actionable insights

### Technical Implementation

The intelligent analysis combines:
- **Challenge 1A Methodology**: PDF structure extraction and section identification
- **Challenge 1B Technology**: Semantic embeddings using `sentence-transformers`
- **Advanced Similarity**: Cosine similarity scoring for relevance ranking
- **Real-time Processing**: Sub-second response times for document libraries

## API Endpoints

### Core Endpoints
- `GET /api/documents` - Get all uploaded PDF documents
- `GET /api/documents/{document_id}` - Get specific document info
- `POST /api/upload` - Upload a new PDF file (with automatic intelligence processing)
- `DELETE /api/documents/{document_id}` - Delete a document
- `GET /uploads/{filename}` - Serve static PDF files

### 🧠 Intelligence Endpoints (New)
- `POST /api/intelligent-analysis` - Perform semantic analysis on selected text
- `GET /api/document-sections/{document_id}` - Get extracted sections for a document
- `GET /api/navigate-to-section/{document_id}/{section_id}` - Get navigation info for specific section

## Usage

1. **Setup Enhanced Intelligence** (one-time): Run `.\setup-enhanced-intelligence.ps1`
2. **Start Application**: Use `.\start-app.ps1` to launch both frontend and backend
3. **Upload Documents**: Add multiple PDF files to build your intelligent library
4. **Explore Intelligence**: 
   - Select any text while reading a PDF
   - Watch as the system finds related content from other documents
   - Review the AI analysis summary for insights
   - Click on snippets to navigate to relevant sections
   - Discover contradictory viewpoints and supporting evidence

### 🎯 Example Use Cases

- **Research**: Upload multiple research papers, select key findings, discover related studies and conflicting results
- **Legal**: Upload contracts and legal documents, find related clauses and contradictory terms
- **Technical Documentation**: Upload manuals and guides, find related procedures and conflicting instructions  
- **Academic**: Upload textbooks and papers, discover supporting evidence and alternative viewpoints
- **Business**: Upload reports and analyses, identify related insights and conflicting data

## 🔧 Adobe PDF Embed API Setup

To enable the full Adobe PDF viewer experience:

1. **Get Adobe Credentials**: Follow the guide in `ADOBE_SETUP.md`
2. **Update Client ID**: Replace `YOUR_ADOBE_CLIENT_ID` in `frontend/src/PDFViewer.js`
3. **Restart the application**

**Note**: The application works without Adobe credentials using a fallback iframe viewer, but you'll get enhanced features with the Adobe API.

## Development

### Backend Development

- The FastAPI server includes automatic reload during development
- API documentation is automatically generated and available at `/docs`
- CORS is configured to allow requests from the React frontend

### Frontend Development

- The React app includes hot reload for development
- Axios is used for API communication
- Component-based architecture for maintainability

## Next Steps

To extend this PDF viewer application, consider:

1. **Adobe PDF Services Integration**: Add PDF manipulation features (merge, split, convert)
2. **User Authentication**: Add user registration and private document storage
3. **Cloud Storage**: Integrate with AWS S3, Google Cloud, or Azure for file storage
4. **Advanced Search**: Full-text search within PDF documents
5. **Collaboration**: Real-time commenting and annotation sharing
6. **Mobile App**: React Native or Flutter mobile application
7. **OCR Integration**: Extract text from scanned PDFs
8. **Thumbnails**: Generate and display PDF thumbnails
9. **Version Control**: Track document versions and changes
10. **Analytics**: Track document views and user interactions


## Build and Run the Application by Docker
From the project's root directory (the one containing frontend and backend), run the following command:

 docker build -t adobe-round3 . 
 docker run -p 8080:8080 --env-file backend/.env adobe-round3 
These commands will:

Build the Docker image for your backend server.
Start the backend container, making it available at http://localhost:8080


## Troubleshooting

- **CORS Issues**: Ensure the backend is running on port 8000 and frontend on port 3000
- **API Connection**: Check that both servers are running and the API base URL is correct
- **Dependencies**: Make sure all packages are installed correctly

## Demo Video
here is the demo video of the project

https://youtu.be/XEmU8Nl5gr8?si=36tS8E_er9kRkeTn


## License

This project is open source and available under the [MIT License](LICENSE).
