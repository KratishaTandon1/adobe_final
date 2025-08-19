import React, { useEffect, useRef, useState } from 'react';

const PDFViewer = ({ document: pdfDocument, onTextSelection, targetPage, onPageChange }) => {
  const viewerRef = useRef(null);
  const adobeDCViewRef = useRef(null);
  const [isAdobeLoaded, setIsAdobeLoaded] = useState(false);
  const [adobeError, setAdobeError] = useState(null);
  const [selectedText, setSelectedText] = useState('');

  useEffect(() => {
    console.log("🚀 PDFViewer useEffect triggered!");
    console.log("📋 pdfDocument:", pdfDocument);
    console.log("🎯 viewerRef.current:", viewerRef.current);
    
    if (!pdfDocument || !viewerRef.current) {
      return;
    }

    console.log("✅ Both pdfDocument and viewerRef are available, proceeding with Adobe PDF setup");
    
    // Adobe PDF Embed API Client ID
    const CLIENT_ID = process.env.REACT_APP_ADOBE_EMBED_API_KEY;
    if(!CLIENT_ID) {
      CLIENT_ID = 'ae5952821dde49729000b1970f609305'; // Fallback for local testing
    }
    // Simple initialization without complex SDK loading
    async function initializePDFViewer() {
      try {
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

        // Check if Adobe SDK is available, if not, load it simply
        if (!window.AdobeDC) {
          console.log("📥 Adobe SDK not found, loading...");
          await loadAdobeSDKSimple();
        }
        
        console.log("🎯 Adobe DC SDK ready, initializing viewer...");

        try {
          // Create Adobe DC View instance with better error handling
          console.log(CLIENT_ID);
          adobeDCViewRef.current = new window.AdobeDC.View({
            clientId: CLIENT_ID,
            divId: viewerRef.current.id,
            reportSuiteId: null // Disable analytics to avoid some WASM issues
          });

          console.log("📄 Adobe DC View created, loading PDF...");

          // Configure and preview the PDF
          const previewFilePromise = adobeDCViewRef.current.previewFile({
            content: { location: { url: pdfDocument.file_url } },
            metaData: { fileName: pdfDocument.original_name }
          }, {
            embedMode: "FULL_WINDOW",
            showDownloadPDF: true,
            showPrintPDF: true,
            showLeftHandPanel: true,
            showAnnotationTools: false, // Disable to reduce WASM load
            enableSearchAPIs: true,
            includePDFAnnotations: false, // Disable to reduce WASM load
            enableFormFilling: false, // Disable to reduce WASM load
            showSharePDF: false,
            showZoomControl: true,
            defaultViewMode: "FIT_PAGE",
            showBookmarks: true,
            showThumbnails: true,
            enableLinearization: false, // Disable to reduce WASM issues
            enablePDFAnalytics: false,
            dockPageControls: false,
            // Additional WASM optimization settings
            enableAnnotationAPIs: false,
            enableFormAPIs: false,
            enableCommentAPIs: false,
            disableI18N: true // Disable internationalization to reduce load
          });

        // Setup text selection detection
        previewFilePromise.then(adobeViewer => {
          console.log("✅ Adobe viewer ready and PDF loaded");
          
          // Navigate to target page if specified
          if (targetPage && targetPage > 0) {
            console.log(`🧭 Navigating to target page: ${targetPage}`);
            setTimeout(() => {
              try {
                adobeViewer.getAPIs().then(apis => {
                  if (apis.gotoLocation) {
                    apis.gotoLocation(targetPage).then(() => {
                      console.log(`✅ Successfully navigated to page ${targetPage}`);
                      // Update the page tracking after successful navigation
                      if (onPageChange) {
                        onPageChange(targetPage);
                        console.log(`📄 Updated current page to: ${targetPage}`);
                      }
                    }).catch(err => {
                      console.warn(`⚠️ Failed to navigate to page ${targetPage}:`, err);
                    });
                  } else {
                    console.warn("⚠️ gotoLocation API not available");
                  }
                });
              } catch (err) {
                console.warn(`⚠️ Error navigating to page ${targetPage}:`, err);
              }
            }, 300); // Reduced delay for faster navigation
          } else {
            // If no target page, default to page 1
            if (onPageChange) {
              onPageChange(1);
              console.log(`📄 No target page, defaulting to page 1`);
            }
          }
          
          adobeViewer.getAPIs().then(apis => {
            console.log("📚 Adobe APIs available");
            
            // Set up page change tracking with multiple methods
            const setupPageTracking = () => {
              console.log("🔧 Setting up page tracking...");
              
              if (apis.getCurrentPage && onPageChange) {
                // Method 1: Get initial page
                apis.getCurrentPage().then(page => {
                  console.log(`📄 Initial page from getCurrentPage: ${page}`);
                  if (page && page > 0) {
                    onPageChange(page);
                  }
                }).catch(err => {
                  console.warn("⚠️ getCurrentPage failed:", err);
                });
                
                // Method 2: Set up periodic page checking
                const pageCheckInterval = setInterval(() => {
                  if (apis.getCurrentPage) {
                    apis.getCurrentPage().then(page => {
                      console.log(`🔍 Periodic page check: ${page}`);
                      if (page && page > 0) { 
                        onPageChange(page);
                      }
                    }).catch(() => {
                      // Silently handle errors in periodic checks
                    });
                  }
                }, 1500); // Check every 1.5 seconds - faster response
                
                // Store interval reference for cleanup
                window.pageCheckInterval = pageCheckInterval;
              } else {
                console.warn("⚠️ getCurrentPage API not available, page tracking disabled");
                // Default to page 1 if no API available
                if (onPageChange) {
                  onPageChange(1);
                }
              }
              
              // Method 3: Listen for page changes (if supported)
              if (apis.registerCallback) {
                try {
                  apis.registerCallback('PAGE_VIEW', (data) => {
                    console.log(`📄 Page change callback data:`, data);
                    if (data && data.page && onPageChange) {
                      console.log(`📄 Page changed via callback to: ${data.page}`);
                      onPageChange(data.page);
                    }
                  });
                } catch (err) {
                  console.warn("⚠️ Could not register page change callback:", err);
                }
              }
              
              // Method 4: Alternative event listening
              try {
                if (apis.addEventListener) {
                  apis.addEventListener('PAGE_VIEW', (event) => {
                    console.log(`📄 Page view event:`, event);
                    if (event && event.page && onPageChange) {
                      console.log(`📄 Page changed via event to: ${event.page}`);
                      onPageChange(event.page);
                    }
                  });
                }
              } catch (err) {
                console.warn("⚠️ Could not add page event listener:", err);
              }
            };
            
            // Set up page tracking after a small delay
            setTimeout(setupPageTracking, 500); // Reduced from 1000ms for faster response
            
            if (apis.getSelectedContent) {
              setupTextSelection(apis);
            } else {
              console.warn("⚠️ Adobe selection APIs not available, using fallback");
              setupFallbackTextSelection();
            }
          }).catch(error => {
            console.warn("❌ Error getting Adobe APIs:", error);
            console.log("🔄 Setting up fallback text selection");
            setupFallbackTextSelection();
          });
        }).catch(error => {
          console.error("❌ Error with preview file promise:", error);
          console.error("❌ Error details:", error.message, error.stack);
          
          // Enhanced WASM error detection and handling
          const errorMessage = error.message || error.toString();
          let userFriendlyMessage = "";
          
          if (errorMessage.includes('wasm') || errorMessage.includes('WebAssembly') || 
              errorMessage.includes('placeholder function') || errorMessage.includes('instantiated deferred module') ||
              errorMessage.includes('acrobat_we') || errorMessage.includes('deferred module')) {
            userFriendlyMessage = `PDF loading failed due to WebAssembly (WASM) module issues. This can happen due to:

• Browser security settings blocking WASM
• Network connectivity issues
• Browser compatibility problems
• Ad blockers or security extensions

Solutions to try:
1. Refresh the page (F5)
2. Try a different browser (Chrome, Firefox, Edge)
3. Disable ad blockers temporarily
4. Check if your browser supports WASM
5. Clear browser cache and cookies

Technical Error: ${errorMessage}`;
          } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('network')) {
            userFriendlyMessage = `PDF loading failed due to network issues. Please check your internet connection and try again.

Technical Error: ${errorMessage}`;
          } else if (errorMessage.includes('404') || errorMessage.includes('not found')) {
            userFriendlyMessage = `PDF file not found. The document may have been moved or deleted.

Technical Error: ${errorMessage}`;
          } else {
            userFriendlyMessage = `Failed to load PDF viewer. Please try refreshing the page.

Technical Error: ${errorMessage}`;
          }
          
          setAdobeError(userFriendlyMessage);
        });

        setIsAdobeLoaded(true);
        setAdobeError(null);

        } catch (innerError) {
          console.error('❌ Error creating Adobe viewer or loading PDF:', innerError);
          throw innerError; // Re-throw to be caught by outer try-catch
        }

      } catch (error) {
        console.error('❌ Error initializing Adobe PDF viewer:', error);
        setAdobeError(`Error loading PDF viewer: ${error.message}. Please try refreshing the page.`);
        setIsAdobeLoaded(false);
      }
    }

    // Simplified Adobe SDK loading
    function loadAdobeSDKSimple() {
      return new Promise((resolve, reject) => {
        // Check if already being loaded
        if (window.adobeSDKLoading) {
          console.log("⏳ Adobe SDK already loading, waiting...");
          const checkInterval = setInterval(() => {
            if (window.AdobeDC) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 200);
          setTimeout(() => {
            clearInterval(checkInterval);
            if (!window.AdobeDC) {
              reject(new Error('Adobe SDK loading timeout'));
            }
          }, 15000);
          return;
        }

        window.adobeSDKLoading = true;
        console.log("� Loading Adobe SDK script...");

        const script = document.createElement('script');
        script.src = 'https://documentservices.adobe.com/view-sdk/viewer.js';
        script.async = true;
        script.crossOrigin = 'anonymous'; // Help with CORS issues
        
        script.onload = () => {
          console.log("📦 Adobe SDK script loaded");
          
          // Wait for AdobeDC to be available
          let attempts = 0;
          const checkAdobeDC = () => {
            attempts++;
            if (window.AdobeDC) {
              console.log("✅ Adobe SDK ready!");
              window.adobeSDKLoading = false;
              resolve();
            } else if (attempts < 30) {
              setTimeout(checkAdobeDC, 500);
            } else {
              window.adobeSDKLoading = false;
              reject(new Error('Adobe SDK failed to initialize'));
            }
          };
          checkAdobeDC();
        };
        
        script.onerror = () => {
          window.adobeSDKLoading = false;
          reject(new Error('Failed to load Adobe SDK'));
        };
        
        document.head.appendChild(script);
      });
    }

    // Setup text selection detection
    function setupTextSelection(apis) {
      console.log("🎯 Setting up text selection detection");
      console.log("📋 Available APIs:", Object.keys(apis));
      
      if (!apis.getSelectedContent) {
        console.warn("⚠️ getSelectedContent API not available");
        return;
      }
      
      let lastSelectedText = '';
      let selectionCheckCount = 0;
      let hasLoggedSelection = false;
      
      const checkSelection = () => {
        selectionCheckCount++;
        if (selectionCheckCount % 25 === 0) { // Log every 5 seconds (25 * 200ms)
          console.log("🔄 Adobe API text selection check running...", selectionCheckCount);
        }
        
        apis.getSelectedContent().then(selection => {
          // Log the raw selection object occasionally for debugging
          if (selection && !hasLoggedSelection) {
            console.log("🔍 Raw selection object:", selection);
            hasLoggedSelection = true;
          }
          
          let text = '';
          
          // Handle different Adobe selection data structures
          if (selection) {
            // Check if selection has direct data property (as seen in your logs)
            if (selection.type === 'text' && selection.data) {
              text = selection.data;
              console.log("� Found text in selection.data:", text);
            }
            // Check if selection has data array
            else if (selection.data && Array.isArray(selection.data) && selection.data.length > 0) {
              const textData = selection.data[0];
              console.log("🔍 Selection data structure:", textData);
              
              if (typeof textData === 'string') {
                text = textData;
              } else if (textData.text) {
                text = textData.text;
              } else if (textData.content) {
                text = textData.content;
              } else if (textData.data) {
                text = textData.data;
              }
            }
            // Check if selection.data is directly a string
            else if (selection.data && typeof selection.data === 'string') {
              text = selection.data;
            }
          }
          
          console.log("📝 Final extracted text:", text);
          
          if (text && text.trim() && text !== lastSelectedText) {
            console.log("📝 Adobe API - New text selected:", text.substring(0, 50) + "...");
            console.log("📊 Full selection object:", selection);
            lastSelectedText = text;
            showTextInPanel(text);
          } else if (!text || !text.trim()) {
            // Check if there was previous text that got deselected
            if (lastSelectedText) {
              console.log("📝 Adobe API - Text deselected");
              lastSelectedText = '';
              setSelectedText('');
              // Clear the panel as well
              showTextInPanel('');
            }
          }
        }).catch(error => {
          // Log errors occasionally for debugging
          if (selectionCheckCount % 100 === 0) { // Every 20 seconds
            console.log("📝 Adobe API selection error (periodic log):", error.message);
          }
        });
      };
      
      // More frequent checking initially
      const selectionInterval = setInterval(checkSelection, 1000);
      console.log("✅ Adobe API text selection monitoring started (every 1000ms)");

      // Store interval reference for cleanup (if needed later)
      window.selectionInterval = selectionInterval;
      
      // Also try to enable text selection explicitly
      if (apis.enableTextSelection) {
        console.log("🔧 Enabling text selection explicitly");
        try {
          apis.enableTextSelection(true);
        } catch (error) {
          console.warn("⚠️ Could not enable text selection:", error);
        }
      }
      
      // Still enable fallback but with a delay
      setTimeout(() => {
        console.log("🔄 Enabling fallback text selection as backup");
        setupFallbackTextSelection();
      }, 3000);
    }

    // Fallback text selection using browser selection API (focused on PDF container)
    function setupFallbackTextSelection() {
      console.log("🎯 Setting up fallback text selection detection");
      console.log("⚠️ Note: Browser selection may not work with Adobe PDF iframe");
      
      let lastSelectedText = '';
      let fallbackCheckCount = 0;
      
      const checkBrowserSelection = () => {
        fallbackCheckCount++;
        if (fallbackCheckCount % 10 === 0) { // Log every 3 seconds (10 * 300ms)
          console.log("🔄 Fallback text selection check running...", fallbackCheckCount);
        }
        
        // Try to get selection from main document
        const selection = window.getSelection();
        if (selection && selection.toString().trim()) {
          const selectedText = selection.toString().trim();
          if (selectedText && selectedText !== lastSelectedText) {
            console.log("📝 Browser text selected (outside PDF):", selectedText.substring(0, 50) + "...");
            lastSelectedText = selectedText;
            // Only show in panel if it looks like meaningful content
            if (selectedText.length > 5) {
              showTextInPanel(selectedText);
            }
          }
        } else {
          // Only clear if we actually had text before
          if (lastSelectedText) {
            console.log("📝 Browser text deselected");
            lastSelectedText = '';
            setSelectedText('');
            // Clear the panel as well
            showTextInPanel('');
          }
        }
      };
      
      // Add mouse up event listener to PDF container specifically
      const handleMouseUp = (e) => {
        console.log("🖱️ Mouse up detected in PDF area, checking selection...");
        setTimeout(checkBrowserSelection, 100);
      };
      
      const handleKeyUp = (e) => {
        // Check on Shift+Arrow keys (common for text selection)
        if (e.shiftKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
          console.log("⌨️ Keyboard selection detected, checking...");
          setTimeout(checkBrowserSelection, 100);
        }
      };
      
      // Focus events on PDF container
      if (viewerRef.current) {
        viewerRef.current.addEventListener('mouseup', handleMouseUp);
        console.log("📍 Added mouse events to PDF container");
      }
      
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('keyup', handleKeyUp);
      
      // Reduced frequency for fallback since it mainly works outside PDF
      const fallbackInterval = setInterval(checkBrowserSelection, 800);
      console.log("✅ Fallback text selection monitoring started (limited effectiveness for PDF iframe)");
      
      window.fallbackSelectionInterval = fallbackInterval;
    }

    function showTextInPanel(text) {
      if (text && text.length > 0) {
        console.log("📝 Showing text in panel:", text.substring(0, 50) + "...");
        console.log("📝 Full text being passed:", text);
        console.log("📝 Text length:", text.length);
      } else {
        console.log("📝 Clearing panel - empty text");
      }
      console.log("📝 onTextSelection callback exists:", !!onTextSelection);
      setSelectedText(text);
      if (onTextSelection) {
        console.log("📝 Calling onTextSelection callback...");
        onTextSelection(text);
      }
    }

    // Start initialization
    initializePDFViewer();
    
    // Cleanup function
    return () => {
      // Clear page check interval if it exists
      if (window.pageCheckInterval) {
        clearInterval(window.pageCheckInterval);
        window.pageCheckInterval = null;
        console.log("🧹 Cleared page check interval");
      }
    };
    
  }, [pdfDocument]);

  if (adobeError) {
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center', 
        background: '#fff3cd',
        border: '2px solid #ffc107',
        borderRadius: '8px',
        margin: '20px',
        maxWidth: '800px',
        margin: '0 auto'
      }}>
        <div style={{ 
          color: '#856404', 
          marginBottom: '15px',
          fontSize: '18px',
          fontWeight: 'bold'
        }}>
          ⚠️ PDF Loading Error
        </div>
        <div style={{ 
          marginBottom: '20px',
          color: '#856404',
          lineHeight: '1.5',
          whiteSpace: 'pre-line',
          textAlign: 'left',
          background: '#fff',
          padding: '15px',
          borderRadius: '6px',
          border: '1px solid #ffeaa7'
        }}>
          {adobeError}
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button 
            onClick={() => {
              setAdobeError(null);
              window.location.reload();
            }}
            style={{
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            🔄 Refresh Page
          </button>
          <button 
            onClick={() => {
              setAdobeError(null);
              // Try to reinitialize
              console.log("🔄 Attempting to reinitialize PDF viewer...");
            }}
            style={{
              padding: '10px 20px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            🔧 Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!pdfDocument) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Please select a PDF to view.</p>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div 
        ref={viewerRef} 
        id="adobe-dc-view" 
        style={{ 
          width: '100%', 
          height: '100%',
          border: '1px solid #ddd',
          borderRadius: '4px'
        }}
      />
      
      {!isAdobeLoaded && !adobeError && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center'
        }}>
          <div>Loading PDF viewer...</div>
        </div>
      )}
    </div>
  );
};

export default PDFViewer;
