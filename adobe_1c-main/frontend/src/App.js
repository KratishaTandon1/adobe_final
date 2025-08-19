import React, { useState, useEffect } from 'react';
import axios from 'axios';
import PDFViewer from './PDFViewer';
import IntelligentAnalysis from './IntelligentAnalysis';
import './App.css';

const API_BASE_URL = 'http://localhost:8080/api';

function App() {
  const [documents, setDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  // Bulk upload processed count
  const [bulkProcessedCount, setBulkProcessedCount] = useState(0);
  const [loading, setLoading] = useState(false);
  // Per-document progress: { [docId]: { status: 'uploading'|'processing'|'complete', percent: number } }
  const [documentProgress, setDocumentProgress] = useState({});
  const [selectedText, setSelectedText] = useState('');
  const [documentSummary, setDocumentSummary] = useState('');
  const [selectedTextSummary, setSelectedTextSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [textSummaryLoading, setTextSummaryLoading] = useState(false);
  const [isSelectedTextExpanded, setIsSelectedTextExpanded] = useState(true);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(true);
  const [isTextSummaryExpanded, setIsTextSummaryExpanded] = useState(true);
  const [isIntelligentAnalysisExpanded, setIsIntelligentAnalysisExpanded] = useState(true);
  const [isPanelMinimized, setIsPanelMinimized] = useState(false);
  
  // Navigation history for intelligent analysis
  const [navigationHistory, setNavigationHistory] = useState([]);
  const [showBackButton, setShowBackButton] = useState(false);
  const [isFocusedView, setIsFocusedView] = useState(false);
  const [targetPage, setTargetPage] = useState(null); // Add state for target page
  const [currentPage, setCurrentPage] = useState(1); // Track current page
  
  // Auto-summary functionality
  const [textSelectionTimer, setTextSelectionTimer] = useState(null);
  const AUTO_SUMMARY_DELAY = 500; // 0.5 seconds after user stops selecting text - faster response
  
  // Speech-related state
  const [speechLoading, setSpeechLoading] = useState(false);
  const [currentAudio, setCurrentAudio] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speechText, setSpeechText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('alloy');
  const [speechSpeed, setSpeechSpeed] = useState('medium');
  const [showSpeechSettings, setShowSpeechSettings] = useState(false);
  const [pendingSpeechText, setPendingSpeechText] = useState('');
  const [availableVoices, setAvailableVoices] = useState([]);
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  
  // Insights Bulb state
  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  
  // Podcast Mode state
  const [podcastLoading, setPodcastLoading] = useState(false);
  const [podcastAudio, setPodcastAudio] = useState(null);
  const [podcastScript, setPodcastScript] = useState('');
  const [showPodcastModal, setShowPodcastModal] = useState(false);
  const [podcastSettings, setPodcastSettings] = useState({
    duration: '3-min',
    style: 'podcast'
  });
  const [isPodcastPlaying, setIsPodcastPlaying] = useState(false);

  // Fetch documents from backend
  const fetchDocuments = async () => {
    try {
      setLoading(true);
      // Add cache busting parameter to ensure fresh data
      const response = await axios.get(`${API_BASE_URL}/documents?t=${Date.now()}`);
      console.log('Fetched documents:', response.data.slice(0, 2)); // Log first 2 documents for debugging
      setDocuments(response.data);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  // Upload single PDF file
  // Upload single PDF file with progress
  const uploadPDF = async (file) => {
    if (!file) return null;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_type', 'fresh');

    let tempDocId = `temp-${Date.now()}-${Math.random()}`;
    setDocumentProgress(prev => ({ ...prev, [tempDocId]: { status: 'uploading', percent: 20, name: file.name } }));

    try {
      setUploading(true);
      const response = await axios.post(`${API_BASE_URL}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 50) / progressEvent.total); // 0-50%
          setDocumentProgress(prev => ({ ...prev, [tempDocId]: { ...prev[tempDocId], percent, status: 'uploading' } }));
        }
      });
      const uploadedDocument = response.data.document;
      // Mark as processing for analysis
      setDocumentProgress(prev => ({ ...prev, [uploadedDocument.id]: { status: 'processing', percent: 75, name: uploadedDocument.original_name } }));
      // Wait for intelligent analysis (simulate with timeout or poll if needed)
      // For demo, set to complete after 2s
      setTimeout(() => {
        setDocumentProgress(prev => ({ ...prev, [uploadedDocument.id]: { status: 'complete', percent: 100, name: uploadedDocument.original_name } }));
      }, 2000);
      // Remove temp progress
      setTimeout(() => {
        setDocumentProgress(prev => {
          const copy = { ...prev };
          delete copy[tempDocId];
          return copy;
        });
      }, 2500);
      // Refresh the entire document list to ensure consistency
      await fetchDocuments();
      return uploadedDocument;
    } catch (error) {
      setDocumentProgress(prev => ({ ...prev, [tempDocId]: { ...prev[tempDocId], status: 'error', percent: 0 } }));
      console.error('❌ Failed to upload document', error);
      alert('Error uploading PDF. Please make sure it\'s a valid PDF file.');
      return null;
    } finally {
      setUploading(false);
    }
  };

  // Upload and immediately open for reading
  const handleFileSelectAndRead = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    console.log('📤 Uploading and reading file:', file.name);
    const uploadedDoc = await uploadPDF(file);
    
    if (uploadedDoc) {
      console.log('📄 Successfully uploaded document:', uploadedDoc);
      console.log('🔗 Document PDF URL:', uploadedDoc.file_url);
      
      // Immediately select and open the document for reading
      setSelectedDocument(uploadedDoc);
      setTargetPage(null);
      alert(`✅ ${file.name} uploaded successfully and opened for reading!`);
    } else {
      console.error('❌ Failed to upload document');
      alert(`❌ Failed to upload ${file.name}`);
    }
    
    // Clear the input
    event.target.value = '';
  };

  // Upload multiple PDF files
  const uploadBulkPDFs = async (files) => {
    if (!files || files.length === 0) return;

    const pdfFiles = Array.from(files).filter(file => file.type === 'application/pdf');
    
    if (pdfFiles.length === 0) {
      alert('No valid PDF files found. Please select PDF files only.');
      return;
    }

    if (pdfFiles.length !== files.length) {
      const nonPdfCount = files.length - pdfFiles.length;
      if (!window.confirm(`${nonPdfCount} non-PDF files will be skipped. Continue with ${pdfFiles.length} PDF files?`)) {
        return;
      }
    }

  setBulkUploading(true);
  setUploadProgress({ current: 0, total: pdfFiles.length });
  setBulkProcessedCount(0);
    
    try {
      console.log(`📚 Using bulk upload API for ${pdfFiles.length} files...`);
      
      // Create FormData for bulk upload
      const formData = new FormData();
      pdfFiles.forEach(file => {
        formData.append('files', file);
      });

      // Simulate processing count (optional, for loader effect)
      for (let i = 0; i < pdfFiles.length; i++) {
        await new Promise(res => setTimeout(res, 200));
        setBulkProcessedCount(i + 1);
      }

      // Call the bulk upload API (real upload)
      const response = await axios.post(`${API_BASE_URL}/bulk-upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      console.log('📦 Bulk upload response:', response.data);
      
      const { uploaded_documents, successful_uploads, failed_uploads, upload_payload } = response.data;
      
      // Refresh the entire document list to get updated data
      if (uploaded_documents && uploaded_documents.length > 0) {
        await fetchDocuments();
      }
      
      // Show detailed results
      if (failed_uploads > 0) {
        alert(`Bulk upload completed!\n✅ Successful: ${successful_uploads}\n❌ Failed: ${failed_uploads}\n\nCheck console for details.`);
      } else {
        alert(`🎉 All ${successful_uploads} files uploaded successfully as Knowledge Base documents!`);
      }
      
      // Log detailed upload payload for debugging
      console.log('📊 Upload payload details:', upload_payload);
      
    } catch (error) {
      console.error('❌ Bulk upload failed:', error);
      alert('Bulk upload failed. Please try again.');
    } finally {
      setBulkUploading(false);
      setUploadProgress({ current: 0, total: 0 });
  setTimeout(() => setBulkProcessedCount(0), 2000);
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
    console.log("🎯 App.js handleTextSelection called!");
    console.log("📝 Text received in App.js:", text.substring(0, 50) + "...");
    console.log("📝 Full text received:", text);
    console.log("📝 Text length received:", text.length);
    
    // Clear existing timer
    if (textSelectionTimer) {
      clearTimeout(textSelectionTimer);
    }
    
    // Immediate visual feedback - update selected text immediately
    setSelectedText(text);
    console.log("📝 selectedText state updated immediately");
    
    // If text is cleared, also clear the summary immediately
    if (!text || text.trim() === '') {
      setSelectedTextSummary('');
      console.log("📝 Cleared selected text summary immediately");
      return;
    }
    
    // Show immediate loading state for better UX
    setTextSummaryLoading(true);
    
    // Only auto-generate summary for meaningful text (at least 1 word)
    const wordCount = text.trim().split(/\s+/).filter(word => word.length > 0).length;
    if (wordCount >= 1) {
      console.log(`⚡ Setting fast timer for auto-summary generation... (${wordCount} words detected)`);
      const timer = setTimeout(() => {
        console.log("🚀 Fast auto-generating summary for selected text...");
        generateSelectedTextSummaryAuto(text);
      }, AUTO_SUMMARY_DELAY);
      
      setTextSelectionTimer(timer);
    } else {
      console.log(`📝 Text too short for auto-summary (${wordCount} words, need at least 1), skipping...`);
      setSelectedTextSummary(''); // Clear summary for short text
      setTextSummaryLoading(false); // Clear loading state
    }
  };

  // Handle page change from PDFViewer
  const handlePageChange = (page) => {
    console.log(`📄 Page changed to: ${page} (current was: ${currentPage})`);
    setCurrentPage(page);
  };

  // Handle navigation to a different document from intelligent analysis
  const handleNavigateToDocument = (documentId, page, sectionId, sectionTitle) => {
    console.log(`🧭 Navigating to document ${documentId}, page ${page}, section ${sectionId}`);
    
    // Find and select the target document
    const targetDocument = documents.find(doc => doc.id === documentId);
    if (targetDocument) {
      // Save current document to navigation history
      if (selectedDocument && selectedDocument.id !== documentId) {
        const historyEntry = {
          document: selectedDocument,
          originalPage: currentPage, // Save the current page
          timestamp: Date.now(),
          fromSection: sectionTitle || 'Intelligent Analysis',
          // Save the current panel state
          panelState: {
            selectedText: selectedText,
            selectedTextSummary: selectedTextSummary,
            documentSummary: documentSummary,
            isPanelMinimized: isPanelMinimized,
            isSelectedTextExpanded: isSelectedTextExpanded,
            isTextSummaryExpanded: isTextSummaryExpanded,
            isSummaryExpanded: isSummaryExpanded
          }
        };
        setNavigationHistory(prev => [...prev, historyEntry]);
        setShowBackButton(true);
        console.log(`📚 Added to history: ${selectedDocument.original_name} (Page ${currentPage})`);
      }
      
      setSelectedDocument(targetDocument);
      console.log(`✅ Switched to document: ${targetDocument.original_name}`);
      
      // Set target page for navigation
      if (page && page > 0) {
        setTargetPage(page);
        console.log(`🎯 Target page set to: ${page}`);
      } else {
        setTargetPage(null);
      }
      
      // Clear any existing text selection when navigating
      setSelectedText('');
      setSelectedTextSummary('');
      
      // Enable focused view mode (no AI features, no control panel)
      setIsFocusedView(true);
      setIsPanelMinimized(true);
      
      console.log(`🧭 Navigation complete - Document: ${targetDocument.original_name}, Page: ${page || 'default'}`);
    } else {
      console.error(`❌ Target document ${documentId} not found`);
    }
  };

  // Handle going back to the previous document
  const handleGoBack = () => {
    if (navigationHistory.length > 0) {
      const lastEntry = navigationHistory[navigationHistory.length - 1];
      
      // Navigate back to the previous document
      setSelectedDocument(lastEntry.document);
      
      // Restore to the original page
      if (lastEntry.originalPage) {
        setTargetPage(lastEntry.originalPage);
        console.log(`⬅️ Going back to: ${lastEntry.document.original_name} (Page ${lastEntry.originalPage})`);
      } else {
        setTargetPage(null);
        console.log(`⬅️ Going back to: ${lastEntry.document.original_name}`);
      }
      
      // Restore the saved panel state
      if (lastEntry.panelState) {
        setSelectedText(lastEntry.panelState.selectedText || '');
        setSelectedTextSummary(lastEntry.panelState.selectedTextSummary || '');
        setDocumentSummary(lastEntry.panelState.documentSummary || '');
        setIsPanelMinimized(lastEntry.panelState.isPanelMinimized || false);
        setIsSelectedTextExpanded(lastEntry.panelState.isSelectedTextExpanded ?? true);
        setIsTextSummaryExpanded(lastEntry.panelState.isTextSummaryExpanded ?? true);
        setIsSummaryExpanded(lastEntry.panelState.isSummaryExpanded ?? true);
        console.log(`🔄 Restored panel state with selected text: "${lastEntry.panelState.selectedText?.substring(0, 50)}..."`);
      }
      
      // Collapse the intelligent analysis section when returning
      setIsIntelligentAnalysisExpanded(false);
      console.log('📦 Collapsed intelligent analysis section on return');
      
      // Exit focused view mode when going back
      setIsFocusedView(false);
      
      // Remove the last entry from history
      const newHistory = navigationHistory.slice(0, -1);
      setNavigationHistory(newHistory);
      
      // Hide back button if no more history
      if (newHistory.length === 0) {
        setShowBackButton(false);
      }
    }
  };

  // Generate AI summary using Gemini API
  const generateDocumentSummary = async () => {
    if (!selectedDocument) return;
    
    try {
      setSummaryLoading(true);
      console.log("🤖 Generating AI summary for:", selectedDocument.original_name);
      console.log("🔍 Document ID being sent:", selectedDocument.id);
      console.log("📄 Full document object:", selectedDocument);
      
      const response = await axios.post(`${API_BASE_URL}/generate-summary`, {
        document_id: selectedDocument.id,
        document_name: selectedDocument.original_name
      });
      
      setDocumentSummary(response.data.summary);
      console.log("✅ Summary generated successfully");
    } catch (error) {
      console.error('❌ Error generating summary:', error);
      console.error('❌ Error response:', error.response?.data);
      alert(`Failed to generate summary: ${error.response?.data?.detail || error.message}`);
    } finally {
      setSummaryLoading(false);
    }
  };

  // Generate AI summary for selected text using Gemini API (automatic version)
  const generateSelectedTextSummaryAuto = async (textToSummarize) => {
    if (!textToSummarize || textSummaryLoading) return;
    
    try {
      setTextSummaryLoading(true);
      console.log("🤖 Auto-generating AI summary for selected text:", textToSummarize.substring(0, 50) + "...");
      
      const response = await axios.post(`${API_BASE_URL}/generate-text-summary`, {
        selected_text: textToSummarize,
        context: selectedDocument ? selectedDocument.original_name : null
      });
      
      setSelectedTextSummary(response.data.summary);
      setIsTextSummaryExpanded(true); // Auto-expand when new summary is generated
      console.log("✅ Auto text summary generated successfully");
    } catch (error) {
      console.error('❌ Error generating auto text summary:', error);
      console.error('❌ Error response:', error.response?.data);
      // Don't show alert for auto-generated summaries, just log the error
      setSelectedTextSummary('❌ Failed to generate automatic summary. Please try again manually.');
    } finally {
      setTextSummaryLoading(false);
    }
  };

  // Generate AI summary for selected text using Gemini API (manual version)
  const generateSelectedTextSummary = async () => {
    if (!selectedText) return;
    
    try {
      setTextSummaryLoading(true);
      console.log("🤖 Manually generating AI summary for selected text:", selectedText.substring(0, 50) + "...");
      
      const response = await axios.post(`${API_BASE_URL}/generate-text-summary`, {
        selected_text: selectedText,
        context: selectedDocument ? selectedDocument.original_name : null
      });
      
      setSelectedTextSummary(response.data.summary);
      setIsTextSummaryExpanded(true); // Auto-expand when new summary is generated
      console.log("✅ Manual text summary generated successfully");
    } catch (error) {
      console.error('❌ Error generating manual text summary:', error);
      console.error('❌ Error response:', error.response?.data);
      alert(`Failed to generate text summary: ${error.response?.data?.detail || error.message}`);
    } finally {
      setTextSummaryLoading(false);
    }
  };

  // Text-to-Speech Functions
  const showSpeechSettingsPanel = (text) => {
    setPendingSpeechText(text);
    setShowSpeechSettings(true);
  };
  
  const generateSpeech = async (text, voice = selectedVoice, speed = speechSpeed) => {
    if (!text || !text.trim()) return;
    
    try {
      setSpeechLoading(true);
      setSpeechText(text);
      setShowSpeechSettings(false); // Hide settings panel
      
      console.log("🎙️ Generating speech for text:", text.substring(0, 100) + "...");
      console.log("🔊 Voice:", voice, "Speed:", speed);
      console.log("🌐 Making request to:", `${API_BASE_URL}/text-to-speech`);
      
      const response = await axios.post(`${API_BASE_URL}/text-to-speech`, {
        text: text,
        voice: voice,
        speed: speed
      });
      
      console.log("📡 Response received:", {
        status: response.status,
        dataKeys: Object.keys(response.data),
        audioDataLength: response.data?.audio_data?.length || 0,
        contentType: response.data?.content_type
      });
      
      if (response.data && response.data.audio_data) {
        console.log("🔄 Converting base64 to blob...");
        // Convert base64 to audio blob
        const audioBlob = base64ToBlob(response.data.audio_data, response.data.content_type);
        console.log("📁 Audio blob created:", {
          size: audioBlob.size,
          type: audioBlob.type
        });
        
        const audioUrl = URL.createObjectURL(audioBlob);
        console.log("🔗 Audio URL created:", audioUrl);
        
        // Create and play audio
        const audio = new Audio(audioUrl);
        setCurrentAudio(audio);
        
        audio.onplay = () => {
          console.log("▶️ Audio playback started");
          setIsPlaying(true);
        };
        audio.onpause = () => {
          console.log("⏸️ Audio playback paused");
          setIsPlaying(false);
        };
        audio.onended = () => {
          console.log("⏹️ Audio playback ended");
          setIsPlaying(false);
          URL.revokeObjectURL(audioUrl);
        };
        audio.onerror = (e) => {
          console.error("❌ Audio playback error:", e);
          console.error("❌ Audio error details:", {
            error: audio.error,
            networkState: audio.networkState,
            readyState: audio.readyState
          });
        };
        
        console.log("🎵 Attempting to play audio...");
        await audio.play();
        console.log("✅ Speech playback started successfully");
      } else {
        console.error("❌ No audio data in response");
        alert("No audio data received from server");
      }
    } catch (error) {
      console.error("❌ Speech generation error:", error);
      console.error("❌ Error details:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      alert(error.response?.data?.detail || "Failed to generate speech. Please check the console for details.");
    } finally {
      setSpeechLoading(false);
    }
  };
  
  const stopSpeech = () => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setIsPlaying(false);
    }
  };
  
  // Generate insights using Gemini API
  const generateInsights = async () => {
    if (!selectedText || !selectedDocument) return;
    
    try {
      setInsightsLoading(true);
      console.log("💡 Generating insights for selected text...");
      
      const response = await axios.post(`${API_BASE_URL}/generate-insights`, {
        selected_text: selectedText,
        document_name: selectedDocument.original_name,
        context: documentSummary
      });
      
      setInsights(response.data); // Use response.data directly, not response.data.insights
      setShowInsights(true);
      console.log("✅ Insights generated successfully");
    } catch (error) {
      console.error('❌ Error generating insights:', error);
      alert(`Failed to generate insights: ${error.response?.data?.detail || error.message}`);
    } finally {
      setInsightsLoading(false);
    }
  };
  
  // Generate podcast audio
  const generatePodcast = async () => {
    if (!selectedText || !selectedDocument) return;
    
    try {
      setPodcastLoading(true);
      console.log("🎙️ Generating interactive two-speaker podcast for selected text...");
      
      const response = await axios.post(`${API_BASE_URL}/generate-podcast`, {
        selected_text: selectedText,
        document_name: selectedDocument.original_name,
        context: documentSummary,
        duration: podcastSettings.duration,
        style: "podcast" // Force podcast style for interactive two-speaker format
      });
      
      if (response.data.audio_data) {
        const audioBlob = base64ToBlob(response.data.audio_data, 'audio/wav');
        const audioUrl = URL.createObjectURL(audioBlob);
        setPodcastAudio(audioUrl);
        setPodcastScript(response.data.script);
        setShowPodcastModal(true);
        console.log("✅ Interactive podcast generated successfully");
      } else {
        alert('No audio data received from the server');
      }
    } catch (error) {
      console.error('❌ Error generating podcast:', error);
      alert(`Failed to generate podcast: ${error.response?.data?.detail || error.message}`);
    } finally {
      setPodcastLoading(false);
    }
  };
  
  // Play/pause podcast
  const togglePodcast = () => {
    if (!podcastAudio) return;
    
    if (isPodcastPlaying) {
      // Pause
      const audio = document.getElementById('podcast-audio');
      if (audio) {
        audio.pause();
        setIsPodcastPlaying(false);
      }
    } else {
      // Play
      const audio = document.getElementById('podcast-audio');
      if (audio) {
        audio.play();
        setIsPodcastPlaying(true);
        audio.onended = () => setIsPodcastPlaying(false);
      }
    }
  };
  
  const base64ToBlob = (base64, contentType) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: contentType });
  };

  // Handle single file selection
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      uploadPDF(file);
    } else {
      alert('Please select a PDF file');
    }
    // Reset input
    event.target.value = '';
  };

  // Handle bulk file selection
  const handleBulkFileSelect = (event) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      uploadBulkPDFs(files);
    } else {
      alert('Please select PDF files');
    }
    // Reset input
    event.target.value = '';
  };

  // Load available voices when component mounts
  const loadAvailableVoices = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/available-voices`);
      if (response.data && response.data.voices) {
        setAvailableVoices(response.data.voices);
        if (response.data.default) {
          setSelectedVoice(response.data.default);
        }
        setVoicesLoaded(true);
        console.log("✅ Loaded available voices:", response.data.voices);
      }
    } catch (error) {
      console.error("❌ Failed to load voices:", error);
      // Fallback voices
      setAvailableVoices([
        {id: "alloy", name: "Alloy (Neutral)", provider: "azure"},
        {id: "female", name: "Female (Local)", provider: "local"},
        {id: "male", name: "Male (Local)", provider: "local"}
      ]);
      setVoicesLoaded(true);
    }
  };

  useEffect(() => {
    fetchDocuments();
    loadAvailableVoices(); // Load available voices when app starts
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
              <h2>Upload Documents</h2>
              
              {/* Upload & Read Document */}
              <div className="upload-area">
                <h3>� Upload & Read Document</h3>
                <p style={{ fontSize: '12px', color: '#666', margin: '5px 0' }}>
                  Upload a PDF file and open it immediately for reading and analysis
                </p>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelectAndRead}
                  disabled={uploading || bulkUploading}
                  id="single-file-input"
                  style={{ display: 'none' }}
                />
                <label htmlFor="single-file-input" className={`upload-btn read-upload-btn ${uploading || bulkUploading ? 'disabled' : ''}`}>
                  {uploading ? '⏳ Processing...' : '� Upload & Read PDF'}
                </label>
              </div>

              {/* Bulk Upload */}
              <div className="upload-area" style={{ marginTop: '15px' }}>
                <h3>📚 Build Knowledge Base</h3>
                <p style={{ fontSize: '12px', color: '#666', margin: '5px 0' }}>
                  Upload multiple PDF files to build your searchable knowledge library
                </p>
                <input
                  type="file"
                  accept=".pdf"
                  multiple
                  onChange={handleBulkFileSelect}
                  disabled={uploading || bulkUploading}
                  id="bulk-file-input"
                  style={{ display: 'none' }}
                />
                <label htmlFor="bulk-file-input" className={`upload-btn bulk-upload-btn ${uploading || bulkUploading ? 'disabled' : ''}`}>
                  {bulkUploading ? '⏳ Adding to Library...' : '� Add to Knowledge Base'}
                </label>
                
                {/* Progress indicator */}
                {bulkUploading && (
                  <div className="upload-progress" style={{ textAlign: 'center' }}>
                    <div className="loading-spinner-small" style={{ margin: '0 auto 10px auto' }}></div>
                    <p style={{ color: '#ccc', fontSize: 14 }}>
                      Processing {bulkProcessedCount} out of {uploadProgress.total} files...
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Documents List */}
            <div className="documents-section">
              <h2>Documents ({documents.length})</h2>
              {loading ? (
                <p>Loading...</p>
              ) : (
                <div className="documents-list">
                  {/* Reading Documents */}
                  {documents.filter(doc => doc.upload_type === 'fresh').length > 0 && (
                    <>
                      <div className="documents-category reading-category">
                        <h3>📖 Reading Documents ({documents.filter(doc => doc.upload_type === 'fresh').length})</h3>
                        <p className="category-desc">Documents for active reading</p>
                      </div>
                      {documents.filter(doc => doc.upload_type === 'fresh').map(doc => (
                        <div 
                          key={doc.id} 
                          className={`document-item fresh ${selectedDocument?.id === doc.id ? 'selected' : ''}`}
                        >
                          <div className="document-info" onClick={() => {
                            setSelectedDocument(doc);
                            setTargetPage(null);
                          }}>
                            <h4>📖 {doc.original_name}</h4>
                            <p className="document-meta">
                              Size: {(doc.file_size / 1024 / 1024).toFixed(2)} MB<br/>
                              Uploaded: {new Date(doc.upload_date).toLocaleDateString()}
                            </p>
                            {/* Progress Bar for this document */}
                            {documentProgress[doc.id] && documentProgress[doc.id].status !== 'complete' && (
                              <div className="upload-progress" style={{ marginTop: 8 }}>
                                <p style={{ margin: 0, fontSize: 12, color: '#ccc' }}>
                                  {documentProgress[doc.id].status === 'uploading' && 'Uploading...'}
                                  {documentProgress[doc.id].status === 'processing' && 'Processing for intelligent analysis...'}
                                  {documentProgress[doc.id].status === 'error' && 'Error'}
                                </p>
                                <div className="progress-bar">
                                  <div 
                                    className="progress-fill" 
                                    style={{ width: `${documentProgress[doc.id].percent}%` }}
                                  ></div>
                                </div>
                              </div>
                            )}
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
                    </>
                  )}
                  
                  {/* Knowledge Base */}
                  {documents.filter(doc => doc.upload_type === 'bulk').length > 0 && (
                    <>
                      <div className="documents-category knowledge-category" style={{ marginTop: documents.filter(doc => doc.upload_type === 'fresh').length > 0 ? '20px' : '0' }}>
                        <h3>📚 Knowledge Base ({documents.filter(doc => doc.upload_type === 'bulk').length})</h3>
                        <p className="category-desc">Reference documents for intelligent analysis</p>
                      </div>
                      {documents.filter(doc => doc.upload_type === 'bulk').map(doc => (
                        <div 
                          key={doc.id} 
                          className={`document-item bulk ${selectedDocument?.id === doc.id ? 'selected' : ''}`}
                        >
                          <div className="document-info" onClick={() => {
                            setSelectedDocument(doc);
                            setTargetPage(null); // Clear target page for normal document selection
                          }}>
                            <h4>📚 {doc.original_name}</h4>
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
                    </>
                  )}
                  
                  {/* Legacy documents without upload_type */}
                  {documents.filter(doc => !doc.upload_type).length > 0 && (
                    <>
                      <div className="documents-category" style={{ marginTop: documents.filter(doc => doc.upload_type).length > 0 ? '20px' : '0' }}>
                        <h3>📑 Legacy Documents ({documents.filter(doc => !doc.upload_type).length})</h3>
                        <p className="category-desc">Existing documents</p>
                      </div>
                      {documents.filter(doc => !doc.upload_type).map(doc => (
                        <div 
                          key={doc.id} 
                          className={`document-item legacy ${selectedDocument?.id === doc.id ? 'selected' : ''}`}
                        >
                          <div className="document-info" onClick={() => {
                            setSelectedDocument(doc);
                            setTargetPage(null); // Clear target page for normal document selection
                          }}>
                            <h4>📑 {doc.original_name}</h4>
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
                    </>
                  )}
                  
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
                {/* Header with Back Button and Summary Button */}
                <div className="pdf-header">
                  <div className="header-left">
                    {showBackButton ? (
                      <button 
                        className="back-button intelligent-back"
                        onClick={handleGoBack}
                        title={`Back to ${navigationHistory.length > 0 ? navigationHistory[navigationHistory.length - 1].document.original_name : 'previous document'}`}
                      >
                        ⬅️ Back to Previous
                      </button>
                    ) : (
                      <button 
                        className="back-button"
                        onClick={() => {
                          setSelectedDocument(null);
                          setIsFocusedView(false);
                        }}
                        title="Back to document list"
                      >
                        ← Back to Documents
                      </button>
                    )}
                  </div>
                  
                  {!isFocusedView && (
                    <button 
                      className="summary-button"
                      onClick={() => generateDocumentSummary()}
                      title="Generate AI summary of this document"
                      disabled={summaryLoading}
                    >
                      {summaryLoading ? '⏳ Summarizing...' : '🤖 AI Summary'}
                    </button>
                  )}
                </div>
                
                {/* PDF Viewer */}
                <div className="pdf-viewer-container">
                  {/* Page indicator */}
                  {!isFocusedView && (
                    <div className="page-indicator" style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      background: 'rgba(0, 0, 0, 0.7)',
                      color: 'white',
                      padding: '5px 10px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      zIndex: 1000
                    }}>
                      📄 Page: {currentPage}
                    </div>
                  )}
                  <PDFViewer 
                    document={selectedDocument} 
                    onTextSelection={isFocusedView ? null : handleTextSelection}
                    targetPage={targetPage}
                    onPageChange={handlePageChange}
                  />
                </div>
                
                {/* Selected Text Panel - Hidden in focused view */}
                {!isFocusedView && (
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
                      {/* Selected Text Section - only show if text is selected */}
                      {selectedText && (
                        <div className="panel-section">
                          <div className="section-header">
                            <h4 className="section-title">✏️ Selected Text</h4>
                            <button 
                              className="section-toggle-btn"
                              onClick={() => setIsSelectedTextExpanded(!isSelectedTextExpanded)}
                              title={isSelectedTextExpanded ? "Collapse section" : "Expand section"}
                            >
                              {isSelectedTextExpanded ? '🔽' : '▶️'}
                            </button>
                          </div>
                          {isSelectedTextExpanded && (
                            <div className="section-content selected-text">
                              <div className="text-content">
                                <p>{selectedText}</p>
                              </div>
                              <div className="text-actions">
                                <button 
                                  className="action-btn copy-btn"
                                  onClick={() => navigator.clipboard.writeText(selectedText)}
                                  title="Copy text"
                                >
                                  📋 Copy
                                </button>
                                <button 
                                  className="action-btn insights-btn"
                                  onClick={generateInsights}
                                  disabled={insightsLoading}
                                  title="Generate insights and key takeaways"
                                >
                                  {insightsLoading ? '⏳' : '💡'} {insightsLoading ? 'Generating...' : 'Insights'}
                                </button>
                                <button 
                                  className="action-btn podcast-btn"
                                  onClick={generatePodcast}
                                  disabled={podcastLoading}
                                  title="Generate interactive two-speaker podcast conversation"
                                >
                                  {podcastLoading ? '⏳' : '🎙️'} {podcastLoading ? 'Generating...' : 'Interactive Podcast'}
                                </button>
                                <button 
                                  className="action-btn clear-btn"
                                  onClick={() => {
                                    if (textSelectionTimer) {
                                      clearTimeout(textSelectionTimer);
                                    }
                                    setSelectedText('');
                                    setSelectedTextSummary('');
                                  }}
                                  title="Clear selection"
                                >
                                  🗑️ Clear
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Selected Text Summary Section - show when text is selected or summary exists */}
                      {(selectedText && selectedText.trim().length > 20) || selectedTextSummary || textSummaryLoading ? (
                        <div className="panel-section text-summary-section">
                          <div className="section-header">
                            <h4 className="section-title">📝 AI Analysis (Auto)</h4>
                            <div className="section-header-actions">
                              {selectedTextSummary && selectedText && (
                                <button 
                                  className="section-action-btn refresh-btn"
                                  onClick={generateSelectedTextSummary}
                                  title="Regenerate selected text summary"
                                  disabled={textSummaryLoading}
                                >
                                  🔄
                                </button>
                              )}
                              <button 
                                className="section-toggle-btn"
                                onClick={() => setIsTextSummaryExpanded(!isTextSummaryExpanded)}
                                title={isTextSummaryExpanded ? "Collapse section" : "Expand section"}
                              >
                                {isTextSummaryExpanded ? '🔽' : '▶️'}
                              </button>
                            </div>
                          </div>
                          {isTextSummaryExpanded && (
                            <div className="section-content">
                              {textSummaryLoading ? (
                                <div className="loading-content">
                                  <div className="loading-spinner-small"></div>
                                  <p>🤖 Automatically analyzing selected text...</p>
                                  <p style={{ fontSize: '12px', opacity: '0.7', marginTop: '8px' }}>
                                    Summary will appear when analysis is complete
                                  </p>
                                </div>
                              ) : selectedText && selectedText.trim().length > 20 && !selectedTextSummary ? (
                                <div className="loading-content">
                                  <div className="auto-summary-waiting">⏲️</div>
                                  <p>Preparing to analyze selected text...</p>
                                  <p style={{ fontSize: '12px', opacity: '0.7', marginTop: '8px' }}>
                                    AI analysis will start automatically in {Math.ceil(AUTO_SUMMARY_DELAY / 1000)} seconds
                                  </p>
                                </div>
                              ) : selectedTextSummary ? (
                                <div className="document-summary text-summary">
                                  <p>{selectedTextSummary}</p>
                                  <div className="summary-actions">
                                    <button 
                                      className="action-btn copy-btn"
                                      onClick={() => navigator.clipboard.writeText(selectedTextSummary)}
                                      title="Copy analysis"
                                    >
                                      📋 Copy
                                    </button>
                                    <button 
                                      className="action-btn speech-btn"
                                      onClick={() => isPlaying && speechText === selectedTextSummary ? stopSpeech() : showSpeechSettingsPanel(selectedTextSummary)}
                                      disabled={speechLoading}
                                      title={isPlaying && speechText === selectedTextSummary ? "Stop speech" : "Listen to analysis"}
                                    >
                                      {speechLoading && speechText === selectedTextSummary ? '⏳' : (isPlaying && speechText === selectedTextSummary ? '⏹️' : '🔊')} 
                                      {speechLoading && speechText === selectedTextSummary ? 'Generating...' : (isPlaying && speechText === selectedTextSummary ? 'Stop' : 'Listen')}
                                    </button>
                                    <button 
                                      className="action-btn clear-btn"
                                      onClick={() => setSelectedTextSummary('')}
                                      title="Clear analysis"
                                    >
                                      🗑️ Clear
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="placeholder-content">
                                  <p style={{ opacity: '0.7', fontStyle: 'italic' }}>
                                    Select any text for automatic AI analysis
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : null}
                      
                      {/* Intelligent Analysis Section - Only updates when text changes */}
                      <IntelligentAnalysis
                        selectedText={selectedText}
                        currentDocumentId={selectedDocument?.id}
                        onNavigateToDocument={handleNavigateToDocument}
                        isExpanded={isIntelligentAnalysisExpanded}
                        onToggleExpanded={setIsIntelligentAnalysisExpanded}
                      />
                      
                      {/* Document Summary Section */}
                      {(documentSummary || summaryLoading) && (
                        <div className="panel-section">
                          <div className="section-header">
                            <h4 className="section-title">📄 Document Summary</h4>
                            <div className="section-header-actions">
                              {documentSummary && (
                                <button 
                                  className="section-action-btn refresh-btn"
                                  onClick={generateDocumentSummary}
                                  title="Regenerate summary"
                                  disabled={summaryLoading}
                                >
                                  🔄
                                </button>
                              )}
                              <button 
                                className="section-toggle-btn"
                                onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
                                title={isSummaryExpanded ? "Collapse section" : "Expand section"}
                              >
                                {isSummaryExpanded ? '🔽' : '▶️'}
                              </button>
                            </div>
                          </div>
                          {isSummaryExpanded && (
                            <div className="section-content">
                              {summaryLoading ? (
                                <div className="loading-content">
                                  <div className="loading-spinner-small"></div>
                                  <p>Generating AI summary...</p>
                                </div>
                              ) : (
                                <div className="document-summary">
                                  <p>{documentSummary}</p>
                                  <div className="summary-actions">
                                    <button 
                                      className="action-btn copy-btn"
                                      onClick={() => navigator.clipboard.writeText(documentSummary)}
                                      title="Copy summary"
                                    >
                                      📋 Copy
                                    </button>
                                    <button 
                                      className="action-btn speech-btn"
                                      onClick={() => isPlaying && speechText === documentSummary ? stopSpeech() : showSpeechSettingsPanel(documentSummary)}
                                      disabled={speechLoading}
                                      title={isPlaying && speechText === documentSummary ? "Stop speech" : "Listen to summary"}
                                    >
                                      {speechLoading && speechText === documentSummary ? '⏳' : (isPlaying && speechText === documentSummary ? '⏹️' : '🔊')} 
                                      {speechLoading && speechText === documentSummary ? 'Generating...' : (isPlaying && speechText === documentSummary ? 'Stop' : 'Listen')}
                                    </button>
                                    <button 
                                      className="action-btn clear-btn"
                                      onClick={() => setDocumentSummary('')}
                                      title="Clear summary"
                                    >
                                      🗑️ Clear
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Quick Actions Section */}
                      <div className="panel-section quick-actions">
                        <h4 className="section-title">⚡ Quick Actions</h4>
                        <div className="action-grid">
                          <button 
                            className="quick-action-btn"
                            onClick={generateDocumentSummary}
                            disabled={!selectedDocument || summaryLoading}
                            title="Generate AI summary of this document"
                          >
                            {summaryLoading ? '⏳' : '🤖'} AI Summary
                          </button>
                          <button 
                            className="quick-action-btn"
                            onClick={() => {
                              // Clear timer if it's running
                              if (textSelectionTimer) {
                                clearTimeout(textSelectionTimer);
                                setTextSelectionTimer(null);
                              }
                              setSelectedText('');
                              setDocumentSummary('');
                              setSelectedTextSummary('');
                            }}
                            disabled={!selectedText && !documentSummary && !selectedTextSummary}
                            title="Clear all content and cancel auto-summary"
                          >
                            🧹 Clear All
                          </button>
                        </div>
                      </div>
                      
                      {/* Placeholder when nothing is selected or summarized */}
                      {!selectedText && !documentSummary && !selectedTextSummary && !summaryLoading && !textSummaryLoading && (
                        <div className="panel-placeholder">
                          <div className="placeholder-icon">📝</div>
                          <h4>Welcome to Content Panel</h4>
                          <p>Select text in the PDF or generate an AI summary to see content here</p>
                          <div className="placeholder-tips">
                            <div className="tip">
                              <span className="tip-icon">💡</span>
                              <span>Tip: Select text in the PDF by clicking and highlighting</span>
                            </div>
                            <div className="tip">
                              <span className="tip-icon">🤖</span>
                              <span>Click "AI Summary" to get document insights</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                )}
              </div>
            ) : (
              <div className="no-pdf-selected">
                <h2>📖 Select a PDF to view</h2>
                <p>Choose a document from the sidebar to start viewing</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Speech Settings Popup Panel */}
        {showSpeechSettings && (
          <div className="speech-settings-overlay" onClick={() => setShowSpeechSettings(false)}>
            <div className="speech-settings-popup" onClick={(e) => e.stopPropagation()}>
              <div className="speech-settings-header">
                <h3>🔊 Speech Settings</h3>
                <button 
                  className="close-settings-btn"
                  onClick={() => setShowSpeechSettings(false)}
                  title="Close settings"
                >
                  ✕
                </button>
              </div>
              
              <div className="speech-settings-body">
                <div className="settings-preview">
                  <h4>Preview Text:</h4>
                  <p className="preview-text">{pendingSpeechText.substring(0, 100)}...</p>
                </div>
                
                <div className="setting-group">
                  <label htmlFor="popup-voice-select">Voice:</label>
                  <select 
                    id="popup-voice-select"
                    value={selectedVoice} 
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="voice-select"
                  >
                    {availableVoices.map(voice => (
                      <option key={voice.id} value={voice.id}>
                        {voice.name} {voice.provider === 'azure' ? '🌐' : '💻'}
                      </option>
                    ))}
                    {!voicesLoaded && (
                      <option value="alloy">Loading voices...</option>
                    )}
                  </select>
                  <small className="voice-provider-info">
                    🌐 = Cloud TTS (better quality) | 💻 = Local TTS (offline)
                  </small>
                </div>
                
                <div className="setting-group">
                  <label htmlFor="popup-speed-select">Speed:</label>
                  <select 
                    id="popup-speed-select"
                    value={speechSpeed} 
                    onChange={(e) => setSpeechSpeed(e.target.value)}
                    className="speed-select"
                  >
                    <option value="slow">Slow</option>
                    <option value="medium">Medium</option>
                    <option value="fast">Fast</option>
                  </select>
                </div>
              </div>
              
              <div className="speech-settings-footer">
                <button 
                  className="settings-btn cancel-btn"
                  onClick={() => setShowSpeechSettings(false)}
                >
                  Cancel
                </button>
                <button 
                  className="settings-btn generate-btn"
                  onClick={() => generateSpeech(pendingSpeechText, selectedVoice, speechSpeed)}
                  disabled={speechLoading}
                >
                  {speechLoading ? '⏳ Generating...' : '🎙️ Generate Speech'}
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Insights Modal */}
        {showInsights && insights && (
          <div className="modal-overlay" onClick={() => setShowInsights(false)}>
            <div className="modal insights-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>💡 Smart Insights</h3>
                <button 
                  className="modal-close-btn"
                  onClick={() => setShowInsights(false)}
                >
                  ✕
                </button>
              </div>
              <div className="insights-content">
                {insights.key_takeaways && insights.key_takeaways.length > 0 && (
                  <div className="insight-section">
                    <h4>🎯 Key Takeaways</h4>
                    <ul>
                      {insights.key_takeaways.map((takeaway, index) => (
                        <li key={index}>{takeaway}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {insights.did_you_know && insights.did_you_know.length > 0 && (
                  <div className="insight-section">
                    <h4>🤔 Did You Know?</h4>
                    <ul>
                      {insights.did_you_know.map((fact, index) => (
                        <li key={index}>{fact}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {insights.contradictions && insights.contradictions.length > 0 && (
                  <div className="insight-section">
                    <h4>⚖️ Contradictions & Counterpoints</h4>
                    <ul>
                      {insights.contradictions.map((contradiction, index) => (
                        <li key={index}>{contradiction}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {insights.examples && insights.examples.length > 0 && (
                  <div className="insight-section">
                    <h4>📖 Examples & Case Studies</h4>
                    <ul>
                      {insights.examples.map((example, index) => (
                        <li key={index}>{example}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {insights.cross_document_inspirations && insights.cross_document_inspirations.length > 0 && (
                  <div className="insight-section">
                    <h4>🌐 Cross-Document Connections</h4>
                    <ul>
                      {insights.cross_document_inspirations.map((inspiration, index) => (
                        <li key={index}>{inspiration}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button 
                  className="modal-btn copy-btn"
                  onClick={() => {
                    const text = Object.entries(insights)
                      .filter(([key, value]) => Array.isArray(value) && value.length > 0)
                      .map(([key, value]) => {
                        const title = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                        return `${title}:\n${value.map(item => `• ${item}`).join('\n')}`;
                      }).join('\n\n');
                    navigator.clipboard.writeText(text);
                  }}
                >
                  📋 Copy All Insights
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Podcast Modal */}
        {showPodcastModal && (
          <div className="modal-overlay" onClick={() => setShowPodcastModal(false)}>
            <div className="modal podcast-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>🎙️ Interactive Podcast Conversation</h3>
                <button 
                  className="modal-close-btn"
                  onClick={() => setShowPodcastModal(false)}
                >
                  ✕
                </button>
              </div>
              <div className="podcast-content">
                <div className="speakers-info">
                  <div className="speaker host-speaker">
                    <span className="speaker-icon">🎤</span>
                    <span className="speaker-label">Host</span>
                  </div>
                  <div className="vs-indicator">vs</div>
                  <div className="speaker expert-speaker">
                    <span className="speaker-icon">🧠</span>
                    <span className="speaker-label">Expert</span>
                  </div>
                </div>
                
                {podcastAudio && (
                  <div className="audio-player">
                    <audio 
                      id="podcast-audio"
                      src={podcastAudio}
                      onPlay={() => setIsPodcastPlaying(true)}
                      onPause={() => setIsPodcastPlaying(false)}
                      onEnded={() => setIsPodcastPlaying(false)}
                      controls
                    />
                    <div className="player-controls">
                      <button 
                        className="play-pause-btn"
                        onClick={togglePodcast}
                      >
                        {isPodcastPlaying ? '⏸️ Pause' : '▶️ Play'}
                      </button>
                    </div>
                  </div>
                )}
                
                {podcastScript && (
                  <div className="podcast-script">
                    <h4>📜 Script</h4>
                    <div className="script-content">
                      {podcastScript.split('\n').map((line, index) => {
                        if (line.startsWith('HOST:')) {
                          return <p key={index} className="host-line"><strong>Host:</strong> {line.substring(5)}</p>;
                        } else if (line.startsWith('EXPERT:')) {
                          return <p key={index} className="expert-line"><strong>Expert:</strong> {line.substring(7)}</p>;
                        } else if (line.trim()) {
                          return <p key={index} className="narrative-line">{line}</p>;
                        }
                        return null;
                      })}
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button 
                  className="modal-btn copy-btn"
                  onClick={() => navigator.clipboard.writeText(podcastScript)}
                >
                  📋 Copy Script
                </button>
                <button 
                  className="modal-btn download-btn"
                  onClick={() => {
                    if (podcastAudio) {
                      const a = document.createElement('a');
                      a.href = podcastAudio;
                      a.download = `podcast-${selectedDocument?.original_name || 'audio'}.wav`;
                      a.click();
                    }
                  }}
                >
                  💾 Download Audio
                </button>
              </div>
            </div>
          </div>
        )}
      </header>
    </div>
  );
}

export default App;
