import { useState, useEffect } from 'react';
import { orgAPI } from '../api';

const OrgSearch = ({ user, authToken, onBack }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (searchQuery.trim()) {
      searchOrganizations();
    } else {
      setOrganizations([]);
    }
  }, [searchQuery]);

  const searchOrganizations = async () => {
    try {
      setLoading(true);
      setError('');
      const results = await orgAPI.search(searchQuery, authToken);
      setOrganizations(results);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRequest = async (orgId) => {
    try {
      await orgAPI.join(orgId, authToken);
      setSuccess('Request to join organization submitted successfully!');
      await searchOrganizations();
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-github-border bg-github-bg-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-github-accent rounded-md flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-github-text">Find Organizations</h1>
                <p className="text-xs text-github-text-muted">Search and join organizations</p>
              </div>
            </div>
            <button 
              onClick={onBack}
              className="text-sm text-github-text-secondary hover:text-github-text transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="github-card p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">Search Organizations</h2>
            <div className="flex space-x-4">
              <input
                type="text"
                placeholder="Search by organization name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="github-input flex-1 px-3 py-2 text-sm"
              />
              <button
                onClick={searchOrganizations}
                disabled={loading || !searchQuery.trim()}
                className="github-button px-4 py-2 text-sm disabled:opacity-50"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>

          {organizations.length > 0 && (
            <div className="github-card p-6">
              <h3 className="text-lg font-semibold mb-6">Search Results</h3>
              <div className="space-y-4">
                {organizations.map(org => (
                  <div key={org.id} className="github-card p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-github-text mb-1">{org.name}</h4>
                        <div className="flex items-center space-x-4 text-xs text-github-text-secondary">
                          <span>{org.member_count} members</span>
                          <span>Created {new Date(org.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="ml-4">
                        {org.is_member ? (
                          <span className="text-sm text-github-text-secondary">
                            {org.membership_status === 'approved' ? 'Already a member' : 
                             org.membership_status === 'pending' ? 'Request pending' : 
                             'Request denied'}
                          </span>
                        ) : (
                          <button
                            onClick={() => handleJoinRequest(org.id)}
                            className="github-button px-4 py-2 text-sm"
                          >
                            Request to Join
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 rounded-md text-red-300 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-4 p-3 bg-green-900/20 border border-green-500/30 rounded-md text-green-300 text-sm">
              {success}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default OrgSearch; 