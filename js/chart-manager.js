/**
 * @module chart-manager
 * @description Manages chart history for the five dashboard measurements.
 */

const MEASUREMENTS = {
  par: {
    label: "PAR (BH1750)",
    unit: "lux",
    line: "#FFC93C",
    fill: "rgba(255, 201, 60, 0.12)"
  },
  bbp: {
    label: "Optical Backscatter",
    unit: "m⁻¹",
    line: "#4D96FF",
    fill: "rgba(77, 150, 255, 0.12)"
  },
  pressure: {
    label: "Pressure",
    unit: "hPa",
    line: "#7C3AED",
    fill: "rgba(124, 58, 237, 0.12)"
  },
  temperature: {
    label: "Water Temperature",
    unit: "°C",
    line: "#FF6B6B",
    fill: "rgba(255, 107, 107, 0.12)"
  },
  battery: {
    label: "Battery",
    unit: "%",
    line: "#4CAF50",
    fill: "rgba(76, 175, 80, 0.12)"
  }
};

const MEASUREMENT_ORDER = ["par", "bbp", "pressure", "temperature", "battery"];
const MAX_DATA_POINTS = 36;

const charts = {};
const chartHistory = Object.fromEntries(
  MEASUREMENT_ORDER.map((key) => [key, []])
);

function formatLabel(timestamp) {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function toPoint(value, timestamp) {
  return {
    timestamp: new Date(timestamp).toISOString(),
    label: formatLabel(timestamp),
    value: Number(value)
  };
}

function pruneHistory(sensorKey) {
  const series = chartHistory[sensorKey];
  if (series.length > MAX_DATA_POINTS) {
    series.splice(0, series.length - MAX_DATA_POINTS);
  }
}

function renderMiniChart(sensorKey) {
  const chart = charts[sensorKey];
  if (!chart) {
    return;
  }

  const series = chartHistory[sensorKey];
  chart.data.labels = series.map((point) => point.label);
  chart.data.datasets[0].data = series.map((point) => point.value);
  chart.update("none");
}

function createChart(canvas, sensorKey) {
  const config = MEASUREMENTS[sensorKey];
  const context = canvas.getContext("2d");

  return new Chart(context, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: config.label,
          data: [],
          borderColor: config.line,
          backgroundColor: config.fill,
          borderWidth: 2,
          fill: true,
          pointRadius: 2,
          pointHoverRadius: 4,
          pointBackgroundColor: config.line,
          pointBorderColor: "#fff",
          pointBorderWidth: 1,
          tension: 0.3,
          spanGaps: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          enabled: true,
          backgroundColor: "rgba(26, 42, 58, 0.88)",
          titleColor: "#fff",
          bodyColor: "#fff",
          borderColor: config.line,
          borderWidth: 1,
          padding: 8,
          titleFont: { size: 11 },
          bodyFont: { size: 11 },
          displayColors: false
        }
      },
      scales: {
        y: {
          display: true,
          grid: {
            color: "rgba(15, 90, 143, 0.08)",
            drawBorder: false
          },
          ticks: {
            font: { size: 8 },
            color: "#43566f",
            maxTicksLimit: 3,
            padding: 4
          }
        },
        x: {
          display: false,
          grid: {
            display: false
          }
        }
      }
    }
  });
}

export function initializeCharts() {
  MEASUREMENT_ORDER.forEach((sensorKey) => {
    const canvas = document.getElementById(`${sensorKey}Chart`);
    if (!canvas) {
      console.warn(`Canvas element not found for sensor: ${sensorKey}`);
      return;
    }

    charts[sensorKey] = createChart(canvas, sensorKey);
  });

  console.log("Charts initialized for five measurements");
}

export function updateCharts(readings, timestamp) {
  MEASUREMENT_ORDER.forEach((sensorKey) => {
    const value = readings?.[sensorKey];
    if (value === undefined || value === null) {
      return;
    }

    chartHistory[sensorKey].push(toPoint(value, timestamp));
    pruneHistory(sensorKey);
    renderMiniChart(sensorKey);
  });
}

export function getMeasurementConfig(sensorKey) {
  return MEASUREMENTS[sensorKey] || null;
}

export function getMeasurementKeys() {
  return [...MEASUREMENT_ORDER];
}

export function getChartSeries(sensorKey) {
  return chartHistory[sensorKey] ? [...chartHistory[sensorKey]] : [];
}

export function getLatestPoint(sensorKey) {
  const series = chartHistory[sensorKey];
  return series && series.length > 0 ? series[series.length - 1] : null;
}

export function clearCharts() {
  MEASUREMENT_ORDER.forEach((sensorKey) => {
    chartHistory[sensorKey] = [];
    if (charts[sensorKey]) {
      charts[sensorKey].data.labels = [];
      charts[sensorKey].data.datasets[0].data = [];
      charts[sensorKey].update();
    }
  });
}