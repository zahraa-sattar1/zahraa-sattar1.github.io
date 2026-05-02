/**
 * @module app
 * @description Main application controller for the buoy telemetry dashboard.
 *
 * Responsibilities:
 * - Initialize Firestore connection and subscribe to real-time readings
 * - Fall back to mock data with a 3-second timeout if Firestore unavailable
 * - Manage application state (current packet, connection status)
 * - Render the five key measurements and their history charts
 * - Open enlarged measurement charts with point inspection
 * - Generate threshold-based alerts (low battery, offline status)
 * - Format timestamps for display
 * - Handle cleanup on page unload
 */

import { UI_CONFIG } from "./config.js";
import { normalizeIncomingPacket } from "./data-adapter.js";
import { subscribeToReadings, subscribeToBuoys } from "./firestore-service.js";
import {
  initializeCharts,
  updateCharts,
  getChartSeries,
  getMeasurementConfig,
  getLatestPoint,
  getMeasurementKeys,
  clearCharts
} from "./chart-manager.js";

if (window.__PHYTOWATCH_APP_STARTED__) {
  console.warn("[App] Duplicate bootstrap prevented");
} else {
  window.__PHYTOWATCH_APP_STARTED__ = true;

  const state = {
    packetIndex: 0,
    packets: [],
    useMockData: false,
    firebaseUnsubscribe: null,
    buoysUnsubscribe: null,
    mockRefreshTimer: null,
    firebaseFallbackTimer: null,
    lastRenderedFirebaseKey: null,
    lastFirebaseSnapshotSignature: null,
    hasLiveFirebaseData: false,
    currentFirebaseStatus: null,
    activeMeasurementKey: null,
    activePointIndex: null,
    modalFilterStart: "",
    modalFilterEnd: ""
  };

const el = {
  buoySelector: document.getElementById("buoySelector"),
  downloadAllCsv: document.getElementById("downloadAllCsv"),
  firebaseStatusBadge: document.getElementById("firebaseStatusBadge"),
  lastUpdate: document.getElementById("lastUpdate"),
  iridiumCsq: document.getElementById("iridiumCsq"),
  sdStorage: document.getElementById("sdStorage"),
  gpsFix: document.getElementById("gpsFix"),
  uptime: document.getElementById("uptime"),
  alertsList: document.getElementById("alertsList"),
  measurementModal: document.getElementById("measurementModal"),
  measurementModalClose: document.getElementById("measurementModalClose"),
  measurementModalSensor: document.getElementById("measurementModalSensor"),
  measurementModalTitle: document.getElementById("measurementModalTitle"),
  measurementModalSummary: document.getElementById("measurementModalSummary"),
  measurementModalPoint: document.getElementById("measurementModalPoint"),
  measurementFilterStart: document.getElementById("measurementFilterStart"),
  measurementFilterEnd: document.getElementById("measurementFilterEnd"),
  measurementFilterApply: document.getElementById("measurementFilterApply"),
  measurementFilterReset: document.getElementById("measurementFilterReset"),
  measurementReadingList: document.getElementById("measurementReadingList"),
  expandedChart: document.getElementById("expandedChart"),
  metric: {
    par: {
      value: document.getElementById("parValue"),
      meta: document.getElementById("parMeta")
    },
    bbp: {
      value: document.getElementById("bbpValue"),
      meta: document.getElementById("bbpMeta")
    },
    pressure: {
      value: document.getElementById("pressureValue"),
      meta: document.getElementById("pressureMeta")
    },
    temperature: {
      value: document.getElementById("temperatureValue"),
      meta: document.getElementById("temperatureMeta")
    },
    battery: {
      value: document.getElementById("batteryValue"),
      meta: document.getElementById("batteryMeta")
    }
  }
};

const metricCards = Array.from(document.querySelectorAll(".metric-card--interactive"));
let expandedChart = null;

function initPhytoplanktonBackground() {
  const canvas = document.getElementById("phytoplanktonCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let width = canvas.width = window.innerWidth;
  let height = canvas.height = window.innerHeight;

  window.addEventListener("resize", () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  const particles = [];
  // Scale number of particles based on screen size so it isn't overwhelming on mobile
  const particleCount = Math.min(150, Math.floor((width * height) / 8000));

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      //sizes
      r: Math.random() * 10.5 + 1.5,
      baseVx: (Math.random() - 0.5) * 0.3,
      baseVy: (Math.random() - 0.5) * 0.3 - 0.2, // Drift slightly upwards
      phase: Math.random() * Math.PI * 2,
      opacityMultiplier: Math.random() * 0.5 + 0.5,
      color: Math.random() > 0.3 ? "110, 231, 183" : "56, 189, 248" // Mix of emerald and bioluminescent blue
    });
  }

  let time = 0;
  function animate() {
    ctx.clearRect(0, 0, width, height);
    time += 0.01;

    particles.forEach((p) => {
      // Add gentle wavy motion mimicking water currents using sine waves
      p.x += p.baseVx + Math.sin(time + p.phase) * 0.2;
      p.y += p.baseVy + Math.cos(time + p.phase) * 0.1;

      // Wrap around screen edges smoothly
      if (p.x < -10) p.x = width + 10;
      if (p.x > width + 10) p.x = -10;
      if (p.y < -10) p.y = height + 10;
      if (p.y > height + 10) p.y = -10;

      // Bioluminescent pulsing effect
      const pulse = (Math.sin(time * 3 + p.phase) + 1) / 2;
      const opacity = pulse * p.opacityMultiplier;

      // Draw the bright core
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.color}, ${opacity})`;
      ctx.fill();

      // Draw a larger, faint glow around the core
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.color}, ${opacity * 0.3})`;
      ctx.fill();
    });

    requestAnimationFrame(animate);
  }
  animate();
}

