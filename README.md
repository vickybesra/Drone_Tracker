# Tractor Tracker — Local Development Guide

This app tracks vehicle positions and paths in real-time:
- Backend: Node/Express + Socket.IO + Firebase Admin + MQTT
- Frontend: React + React-Leaflet
- Data: Firebase Realtime Database (RTDB)

## Prerequisites
- Node.js (>= 18) and npm
- A Firebase project with Realtime Database enabled
- Admin SDK key saved as `serviceAccountKey.json` in the project root
- An MQTT broker reachable at `mqtt://localhost:1883`

> Note: The backend reads RTDB URL from `server.js`. Ensure it matches your project.

## 1) Install dependencies
```bash
npm install
```

## 2) Start an MQTT broker (local)
You can run a local broker using Aedes CLI:
```bash
npx @aedes/cli -p 1883
```
Keep it running in a separate terminal. Alternatively, use Mosquitto (brew or docker).

## 3) Start the backend (Socket.IO + Firebase)
```bash
npm run server
```
- URL: `http://localhost:8080`
- Subscribes to: `tractor/gps`
- Writes to RTDB at: `tractor/gps/{vehicleId}` with:
  - `current`: `{ latitude, longitude, timestamp }`
  - `path`: array of points (kept to the latest 500)

## 4) Start the frontend (React)
```bash
npm start
```
- URL: `http://localhost:3000`
- Connects to Socket.IO on `http://localhost:8080`
- Displays vehicle markers and paths on the map

## 5) Publish a test GPS message
Use any MQTT client. Examples:

Node one-liner:
```bash
node -e "const m=require('mqtt');const c=m.connect('mqtt://localhost:1883',{username:'myuser',password:'1234'});c.on('connect',()=>{const msg=JSON.stringify({vehicleId:'vehicle1',latitude:22.573,longitude:88.364,timestamp:Date.now()});c.publish('tractor/gps', msg, {}, ()=>c.end());});setTimeout(()=>process.exit(0),1500);"
```

Mosquitto:
```bash
mosquitto_pub -h localhost -t tractor/gps -m '{"vehicleId":"vehicle1","latitude":22.573,"longitude":88.364,"timestamp":1731234567890}'
```

## 6) Verify it works
- Frontend shows a "Connected" badge and a tractor marker
- Firebase RTDB updates at `tractor/gps/vehicle1/current` and `tractor/gps/vehicle1/path`

## Scripts
- `npm start` — start React dev server (frontend)
- `npm run server` — start Node backend (`server.js`)
- `npm run build` — production build for frontend
- `npm test` — run CRA tests

## Troubleshooting
- Firebase Admin "invalid_grant: Invalid JWT Signature"
  - Ensure `serviceAccountKey.json` is valid (new key from Firebase console)
  - Keep PEM line breaks intact; confirm the correct `databaseURL` in `server.js`
- No marker on the map
  - Make sure GPS messages are being published to `tractor/gps`
  - The app auto recenters to the latest vehicle — send a new point if needed
  - Confirm the marker icon is served: `http://localhost:3000/images/tractor_2548747.png`
- Port conflicts
  - Frontend: 3000; Backend: 8080; MQTT: 1883 — stop other processes or change ports
- MQTT auth
  - The sample uses `{ username: "myuser", password: "1234" }` in code, but Aedes accepts by default; adjust if your broker enforces auth

## Data model (RTDB)
```
tractor/gps/{vehicleId}/
  current: { latitude: number, longitude: number, timestamp: number }
  path: Array<{ latitude: number, longitude: number, timestamp: number }>
```
