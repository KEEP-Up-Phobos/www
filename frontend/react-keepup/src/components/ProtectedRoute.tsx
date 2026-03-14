/**
 * Protected Route Component
 *
 * Uses the centralized RBAC from auth/permissions.ts.
 * Redirects guests to Landing page; unauthorized users to /unauthorized.
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  GROUP,
  CAN_BROWSE,
  CAN_CREATE_EVENT,
  CAN_ACCESS_ADMIN,
  CAN_ACCESS_NODE_ADMIN,
  FULL_ACCESS,
  hasPermission,
} from '../auth/permissions';

// Re-export so existing imports still resolve
export { GROUP as USER_GROUPS };
export const PERMISSIONS = {
  FRONTEND_ONLY: CAN_BROWSE,
  BACKEND_ACCESS: CAN_ACCESS_ADMIN,
  NODE_PAGES: CAN_ACCESS_NODE_ADMIN,
  FULL_ACCESS,
};
export { hasPermission };

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Explicit list of group IDs allowed */
  requiredGroups?: readonly number[];
  /** Where to send unauthenticated users (default: '/') */
  redirectTo?: string;
  /** Require user to be logged in (default: true) */
  requireAuth?: boolean;
  /** Shorthand: require Manager / Administrator / Super User */
  requireAdmin?: boolean;
  /** Shorthand: require Author+ (can create events) */
  requireCreateEvent?: boolean;
  /** Shorthand: require Administrator / Super User (Node.js admin) */
  requireNodeAdmin?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredGroups,
  redirectTo = '/',
  requireAuth = true,
  requireAdmin = false,
  requireCreateEvent = false,
  requireNodeAdmin = false,
}) => {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  // Loading spinner while auth initializes
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#0f0f23',
        color: 'rgba(255, 255, 255, 0.7)',
        gap: '1rem',
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid rgba(255, 255, 255, 0.1)',
          borderTopColor: '#667eea',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <p>Checking permissions...</p>
      </div>
    );
  }

  // ── Auth check ──────────────────────────────────────────────────
  if (requireAuth && !isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // ── Group check ─────────────────────────────────────────────────
  let effectiveGroups = requiredGroups;

  if (requireNodeAdmin)   effectiveGroups = CAN_ACCESS_NODE_ADMIN;
  else if (requireAdmin)  effectiveGroups = CAN_ACCESS_ADMIN;
  else if (requireCreateEvent) effectiveGroups = CAN_CREATE_EVENT;

  if (effectiveGroups && effectiveGroups.length > 0) {
    const userGroups = user?.groups || [];
    if (!hasPermission(userGroups, effectiveGroups)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
};

// ── Pre-configured route guards ────────────────────────────────────
export const RegisteredRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute>{children}</ProtectedRoute>
);

export const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute requireAdmin>{children}</ProtectedRoute>
);

export const SuperUserRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute requiredGroups={FULL_ACCESS}>{children}</ProtectedRoute>
);

export default ProtectedRoute;
