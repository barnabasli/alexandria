import { useState, useEffect } from 'react';
import { documentAPI } from '../api';

const DocumentList = ({ organizationId, authToken }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDocuments();
  }, [organizationId]);

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

  if (loading) {
    return (
      <div className="github-card p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-github-primary mx-auto mb-4"></div>
          <p className="text-sm text-github-text-secondary">Loading documents...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="github-card p-6">
        <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-md text-red-300 text-sm">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="github-card p-6">
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
          {documents.map(doc => (
            <div key={doc.id} className="github-card p-4 hover:bg-github-bg-tertiary transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-github-text mb-1">{doc.title}</h4>
                  <p className="text-xs text-github-text-secondary">Uploaded by {doc.uploaded_by}</p>
                  <p className="text-xs text-github-text-muted">
                    {new Date(doc.uploaded_at).toLocaleDateString()}
                  </p>
                </div>
                <svg className="w-5 h-5 text-github-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DocumentList; 