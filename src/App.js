import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import './App.css';

import VehicleTracker from './components/VehicleTracker';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import VehicleList from './pages/VehicleList';
import History from './pages/History';
import Settings from './pages/Settings';
import { AuthProvider } from './auth/AuthContext';
import ProtectedRoute from './auth/ProtectedRoute';

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <AppShell />
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

function AppShell() {
  const location = useLocation();
  const onDashboard = location.pathname === '/dashboard' || location.pathname === '/';
  // Header is shown only on authenticated routes via ProtectedRoute wrapper
  return (
    <Routes>
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <div className="app-layout">
              <Header />
              <div className="app-body">
                <Sidebar />
                <main className="main-content">
                  {/* Keep VehicleTracker mounted always to preserve data and socket */}
                  <div style={{ display: onDashboard ? 'block' : 'none', height: '100%' }}>
                    <VehicleTracker />
                  </div>
                  <Routes>
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<></>} />
                    <Route path="/vehicles" element={<VehicleList />} />
                    <Route path="/history" element={<History />} />
                    <Route path="/settings" element={<Settings />} />
                  </Routes>
                </main>
              </div>
            </div>
          </ProtectedRoute>
        }
      />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