function startApp() {
  initBuoySelector();
  initPhytoplanktonBackground();
  initializeCharts();
  setupMeasurementInteractions();
  init();
}

function initBuoySelector() {
  if (!el.buoySelector) return;
  
  const currentBuoy = new URLSearchParams(window.location.search).get("buoy") || "buoy-001";
  el.buoySelector.innerHTML = `<option value="${currentBuoy}">${currentBuoy}</option>`;
  el.buoySelector.value = currentBuoy;

  el.buoySelector.addEventListener("change", (e) => {
    const url = new URL(window.location.href);
    url.searchParams.set("buoy", e.target.value);
    window.location.href = url.toString();
  });

  state.buoysUnsubscribe = subscribeToBuoys((buoys) => {
    if (!buoys || buoys.length === 0) return;
    
    const selectedValue = el.buoySelector.value;
    el.buoySelector.innerHTML = "";
    
    let foundCurrent = false;
    buoys.forEach((b) => {
      const opt = document.createElement("option");
      opt.value = b.id;
      opt.textContent = b.name ? `${b.name} (${b.id})` : b.id;
      el.buoySelector.appendChild(opt);
      if (b.id === selectedValue) foundCurrent = true;
    });

    if (foundCurrent) {
      el.buoySelector.value = selectedValue;
    } else {
      const opt = document.createElement("option");
      opt.value = selectedValue;
      opt.textContent = selectedValue;
      el.buoySelector.appendChild(opt);
      el.buoySelector.value = selectedValue;
    }
  });
}

function checkAuth() {
  const overlay = document.getElementById("loginOverlay");
  const passInput = document.getElementById("sitePassword");
  const loginBtn = document.getElementById("loginBtn");
  const loginError = document.getElementById("loginError");

  if (!overlay) {
    startApp();
    return;
  }

  if (sessionStorage.getItem("siteUnlocked") === "true") {
    overlay.style.display = "none";
    startApp();
    return;
  }

  const attemptLogin = () => {
    if (passInput.value === "rightophyto") {  
      sessionStorage.setItem("siteUnlocked", "true");
      overlay.style.display = "none";
      startApp();
    } else {
      loginError.style.display = "block";
    }
  };

  loginBtn.addEventListener("click", attemptLogin);
  passInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") attemptLogin();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", checkAuth, { once: true });
} else {
  checkAuth();
}

