/**
 * Landing Page - Authentication-First Entry Point
 * 
 * Routes users based on their Joomla group:
 * - Super Users (8): Full access (Node.js pages + Frontend + Joomla Backend)
 * - Administrators (7): Frontend + Joomla Backend chooser
 * - Manager (6): Frontend + Joomla Backend chooser
 * - Registered (2-5): Frontend only (auto-redirect)
 * - Guests (1): Must login or register
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../api/config';
import './Landing.css';

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user, login, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [formData, setFormData] = useState({ username: '', name: '', password: '', email: '', confirmPassword: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showInAppWarning, setShowInAppWarning] = useState(false);
  const hasRedirected = useRef(false);

  // Detect in-app browsers (Instagram, Facebook, TikTok, etc)
  useEffect(() => {
    const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isInAppBrowser = /FBAN|FBAV|Instagram|FB_IAB|Line|Snapchat|Twitter|LinkedIn|WeChat/.test(ua);
    setShowInAppWarning(isInAppBrowser);
  }, []);

  // Auto-redirect authenticated users based on their group
  useEffect(() => {
    if (isAuthenticated && user && !hasRedirected.current) {
      hasRedirected.current = true;
      const userGroups = user.groups || [];
      
      // Check if user has admin/super user groups
      const isAdmin = userGroups.some(g => [6, 7, 8].includes(g)) || user.isSuperUser;
      
      if (isAdmin) {
        // Admins can choose destination
        navigate('/choose-destination', { replace: true });
      } else {
        // Regular users go to events page
        navigate('/events', { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await login(formData.username, formData.password);
      if (!result.success) {
        setError(result.error || 'Login failed');
      }
      // Redirect will happen via useEffect
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: formData.username,
          name: formData.name,
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (data.ok) {
        // Auto-login after registration
        await login(formData.username, formData.password);
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = (provider: 'google' | 'facebook') => {
    // Redirect to OAuth endpoint
    window.location.href = `${API_URL}/api/auth/oauth/${provider}`;
  };

  if (authLoading) {
    return (
      <div className="landing-page">
        <div className="landing-loader">
          <div className="loader-spinner"></div>
          <p>Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="landing-page">
      {/* Background Elements */}
      <div className="landing-bg">
        <div className="landing-bg-gradient"></div>
        <div className="landing-bg-pattern"></div>
      </div>

      {/* Main Content */}
      <div className="landing-container">
        {/* Logo & Branding */}
        <div className="landing-brand">
          <div className="landing-logo">
            <span className="logo-icon">🎫</span>
            <h1>KEEP-Up</h1>
          </div>
          <p className="landing-tagline">Your Gateway to Events & Entertainment</p>
        </div>

        {/* Auth Card */}
        <div className="landing-card">
          {/* In-App Browser Warning */}
          {showInAppWarning && (
            <div style={{
              padding: '1rem',
              marginBottom: '1rem',
              backgroundColor: '#ff9800',
              color: '#000',
              borderRadius: '8px',
              fontSize: '0.9rem',
              lineHeight: '1.5'
            }}>
              <strong>⚠️ Instagram/Facebook Browser Detected</strong>
              <p style={{ margin: '0.5rem 0 0 0' }}>
                For best experience, open this link in your default browser (Chrome, Safari, etc).
                Tap the <strong>•••</strong> menu and select "Open in Browser".
              </p>
            </div>
          )}

          {/* Tab Switcher */}
          <div className="auth-tabs">
            <button 
              className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => { setMode('login'); setError(null); }}
            >
              Sign In
            </button>
            <button 
              className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
              onClick={() => { setMode('register'); setError(null); }}
            >
              Create Account
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="auth-error">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}

          {/* Login Form */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="auth-form">
              <div className="form-group">
                <label htmlFor="username">Username or Email</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="Enter your username"
                  required
                  autoComplete="username"
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                />
              </div>

              <button type="submit" className="auth-submit" disabled={loading}>
                {loading ? (
                  <>
                    <span className="btn-spinner"></span>
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>

              <a href="/web/index.php?option=com_users&view=reset" className="forgot-password">
                Forgot your password?
              </a>
            </form>
          )}

          {/* Registration Form */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="auth-form">
              <div className="form-group">
                <label htmlFor="reg-username">Username</label>
                <input
                  type="text"
                  id="reg-username"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="Choose a username"
                  required
                  autoComplete="username"
                  minLength={3}
                />
              </div>

              <div className="form-group">
                <label htmlFor="reg-name">Full Name</label>
                <input
                  type="text"
                  id="reg-name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Your full name"
                  required
                  autoComplete="name"
                />
              </div>

              <div className="form-group">
                <label htmlFor="reg-email">Email Address</label>
                <input
                  type="email"
                  id="reg-email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="your@email.com"
                  required
                  autoComplete="email"
                />
              </div>

              <div className="form-group">
                <label htmlFor="reg-password">Password</label>
                <input
                  type="password"
                  id="reg-password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Min. 8 characters"
                  required
                  autoComplete="new-password"
                  minLength={8}
                />
              </div>

              <div className="form-group">
                <label htmlFor="reg-confirm">Confirm Password</label>
                <input
                  type="password"
                  id="reg-confirm"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="Repeat your password"
                  required
                  autoComplete="new-password"
                />
              </div>

              <button type="submit" className="auth-submit" disabled={loading}>
                {loading ? (
                  <>
                    <span className="btn-spinner"></span>
                    Creating account...
                  </>
                ) : (
                  'Create Account'
                )}
              </button>
            </form>
          )}

          {/* Social Login Divider */}
          <div className="social-divider">
            <span>or continue with</span>
          </div>

          {/* Social Login Buttons */}
          <div className="social-buttons">
            <button 
              type="button" 
              className="social-btn google"
              onClick={() => handleSocialLogin('google')}
            >
              <svg viewBox="0 0 24 24" className="social-icon">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google
            </button>
            <button 
              type="button" 
              className="social-btn facebook"
              onClick={() => handleSocialLogin('facebook')}
            >
              <svg viewBox="0 0 24 24" className="social-icon">
                <path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              Facebook
            </button>
          </div>
        </div>

        {/* Footer */}
        <footer className="landing-footer">
          <p>&copy; 2026 KEEP-Up. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
};

export default Landing;
