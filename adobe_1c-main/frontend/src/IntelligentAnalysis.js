import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './IntelligentAnalysis.css';

const API_BASE_URL = 'http://localhost:8080/api';

const IntelligentAnalysis = ({ selectedText, currentDocumentId, onNavigateToDocument, isExpanded, onToggleExpanded }) => {
  const [analysisData, setAnalysisData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  
  // Use refs to track last analyzed state without causing re-renders
  const lastAnalyzedTextRef = useRef('');
  const lastAnalyzedDocIdRef = useRef(null);
  const lastAnalysisDataRef = useRef(null); // Store the last analysis result

  // Use the expansion state from parent component
  const expanded = isExpanded !== undefined ? isExpanded : true;
  const toggleExpanded = onToggleExpanded || (() => {});

  // Only trigger analysis when selected text changes, not when document changes
  useEffect(() => {
    console.log('🔄 useEffect triggered - selectedText changed:', {
      selectedTextLength: selectedText?.length || 0,
      selectedTextPreview: selectedText?.substring(0, 100) || 'NO TEXT',
      currentDocumentId
    });

    const currentText = selectedText?.trim() || '';
    const lastAnalyzedText = lastAnalyzedTextRef.current?.trim() || '';
    const textChanged = currentText !== lastAnalyzedText;
    const hasValidText = currentText.length > 0;
    const hasDocument = currentDocumentId;
    
    // Check if we're returning to previously analyzed text
    const isSameTextAsLastAnalyzed = currentText === lastAnalyzedText && currentText.length > 0;
    
    console.log('🔍 IntelligentAnalysis useEffect analysis:', {
      currentTextLength: currentText.length,
      currentTextPreview: currentText.substring(0, 50) + (currentText.length > 50 ? '...' : ''),
      lastAnalyzedTextLength: lastAnalyzedText.length,
      lastAnalyzedTextPreview: lastAnalyzedText.substring(0, 50) + (lastAnalyzedText.length > 50 ? '...' : ''),
      currentDocumentId,
      textChanged,
      hasValidText,
      hasDocument,
      isSameTextAsLastAnalyzed,
      hasStoredAnalysis: !!lastAnalysisDataRef.current,
      willCallAPI: hasValidText && hasDocument && textChanged,
      willRestoreAnalysis: isSameTextAsLastAnalyzed && lastAnalysisDataRef.current
    });
    
    if (hasValidText && hasDocument && textChanged) {
      console.log('🔄 Text changed from last analyzed text, performing new intelligent analysis...');
      // Show immediate loading feedback for better UX
      setIsLoading(true);
      setError(null);
      performIntelligentAnalysis();
      // Note: lastAnalyzedTextRef is now set in performIntelligentAnalysis after successful API call
    } else if (isSameTextAsLastAnalyzed && lastAnalysisDataRef.current) {
      // Restore previous analysis for the same text instantly
      console.log('🔄 Restoring previous analysis for the same text instantly...');
      setAnalysisData(lastAnalysisDataRef.current);
      setError(null);
      setIsLoading(false); // Ensure loading state is cleared
    } else if (!hasValidText) {
      // Clear analysis when text is cleared
      console.log('🧹 Clearing analysis (no valid text)');
      setAnalysisData(null);
      setError(null);
      lastAnalyzedTextRef.current = '';
      lastAnalyzedDocIdRef.current = null;
      lastAnalysisDataRef.current = null; // Clear stored analysis too
    } else if (hasValidText && hasDocument && !textChanged) {
      console.log('📋 Text unchanged from last analyzed text, keeping existing analysis...');
    } else if (hasValidText && !hasDocument) {
      console.log('⚠️ Valid text but no document ID, skipping analysis...');
    }
  }, [selectedText]); // Only depend on selectedText, not currentDocumentId

  const performIntelligentAnalysis = async () => {
    console.log('🚀 Starting intelligent analysis...');

    if (!selectedText || !selectedText.trim() || !currentDocumentId) {
      console.log('❌ Missing required data for analysis');
      return;
    }

    try {
      // Already set loading state in useEffect for immediate feedback
      setError(null);

      const requestPayload = {
        selected_text: selectedText,
        current_document_id: currentDocumentId,
        max_results: 5
      };
      
      const response = await axios.post(`${API_BASE_URL}/intelligent-analysis`, requestPayload);

      setAnalysisData(response.data);
      console.log("✅ Intelligent analysis completed successfully");
      
      // Set last analyzed text only after successful API call
      lastAnalyzedTextRef.current = selectedText;
      lastAnalyzedDocIdRef.current = currentDocumentId;
      
      // Store the analysis result for future restoration
      lastAnalysisDataRef.current = response.data;
      
      console.log("💾 Updated lastAnalyzedTextRef and stored analysis data for future restoration");

    } catch (err) {
      console.error('❌ Intelligent analysis API call failed:', {
        error: err,
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        url: err.config?.url,
        method: err.config?.method
      });
      
      if (err.response?.status === 503) {
        setError("🔧 Enhanced analysis not available. Please install required dependencies.");
      } else if (err.response?.status === 500) {
        setError(`Server Error: ${err.response?.data?.detail || err.message}`);
      } else if (err.code === 'ECONNREFUSED') {
        setError("❌ Cannot connect to backend server. Please make sure the backend is running on port 8000.");
      } else {
        setError(`Analysis failed: ${err.response?.data?.detail || err.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSnippetClick = (snippet) => {
    console.log("🖱️ Navigating to snippet:", snippet);
    if (onNavigateToDocument) {
      onNavigateToDocument(snippet.document_id, snippet.page, snippet.section_id, snippet.title);
    }
  };

  const getSnippetTypeIcon = (type) => {
    switch (type) {
      case 'supporting': return '✅';
      case 'contradictory': return '⚠️';
      case 'related': return '🔗';
      default: return '📄';
    }
  };

  const getSnippetTypeLabel = (type) => {
    switch (type) {
      case 'supporting': return 'Supporting';
      case 'contradictory': return 'Contradictory';
      case 'related': return 'Related';
      default: return 'Related';
    }
  };

  // Don't show the component if there's no selected text
  if (!selectedText || !selectedText.trim()) {
    return null;
  }

  return (
    <div className="intelligent-analysis-panel">
      <div className="analysis-header">
        <div className="header-content">
          <h4 className="analysis-title">
            🧠 Intelligent Analysis
            {analysisData && (
              <span className="analysis-count">
                ({analysisData.related_snippets.length} findings)
              </span>
            )}
          </h4>
          <button 
            className="analysis-toggle-btn"
            onClick={() => toggleExpanded(!expanded)}
            title={expanded ? "Collapse analysis" : "Expand analysis"}
          >
            {expanded ? '🔽' : '▶️'}
          </button>
          <button 
            className="analysis-help-btn"
            onClick={() => setShowHelp(!showHelp)}
            title="Show navigation help"
          >
            {showHelp ? '❓' : 'ℹ️'}
          </button>
        </div>
        {analysisData && (
          <div className="analysis-stats">
            <span className="processing-time">
              ⚡ {analysisData.processing_time.toFixed(2)}s
            </span>
          </div>
        )}
        
        {showHelp && (
          <div className="analysis-help">
            <h5>🚀 Navigation Options</h5>
            <div className="help-items">
              <div className="help-item">
                <strong>Click any snippet:</strong> Navigate to related content
              </div>
              <div className="help-item">
                <strong>🧭 Navigate Button:</strong> Jump to the related document section
              </div>
              <div className="help-item">
                <strong>⬅️ Back Button:</strong> Return to your previous document with all content preserved
              </div>
            </div>
          </div>
        )}
      </div>

      {expanded && (
        <div className="analysis-content">
          {isLoading && (
            <div className="analysis-loading">
              <div className="loading-spinner-small"></div>
              <p>🧠 Analyzing your document library...</p>
              <p style={{ fontSize: '12px', opacity: '0.7' }}>
                Finding related, supporting, and contradictory content
              </p>
            </div>
          )}

          {error && (
            <div className="analysis-error">
              <p>{error}</p>
              <button 
                className="retry-btn"
                onClick={performIntelligentAnalysis}
              >
                🔄 Retry Analysis
              </button>
            </div>
          )}

          {analysisData && !isLoading && (
            <div className="analysis-results">
              {/* Analysis Summary */}
              {analysisData.analysis_summary && (
                <div className="analysis-summary">
                  <h5>📊 Key Insights</h5>
                  <p>{analysisData.analysis_summary}</p>
                </div>
              )}

              {/* Related Snippets */}
              {analysisData.related_snippets && analysisData.related_snippets.length > 0 ? (
                <div className="related-snippets">
                  <h5>🔍 Related Content ({analysisData.related_snippets.length})</h5>
                  
                  {analysisData.related_snippets.map((snippet, index) => (
                    <div 
                      key={snippet.id}
                      className={`snippet-item ${snippet.snippet_type}`}
                      onClick={() => handleSnippetClick(snippet)}
                      title={`Click to navigate to "${snippet.title}" in ${snippet.document_name}`}
                    >
                      <div className="snippet-header">
                        <div className="snippet-title">
                          <span className="snippet-type-icon">
                            {getSnippetTypeIcon(snippet.snippet_type)}
                          </span>
                          <span className="snippet-title-text">{snippet.title}</span>
                          <span className="snippet-type-label">
                            {getSnippetTypeLabel(snippet.snippet_type)}
                          </span>
                        </div>
                        <div className="snippet-meta">
                          <span className="similarity-score">
                            {(snippet.similarity_score * 100).toFixed(0)}% match
                          </span>
                        </div>
                      </div>
                      
                      <div className="snippet-content">
                        <p>{snippet.content}</p>
                      </div>
                      
                      <div className="snippet-footer">
                        <span className="snippet-source">
                          📄 {snippet.document_name} (Page {snippet.page})
                        </span>
                        <div className="navigation-buttons">
                          <button 
                            className="navigate-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigateToDocument && onNavigateToDocument(snippet.document_id, snippet.page, snippet.section_id, snippet.title);
                            }}
                            title="Navigate to this document"
                          >
                            Navigate
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                analysisData && (
                  <div className="no-results">
                    <p>🔍 No related content found in other documents.</p>
                    <p style={{ fontSize: '12px', opacity: '0.7' }}>
                      Try selecting different text or upload more documents to your library.
                    </p>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default IntelligentAnalysis;
