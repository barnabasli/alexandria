import { useState } from 'react';
import { documentAPI } from '../api';

const DocumentUpload = ({ organizationId, authToken, onUploadComplete }) => {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      if (!title) {
        setTitle(selectedFile.name.replace('.pdf', ''));
      }
    } else {
      setError('Please select a valid PDF file');
      setFile(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !title.trim()) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await documentAPI.upload(file, title, organizationId, authToken);
      setSuccess('Document uploaded successfully!');
      setFile(null);
      setTitle('');
      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="github-card p-6">
      <h3 className="text-lg font-semibold mb-6">Upload new documents</h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-github-text-secondary mb-2">
            Select PDF document
          </label>
          <div className="border-2 border-dashed border-github-border rounded-md p-8 text-center hover:border-github-primary transition-colors">
            <input 
              type="file" 
              id="file" 
              accept=".pdf" 
              required 
              onChange={handleFileChange}
              className="hidden"
            />
            <label htmlFor="file" className="cursor-pointer">
              <svg className="w-8 h-8 text-github-text-muted mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
              </svg>
              <p className="text-sm font-medium text-github-text mb-1">
                {file ? file.name : 'Choose a PDF file'}
              </p>
              <p className="text-xs text-github-text-muted">
                {file ? 'File selected' : 'or drag and drop here'}
              </p>
            </label>
          </div>
        </div>

        <div>
          <label htmlFor="title" className="block text-sm font-medium text-github-text-secondary mb-2">
            Document title
          </label>
          <input 
            type="text" 
            id="title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="github-input w-full px-3 py-2 text-sm"
            placeholder="Enter document title"
          />
        </div>
        
        <button 
          type="submit" 
          disabled={loading || !file}
          className="github-button w-full py-2 px-4 text-sm disabled:opacity-50"
        >
          {loading ? 'Uploading...' : 'Upload document'}
        </button>
      </form>
      
      {/* Error Display */}
      {error && (
        <div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 rounded-md text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Success Display */}
      {success && (
        <div className="mt-4 p-3 bg-green-900/20 border border-green-500/30 rounded-md text-green-300 text-sm">
          {success}
        </div>
      )}
    </div>
  );
};

export default DocumentUpload; 