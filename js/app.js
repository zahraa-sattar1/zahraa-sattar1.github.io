/**
 * @module app
 * @description Main application controller for the buoy telemetry dashboard.
 *
 * Responsibilities:
 * - Initialize Firestore connection and subscribe to real-time readings
 * - Fall back to mock data with 3-second timeout if Firestore unavailable
 * - Manage application state (current packet, connection status)
 * - Render UI updates based on incoming telemetry
 * - Generate threshold-based alerts (low battery, weak signal)
 * - Format timestamps for display
 * - Update mini-charts with historical data
 * - Handle cleanup on page unload
 *
 * Architecture:
 * ```
 * Firebase Firestore
 *         ↓
 *   [Real-time subscription via firestore-service.js]
 *         ↓
 *   [normalize data via data-adapter.js]
 *         ↓
 *   [render UI functions + chart updates]
 * ```
 */

import { UI_CONFIG } from "./config.js";
import { normalizeIncomingPacket } from "./data-adapter.js";
import { subscribeToReadings } from "./firestore-service.js";
import { initializeCharts, updateCharts } from "./chart-manager.js";

/**
 * Application state
 * @type {Object}
 */
const state = {
  packetIndex: 0,
  packets: [],
  useMockData: false,
  firebaseUnsubscribe: null
};

const el = {
  firebaseStatusBadge: document.getElementById("firebaseStatusBadge"),
  connectionBadge: document.getElementById("connectionBadge"),
  lastUpdate: document.getElementById("lastUpdate"),
  packetCount: document.getElementById("packetCount"),
  dataRate: document.getElementById("dataRate"),
  firmware: document.getElementById("firmware"),
  gateway: document.getElementById("gateway"),
  alertsList: document.getElementById("alertsList"),
  metric: {
    temperature: {
      value: document.getElementById("temperatureValue"),
      meta: document.getElementById("temperatureMeta")
    },
    par: {
      value: document.getElementById("parValue"),
      meta: document.getElementById("parMeta")
    },
    bbp: {
      value: document.getElementById("bbpValue"),
      meta: document.getElementById("bbpMeta")
    },
    depth: {
      value: document.getElementById("depthValue"),
      meta: document.getElementById("depthMeta")
    },
    battery: {
      value: document.getElementById("batteryValue"),
      meta: document.getElementById("batteryMeta")
    },
    signal: {
      value: document.getElementById("signalValue"),
      meta: document.getElementById("signalMeta")
    }
  }
};

function updateFirebaseStatus(status, message) {
  const colors = {
    connected: { bg: "#4CAF50", label: "🟢 Firebase Connected" },
    fallback: { bg: "#FFA500", label: "🟠 Firebase Error / Using Mock Data" },
    initializing: { bg: "#FFA500", label: "⏳ Initializing..." },
    noData: { bg: "#f44336", label: "🔴 No Data Available" }
  };
  
  const config = colors[status] || colors.initializing;
  el.firebaseStatusBadge.textContent = config.label;
  el.firebaseStatusBadge.style.background = config.bg;
  console.log(`Firebase Status: ${config.label}`);
}

// Initialize charts on page load
document.addEventListener('DOMContentLoaded', () => {
  initializeCharts();
});

init();

async function init() {
  try {
    // Try Firebase first
    console.log("Initializing Firestore connection...");
    updateFirebaseStatus("initializing");
    
    // Use a default buoy ID or get from URL parameter
    const buoyId = new URLSearchParams(window.location.search).get("buoy") || "buoy-001";
    console.log(`Looking for buoy: ${buoyId}`);
    
    // Subscribe to Firestore readings
    state.firebaseUnsubscribe = subscribeToReadings(buoyId, (firestoreData) => {
      if (firestoreData && firestoreData.length > 0) {
        // Got Firebase data
        state.packets = firestoreData;
        state.packetIndex = 0;
        state.useMockData = false;
        console.log("✓ Connected to Firestore");
        updateFirebaseStatus("connected");
        renderFromPacket(firestoreData[0]);
      } else if (!state.useMockData) {
        // Firebase has no data, try mock data
        console.log("Firestore has no data for this buoy, checking for mock data...");
        loadMockDataAsFallback();
      }
    });

    // Set a timeout to fall back to mock data if Firebase doesn't respond
    setTimeout(() => {
      if (state.packets.length === 0 && !state.useMockData) {
        console.warn("Firebase timeout, falling back to mock data");
        loadMockDataAsFallback();
      }
    }, 3000);

  } catch (err) {
    console.error("Firebase init error:", err);
    loadMockDataAsFallback();
  }
}

