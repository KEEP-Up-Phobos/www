import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navigation from './components/Navigation';
import Login from './pages/Login';
import EventGrid from './pages/EventGrid';
import EventMap from './pages/EventMap';
import Profile from './pages/Profile';
import EditProfile from './pages/EditProfile';
import CreateEvent from './pages/CreateEvent';
import EnhancedAdminDashboard from './pages/EnhancedAdminDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';
import Landing from './pages/Landing';
import ChooseDestination from './pages/ChooseDestination';

// Inner component that can access auth context
function AppContent() {
  const { isLoading } = useAuth();

  // Show loading screen while auth is initializing
  if (isLoading) {
    return (
      <div className="App">
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          fontSize: '1.2rem',
          color: '#666'
        }}>
          🔄 Initializing KEEP-UP...
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <Navigation />
      <main className="main-content">
        <Routes>
          {/* ── Public routes (guests allowed) ───────────────── */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Landing />} />

          {/* ── Logged-in users (Registered+) ────────────────── */}
          <Route
            path="/events"
            element={
              <ProtectedRoute>
                <EventGrid />
              </ProtectedRoute>
            }
          />
          <Route
            path="/map"
            element={
              <ProtectedRoute>
                <EventMap />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/edit"
            element={
              <ProtectedRoute>
                <EditProfile />
              </ProtectedRoute>
            }
          />

          {/* ── Create Event (Author, Editor, Publisher, Manager, Admin, Super User) */}
          <Route
            path="/create"
            element={
              <ProtectedRoute requireCreateEvent>
                <CreateEvent />
              </ProtectedRoute>
            }
          />

          {/* ── Admin Dashboard (Manager, Administrator, Super User) */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requireAdmin>
                <EnhancedAdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/choose-destination"
            element={
              <ProtectedRoute requireAdmin>
                <ChooseDestination />
              </ProtectedRoute>
            }
          />

          {/* ── Unauthorized page ────────────────────────────── */}
          <Route
            path="/unauthorized"
            element={
              <div style={{ padding: '2rem', textAlign: 'center', color: '#fff', background: '#0f0f23', minHeight: '100vh' }}>
                <h2>Access Denied</h2>
                <p>You don't have permission to access this page.</p>
                <a href="/events" style={{ color: '#667eea' }}>Go to Events</a>
              </div>
            }
          />

          {/* ── Catch-all → landing ──────────────────────────── */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
