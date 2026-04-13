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
    temperature: "Temperature",
    battery: "Battery",
    signal: "Signal",
    custom1: "Custom Sensor"
  },

  /**
   * Unit labels for displaying metric values
   */
  units: {
    temperature: "deg C",
    battery: "%",
    signal: "dBm",
    custom1: "unit" // TODO: Replace with actual custom sensor unit
  },

  /**
   * Alert thresholds - readings below/weaker than these values trigger warnings
   */
  thresholds: {
    batteryLow: 25, // Below 25% battery triggers warning
    signalWeak: -115 // Weaker than -115 dBm triggers warning
  }
};
