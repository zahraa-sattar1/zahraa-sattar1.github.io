import { UI_CONFIG } from "./config.js";
import { normalizeIncomingPacket } from "./data-adapter.js";

const state = {
  packetIndex: 0,
  packets: []
};

const el = {
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
    battery: {
      value: document.getElementById("batteryValue"),
      meta: document.getElementById("batteryMeta")
    },
    signal: {
      value: document.getElementById("signalValue"),
      meta: document.getElementById("signalMeta")
    },
    custom1: {
      value: document.getElementById("custom1Value"),
      meta: document.getElementById("custom1Meta")
    }
  }
};

init();

async function init() {
  try {
    const response = await fetch("./data/mock-readings.json");
    const raw = await response.json();
    state.packets = Array.isArray(raw) ? raw : [];

    if (state.packets.length === 0) {
      throw new Error("No mock packets found");
    }

    renderFromNextPacket();
    setInterval(renderFromNextPacket, UI_CONFIG.refreshMs);
  } catch (err) {
    renderErrorState(err.message);
  }
}

function renderFromNextPacket() {
  const rawPacket = state.packets[state.packetIndex % state.packets.length];
  state.packetIndex += 1;

  const packet = normalizeIncomingPacket(rawPacket);
  renderTopbar(packet);
  renderMetrics(packet);
  renderHealth(packet);
  renderAlerts(packet);
}

function renderTopbar(packet) {
  const online = packet.connection === "online";
  el.connectionBadge.textContent = online ? "Online" : "Offline";
  el.connectionBadge.className = `badge ${online ? "online" : "offline"}`;
  el.lastUpdate.textContent = `Last update: ${formatTime(packet.timestamp)}`;
}

function renderMetrics(packet) {
  Object.keys(el.metric).forEach((key) => {
    const value = packet.readings[key];
    const unit = UI_CONFIG.units[key] || "";
    const target = el.metric[key];

    if (value === null) {
      target.value.textContent = "--";
      target.meta.textContent = "No data";
      return;
    }

    target.value.textContent = `${value} ${unit}`.trim();
    target.meta.textContent = `Sensor key: ${key}`;
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

  if (packet.readings.battery !== null && packet.readings.battery <= UI_CONFIG.thresholds.batteryLow) {
    alerts.push({ level: "warning", text: `Low battery: ${packet.readings.battery}%` });
  }

  if (packet.readings.signal !== null && packet.readings.signal <= UI_CONFIG.thresholds.signalWeak) {
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
