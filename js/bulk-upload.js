/**
 * @module bulk-upload
 * @description Handles bulk import of sensor logs from JSON files.
 *
 * Supports uploading SD card logs as a single JSON file containing multiple readings.
 * Parses the file, validates data, and batches uploads to Firestore.
 *
 * File Format:
 * ```json
 * {
 *   "buoyId": "buoy-001",
 *   "readings": [
 *     {"timestamp": "...", "temperature": 15.3, "par": 830, "bbp": 0.015, "depth": 25.1, ...},
 *     ...
 *   ]
 * }
 * ```
 */

import { db, collection, addDoc, serverTimestamp } from "./firebase-init.js";

/**
 * Initialize bulk upload UI and event listeners
 */
function initBulkUpload() {
  const fileInput = document.getElementById("fileInput");
  const uploadZone = document.getElementById("uploadZone");

  // File selection
  fileInput.addEventListener("change", handleFileSelect);

  // Drag and drop
  uploadZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadZone.classList.add("active");
  });

  uploadZone.addEventListener("dragleave", () => {
    uploadZone.classList.remove("active");
  });

  uploadZone.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadZone.classList.remove("active");
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  });
}

/**
 * Handle file selection from input
 * @param {Event} event
 */
function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    handleFile(file);
  }
}

/**
 * Process selected file
 * @param {File} file
 */
async function handleFile(file) {
  try {
    // Validate file type
    if (!file.name.endsWith(".json")) {
      showError("Please select a JSON file");
      return;
    }

    showStatus(`📖 Reading file: ${file.name}...`);

    // Parse JSON
    const text = await file.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      showError(`Invalid JSON: ${err.message}`);
      return;
    }

    showStatus(`✓ Parsed ${file.name}, validating data...`);

    // Validate structure
    if (!data.buoyId || !Array.isArray(data.readings)) {
      showError(
        "Invalid format. Expected: { buoyId: string, readings: array }"
      );
      return;
    }

    if (data.readings.length === 0) {
      showError("No readings in file");
      return;
    }

    showStatus(
      `✓ Found ${data.readings.length} readings. Starting upload...`
    );
    showProgress(0);

    // Upload to Firestore
    await uploadReadings(data.buoyId, data.readings);

  } catch (err) {
    console.error("[BulkUpload] Error:", err);
    showError(`Error: ${err.message}`);
  }
}

/**
 * Upload readings to Firestore in batches
 * @param {string} buoyId
 * @param {Array} readings
 */
async function uploadReadings(buoyId, readings) {
  const batchSize = 10; // Upload in batches of 10
  const totalCount = readings.length;
  let successCount = 0;
  const errors = [];

  try {
    for (let i = 0; i < readings.length; i += batchSize) {
      const batch = readings.slice(i, i + batchSize);

      // Upload batch
      for (const reading of batch) {
        try {
          // Validate required fields
          if (!reading.timestamp) {
            errors.push(
              `Reading ${successCount + 1}: Missing timestamp`
            );
            continue;
          }

          const normalized = normalizeUploadReading(reading);

          // Prepare document
          const doc = {
            timestamp: parseTimestamp(normalized.timestamp),
            temperature: normalized.temperature,
            par: normalized.par,
            bbp: normalized.bbp,
            depth: normalized.depth,
            pressure: normalized.pressure,
            battery: normalized.battery,
            signal: normalized.signal,
            packetCount: normalized.packetCount,
            firmware: normalized.firmware,
            gateway: normalized.gateway,
            dataRate: normalized.dataRate,
            connection: normalized.connection ?? "online",
            uploadedAt: serverTimestamp() // Track when it was uploaded
          };

          // Upload to Firestore
          const readingsRef = collection(db, "buoys", buoyId, "readings");
          await addDoc(readingsRef, doc);
          successCount++;

        } catch (err) {
          errors.push(
            `Reading ${successCount + 1}: ${err.message}`
          );
        }
      }

      // Update progress
      const progress = Math.round((i + batchSize) / totalCount * 100);
      showProgress(Math.min(progress, 100));
    }

    showSuccess(successCount, totalCount, errors);

  } catch (err) {
    console.error("[BulkUpload] Batch upload error:", err);
    showError(`Upload failed: ${err.message}`);
  }
}

/**
 * Normalize a reading from either flat or nested sensor schema.
 * @param {Object} reading
 * @returns {Object}
 */
