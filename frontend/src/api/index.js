const API_BASE = 'http://localhost:8000';

// Utility function to handle API responses
const handleResponse = async (response) => {
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'API request failed');
  }
  return response.json();
};

// Auth API
export const authAPI = {
  register: async (userData) => {
    const response = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    return handleResponse(response);
  },

  login: async (userData) => {
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    return handleResponse(response);
  },

  logout: async (token) => {
    const response = await fetch(`${API_BASE}/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return handleResponse(response);
  },

  getCurrentUser: async (token) => {
    const response = await fetch(`${API_BASE}/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return handleResponse(response);
  }
};

// Organization API
export const orgAPI = {
  search: async (query, token) => {
    const response = await fetch(`${API_BASE}/organizations/search?query=${encodeURIComponent(query)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return handleResponse(response);
  },

  getUserOrganizations: async (token) => {
    const response = await fetch(`${API_BASE}/organizations`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return handleResponse(response);
  },

  create: async (name, token) => {
    const response = await fetch(`${API_BASE}/organizations`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name })
    });
    return handleResponse(response);
  },

  join: async (orgId, token) => {
    const response = await fetch(`${API_BASE}/organizations/${orgId}/join`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return handleResponse(response);
  },

  getMembers: async (orgId, token) => {
    const response = await fetch(`${API_BASE}/organizations/${orgId}/members`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return handleResponse(response);
  },

  approveMember: async (orgId, userId, token) => {
    const response = await fetch(`${API_BASE}/organizations/${orgId}/members/${userId}/approve`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return handleResponse(response);
  },

  denyMember: async (orgId, userId, token) => {
    const response = await fetch(`${API_BASE}/organizations/${orgId}/members/${userId}/deny`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return handleResponse(response);
  },

  getUserRole: async (orgId, token) => {
    const response = await fetch(`${API_BASE}/organizations/${orgId}/user-role`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return handleResponse(response);
  }
};

// Document API
export const documentAPI = {
  upload: async (file, title, orgId, token) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('organization_id', orgId);

    const response = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    return handleResponse(response);
  },

  list: async (orgId, token) => {
    const response = await fetch(`${API_BASE}/papers/${orgId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return handleResponse(response);
  },

  query: async (question, orgId, token) => {
    const response = await fetch(`${API_BASE}/query`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ question, organization_id: orgId })
    });
    return handleResponse(response);
  },

  streamingQuery: async (question, orgId, token, onChunk) => {
    const response = await fetch(`${API_BASE}/streaming-query`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ question, organization_id: orgId })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Streaming query failed');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6)); // Remove 'data: ' prefix
            if (data.error) {
              throw new Error(data.error);
            }
            if (onChunk) onChunk(data);
          } catch (e) {
            if (e.message && e.message !== 'Unexpected end of JSON input') {
              throw e;
            }
          }
        }
      }
    }
  },

  getSourceInfo: async (orgId, filename, token) => {
    const response = await fetch(`${API_BASE}/papers/${orgId}/sources/${filename}/info`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return handleResponse(response);
  },

  delete: async (paperId, token) => {
    const response = await fetch(`${API_BASE}/papers/${paperId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return handleResponse(response);
  }
};

// Profile API
export const profileAPI = {
  uploadImage: async (file, token) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/upload-profile-image`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    return handleResponse(response);
  },

  updateProfile: async (profileData, token) => {
    const formData = new FormData();
    if (profileData.name) formData.append('name', profileData.name);
    if (profileData.bio) formData.append('bio', profileData.bio);

    const response = await fetch(`${API_BASE}/update-profile`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    return handleResponse(response);
  },

  getProfile: async (token) => {
    const response = await fetch(`${API_BASE}/profile`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return handleResponse(response);
  }
}; 