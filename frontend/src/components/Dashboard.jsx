import { useState, useEffect } from 'react';
import QueryForm from './QueryForm';
import DocumentUpload from './DocumentUpload';
import DocumentList from './DocumentList';
import MemberRequests from './MemberRequests';
import { orgAPI } from '../api';

const Dashboard = ({ user, authToken, onLogout, onViewOrgSearch }) => {
  const [activeTab, setActiveTab] = useState('query');
  const [userOrganizations, setUserOrganizations] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserOrganizations();
  }, []);

  const loadUserOrganizations = async () => {
    try {
      const orgs = await orgAPI.getUserOrganizations(authToken);
      setUserOrganizations(orgs);
      if (orgs.length > 0) {
        setSelectedOrg(orgs[0].organization.id);
      }
    } catch (error) {
      console.error('Failed to load organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const isOrgAdmin = () => {
    return userOrganizations.some(org => 
      org.organization.id === selectedOrg && org.role === 'org_admin'
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-github-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-github-primary mx-auto mb-4"></div>
          <p className="text-sm text-github-text-secondary">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Show message if user has no organizations
  if (userOrganizations.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="border-b border-github-border bg-github-bg-secondary">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-github-accent rounded-md flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-github-text">PaperQA</h1>
                  <p className="text-xs text-github-text-muted">AI-powered document analysis</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-github-text-secondary">
                  Welcome, {user.name || user.email}
                </span>
                <button 
                  onClick={onLogout}
                  className="text-sm text-github-text-secondary hover:text-github-text transition-colors"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="text-center">
              <div className="github-card p-8">
                <div className="w-16 h-16 bg-github-primary rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold mb-4 text-github-text">
                  Welcome to PaperQA!
                </h2>
                <p className="text-github-text-secondary mb-6 max-w-md mx-auto">
                  To get started, you need to join an existing organization or create a new one. 
                  Organizations help you collaborate with others and manage your documents.
                </p>
                <button 
                  onClick={onViewOrgSearch}
                  className="github-button px-6 py-3 text-base"
                >
                  Find Organizations
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-github-border bg-github-bg-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-github-accent rounded-md flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-github-text">PaperQA</h1>
                <p className="text-xs text-github-text-muted">AI-powered document analysis</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-github-text-secondary">
                Welcome, {user.name || user.email}
              </span>
              <button 
                onClick={onLogout}
                className="text-sm text-github-text-secondary hover:text-github-text transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Organization Selector */}
          {userOrganizations.length > 0 && (
            <div className="github-card p-6 mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold mb-2">Current Organization</h2>
                  <select 
                    value={selectedOrg || ''} 
                    onChange={(e) => setSelectedOrg(e.target.value)}
                    className="github-input px-3 py-2 text-sm"
                  >
                    {userOrganizations.map(org => (
                      <option key={org.organization.id} value={org.organization.id}>
                        {org.organization.name} ({org.role})
                      </option>
                    ))}
                  </select>
                </div>
                <button 
                  onClick={onViewOrgSearch}
                  className="github-button-secondary px-4 py-2 text-sm"
                >
                  Find Organizations
                </button>
              </div>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="border-b border-github-border mb-8">
            <div className="flex space-x-8">
              <button 
                className={`github-tab py-3 px-1 text-sm font-medium ${activeTab === 'query' ? 'active' : ''}`}
                onClick={() => setActiveTab('query')}
              >
                Query documents
              </button>
              <button 
                className={`github-tab py-3 px-1 text-sm font-medium ${activeTab === 'upload' ? 'active' : ''}`}
                onClick={() => setActiveTab('upload')}
              >
                Upload documents
              </button>
              <button 
                className={`github-tab py-3 px-1 text-sm font-medium ${activeTab === 'documents' ? 'active' : ''}`}
                onClick={() => setActiveTab('documents')}
              >
                View documents
              </button>
              {isOrgAdmin() && (
                <button 
                  className={`github-tab py-3 px-1 text-sm font-medium ${activeTab === 'members' ? 'active' : ''}`}
                  onClick={() => setActiveTab('members')}
                >
                  Manage members
                </button>
              )}
            </div>
          </div>

          {/* Tab Content */}
          <div className="space-y-8">
            {activeTab === 'query' && selectedOrg && (
              <QueryForm 
                organizationId={selectedOrg}
                authToken={authToken}
              />
            )}
            
            {activeTab === 'upload' && selectedOrg && (
              <DocumentUpload 
                organizationId={selectedOrg}
                authToken={authToken}
                onUploadComplete={loadUserOrganizations}
              />
            )}
            
            {activeTab === 'documents' && selectedOrg && (
              <DocumentList 
                organizationId={selectedOrg}
                authToken={authToken}
              />
            )}
            
            {activeTab === 'members' && selectedOrg && isOrgAdmin() && (
              <MemberRequests 
                organizationId={selectedOrg}
                authToken={authToken}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard; 