import React, { useEffect, useRef, useState } from 'react';

const PDFViewer = ({ document: pdfDocument }) => {
  const viewerRef = useRef(null);
  const adobeDCViewRef = useRef(null);
  const [isAdobeLoaded, setIsAdobeLoaded] = useState(false);
  const [adobeError, setAdobeError] = useState(null);
  const [selectedText, setSelectedText] = useState('');
  const [showPopup, setShowPopup] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const selectionTimerRef = useRef(null);

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

      // Check if Adobe SDK is already available
      if (window.AdobeDC) {
        initializePDFViewer();
      } else {
        loadAdobeSDK();
      }
    }

    function loadAdobeSDK() {
      // Check if script is already being loaded or exists
      const existingScript = document.querySelector('script[src*="documentservices.adobe.com"]');
      if (existingScript) {
        // Script exists, wait for Adobe to be available
        setTimeout(() => {
          if (window.AdobeDC) {
            initializePDFViewer();
          } else {
            // Wait longer and try again
            setTimeout(initializePDFViewer, 1000);
          }
        }, 500);
        return;
      }

      // Create and load new script
      const script = document.createElement('script');
      script.src = 'https://documentservices.adobe.com/view-sdk/viewer.js';
      script.async = true;
      script.onload = () => {
        // Wait a bit after script load for Adobe to initialize
        setTimeout(initializePDFViewer, 500);
      };
      script.onerror = handleAdobeError;
      
      // Add to head
      document.head.appendChild(script);
    }

    function handleAdobeError(error) {
      console.error('Failed to load Adobe PDF SDK:', error);
      setAdobeError('Failed to load Adobe PDF viewer. Please refresh the page.');
      setIsAdobeLoaded(false);
    }

    function initializePDFViewer() {
      // Retry mechanism for Adobe SDK availability
      const maxRetries = 10;
      let retryCount = 0;

      function attemptInitialization() {
        try {
          if (!window.AdobeDC) {
            retryCount++;
            if (retryCount < maxRetries) {
              // Wait a bit longer and retry
              setTimeout(attemptInitialization, 200);
              return;
            } else {
              throw new Error('Adobe DC SDK failed to load after multiple attempts');
            }
          }

          if (!viewerRef.current) {
            return;
          }

          // Clear the container
          viewerRef.current.innerHTML = '';
          
          // Create Adobe DC View instance with error handling
          adobeDCViewRef.current = new window.AdobeDC.View({
            clientId: CLIENT_ID,
            divId: viewerRef.current.id,
          });

          // Configure and preview the PDF with all controls visible
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

          // Setup Adobe's text selection API
          console.log("🔄 Setting up Adobe text selection API...");
          previewFilePromise.then(adobeViewer => {
            console.log("✅ Adobe viewer ready, trying to get APIs...");
            console.log("🔍 adobeViewer object:", adobeViewer);
            
            // Try to get Adobe APIs for text selection
            if (adobeViewer && typeof adobeViewer.getAPIs === 'function') {
              console.log("📞 Calling adobeViewer.getAPIs()...");
              adobeViewer.getAPIs().then(apis => {
                console.log("📚 Adobe APIs available:", Object.keys(apis));
                
                if (apis.getSelectedContent) {
                  console.log("🎯 Found getSelectedContent API, setting up simple text selection");
                  setupSimpleTextSelection(apis);
                } else {
                  console.log("⚠️ getSelectedContent API not available");
                }
              }).catch(error => {
                console.warn("❌ Error getting Adobe APIs:", error);
              });
            } else {
              console.log("⚠️ adobeViewer.getAPIs is not a function or adobeViewer is null");
            }
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

      // Start the initialization attempt
      attemptInitialization();
    }

    // Setup text selection monitoring using DOM events
    function setupTextSelectionMonitoring() {
      console.log("🔧 Setting up text selection monitoring...");
      
      // Wait a bit for Adobe viewer to fully render
      setTimeout(() => {
        console.log("⏰ Adobe viewer render delay complete, attaching event listeners...");
        const pdfContainer = viewerRef.current;
        
        if (pdfContainer) {
          console.log("✅ PDF container found, adding event listeners");
          
          // Add event listeners for text selection
          pdfContainer.addEventListener('mouseup', handleMouseUp);
          pdfContainer.addEventListener('keyup', handleKeyUp);
          
          // Monitor selection changes
          document.addEventListener('selectionchange', handleSelectionChange);
          
          console.log("🎧 Event listeners attached: mouseup, keyup, selectionchange");
        } else {
          console.warn("⚠️ PDF container not found!");
        }
      }, 2000);
    }

    // Setup Adobe's native text selection API
    function setupAdobeTextSelection(apis) {
      console.log("🚀 Setting up Adobe native text selection API");
      console.log("🔍 Available APIs:", Object.keys(apis));
      console.log("📞 getSelectedContent function:", typeof apis.getSelectedContent);
      
      let pollCount = 0;
      let lastSelectedText = '';
      
      // Poll for text selection using Adobe's API
      const checkSelection = () => {
        pollCount++;
        if (pollCount % 10 === 1) { // Log every 10th poll (every 5 seconds)
          console.log(`🔄 Polling for selection... (poll #${pollCount})`);
        }
        
        try {
          const selectionPromise = apis.getSelectedContent();
          if (pollCount % 10 === 1) {
            console.log("🎯 getSelectedContent() called, promise:", selectionPromise);
          }
          
          selectionPromise.then(selectedContent => {
            if (pollCount % 10 === 1) {
              console.log("📄 Selection response:", selectedContent);
            }
            
            if (selectedContent && selectedContent.data) {
              let text = '';
              
              // Handle different response formats from Adobe API
              if (typeof selectedContent.data === 'string') {
                // Data is already a string
                text = selectedContent.data.trim();
                console.log("📝 String format detected:", text);
              } else if (Array.isArray(selectedContent.data) && selectedContent.data.length > 0) {
                // Data is an array of objects
                text = selectedContent.data.map(item => item.text || '').join(' ').trim();
                console.log("📝 Array format detected:", text);
              }
              
              if (text) {
                console.log("✅ Adobe API detected selected text:", text);
                console.log("📊 Selection data structure:", selectedContent);
                // Store the text for when it gets deselected
                lastSelectedText = text;
              } else {
                // Text was deselected - show popup after delay
                if (lastSelectedText) {
                  console.log("❌ Text deselected, starting popup timer");
                  console.log("💾 Last selected text was:", lastSelectedText);
                  handleTextSelection({ selectedText: lastSelectedText });
                  lastSelectedText = ''; // Clear after using
                } else {
                  if (pollCount % 10 === 1) {
                    console.log("📭 No text selected and no previous text stored");
                  }
                }
              }
            }
          }).catch(error => {
            if (pollCount % 20 === 1) { // Log errors less frequently
              console.log("⚠️ Selection check error (expected when no text selected):", error);
            }
          });
        } catch (error) {
          console.error("❌ Error calling getSelectedContent:", error);
        }
      };
      
      // Check for selection every 500ms
      const selectionInterval = setInterval(checkSelection, 500);
      
      // Store interval for cleanup
      window.adobeSelectionInterval = selectionInterval;
      
      console.log("⏰ Adobe text selection polling started (500ms intervals)");
      console.log("📋 First poll will happen in 500ms...");
    }

    // Setup iframe-based text selection detection
    function setupIframeTextSelection() {
      console.log("🔧 Setting up iframe-based text selection detection");
      
      const checkIframeSelection = () => {
        try {
          // Find the Adobe iframe
          const iframe = viewerRef.current?.querySelector('iframe');
          if (iframe) {
            console.log("🖼️ Found Adobe iframe, attempting to access content");
            
            try {
              const iframeDocument = iframe.contentDocument || iframe.contentWindow?.document;
              if (iframeDocument) {
                const selection = iframeDocument.getSelection();
                const selectedText = selection.toString().trim();
                
                if (selectedText) {
                  console.log("✅ Iframe selection detected:", selectedText);
                  handleTextSelection({ selectedText });
                }
              }
            } catch (crossOriginError) {
              console.log("🔒 Cross-origin iframe detected (expected for Adobe)");
            }
          }
          
          // Also check main document selection as fallback
          const mainSelection = window.getSelection();
          const mainSelectedText = mainSelection.toString().trim();
          if (mainSelectedText) {
            console.log("✅ Main document selection detected:", mainSelectedText);
            handleTextSelection({ selectedText: mainSelectedText });
          }
          
        } catch (error) {
          console.warn("⚠️ Error in iframe selection check:", error);
        }
      };
      
      // Add event listeners to main document and try to access iframe
      const handleGlobalMouseUp = () => {
        console.log("🖱️ Global mouse up detected - checking selections");
        setTimeout(checkIframeSelection, 200);
      };
      
      const handleGlobalKeyUp = () => {
        console.log("⌨️ Global key up detected - checking selections");
        setTimeout(checkIframeSelection, 200);
      };
      
      const handleGlobalSelectionChange = () => {
        console.log("📝 Global selection change detected - checking selections");
        setTimeout(checkIframeSelection, 200);
      };
      
      // Remove existing listeners first
      document.removeEventListener('mouseup', window.globalMouseUpHandler);
      document.removeEventListener('keyup', window.globalKeyUpHandler);
      document.removeEventListener('selectionchange', window.globalSelectionChangeHandler);
      
      // Add new listeners
      document.addEventListener('mouseup', handleGlobalMouseUp);
      document.addEventListener('keyup', handleGlobalKeyUp);
      document.addEventListener('selectionchange', handleGlobalSelectionChange);
      
      // Store for cleanup
      window.globalMouseUpHandler = handleGlobalMouseUp;
      window.globalKeyUpHandler = handleGlobalKeyUp;
      window.globalSelectionChangeHandler = handleGlobalSelectionChange;
      
      console.log("🎧 Global event listeners attached for iframe text selection");
    }

    // Handle mouse up event (potential text selection)
    function handleMouseUp(event) {
      console.log("🖱️ Mouse up event detected");
      setTimeout(() => {
        checkForTextSelection("mouseup");
      }, 100);
    }

    // Handle key up event (keyboard selection)
    function handleKeyUp(event) {
      console.log("⌨️ Key up event detected:", event.key);
      setTimeout(() => {
        checkForTextSelection("keyup");
      }, 100);
    }

    // Handle selection change event
    function handleSelectionChange() {
      console.log("📝 Selection change event detected");
      setTimeout(() => {
        checkForTextSelection("selectionchange");
      }, 100);
    }

    // Check for text selection
    function checkForTextSelection(eventType) {
      console.log(`🔍 Checking for text selection (triggered by: ${eventType})`);
      
      const selection = window.getSelection();
      console.log("📋 Selection object:", selection);
      
      const selectedText = selection.toString().trim();
      console.log("📝 Selected text:", selectedText ? `"${selectedText}"` : "No text selected");
      console.log("📏 Selected text length:", selectedText.length);
      
      if (selectedText) {
        console.log("✅ Text found! Calling handleTextSelection...");
        handleTextSelection({ selectedText });
      } else {
        console.log("❌ No text selected");
      }
    }

    // Handle text selection with 2-second delay
    function handleTextSelection(textSelectionData) {
      console.log("🎯 handleTextSelection called with data:", textSelectionData);
      
      // Clear any existing timer
      if (selectionTimerRef.current) {
        console.log("⏰ Clearing existing timer");
        clearTimeout(selectionTimerRef.current);
      }

      // Hide popup immediately when selection changes
      console.log("🔲 Hiding popup (if visible)");
      setShowPopup(false);

      // If there's selected text, start the 1-second timer
      if (textSelectionData && textSelectionData.selectedText && textSelectionData.selectedText.trim()) {
        const text = textSelectionData.selectedText.trim();
        console.log(`⏳ Starting 1-second timer for text: "${text}"`);
        
        selectionTimerRef.current = setTimeout(() => {
          console.log("🎉 1-second timer completed! Showing popup...");
          
          if (text) {
            setSelectedText(text);
            
            // Get mouse position for popup (approximate)
            const rect = viewerRef.current.getBoundingClientRect();
            const position = {
              x: rect.left + rect.width / 2,
              y: rect.top + 100
            };
            
            console.log("📍 Popup position:", position);
            setPopupPosition(position);
            setShowPopup(true);
            
            console.log("✅ Popup should now be visible!");
          } else {
            console.warn("⚠️ Text became empty during timer");
          }
        }, 1000); // 1 second delay
        
        console.log("⏰ Timer set with ID:", selectionTimerRef.current);
      } else {
        console.log("❌ No valid text selection data provided");
      }
    }

    // Cleanup function
    return () => {
      console.log("🧹 Cleaning up PDFViewer...");
      
      if (selectionTimerRef.current) {
        console.log("⏰ Clearing selection timer");
        clearTimeout(selectionTimerRef.current);
      }
      
      // Clean up Adobe API interval
      if (window.adobeSelectionInterval) {
        console.log("🔄 Clearing Adobe selection interval");
        clearInterval(window.adobeSelectionInterval);
        window.adobeSelectionInterval = null;
      }
      
      // Clean up global event listeners
      if (window.globalMouseUpHandler) {
        document.removeEventListener('mouseup', window.globalMouseUpHandler);
        window.globalMouseUpHandler = null;
      }
      if (window.globalKeyUpHandler) {
        document.removeEventListener('keyup', window.globalKeyUpHandler);
        window.globalKeyUpHandler = null;
      }
      if (window.globalSelectionChangeHandler) {
        document.removeEventListener('selectionchange', window.globalSelectionChangeHandler);
        window.globalSelectionChangeHandler = null;
      }
      
      // Clean up legacy event listeners
      const pdfContainer = viewerRef.current;
      if (pdfContainer) {
        pdfContainer.removeEventListener('mouseup', handleMouseUp);
        pdfContainer.removeEventListener('keyup', handleKeyUp);
      }
      document.removeEventListener('selectionchange', handleSelectionChange);
      
      if (adobeDCViewRef.current) {
        try {
          adobeDCViewRef.current = null;
        } catch (error) {
          console.log('Cleanup error:', error);
        }
      }
    };
  }, [pdfDocument]);

  // Close popup when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (showPopup && !event.target.closest('.text-selection-popup')) {
        closePopup();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPopup]);

  // Close popup function
  const closePopup = () => {
    setShowPopup(false);
    setSelectedText('');
    if (selectionTimerRef.current) {
      clearTimeout(selectionTimerRef.current);
      selectionTimerRef.current = null;
    }
  };

  if (!pdfDocument) {
    return (
      <div className="pdf-viewer-placeholder">
        <p>No document selected</p>
      </div>
    );
  }

  return (
    <div className="pdf-viewer-container">
      <div className="pdf-header">
        <h3>📄 {pdfDocument.original_name}</h3>
        <div className="pdf-actions">
          <a 
            href={pdfDocument.file_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="action-btn"
          >
            📥 Download
          </a>
          <a 
            href={pdfDocument.file_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="action-btn"
          >
            🔗 Open in New Tab
          </a>
          <button 
            onClick={() => window.location.reload()} 
            className="action-btn refresh-btn"
            title="Refresh if PDF doesn't load"
          >
            🔄 Refresh
          </button>
        </div>
      </div>
      
      {/* Loading State */}
      {!isAdobeLoaded && !adobeError && (
        <div className="pdf-loading">
          <div className="loading-spinner"></div>
          <p>Loading Adobe PDF Viewer...</p>
        </div>
      )}

      {/* Error State */}
      {adobeError && (
        <div className="pdf-error">
          <div className="error-icon">⚠️</div>
          <h3>PDF Viewer Error</h3>
          <p>{adobeError}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="error-retry-btn"
          >
            🔄 Retry
          </button>
        </div>
      )}

      {/* Adobe PDF Viewer */}
      <div 
        ref={viewerRef}
        id={`adobe-dc-view-${pdfDocument.id}`}
        className="adobe-pdf-viewer"
        style={{ display: isAdobeLoaded && !adobeError ? 'block' : 'none' }}
      />
      
      <div className="viewer-info">
        <p>🎯 Powered by Adobe PDF Embed API - Professional PDF viewing with advanced features</p>
        <p>💡 Select text and wait 2 seconds to see it in a popup</p>
      </div>

      {/* Text Selection Popup */}
      {showPopup && selectedText && (
        <div 
          className="text-selection-popup"
          style={{
            position: 'fixed',
            left: popupPosition.x,
            top: popupPosition.y,
            transform: 'translate(-50%, -100%)',
            zIndex: 1000
          }}
        >
          <div className="popup-header">
            <h4>📝 Selected Text</h4>
            <button onClick={closePopup} className="popup-close">✕</button>
          </div>
          <div className="popup-content">
            <p>{selectedText}</p>
          </div>
          <div className="popup-actions">
            <button onClick={() => navigator.clipboard.writeText(selectedText)} className="popup-btn copy-btn">
              📋 Copy
            </button>
            <button onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(selectedText)}`, '_blank')} className="popup-btn search-btn">
              🔍 Search
            </button>
            <button onClick={closePopup} className="popup-btn close-btn">
              ✕ Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PDFViewer;
