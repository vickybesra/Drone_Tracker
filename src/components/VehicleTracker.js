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
  const socketRef = useRef(null);
  
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
                path: []
              };
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
  
  return (
    <div className="map-container" style={{ height: '100vh', width: '100%' }}>
      {/* Connection status indicator */}
      <div style={{ 
        position: 'absolute', 
        top: 10, 
        right: 10, 
        zIndex: 1000,
        padding: '5px 10px',
        backgroundColor: connectionStatus === 'connected' ? 'green' : 'red',
        color: 'white',
        borderRadius: '4px'
      }}>
        {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
      </div>
      
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
        
        {Object.keys(vehicles).map(id => {
          const vehicle = vehicles[id];
          const style = vehicleStyles[id] || defaultStyle;
          const pos = vehicle.currentPosition;
          
          if (!pos || pos.lat == null || pos.lng == null) return null;
          
          // Create path positions for polyline
          const pathPositions = vehicle.path && vehicle.path.length > 0
            ? vehicle.path.map(p => [p.lat, p.lng])
            : [];
          
          return (
            <React.Fragment key={id}>
              {/* Draw path as polyline */}
              {pathPositions.length > 1 && (
                <Polyline 
                  positions={pathPositions} 
                  color={style.pathColor} 
                  weight={3} 
                  opacity={0.7}
                />
              )}
              
              {/* Draw vehicle marker */}
              <Marker position={[pos.lat, pos.lng]} icon={style.icon}>
                <Popup>
                  <div>
                    <h3>{vehicle.name}</h3>
                    <p>Last Update: {new Date(vehicle.lastUpdateTime).toLocaleString()}</p>
                    <p>Path Points: {pathPositions.length}</p>
                    <p>Position: {pos.lat.toFixed(6)}, {pos.lng.toFixed(6)}</p>
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          );
        })}
      </MapContainer>
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

export default VehicleTracker;