function updateFirebaseStatus(status) {
  if (state.currentFirebaseStatus === status) {
    return;
  }

  const colors = {
    connected: { bg: "#4CAF50", label: "Firebase Connected" },
    fallback: { bg: "#FFA500", label: "Firebase Error / Using Mock Data" },
    initializing: { bg: "#FFA500", label: "Initializing..." },
    noData: { bg: "#f44336", label: "No Data Available" }
  };

  const config = colors[status] || colors.initializing;
  el.firebaseStatusBadge.textContent = config.label;
  el.firebaseStatusBadge.style.background = config.bg;
  state.currentFirebaseStatus = status;
  console.log(`Firebase Status: ${config.label}`);
}

function getFirebaseSnapshotSignature(readings) {
  if (!readings || readings.length === 0) {
    return "empty";
  }

  const latest = normalizeIncomingPacket(readings[0]);
  return `${latest.timestamp}|${readings.length}`;
}

function renderFirebaseSnapshot(readings) {
  const latestPacket = normalizeIncomingPacket(readings[0]);

  clearCharts();

  const chronologicalPackets = [...readings].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  chronologicalPackets.forEach((packet) => {
    const normalizedPacket = normalizeIncomingPacket(packet);
    updateCharts(normalizedPacket.readings, normalizedPacket.timestamp);
  });

  renderTopbar(latestPacket);
  renderMetrics(latestPacket);
  renderHealth(latestPacket);
  renderAlerts(latestPacket);

  if (state.activeMeasurementKey) {
    refreshExpandedMeasurementModal();
  }

  state.lastRenderedFirebaseKey = latestPacket.timestamp;
}

function setupMeasurementInteractions() {
  metricCards.forEach((card) => {
    const sensorKey = card.dataset.key;

    card.addEventListener("click", () => openMeasurementModal(sensorKey));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openMeasurementModal(sensorKey);
      }
    });
  });

  el.measurementModalClose?.addEventListener("click", closeMeasurementModal);
  el.measurementModal?.addEventListener("click", (event) => {
    if (event.target?.dataset?.modalClose !== undefined) {
      closeMeasurementModal();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && el.measurementModal?.classList.contains("is-open")) {
      closeMeasurementModal();
    }
  });

  el.measurementFilterApply?.addEventListener("click", () => {
    if (!state.activeMeasurementKey) {
      return;
    }

    state.modalFilterStart = el.measurementFilterStart?.value || "";
    state.modalFilterEnd = el.measurementFilterEnd?.value || "";
    state.activePointIndex = null;
    refreshExpandedMeasurementModal();
  });

  el.measurementFilterReset?.addEventListener("click", () => {
    if (!state.activeMeasurementKey) {
      return;
    }

    applyModalDefaultRange(state.activeMeasurementKey);
    state.activePointIndex = null;
    refreshExpandedMeasurementModal();
  });

  el.downloadAllCsv?.addEventListener("click", downloadAllDataCsv);
}

