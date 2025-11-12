import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

function iconFor(name) {
  switch (name) {
    case 'dashboard':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" fill="currentColor"/></svg>
      );
    case 'list':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z" fill="currentColor"/></svg>
      );
    case 'history':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13 3a9 9 0 100 18 9 9 0 000-18zm0 4h-1v6l5 3 .5-.8-4.5-2.7V7z" fill="currentColor"/></svg>
      );
    case 'settings':
    default:
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19.14 12.94c.04-.3.06-.62.06-.94s-.02-.64-.06-.94l2.03-1.58a.5.5 0 00.12-.64l-1.92-3.32a.5.5 0 00-.6-.22l-2.39.96a7.007 7.007 0 00-1.62-.94l-.36-2.54A.5.5 0 0012.4 1h-3.8a.5.5 0 00-.5.42l-.36 2.54c-.58.22-1.12.52-1.62.94l-2.39-.96a.5.5 0 00-.6.22L.41 7.02a.5.5 0 00.12.64L2.56 9.24c-.04.3-.06.62-.06.94s.02.64.06.94L.53 12.7a.5.5 0 00-.12.64l1.92 3.32c.14.24.44.34.7.22l2.39-.96c.5.42 1.04.72 1.62.94l.36 2.54c.04.24.25.42.5.42h3.8c.25 0 .46-.18.5-.42l.36-2.54c.58-.22 1.12-.52 1.62-.94l2.39.96c.26.12.56.02.7-.22l1.92-3.32a.5.5 0 00-.12-.64l-2.03-1.58zM10.5 15A3.5 3.5 0 1114 11.5 3.5 3.5 0 0110.5 15z" fill="currentColor"/></svg>
      );
  }
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return sessionStorage.getItem('ui.sidebar.collapsed') === '1';
    } catch (_) {
      return false;
    }
  });
  const [query, setQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newLat, setNewLat] = useState('');
  const [newLng, setNewLng] = useState('');
  const [formError, setFormError] = useState('');

  const [vehicles, setVehicles] = useState([]); // [{id,name,status}]
  const [selectedId, setSelectedId] = useState('');

  const location = useLocation();

  // persist collapse state
  useEffect(() => {
    try { sessionStorage.setItem('ui.sidebar.collapsed', collapsed ? '1' : '0'); } catch (_) {}
  }, [collapsed]);

  // Broadcast vehicle filter to map
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        window.dispatchEvent(new CustomEvent('vehicle-filter', { detail: query }));
      } catch (_) {}
    }, 200);
    return () => clearTimeout(id);
  }, [query]);

  // Listen to vehicles-state from map
  useEffect(() => {
    const handler = (e) => {
      const list = e?.detail?.list || [];
      setVehicles(Array.isArray(list) ? list : []);
    };
    window.addEventListener('vehicles-state', handler);
    return () => window.removeEventListener('vehicles-state', handler);
  }, []);

  // Track selected ID
  useEffect(() => {
    const handler = (e) => setSelectedId(String(e?.detail || '').trim());
    window.addEventListener('vehicle-selected', handler);
    return () => window.removeEventListener('vehicle-selected', handler);
  }, []);

  // Clear filter when leaving dashboard (optional)
  useEffect(() => {
    if (!location.pathname.startsWith('/dashboard')) return;
  }, [location.pathname]);

  const links = useMemo(() => ([
    { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { to: '/vehicles', label: 'Vehicle List', icon: 'list' },
    { to: '/history', label: 'History/Reports', icon: 'history' },
    { to: '/settings', label: 'Settings', icon: 'settings' },
  ]), []);

  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`} aria-label="Primary Navigation">
      <div className="sidebar__top">
        {!collapsed && <div className="sidebar__title">Navigation</div>}
        <button className="sidebar__toggle" onClick={() => setCollapsed((c) => !c)} aria-pressed={collapsed} aria-label="Toggle sidebar">
          {collapsed ? '»' : '«'}
        </button>
      </div>

      {/* Vehicle ID filter */}
      <div className="sidebar__filter">
        {collapsed ? (
          <input
            className="sidebar__filter-input"
            title="Search Vehicle ID"
            placeholder="Filter ID…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                try {
                  window.dispatchEvent(new CustomEvent('vehicle-selected', { detail: e.currentTarget.value }));
                } catch (_) {}
              }
            }}
          />
        ) : (
          <>
            <label htmlFor="vehicleFilter" className="sidebar__filter-label">Search Vehicle ID</label>
            <input
              id="vehicleFilter"
              className="sidebar__filter-input"
              placeholder="Search Vehicle ID (e.g., VEH-001)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  try {
                    window.dispatchEvent(new CustomEvent('vehicle-selected', { detail: e.currentTarget.value }));
                  } catch (_) {}
                }
              }}
            />
          </>
        )}
      </div>

      <nav className="sidebar__nav">
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} className={({ isActive }) => `sidebar__link${isActive ? ' active' : ''}`}>
            <span className="icon" aria-hidden="true">{iconFor(l.icon)}</span>
            <span className="label">{l.label}</span>
          </NavLink>
        ))}

        {/* Dynamic vehicle list */}
        <div className="sidebar__section-title">Vehicles</div>
        <ul className="sidebar__list" role="list">
          {vehicles
            .filter(v => {
              if (!query) return true;
              const q = query.toLowerCase();
              return v.id.toLowerCase().includes(q) || (v.name || '').toLowerCase().includes(q);
            })
            .map(v => (
              <li key={v.id}>
                <button
                  type="button"
                  className={`sidebar__item${selectedId === v.id ? ' selected' : ''}`}
                  onClick={() => {
                    try {
                      window.dispatchEvent(new CustomEvent('vehicle-selected', { detail: v.id }));
                      window.dispatchEvent(new CustomEvent('vehicle-filter', { detail: '' }));
                    } catch (_) {}
                  }}
                >
                  <span className={`status-dot ${v.status || 'offline'}`} aria-hidden="true"></span>
                  <span className="veh-id">{v.id}</span>
                  <span className="veh-name">{v.name !== v.id ? v.name : ''}</span>
                </button>
              </li>
            ))}
        </ul>
      </nav>

      {/* Add vehicle section */}
      <div className="sidebar__add">
        <button className="sidebar__add-btn" onClick={() => setShowAdd((s) => !s)} aria-expanded={showAdd}>
          {showAdd ? 'Cancel' : 'Add Vehicle'}
        </button>
        {showAdd && (
          <form className="sidebar__add-form" onSubmit={(e) => {
            e.preventDefault();
            setFormError('');
            const id = newId.trim();
            const name = newName.trim();
            const lat = parseFloat(String(newLat));
            const lng = parseFloat(String(newLng));
            if (!id) { setFormError('Vehicle ID is required'); return; }
            if (!Number.isFinite(lat) || lat < -90 || lat > 90) { setFormError('Latitude must be between -90 and 90'); return; }
            if (!Number.isFinite(lng) || lng < -180 || lng > 180) { setFormError('Longitude must be between -180 and 180'); return; }
            try {
              window.dispatchEvent(new CustomEvent('vehicle-add', { detail: { id, name, lat, lng } }));
            } catch (_) {}
            setNewId(''); setNewName(''); setNewLat(''); setNewLng(''); setShowAdd(false);
          }}>
            {formError && <div className="sidebar__add-error" role="alert">{formError}</div>}
            <label htmlFor="newId" className="sidebar__filter-label">Vehicle ID</label>
            <input id="newId" className="sidebar__filter-input" placeholder="e.g., vehicle2" value={newId} onChange={(e) => setNewId(e.target.value)} />
            {!collapsed && (
              <>
                <label htmlFor="newName" className="sidebar__filter-label">Name (optional)</label>
                <input id="newName" className="sidebar__filter-input" placeholder="Display name" value={newName} onChange={(e) => setNewName(e.target.value)} />
              </>
            )}
            <div className="sidebar__coord-row">
              <div>
                <label htmlFor="newLat" className="sidebar__filter-label">Latitude</label>
                <input id="newLat" type="number" step="any" className="sidebar__filter-input" placeholder="e.g., 22.317094" value={newLat} onChange={(e) => setNewLat(e.target.value)} />
              </div>
              <div>
                <label htmlFor="newLng" className="sidebar__filter-label">Longitude</label>
                <input id="newLng" type="number" step="any" className="sidebar__filter-input" placeholder="e.g., 87.314139" value={newLng} onChange={(e) => setNewLng(e.target.value)} />
              </div>
            </div>
            <button type="submit" className="sidebar__add-submit">Add</button>
          </form>
        )}
      </div>
    </aside>
  );
}
