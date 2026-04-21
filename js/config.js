/**
 * @module config
 * @description Central configuration hub for UI constants, units, and thresholds.
 * Modify these values to customize the dashboard behavior and alert levels.
 */

/**
 * UI Configuration object containing display settings and thresholds.
 *
 * @type {Object}
 * @property {number} refreshMs - Dashboard update interval (ms) when using mock data
 * @property {Object} labels - Display labels for each metric
 * @property {Object} units - Unit labels for metric values
 * @property {Object} descriptions - Detailed descriptions for each sensor
 * @property {Object} thresholds - Alert trigger thresholds
 */
export const UI_CONFIG = {
  /**
   * Dashboard refresh interval in milliseconds (when using mock data)
   * Firebase real-time updates are not rate-limited
   */
  refreshMs: 4000,

  /**
   * Display labels for each sensor metric
   */
  labels: {
    temperature: "Water Temperature",
    par: "PAR (Photosynthetically Active Radiation)",
    bbp: "Optical Backscatter (Turbidity)",
    depth: "Depth",
    battery: "Battery",
    signal: "Signal Strength"
  },

  /**
   * Unit labels for displaying metric values
   */
  units: {
    temperature: "°C",
    par: "lx",
    bbp: "m⁻¹",
    depth: "m",
    battery: "%",
    signal: "dBm"
  },

  /**
   * Detailed sensor descriptions
   */
  descriptions: {
    temperature: "Water temperature measured by LPS35HW pressure sensor",
    par: "BH1750 - Photosynthetically Active Radiation (400-700 nm), 0-100m depth profile",
    bbp: "TSL2591 + 850nm IR LED - Optical backscatter proxy for particulate concentration",
    depth: "LPS35HW - Depth in meters (calculated from pressure via hydrostatic equation)",
    battery: "System battery voltage percentage",
    signal: "LoRa signal strength in dBm"
  },

  /**
   * Alert thresholds - readings below/weaker than these values trigger warnings
   */
  thresholds: {
    batteryLow: 25, // Below 25% battery triggers warning
    signalWeak: -115 // Weaker than -115 dBm triggers warning
  },

  /**
   * Graph configuration
   */
  graph: {
    maxDataPoints: 24, // Keep last 24 readings for graphs
    updateInterval: 2000 // Redraw graphs every 2 seconds
  }
};

