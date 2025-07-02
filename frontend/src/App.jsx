import { useState, useEffect } from 'react';
import Auth from './components/Auth';
import OrgAuth from './components/OrgAuth';
import Dashboard from './components/Dashboard';
import OrgSearch from './components/OrgSearch';
import { authAPI } from './api';

function App() {
  const [authToken, setAuthToken] = useState(localStorage.getItem('authToken'));
  const [currentUser, setCurrentUser] = useState(null);
  const [userOrganizations, setUserOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('auth'); // 'auth', 'org-auth', 'dashboard', 'org-search'

  useEffect(() => {
    if (authToken) {
      initializeUser();
    } else {
      setLoading(false);
    }
  }, [authToken]);

  const initializeUser = async () => {
    try {
      const user = await authAPI.getCurrentUser(authToken);
      setCurrentUser(user);
      setView('dashboard');
    } catch (error) {
      console.error('Failed to get user:', error);
      localStorage.removeItem('authToken');
      setAuthToken(null);
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (userData) => {
    try {
      const result = await authAPI.login(userData);
      setAuthToken(result.access_token);
      localStorage.setItem('authToken', result.access_token);
      setCurrentUser(result.user);
      setView('dashboard');
    } catch (error) {
      throw error;
    }
  };

  const handleRegister = async (userData) => {
    try {
      const result = await authAPI.register(userData);
      setAuthToken(result.access_token);
      localStorage.setItem('authToken', result.access_token);
      setCurrentUser(result.user);
      setView('dashboard');
    } catch (error) {
      throw error;
    }
  };

  const handleLogout = async () => {
    try {
      if (authToken) {
        await authAPI.logout(authToken);
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setAuthToken(null);
      setCurrentUser(null);
      setUserOrganizations([]);
      localStorage.removeItem('authToken');
      setView('auth');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-github-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-github-primary mx-auto mb-4"></div>
          <p className="text-sm text-github-text-secondary">Loading PaperQA...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-github-bg text-github-text">
      {view === 'auth' && (
        <Auth 
          onLogin={handleLogin}
          onRegister={handleRegister}
          onSwitchToOrg={() => setView('org-auth')}
        />
      )}
      
      {view === 'org-auth' && (
        <OrgAuth 
          onLogin={handleLogin}
          onRegister={handleRegister}
          onSwitchToUser={() => setView('auth')}
        />
      )}
      
      {view === 'dashboard' && currentUser && (
        <Dashboard 
          user={currentUser}
          authToken={authToken}
          onLogout={handleLogout}
          onViewOrgSearch={() => setView('org-search')}
        />
      )}
      
      {view === 'org-search' && currentUser && (
        <OrgSearch 
          user={currentUser}
          authToken={authToken}
          onBack={() => setView('dashboard')}
        />
      )}
    </div>
  );
}

export default App;
