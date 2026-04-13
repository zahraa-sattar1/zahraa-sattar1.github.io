# Buoy Telemetry Dashboard - Architecture & Implementation Guide

**Last Updated:** April 13, 2026  
**Status:** Functional MVP - Ready for Microcontroller Integration  
**Project:** PhytoWatch Buoy Monitoring System

---

## Table of Contents

1. [High-Level Architecture](#high-level-architecture)
2. [Technology Stack](#technology-stack)
3. [Data Flow & Subscriptions](#data-flow--subscriptions)
4. [Firestore Database Schema](#firestore-database-schema)
5. [Frontend Module Documentation](#frontend-module-documentation)
6. [Backend Cloud Functions](#backend-cloud-functions)
7. [Deployment & Configuration](#deployment--configuration)
8. [Error Handling & Fallbacks](#error-handling--fallbacks)
9. [Integration with Microcontrollers](#integration-with-microcontrollers)
10. [Testing & Validation](#testing--validation)

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  BUOY TELEMETRY DASHBOARD                   │
│                (GitHub Pages - Static Hosting)              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐          ┌──────────────────┐         │
│  │   index.html     │          │   CSS Styles     │         │
│  │  (UI Structure)  │          │  (Responsive)    │         │
│  └────────┬─────────┘          └──────────────────┘         │
│           │                                                   │
│  ┌────────▼──────────────────────────────────────┐          │
│  │  JavaScript Application Layer (app.js)         │          │
│  │  - Initialize Firebase connection              │          │
│  │  - Subscribe to real-time data                 │          │
│  │  - Manage UI rendering                         │          │
│  │  - Handle fallbacks                            │          │
│  └────────┬──────────────┬───────────────┬────────┘         │
│           │              │               │                   │
│  ┌────────▼──┐  ┌───────▼────┐  ┌──────▼──────┐           │
│  │ Firebase   │  │   Data     │  │   Config    │           │
│  │   Init     │  │  Adapter   │  │   (Units)   │           │
│  │ (firebase- │  │ (normalize)│  │ (Thresholds)│           │
│  │  init.js)  │  │            │  │             │           │
│  └────────┬───┘  └───────▲────┘  └─────────────┘           │
│           │              │                                   │
│  ┌────────▼──────────────┼─────────────────┐               │
│  │   Firestore Service    │                 │               │
│  │  (firestore-service)   │                 │               │
│  │  - Subscribe to readings                │               │
│  │  - Subscribe to buoys                   │               │
│  └────────┬──────────────┼─────────────────┘               │
│           │              │                                   │
│           │              └──────────────────┐               │
│           │                                  │               │
│      (Real-time)                    (Fallback if error)     │
│           │                                  │               │
│    ┌──────▼────────────────────└──────────┐                │
│    │   Firebase Firestore Database         │                │
│    │   (phytowatch project)                │                │
│    │                                        │                │
│    │   ┌──────────────────────────────┐   │                │
│    │   │  buoys/{buoyId}/readings     │   │                │
│    │   │  - timestamp (Firestore.TS)  │   │                │
│    │   │  - temperature (°C)           │   │                │
│    │   │  - battery (%)                │   │                │
│    │   │  - signal (dBm)               │   │                │
│    │   │  - custom1 (sensor-specific)  │   │                │
│    │   └──────────────────────────────┘   │                │
│    │                                        │                │
│    └────────────────────────────────────────┘                │
│              ▲                                               │
│              │                                               │
│              │  (Data Ingestion)                            │
│              │                                               │
│    ┌─────────┴────────────────────────────┐                │
│    │  Cloud Functions (Backend)            │                │
│    │  - ingestReading()                    │                │
│    │  - getLatestBuoySnapshot()            │                │
│    └────────────────────────────────────────┘                │
│              ▲                                               │
│              │                                               │
│              │  (HTTP POST/GET)                             │
│              │                                               │
│    ┌─────────┴────────────────────────────┐                │
│    │  Hardware Devices / Microcontrollers │                │
│    │  - Buoy sensors                      │                │
│    │  - Data collection & transmission    │                │
│    └────────────────────────────────────────┘                │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Frontend (Client-Side)
- **HTML5** - Semantic markup for accessibility
- **CSS3** - Responsive design with CSS custom properties (variables)
- **JavaScript (ES6 Modules)** - Modern JavaScript with import/export
- **Firebase SDK v10.7.0** - Real-time database access via CDN

### Backend (Cloud Services)
- **Firebase Firestore** - NoSQL real-time database
  - Automatic synchronization across clients
  - Real-time listeners (onSnapshot)
  - Server-side timestamps
  - Composite indexing for queries

- **Cloud Functions** - Serverless backend
  - Node.js 20 runtime
  - Firebase Admin SDK for server-side operations
  - HTTP endpoints for data ingestion

### Hosting & DevOps
- **GitHub Pages** - Static site hosting
- **GitHub Actions** - Automatic deployment on git push
- **Git** - Version control  
- **npm** - Package management for Cloud Functions

### Database Security
- **Firestore Security Rules** - Declarative access control
  - Public read access (dashboard)
  - Authenticated writes (ingest service)
  - Field-level security for sensitive data

---

## Data Flow & Subscriptions

### 1. Real-Time Data Flow (Preferred)

```
Microcontroller → HTTP POST to Cloud Function
                       ↓
              ingestReading() validates
                       ↓
           Writes to buoys/{buoyId}/readings
                       ↓
        Firestore triggers real-time listener
                       ↓
   onSnapshot() fires in browser (milliseconds)
                       ↓
       data-adapter.js normalizes packet
                       ↓
      app.js renders updated UI metrics
                       ↓
            Dashboard shows fresh data
```

**Timeline:** Data appears in dashboard < 1 second after microcontroller sends it (typically 100-500ms)

### 2. Fallback Flow (When Firebase Unavailable)

```
User loads dashboard
       ↓
app.js subscribes to Firebase
       ↓
      [3-second timeout]
       ↓
No Firebase data received?
       ↓
loadMockDataAsFallback() loads data/mock-readings.json
       ↓
setInterval() cycles through mock readings every 4 seconds
       ↓
UI shows "🟠 Fallback Mode" badge
```

**Purpose:** Allows development/demo without live hardware or internet

### 3. Data Normalization

All data passes through `normalizeIncomingPacket()` regardless of source:

```javascript
Raw Packet (from Firestore or JSON)
  ├─ timestamp: Firestore.Timestamp | Date | string
  ├─ temperature: 15.3
  ├─ battery: 87
  ├─ signal: -95
  └─ custom1: 42.1
         ↓
   [Timestamp Conversion]
   [Type Coercion]
   [Default Values]
         ↓
Normalized Packet (ready for rendering)
  ├─ timestamp: "2024-04-13T10:45:00Z" (ISO string)
  ├─ connection: "online"
  ├─ firmware: "v2.1.0"
  ├─ gateway: "gw-01"
  ├─ packetCount: 1245
  ├─ dataRate: "9600bps"
  └─ readings: {
      temperature: 15.3,
      battery: 87,
      signal: -95,
      custom1: 42.1
    }
```

---

## Firestore Database Schema

### Collection: `buoys/{buoyId}`

**Purpose:** Metadata about each buoy device  
**Access:** Public read, admin write only

```firestore
buoys/buoy-001 {
  // Device Information
  name: string           // e.g., "Buoy Alpha"
  location: string       // e.g., "Cape Town Harbor"
  latitude: number       // e.g., -33.9249
  longitude: number      // e.g., 18.4241
  
  // Status
  status: string         // "active" | "inactive" | "maintenance"
  lastSeen: Timestamp    // Last successful data reception
  
  // Hardware Configuration
  deviceType: string     // e.g., "PhytoWatch v2.1"
  firmware: string       // e.g., "v2.1.0"
  sensorTypes: array     // ["temperature", "battery", "signal", "custom1"]
}
```

### Sub-Collection: `buoys/{buoyId}/readings`

**Purpose:** Time-series sensor data from each buoy  
**Access:** Public read, ingest service write only  
**Retention:** 90 days (requires TTL policy setup)

```firestore
buoys/buoy-001/readings/{autoId} {
  // Timestamp (CRITICAL - used for ordering)
  timestamp: Firestore.Timestamp   // Server time, not device time
  
  // Sensor Values (all optional for flexibility)
  temperature: number              // Celsius
  battery: number                  // Percentage (0-100)
  signal: number                   // dBm (negative value)
  custom1: number                  // Sensor-specific unit
  
  // Metadata
  packetCount: number              // Device-side sequence
  dataRate: string                 // e.g., "9600bps"
  gateway: string                  // Which gateway received it
  connection: string               // "online" | "offline"
}
```

**Composite Index:**
- Collections: `readings`
- Fields: `timestamp (DESCENDING), sensorId (ASCENDING)`
- Status: Published

### Sub-Collection: `buoys/{buoyId}/alerts` (Optional)

**Purpose:** Critical alerts and device anomalies  
**Access:** Public read after resolved, admin write

```firestore
buoys/buoy-001/alerts/{autoId} {
  timestamp: Firestore.Timestamp
  active: boolean
  level: string            // "critical" | "warning" | "info"
  type: string             // "low_battery" | "offline" | "custom"
  message: string
  resolvedAt: Timestamp    // null if still active
}
```

---

## Frontend Module Documentation

### 1. Configuration Module (`js/config.js`)

**Purpose:** Centralized configuration for UI constants and thresholds  
**Responsibility:** Define units, labels, and alert thresholds

**Exports:**
```javascript
UI_CONFIG = {
  refreshMs: 4000,                    // Mock data update interval
  labels: {                           // Display labels
    temperature: "Temperature",
    battery: "Battery",
    signal: "Signal",
    custom1: "Custom Sensor"
  },
  units: {                            // Unit symbols
    temperature: "deg C",
    battery: "%",
    signal: "dBm",
    custom1: "unit"                  // TODO: Replace with actual unit
  },
  thresholds: {                       // Alert trigger points
    batteryLow: 25,                  // Below 25%
    signalWeak: -115                 // Weaker than -115 dBm
  }
}
```

**Usage:** Imported by `app.js` for alerts and `js/data-adapter.js` for rendering

### 2. Firebase Initialization (`js/firebase-init.js`)

**Purpose:** Set up Firebase SDK and Firestore database  
**Responsibility:** Single point of Firebase configuration

**Key Points:**
- Loads Firebase SDK from CDN (v10.7.0)
- Initializes with `phytowatch` project credentials
- Exports `db` (Firestore instance) for use by other modules
- Re-exports common query functions for convenience

**Exports:**
```javascript
db                    // Firestore database instance
collection()          // Create reference to Firestore collection
query()              // Build a query
orderBy()            // Sort clause
limit()              // Result limit clause
onSnapshot()         // Real-time listener
```

**Configuration:**
```javascript
firebaseConfig = {
  projectId: "phytowatch",
  apiKey: "AIzaSyA1ZvgoogoR5KbsVE1Uyb0obJ8hW321JV4",
  // ... other public keys
}
```

**⚠️ Security Note:** These keys are intentionally public (for browser access). Security is enforced via Firestore rules (read-only).

### 3. Data Adapter (`js/data-adapter.js`)

**Purpose:** Normalize telemetry data to consistent schema  
**Responsibility:** Transform raw data regardless of source

**Key Function:** `normalizeIncomingPacket(rawPacket)`

**Handles:**
- Firestore Timestamp → JavaScript Date → ISO string
- Type coercion (strings to numbers)
- Missing values (defaults)
- Multiple data source formats (Firestore, API, JSON)

**Example:**
```javascript
// Input from Firestore
const raw = {
  timestamp: Firestore.Timestamp(...),
  temperature: "15.3",
  battery: 87
};

// Output (normalized)
const normalized = normalizeIncomingPacket(raw);
// → {
//     timestamp: "2024-04-13T10:45:00Z",
//     temperature: 15.3,
//     battery: 87,
//     signal: null,
//     custom1: null
//   }
```

### 4. Firestore Service (`js/firestore-service.js`)

**Purpose:** Abstract Firestore subscription details  
**Responsibility:** Manage real-time listeners

**Key Exports:**

#### `subscribeToReadings(buoyId, callback)`
- **Subscribes to:** Latest reading from a specific buoy
- **Query:** `readings` collection ordered by timestamp DESC, limit 1
- **Returns:** Unsubscribe function
- **Callback:** Receives array [reading] or []

```javascript
// Usage
const unsub = subscribeToReadings("buoy-001", (readings) => {
  if (readings.length > 0) {
    console.log("Latest:", readings[0].timestamp);
  }
});
// Later: unsub() to disconnect
```

#### `subscribeToBuoys(callback)`
- **Subscribes to:** All buoys metadata
- **Returns:** Unsubscribe function
- **Callback:** Receives array of buoy documents

**Error Handling:**
- Network errors → Call callback with empty array
- No data → Call callback with empty array
- Subscription errors → Log to console, continue listening

### 5. Main Application (`js/app.js`)

**Purpose:** Orchestrate dashboard logic  
**Responsibility:** Initialize, render, and update UI

**Key Functions:**

#### `init()` - Startup sequence
```
1. Try Firebase connection (subscribe to readings)
2. Set 3-second fallback timeout
3. If no data after 3s → Load mock data
4. On new data → Normalize → Render
```

#### `renderFromPacket(packet)` - Render complete UI
- Calls: `renderTopbar()`, `renderMetrics()`, `renderHealth()`, `renderAlerts()`

#### `renderMetrics()` - Display sensor values
- Updates temperature, battery, signal, custom1 cards
- Shows "-- No data" if value is null

#### `renderAlerts()` - Generate alerts
- Low battery: `battery <= 25%`
- Weak signal: `signal <= -115 dBm`
- Offline: `connection !== "online"`

#### `updateFirebaseStatus(status, message)` - Set connection badge
- `"connected"` → 🟢 Green
- `"fallback"` → 🟠 Orange (using mock data)
- `"initializing"` → ⏳ Loading
- `"noData"` → 🔴 Red (error)

**State Management:**
```javascript
state = {
  packetIndex: 0,          // Current position in packets array
  packets: [],             // Array of readings
  useMockData: false,      // Using fallback or Firebase?
  firebaseUnsubscribe: null // For cleanup
}
```

### 6. Bulk Upload Module (`js/bulk-upload.js`)

**Purpose:** Import sensor logs from SD card as JSON files  
**Responsibility:** Handle file upload, parsing, and batch Firestore writes

**Key Functions:**

#### `handleFile(file)` - Process uploaded JSON file
- Validates JSON format
- Checks for required fields (buoyId, readings array)
- Initiates batch upload process

**Accepted File Format:**
```json
{
  "buoyId": "buoy-001",
  "readings": [
    {
      "timestamp": "2024-04-01T08:00:00Z",
      "temperature": 14.2,
      "battery": 95,
      "signal": -85,
      "custom1": 40.5,
      "packetCount": 1200,
      "firmware": "v2.1.0",
      "gateway": "gw-cape-town-01",
      "dataRate": "9600bps",
      "connection": "online"
    },
    ...
  ]
}
```

#### `uploadReadings(buoyId, readings)` - Batch upload to Firestore
- Uploads in batches of 10 readings
- Tracks success/error count
- Shows progress bar
- Converts various timestamp formats (ISO string, Unix timestamp, Firestore Timestamp)

**Timestamp Formats Supported:**
- ISO 8601 strings: `"2024-04-01T08:00:00Z"`
- Unix timestamps (ms): `1711939200000`
- Firestore Timestamp objects: `{toDate: function}`

#### UI Components
- **Upload Zone:** Clickable drag-and-drop area for file selection
- **Status Display:** Real-time message and progress bar during upload
- **Results Panel:** Success/failure summary with error details

**Supports:**
- Drag & drop file upload
- Click to browse and select
- Progress indicator (%)
- Error reporting with line-by-line details
- Expandable error details panel

**Test File:** `test-data/bulk-logs-sample.json`
Contains 15 sample readings from two days with realistic sensor values.

---

## Backend Cloud Functions

### Location
`firebase/functions/src/index.js`

### 1. ingestReading() - Data Ingestion Endpoint

**Purpose:** Receive sensor data from microcontrollers  
**Method:** HTTP POST  
**Endpoint:** `https://us-central1-phytowatch.cloudfunctions.net/ingestReading`

**Request Format:**
```bash
curl -X POST https://us-central1-phytowatch.cloudfunctions.net/ingestReading \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_SECRET_KEY" \
  -d '{
    "buoyId": "buoy-001",
    "timestamp": "2024-04-13T10:45:00Z",
    "temperature": 15.3,
    "battery": 87,
    "signal": -95,
    "custom1": 42.1,
    "dataRate": "9600bps",
    "gateway": "gw-01"
  }'
```

**Authentication:** API key header validation (X-API-Key)

**Response:**
```json
{
  "status": 202,
  "message": "Reading accepted",
  "readingId": "Ks9dF8jK3pL2mN5oQ",
  "buoyId": "buoy-001"
}
```

**What It Does:**
1. Validate API key
2. Validate payload structure
3. Create `readings` document in Firestore
4. Update `buoys/{buoyId}` with latest timestamp
5. Return 202 Accepted

**Error Handling:**
- Invalid API key → 401 Unauthorized
- Invalid payload → 400 Bad Request
- Database error → 500 Internal Server Error

### 2. getLatestBuoySnapshot() - Data Retrieval

**Purpose:** Get latest reading for a specific buoy  
**Method:** HTTP GET  
**Endpoint:** `https://us-central1-phytowatch.cloudfunctions.net/getLatestBuoySnapshot?buoyId=buoy-001`

**Response:**
```json
{
  "buoy": {
    "id": "buoy-001",
    "name": "Buoy Alpha",
    "location": "Cape Town Harbor"
  },
  "latest": {
    "timestamp": "2024-04-13T10:45:00Z",
    "temperature": 15.3,
    "battery": 87,
    "signal": -95,
    "custom1": 42.1
  }
}
```

**Error Handling:**
- Missing buoyId → 400 Bad Request
- Buoy not found → 404 Not Found
- Database error → 500 Internal Server Error

---

## Deployment & Configuration

### Frontend Deployment (GitHub Pages)

**Process:**
1. Push code to `zahraa-sattar1/zahraa-sattar1.github.io` main branch
2. GitHub Actions triggers automated build
3. `/` (or `docs/` folder) served as public website
4. Available at: `https://zahraa-sattar1.github.io`

**Live URL:** `https://zahraa-sattar1.github.io/?buoy=buoy-001`

**Files Deployed:**
- `index.html`
- `css/styles.css`
- `js/*` - All JavaScript modules
- `data/mock-readings.json` - Fallback data
- `assets/*` - Logos, images

### Firestore Configuration

**Project:** phytowatch (`firebase/firestore.rules`)

**Security Rules:**
```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Public read access
    match /buoys/{buoyId} {
      allow read: if true;
      match /readings/{readingId} {
        allow read: if true;
      }
    }
    
    // Authenticated write (ingest service only)
    function hasIngestToken() {
      return request.auth.token.type == "ingest";
    }
    
    match /buoys/{buoyId}/readings/{readingId} {
      allow create: if hasIngestToken();
    }
  }
}
```

**Indexes:** `firebase/firestore.indexes.json`

### Cloud Functions Deployment

**Deploy command:**
```bash
cd firebase/functions
npm install
firebase deploy --only functions
```

**Environment setup:**
- Copy `.env.example` to `.env` (if using environment variables)
- Add API keys, secrets as needed
- Deploy creates Cloud Functions with npm dependencies

---

## Error Handling & Fallbacks

### User Facing Errors

#### 1. "🔴 No Data Available"
**Cause:** Firebase unavailable AND mock data empty/missing  
**User Action:** [Click link to Firestore console](https://console.firebase.google.com/project/phytowatch/firestore) and add readings

#### 2. "🟠 Fallback Mode"
**Cause:** Firebase unavailable, using mock-readings.json  
**User Action:** None required - dashboard still shows demo data

#### 3. Connection Lost (Gray Badge)
**Cause:** Network disconnected, Firebase unreachable  
**Recovery:** Automatic when network restored

### Silent Failures

#### Missing Metric Values ("--")
- Sensor not transmitting that value
- Check Firestore document for missing field

#### Incorrect Timestamps
- Device time vs. server time mismatch
- Firestore always uses server time (correct)

### Debug Logging

Open browser console (F12) and filter for `[Firestore]` logs:

```javascript
[Firestore] Subscribing to readings for buoy: buoy-001
[Firestore] Query result for buoy-001: 1 documents
[Firestore] Raw data from Firebase: {timestamp: Timestamp(...), ...}
[Firestore] Normalized data: {timestamp: "2024-...",...}
```

---

## Integration with Microcontrollers

### 1. Hardware Requirements

**Supported Microcontrollers:**
- ESP8266 / ESP32 (WiFi)
- Arduino with WiFi shield
- Raspberry Pi
- Any device with HTTP client library

**Requirements:**
- WiFi or cellular internet connection
- HTTPS capable (TLS/SSL)
- JSON parsing library
- Real-time clock (RTC) for timestamps

### 2. Minimal Arduino Example

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* ssid = "WiFi Network";
const char* password = "WiFi Password";
const char* apiUrl = "https://us-central1-phytowatch.cloudfunctions.net/ingestReading";
const char* apiKey = "YOUR_API_KEY";

void sendReading(float temp, int battery, int signal) {
  HTTPClient http;
  http.begin(apiUrl);
  http.addHeader("X-API-Key", apiKey);
  http.addHeader("Content-Type", "application/json");
  
  DynamicJsonDocument doc(256);
  doc["buoyId"] = "buoy-001";
  doc["timestamp"] = "2024-04-13T10:45:00Z"; // use NTP or RTC
  doc["temperature"] = temp;
  doc["battery"] = battery;
  doc["signal"] = signal;
  doc["custom1"] = 42.1;
  doc["dataRate"] = "9600bps";
  doc["gateway"] = "wifi-gateway-01";
  
  String payload;
  serializeJson(doc, payload);
  
  int httpCode = http.POST(payload);
  if (httpCode == 202) {
    Serial.println("✓ Data accepted");
  } else {
    Serial.print("✗ Error: ");
    Serial.println(httpCode);
  }
  http.end();
}

void loop() {
  float temperature = readTemperatureSensor();
  int battery = readBattery();
  int signal = readSignalStrength();
  
  sendReading(temperature, battery, signal);
  delay(60000); // Send every minute
}
```

### 3. Data Format Specification

All sensor readings should follow this schema:

```json
{
  "buoyId": "string (required)",        // e.g., "buoy-001"
  "timestamp": "string (ISO 8601)",     // e.g., "2024-04-13T10:45:00Z"
  "temperature": "number (optional)",   // Celsius, e.g., 15.3
  "battery": "number (optional)",       // Percentage, e.g., 87
  "signal": "number (optional)",        // dBm, e.g., -95
  "custom1": "number (optional)",       // Sensor-specific
  "dataRate": "string (optional)",      // e.g., "9600bps"
  "gateway": "string (optional)"        // Which gateway, e.g., "gw-01"
}
```

### 4. Integration Checklist

Before connecting hardware:

- [ ] Firestore project created and rules deployed
- [ ] Cloud Function `ingestReading()` deployed
- [ ] API key generated and stored securely
- [ ] Microcontroller has WiFi connectivity
- [ ] HTTPS/TLS libraries available
- [ ] RTC or NTP for timestamp
- [ ] DNS resolving working (can reach cloudfunctions.net)
- [ ] Payload JSON format correct
- [ ] Default values set if sensor unavailable

### 5. Real Hardware Workflow

```
Microcontroller Startup
  ├─ Connect to WiFi
  ├─ Sync time via NTP
  └─ Initialize sensors
          ↓
      ∞ Loop
         ├─ Read sensors (temperature, battery, signal, etc.)
         ├─ Format JSON packet
         ├─ POST to Cloud Function
         │  ├─ 202 Accepted → Log success
         │  └─ Error → Retry with exponential backoff
         ├─ Wait 60 seconds
         └─ Repeat
```

---

## Testing & Validation

### 1. Local Testing (Before Deployment)

#### Test Mock Data
```bash
# Open index.html in browser
# Dashboard should cycle through mock-readings.json every 4 seconds
# Badge shows: "🟠 Fallback Mode"
```

#### Test Firestore Subscription
```bash
# Add data to Firestore manually via console:
# Collection: buoys/buoy-001/readings
# Document with fields: timestamp, temperature, battery, signal
# 
# Dashboard should show:
# - "🟢 Connected" badge
# - Real-time updates (within 1 second)
```

### 2. Browser Console Debugging

**View Firestore logs:**
```javascript
// In browser console (F12)
// Filter for messages starting with "[Firestore]"

// You should see:
[Firestore] Subscribing to readings for buoy: buoy-001
[Firestore] Query result for buoy-001: 1 documents
[Firestore] Raw data from Firebase: {...}
[Firestore] Normalized data: {...}
```

**Test mock data fallback:**
```javascript
// Simulate error by clearing mock data logic
// Should show "🔴 No Data Available" after 3 seconds
```

### 3. Firestore Console Validation

**Check data structure:**
1. Go to [Firestore Console](https://console.firebase.google.com/project/phytowatch/firestore)
2. Collections → buoys → buoy-001 → readings
3. Verify fields match expected schema
4. Check timestamp is Firestore.Timestamp type (not string)

### 4. Cloud Function Testing

**Test ingestReading():**
```bash
curl -X POST \
  https://us-central1-phytowatch.cloudfunctions.net/ingestReading \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{
    "buoyId": "test-buoy",
    "temperature": 20.5,
    "battery": 75,
    "signal": -90
  }'
```

Expected response: `202 Accepted`

### 5. End-to-End Test

```
1. Add data to Firestore Console manually
2. Refresh dashboard (hard refresh: Cmd+Shift+R)
3. Check browser console for [Firestore] logs
4. Verify metrics update in real-time
5. Generate an alert (set battery to 10%)
6. Verify alert appears in Alerts panel
7. Check status badge color matches status
```

### 6. Bulk Upload Testing

**Test with sample data file:**
1. Download or use `test-data/bulk-logs-sample.json`
2. Open dashboard and scroll to "Bulk Upload" panel
3. Click upload zone or drag-drop the JSON file
4. Verify progress bar appears
5. Check success message shows "15/15 readings uploaded"
6. Go to Firestore Console and verify readings in `buoys/buoy-001/readings`

**Test error handling:**
- Upload a non-JSON file → Should show "Please select a JSON file" error
- Upload malformed JSON → Should show "Invalid JSON" error
- Upload JSON without `buoyId` field → Should show format error
- Upload JSON with empty readings array → Should show error

**Check browser console:**
```javascript
// Filter for "[BulkUpload]" logs:
[BulkUpload] Reading file: bulk-logs-sample.json...
[BulkUpload] Parsed bulk-logs-sample.json, validating data...
[BulkUpload] Found 15 readings. Starting upload...
[BulkUpload] Success: 15/15 uploaded
```

**Verify in Firestore:**
1. Go to [Firestore Console](https://console.firebase.google.com/project/phytowatch/firestore)
2. Navigate to buoys → buoy-001 → readings
3. Should see 15 new documents with timestamps from sample data
4. Verify timestamps, sensor values are preserved
5. Check `uploadedAt` field shows current server time

---

## Future Enhancements

### Phase 2 (Real Hardware)
- [ ] Deploy Cloud Function to handle hardware POST requests
- [ ] Set up device authentication/authorization
- [ ] Implement data validation rules
- [ ] Add data retention/TTL policies

### Phase 3 (Advanced Features)
- [ ] Historical data visualization (charts)
- [ ] Multiple buoy fleet view
- [ ] Data export (CSV/JSON)
- [ ] Android/iOS mobile app
- [ ] WebSocket live streaming (for faster updates)
- [ ] Data anomaly detection
- [ ] Predictive maintenance alerts

### Phase 4 (Production Hardening)
- [ ] TypeScript migration
- [ ] Unit test suite
- [ ] E2E integration tests
- [ ] Performance monitoring
- [ ] Uptime monitoring / alerting
- [ ] Rate limiting on Cloud Functions
- [ ] Data encryption at rest and in transit

---

## Troubleshooting Guide

| Issue | Cause | Solution |
|-------|-------|----------|
| "🔴 No Data Available" | Firebase unreachable + empty mock data | Add readings to Firestore |
| "🟠 Fallback Mode" | Firebase timeout | Check internet connection, Firebase status |
| Metrics show "--" | Sensor not sending that field | Check microcontroller code |
| Dashboard not updating | Firestore subscription failed | Check browser console for [Firestore] errors |
| Wrong timestamp | Using device time instead of server time | Use Firestore.serverTimestamp() |
| Data not persisting | Firestore rules too restrictive | Check `firestore.rules` |
| Cloud Function error 400 | Invalid JSON format | Verify payload matches schema |

---

## Quick Reference

### Key Files

| File | Purpose |
|------|---------|
| `index.html` | Dashboard UI structure |
| `css/styles.css` | Responsive styling & layout |
| `js/app.js` | Main controller logic |
| `js/config.js` | UI configuration constants |
| `js/firebase-init.js` | Firebase setup |
| `js/firestore-service.js` | Firestore subscriptions |
| `js/data-adapter.js` | Data normalization |
| `js/bulk-upload.js` | SD card log import |
| `firebase/firestore.rules` | Security rules |
| `firebase/functions/src/index.js` | Cloud Functions |
| `test-data/bulk-logs-sample.json` | Sample bulk upload file |
| `docs/ARCHITECTURE.md` | This file |

### Key URLs

| Purpose | URL |
|---------|-----|
| Live Dashboard | https://zahraa-sattar1.github.io/?buoy=buoy-001 |
| Firestore Console | https://console.firebase.google.com/project/phytowatch/firestore |
| Cloud Functions | https://console.firebase.google.com/project/phytowatch/functions |
| Firebase Rules | https://console.firebase.google.com/project/phytowatch/rules |

### Package Versions

- Firebase SDK: 10.7.0
- Firebase Admin SDK: ^13.8.0
- Firebase Functions: ^5.1.1
- Node.js (Cloud Functions): 20

---

## Contact & Support

For questions about the architecture or integration:
1. Check browser console logs (`[Firestore]` prefix)
2. Review Firestore data in console
3. Test with curl/Postman
4. Review Cloud Function logs

---

**Document Version:** 1.0  
**Last Reviewed:** April 13, 2026  
**Status:** ✓ Complete - Ready for hardware integration
