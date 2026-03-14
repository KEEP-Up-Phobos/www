/**
 * Destination Chooser Page
 * 
 * Displayed to users with admin access (Manager, Administrator, Super User)
 * Allows choosing between Frontend, Joomla Backend, or Node.js Admin (Super Users only)
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { USER_GROUPS, PERMISSIONS, hasPermission } from '../components/ProtectedRoute';
import './ChooseDestination.css';

interface DestinationCard {
  id: string;
  title: string;
  description: string;
  icon: string;
  path: string;
  external?: boolean;
  requiredGroups: readonly number[];
  gradient: string;
}

const ChooseDestination: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { protocol, hostname } = window.location;
  const nodeBase = `${protocol}//${hostname}:3002`;
  const joomlaAdminUrl = `${protocol}//${hostname}/administrator`;
  const joomlaArticlesUrl = `${joomlaAdminUrl}/index.php?option=com_content&view=articles`;
  
  const destinations: DestinationCard[] = [
    {
      id: 'frontend',
      title: 'Frontend',
      description: 'Browse events, artists, venues and discover what\'s happening',
      icon: '🎫',
      path: '/events',
      requiredGroups: [...PERMISSIONS.FRONTEND_ONLY, ...PERMISSIONS.BACKEND_ACCESS],
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    },
    {
      id: 'joomla',
      title: 'Joomla Admin',
      description: 'Manage articles, users, menus, and CMS content',
      icon: '⚙️',
      path: joomlaAdminUrl,
      external: true,
      requiredGroups: PERMISSIONS.BACKEND_ACCESS,
      gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    },
    {
      id: 'node',
      title: 'Node.js Admin',
      description: 'Super User access to API management, events database, and system tools',
      icon: '🛠️',
      path: '/admin',
      requiredGroups: PERMISSIONS.NODE_PAGES,
      gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    },
  ];
  
  const userGroups = user?.groups || [USER_GROUPS.PUBLIC];

  const handleDestination = (dest: DestinationCard, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
    }
    if (dest.external) {
      window.open(dest.path, '_blank');
    } else {
      navigate(dest.path);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const availableDestinations = destinations.filter(d => 
    hasPermission(userGroups, d.requiredGroups)
  );

  const getUserGroupName = (): string => {
    if (hasPermission(userGroups, [USER_GROUPS.SUPER_USER])) return 'Super User';
    if (hasPermission(userGroups, [USER_GROUPS.ADMINISTRATOR])) return 'Administrator';
    if (hasPermission(userGroups, [USER_GROUPS.MANAGER])) return 'Manager';
    return 'User';
  };

  return (
    <div className="choose-page">
      {/* Background */}
      <div className="choose-bg">
        <div className="choose-bg-gradient"></div>
        <div className="choose-bg-orbs">
          <div className="orb orb-1"></div>
          <div className="orb orb-2"></div>
          <div className="orb orb-3"></div>
        </div>
      </div>

      <div className="choose-container">
        {/* Header */}
        <header className="choose-header">
          <div className="choose-brand">
            <span className="brand-icon">🎫</span>
            <h1>KEEP-Up</h1>
          </div>
          <div className="user-info">
            <span className="user-badge">{getUserGroupName()}</span>
            <span className="user-name">{user?.name || user?.username}</span>
            <button onClick={handleLogout} className="logout-btn">
              Sign Out
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="choose-main">
          <h2 className="choose-title">Where would you like to go?</h2>
          <p className="choose-subtitle">Select a destination based on what you want to do</p>

          <div className="destinations-grid">
            {availableDestinations.map(dest => (
              dest.external ? (
                <div
                  key={dest.id}
                  className="destination-card"
                  style={{ '--card-gradient': dest.gradient } as React.CSSProperties}
                  onClick={(e) => handleDestination(dest, e)}
                >
                  <div className="card-icon">{dest.icon}</div>
                  <h3 className="card-title">{dest.title}</h3>
                  <p className="card-description">{dest.description}</p>
                  <div className="card-arrow">→</div>
                </div>
              ) : (
                <div
                  key={dest.id}
                  className="destination-card"
                  style={{ '--card-gradient': dest.gradient } as React.CSSProperties}
                  onClick={(e) => handleDestination(dest, e)}
                >
                  <div className="card-icon">{dest.icon}</div>
                  <h3 className="card-title">{dest.title}</h3>
                  <p className="card-description">{dest.description}</p>
                  <div className="card-arrow">→</div>
                </div>
              )
            ))}
          </div>
        </main>

        {/* Quick Actions */}
        <section className="quick-actions">
          <h3>Quick Actions</h3>
          <div className="actions-row">
            <button onClick={() => navigate('/profile')} className="action-btn">
              <span>👤</span> My Profile
            </button>
            {hasPermission(userGroups, PERMISSIONS.NODE_PAGES) && (
              <>
                <button onClick={() => navigate('/create')} className="action-btn">
                  <span>➕</span> Add Event
                </button>
                <button onClick={() => window.open(`${nodeBase}/api/health`, '_blank')} className="action-btn">
                  <span>📊</span> API Status
                </button>
              </>
            )}
            {hasPermission(userGroups, PERMISSIONS.BACKEND_ACCESS) && (
              <a href={joomlaArticlesUrl} target="_blank" rel="noopener noreferrer" className="action-btn">
                <span>📝</span> Manage Articles
              </a>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default ChooseDestination;
