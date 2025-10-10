const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const admin = require('firebase-admin');
const mqtt = require('mqtt');

// Initialize Firebase Admin
const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://tractortracker-6e60d-default-rtdb.firebaseio.com"
});

const db = admin.database();

// MQTT setup
const mqttBrokerUrl = "mqtt://localhost:1883";
const mqttOptions = { username: "myuser", password: "1234" };
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
  console.log(`Received message on ${topic}: ${message.toString()}`);
  try {
    const gpsData = JSON.parse(message.toString());
    const timestamp = Date.now();
    
    // Update current position with consistent structure
    db.ref(`tractor/gps/vehicle1/current`).set({
      latitude: gpsData.latitude,
      longitude: gpsData.longitude,
      timestamp: timestamp
    });
    
    // Get and update path array
    db.ref(`tractor/gps/vehicle1/path`).once("value", (snapshot) => {
      let pathArray = [];
      
      if (snapshot.exists()) {
        const pathData = snapshot.val();
        if (Array.isArray(pathData)) {
          pathArray = pathData;
        }
      }
      
      // Add new position to path
      pathArray.push({
        latitude: gpsData.latitude,
        longitude: gpsData.longitude,
        timestamp: timestamp
      });
      
      // Limit path length to 500 points
      if (pathArray.length > 500) {
        pathArray = pathArray.slice(-500);
      }
      
      // Save updated path
      db.ref(`tractor/gps/vehicle1/path`).set(pathArray);
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
