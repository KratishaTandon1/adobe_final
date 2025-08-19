import React, { useEffect, useRef, useState } from 'react';

const PDFViewer = ({ document: pdfDocument }) => {
  const viewerRef = useRef(null);
  const adobeDCViewRef = useRef(null);
  const [isAdobeLoaded, setIsAdobeLoaded] = useState(false);
  const [adobeError, setAdobeError] = useState(null);
  const [selectedText, setSelectedText] = useState('');
  const [showPopup, setShowPopup] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    console.log("🚀 PDFViewer useEffect triggered!");
    console.log("📋 pdfDocument:", pdfDocument);
    console.log("🎯 viewerRef.current:", viewerRef.current);
    
    // Adobe PDF Embed API Client ID
    const CLIENT_ID = process.env.REACT_APP_ADOBE_EMBED_API_KEY;
    
    if (pdfDocument && viewerRef.current) {
      console.log("✅ Both pdfDocument and viewerRef are available, proceeding with Adobe PDF setup");
      
      // Clear any existing Adobe instance
      if (adobeDCViewRef.current) {
        try {
          console.log("🧹 Clearing previous Adobe instance");
          adobeDCViewRef.current = null;
        } catch (error) {
          console.log('Cleanup previous instance:', error);
        }
      }

      // Clear the container
      viewerRef.current.innerHTML = '';

      // Function to attempt Adobe PDF initialization
      function attemptInitialization() {
        try {
          if (!window.AdobeDC) {
            throw new Error('Adobe DC SDK not loaded');
          }

          if (!viewerRef.current) {
            return;
          }

          // Clear the container
          viewerRef.current.innerHTML = '';
          
          // Create Adobe DC View instance
          adobeDCViewRef.current = new window.AdobeDC.View({
            clientId: CLIENT_ID,
            divId: viewerRef.current.id,
          });

          // Configure and preview the PDF
          const previewFilePromise = adobeDCViewRef.current.previewFile({
            content: { location: { url: pdfDocument.file_url } },
            metaData: { fileName: pdfDocument.original_name }
          }, {
            embedMode: "FULL_WINDOW",
            showDownloadPDF: true,
            showPrintPDF: true,
            showLeftHandPanel: true,
            showAnnotationTools: true,
            enableSearchAPIs: true,
            includePDFAnnotations: true,
            enableFormFilling: true,
            showSharePDF: false,
            showZoomControl: true,
            defaultViewMode: "FIT_PAGE",
            showBookmarks: true,
            showThumbnails: true,
            enableLinearization: true
          });

          // Setup simple text selection
          previewFilePromise.then(adobeViewer => {
            console.log("✅ Adobe viewer ready");
            
            adobeViewer.getAPIs().then(apis => {
              console.log("📚 Adobe APIs available");
              
              if (apis.getSelectedContent) {
                setupSimpleSelection(apis);
              }
            }).catch(error => {
              console.warn("❌ Error getting Adobe APIs:", error);
            });
          }).catch(error => {
            console.warn("❌ Error with preview file promise:", error);
          });

          setIsAdobeLoaded(true);
          setAdobeError(null);

        } catch (error) {
          console.error('Error initializing Adobe PDF viewer:', error);
          setAdobeError(`Error loading PDF viewer: ${error.message}. Please try refreshing the page.`);
          setIsAdobeLoaded(false);
        }
      }

      // Simple selection detection
      function setupSimpleSelection(apis) {
        console.log("🚀 Setting up simple selection detection");
        
        let lastText = '';
        
        const checkSelection = () => {
          apis.getSelectedContent().then(result => {
            const currentText = result?.data?.trim() || '';
            
            // If we had text and now we don't - show popup
            if (lastText && !currentText) {
              console.log("❌ Text deselected:", lastText);
              showPopupForText(lastText);
            }
            
            lastText = currentText;
          }).catch(() => {
            // Ignore errors
          });
        };
        
        // Check every 100ms
        setInterval(checkSelection, 100);
      }

      function showPopupForText(text) {
        console.log("🎉 Showing popup for text:", text.substring(0, 50) + "...");
        
        setSelectedText(text);
        
        // Position popup in center
        const rect = viewerRef.current?.getBoundingClientRect();
        setPopupPosition({
          x: rect ? rect.left + rect.width / 2 : 200,
          y: rect ? rect.top + 100 : 100
        });
        
        // Show after 1 second
        setTimeout(() => {
          setShowPopup(true);
          console.log("✅ Popup visible!");
        }, 1000);
      }

      // Start initialization
      attemptInitialization();
    }
  }, [pdfDocument]);

  // Close popup when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (showPopup && !event.target.closest('.text-selection-popup')) {
        setShowPopup(false);
        setSelectedText('');
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPopup]);

  const closePopup = () => {
    setShowPopup(false);
    setSelectedText('');
  };

  if (!pdfDocument) {
    return (
      <div className="pdf-viewer-placeholder">
        <p>No document selected</p>
      </div>
    );
  }

  if (adobeError) {
    return (
      <div className="pdf-viewer-error">
        <p>{adobeError}</p>
        <button onClick={() => window.location.reload()}>Refresh Page</button>
      </div>
    );
  }

  return (
    <div className="pdf-viewer-container">
      <div
        ref={viewerRef}
        id="adobe-dc-view"
        className="pdf-viewer"
        style={{ width: '100%', height: '100vh' }}
      />
      
      {showPopup && (
        <div 
          className="text-selection-popup"
          style={{
            position: 'fixed',
            left: popupPosition.x - 150,
            top: popupPosition.y,
            width: '300px',
            backgroundColor: '#fff',
            border: '2px solid #007bff',
            borderRadius: '8px',
            padding: '15px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            zIndex: 10000,
            maxHeight: '200px',
            overflow: 'auto'
          }}
        >
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'flex-start',
            marginBottom: '10px'
          }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#333', fontSize: '14px' }}>
              Selected Text:
            </h4>
            <button
              onClick={closePopup}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '18px',
                cursor: 'pointer',
                color: '#666',
                padding: '0',
                width: '20px',
                height: '20px'
              }}
            >
              ×
            </button>
          </div>
          <p style={{ 
            margin: '0', 
            fontSize: '12px', 
            lineHeight: '1.4',
            color: '#555',
            wordWrap: 'break-word'
          }}>
            {selectedText}
          </p>
        </div>
      )}
    </div>
  );
};

export default PDFViewer;
