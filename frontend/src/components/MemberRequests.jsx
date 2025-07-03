import { useState, useEffect } from 'react';
import { orgAPI } from '../api';

const MemberRequests = ({ organizationId, authToken }) => {
  const [members, setMembers] = useState([]);
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, [organizationId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [memberList, userOrgs] = await Promise.all([
        orgAPI.getMembers(organizationId, authToken),
        orgAPI.getUserOrganizations(authToken)
      ]);
      
      setMembers(memberList);
      // Find the current organization details
      const currentOrg = userOrgs.find(org => org.organization.id === organizationId);
      setOrganization(currentOrg?.organization);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId) => {
    try {
      await orgAPI.approveMember(organizationId, userId, authToken);
      await loadData(); // Reload the data
    } catch (error) {
      setError(error.message);
    }
  };

  const handleDeny = async (userId) => {
    try {
      await orgAPI.denyMember(organizationId, userId, authToken);
      await loadData(); // Reload the data
    } catch (error) {
      setError(error.message);
    }
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      'approved': 'bg-green-900/20 text-green-300 border-green-500/30',
      'pending': 'bg-yellow-900/20 text-yellow-300 border-yellow-500/30',
      'denied': 'bg-red-900/20 text-red-300 border-red-500/30'
    };
    
    return (
      <span className={`px-2 py-1 rounded text-xs border ${statusColors[status] || statusColors.pending}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="dark-card p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-github-primary mx-auto mb-4"></div>
          <p className="text-sm text-github-text-secondary">Loading organization data...</p>
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

  const pendingMembers = members.filter(m => m.status === 'pending');
  const approvedMembers = members.filter(m => m.status === 'approved');
  const deniedMembers = members.filter(m => m.status === 'denied');

  return (
    <div className="space-y-6">
      {/* Organization Header */}
      <div className="dark-card p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 bg-github-accent rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-github-text">{organization?.name || 'Organization'}</h2>
            <p className="text-sm text-github-text-secondary">Organization Management</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-3 bg-github-bg-tertiary rounded-lg">
            <div className="text-2xl font-bold text-github-text">{approvedMembers.length}</div>
            <div className="text-xs text-github-text-secondary">Approved Members</div>
          </div>
          <div className="text-center p-3 bg-github-bg-tertiary rounded-lg">
            <div className="text-2xl font-bold text-github-text">{pendingMembers.length}</div>
            <div className="text-xs text-github-text-secondary">Pending Requests</div>
          </div>
          <div className="text-center p-3 bg-github-bg-tertiary rounded-lg">
            <div className="text-2xl font-bold text-github-text">{deniedMembers.length}</div>
            <div className="text-xs text-github-text-secondary">Denied Requests</div>
          </div>
        </div>
      </div>

      {/* Pending Requests */}
      <div className="dark-card p-6">
        <h3 className="text-lg font-semibold mb-6 flex items-center space-x-2">
          <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span>Pending Membership Requests</span>
          {pendingMembers.length > 0 && (
            <span className="bg-yellow-900/20 text-yellow-300 text-xs px-2 py-1 rounded-full">
              {pendingMembers.length}
            </span>
          )}
        </h3>
        
        {pendingMembers.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-12 h-12 text-github-text-muted mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <p className="text-github-text-secondary text-sm">No pending requests</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingMembers.map(member => (
              <div key={member.id} className="dark-card p-4 border-l-4 border-yellow-400">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-github-text mb-1">{member.name}</h4>
                    <p className="text-xs text-github-text-secondary">{member.email}</p>
                    <p className="text-xs text-github-text-muted">
                      Requested: {new Date(member.requested_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleApprove(member.id)}
                      className="github-button px-3 py-1 text-xs"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleDeny(member.id)}
                      className="github-button-secondary px-3 py-1 text-xs"
                    >
                      Deny
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Approved Members */}
      <div className="dark-card p-6">
        <h3 className="text-lg font-semibold mb-6 flex items-center space-x-2">
          <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
          </svg>
          <span>Approved Members</span>
        </h3>
        
        {approvedMembers.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-12 h-12 text-github-text-muted mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
            </svg>
            <p className="text-github-text-secondary text-sm">No approved members</p>
          </div>
        ) : (
          <div className="space-y-3">
            {approvedMembers.map(member => (
              <div key={member.id} className="dark-card p-4 border-l-4 border-green-400">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-github-text mb-1">{member.name}</h4>
                    <p className="text-xs text-github-text-secondary">{member.email}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      {getStatusBadge(member.status)}
                      <span className="text-xs text-github-text-muted">
                        Role: {member.role}
                      </span>
                    </div>
                    {member.approved_at && (
                      <p className="text-xs text-github-text-muted">
                        Approved: {new Date(member.approved_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Denied Requests */}
      {deniedMembers.length > 0 && (
        <div className="dark-card p-6">
          <h3 className="text-lg font-semibold mb-6 flex items-center space-x-2">
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <span>Denied Requests</span>
          </h3>
          
          <div className="space-y-3">
            {deniedMembers.map(member => (
              <div key={member.id} className="dark-card p-4 border-l-4 border-red-400">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-github-text mb-1">{member.name}</h4>
                    <p className="text-xs text-github-text-secondary">{member.email}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      {getStatusBadge(member.status)}
                    </div>
                    <p className="text-xs text-github-text-muted">
                      Requested: {new Date(member.requested_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberRequests; 