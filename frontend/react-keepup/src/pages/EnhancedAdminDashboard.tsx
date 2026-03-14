/**
 * Admin Dashboard — Statistics & Monitoring
 * Populate/fetcher controls are CLI-only (fetcher -city, fetcher --all).
 */

import React, { useState, useEffect } from 'react';
import { adminAPI } from '../api/admin';
import { useAuth } from '../context/AuthContext';
import AdminEventMap from '../components/AdminEventMap';
import './EnhancedAdminDashboard.css';

const FETCHER_URL = '';

interface SystemStats {
  ram: { total_gb: number; used_gb: number; available_gb: number; percent: number; swap_total_gb: number; swap_used_gb: number };
  fetcher: { rss_mb: number; status: string; paused: boolean; current_city: string | null; cycles: number; started_at: string | null; last_error: string | null };
  db: { cities: number; active_cities: number; venues: number; events: number; upcoming_events: number };
  system: { uptime_hours: number; load_avg: number[] };
  timestamp: string;
}

interface CrawlerStatus {
  status: 'idle' | 'running' | 'paused' | 'stopped';
  paused?: boolean;
}

interface CacheStats {
  totalEntries: number;
  totalSize: number;
  lastCleared: string;
}

const EnhancedAdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'events' | 'users' | 'monitoring'>('overview');
  const [users, setUsers] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [crawlerStatus, setCrawlerStatus] = useState<CrawlerStatus>({ status: 'idle' });
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);

  // Stats search (city/country filter)
  const [statsSearchCity, setStatsSearchCity] = useState('');
  const [statsSearchCountry, setStatsSearchCountry] = useState('');
  const [filteredEventCount, setFilteredEventCount] = useState<number | null>(null);

  // Error expansion state
  const [errorExpanded, setErrorExpanded] = useState(false);

  const { token } = useAuth();

  // Real-time updates
  useEffect(() => {
    if (token) {
      loadAllData();
      loadSystemStats();
      const interval = setInterval(() => loadRealTimeData(), 5000);
      const sysInterval = setInterval(() => loadSystemStats(), 10000);
      return () => { clearInterval(interval); clearInterval(sysInterval); };
    }
  }, [token]);

  const loadSystemStats = async () => {
    try {
      const resp = await fetch(`${FETCHER_URL}/api/fetcher/system`);
      if (resp.ok) setSystemStats(await resp.json());
    } catch { /* fetcher offline */ }
  };

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [usersData, eventsData, fetcherData, cacheData, statsData] = await Promise.all([
        adminAPI.getUsers(token!),
        adminAPI.getAllEvents(token!),
        adminAPI.getFetcherStatus(token!),
        adminAPI.getCacheStats(token!),
        adminAPI.getStats(token!),
      ]);
      setUsers(usersData);
      setEvents(eventsData);
      setCrawlerStatus(fetcherData);
      setCacheStats(cacheData);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadRealTimeData = async () => {
    try {
      const [fetcherData, cacheData, statsData] = await Promise.all([
        adminAPI.getFetcherStatus(token!),
        adminAPI.getCacheStats(token!),
        adminAPI.getStats(token!),
      ]);
      setCrawlerStatus(fetcherData);
      setCacheStats(cacheData);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load real-time data:', err);
    }
  };

  if (loading) {
    return (
      <div className="admin-container">
        <div className="loading-spinner">
          <p>Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <header className="admin-header">
        <h1>🐍 KEEP-Up Admin — Python Serpents Command Center</h1>
        <div className="admin-tabs">
          {(['overview', 'events', 'users', 'monitoring'] as const).map(tab => (
            <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>
              {tab === 'overview' ? '🌍 Overview' : tab === 'events' ? '📅 Events' : tab === 'users' ? '👥 Users' : '📈 Monitoring'}
            </button>
          ))}
        </div>
      </header>

      <main className="admin-content">
        {/* ═══════════════ OVERVIEW TAB ═══════════════ */}
        {activeTab === 'overview' && (
          <div className="overview-grid">

            {/* ═══ SYSTEM RAM & FETCHER MONITOR ═══ */}
            <div className="stat-card stat-card-wide system-monitor-card">
              <div className="system-monitor-header">
                <h3>🖥️ System Monitor</h3>
                {systemStats && (
                  <span className={`monitor-pulse ${systemStats.fetcher.status === 'sweeping' || systemStats.fetcher.status === 'running' ? 'pulse-active' : systemStats.fetcher.status === 'sleeping' || systemStats.fetcher.status === 'waiting' ? 'pulse-idle' : 'pulse-error'}`}>
                    ● {systemStats.fetcher.status}
                  </span>
                )}
              </div>

              {systemStats ? (
                <div className="system-monitor-grid">
                  {/* RAM Progress Bar */}
                  <div className="ram-progress-container">
                    <div className="ram-progress-header">
                      <span className="ram-progress-label">RAM Usage</span>
                      <span className="ram-progress-value">{systemStats.ram.percent}%</span>
                    </div>
                    <div className="ram-progress-bar">
                      <div className="ram-progress-fill"
                        style={{
                          width: `${systemStats.ram.percent}%`,
                          backgroundColor: systemStats.ram.percent > 85 ? '#ff4757' : systemStats.ram.percent > 70 ? '#ffa502' : '#2ed573'
                        }}
                      />
                    </div>
                    <div className="ram-progress-detail">
                      {systemStats.ram.used_gb} / {systemStats.ram.total_gb} GB
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="monitor-stats-grid">
                    <div className="monitor-stat">
                      <span className="monitor-stat-value">{systemStats.db.events}</span>
                      <span className="monitor-stat-label">Events</span>
                    </div>
                    <div className="monitor-stat">
                      <span className="monitor-stat-value">{systemStats.db.venues}</span>
                      <span className="monitor-stat-label">Venues</span>
                    </div>
                    <div className="monitor-stat">
                      <span className="monitor-stat-value">{systemStats.db.cities}</span>
                      <span className="monitor-stat-label">Cities</span>
                    </div>
                    <div className="monitor-stat">
                      <span className="monitor-stat-value">{systemStats.db.upcoming_events}</span>
                      <span className="monitor-stat-label">Upcoming</span>
                    </div>
                    <div className="monitor-stat">
                      <span className="monitor-stat-value">{systemStats.fetcher.cycles}</span>
                      <span className="monitor-stat-label">Cycles</span>
                    </div>
                    <div className="monitor-stat">
                      <span className="monitor-stat-value">{systemStats.fetcher.rss_mb}MB</span>
                      <span className="monitor-stat-label">Fetcher RAM</span>
                    </div>
                  </div>

                  {/* Fetcher Details */}
                  <div className="monitor-details">
                    {systemStats.fetcher.current_city && (
                      <div className="monitor-detail-row">
                        <span className="detail-icon">📍</span>
                        <span>Sweeping: <strong>{systemStats.fetcher.current_city}</strong></span>
                      </div>
                    )}
                    <div className="monitor-detail-row">
                      <span className="detail-icon">⏱️</span>
                      <span>Uptime: {systemStats.system.uptime_hours}h</span>
                    </div>
                    <div className="monitor-detail-row">
                      <span className="detail-icon">📊</span>
                      <span>Load: {systemStats.system.load_avg.join(' / ')}</span>
                    </div>
                    {systemStats.ram.swap_total_gb > 0 && (
                      <div className="monitor-detail-row">
                        <span className="detail-icon">💾</span>
                        <span>Swap: {systemStats.ram.swap_used_gb}/{systemStats.ram.swap_total_gb} GB</span>
                      </div>
                    )}
                    {systemStats.fetcher.last_error && (
                      <div className="monitor-detail-row monitor-error">
                        <span className="detail-icon">⚠️</span>
                        <button
                          onClick={() => setErrorExpanded(!errorExpanded)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#ff6b6b',
                            cursor: 'pointer',
                            textAlign: 'left',
                            padding: '0',
                            fontSize: '0.9rem',
                            fontWeight: '500',
                            maxWidth: '90%',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                          title="Click to view full error"
                        >
                          {errorExpanded ? '▼ ' : '▶ '} Error Occurred {errorExpanded && '— Click to hide'}
                        </button>
                      </div>
                    )}
                    {systemStats.fetcher.last_error && errorExpanded && (
                      <div style={{
                        gridColumn: '1 / -1',
                        padding: '12px',
                        backgroundColor: 'rgba(255, 107, 107, 0.1)',
                        border: '1px solid rgba(255, 107, 107, 0.3)',
                        borderRadius: '4px',
                        marginTop: '8px',
                        fontSize: '0.8rem',
                        color: '#ccc',
                        fontFamily: 'monospace',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        lineHeight: '1.4'
                      }}>
                        {systemStats.fetcher.last_error}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="monitor-offline">
                  <span>⏳ Connecting to fetcher...</span>
                </div>
              )}
            </div>
            <div className="stat-card stat-card-wide">
              <h3>📊 Database Statistics</h3>
              {stats && (
                <div className="stats-row">
                  <div className="stat-item">
                    <span className="stat-number">{stats.events || 0}</span>
                    <span className="stat-label">Total Events</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-number">{stats.users || 0}</span>
                    <span className="stat-label">Users</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-number">{stats.recentEvents || 0}</span>
                    <span className="stat-label">Last 24h</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-number">{stats.byCountry?.length || 0}</span>
                    <span className="stat-label">Countries</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-number">{stats.byCity?.length || 0}</span>
                    <span className="stat-label">Cities</span>
                  </div>
                </div>
              )}

              {/* City/Country search */}
              <div className="stats-search" style={{ display: 'flex', gap: '8px', margin: '12px 0', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text" placeholder="City..." value={statsSearchCity}
                  onChange={e => setStatsSearchCity(e.target.value)}
                  className="input-sm" style={{ flex: 1, minWidth: '120px' }}
                />
                <input
                  type="text" placeholder="Country..." value={statsSearchCountry}
                  onChange={e => setStatsSearchCountry(e.target.value)}
                  className="input-sm" style={{ flex: 1, minWidth: '120px' }}
                />
                <button className="action-btn-sm primary" onClick={async () => {
                  if (!statsSearchCity && !statsSearchCountry) return;
                  try {
                    const params = new URLSearchParams();
                    if (statsSearchCity) params.set('city', statsSearchCity);
                    if (statsSearchCountry) params.set('country', statsSearchCountry);
                    const resp = await adminAPI.getStats(token!, params.toString());
                    setFilteredEventCount(resp.filteredCount ?? null);
                  } catch { setFilteredEventCount(null); }
                }}>Search</button>
                {filteredEventCount !== null && (
                  <span style={{ color: '#4ecdc4', fontWeight: 600 }}>
                    {filteredEventCount} events found
                  </span>
                )}
              </div>

              {stats?.bySource && (
                <div className="source-breakdown">
                  <h4>By Source:</h4>
                  <div className="source-tags">
                    {stats.bySource.map((s: any) => (
                      <span key={s.source} className="source-tag">{s.source}: {s.count}</span>
                    ))}
                  </div>
                </div>
              )}
              {stats?.byCountry && stats.byCountry.length > 0 && (
                <div className="source-breakdown">
                  <h4>Top Countries:</h4>
                  <div className="source-tags">
                    {stats.byCountry.slice(0, 10).map((c: any) => (
                      <span key={c.country} className="source-tag country-tag">{c.country}: {c.count}</span>
                    ))}
                  </div>
                </div>
              )}
              {stats?.byCity && stats.byCity.length > 0 && (
                <div className="source-breakdown">
                  <h4>Top Cities:</h4>
                  <div className="source-tags">
                    {stats.byCity.slice(0, 15).map((c: any) => (
                      <span key={`${c.city}-${c.country}`} className="source-tag">{c.city}{c.country ? `, ${c.country}` : ''}: {c.count}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── System Status ── */}
            <div className="stat-card">
              <h3>⚡ System Status</h3>
              <div className="status-indicators">
                <div className={`status-item ${crawlerStatus.status === 'running' ? 'active' : ''}`}>
                  <span className="status-dot"></span>
                  Fetcher: {crawlerStatus.status}
                  {crawlerStatus.paused && <span style={{ color: '#ff9800', marginLeft: '8px' }}>(paused)</span>}
                </div>
                <div className="status-item">
                  <span className="status-dot active"></span>
                  API: Online
                </div>
                <div className="status-item">
                  <span className="status-dot active"></span>
                  Python Serpents: Active
                </div>
                {cacheStats && (
                  <div className="status-item">
                    <span className="status-dot active"></span>
                    Cache: {cacheStats.totalEntries || 0} entries
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'events' && (
          <section className="admin-section">
            <h2>🌍 Events Map - Global View ({events.length} total)</h2>
            <p style={{ color: '#888', marginBottom: '16px', fontSize: '0.9rem' }}>
              All events displayed globally. Zoom out to see countries, zoom in to see individual cities and events.
            </p>
            <AdminEventMap events={events} />
            <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#2a2a3e', borderRadius: '6px', fontSize: '0.85rem', color: '#9ca3af' }}>
              <p><strong>📍 Map Legend:</strong></p>
              <p>🔴 <strong>Red clusters</strong> = Countries (world view)</p>
              <p>🔵 <strong>Teal clusters</strong> = Cities (regional view)</p>
              <p>📌 <strong>Markers</strong> = Individual events (detailed view)</p>
              <p style={{ marginTop: '8px' }}>Cluster size increases with event count. Zoom in/out to change detail level.</p>
            </div>
          </section>
        )}

        {activeTab === 'users' && (
          <section className="admin-section">
            <h2>👥 Users Management ({users.length})</h2>
            <div className="table-container">
              <table>
                <thead>
                  <tr><th>Username</th><th>Email</th><th>Role</th></tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>{user.username}</td>
                      <td>{user.email}</td>
                      <td>{user.role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'monitoring' && (
          <section className="admin-section">
            <h2>📈 Monitoring</h2>
            <div className="overview-grid">
              <div className="stat-card stat-card-wide" style={{ textAlign: 'center', padding: '32px' }}>
                <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📊</div>
                <h3 style={{ marginBottom: '8px' }}>Grafana Dashboard</h3>
                <p style={{ color: '#888', marginBottom: '20px', fontSize: '0.9rem' }}>
                  Grafana + Prometheus are deployed as optional side services.<br />
                  Start them with: <code style={{ background: '#1a1a2e', padding: '2px 6px', borderRadius: '4px' }}>docker compose --profile monitoring up -d</code>
                </p>
                <a
                  href="http://localhost:3010"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="action-btn primary"
                  style={{ display: 'inline-block', textDecoration: 'none', padding: '10px 24px' }}
                >
                  Open Grafana →
                </a>
                <div style={{ marginTop: '12px' }}>
                  <a href="http://localhost:9090" target="_blank" rel="noopener noreferrer"
                    style={{ color: '#4ecdc4', fontSize: '0.85rem' }}>
                    Open Prometheus directly →
                  </a>
                </div>
              </div>

              <div className="stat-card">
                <h3>🔌 Endpoints</h3>
                <div style={{ fontSize: '0.85rem', lineHeight: '2' }}>
                  <div><code>/metrics</code> — Node.js app metrics</div>
                  <div><code>/api/fetcher/system</code> — Fetcher stats</div>
                  <div><code>:9090</code> — Prometheus</div>
                  <div><code>:3010</code> — Grafana</div>
                  <div><code>:9100</code> — Node Exporter (host)</div>
                </div>
              </div>

              <div className="stat-card">
                <h3>📋 Quick Start</h3>
                <div style={{ fontSize: '0.82rem', lineHeight: '1.8', fontFamily: 'monospace', color: '#ccc' }}>
                  <div style={{ color: '#4ecdc4' }}># Start monitoring</div>
                  <div>docker compose --profile monitoring up -d</div>
                  <div style={{ marginTop: '8px', color: '#4ecdc4' }}># Stop monitoring</div>
                  <div>docker compose --profile monitoring down</div>
                  <div style={{ marginTop: '8px', color: '#888', fontFamily: 'sans-serif', fontSize: '0.8rem' }}>
                    Main app services are unaffected.
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default EnhancedAdminDashboard;
                  {crawlerStatus.paused && <span style={{ color: '#ff9800', marginLeft: '8px' }}>(paused)</span>}
                </div>
                <div className="status-item">
                  <span className="status-dot active"></span>
                  API: Online
                </div>
                <div className="status-item">
                  <span className="status-dot active"></span>
                  Python Serpents: Active
                </div>
                <div className="status-item">
                  <span className="status-dot active"></span>
                  Dragons: Enabled
                </div>
              </div>
              
              {/* Crawler control buttons */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                <button
                  className="action-btn-sm primary"
                  onClick={() => handleCrawlerAction('start')}
                  disabled={crawlerStatus.status === 'running' || actionLoading === 'crawler-start'}
                >
                  {actionLoading === 'crawler-start' ? '⏳ Starting...' : '▶️ Start'}
                </button>
                <button
                  className="action-btn-sm warning"
                  onClick={() => handleCrawlerAction('pause')}
                  disabled={crawlerStatus.status !== 'running' || actionLoading === 'crawler-pause'}
                >
                  {actionLoading === 'crawler-pause' ? '⏳ Pausing...' : '⏸️ Pause'}
                </button>
                <button
                  className="action-btn-sm success"
                  onClick={() => handleCrawlerAction('resume')}
                  disabled={!crawlerStatus.paused || actionLoading === 'crawler-resume'}
                >
                  {actionLoading === 'crawler-resume' ? '⏳ Resuming...' : '▶️ Resume'}
                </button>
                <button
                  className="action-btn-sm danger"
                  onClick={() => handleCrawlerAction('stop')}
                  disabled={actionLoading === 'crawler-stop'}
                >
                  {actionLoading === 'crawler-stop' ? '⏳ Stopping...' : '⏹️ STOP'}
                </button>
              </div>
              
              {cacheStats && (
                <div className="cache-mini">
                  <small>Cache: {cacheStats.totalEntries || 0} entries</small>
                  <button className="action-btn-sm secondary" onClick={handleClearCache} disabled={actionLoading === 'clear-cache'}>
                    Clear
                  </button>
                </div>
              )}
            </div>

            {/* ── Hot Refresh Card ── */}
            <div className="stat-card">
              <h3>🔄 Hot Refresh</h3>
              <p style={{ fontSize: '0.85rem', color: '#666', margin: '0 0 12px 0' }}>
                Apply code changes without a full Docker rebuild. Services stay online.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Node.js Refresh */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    className="action-btn primary"
                    onClick={handleRefreshNode}
                    disabled={nodeRefreshing}
                    style={{ flex: 1, padding: '10px', fontSize: '0.9rem' }}
                  >
                    {nodeRefreshing ? '⏳ Restarting Node.js...' : '🟢 Refresh Node.js'}
                  </button>
                  <span style={{ fontSize: '0.75rem', color: '#888', maxWidth: '120px' }}>
                    ~3s downtime
                  </span>
                </div>

                {/* React Refresh */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    className="action-btn success"
                    onClick={handleRefreshReact}
                    disabled={actionLoading === 'refresh-react'}
                    style={{ flex: 1, padding: '10px', fontSize: '0.9rem' }}
                  >
                    {actionLoading === 'refresh-react' ? '⏳ Rebuilding React...' : '⚛️ Refresh React'}
                  </button>
                  <span style={{ fontSize: '0.75rem', color: '#888', maxWidth: '120px' }}>
                    Zero downtime
                  </span>
                </div>

                {/* React rebuild status indicator */}
                {reactRefreshStatus.status !== 'idle' && (
                  <div style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    background: reactRefreshStatus.status === 'success' ? '#d4edda' :
                                reactRefreshStatus.status === 'failed' ? '#f8d7da' :
                                reactRefreshStatus.status === 'building' ? '#fff3cd' : '#e2e3e5',
                    color: reactRefreshStatus.status === 'success' ? '#155724' :
                           reactRefreshStatus.status === 'failed' ? '#721c24' :
                           reactRefreshStatus.status === 'building' ? '#856404' : '#383d41',
                  }}>
                    {reactRefreshStatus.status === 'pending' && '⏳ '}
                    {reactRefreshStatus.status === 'building' && '🔨 '}
                    {reactRefreshStatus.status === 'success' && '✅ '}
                    {reactRefreshStatus.status === 'failed' && '❌ '}
                    {reactRefreshStatus.message}
                    {reactRefreshStatus.status === 'success' && (
                      <div style={{ marginTop: '4px', fontWeight: 'bold' }}>
                        Press Ctrl+F5 in the browser to see changes.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ═══ POPULATE WORLD ═══ */}
            <div className="stat-card populate-card">
              <h3>🌍 Populate World</h3>
              <p className="populate-desc">
                Python Serpents + Dragons crawl 10 cities per country worldwide.
                {worldCountries.length > 0 && <strong> {worldCountries.length} countries, ~{worldCountries.length * 10} cities total.</strong>}
              </p>
              <div className="populate-controls">
                <label>
                  Max events/city:
                  <input type="number" value={maxEventsPerCity} onChange={e => setMaxEventsPerCity(Math.max(1, parseInt(e.target.value) || 10))} min={1} max={100} className="input-sm" />
                </label>
                <button className="action-btn primary populate-btn" onClick={handlePopulateWorld} disabled={populateProgress.running}>
                  {populateProgress.running && populateProgress.type === 'world' ? `Populating... (${populateProgress.completed}/${populateProgress.total})` : '🌍 Populate World'}
                </button>
              </div>
            </div>

            {/* ═══ POPULATE COUNTRY ═══ */}
            <div className="stat-card populate-card">
              <h3>🗺️ Populate Country</h3>
              <p className="populate-desc">Deep population: 10 cities per state/province of a single country.</p>
              <div className="populate-controls">
                <label>
                  Country:
                  <select value={selectedCountry} onChange={e => setSelectedCountry(e.target.value)} className="input-select">
                    {deepCountries.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <button className="action-btn success populate-btn" onClick={handlePopulateCountry} disabled={populateProgress.running}>
                  {populateProgress.running && populateProgress.type === 'country' ? `Populating... (${populateProgress.completed}/${populateProgress.total})` : `🗺️ Populate ${selectedCountry}`}
                </button>
              </div>
            </div>

            {/* ═══ POPULATE SINGLE TOWN ═══ */}
            <div className="stat-card populate-card">
              <h3>🏘️ Populate Town</h3>
              <p className="populate-desc">Quick populate a single town via Python Serpents + Dragons.</p>
              <div className="populate-controls">
                <input
                  type="text"
                  placeholder="Enter town name (e.g. Paris, Tokyo...)"
                  value={populateTownName}
                  onChange={e => setPopulateTownName(e.target.value)}
                  className="input-town"
                  onKeyDown={e => e.key === 'Enter' && handlePopulateTown()}
                />
                <button className="action-btn info populate-btn" onClick={handlePopulateTown} disabled={populateProgress.running || !populateTownName.trim()}>
                  {populateProgress.running && populateProgress.type === 'town' ? 'Populating...' : '🏘️ Populate Town'}
                </button>
              </div>
            </div>

            {/* ═══ LIVE LOG ═══ */}
            {populateProgress.log.length > 0 && (
              <div className="stat-card stat-card-wide log-card">
                <h3>📜 Live Population Log</h3>
                {populateProgress.running && (
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: populateProgress.total > 0 ? `${(populateProgress.completed / populateProgress.total) * 100}%` : '0%' }}></div>
                    <span className="progress-text">
                      {populateProgress.completed}/{populateProgress.total} cities — {populateProgress.totalSaved} events saved — {populateProgress.errors} errors
                    </span>
                  </div>
                )}
                <div className="log-output">
                  {populateProgress.log.map((line, i) => (
                    <div key={i} className={`log-line ${line.startsWith('❌') ? 'log-error' : line.startsWith('✅') ? 'log-success' : ''}`}>{line}</div>
                  ))}
                </div>
              </div>
            )}

            {/* ═══ JOBS (Persistent) ═══ */}
            <div className="stat-card stat-card-wide jobs-card">
              <h3>🧾 Persistent Populate Jobs</h3>
              <p className="populate-desc">List of recent persisted populate jobs (world/country). You can resume interrupted jobs.</p>
              <div className="jobs-list">
                {jobs.length === 0 && <small>No recent jobs</small>}
                {jobs.map(j => (
                  <div key={j.id} className="job-line">
                    <div className="job-meta">
                      <strong>#{j.id}</strong> <em>{j.job_type}</em> — <span>{j.status}</span>
                      <div className="job-params">{JSON.stringify(j.params)}</div>
                    </div>
                    <div className="job-actions">
                      <button className="action-btn-sm" disabled={j.status !== 'interrupted' && j.status !== 'failed' && j.status !== 'paused' || actionLoading === `resume-${j.id}`} onClick={() => handleResumeJob(j.id)}>
                        {actionLoading === `resume-${j.id}` ? 'Resuming...' : 'Resume'}
                      </button>
                      <button className="action-btn-sm" onClick={async () => { const r = await adminAPI.getPopulateJob(j.id, token!); addLog(`Job ${j.id}: ${JSON.stringify(r.job)}`); }}>
                        Inspect
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'events' && (
          <section className="admin-section">
            <h2>🌍 Events Map - Global View ({events.length} total)</h2>
            <p style={{ color: '#888', marginBottom: '16px', fontSize: '0.9rem' }}>
              All events displayed globally. Zoom out to see countries, zoom in to see individual cities and events.
            </p>
            <AdminEventMap events={events} />
            <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#2a2a3e', borderRadius: '6px', fontSize: '0.85rem', color: '#9ca3af' }}>
              <p><strong>📍 Map Legend:</strong></p>
              <p>🔴 <strong>Red clusters</strong> = Countries (world view)</p>
              <p>🔵 <strong>Teal clusters</strong> = Cities (regional view)</p>
              <p>📌 <strong>Markers</strong> = Individual events (detailed view)</p>
              <p style={{ marginTop: '8px' }}>Cluster size increases with event count. Zoom in/out to change detail level.</p>
            </div>
          </section>
        )}

        {activeTab === 'users' && (
          <section className="admin-section">
            <h2>👥 Users Management ({users.length})</h2>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>{user.username}</td>
                      <td>{user.email}</td>
                      <td>{user.role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      {/* Confirmation Dialog */}
      {showConfirmDialog.show && (
        <div className="confirm-dialog-overlay">
          <div className="confirm-dialog">
            <h3>{showConfirmDialog.title}</h3>
            <p>{showConfirmDialog.message}</p>
            <div className="confirm-dialog-actions">
              <button
                className="action-btn danger"
                onClick={showConfirmDialog.action}
              >
                Confirm
              </button>
              <button
                className="action-btn secondary"
                onClick={() => setShowConfirmDialog({ show: false, title: '', message: '', action: () => {} })}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedAdminDashboard;