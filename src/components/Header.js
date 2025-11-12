import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';

export default function Header() {
  const { logout, user } = useAuth();
  const [connStatus, setConnStatus] = useState('disconnected');
  useEffect(() => {
    const handler = (e) => {
      const s = e?.detail === 'connected' ? 'connected' : 'disconnected';
      setConnStatus(s);
    };
    window.addEventListener('connection-status', handler);
    return () => window.removeEventListener('connection-status', handler);
  }, []);

  return (
    <header className="app-header">
      <div className="app-header__content">
        <div className="app-header__brand">Machinery Tracker</div>
        <div className="status-chip" data-state={connStatus} aria-live="polite">
          {connStatus === 'connected' ? 'Connected' : 'Disconnected'}
        </div>
        <div className="app-header__spacer" />
        {user?.identifier && (
          <div className="app-header__user" aria-label="Signed in user">
            {user.identifier}
          </div>
        )}
        <button className="logout-button" onClick={logout} aria-label="Logout">
          Logout
        </button>
      </div>
    </header>
  );
}