async function loadMockDataAsFallback() {
  try {
    state.useMockData = true;
    console.log("Loading mock data as fallback...");
    const response = await fetch("./data/mock-readings.json");
    const data = await response.json();
    
    if (!data || data.length === 0) {
      console.warn("Mock data is empty or unavailable");
      updateFirebaseStatus("noData");
      renderErrorState("No data available - please add test data to Firestore at: https://console.firebase.google.com/project/phytowatch/firestore");
      return;
    }

    state.packets = data;
    updateFirebaseStatus("fallback");
    console.log(`Using mock data (${state.packets.length} readings)`);
    renderFromNextPacket();
    setInterval(renderFromNextPacket, UI_CONFIG.refreshMs);
  } catch (err) {
    console.error("Error loading mock data:", err);
    updateFirebaseStatus("noData");
    renderErrorState(err.message);
  }
}

function renderFromNextPacket() {
  const rawPacket = state.packets[state.packetIndex % state.packets.length];
  state.packetIndex += 1;

  renderFromPacket(rawPacket);
}

function renderFromPacket(rawPacket) {
  const packet = normalizeIncomingPacket(rawPacket);
  renderTopbar(packet);
  renderMetrics(packet);
  renderHealth(packet);
  renderAlerts(packet);
  updateCharts(packet.readings, packet.timestamp);
}

function renderTopbar(packet) {
  const online = packet.connection === "online";
  el.connectionBadge.textContent = online ? "Online" : "Offline";
  el.connectionBadge.className = `badge ${online ? "online" : "offline"}`;
  el.lastUpdate.textContent = `Last update: ${formatTime(packet.timestamp)}`;
}

function renderMetrics(packet) {
  const metrics = ['temperature', 'par', 'bbp', 'depth', 'battery', 'signal'];
  
  metrics.forEach((key) => {
    const value = packet.readings[key];
    const unit = UI_CONFIG.units[key] || "";
    const target = el.metric[key];

    if (value === null || value === undefined) {
      target.value.textContent = "--";
      target.meta.textContent = "No data";
      return;
    }

    // Format number to 1-2 decimal places for readability
    const displayValue = typeof value === 'number' 
      ? (Math.abs(value) > 100 ? value.toFixed(1) : value.toFixed(2))
      : value;
    
    target.value.textContent = displayValue;
    target.meta.textContent = UI_CONFIG.labels[key];
  });
}

function renderHealth(packet) {
  el.packetCount.textContent = String(packet.packetCount);
  el.dataRate.textContent = packet.dataRate;
  el.firmware.textContent = packet.firmware;
  el.gateway.textContent = packet.gateway;
}

function renderAlerts(packet) {
  const alerts = [];

  if (packet.readings.battery !== null && packet.readings.battery !== undefined && packet.readings.battery <= UI_CONFIG.thresholds.batteryLow) {
    alerts.push({ level: "warning", text: `Low battery: ${packet.readings.battery}%` });
  }

  if (packet.readings.signal !== null && packet.readings.signal !== undefined && packet.readings.signal <= UI_CONFIG.thresholds.signalWeak) {
    alerts.push({ level: "warning", text: `Weak signal: ${packet.readings.signal} dBm` });
  }

  if (packet.connection !== "online") {
    alerts.push({ level: "critical", text: "Buoy is offline or not reporting" });
  }

  el.alertsList.innerHTML = "";

  if (alerts.length === 0) {
    const item = document.createElement("li");
    item.className = "alert-item neutral";
    item.textContent = "No active alerts";
    el.alertsList.appendChild(item);
    return;
  }

  alerts.forEach((alert) => {
    const item = document.createElement("li");
    item.className = `alert-item ${alert.level}`;
    item.textContent = alert.text;
    el.alertsList.appendChild(item);
  });
}

function renderErrorState(message) {
  el.lastUpdate.textContent = "Last update: error";
  el.alertsList.innerHTML = `<li class="alert-item critical">Data load error: ${message}</li>`;
}

function formatTime(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "--" : d.toLocaleString();
}

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  if (state.firebaseUnsubscribe) {
    state.firebaseUnsubscribe();
  }
});

