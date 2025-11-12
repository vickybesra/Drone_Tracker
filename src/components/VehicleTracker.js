import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import io from 'socket.io-client';
import 'leaflet/dist/leaflet.css';

// Vehicle styles (unchanged)
const vehicleStyles = {
  vehicle1: {
    icon: L.icon({
      iconUrl: '/images/tractor_2548747.png',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
    }),
    pathColor: 'blue'
  },
  // other vehicle styles...
};

const defaultStyle = {
  icon: L.icon({
    iconUrl: '/images/tractor_2548747.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  }),
  pathColor: 'red'
};

// Initial vehicle data
const initialVehicles = {
  vehicle1: {
    id: "vehicle1",
    name: "Vehicle 1",
    currentPosition: { lat: 22.317094, lng: 87.314139 },
    lastUpdateTime: Date.now(),
    path: []
  },
  // other vehicles...
};

function VehicleTracker() {
  const [vehicles, setVehicles] = useState(initialVehicles);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [focusPos, setFocusPos] = useState([22.317094, 87.314139]);
  const [filter, setFilter] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [historicalPaths, setHistoricalPaths] = useState({}); // { [id]: Array<{lat,lng,timestamp}> }
  const socketRef = useRef(null);
  const statusRef = useRef({}); // { [id]: 'moving'|'stopped'|'offline'|'idling' }
  
  useEffect(() => {
    // Socket initialization - only once
    if (!socketRef.current) {
      // Configure socket with proper parameters
      socketRef.current = io('http://localhost:8080', {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000
      });
      
      // Connection events
      socketRef.current.on('connect', () => {
        console.log('Connected to server');
        setConnectionStatus('connected');
      });
      
      socketRef.current.on('disconnect', (reason) => {
        console.log(`Disconnected: ${reason}`);
        setConnectionStatus('disconnected');
      });
      
      // Handle GPS data updates
      socketRef.current.on('gpsData', (data) => {
        console.log('Received GPS data:', data);
        
        if (!data) return;
        
        setVehicles(prevVehicles => {
          const newVehicles = { ...prevVehicles };
          
          // Process vehicle-like entries only (objects with current/path)
          Object.keys(data).forEach(vehicleId => {
            const entry = data[vehicleId];
            if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return;
            const hasCurrent = entry.current && (entry.current.latitude != null) && (entry.current.longitude != null);
            const hasPath = Array.isArray(entry.path);
            if (!hasCurrent && !hasPath) return;
            
            // Initialize vehicle if not exists
            if (!newVehicles[vehicleId]) {
              newVehicles[vehicleId] = {
                id: vehicleId,
                name: vehicleId,
                currentPosition: { lat: 0, lng: 0 },
                lastUpdateTime: Date.now(),
                path: [],
                fuel: { initial: 60, consumed: 0, demoPercent: 50 + Math.floor(Math.random() * 40) } // 50–90%
              };
            } else {
              // Ensure fuel structure exists
              if (!newVehicles[vehicleId].fuel) newVehicles[vehicleId].fuel = { initial: 60, consumed: 0, demoPercent: 50 + Math.floor(Math.random() * 40) };
              if (typeof newVehicles[vehicleId].fuel.demoPercent !== 'number') newVehicles[vehicleId].fuel.demoPercent = 50 + Math.floor(Math.random() * 40);
            }
            
            // Update current position
            if (hasCurrent) {
              newVehicles[vehicleId].currentPosition = {
                lat: parseFloat(entry.current.latitude),
                lng: parseFloat(entry.current.longitude)
              };
              newVehicles[vehicleId].lastUpdateTime = entry.current.timestamp || Date.now();
            }
            
            // Update path if available
            if (hasPath) {
              newVehicles[vehicleId].path = entry.path.map(point => ({
                lat: parseFloat(point.latitude),
                lng: parseFloat(point.longitude),
                timestamp: point.timestamp || Date.now()
              }));
            }

            // Demo fuel consumption: increment on movement
            const p = newVehicles[vehicleId].path;
            if (Array.isArray(p) && p.length >= 2) {
              const a = p[p.length - 2];
              const b = p[p.length - 1];
              const distKm = distanceMeters(a, b) / 1000;
              const f = newVehicles[vehicleId].fuel;
              if (distKm > 0.01) {
                const increment = distKm * 0.25; // 0.25 L per km demo
                f.consumed = Math.min(f.initial, parseFloat(((f.consumed || 0) + increment).toFixed(2)));
              }
              // Demo percent jitter (false data), small random walk
              const jitter = Math.floor(Math.random() * 5) - 2; // -2..+2
              let next = (typeof f.demoPercent === 'number' ? f.demoPercent : 60) + jitter;
              if (!Number.isFinite(next)) next = 60;
              f.demoPercent = Math.max(5, Math.min(95, next));
            }
          });
          
          return newVehicles;
        });

        // Recenter on the primary vehicle (vehicle1) or the first available
        const focusEntry = data.vehicle1 && data.vehicle1.current
          ? data.vehicle1
          : Object.values(data).find(v => v && typeof v === 'object' && v.current && v.current.latitude != null && v.current.longitude != null);
        if (focusEntry && focusEntry.current) {
          const lat = parseFloat(focusEntry.current.latitude);
          const lng = parseFloat(focusEntry.current.longitude);
          if (Number.isFinite(lat) && Number.isFinite(lng)) setFocusPos([lat, lng]);
        }
      });
    }
    
    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  // Auto-select when filter yields exactly one match
  useEffect(() => {
    const ids = Object.keys(vehicles).filter(id => {
      if (!filter) return true;
      const v = vehicles[id];
      const name = (v?.name || '').toLowerCase();
      return id.toLowerCase().includes(filter) || name.includes(filter);
    });
    if (ids.length === 1) setSelectedVehicleId(ids[0]);
  }, [filter, vehicles]);

  // Listen for explicit selection events
  useEffect(() => {
    const handler = (e) => {
      const id = String(e?.detail || '').trim();
      if (id && vehicles[id]) setSelectedVehicleId(id);
    };
    window.addEventListener('vehicle-selected', handler);
    return () => window.removeEventListener('vehicle-selected', handler);
  }, [vehicles]);
  
  // Broadcast connection status changes to header
  useEffect(() => {
    try {
      window.dispatchEvent(new CustomEvent('connection-status', { detail: connectionStatus }));
    } catch (_) {}
  }, [connectionStatus]);

  // Listen to vehicle filter events
  useEffect(() => {
    const handler = (e) => setFilter(String(e?.detail || '').toLowerCase());
    window.addEventListener('vehicle-filter', handler);
    return () => window.removeEventListener('vehicle-filter', handler);
  }, []);

  // Listen to vehicle-add events and add to local state
  useEffect(() => {
    const handler = (e) => {
      const d = e?.detail || {}; const id = String(d.id || '').trim();
      if (!id) return;
      const lat = Number(d.lat); const lng = Number(d.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      setVehicles((prev) => {
        const next = { ...prev };
        next[id] = next[id] || { id, name: id, currentPosition: { lat, lng }, lastUpdateTime: Date.now(), path: [] };
        // If exists, update position and append to path
        next[id].name = d.name ? String(d.name) : (next[id].name || id);
        next[id].currentPosition = { lat, lng };
        next[id].lastUpdateTime = Date.now();
        const point = { lat, lng, timestamp: Date.now() };
        next[id].path = Array.isArray(next[id].path) ? next[id].path.concat(point).slice(-500) : [point];
        return next;
      });
      setSelectedVehicleId(id);
      try { window.dispatchEvent(new CustomEvent('vehicle-selected', { detail: id })); } catch (_) {}
      setFocusPos([Number(d.lat), Number(d.lng)]);
    };
    window.addEventListener('vehicle-add', handler);
    return () => window.removeEventListener('vehicle-add', handler);
  }, []);

  // Derive status and capture historical path on offline transition
  useEffect(() => {
    const now = Date.now();
    const newStatus = {};
    const offlineThresholdMs = 2 * 60 * 1000; // 2 minutes
    const idleThresholdMs = 30 * 1000; // 30 seconds

    for (const id of Object.keys(vehicles)) {
      const v = vehicles[id];
      const lastTs = v?.lastUpdateTime || 0;
      const age = now - lastTs;
      let status = 'offline';
      if (age <= offlineThresholdMs) {
        // Within online window
        const p = v?.path || [];
        if (p.length >= 2) {
          const a = p[p.length - 2];
          const b = p[p.length - 1];
          const moved = distanceMeters(a, b) > 2; // >2m change counts as movement
          if (age <= idleThresholdMs && moved) status = 'moving';
          else if (age <= idleThresholdMs && !moved) status = 'idling';
          else status = 'stopped';
        } else {
          status = age <= idleThresholdMs ? 'idling' : 'stopped';
        }
      }
      newStatus[id] = status;
      // Detect transition to offline
      if ((statusRef.current[id] || 'offline') !== 'offline' && status === 'offline') {
        setHistoricalPaths((prev) => ({ ...prev, [id]: (vehicles[id]?.path || []).slice() }));
      }
    }
    statusRef.current = newStatus;

    // Broadcast vehicle list + status for sidebar
    try {
      const list = Object.keys(vehicles).map(id => ({ id, name: vehicles[id]?.name || id, status: newStatus[id] || 'offline' }));
      window.dispatchEvent(new CustomEvent('vehicles-state', { detail: { list } }));
    } catch (_) {}
  }, [vehicles]);
  
  return (
    <div className="map-container" style={{ position: 'relative', height: '100%', width: '100%' }}>
      
      <MapContainer 
        center={focusPos} 
        zoom={15} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <RecenterOnPosition position={focusPos} />
        
        {Object.keys(vehicles)
          .filter(id => {
            // If a specific filter is active, apply it; otherwise show all
            if (!filter || selectedVehicleId) return true;
            const v = vehicles[id];
            const name = (v?.name || '').toLowerCase();
            return id.toLowerCase().includes(filter) || name.includes(filter);
          })
          .map(id => {
          const vehicle = vehicles[id];
          const style = vehicleStyles[id] || defaultStyle;
          const pos = vehicle.currentPosition;
          
          if (!pos || pos.lat == null || pos.lng == null) return null;
          
          // Create path positions for polyline
          const pathPositions = vehicle.path && vehicle.path.length > 0
            ? vehicle.path.map(p => [p.lat, p.lng])
            : [];
          
          const isSelected = selectedVehicleId === id;
          const status = statusRef.current[id] || 'offline';

          return (
            <React.Fragment key={id}>
              {/* Historical previous path (if any) */}
              {Array.isArray(historicalPaths[id]) && historicalPaths[id].length > 1 && (
                <Polyline 
                  positions={historicalPaths[id].map(p => [p.lat, p.lng])}
                  color="#9e9e9e"
                  weight={3}
                  opacity={0.7}
                  dashArray="6,6"
                />
              )}

              {/* Current path */}
              {pathPositions.length > 1 && (
                <Polyline 
                  positions={pathPositions} 
                  color={style.pathColor} 
                  weight={isSelected ? 5 : 3} 
                  opacity={isSelected ? 0.95 : 0.7}
                />
              )}
              
              {/* Vehicle marker */}
              <Marker position={[pos.lat, pos.lng]} icon={style.icon} eventHandlers={{ click: () => {
                setSelectedVehicleId(id);
                try { window.dispatchEvent(new CustomEvent('vehicle-selected', { detail: id })); } catch (_) {}
                setFocusPos([pos.lat, pos.lng]);
              } }}>
                <Popup>
                  <div>
                    <h3>{vehicle.name}</h3>
                    <p>Status: {capitalize(status)}</p>
                    <p>Last Update: {new Date(vehicle.lastUpdateTime).toLocaleString()}</p>
                    <p>Position: {pos.lat.toFixed(6)}, {pos.lng.toFixed(6)}</p>
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          );
        })}
      </MapContainer>
      {/* Vehicle details panel */}
      <VehicleDetailsPanel 
        vehicle={selectedVehicleId ? vehicles[selectedVehicleId] : null}
        status={selectedVehicleId ? (statusRef.current[selectedVehicleId] || 'offline') : null}
        onClose={() => setSelectedVehicleId('')}
        historicalPath={selectedVehicleId ? (historicalPaths[selectedVehicleId] || []) : []}
      />
    </div>
  );
}

// Helper to recenter the map when position changes
function RecenterOnPosition({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position && Array.isArray(position) && position.length === 2) {
      map.setView(position);
    }
  }, [map, position]);
  return null;
}

function VehicleDetailsPanel({ vehicle, status, onClose, historicalPath }) {
  if (!vehicle) return null;
  const pos = vehicle.currentPosition || { lat: 0, lng: 0 };
  const last = vehicle.lastUpdateTime ? new Date(vehicle.lastUpdateTime).toLocaleString() : '—';

  return (
    <div className="vehicle-panel" role="dialog" aria-label="Vehicle details">
      <div className="vehicle-panel__header">
        <div className="vehicle-panel__title">{vehicle.id || vehicle.name}</div>
        <button className="vehicle-panel__close" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className="vehicle-panel__section">
        <div className="vehicle-panel__row"><span className="k">Status</span><span className="v">{capitalize(status || 'offline')}</span></div>
        <div className="vehicle-panel__row"><span className="k">Latitude</span><span className="v">{Number.isFinite(pos.lat) ? pos.lat.toFixed(6) : '—'}</span></div>
        <div className="vehicle-panel__row"><span className="k">Longitude</span><span className="v">{Number.isFinite(pos.lng) ? pos.lng.toFixed(6) : '—'}</span></div>
        <div className="vehicle-panel__row"><span className="k">Fuel Consumed</span><span className="v">{formatFuel(vehicle.fuel)}</span></div>
        <div className="vehicle-panel__row"><span className="k">Fuel Level</span><span className="v">{formatFuelPercent(vehicle.fuel)}</span></div>
        <div className="vehicle-panel__row"><span className="k">Last Update</span><span className="v">{last}</span></div>
      </div>
      <div className="vehicle-panel__tabs">
        <details>
          <summary>Historical Path (pre-shutdown)</summary>
          {Array.isArray(historicalPath) && historicalPath.length > 1 ? (
            <div className="vehicle-panel__hint">Displayed on map as a dashed grey line.</div>
          ) : (
            <div className="vehicle-panel__hint">No previous shutdown path captured yet.</div>
          )}
        </details>
      </div>
    </div>
  );
}

function distanceMeters(a, b) {
  if (!a || !b) return 0;
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371000; // meters
  const dLat = toRad((b.latitude ?? b.lat) - (a.latitude ?? a.lat));
  const dLon = toRad((b.longitude ?? b.lng) - (a.longitude ?? a.lng));
  const lat1 = toRad(a.latitude ?? a.lat);
  const lat2 = toRad(b.latitude ?? b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const c = 2 * Math.asin(Math.sqrt(sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon));
  return R * c;
}

function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatFuel(fuel) {
  if (!fuel) return '—';
  const initial = Number.isFinite(fuel.initial) ? fuel.initial : 0;
  const consumed = Number.isFinite(fuel.consumed) ? fuel.consumed : 0;
  return `${consumed.toFixed(1)} / ${initial.toFixed(0)} L`;
}
function formatFuelPercent(fuel) {
  if (!fuel) return '—';
  const p = Number.isFinite(fuel.demoPercent) ? fuel.demoPercent : 62;
  return `${Math.round(p)}%`;
}

export default VehicleTracker;
