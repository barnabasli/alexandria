import { useState } from 'react';

const Auth = ({ onLogin, onRegister, onSwitchToOrg }) => {
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
      await onRegister({
        name: registerData.name,
        email: registerData.email,
        password: registerData.password,
        organization_name: registerData.organization_name || null
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
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-semibold mb-4 text-github-text">
              Welcome to PaperQA
            </h2>
            <p className="text-lg text-github-text-secondary max-w-2xl mx-auto">
              Upload your organization's documents and ask questions to get instant, AI-powered insights
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Registration Form */}
            <div className="github-card p-6">
              <div className="flex items-center mb-6">
                <div className="w-8 h-8 bg-github-accent rounded-md flex items-center justify-center mr-3">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                  </svg>
                </div>
                <h3 className="text-xl font-semibold">Create account</h3>
              </div>
              
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div>
                  <label htmlFor="regName" className="block text-sm font-medium text-github-text-secondary mb-2">Full name</label>
                  <input 
                    type="text" 
                    id="regName" 
                    name="name"
                    required 
                    value={registerData.name}
                    onChange={handleRegisterInputChange}
                    className="github-input w-full px-3 py-2 text-sm"
                  />
                </div>
                
                <div>
                  <label htmlFor="regEmail" className="block text-sm font-medium text-github-text-secondary mb-2">Email address</label>
                  <input 
                    type="email" 
                    id="regEmail" 
                    name="email"
                    required 
                    value={registerData.email}
                    onChange={handleRegisterInputChange}
                    className="github-input w-full px-3 py-2 text-sm"
                  />
                </div>
                
                <div>
                  <label htmlFor="regPassword" className="block text-sm font-medium text-github-text-secondary mb-2">Password</label>
                  <input 
                    type="password" 
                    id="regPassword" 
                    name="password"
                    required 
                    value={registerData.password}
                    onChange={handleRegisterInputChange}
                    className="github-input w-full px-3 py-2 text-sm"
                  />
                </div>
                
                <div>
                  <label htmlFor="regOrg" className="block text-sm font-medium text-github-text-secondary mb-2">Organization name</label>
                  <input 
                    type="text" 
                    id="regOrg" 
                    name="organization_name"
                    placeholder="Leave empty to join existing org" 
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
                  {registerLoading ? 'Creating account...' : 'Create account'}
                </button>
              </form>
            </div>

            {/* Login Form */}
            <div className="github-card p-6">
              <div className="flex items-center mb-6">
                <div className="w-8 h-8 bg-github-primary rounded-md flex items-center justify-center mr-3">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"></path>
                  </svg>
                </div>
                <h3 className="text-xl font-semibold">Sign in</h3>
              </div>
              
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label htmlFor="loginEmail" className="block text-sm font-medium text-github-text-secondary mb-2">Email address</label>
                  <input 
                    type="email" 
                    id="loginEmail" 
                    name="email"
                    required 
                    value={loginData.email}
                    onChange={handleLoginInputChange}
                    className="github-input w-full px-3 py-2 text-sm"
                  />
                </div>
                
                <div>
                  <label htmlFor="loginPassword" className="block text-sm font-medium text-github-text-secondary mb-2">Password</label>
                  <input 
                    type="password" 
                    id="loginPassword" 
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
                  {loginLoading ? 'Signing in...' : 'Sign in'}
                </button>
              </form>
            </div>
          </div>

          {/* Organization Switch */}
          <div className="text-center mt-8">
            <button 
              onClick={onSwitchToOrg}
              className="text-github-text-secondary hover:text-github-text transition-colors"
            >
              Are you an organization? Sign in as organization admin
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

export default Auth; 