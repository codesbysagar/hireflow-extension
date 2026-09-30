import React, { useState } from 'react';
import { LogIn, Lock, Mail, AlertCircle, Loader2 } from 'lucide-react';
import { login } from '../../shared/auth.js';
import type { AuthUser } from '../../shared/types.js';

interface LoginFormProps {
  onLoginSuccess: (user: AuthUser, token: string) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const token = await login(email.trim(), password);
      onLoginSuccess({ email: email.trim() }, token);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="panel-card auth-card">
      <div className="auth-header">
        <div className="auth-icon-badge">
          <Lock size={18} color="var(--accent-mint)" />
        </div>
        <h2 className="auth-title">Welcome to HireFlow</h2>
        <p className="auth-subtitle">
          Sign in to analyze and match hiring posts against your candidate portfolio.
        </p>
      </div>

      {errorMessage && (
        <div className="auth-error-banner">
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="auth-field">
          <label htmlFor="auth-email">Work Email</label>
          <div className="auth-input-wrapper">
            <Mail size={14} className="auth-input-icon" />
            <input
              id="auth-email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
              autoFocus
            />
          </div>
        </div>

        <div className="auth-field">
          <label htmlFor="auth-password">Password</label>
          <div className="auth-input-wrapper">
            <Lock size={14} className="auth-input-icon" />
            <input
              id="auth-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>
        </div>

        <button type="submit" className="btn-primary auth-submit-btn" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 size={14} className="spin-icon" />
              Authenticating...
            </>
          ) : (
            <>
              <LogIn size={14} />
              Sign In
            </>
          )}
        </button>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px',
            fontSize: '10px',
            color: 'var(--text-muted)',
            marginTop: '8px',
          }}
        >
          <div
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: '#10B981',
              boxShadow: '0 0 6px #10B981',
            }}
          />
          <span>Render Backend: nebula-auth-mn52.onrender.com</span>
        </div>
      </form>
    </div>
  );
};
