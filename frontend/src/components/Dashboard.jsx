import { useState, useEffect } from 'react';
import ChatInterface from './ChatInterface';
import DocumentUpload from './DocumentUpload';
import DocumentList from './DocumentList';
import MemberRequests from './MemberRequests';
import ProfileManager from './ProfileManager';
import { orgAPI } from '../api';

const Dashboard = ({ user, authToken, onLogout, onViewOrgSearch, onProfileUpdate }) => {
  const [activeView, setActiveView] = useState('chat'); // 'chat', 'upload', 'documents', 'settings'
  const [userOrganizations, setUserOrganizations] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showOrgDropdown, setShowOrgDropdown] = useState(false);
  const [showDocDropdown, setShowDocDropdown] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  useEffect(() => {
    loadUserOrganizations();
  }, []);

  const loadUserOrganizations = async () => {
    try {
      const orgs = await orgAPI.getUserOrganizations(authToken);
      setUserOrganizations(orgs || []);
      if (orgs && orgs.length > 0) {
        setSelectedOrg(orgs[0].organization.id);
      }
    } catch (error) {
      console.error('Failed to load organizations:', error);
      setUserOrganizations([]);
    } finally {
      setLoading(false);
    }
  };

  const isOrgAdmin = () => {
    return userOrganizations.some(org => 
      org.organization.id === selectedOrg && org.role === 'org_admin'
    );
  };

  const handleOrganizationChange = (orgId) => {
    setSelectedOrg(orgId);
    setShowOrgDropdown(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-rich-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-apple-blue mx-auto mb-4"></div>
          <p className="text-sm text-silver-lake-blue">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Show message if user has no organizations
  if (userOrganizations.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="dark-header">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-github-accent rounded-md flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-github-text">Alexandria</h1>
                  <p className="text-xs text-github-text-muted">AI-powered document analysis</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-silver-lake-blue">
                  Welcome, {user.name || user.email}
                </span>
                <button 
                  onClick={onLogout}
                  className="text-sm text-silver-lake-blue hover:text-platinum transition-colors"
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
              <div className="dark-card p-8">
                <div className="w-16 h-16 bg-gradient-to-br from-github-accent to-github-accent-hover rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold mb-4 text-platinum">
                  Welcome to Alexandria!
                </h2>
                <p className="text-silver-lake-blue mb-6 max-w-md mx-auto">
                  To get started, you need to join an existing organization or create a new one. 
                  Organizations help you collaborate with others and manage your documents.
                </p>
                <button 
                  onClick={onViewOrgSearch}
                  className="apple-button px-6 py-3 text-base"
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
      {/* Header with Navigation */}
      <header className="dark-header relative z-[9999]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-gradient-to-br from-apple-blue to-apple-blue-hover rounded-lg flex items-center justify-center shadow-lg">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-platinum">Alexandria</h1>
                <p className="text-xs text-yinmn-blue">AI-powered document analysis</p>
              </div>
            </div>
            
            {/* Navigation Tabs */}
            <div className="flex items-center space-x-8">
              {/* AI Assistant Tab */}
              <button 
                onClick={() => setActiveView('chat')}
                className={`text-sm font-medium transition-colors ${
                  activeView === 'chat' 
                    ? 'text-platinum border-b-2 border-apple-blue pb-1' 
                    : 'text-silver-lake-blue hover:text-platinum'
                }`}
              >
                AI Assistant
              </button>
              
              {/* Organizations Tab */}
              <div className="relative">
                <button 
                  onClick={() => {
                    setShowOrgDropdown(!showOrgDropdown);
                    setShowDocDropdown(false);
                    setShowProfileDropdown(false);
                  }}
                  className={`text-sm font-medium transition-colors flex items-center space-x-1 ${
                    showOrgDropdown 
                      ? 'text-platinum border-b-2 border-apple-blue pb-1' 
                      : 'text-silver-lake-blue hover:text-platinum'
                  }`}
                >
                  <span>Organizations</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                  </svg>
                </button>
                {showOrgDropdown && (
                  <div className="absolute top-full right-0 mt-2 w-64 bg-oxford-blue border border-silver-lake-blue rounded-xl shadow-xl z-50 backdrop-blur-xl">
                    <div className="px-4 py-3 border-b border-silver-lake-blue">
                      <p className="text-xs text-yinmn-blue font-medium">Current Organization</p>
                      <p className="text-sm text-platinum font-semibold mt-1">
                        {userOrganizations.find(org => org.organization.id === selectedOrg)?.organization.name}
                      </p>
                    </div>
                    <button 
                      onClick={() => {
                        setShowOrgDropdown(false);
                        onViewOrgSearch();
                      }}
                      className="w-full text-left px-4 py-3 text-sm text-platinum hover:bg-yinmn-blue transition-all duration-200"
                    >
                      <div className="font-medium">Find Organizations</div>
                      <div className="text-xs text-yinmn-blue mt-1">Join or create new organizations</div>
                    </button>
                    {isOrgAdmin() && (
                      <button 
                        onClick={() => {
                          setShowOrgDropdown(false);
                          setActiveView('manage-org');
                        }}
                        className="w-full text-left px-4 py-3 text-sm text-platinum hover:bg-yinmn-blue transition-all duration-200"
                      >
                        <div className="font-medium">Manage Organizations</div>
                        <div className="text-xs text-yinmn-blue mt-1">Approve requests & manage members</div>
                      </button>
                    )}
                    {userOrganizations.length > 1 && (
                      <>
                        <div className="border-t border-silver-lake-blue"></div>
                        <div className="px-4 py-2">
                          <p className="text-xs text-yinmn-blue font-medium">Switch Organization</p>
                        </div>
                        {userOrganizations.map(org => (
                          <button
                            key={org.organization.id}
                            onClick={() => handleOrganizationChange(org.organization.id)}
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
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Documents Tab */}
              <div className="relative">
                <button 
                  onClick={() => {
                    setShowDocDropdown(!showDocDropdown);
                    setShowOrgDropdown(false);
                    setShowProfileDropdown(false);
                  }}
                  className={`text-sm font-medium transition-colors flex items-center space-x-1 ${
                    showDocDropdown 
                      ? 'text-platinum border-b-2 border-apple-blue pb-1' 
                      : 'text-silver-lake-blue hover:text-platinum'
                  }`}
                >
                  <span>Documents</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                  </svg>
                </button>
                {showDocDropdown && (
                  <div className="absolute top-full right-0 mt-2 w-48 bg-oxford-blue border border-silver-lake-blue rounded-xl shadow-xl z-50 backdrop-blur-xl">
                    <button 
                      onClick={() => {
                        setShowDocDropdown(false);
                        setActiveView('upload');
                      }}
                      className="w-full text-left px-4 py-3 text-sm text-platinum hover:bg-yinmn-blue transition-all duration-200"
                    >
                      <div className="font-medium">Upload Documents</div>
                      <div className="text-xs text-yinmn-blue mt-1">Add new files to your organization</div>
                    </button>
                    <button 
                      onClick={() => {
                        setShowDocDropdown(false);
                        setActiveView('documents');
                      }}
                      className="w-full text-left px-4 py-3 text-sm text-platinum hover:bg-yinmn-blue transition-all duration-200"
                    >
                      <div className="font-medium">View Documents</div>
                      <div className="text-xs text-yinmn-blue mt-1">Browse and manage your files</div>
                    </button>
                  </div>
                )}
              </div>

              {/* Profile Dropdown */}
              <div className="relative">
                <button 
                  onClick={() => {
                    setShowProfileDropdown(!showProfileDropdown);
                    setShowOrgDropdown(false);
                    setShowDocDropdown(false);
                  }}
                  className="flex items-center space-x-2 text-silver-lake-blue hover:text-platinum transition-colors"
                >
                  {user.profile_image_url ? (
                    <img
                      src={user.profile_image_url}
                      alt="Profile"
                      className="w-8 h-8 rounded-full object-cover border-2 border-github-border"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-gradient-to-br from-apple-blue to-apple-blue-hover rounded-full flex items-center justify-center border-2 border-silver-lake-blue">
                      <span className="text-sm font-semibold text-white">
                        {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                  </svg>
                </button>
                {showProfileDropdown && (
                  <div className="absolute top-full right-0 mt-2 w-48 bg-oxford-blue border border-silver-lake-blue rounded-xl shadow-xl z-50 backdrop-blur-xl">
                    <div className="px-4 py-3 border-b border-silver-lake-blue">
                      <p className="text-sm text-platinum font-semibold">
                        {user.name || user.email}
                      </p>
                      <p className="text-xs text-yinmn-blue mt-1">Signed in</p>
                    </div>
                    <button 
                      onClick={() => {
                        setShowProfileDropdown(false);
                        setActiveView('profile');
                      }}
                      className="w-full text-left px-4 py-3 text-sm text-platinum hover:bg-yinmn-blue transition-all duration-200"
                    >
                      <div className="font-medium">Manage Profile</div>
                      <div className="text-xs text-yinmn-blue mt-1">Update your information</div>
                    </button>
                    <button 
                      onClick={() => {
                        setShowProfileDropdown(false);
                        setActiveView('settings');
                      }}
                      className="w-full text-left px-4 py-3 text-sm text-platinum hover:bg-yinmn-blue transition-all duration-200"
                    >
                      <div className="font-medium">Settings</div>
                      <div className="text-xs text-yinmn-blue mt-1">Preferences and configuration</div>
                    </button>
                    <div className="border-t border-silver-lake-blue"></div>
                    <button 
                      onClick={() => {
                        setShowProfileDropdown(false);
                        onLogout();
                      }}
                      className="w-full text-left px-4 py-3 text-sm text-apple-danger hover:text-apple-danger-hover hover:bg-apple-danger/10 transition-all duration-200"
                    >
                      <div className="font-medium">Sign Out</div>
                      <div className="text-xs text-yinmn-blue mt-1">End your session</div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {activeView === 'chat' && selectedOrg && (
          <div style={{ height: 'calc(100vh - 80px)' }}>
            <ChatInterface 
              organizationId={selectedOrg}
              authToken={authToken}
              userOrganizations={userOrganizations}
              selectedOrg={selectedOrg}
              onOrganizationChange={handleOrganizationChange}
            />
          </div>
        )}
        
        {activeView === 'upload' && selectedOrg && (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <DocumentUpload 
              organizationId={selectedOrg}
              authToken={authToken}
              onUploadComplete={loadUserOrganizations}
            />
          </div>
        )}
        
        {activeView === 'documents' && selectedOrg && (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <DocumentList 
              organizationId={selectedOrg}
              authToken={authToken}
            />
          </div>
        )}
        
        {activeView === 'settings' && (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="dark-card p-6">
              <h3 className="text-lg font-semibold mb-6">Settings</h3>
              <p className="text-silver-lake-blue">Settings page coming soon...</p>
            </div>
          </div>
        )}
        
        {activeView === 'profile' && (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <ProfileManager 
              user={user}
              authToken={authToken}
              onProfileUpdate={onProfileUpdate}
            />
          </div>
        )}
        
        {activeView === 'manage-org' && selectedOrg && (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <MemberRequests 
              organizationId={selectedOrg}
              authToken={authToken}
            />
          </div>
        )}
      </main>

      {/* Click outside to close dropdowns */}
      {(showOrgDropdown || showDocDropdown || showProfileDropdown) && (
        <div 
          className="fixed inset-0 z-[9998]" 
          onClick={(e) => {
            // Only close if clicking on the overlay itself, not on dropdown content
            if (e.target === e.currentTarget) {
              setShowOrgDropdown(false);
              setShowDocDropdown(false);
              setShowProfileDropdown(false);
            }
          }}
        />
      )}
    </div>
  );
};

export default Dashboard; 