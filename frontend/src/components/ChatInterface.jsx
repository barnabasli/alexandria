import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Activity } from 'lucide-react';
import { documentAPI } from '../api';
import './ChatInterface.css';

// Import react-pdf properly
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Set PDF.js worker source
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js`;
}

const API_BASE = 'http://localhost:8000';

// Thinking animation component
const Thinking = () => (
  <div className="flex items-center space-x-1">
    <div className="flex space-x-1">
      <div className="w-1 h-1 bg-silver-lake-blue rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
      <div className="w-1 h-1 bg-silver-lake-blue rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
      <div className="w-1 h-1 bg-silver-lake-blue rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
    </div>
  </div>
);

const ChatInterface = ({ organizationId, authToken, userOrganizations, selectedOrg, onOrganizationChange }) => {
  // Chat history state with localStorage persistence
  const [chatHistory, setChatHistory] = useState(() => {
    const saved = localStorage.getItem(`chatHistory_${organizationId}`);
    console.log('Loading chat history from localStorage:', saved);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Convert timestamp strings back to Date objects
      return parsed.map(message => ({
        ...message,
        timestamp: new Date(message.timestamp)
      }));
    }
    return [{
      id: "1",
      text: "Hello, I'm Alexandria! I'm here to help you answer questions and extract meaningful insights from your organization's data. Ask me anything to get started.",
      isBot: true,
      timestamp: new Date(),
    }];
  });
  
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentMessage, setCurrentMessage] = useState(null);
  const [previewSource, setPreviewSource] = useState(null);
  const [pdfStates, setPdfStates] = useState({}); // Store PDF state per source URL
  const [sourceDetails, setSourceDetails] = useState({});
  const [showOrgDropdown, setShowOrgDropdown] = useState(false);
  const messagesEndRef = useRef(null);

  // Save chat history to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(`chatHistory_${organizationId}`, JSON.stringify(chatHistory));
  }, [chatHistory, organizationId]);

  // Clear source details cache when organization changes
  useEffect(() => {
    setSourceDetails({});
    setCurrentMessage(null);
  }, [organizationId]);

  // Auto-scroll to bottom when chat history updates
  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, currentMessage]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      // Clean up any blob URLs when component unmounts
      Object.keys(pdfStates).forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [pdfStates]);

  // Fetch source details when sources change
  useEffect(() => {
    const fetchSourceDetails = async () => {
      if (!currentMessage?.sources) return;
      
      console.log('Fetching source details for:', currentMessage.sources);
      const details = {};
      for (const source of currentMessage.sources) {
        try {
          const filename = source.split('/').pop();
          console.log('Fetching info for filename:', filename);
          const response = await fetch(`${API_BASE}/papers/${organizationId}/sources/${filename}/info`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
          });
          if (response.ok) {
            const data = await response.json();
            console.log('Source details received:', data);
            details[source] = data;
          } else {
            console.error('Failed to fetch source details for', filename, 'Status:', response.status);
            // Add fallback data so the UI still works
            details[source] = {
              title: filename,
              citation_format: `Document: ${filename}`,
              vector_info: {}
            };
          }
        } catch (error) {
          console.error('Error fetching source details:', error);
          // Add fallback data so the UI still works
          const filename = source.split('/').pop();
          details[source] = {
            title: filename,
            citation_format: `Document: ${filename}`,
            vector_info: {}
          };
        }
      }
      setSourceDetails(details);
    };

    fetchSourceDetails();
  }, [currentMessage?.sources, organizationId, authToken]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const formatTimestamp = (timestamp) => {
    if (timestamp instanceof Date) {
      return timestamp.toLocaleTimeString();
    }
    if (typeof timestamp === 'string') {
      try {
        return new Date(timestamp).toLocaleTimeString();
      } catch (error) {
        return 'Unknown time';
      }
    }
    return 'Unknown time';
  };

  const formatAnswer = (text) => {
    // Remove any "References" section that might be generated
    const referencesIndex = text.toLowerCase().indexOf('references');
    if (referencesIndex !== -1) {
      text = text.substring(0, referencesIndex).trim();
    }
    
    // Remove numbered references at the end (like "1. (horisberger2025...")
    const numberedRefIndex = text.search(/\d+\.\s*\([^)]+\):/);
    if (numberedRefIndex !== -1) {
      text = text.substring(0, numberedRefIndex).trim();
    }
    
    // Split into paragraphs and format with clickable citations
    const paragraphs = text.split('\n\n').filter(p => p.trim());
    return (
      <>
        {paragraphs.map((paragraph, index) => (
          <p key={index}>
            {formatCitationsInText(paragraph)}
          </p>
        ))}
      </>
    );
  };

  const formatCitationsInText = (text) => {
    // Find citation patterns like (horisberger2025bloodimmunophenotypingidentifies pages 11-13)
    // But exclude short abbreviations like (LN), (DNA), etc.
    const citationRegex = /\(([^)]{10,})\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    
    while ((match = citationRegex.exec(text)) !== null) {
      const citation = match[1];
      
      // Skip if it's a short abbreviation (likely not a citation)
      if (citation.length < 10 || /^[A-Z]{2,4}$/.test(citation)) {
        continue;
      }
      
      // Check if it looks like a citation (contains year and pages)
      if (!citation.match(/\d{4}.*pages?\s*\d+/i)) {
        continue;
      }
      
      // Add text before citation
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      
      // Extract author, year, and pages for Chicago style formatting
      const authorMatch = citation.match(/^([a-zA-Z]+)\d{4}/);
      const yearMatch = citation.match(/\d{4}/);
      const pagesMatch = citation.match(/pages?\s*(\d+(?:-\d+)?)/i);
      
      let displayText = citation; // fallback
      
      if (authorMatch && yearMatch) {
        const authorName = authorMatch[1];
        const year = yearMatch[0];
        const pages = pagesMatch ? pagesMatch[1] : '';
        
        // Capitalize author name properly
        const capitalizedAuthor = authorName.charAt(0).toUpperCase() + authorName.slice(1).toLowerCase();
        
        if (pages) {
          // Handle single page vs page range
          if (pages.includes('-')) {
            const [startPage, endPage] = pages.split('-');
            if (startPage === endPage) {
              displayText = `${capitalizedAuthor} (${year}, p. ${startPage})`;
            } else {
              displayText = `${capitalizedAuthor} (${year}, p. ${pages})`;
            }
          } else {
            displayText = `${capitalizedAuthor} (${year}, p. ${pages})`;
          }
        } else {
          displayText = `${capitalizedAuthor} (${year})`;
        }
      }
      
      parts.push(
        <span 
          key={match.index}
          className="citation-link"
          onClick={() => handleCitationClick(citation)}
          title="Click to view source"
        >
          {displayText}
        </span>
      );
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    
    return parts.length > 0 ? parts : text;
  };

  const handleCitationClick = (citation) => {
    // Find the corresponding source and open it
    const sourcesToUse = currentMessage?.enhancedSources && currentMessage.enhancedSources.length > 0 
      ? currentMessage.enhancedSources 
      : currentMessage?.sources || [];
    
    // Extract author name from citation (e.g., "revach" from "revach2025...")
    const authorMatch = citation.match(/^([a-zA-Z]+)\d{4}/);
    const authorName = authorMatch ? authorMatch[1].toLowerCase() : '';
    
    console.log('Citation clicked:', citation);
    console.log('Author name extracted:', authorName);
    console.log('Available sources:', sourcesToUse);
    console.log('Source details:', sourceDetails);
    
    // Try to match citation to source using multiple strategies
    let source = null;
    
    // Strategy 1: Direct author name match in title
    source = sourcesToUse.find(s => {
      const sourceTitle = (s.title || s.citation || '').toLowerCase();
      const sourceDetail = sourceDetails[s.url];
      const detailTitle = (sourceDetail?.title || '').toLowerCase();
      
      return sourceTitle.includes(authorName) || detailTitle.includes(authorName);
    });
    
    // Strategy 2: If no direct match, try to find by citation pattern
    if (!source && authorName) {
      source = sourcesToUse.find(s => {
        const sourceTitle = (s.title || s.citation || '').toLowerCase();
        // Look for patterns like "Author (2025)" or "Author et al. (2025)"
        const citationPattern = new RegExp(`${authorName}\\s*\\(\\d{4}\\)`, 'i');
        return citationPattern.test(sourceTitle);
      });
    }
    
    // Strategy 3: If still no match, try to find by filename
    if (!source && authorName) {
      source = sourcesToUse.find(s => {
        const filename = s.url.split('/').pop().toLowerCase();
        return filename.includes(authorName);
      });
    }
    
    // Strategy 4: Fallback to first source if no match found
    if (!source && sourcesToUse.length > 0) {
      console.log('No specific match found, using first available source');
      source = sourcesToUse[0];
    }
    
    if (source) {
      console.log('Selected source:', source);
      // Convert relative URL to absolute URL if needed and add auth token
      const baseUrl = source.url.startsWith('http') ? source.url : `${API_BASE}${source.url}`;
      const sourceUrl = `${baseUrl}?token=${encodeURIComponent(authToken)}`;
      
      // Open the document in a new tab
      window.open(sourceUrl, '_blank');
      
      // Also scroll to the sources section and highlight
      const sourcesSection = document.querySelector('.sources-section');
      if (sourcesSection) {
        sourcesSection.scrollIntoView({ behavior: 'smooth' });
        // Highlight the specific source
        setTimeout(() => {
          const sourceItems = document.querySelectorAll('.source-item');
          sourceItems.forEach(item => item.classList.remove('highlighted'));
          const targetItem = Array.from(sourceItems).find(item => 
            item.textContent.toLowerCase().includes(authorName) ||
            item.textContent.toLowerCase().includes(source.title?.toLowerCase() || '')
          );
          if (targetItem) {
            targetItem.classList.add('highlighted');
            setTimeout(() => targetItem.classList.remove('highlighted'), 2000);
          }
        }, 500);
      }
    } else {
      console.log('No source found for citation:', citation);
    }
  };

  const getUniqueSources = (sources) => {
    if (!sources || !Array.isArray(sources)) return [];
    
    const uniqueMap = new Map();
    sources.forEach(source => {
      if (typeof source === 'string') {
        // Handle string URLs
        if (!uniqueMap.has(source)) {
          uniqueMap.set(source, {
            url: source,
            title: source.split('/').pop(),
            citation: `Document: ${source.split('/').pop()}`
          });
        }
      } else if (source.url) {
        // Handle object with URL and metadata
        if (!uniqueMap.has(source.url)) {
          uniqueMap.set(source.url, source);
        }
      }
    });
    
    return Array.from(uniqueMap.values());
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || !organizationId || !authToken) return;

    const userInput = input.trim();
    setInput("");
    setIsLoading(true);
    setError('');

    // Add user message to chat history
    const userMessage = {
      id: Date.now().toString(),
      text: userInput,
      isBot: false,
      timestamp: new Date(),
    };
    setChatHistory(prev => [...prev, userMessage]);

    // Add assistant message placeholder
    const assistantMessage = {
      id: (Date.now() + 1).toString(),
      text: '',
      isBot: true,
      timestamp: new Date(),
      isStreaming: true,
      sources: [],
      enhancedSources: []
    };
    setChatHistory(prev => [...prev, assistantMessage]);
    setCurrentMessage(assistantMessage);

    try {
      let fullAnswer = '';
      let finalSources = [];
      let finalEnhancedSources = [];

      console.log('Starting streaming query...');
      await documentAPI.streamingQuery(userInput, organizationId, authToken, (data) => {
        console.log('Received streaming data:', data);
        if (data.answer) {
          // Handle thinking indicator
          if (data.thinking) {
            // Replace the current text with thinking indicator
            setCurrentMessage(prev => ({
              ...prev,
              text: data.answer,
              isThinking: true
            }));
            // Also update the chat history
            setChatHistory(prev => {
              const newHistory = [...prev];
              newHistory[newHistory.length - 1] = {
                ...newHistory[newHistory.length - 1],
                text: data.answer,
                isThinking: true
              };
              return newHistory;
            });
          } else {
            // Regular answer text - always append, never replace
            fullAnswer += data.answer;
            setCurrentMessage(prev => ({
              ...prev,
              text: fullAnswer,
              isThinking: false,
              insufficient_info: data.insufficient_info || false
            }));
            setChatHistory(prev => {
              const newHistory = [...prev];
              newHistory[newHistory.length - 1] = {
                ...newHistory[newHistory.length - 1],
                text: fullAnswer,
                isThinking: false,
                insufficient_info: data.insufficient_info || false
              };
              return newHistory;
            });
          }
        }
        if (data.sources && !data.insufficient_info) {
          console.log('Received sources:', data.sources);
          finalSources = data.sources;
          setCurrentMessage(prev => ({
            ...prev,
            sources: data.sources
          }));
          // Update chat history with sources
          setChatHistory(prev => {
            const newHistory = [...prev];
            newHistory[newHistory.length - 1] = {
              ...newHistory[newHistory.length - 1],
              sources: data.sources
            };
            return newHistory;
          });
        }
        if (data.enhanced_sources && !data.insufficient_info) {
          console.log('Received enhanced sources:', data.enhanced_sources);
          console.log('Enhanced sources details:', JSON.stringify(data.enhanced_sources, null, 2));
          finalEnhancedSources = data.enhanced_sources;
          setCurrentMessage(prev => ({
            ...prev,
            enhancedSources: data.enhanced_sources
          }));
          // Update chat history with enhanced sources
          setChatHistory(prev => {
            const newHistory = [...prev];
            newHistory[newHistory.length - 1] = {
              ...newHistory[newHistory.length - 1],
              enhancedSources: data.enhanced_sources
            };
            return newHistory;
          });
        }
      });

      // Finalize the message
      setCurrentMessage(prev => ({
        ...prev,
        isStreaming: false
      }));
      
      // Update the chat history with the final message
      setChatHistory(prev => {
        const newHistory = [...prev];
        newHistory[newHistory.length - 1] = {
          id: (Date.now() + 1).toString(),
          text: fullAnswer,
          isBot: true,
          timestamp: new Date(),
          isStreaming: false,
          sources: finalSources,
          enhancedSources: finalEnhancedSources,
          insufficient_info: currentMessage?.insufficient_info || false
        };
        return newHistory;
      });
      
      setCurrentMessage(null);
    } catch (error) {
      console.error('Error in streaming query:', error);
      setError(error.message);
      // Remove the failed assistant message
      setChatHistory(prev => prev.slice(0, -1));
      setCurrentMessage(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderMessage = (message) => {
    if (!message.isBot) {
      return (
        <div key={message.id} className="message user-message">
          <div className="message-avatar">
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-yinmn-blue to-silver-lake-blue rounded-full">
                              <svg className="w-5 h-5 text-platinum" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            </div>
          </div>
          <div className="message-content">
            <div className="message-header">
              <span className="message-sender">You</span>
              <span className="message-time">
                {formatTimestamp(message.timestamp)}
              </span>
            </div>
            <div className="message-text">
              <p>{message.text}</p>
            </div>
          </div>
        </div>
      );
    } else {
      console.log('Rendering assistant message:', message);
      // Prioritize enhanced sources, fall back to regular sources
      const sourcesToUse = message.enhancedSources && message.enhancedSources.length > 0 
        ? message.enhancedSources 
        : message.sources;
      const uniqueSources = getUniqueSources(sourcesToUse);
      console.log('Unique sources for rendering:', uniqueSources);
      console.log('Source details available:', sourceDetails);
      
      return (
        <div key={message.id} className="message bot-message">
          <div className="message-avatar">
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-apple-blue to-apple-blue-hover rounded-full">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
          </div>
          <div className="message-content">
            <div className="message-header">
              <span className="message-sender">Alexandria</span>
              <span className="message-time">
                {formatTimestamp(message.timestamp)}
              </span>
            </div>
            <div className="message-text">
              {message.isThinking ? (
                <div className="flex items-center space-x-2">
                  <span className="text-github-text-secondary">{message.text}</span>
                  <Thinking />
                </div>
              ) : message.isStreaming && !message.text ? (
                <Thinking />
              ) : (
                formatAnswer(message.text)
              )}
              {message.isStreaming && message.text && !message.isThinking && (
                <span className="inline-block w-2 h-4 bg-github-primary animate-pulse ml-1"></span>
              )}
            </div>
            {uniqueSources && uniqueSources.length > 0 && !message.insufficient_info && (
              <div className="sources-section">
                <div className="sources-title">Sources ({uniqueSources.length})</div>
                <div className="sources-list">
                  {uniqueSources.map((source, sourceIndex) => {
                    // Convert relative URL to absolute URL if needed
                    const baseUrl = source.url.startsWith('http') ? source.url : `${API_BASE}${source.url}`;
                    const sourceUrl = baseUrl;
                    const sourceDetail = sourceDetails[source.url];
                    
                    console.log('Rendering source:', {
                      sourceIndex,
                      source,
                      sourceDetail,
                      originalUrl: source.url,
                      baseUrl,
                      sourceUrl,
                      hasToken: !!authToken
                    });
                    
                    return (
                      <div key={sourceIndex} className="source-item">
                        <div className="source-header">
                          <div className="source-info">
                            <div className="source-title">
                              {source.title || sourceDetail?.title || `Document ${sourceIndex + 1}`}
                            </div>
                            <div className="source-citation">
                              {sourceDetail?.title || source.title || `Document ${sourceIndex + 1}`}
                            </div>

                          </div>
                        </div>
                        
                        <div className="source-actions">
                          <a
                            href={sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="source-button source-button-primary"
                            download
                            onClick={(e) => {
                              // Handle download with authentication
                              e.preventDefault();
                              fetch(sourceUrl, {
                                headers: {
                                  'Authorization': `Bearer ${authToken}`
                                }
                              })
                              .then(response => response.blob())
                              .then(blob => {
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = source.title || 'document.pdf';
                                document.body.appendChild(a);
                                a.click();
                                window.URL.revokeObjectURL(url);
                                document.body.removeChild(a);
                              })
                              .catch(error => {
                                console.error('Download failed:', error);
                                alert('Download failed. Please try again.');
                              });
                            }}
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                            </svg>
                            Download
                          </a>
                          <button
                            className="source-button source-button-secondary"
                            onClick={async () => {
                              if (previewSource === sourceUrl) {
                                setPreviewSource(null);
                                // Clean up object URL if it's a blob URL
                                if (sourceUrl.startsWith('blob:')) {
                                  URL.revokeObjectURL(sourceUrl);
                                }
                              } else {
                                try {
                                  console.log('Fetching PDF from:', sourceUrl);
                                  // Fetch PDF as blob with authentication
                                  const response = await fetch(sourceUrl, {
                                    headers: {
                                      'Authorization': `Bearer ${authToken}`
                                    }
                                  });
                                  
                                  console.log('Response status:', response.status);
                                  console.log('Response headers:', Object.fromEntries(response.headers.entries()));
                                  
                                  if (!response.ok) {
                                    throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
                                  }
                                  
                                  const pdfBlob = await response.blob();
                                  console.log('PDF blob size:', pdfBlob.size, 'bytes');
                                  console.log('PDF blob type:', pdfBlob.type);
                                  
                                  if (pdfBlob.size === 0) {
                                    throw new Error('PDF blob is empty');
                                  }
                                  
                                  const pdfObjectUrl = URL.createObjectURL(pdfBlob);
                                  console.log('Created object URL:', pdfObjectUrl);
                                  
                                  setPreviewSource(pdfObjectUrl);
                                  // Initialize PDF state for this source if not exists
                                  if (!pdfStates[pdfObjectUrl]) {
                                    setPdfStates(prev => ({
                                      ...prev,
                                      [pdfObjectUrl]: {
                                        numPages: null,
                                        currentPage: 1,
                                        zoom: 1,
                                        fullPage: false
                                      }
                                    }));
                                  }
                                } catch (error) {
                                  console.error('Error fetching PDF:', error);
                                  console.error('Error details:', {
                                    sourceUrl,
                                    authToken: authToken ? 'present' : 'missing',
                                    errorMessage: error.message,
                                    errorStack: error.stack
                                  });
                                  
                                  // Try to download the PDF directly as a fallback
                                  try {
                                    console.log('Attempting fallback download...');
                                    const downloadResponse = await fetch(sourceUrl, {
                                      headers: {
                                        'Authorization': `Bearer ${authToken}`
                                      }
                                    });
                                    
                                    if (downloadResponse.ok) {
                                      const blob = await downloadResponse.blob();
                                      const url = window.URL.createObjectURL(blob);
                                      const a = document.createElement('a');
                                      a.href = url;
                                      a.download = source.title || 'document.pdf';
                                      document.body.appendChild(a);
                                      a.click();
                                      window.URL.revokeObjectURL(url);
                                      document.body.removeChild(a);
                                      alert('PDF preview failed, but download was successful. The file has been downloaded to your device.');
                                    } else {
                                      alert(`Failed to load PDF: ${error.message}. Please try downloading instead.`);
                                    }
                                  } catch (downloadError) {
                                    console.error('Fallback download also failed:', downloadError);
                                    alert(`Failed to load PDF: ${error.message}. Please try downloading instead.`);
                                  }
                                }
                              }
                            }}
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                            </svg>
                            {previewSource === sourceUrl ? 'Hide' : 'Preview'}
                          </button>

                        </div>
                        
                                                {/* PDF Preview */}
                        {previewSource === sourceUrl && (
                          <div className="pdf-preview">
                            <div className="pdf-controls">
                              <div className="pdf-navigation">
                                <button
                                  onClick={() => {
                                    const currentState = pdfStates[previewSource] || {};
                                    const newPage = Math.max(1, (currentState.currentPage || 1) - 1);
                                    setPdfStates(prev => ({
                                      ...prev,
                                      [previewSource]: { ...currentState, currentPage: newPage }
                                    }));
                                  }}
                                  disabled={(pdfStates[previewSource]?.currentPage || 1) <= 1}
                                  className="pdf-control-button"
                                >
                                  Previous
                                </button>
                                <span className="pdf-page-info">
                                  Page {pdfStates[previewSource]?.currentPage || 1} of {pdfStates[previewSource]?.numPages || '?'}
                                </span>
                                <button
                                  onClick={() => {
                                    const currentState = pdfStates[previewSource] || {};
                                    const newPage = Math.min(currentState.numPages || 1, (currentState.currentPage || 1) + 1);
                                    setPdfStates(prev => ({
                                      ...prev,
                                      [previewSource]: { ...currentState, currentPage: newPage }
                                    }));
                                  }}
                                  disabled={(pdfStates[previewSource]?.currentPage || 1) >= (pdfStates[previewSource]?.numPages || 1)}
                                  className="pdf-control-button"
                                >
                                  Next
                                </button>
                              </div>
                              <div className="pdf-zoom">
                                <button
                                  onClick={() => {
                                    const currentState = pdfStates[previewSource] || {};
                                    const newZoom = Math.max(0.5, (currentState.zoom || 1) - 0.25);
                                    setPdfStates(prev => ({
                                      ...prev,
                                      [previewSource]: { ...currentState, zoom: newZoom }
                                    }));
                                  }}
                                  className="pdf-control-button"
                                  title="Zoom Out"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"></path>
                                  </svg>
                                </button>
                                <span className="pdf-zoom-level">
                                  {Math.round((pdfStates[previewSource]?.zoom || 1) * 100)}%
                                </span>
                                <button
                                  onClick={() => {
                                    const currentState = pdfStates[previewSource] || {};
                                    const newZoom = Math.min(3, (currentState.zoom || 1) + 0.25);
                                    setPdfStates(prev => ({
                                      ...prev,
                                      [previewSource]: { ...currentState, zoom: newZoom }
                                    }));
                                  }}
                                  className="pdf-control-button"
                                  title="Zoom In"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"></path>
                                  </svg>
                                </button>
                              </div>
                              <button
                                onClick={() => {
                                  const currentState = pdfStates[previewSource] || {};
                                  setPdfStates(prev => ({
                                    ...prev,
                                    [previewSource]: { ...currentState, fullPage: !currentState.fullPage }
                                  }));
                                }}
                                className="pdf-fullpage-button"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path>
                                </svg>
                                {(pdfStates[previewSource]?.fullPage || false) ? 'Exit Fullscreen' : 'Fullscreen'}
                              </button>
                            </div>
                            <div className={`${(pdfStates[previewSource]?.fullPage || false) ? 'pdf-fullpage-overlay' : ''}`}>
                              <div className={`${(pdfStates[previewSource]?.fullPage || false) ? 'pdf-fullpage-content' : 'pdf-viewer'}`}>
                                <Document
                                file={previewSource}
                                onLoadSuccess={({ numPages }) => {
                                  console.log('PDF loaded successfully, pages:', numPages);
                                  console.log('PDF source URL:', previewSource);
                                  setPdfStates(prev => ({
                                    ...prev,
                                    [previewSource]: {
                                      ...prev[previewSource],
                                      numPages,
                                      currentPage: 1
                                    }
                                  }));
                                }}
                                onLoadError={(error) => {
                                  console.error('PDF load error:', error);
                                  console.error('PDF load error details:', {
                                    sourceUrl: previewSource,
                                    errorMessage: error.message,
                                    errorStack: error.stack
                                  });
                                }}
                                loading={
                                  <div className="flex items-center justify-center p-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-github-primary"></div>
                                    <span className="ml-2 text-github-text-secondary">Loading PDF...</span>
                                  </div>
                                }
                                error={
                                  <div className="text-center p-8 text-red-400">
                                    <p>Failed to load PDF. Please try downloading instead.</p>
                                    <p className="text-xs mt-2">URL: {sourceUrl}</p>
                                  </div>
                                }
                                noData={
                                  <div className="text-center p-8 text-red-400">
                                    <p>No PDF data available. Please try downloading instead.</p>
                                  </div>
                                }
                              >
                                <Page 
                                  pageNumber={pdfStates[previewSource]?.currentPage || 1} 
                                  width={(pdfStates[previewSource]?.fullPage || false) ? undefined : Math.min(800, window.innerWidth - 100)}
                                  scale={pdfStates[previewSource]?.zoom || 1}
                                  renderTextLayer={false}
                                  renderAnnotationLayer={false}
                                  loading={
                                    <div className="flex items-center justify-center p-4">
                                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-github-primary"></div>
                                    </div>
                                  }
                                />
                                </Document>
                              </div>
                              {(pdfStates[previewSource]?.fullPage || false) && (
                                <button
                                  onClick={() => {
                                    const currentState = pdfStates[previewSource] || {};
                                    setPdfStates(prev => ({
                                      ...prev,
                                      [previewSource]: { ...currentState, fullPage: false }
                                    }));
                                  }}
                                  className="pdf-fullpage-close"
                                >
                                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }
  };

  return (
    <div className="chat-container">
      {/* Header */}
      <div className="chat-header">
        <div className="header-left">
          <div className="status-indicator"></div>
          <div className="header-text">
            <h1>Alexandria</h1>
            <p>Your AI Research Assistant</p>
          </div>
        </div>
        
        <div className="header-right">
          <div className="flex items-center space-x-4">
            {/* Organization Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setShowOrgDropdown(!showOrgDropdown)}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-oxford-blue border border-silver-lake-blue text-silver-lake-blue hover:text-platinum hover:bg-yinmn-blue transition-all duration-200"
              >
                <span className="text-sm font-medium">
                  {userOrganizations?.find(org => org.organization.id === selectedOrg)?.organization.name || 'Select Organization'}
                </span>
                <svg className={`w-4 h-4 transition-transform duration-200 ${showOrgDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </button>
              {showOrgDropdown && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-oxford-blue border border-silver-lake-blue rounded-xl shadow-xl z-[99999] backdrop-blur-xl">
                  {userOrganizations?.map(org => (
                    <button
                      key={org.organization.id}
                      onClick={() => {
                        onOrganizationChange(org.organization.id);
                        setShowOrgDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-3 text-sm transition-all duration-200 ${
                        org.organization.id === selectedOrg 
                          ? 'text-apple-blue bg-apple-blue/10 border-l-2 border-apple-blue' 
                          : 'text-platinum hover:bg-yinmn-blue hover:text-platinum'
                      }`}
                    >
                      <div className="font-medium">{org.organization.name}</div>
                      <div className="text-xs text-yinmn-blue mt-1">{org.role}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {chatHistory.length > 1 && (
              <button
                onClick={() => {
                  setChatHistory([{
                    id: "1",
                    text: "Hello, I'm Alexandria! I'm here to help you answer questions and extract meaningful insights from your organization's data. Ask me anything to get started.",
                    isBot: true,
                    timestamp: new Date(),
                  }]);
                  localStorage.removeItem(`chatHistory_${organizationId}`);
                }}
                className="text-xs px-3 py-1.5 rounded-lg bg-oxford-blue border border-silver-lake-blue text-yinmn-blue hover:text-platinum hover:bg-yinmn-blue transition-all duration-200"
                title="Clear chat history"
              >
                Clear History
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="messages-container">
        {chatHistory.map((message) => renderMessage(message))}

        {error && (
          <div className="message bot-message error-message">
            <div className="message-avatar">
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-apple-danger to-apple-danger-hover rounded-full">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </div>
            </div>
            <div className="message-content">
              <div className="message-header">
                <span className="message-sender">Error</span>
                <span className="message-time">Error occurred</span>
              </div>
              <div className="message-text">
                <p>{error}</p>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="input-container">
        <div className="input-wrapper">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask Alexandria anything..."
            className="message-input"
            disabled={isLoading}
          />
          
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="send-button"
          >
            {isLoading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
      </div>
      
      {/* Click outside to close organization dropdown */}
      {showOrgDropdown && (
        <div 
          className="fixed inset-0 z-[9998]" 
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowOrgDropdown(false);
            }
          }}
        />
      )}
    </div>
  );
};

export default ChatInterface; 