function normalizeUploadReading(reading) {
  const sensorSource = reading?.readings && typeof reading.readings === "object"
    ? reading.readings
    : reading;

  return {
    timestamp: reading?.timestamp,
    temperature: pickNumber(sensorSource, reading, "temperature"),
    par: pickNumber(sensorSource, reading, "par", "bh1750"),
    bbp: pickNumber(sensorSource, reading, "bbp", "tsl2591", "opticalBackscatter"),
    depth: pickNumber(sensorSource, reading, "depth") ?? pressureToDepthMetres(pickNumber(sensorSource, reading, "pressure", "pressureHpa", "pressureMbar")),
    pressure: pickNumber(sensorSource, reading, "pressure", "pressureHpa", "pressureMbar"),
    battery: pickNumber(sensorSource, reading, "battery"),
    signal: pickNumber(sensorSource, reading, "signal"),
    packetCount: pickNumber(sensorSource, reading, "packetCount"),
    firmware: reading?.firmware ?? "Unknown",
    gateway: reading?.gateway ?? "Unknown",
    dataRate: reading?.dataRate ?? "Unknown",
    connection: reading?.connection ?? "online"
  };
}

function pickNumber(primary, fallback, ...keys) {
  for (const key of keys) {
    const value = primary?.[key] ?? fallback?.[key];
    const numberValue = Number(value);
    if (Number.isFinite(numberValue)) {
      return numberValue;
    }
  }

  return null;
}

function pressureToDepthMetres(pressureHpa) {
  if (pressureHpa === null || pressureHpa === undefined) {
    return null;
  }

  const seaLevelPressureHpa = 1013.25;
  const seawaterDensityKgPerM3 = 1025;
  const gravityMs2 = 9.80665;
  const pascalsPerHpa = 100;
  const gaugePressurePa = Math.max((pressureHpa - seaLevelPressureHpa) * pascalsPerHpa, 0);

  return gaugePressurePa / (seawaterDensityKgPerM3 * gravityMs2);
}

/**
 * Parse various timestamp formats
 * @param {string|number|object} timestamp
 * @returns {Date}
 */
function parseTimestamp(timestamp) {
  // String ISO format
  if (typeof timestamp === "string") {
    return new Date(timestamp);
  }
  // Unix timestamp (ms)
  if (typeof timestamp === "number") {
    return new Date(timestamp);
  }
  // Firestore Timestamp object
  if (timestamp && typeof timestamp.toDate === "function") {
    return timestamp.toDate();
  }
  // Default to now
  return new Date();
}

/**
 * Show status message during upload
 * @param {string} message
 */
function showStatus(message) {
  const statusDiv = document.getElementById("uploadStatus");
  const statusMessage = document.getElementById("statusMessage");
  const progressDiv = document.getElementById("uploadProgress");
  const resultsDiv = document.getElementById("uploadResults");

  statusMessage.textContent = message;
  statusDiv.style.display = "block";
  progressDiv.style.display = "block";
  resultsDiv.style.display = "none";

  console.log(`[BulkUpload] ${message}`);
}

/**
 * Show progress bar
 * @param {number} percent
 */
function showProgress(percent) {
  const progressFill = document.getElementById("progressFill");
  progressFill.style.width = `${percent}%`;
}

/**
 * Show success message with results
 * @param {number} successCount
 * @param {number} totalCount
 * @param {Array} errors
 */
function showSuccess(successCount, totalCount, errors) {
  const resultsDiv = document.getElementById("uploadResults");
  const resultsMessage = document.getElementById("resultsMessage");
  const resultDetails = document.getElementById("resultDetails");
  const resultDetailsContent = document.getElementById(
    "resultDetails-content"
  );
  const progressDiv = document.getElementById("uploadProgress");

  resultsDiv.classList.remove("error");
  resultDetails.style.display = errors.length > 0 ? "block" : "none";

  const errorText = errors.length > 0 ? ` (${errors.length} errors)` : "";
  resultsMessage.innerHTML = `✅ Successfully uploaded <strong>${successCount}/${totalCount}</strong> readings${errorText}`;

  if (errors.length > 0) {
    resultsDiv.classList.add("error");
    resultDetailsContent.textContent = errors.join("\n");
  }

  progressDiv.style.display = "none";
  resultsDiv.style.display = "block";

  console.log(
    `[BulkUpload] Success: ${successCount}/${totalCount} uploaded`,
    errors
  );
}

/**
 * Show error message
 * @param {string} message
 */
function showError(message) {
  const resultsDiv = document.getElementById("uploadResults");
  const resultsMessage = document.getElementById("resultsMessage");
  const resultDetails = document.getElementById("resultDetails");
  const progressDiv = document.getElementById("uploadProgress");

  resultsDiv.classList.add("error");
  resultsMessage.textContent = message;
  resultDetails.style.display = "none";
  progressDiv.style.display = "none";
  resultsDiv.style.display = "block";

  console.error(`[BulkUpload] ${message}`);
}

/**
 * Export addDoc for Firestore write
 * (Already imported from firebase-init.js)
 */

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", initBulkUpload);
