import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function VehicleList() {
  const [vehicles, setVehicles] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e) => {
      const list = e?.detail?.list || [];
      setVehicles(Array.isArray(list) ? list : []);
    };
    window.addEventListener('vehicles-state', handler);
    return () => window.removeEventListener('vehicles-state', handler);
  }, []);

  useEffect(() => {
    const handler = (e) => setSelectedId(String(e?.detail || '').trim());
    window.addEventListener('vehicle-selected', handler);
    return () => window.removeEventListener('vehicle-selected', handler);
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <h2>Vehicle List</h2>
      <div style={{ marginTop: 8 }}>
        {vehicles.length === 0 ? (
          <p>No vehicles yet. Add one from the sidebar.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: '8px' }}>ID</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: '8px' }}>Name</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: '8px' }}>Status</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: '8px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map(v => (
                <tr key={v.id} style={{ background: selectedId === v.id ? 'rgba(91,141,239,0.08)' : 'transparent' }}>
                  <td style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}>{v.id}</td>
                  <td style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}>{v.name}</td>
                  <td style={{ padding: '8px', borderBottom: '1px solid #f1f5f9', textTransform: 'capitalize' }}>{v.status || 'offline'}</td>
                  <td style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}>
                    <button
                      onClick={() => {
                        try {
                          window.dispatchEvent(new CustomEvent('vehicle-selected', { detail: v.id }));
                          window.dispatchEvent(new CustomEvent('vehicle-filter', { detail: '' }));
                        } catch (_) {}
                        navigate('/dashboard');
                      }}
                    >
                      View on Map
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
