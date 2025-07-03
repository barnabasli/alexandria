import { useState } from 'react';

const OrgAuth = ({ onLogin, onRegister, onSwitchToUser }) => {
  const [registerLoading, setRegisterLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [error, setError] = useState('');
  const [registerData, setRegisterData] = useState({
    name: '',
    email: '',
    password: '',
    organization_name: ''
  });
  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  });

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setRegisterLoading(true);
    setError('');

    try {
      // For org registration, organization_name is required
      if (!registerData.organization_name) {
        throw new Error('Organization name is required');
      }
      await onRegister({
        name: registerData.name,
        email: registerData.email,
        password: registerData.password,
        organization_name: registerData.organization_name
      });
    } catch (error) {
      setError(error.message);
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setError('');

    try {
      await onLogin({
        email: loginData.email,
        password: loginData.password
      });
    } catch (error) {
      setError(error.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegisterInputChange = (e) => {
    setRegisterData({
      ...registerData,
      [e.target.name]: e.target.value
    });
  };

  const handleLoginInputChange = (e) => {
    setLoginData({
      ...loginData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="dark-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-github-accent rounded-md flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-github-text">Alexandria</h1>
                <p className="text-xs text-github-text-muted">Organization Admin Portal</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-semibold mb-4 text-github-text">
              Organization Admin Portal
            </h2>
            <p className="text-lg text-github-text-secondary max-w-2xl mx-auto">
              Manage your organization's documents and member requests
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Organization Registration Form */}
            <div className="dark-card p-6">
              <div className="flex items-center mb-6">
                <div className="w-8 h-8 bg-github-accent rounded-md flex items-center justify-center mr-3">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                  </svg>
                </div>
                <h3 className="text-xl font-semibold">Create organization</h3>
              </div>
              
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div>
                  <label htmlFor="orgName" className="block text-sm font-medium text-github-text-secondary mb-2">Admin full name</label>
                  <input 
                    type="text" 
                    id="orgName" 
                    name="name"
                    required 
                    value={registerData.name}
                    onChange={handleRegisterInputChange}
                    className="github-input w-full px-3 py-2 text-sm"
                  />
                </div>
                
                <div>
                  <label htmlFor="orgEmail" className="block text-sm font-medium text-github-text-secondary mb-2">Admin email address</label>
                  <input 
                    type="email" 
                    id="orgEmail" 
                    name="email"
                    required 
                    value={registerData.email}
                    onChange={handleRegisterInputChange}
                    className="github-input w-full px-3 py-2 text-sm"
                  />
                </div>
                
                <div>
                  <label htmlFor="orgPassword" className="block text-sm font-medium text-github-text-secondary mb-2">Admin password</label>
                  <input 
                    type="password" 
                    id="orgPassword" 
                    name="password"
                    required 
                    value={registerData.password}
                    onChange={handleRegisterInputChange}
                    className="github-input w-full px-3 py-2 text-sm"
                  />
                </div>
                
                <div>
                  <label htmlFor="orgOrgName" className="block text-sm font-medium text-github-text-secondary mb-2">Organization name *</label>
                  <input 
                    type="text" 
                    id="orgOrgName" 
                    name="organization_name"
                    required
                    placeholder="Your organization name" 
                    value={registerData.organization_name}
                    onChange={handleRegisterInputChange}
                    className="github-input w-full px-3 py-2 text-sm"
                  />
                </div>
                
                <button 
                  type="submit" 
                  disabled={registerLoading}
                  className="github-button w-full py-2 px-4 text-sm disabled:opacity-50"
                >
                  {registerLoading ? 'Creating organization...' : 'Create organization'}
                </button>
              </form>
            </div>

            {/* Organization Login Form */}
            <div className="dark-card p-6">
              <div className="flex items-center mb-6">
                <div className="w-8 h-8 bg-github-primary rounded-md flex items-center justify-center mr-3">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"></path>
                  </svg>
                </div>
                <h3 className="text-xl font-semibold">Sign in as admin</h3>
              </div>
              
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label htmlFor="adminEmail" className="block text-sm font-medium text-github-text-secondary mb-2">Admin email address</label>
                  <input 
                    type="email" 
                    id="adminEmail" 
                    name="email"
                    required 
                    value={loginData.email}
                    onChange={handleLoginInputChange}
                    className="github-input w-full px-3 py-2 text-sm"
                  />
                </div>
                
                <div>
                  <label htmlFor="adminPassword" className="block text-sm font-medium text-github-text-secondary mb-2">Admin password</label>
                  <input 
                    type="password" 
                    id="adminPassword" 
                    name="password"
                    required 
                    value={loginData.password}
                    onChange={handleLoginInputChange}
                    className="github-input w-full px-3 py-2 text-sm"
                  />
                </div>
                
                <button 
                  type="submit" 
                  disabled={loginLoading}
                  className="github-button w-full py-2 px-4 text-sm disabled:opacity-50"
                >
                  {loginLoading ? 'Signing in...' : 'Sign in as admin'}
                </button>
              </form>
            </div>
          </div>

          {/* User Switch */}
          <div className="text-center mt-8">
            <button 
              onClick={onSwitchToUser}
              className="text-github-text-secondary hover:text-github-text transition-colors"
            >
              Are you a regular user? Sign in as member
            </button>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 rounded-md text-red-300 text-sm text-center">
              {error}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default OrgAuth; 