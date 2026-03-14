import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { can } from '../auth/permissions';
import './Navigation.css';

const Navigation: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Guests (not logged in) → no navigation bar at all
  if (!isAuthenticated || !user) {
    return null;
  }

  const groups = user.groups || [];

  async function handleLogout(e: React.MouseEvent) {
    e.preventDefault();
    try {
      await logout();
    } finally {
      navigate('/');
    }
  }

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="nav" role="navigation" aria-label="Main navigation">
      <div className="nav-brand">
        <Link to="/events">KEEP‑Up</Link>
      </div>

      <ul className="nav-links">
        {/* Events — all logged-in users */}
        <li className="nav-item">
          <Link to="/events" className={`nav-link ${isActive('/events') ? 'active' : ''}`}>
            <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="nav-text">Events</span>
          </Link>
        </li>

        {/* Map — all logged-in users */}
        <li className="nav-item">
          <Link to="/map" className={`nav-link ${isActive('/map') ? 'active' : ''}`}>
            <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <span className="nav-text">Map</span>
          </Link>
        </li>

        {/* Create Event — Author, Editor, Publisher, Manager, Admin, Super User */}
        {can.createEvent(groups) && (
          <li className="nav-item">
            <Link to="/create" className={`nav-link ${isActive('/create') ? 'active' : ''}`}>
              <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="nav-text">Create Event</span>
            </Link>
          </li>
        )}

        {/* Profile — all logged-in users */}
        <li className="nav-item">
          <Link to="/profile" className={`nav-link ${isActive('/profile') ? 'active' : ''}`}>
            <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="nav-text">Profile</span>
          </Link>
        </li>

        {/* Admin Dashboard — Manager, Administrator, Super User */}
        {can.accessAdmin(groups) && (
          <li className="nav-item">
            <Link to="/admin" className={`nav-link ${isActive('/admin') ? 'active' : ''}`}>
              <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="nav-text">Admin</span>
            </Link>
          </li>
        )}
      </ul>

      <div className="nav-actions">
        <button className="btn btn-ghost logout-btn" onClick={handleLogout}>
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="nav-text">Logout</span>
        </button>
      </div>
    </nav>
  );
};

export default Navigation;
