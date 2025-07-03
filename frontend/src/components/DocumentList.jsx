import { useState, useEffect } from 'react';
import { documentAPI, orgAPI } from '../api';
import { Document, Page, pdfjs } from 'react-pdf';
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js`;

const API_BASE = 'http://localhost:8000';

const DocumentList = ({ organizationId, authToken }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [showPreview, setShowPreview] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [userRole, setUserRole] = useState(null);
  const [deletingDoc, setDeletingDoc] = useState(null);

  useEffect(() => {
    loadDocuments();
    loadUserRole();
  }, [organizationId]);

  const loadUserRole = async () => {
    try {
      const roleData = await orgAPI.getUserRole(organizationId, authToken);
      setUserRole(roleData.role);
    } catch (error) {
      console.error('Failed to load user role:', error);
    }
  };

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const docs = await documentAPI.list(organizationId, authToken);
      setDocuments(docs);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDocument = async (docId) => {
    if (!confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingDoc(docId);
      await documentAPI.delete(docId, authToken);
      // Reload documents after successful deletion
      await loadDocuments();
    } catch (error) {
      setError(error.message);
    } finally {
      setDeletingDoc(null);
    }
  };

  if (loading) {
    return (
      <div className="dark-card p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-github-primary mx-auto mb-4"></div>
          <p className="text-sm text-github-text-secondary">Loading documents...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dark-card p-6">
        <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-md text-red-300 text-sm">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="dark-card p-6">
      <h3 className="text-lg font-semibold mb-6">Your organization's documents</h3>
      
      {documents.length === 0 ? (
        <div className="text-center text-github-text-muted py-8">
          <svg className="w-8 h-8 mx-auto mb-3 text-github-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          <p className="text-sm">No documents uploaded yet</p>
          <p className="text-xs text-github-text-muted">Upload your first document to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map(doc => {
            // Use the actual filename from the backend with absolute URL and auth token
            const filename = doc.file_url ? doc.file_url.split('/').pop() : '';
            const fileUrl = `${API_BASE}/papers/${organizationId}/file/${filename}?token=${encodeURIComponent(authToken)}`;
            return (
              <div key={doc.id} className="dark-card p-4 hover:bg-github-bg-tertiary transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-github-text mb-1">{doc.title}</h4>
                    <p className="text-xs text-github-text-secondary">Uploaded by {doc.uploaded_by}</p>
                    <p className="text-xs text-github-text-muted">
                      {new Date(doc.uploaded_at).toLocaleDateString()}
                    </p>
                    <button
                      className="mt-2 github-button-secondary text-xs px-2 py-1"
                      onClick={() => setShowPreview(showPreview === doc.id ? null : doc.id)}
                    >
                      {showPreview === doc.id ? 'Hide Preview' : 'Preview PDF'}
                    </button>
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 github-button text-xs px-2 py-1"
                      download
                    >
                      Download PDF
                    </a>
                    {(userRole === 'org_admin' || userRole === 'member') && (
                      <button
                        onClick={() => handleDeleteDocument(doc.id)}
                        disabled={deletingDoc === doc.id}
                        className="ml-2 bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-1 rounded disabled:opacity-50"
                      >
                        {deletingDoc === doc.id ? 'Deleting...' : 'Delete'}
                      </button>
                    )}
                  </div>
                </div>
                {showPreview === doc.id && (
                  <div className="mt-4 border rounded bg-github-bg-tertiary p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          disabled={currentPage <= 1}
                          className="github-button-secondary text-xs px-2 py-1 disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <span className="text-sm text-github-text-secondary">
                          Page {currentPage} of {numPages || '?'}
                        </span>
                        <button
                          onClick={() => setCurrentPage(Math.min(numPages || 1, currentPage + 1))}
                          disabled={currentPage >= (numPages || 1)}
                          className="github-button-secondary text-xs px-2 py-1 disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
                          className="github-button-secondary text-xs px-2 py-1 flex items-center"
                          title="Zoom Out"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"></path>
                          </svg>
                        </button>
                        <span className="text-sm text-github-text-secondary min-w-[60px] text-center">
                          {Math.round(zoom * 100)}%
                        </span>
                        <button
                          onClick={() => setZoom(Math.min(3, zoom + 0.25))}
                          className="github-button-secondary text-xs px-2 py-1 flex items-center"
                          title="Zoom In"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"></path>
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="w-full overflow-hidden">
                      <div className="w-full max-w-full">
                        <Document
                          file={fileUrl}
                          onLoadSuccess={({ numPages }) => {
                            setNumPages(numPages);
                            setCurrentPage(1);
                          }}
                          loading={
                            <div className="flex items-center justify-center p-8">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-github-primary"></div>
                              <span className="ml-2 text-github-text-secondary">Loading PDF...</span>
                            </div>
                          }
                          error={
                            <div className="text-center p-8 text-red-400">
                              Failed to load PDF. Please try downloading instead.
                            </div>
                          }
                        >
                          <Page 
                            pageNumber={currentPage} 
                            width={Math.min(800, window.innerWidth - 100)}
                            scale={zoom}
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
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DocumentList; 