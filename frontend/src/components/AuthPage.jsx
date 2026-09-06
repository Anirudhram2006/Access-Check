import { useState } from 'react';
import { Shield, Mail, Lock, User, Eye, EyeOff, AlertCircle } from 'lucide-react';

const BACKEND_URL = 'http://localhost:5000';

export default function AuthPage({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setError('');
    setShowPassword(false);
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    resetForm();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'register') {
        if (password !== confirmPassword) {
          setError('Passwords do not match.');
          setLoading(false);
          return;
        }

        const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name, email, password, confirmPassword })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Registration failed.');
        }

        onAuth(data.user);
      } else {
        const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Login failed.');
        }

        onAuth(data.user);
      }
    } catch (err) {
      if (err.message.includes('Failed to fetch')) {
        setError('Cannot reach the server. Make sure the backend is running on http://localhost:5000.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card glass-card">
        <div className="auth-logo-section">
          <div className="auth-logo-wrapper">
            <Shield className="auth-logo-icon text-gradient" size={32} />
          </div>
          <h1 className="auth-title">
            ACCESS <span className="text-gradient">CHECK</span>
          </h1>
          <p className="auth-subtitle">Accessibility Auditor & Experience Simulator</p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => switchMode('login')}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => switchMode('register')}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div className="auth-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          {mode === 'register' && (
            <div className="auth-field">
              <label className="auth-label" htmlFor="auth-name">Full Name</label>
              <div className="auth-input-wrapper">
                <User size={16} className="auth-input-icon" />
                <input
                  id="auth-name"
                  type="text"
                  className="auth-input"
                  placeholder="Your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>
            </div>
          )}

          <div className="auth-field">
            <label className="auth-label" htmlFor="auth-email">Email Address</label>
            <div className="auth-input-wrapper">
              <Mail size={16} className="auth-input-icon" />
              <input
                id="auth-email"
                type="email"
                className="auth-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete={mode === 'login' ? 'email' : 'new-email'}
              />
            </div>
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="auth-password">Password</label>
            <div className="auth-input-wrapper">
              <Lock size={16} className="auth-input-icon" />
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                className="auth-input"
                placeholder={mode === 'register' ? 'Minimum 8 characters' : 'Enter your password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === 'register' ? 8 : undefined}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                className="auth-toggle-pw"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {mode === 'register' && (
            <div className="auth-field">
              <label className="auth-label" htmlFor="auth-confirm-pw">Confirm Password</label>
              <div className="auth-input-wrapper">
                <Lock size={16} className="auth-input-icon" />
                <input
                  id="auth-confirm-pw"
                  type={showPassword ? 'text' : 'password'}
                  className="auth-input"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={loading}
          >
            {loading ? (
              <span className="auth-loading-text">Processing...</span>
            ) : mode === 'login' ? (
              'Sign In'
            ) : (
              'Create Account'
            )}
          </button>
        </form>
      </div>

      <style>{`
        .auth-page {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: calc(100vh - 100px);
          padding: 40px 24px;
        }

        .auth-card {
          max-width: 440px;
          width: 100%;
          padding: 40px;
          text-align: center;
        }

        .auth-logo-section {
          margin-bottom: 32px;
        }

        .auth-logo-wrapper {
          background: rgba(99, 102, 241, 0.1);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: var(--radius-md);
          padding: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
        }

        .auth-title {
          font-size: 22px;
          font-weight: 800;
          letter-spacing: 0.05em;
          margin: 0 0 4px;
        }

        .auth-subtitle {
          font-size: 12px;
          color: var(--text-secondary);
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .auth-tabs {
          display: flex;
          gap: 4px;
          background: rgba(30, 41, 59, 0.5);
          border: 1px solid var(--border-color);
          padding: 4px;
          border-radius: var(--radius-md);
          margin-bottom: 24px;
        }

        .auth-tab {
          flex: 1;
          padding: 10px 16px;
          font-size: 14px;
          font-weight: 700;
          color: var(--text-secondary);
          border-radius: var(--radius-sm);
          transition: all var(--transition-fast);
        }

        .auth-tab:hover {
          color: var(--text-primary);
          background: rgba(255, 255, 255, 0.05);
        }

        .auth-tab.active {
          color: #ffffff;
          background: var(--primary);
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
        }

        .auth-error {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.25);
          color: #fca5a5;
          padding: 12px 16px;
          border-radius: var(--radius-md);
          font-size: 13px;
          font-weight: 500;
          margin-bottom: 20px;
          text-align: left;
        }

        .auth-error svg {
          flex-shrink: 0;
          color: #ef4444;
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 18px;
          text-align: left;
        }

        .auth-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .auth-label {
          font-size: 13px;
          font-weight: 700;
          color: var(--text-secondary);
          letter-spacing: 0.02em;
        }

        .auth-input-wrapper {
          display: flex;
          align-items: center;
          background: var(--bg-input);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 0 14px;
          transition: border-color var(--transition-fast);
        }

        .auth-input-wrapper:focus-within {
          border-color: var(--border-focus);
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
        }

        .auth-input-icon {
          color: var(--text-muted);
          flex-shrink: 0;
        }

        .auth-input {
          flex: 1;
          background: transparent;
          border: none;
          color: var(--text-primary);
          font-size: 14px;
          padding: 12px 10px;
          outline: none;
          width: 100%;
        }

        .auth-input::placeholder {
          color: var(--text-muted);
        }

        .auth-toggle-pw {
          color: var(--text-muted);
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: color var(--transition-fast);
        }

        .auth-toggle-pw:hover {
          color: var(--text-primary);
        }

        .auth-submit-btn {
          width: 100%;
          padding: 14px 24px;
          font-size: 15px;
          font-weight: 700;
          color: #ffffff;
          background: var(--primary);
          border-radius: var(--radius-md);
          box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
          transition: all var(--transition-fast);
          margin-top: 6px;
        }

        .auth-submit-btn:hover:not(:disabled) {
          background: var(--primary-hover);
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5);
        }

        .auth-submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .auth-loading-text {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        @media (max-width: 640px) {
          .auth-card {
            padding: 28px 20px;
          }
        }
      `}</style>
    </div>
  );
}