function downloadAllDataCsv() {
  if (!state.packets || state.packets.length === 0) {
    alert("No data available to download.");
    return;
  }

  // Normalize and sort packets chronologically
  const normalizedPackets = state.packets
    .map((p) => normalizeIncomingPacket(p))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const headers = [
    "Timestamp", "Connection", "Firmware", "Gateway", "PacketCount", "DataRate",
    "Temperature (°C)", "PAR (lux)", "BBP (m⁻¹)", "Depth (m)", "Pressure (hPa)", "Battery (%)", "Signal (dBm)"
  ];

  let csvContent = "\uFEFF" + headers.join(",") + "\n";

  normalizedPackets.forEach((packet) => {
    const r = packet.readings;
    const row = [
      new Date(packet.timestamp).toISOString(),
      packet.connection,
      packet.firmware,
      packet.gateway,
      packet.packetCount,
      packet.dataRate,
      r.temperature,
      r.par,
      r.bbp,
      r.depth,
      r.pressure,
      r.battery,
      r.signal
    ].map((val) => {
      if (val === null || val === undefined) return "";
      return typeof val === "string" && val.includes(",") ? `"${val}"` : val;
    });
    csvContent += row.join(",") + "\n";
  });

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "phytowatch-all-data.csv");
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function init() {
  try {
    console.log("Initializing Firestore connection...");
    updateFirebaseStatus("initializing");

    const buoyId = new URLSearchParams(window.location.search).get("buoy") || "buoy-001";
    console.log(`Looking for buoy: ${buoyId}`);

    state.firebaseUnsubscribe = subscribeToReadings(buoyId, (firestoreData) => {
      if (firestoreData && firestoreData.length > 0) {
        if (state.firebaseFallbackTimer !== null) {
          window.clearTimeout(state.firebaseFallbackTimer);
          state.firebaseFallbackTimer = null;
        }

        state.hasLiveFirebaseData = true;
        state.packets = firestoreData;
        state.packetIndex = 0;
        state.useMockData = false;
        stopMockDataCycle();
        console.log("✓ Connected to Firestore");
        updateFirebaseStatus("connected");

        const snapshotSignature = getFirebaseSnapshotSignature(firestoreData);
        if (snapshotSignature !== state.lastFirebaseSnapshotSignature) {
          renderFirebaseSnapshot(firestoreData);
          state.lastFirebaseSnapshotSignature = snapshotSignature;
        }
      } else if (!state.useMockData && !state.hasLiveFirebaseData) {
        scheduleMockFallback("Firestore returned no readings", 1200);
      }
    });

    scheduleMockFallback("Firebase startup timeout", 3000);
  } catch (err) {
    console.error("Firebase init error:", err);
    loadMockDataAsFallback();
  }
}

function scheduleMockFallback(reason, delayMs) {
  if (state.useMockData || state.mockRefreshTimer !== null || state.firebaseFallbackTimer !== null) {
    return;
  }

  state.firebaseFallbackTimer = window.setTimeout(() => {
    state.firebaseFallbackTimer = null;
    if (state.packets.length === 0 && !state.useMockData) {
      console.warn(`${reason}, falling back to mock data`);
      loadMockDataAsFallback();
    }
  }, delayMs);
}

async function loadMockDataAsFallback() {
  try {
    if (state.mockRefreshTimer !== null) {
      return;
    }

    if (state.firebaseFallbackTimer !== null) {
      window.clearTimeout(state.firebaseFallbackTimer);
      state.firebaseFallbackTimer = null;
    }

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
    state.mockRefreshTimer = window.setInterval(renderFromNextPacket, UI_CONFIG.refreshMs);
  } catch (err) {
    console.error("Error loading mock data:", err);
    updateFirebaseStatus("noData");
    renderErrorState(err.message);
  }
}

function stopMockDataCycle() {
  if (state.mockRefreshTimer !== null) {
    window.clearInterval(state.mockRefreshTimer);
    state.mockRefreshTimer = null;
  }
}

function renderFromNextPacket() {
  const rawPacket = state.packets[state.packetIndex % state.packets.length];
  state.packetIndex += 1;
  renderFromPacket(rawPacket, "mock");
}

function renderFromPacket(rawPacket, source = "unknown") {
  const packet = normalizeIncomingPacket(rawPacket);

  if (source === "firebase") {
    state.lastRenderedFirebaseKey = packet.timestamp;
  }

  renderTopbar(packet);
  renderMetrics(packet);
  renderHealth(packet);
  renderAlerts(packet);
  updateCharts(packet.readings, packet.timestamp);

  if (state.activeMeasurementKey) {
    refreshExpandedMeasurementModal();
  }
}

