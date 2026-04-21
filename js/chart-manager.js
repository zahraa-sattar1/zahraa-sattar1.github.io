/**
 * @module chart-manager
 * @description Manages mini-chart instances for each sensor metric.
 * Creates and updates small line charts showing historical data.
 */

/**
 * Chart instances mapped by sensor key
 */
const charts = {};

/**
 * Historical data for each sensor
 */
const chartData = {
  temperature: [],
  par: [],
  bbp: [],
  depth: [],
  battery: [],
  signal: []
};

/**
 * Maximum number of data points to keep in history
 */
const MAX_DATA_POINTS = 24;

/**
 * Chart color scheme
 */
const chartColors = {
  temperature: { line: '#FF6B6B', fill: 'rgba(255, 107, 107, 0.1)' },
  par: { line: '#FFC93C', fill: 'rgba(255, 201, 60, 0.1)' },
  bbp: { line: '#4D96FF', fill: 'rgba(77, 150, 255, 0.1)' },
  depth: { line: '#0656b2', fill: 'rgba(6, 86, 178, 0.1)' },
  battery: { line: '#4CAF50', fill: 'rgba(76, 175, 80, 0.1)' },
  signal: { line: '#9C27B0', fill: 'rgba(156, 39, 176, 0.1)' }
};

/**
 * Initialize all chart instances
 */
export function initializeCharts() {
  const sensors = ['temperature', 'par', 'bbp', 'depth', 'battery', 'signal'];
  
  sensors.forEach(sensor => {
    const canvasId = `${sensor}Chart`;
    const canvas = document.getElementById(canvasId);
    
    if (!canvas) {
      console.warn(`Canvas element not found for sensor: ${sensor}`);
      return;
    }
    
    const ctx = canvas.getContext('2d');
    charts[sensor] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: sensor,
          data: [],
          borderColor: chartColors[sensor].line,
          backgroundColor: chartColors[sensor].fill,
          borderWidth: 2,
          fill: true,
          pointRadius: 2,
          pointBackgroundColor: chartColors[sensor].line,
          pointBorderColor: '#fff',
          pointBorderWidth: 1,
          tension: 0.3,
          spanGaps: true
        }]
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
            backgroundColor: 'rgba(26, 42, 58, 0.8)',
            titleColor: '#fff',
            bodyColor: '#fff',
            borderColor: chartColors[sensor].line,
            borderWidth: 1,
            padding: 6,
            titleFont: { size: 11 },
            bodyFont: { size: 10 },
            displayColors: false
          }
        },
        scales: {
          y: {
            display: true,
            grid: {
              color: 'rgba(15, 90, 143, 0.08)',
              drawBorder: false
            },
            ticks: {
              font: { size: 8 },
              color: '#43566f',
              maxTicksLimit: 3,
              padding: 4
            },
            min: 'auto',
            max: 'auto'
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
  });
  
  console.log('Charts initialized for 6 sensors');
}

/**
 * Add a data point to all sensor charts
 * @param {Object} readings - Sensor readings object
 * @param {number} timestamp - Timestamp of reading
 */
export function updateCharts(readings, timestamp) {
  const timeLabel = new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  
  Object.keys(chartData).forEach(sensor => {
    const value = readings[sensor];
    
    if (value !== undefined && value !== null) {
      // Add to history
      chartData[sensor].push({
        x: timeLabel,
        y: parseFloat(value)
      });
      
      // Keep only last N points
      if (chartData[sensor].length > MAX_DATA_POINTS) {
        chartData[sensor].shift();
      }
      
      // Update chart
      if (charts[sensor]) {
        charts[sensor].data.labels = chartData[sensor].map((_, i) => i);
        charts[sensor].data.datasets[0].data = chartData[sensor].map(d => d.y);
        charts[sensor].update('none'); // Update without animation
      }
    }
  });
}

/**
 * Get historical data for a sensor
 * @param {string} sensorKey - Sensor key (temperature, par, bbp, depth, battery, signal)
 * @returns {Array} Array of data points
 */
export function getChartData(sensorKey) {
  return chartData[sensorKey] || [];
}

/**
 * Clear all chart data
 */
export function clearCharts() {
  Object.keys(chartData).forEach(key => {
    chartData[key] = [];
    if (charts[key]) {
      charts[key].data.labels = [];
      charts[key].data.datasets[0].data = [];
      charts[key].update();
    }
  });
}
