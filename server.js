const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const admin = require('firebase-admin');
const mqtt = require('mqtt');

// Initialize Firebase Admin
const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.DATABASE_URL || "https://tractortracker-6e60d-default-rtdb.firebaseio.com"
});

const db = admin.database();

// MQTT setup
const mqttBrokerUrl = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";
const mqttOptions = {};
if (process.env.MQTT_USERNAME) mqttOptions.username = process.env.MQTT_USERNAME;
if (process.env.MQTT_PASSWORD) mqttOptions.password = process.env.MQTT_PASSWORD;
const mqttClient = mqtt.connect(mqttBrokerUrl, mqttOptions);

mqttClient.on("connect", function () {
  console.log("Connected to MQTT broker");
  mqttClient.subscribe("tractor/gps", function (err) {
    if (!err) {
      console.log("Subscribed to topic: tractor/gps");
    } else {
      console.error("Subscription error:", err);
    }
  });
});

// Process incoming MQTT messages
mqttClient.on("message", function (topic, message) {
  // Only process expected topic(s)
  if (topic !== "tractor/gps") return;

  const raw = message.toString();
  console.log(`Received message on ${topic}: ${raw}`);

  try {
    const gpsData = JSON.parse(raw);

    // Validate and normalize input
    const latitude = Number(gpsData.latitude);
    const longitude = Number(gpsData.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      console.warn("Ignoring GPS update with non-numeric lat/lon", gpsData);
      return;
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      console.warn("Ignoring GPS update with out-of-range lat/lon", { latitude, longitude });
      return;
    }

    const timestamp = typeof gpsData.timestamp === 'number' && Number.isFinite(gpsData.timestamp)
      ? gpsData.timestamp
      : Date.now();

    const vehicleId = (gpsData.vehicleId && String(gpsData.vehicleId)) || "vehicle1";
    const baseRef = db.ref(`tractor/gps/${vehicleId}`);

    // Update current position (last known)
    baseRef.child("current").set({ latitude, longitude, timestamp });

    // Atomically append to path and trim to last 500 points
    const point = { latitude, longitude, timestamp };
    const pathRef = baseRef.child("path");
    pathRef.transaction((current) => {
      let arr = Array.isArray(current) ? current : [];
      arr = arr.concat(point);
      if (arr.length > 500) arr = arr.slice(-500);
      return arr;
    }, (error, committed) => {
      if (error) {
        console.error("Path transaction failed:", error);
      } else if (!committed) {
        console.warn("Path transaction not committed");
      }
    });
  } catch (error) {
    console.error("Error parsing MQTT message:", error);
  }
});

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Configure Socket.IO with increased timeouts
const io = socketIo(server, {
  cors: { origin: "*" },
  pingTimeout: 60000,         // Increased from default
  pingInterval: 25000,        // Default is 25000
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 1e8      // Increased buffer size for large payloads
});

io.on("connection", (socket) => {
  console.log("Client connected");
  
  // Send latest GPS data immediately
  db.ref("tractor/gps").once("value", (snapshot) => {
    if (snapshot.exists()) {
      socket.emit("gpsData", snapshot.val());
    }
  });
  
  // Log disconnect with reason
  socket.on("disconnect", (reason) => {
    console.log(`Client disconnected: ${reason}`);
  });
});

// Broadcast Firebase updates
db.ref("tractor/gps").on("value", (snapshot) => {
  const data = snapshot.val();
  io.emit("gpsData", data);
  console.log("Broadcasting new GPS data:", data);
});

// Error handling to prevent crashes
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

// Start server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
