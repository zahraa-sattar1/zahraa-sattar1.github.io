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
 * @param {number} [rawPacket.readings.temperature] - Water temperature in °C (LPS35HW)
 * @param {number} [rawPacket.readings.par] - PAR in lux (BH1750)
 * @param {number} [rawPacket.readings.bbp] - Optical backscatter in m⁻¹ (TSL2591 + 850nm IR)
 * @param {number} [rawPacket.readings.depth] - Depth in meters (LPS35HW)
 * @param {number} [rawPacket.readings.battery] - Battery percentage (0-100)
 * @param {number} [rawPacket.readings.signal] - Signal strength in dBm (negative)
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
 * const doc = { timestamp: firestoreTimestamp(...), readings: { temperature: 15.5, par: 850 } };
 * const normalized = normalizeIncomingPacket(doc);
 *
 * // From mock data (JSON)
 * const mock = { timestamp: "2024-01-01T12:00:00Z", readings: { temperature: 15.5, par: 850 } };
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

  const temperature = resolveReading(rawPacket, "temperature");
  const par = resolveReading(rawPacket, "par", "bh1750");
  const bbp = resolveReading(rawPacket, "bbp", "tsl2591", "opticalBackscatter");
  const depth = resolveReading(rawPacket, "depth");
  const pressure = resolveReading(rawPacket, "pressure", "pressureHpa", "pressureMbar");
  const derivedDepth = depth ?? pressureToDepthMetres(pressure);

  return {
    timestamp,
    connection: rawPacket?.connection || "offline",
    firmware: rawPacket?.firmware || "Unknown",
    gateway: rawPacket?.gateway || "Unknown",
    packetCount: safeNumber(rawPacket?.packetCount) || 0,
    dataRate: rawPacket?.dataRate || "Unknown",
    readings: {
      temperature,
      par,
      bbp,
      depth: derivedDepth,
      pressure,
      battery: resolveReading(rawPacket, "battery"),
      signal: resolveReading(rawPacket, "signal")
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
function safeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function resolveReading(rawPacket, key, ...aliases) {
  const sources = [
    rawPacket?.readings?.[key],
    rawPacket?.[key],
    ...aliases.flatMap((alias) => [rawPacket?.readings?.[alias], rawPacket?.[alias]])
  ];

  for (const value of sources) {
    const numberValue = safeNumber(value);
    if (numberValue !== null) {
      return numberValue;
    }
  }

  return null;
}

function pressureToDepthMetres(pressureHpa) {
  if (pressureHpa === null || pressureHpa === undefined) {
    return null;
  }

  const absolutePressure = safeNumber(pressureHpa);
  if (absolutePressure === null) {
    return null;
  }

  const seaLevelPressureHpa = 1013.25;
  const seawaterDensityKgPerM3 = 1025;
  const gravityMs2 = 9.80665;
  const pascalsPerHpa = 100;
  const gaugePressurePa = Math.max((absolutePressure - seaLevelPressureHpa) * pascalsPerHpa, 0);

  return gaugePressurePa / (seawaterDensityKgPerM3 * gravityMs2);
}