function renderTopbar(packet) {
  el.lastUpdate.textContent = `Last update: ${formatTime(packet.timestamp)}`;
}

function renderMetrics(packet) {
  getMeasurementKeys().forEach((key) => {
    const value = packet.readings[key];
    const target = el.metric[key];

    if (!target) {
      return;
    }

    if (value === null || value === undefined) {
      target.value.textContent = "--";
      target.meta.textContent = "Last reading time: --";
      return;
    }

    target.value.textContent = formatMeasurementValue(value);
    target.meta.textContent = `Last reading time: ${formatTime(packet.timestamp)}`;
  });
}

function renderHealth(packet) {
  el.iridiumCsq.textContent = packet.iridiumCsq !== undefined ? `${packet.iridiumCsq}/5` : "Unknown";
  el.sdStorage.textContent = packet.sdStorage || "Unknown";
  el.gpsFix.textContent = packet.gpsFix || "Unknown";
  el.uptime.textContent = packet.uptime || "Unknown";
}

function renderAlerts(packet) {
  const alerts = [];

  if (packet.readings.battery !== null && packet.readings.battery !== undefined && packet.readings.battery <= UI_CONFIG.thresholds.batteryLow) {
    alerts.push({ level: "warning", text: `Low battery: ${packet.readings.battery}%` });
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

function formatMeasurementValue(value) {
  if (typeof value !== "number") {
    return String(value);
  }

  if (Math.abs(value) >= 100) {
    return value.toFixed(1);
  } else if (Math.abs(value) > 0 && Math.abs(value) < 1) {
    return value.toFixed(4);
  }
  return value.toFixed(2);
}

function formatTime(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "--" : d.toLocaleString();
}

function toDateTimeLocalValue(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "";
  }

  const timezoneOffsetMs = d.getTimezoneOffset() * 60 * 1000;
  return new Date(d.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

function fromDateTimeLocalValue(value) {
  if (!value) {
    return null;
  }

  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function applyModalDefaultRange(sensorKey) {
  const series = getChartSeries(sensorKey);
  if (series.length === 0) {
    state.modalFilterStart = "";
    state.modalFilterEnd = "";
    if (el.measurementFilterStart) {
      el.measurementFilterStart.value = "";
    }
    if (el.measurementFilterEnd) {
      el.measurementFilterEnd.value = "";
    }
    return;
  }

  const timestamps = series.map((point) => new Date(point.timestamp).getTime()).filter((value) => Number.isFinite(value));
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);

  state.modalFilterStart = toDateTimeLocalValue(new Date(minTime).toISOString());
  state.modalFilterEnd = toDateTimeLocalValue(new Date(maxTime).toISOString());

  if (el.measurementFilterStart) {
    el.measurementFilterStart.value = state.modalFilterStart;
  }
  if (el.measurementFilterEnd) {
    el.measurementFilterEnd.value = state.modalFilterEnd;
  }
}

function getFilteredSeries(sensorKey) {
  const series = getChartSeries(sensorKey);
  const startDate = fromDateTimeLocalValue(state.modalFilterStart);
  const endDate = fromDateTimeLocalValue(state.modalFilterEnd);

  return series.filter((point) => {
    const pointDate = new Date(point.timestamp);
    if (Number.isNaN(pointDate.getTime())) {
      return false;
    }

    if (startDate && pointDate < startDate) {
      return false;
    }

    if (endDate && pointDate > endDate) {
      return false;
    }

    return true;
  });
}

function openMeasurementModal(sensorKey) {
  const config = getMeasurementConfig(sensorKey);
  const fullSeries = getChartSeries(sensorKey);
  const latest = getLatestPoint(sensorKey);

  if (!config) {
    return;
  }

  state.activeMeasurementKey = sensorKey;
  applyModalDefaultRange(sensorKey);

  const series = getFilteredSeries(sensorKey);
  state.activePointIndex = series.length > 0 ? series.length - 1 : null;

  el.measurementModalSensor.textContent = config.label;
  el.measurementModalTitle.textContent = `${config.label} over time`;
  el.measurementModalSummary.textContent = latest
    ? `Latest reading: ${formatMeasurementValue(latest.value)} ${config.unit} at ${formatTime(latest.timestamp)} (${series.length}/${fullSeries.length} points in range)`
    : "No readings available yet.";

  buildExpandedChart(sensorKey, series, state.activePointIndex);
  renderExpandedPointDetails(sensorKey, series, state.activePointIndex);
  renderReadingList(sensorKey, series, state.activePointIndex);

  el.measurementModal.classList.add("is-open");
  el.measurementModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  el.measurementModalClose?.focus();
}

function closeMeasurementModal() {
  state.activeMeasurementKey = null;
  state.activePointIndex = null;
  state.modalFilterStart = "";
  state.modalFilterEnd = "";

  if (expandedChart) {
    expandedChart.destroy();
    expandedChart = null;
  }

  el.measurementModal.classList.remove("is-open");
  el.measurementModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function refreshExpandedMeasurementModal() {
  if (!state.activeMeasurementKey) {
    return;
  }

  const series = getFilteredSeries(state.activeMeasurementKey);
  const fullSeries = getChartSeries(state.activeMeasurementKey);
  const latest = getLatestPoint(state.activeMeasurementKey);
  const config = getMeasurementConfig(state.activeMeasurementKey);
  if (series.length === 0) {
    state.activePointIndex = null;
  } else {
    const nextIndex = state.activePointIndex === null
      ? series.length - 1
      : Math.min(state.activePointIndex, series.length - 1);
    state.activePointIndex = nextIndex;
  }

  if (config) {
    el.measurementModalSummary.textContent = latest
      ? `Latest reading: ${formatMeasurementValue(latest.value)} ${config.unit} at ${formatTime(latest.timestamp)} (${series.length}/${fullSeries.length} points in range)`
      : "No readings available yet.";
  }

  buildExpandedChart(state.activeMeasurementKey, series, state.activePointIndex);
  renderExpandedPointDetails(state.activeMeasurementKey, series, state.activePointIndex);
  renderReadingList(state.activeMeasurementKey, series, state.activePointIndex);
}

function buildExpandedChart(sensorKey, series, selectedIndex = null) {
  const config = getMeasurementConfig(sensorKey);

  if (!el.expandedChart || !config) {
    return;
  }

  if (expandedChart) {
    expandedChart.destroy();
  }

  const data = series.map((point) => ({
    x: new Date(point.timestamp),
    y: point.value
  }));

  expandedChart = new Chart(el.expandedChart.getContext("2d"), {
    type: "line",
    data: {
      datasets: [
        {
          label: config.label,
          data,
          borderColor: config.line,
          backgroundColor: config.fill,
          borderWidth: 3,
          fill: true,
          pointRadius: selectedIndex === null ? 4 : 5,
          pointHoverRadius: 6,
          pointBackgroundColor: config.line,
          pointBorderColor: "#fff",
          pointBorderWidth: 1,
          tension: 0.35,
          spanGaps: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "nearest",
        intersect: true
      },
      onClick: (_event, elements) => handleExpandedChartClick(elements),
      plugins: {
        legend: {
          display: true,
          labels: {
            color: "#0F172A",
            boxWidth: 14,
            usePointStyle: true
          }
        },
        tooltip: {
          enabled: true,
          backgroundColor: "rgba(15, 23, 42, 0.9)",
          titleColor: "#fff",
          bodyColor: "#fff",
          borderColor: config.line,
          borderWidth: 1,
          padding: 10,
          displayColors: false,
          callbacks: {
            title(context) {
              const index = context[0]?.dataIndex ?? 0;
              const point = series[index];
              return point ? formatTime(point.timestamp) : "";
            },
            label(context) {
              const point = series[context.dataIndex];
              return point ? `${config.label}: ${formatMeasurementValue(point.value)} ${config.unit}` : "";
            }
          }
        }
      },
      scales: {
        y: {
          grid: {
            color: "#E2E8F0",
            drawBorder: false
          },
          ticks: {
            color: "#64748B"
          }
        },
        x: {
          type: "time",
          time: {
            displayFormats: {
              minute: "HH:mm",
              hour: "MMM d, HH:mm",
              day: "MMM d"
            }
          },
          grid: {
            color: "#E2E8F0",
            drawBorder: false
          },
          ticks: {
            color: "#64748B",
            autoSkip: true
          }
        }
      }
    }
  });
}

function handleExpandedChartClick(elements) {
  if (!elements || elements.length === 0) {
    return;
  }

  state.activePointIndex = elements[0].index;
  const series = getFilteredSeries(state.activeMeasurementKey);
  renderExpandedPointDetails(state.activeMeasurementKey, series, state.activePointIndex);
  renderReadingList(state.activeMeasurementKey, series, state.activePointIndex);
}

function renderExpandedPointDetails(sensorKey, series, pointIndex) {
  const config = getMeasurementConfig(sensorKey);

  if (!config || series.length === 0 || pointIndex === null || pointIndex === undefined) {
    el.measurementModalPoint.textContent = "Click a point on the graph to inspect the exact reading over time.";
    return;
  }

  const point = series[pointIndex];
  const previous = pointIndex > 0 ? series[pointIndex - 1] : null;
  const delta = previous ? point.value - previous.value : null;

  const lines = [
    `Selected point for ${config.label}`,
    `Reading: ${formatMeasurementValue(point.value)} ${config.unit}`,
    `Time: ${formatTime(point.timestamp)}`
  ];

  if (delta !== null) {
    lines.push(`Change from previous point: ${delta >= 0 ? "+" : ""}${formatMeasurementValue(delta)} ${config.unit}`);
  }

  el.measurementModalPoint.textContent = lines.join("\n");
}

function renderReadingList(sensorKey, series, selectedIndex) {
  const config = getMeasurementConfig(sensorKey);
  if (!el.measurementReadingList) {
    return;
  }

  el.measurementReadingList.innerHTML = "";

  if (!config || series.length === 0) {
    const item = document.createElement("li");
    item.className = "measurement-reading-empty";
    item.textContent = "No readings in this time range.";
    el.measurementReadingList.appendChild(item);
    return;
  }

  const orderedSeries = series.map((point, index) => ({ point, index })).reverse();

  orderedSeries.forEach(({ point, index }) => {
    const row = document.createElement("li");
    const button = document.createElement("button");

    button.type = "button";
    button.className = "measurement-reading-item";
    if (selectedIndex === index) {
      button.classList.add("active");
    }

    const time = document.createElement("span");
    time.className = "measurement-reading-time";
    time.textContent = formatTime(point.timestamp);

    const value = document.createElement("span");
    value.className = "measurement-reading-value";
    value.textContent = `${formatMeasurementValue(point.value)} ${config.unit}`;

    button.append(time, value);
    button.addEventListener("click", () => {
      state.activePointIndex = index;
      renderExpandedPointDetails(sensorKey, series, state.activePointIndex);
      renderReadingList(sensorKey, series, state.activePointIndex);
      buildExpandedChart(sensorKey, series, state.activePointIndex);
    });

    row.appendChild(button);
    el.measurementReadingList.appendChild(row);
  });
}

window.addEventListener("beforeunload", () => {
  if (state.firebaseUnsubscribe) {
    state.firebaseUnsubscribe();
  }
  if (state.buoysUnsubscribe) {
    state.buoysUnsubscribe();
  }
  stopMockDataCycle();

  if (expandedChart) {
    expandedChart.destroy();
  }
});
}