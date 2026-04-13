/**
 * @module data-adapter
 * @description Normalizes incoming telemetry data (from Firestore, API, or mock data)
 * to a consistent schema for dashboard rendering.
 *
 * Schema consistency ensures the rendering layer doesn't need to know
 * whether data came from Firestore, hardware API, or mock data.
 */

/**
 * Normalizes raw telemetry packet to standardized dashboard schema.
 *
 * Handles:
 * - Timestamp conversion (Date, Firestore Timestamp, ISO string → ISO string)
 * - Type coercion and validation for numeric sensors
 * - Default values for missing fields
 * - Firestore Timestamp objects with toDate() method
 *
 * @param {Object} rawPacket - Raw packet from Firestore, API, or mock data
 * @param {string|Date|Object} rawPacket.timestamp - Reading timestamp
 * @param {string} [rawPacket.connection="offline"] - Connection status: "online" or "offline"
 * @param {Object} [rawPacket.readings] - Sensor readings object
 * @param {number} [rawPacket.readings.temperature] - Temperature in °C
 * @param {number} [rawPacket.readings.battery] - Battery percentage (0-100)
 * @param {number} [rawPacket.readings.signal] - Signal strength in dBm (negative)
 * @param {number} [rawPacket.readings.custom1] - Custom sensor value
 * @param {number} [rawPacket.packetCount] - Sequential packet counter
 * @param {string} [rawPacket.firmware="Unknown"] - Firmware version
 * @param {string} [rawPacket.gateway="Unknown"] - Gateway identifier
 * @param {string} [rawPacket.dataRate="Unknown"] - Data transmission rate
 *
 * @returns {Object} Normalized packet ready for rendering
 * @returns {string} returns.timestamp - ISO 8601 timestamp string
 * @returns {string} returns.connection - "online" or "offline"
 * @returns {Object} returns.readings - All sensor values as numbers or null if unavailable
 * @returns {number} returns.packetCount - Packet counter
 * @returns {string} returns.firmware - Firmware version
 * @returns {string} returns.gateway - Gateway ID
 * @returns {string} returns.dataRate - Data rate
 *
 * @example
 * // From Firestore
 * const doc = { timestamp: firestoreTimestamp(...), readings: { temperature: 15.5 } };
 * const normalized = normalizeIncomingPacket(doc);
 *
 * // From mock data (JSON)
 * const mock = { timestamp: "2024-01-01T12:00:00Z", readings: { temperature: 15.5 } };
 * const normalized = normalizeIncomingPacket(mock);
 */
export function normalizeIncomingPacket(rawPacket) {
  // Handle multiple timestamp formats: Date, Firestore Timestamp, ISO string
  let timestamp = rawPacket?.timestamp;
  if (timestamp instanceof Date) {
    timestamp = timestamp.toISOString();
  } else if (timestamp && typeof timestamp.toDate === 'function') {
    // Firestore Timestamp object
    timestamp = timestamp.toDate().toISOString();
  } else if (!timestamp) {
    timestamp = new Date().toISOString();
  } else if (typeof timestamp === 'string') {
    // Already an ISO string
    new Date(timestamp); // Validate it's a valid date
  } else {
    timestamp = new Date().toISOString();
  }

  return {
    timestamp,
    connection: rawPacket?.connection || "offline",
    firmware: rawPacket?.firmware || "Unknown",
    gateway: rawPacket?.gateway || "Unknown",
    packetCount: safeNumber(rawPacket?.packetCount) || 0,
    dataRate: rawPacket?.dataRate || "Unknown",
    readings: {
      temperature: safeNumber(rawPacket?.readings?.temperature) ?? safeNumber(rawPacket?.temperature),
      battery: safeNumber(rawPacket?.readings?.battery) ?? safeNumber(rawPacket?.battery),
      signal: safeNumber(rawPacket?.readings?.signal) ?? safeNumber(rawPacket?.signal),
      custom1: safeNumber(rawPacket?.readings?.custom1) ?? safeNumber(rawPacket?.custom1)
    }
  };
}

/**
 * Safely converts value to number, returns null if invalid/missing.
 *
 * Handles null, undefined, strings, numbers, and invalid inputs.
 *
 * @param {*} v - Value to convert
 * @returns {number|null} Converted number or null if invalid
 */
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
