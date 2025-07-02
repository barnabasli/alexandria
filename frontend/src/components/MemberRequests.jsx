import { useState, useEffect } from 'react';
import { orgAPI } from '../api';

const MemberRequests = ({ organizationId, authToken }) => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadMembers();
  }, [organizationId]);

  const loadMembers = async () => {
    try {
      setLoading(true);
      const memberList = await orgAPI.getMembers(organizationId, authToken);
      setMembers(memberList);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId) => {
    try {
      await orgAPI.approveMember(organizationId, userId, authToken);
      await loadMembers(); // Reload the list
    } catch (error) {
      setError(error.message);
    }
  };

  const handleDeny = async (userId) => {
    try {
      await orgAPI.denyMember(organizationId, userId, authToken);
      await loadMembers(); // Reload the list
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
      <div className="github-card p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-github-primary mx-auto mb-4"></div>
          <p className="text-sm text-github-text-secondary">Loading members...</p>
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

  const pendingMembers = members.filter(m => m.status === 'pending');
  const approvedMembers = members.filter(m => m.status === 'approved');
  const deniedMembers = members.filter(m => m.status === 'denied');

  return (
    <div className="space-y-6">
      {/* Pending Requests */}
      <div className="github-card p-6">
        <h3 className="text-lg font-semibold mb-6">Pending Membership Requests</h3>
        
        {pendingMembers.length === 0 ? (
          <p className="text-github-text-secondary text-sm">No pending requests</p>
        ) : (
          <div className="space-y-3">
            {pendingMembers.map(member => (
              <div key={member.id} className="github-card p-4">
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
      <div className="github-card p-6">
        <h3 className="text-lg font-semibold mb-6">Approved Members</h3>
        
        {approvedMembers.length === 0 ? (
          <p className="text-github-text-secondary text-sm">No approved members</p>
        ) : (
          <div className="space-y-3">
            {approvedMembers.map(member => (
              <div key={member.id} className="github-card p-4">
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
        <div className="github-card p-6">
          <h3 className="text-lg font-semibold mb-6">Denied Requests</h3>
          
          <div className="space-y-3">
            {deniedMembers.map(member => (
              <div key={member.id} className="github-card p-4">
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