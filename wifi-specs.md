# ESP32/ESP8266 WiFi Module Specifications

## Overview

This document outlines all necessary specifications for configuring the ESP32/ESP8266 WiFi module to:
1. Receive telemetry data from the ARM Cortex-M0 LoRa main controller via local UART/SPI
2. Transmit bulk data to the Firebase backend via WiFi
3. Integrate with the buoy telemetry dashboard frontend

**Hardware Setup:**
- **Main Controller:** ARM Cortex-M0 with LoRa transceiver (LoRa protocol)
- **WiFi Module:** ESP32 or ESP8266 (WiFi-only, no LoRa)
- **Communication:** UART or SPI serial link from Cortex-M0 to ESP32/ESP8266
- **Data Destination:** Firebase Firestore + Cloud Functions

---

## 1. PlatformIO Project Configuration

### 1.1 platformio.ini Template

```ini
[env:esp32dev]
platform = espressif32
board = esp32dev
framework = arduino
monitor_speed = 115200
lib_deps = 
    firebase/Firebase-ESP-Client @ ^1.3.0
    bblanchon/ArduinoJson @ ^7.0.0
    paulstoffregen/Time @ ^1.6.1
upload_speed = 921600

[env:esp8266]
platform = espressif8266
board = esp12e
framework = arduino
monitor_speed = 115200
lib_deps = 
    firebase/Firebase-ESP-Client @ ^1.3.0
    bblanchon/ArduinoJson @ ^7.0.0
    paulstoffregen/Time @ ^1.6.1
upload_speed = 460800
```

### 1.2 Required Libraries

| Library | Purpose | Version |
|---------|---------|---------|
| Firebase-ESP-Client | Firebase Firestore & Auth | ≥1.3.0 |
| ArduinoJson | JSON parsing/serialization | ≥7.0.0 |
| Time | RTC synchronization | ≥1.6.1 |

Install via:
```bash
pio lib install "firebase/Firebase-ESP-Client"
pio lib install "bblanchon/ArduinoJson"
pio lib install "paulstoffregen/Time"
```

---

## 2. Firebase Configuration

### 2.1 Firebase Credentials Required

You **must** obtain the following from Firebase Console (https://console.firebase.google.com):

#### Project: `phytowatch`

1. **API Key (Web API)**
   - Path: Project Settings → General → Web API Key
   - Value: `AIzaSy...` (starts with AIzaSy)
   - Store in: `src/credentials.h` or environment variable
   - Scope: Needed for all Firebase operations

2. **Project ID**
   - Value: `phytowatch`
   - Use in: Database URL, Cloud Function endpoints

3. **Service Account JSON** (for offline token generation - optional)
   - Path: Project Settings → Service Accounts → Generate new private key
   - File name: `firebase-key.json`
   - **WARNING:** Never commit this to version control
   - Use: Alternative to user/password auth if needed

4. **Anonymous Auth** (Recommended for IoT)
   - Firestore Rules must allow anonymous reads/writes
   - No credentials needed in code
   - Simplest for embedded devices

### 2.2 Create credentials.h Header

**File: `src/credentials.h`** (NOT committed to git)

```cpp
#ifndef CREDENTIALS_H
#define CREDENTIALS_H

// ============ WiFi Credentials ============
#define WIFI_SSID "your_wifi_network"
#define WIFI_PASSWORD "your_wifi_password"

// ============ Firebase Credentials ============
#define FIREBASE_API_KEY "AIzaSy..."  // From Firebase Console
#define FIREBASE_PROJECT_ID "phytowatch"
#define FIREBASE_DATABASE_URL "https://phytowatch.firebaseio.com"

// ============ Buoy Identifier ============
#define BUOY_ID "buoy-001"  // Must match Firestore document

// ============ Serial Communication ============
#define SERIAL_BAUD_RATE 9600         // UART speed to Cortex-M0
#define SERIAL_RX_PIN 16               // GPIO16 (RX)
#define SERIAL_TX_PIN 17               // GPIO17 (TX)

#endif
```

### 2.3 Firebase Firestore Structure

The ESP32 will write to this collection structure:

```
Database: phytowatch

Collection: buoys/{buoyId}
├─ Field: id (string) = "buoy-001"
├─ Field: name (string) = "Buoy 001"
├─ Field: location (geo) = (lat, lon)
├─ Field: status (string) = "active"
├─ Field: lastUpdate (timestamp) = server timestamp
│
└─ Sub-Collection: readings/
   └─ Document: {auto_generated_id}
      ├─ timestamp (timestamp) = server timestamp
      ├─ temperature (number) = 15.3
      ├─ battery (number) = 87
      ├─ signal (number) = -95
      ├─ custom1 (number) = 42.1
      └─ [additional sensor fields...]
```

### 2.4 Firestore Security Rules

**File: `firestore.rules`** (Deploy with `firebase deploy --only firestore:rules`)

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow anonymous read access for dashboard
    match /buoys/{buoyId} {
      allow read: if true;
    }
    
    match /buoys/{buoyId}/readings/{readingId} {
      allow read: if true;
      // Allow writes from devices sending proper sensor data
      // Cloud Function validates buoy ID and sensor ranges
      allow create: if request.auth != null || request.data.readings.keys().hasAll(['temperature', 'par', 'bbp', 'depth', 'battery', 'signal']);
    }
  }
}
```

---

## 3. Serial Communication Protocol

### 3.1 UART Configuration

**ESP32 Hardware UART:**
- Baud Rate: 9600 bps (configurable)
- Data Bits: 8
- Stop Bits: 1
- Parity: None (8N1)
- RX Pin: GPIO16 (UART2_RXD)
- TX Pin: GPIO17 (UART2_TXD)

**ESP8266 Hardware UART:**
- RX Pin: GPIO3 (RXD0)
- TX Pin: GPIO1 (TXD0)
- Alternative: Software serial on GPIO pins 13 & 15

### 3.2 Data Format from Cortex-M0

**Protocol:** JSON over UART

**Expected Message Format:**

```json
{
  "buoyId": "buoy-001",
  "timestamp": "2024-04-21T15:05:42.692Z",
  "connection": "online",
  "firmware": "v2.1.0",
  "gateway": "gw-cape-town-01",
  "packetCount": 1245,
  "dataRate": "9600bps",
  "readings": {
    "temperature": 15.3,
    "par": 850.5,
    "bbp": 0.0156,
    "depth": 25.3,
    "battery": 87,
    "signal": -95
  }
}
```

**Sensor Definitions:**

| Field | Unit | Source | Range | Description |
|-------|------|--------|-------|-------------|
| `temperature` | °C | LPS35HW | -20 to 50 | Water temperature from pressure sensor |
| `par` | lux | BH1750 | 0 to 100,000 | Photosynthetically Active Radiation (visible light 400-700 nm) |
| `bbp` | m⁻¹ | TSL2591 + 850nm IR | 0 to 1 | Optical backscatter (suspended particle proxy) |
| `depth` | m | LPS35HW | 0 to 1000 | Depth calculated from hydrostatic pressure |
| `battery` | % | N/A | 0 to 100 | System battery voltage percentage |
| `signal` | dBm | N/A | -200 to 0 | LoRa signal strength indicator |

**Alternative Compact Format (if bandwidth limited):**

```
BUOY,001,2024-04-21T15:05:42Z,15.3,850.5,0.0156,25.3,87,-95\r\n
```

### 3.3 Serial Buffer & Parsing

```cpp
#define RX_BUFFER_SIZE 512
char rxBuffer[RX_BUFFER_SIZE];
int rxIndex = 0;

void handleSerialData() {
  while (Serial2.available()) {
    char c = Serial2.read();
    
    if (c == '\n' || c == '\r') {
      if (rxIndex > 0) {
        rxBuffer[rxIndex] = '\0';
        processTelemData(rxBuffer);
        rxIndex = 0;
      }
    } else if (rxIndex < RX_BUFFER_SIZE - 1) {
      rxBuffer[rxIndex++] = c;
    }
  }
}
```

---

## 4. Cloud Function Integration

### 4.1 Data Ingestion Endpoint

**Function Name:** `ingestReading`  
**Endpoint:** `https://us-central1-phytowatch.cloudfunctions.net/ingestReading`  
**Method:** POST  
**Auth:** API Key required (header or query param)

**Request Format:**

```bash
curl -X POST \
  "https://us-central1-phytowatch.cloudfunctions.net/ingestReading?key=YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "buoyId": "buoy-001",
    "temperature": 15.3,
    "battery": 87,
    "signal": -95
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "message": "Reading ingested successfully",
  "docId": "auto-generated-firestore-id"
}
```

### 4.2 ESP32 Cloud Function Call Code

```cpp
#include <Firebase_ESP_Client.h>
#include <ArduinoJson.h>

FirebaseData fbdo;
FirebaseConfig config;
FirebaseAuth auth;

void initFirebase() {
  config.api_key = FIREBASE_API_KEY;
  config.database_url = FIREBASE_DATABASE_URL;
  
  // Use anonymous authentication (recommended for IoT)
  Firebase.begin(&config, &auth);
  Firebase.reconnectNetwork(true);
}

void sendTelemetry(JsonDocument &data) {
  if (!Firebase.ready()) {
    Serial.println("Firebase not ready");
    return;
  }

  // Compose Cloud Function URL
  String url = "https://us-central1-phytowatch.cloudfunctions.net/ingestReading?key=";
  url += FIREBASE_API_KEY;

  // Serialize JSON
  String payload;
  serializeJson(data, payload);

  // Send HTTPS POST
  if (Firebase.sendRequest(&fbdo, "post", url.c_str(), payload.c_str())) {
    Serial.print("Response: ");
    Serial.println(fbdo.payload());
  } else {
    Serial.print("Error: ");
    Serial.println(fbdo.errorReason());
  }
}
```

---

## 5. WiFi Configuration

### 5.1 WiFi Connection

```cpp
#include <WiFi.h>

void initWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nWiFi connection failed");
    // Implement fallback or retry logic
  }
}

void setup() {
  Serial.begin(115200);
  Serial2.begin(9600, SERIAL_8N1, SERIAL_RX_PIN, SERIAL_TX_PIN);
  
  initWiFi();
  initFirebase();
}
```

### 5.2 WiFi Power Modes

For battery efficiency (if applicable):

```cpp
// Light sleep (keeps WiFi connection)
WiFi.setSleep(WIFI_PS_MODEM);

// Deep sleep (drops WiFi, wake via GPIO)
// esp_sleep_enable_timer_wakeup(60 * 1000000);  // 60 seconds
// esp_deep_sleep_start();
```

---

## 6. Data Processing Pipeline

### 6.1 Main Loop Structure

```cpp
unsigned long lastSendTime = 0;
const unsigned long SEND_INTERVAL = 10000;  // 10 seconds

void loop() {
  // 1. Read from Cortex-M0 UART
  handleSerialData();
  
  // 2. Parse JSON/CSV from buffer
  // 3. Validate telemetry data
  
  // 4. Send to Firebase at regular intervals
  if (millis() - lastSendTime >= SEND_INTERVAL) {
    if (telemDataReady) {
      sendTelemetry(telemData);
      telemDataReady = false;
    }
    lastSendTime = millis();
  }
  
  // 5. Handle WiFi reconnection
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected, attempting reconnect...");
    WiFi.reconnect();
  }
  
  delay(100);
}
```

### 6.2 JSON Parsing Example

```cpp
DynamicJsonDocument doc(512);

void processTelemData(const char *json) {
  DeserializationError error = deserializeJson(doc, json);
  
  if (error) {
    Serial.print("JSON Parse Error: ");
    Serial.println(error.f_str());
    return;
  }
  
  // Extract fields
  const char *buoyId = doc["buoyId"];
  float temperature = doc["readings"]["temperature"];
  float par = doc["readings"]["par"];
  float bbp = doc["readings"]["bbp"];
  float depth = doc["readings"]["depth"];
  int battery = doc["readings"]["battery"];
  int signal = doc["readings"]["signal"];
  
  // Validate temperature range
  if (temperature < -20 || temperature > 50) {
    Serial.println("Temperature out of range!");
    return;
  }
  
  // Validate PAR range (lux)
  if (par < 0 || par > 100000) {
    Serial.println("PAR out of range!");
    return;
  }
  
  // Validate backscatter range (m⁻¹)
  if (bbp < 0 || bbp > 1.0) {
    Serial.println("Backscatter out of range!");
    return;
  }
  
  // Validate depth (meters)
  if (depth < 0 || depth > 1000) {
    Serial.println("Depth out of range!");
    return;
  }
  
  // Validate battery percentage
  if (battery < 0 || battery > 100) {
    Serial.println("Battery percentage invalid!");
    return;
  }
  
  // Validate signal (dBm, typically -200 to 0)
  if (signal < -200 || signal > 0) {
    Serial.println("Signal strength out of range!");
    return;
  }
  
  // Queue for Firebase send
  telemDataReady = true;
}
```

---

## 7. Timestamp Synchronization

### 7.1 RTC Setup (Optional)

For accurate timestamps without NTP:

```cpp
#include <TimeLib.h>

void syncTime() {
  // Option 1: NTP via WiFi (requires internet)
  configTime(0, 0, "pool.ntp.org");
  
  // Option 2: Get server timestamp from Firebase response
  // Use response metadata for most accurate time
}

unsigned long getEpochTime() {
  time_t now = time(nullptr);
  return (unsigned long)now;
}

// Use in telemetry:
doc["timestamp"] = getEpochTime();
```

### 7.2 Server-Side Timestamps

**Recommended:** Let Firestore set timestamps server-side (more reliable):

```cpp
// Don't send timestamp from ESP32
// Instead, let Cloud Function add it:
doc.remove("timestamp");

// Cloud Function will add:
// timestamp: admin.firestore.FieldValue.serverTimestamp()
```

---

## 8. Error Handling & Logging

### 8.1 Status Codes

```cpp
enum SysStatus {
  STATUS_INIT,           // 0: Initializing
  STATUS_WIFI_CONNECT,   // 1: Connecting to WiFi
  STATUS_WIFI_OK,        // 2: WiFi connected
  STATUS_FIREBASE_INIT,  // 3: Initializing Firebase
  STATUS_FIREBASE_OK,    // 4: Firebase ready
  STATUS_SERIAL_DATA,    // 5: Data received from Cortex-M0
  STATUS_ERROR_WIFI,     // 10: WiFi connection failed
  STATUS_ERROR_FIREBASE, // 11: Firebase error
  STATUS_ERROR_PARSE     // 12: JSON parse error
};
```

### 8.2 Serial Logging

```cpp
void logStatus(const char *tag, const char *message) {
  Serial.print("[");
  Serial.print(tag);
  Serial.print("] ");
  Serial.println(message);
}

// Usage:
logStatus("WiFi", "Connection successful");
logStatus("Firebase", "Reading sent successfully");
logStatus("Error", "JSON parse failed");
```

### 8.3 Firebase Logging

Use Cloud Functions console to monitor:
- https://console.firebase.google.com/project/phytowatch/functions

All `console.log()` in Cloud Functions appear in the logs.

---

## 9. Testing & Validation

### 9.1 Unit Testing on Hardware

```bash
# Build and upload
pio run -e esp32dev -t upload

# Monitor serial output
pio device monitor -p /dev/ttyUSB0 -b 115200
```

### 9.2 Debug Serial Output Checklist

Expected output on startup:

```
WiFi connecting...
WiFi connected!
IP: 192.168.1.100
Firebase initializing...
Firebase ready
[Waiting for data from Cortex-M0...]
[Serial Data] {"temperature": 15.3, "battery": 87, ...}
[Firebase] Reading sent successfully
```

### 9.3 Manual Testing

1. **Send mock data via UART terminal:**
   ```
   {"buoyId":"buoy-001","temperature":15.3,"battery":87,"signal":-95}
   ```

2. **Verify in Firebase Console:**
   - Go to: https://console.firebase.google.com/project/phytowatch/firestore
   - Check: `buoys/buoy-001/readings` collection
   - Confirm document created within 5 seconds

3. **Check Dashboard:**
   - Visit: https://zahraa-sattar1.github.io/?buoy=buoy-001
   - Verify real-time update appears

---

## 10. Security Best Practices

### 10.1 Credential Management

| Credential | Store | Commit to Git |
|------------|-------|---------------|
| `WIFI_SSID` | `src/credentials.h` | ❌ NO |
| `WIFI_PASSWORD` | `src/credentials.h` | ❌ NO |
| `FIREBASE_API_KEY` | `src/credentials.h` | ⚠️ Safe (Web API Key) |
| `firebase-key.json` | `.gitignore` | ❌ NO |

### 10.2 .gitignore Entry

```gitignore
# Secrets
src/credentials.h
firebase-key.json
.env
.env.local
```

### 10.3 Environment Variables (Alternative)

Instead of hardcoding in header:

```bash
export WIFI_SSID="your_network"
export WIFI_PASSWORD="your_password"
export FIREBASE_API_KEY="AIzaSy..."
```

Build with PlatformIO flags:

```ini
[env:esp32dev]
...
build_flags = 
  -DWIFI_SSID=${sysenv.WIFI_SSID}
  -DWIFI_PASSWORD=${sysenv.WIFI_PASSWORD}
  -DFIREBASE_API_KEY=${sysenv.FIREBASE_API_KEY}
```

---

## 11. Connection Diagram

```
┌─────────────────────────────────┐
│   ARM Cortex-M0 (LoRa RX)       │
│   - Receives LoRa packets       │
│   - Formats telemetry JSON      │
└──────────┬──────────────────────┘
           │ UART (9600 bps)
           │ 8N1, 5V/3.3V logic
           │
      ┌────▼────────────────────┐
      │   ESP32/ESP8266         │
      │   - Parses JSON         │
      │   - Connects to WiFi    │
      │   - Sends to Firebase   │
      └────┬────────────────────┘
           │ WiFi (802.11 b/g/n)
           │ HTTPS POST
           │
      ┌────▼────────────────────┐
      │  Firebase Backend       │
      │  - Cloud Functions      │
      │  - Firestore Database   │
      └────┬────────────────────┘
           │ Real-time Listener
           │ JSON/REST API
           │
      ┌────▼────────────────────┐
      │  Web Dashboard          │
      │  (GitHub Pages)         │
      │  (Real-time Metrics)    │
      └─────────────────────────┘
```

---

## 12. Checklist for Deployment

- [ ] Create `src/credentials.h` with WiFi and Firebase credentials
- [ ] Install PlatformIO libraries via `platformio.ini`
- [ ] Verify UART pins match your ESP32 board (GPIO16/17 or custom)
- [ ] Test serial communication with Cortex-M0 (use serial monitor)
- [ ] Confirm WiFi SSID and password are correct
- [ ] Verify Firestore collection structure (`buoys/{buoyId}/readings`)
- [ ] Deploy Firestore security rules
- [ ] Deploy Cloud Functions
- [ ] Test Cloud Function endpoint with `curl`
- [ ] Upload firmware to ESP32/ESP8266
- [ ] Monitor serial output for errors
- [ ] Verify data appears in Firestore Console
- [ ] Confirm dashboard updates in real-time
- [ ] Add `src/credentials.h` to `.gitignore`

---

## 13. Common Issues & Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Firebase "not ready" | Init not complete | Call `Firebase.begin()` and wait 2-3 seconds |
| No WiFi connection | Wrong SSID/password | Verify credentials in `credentials.h` |
| Serial data not parsed | JSON format mismatch | Check Cortex-M0 is sending valid JSON |
| Data not in Firestore | Cloud Function error | Check Cloud Functions logs in Firebase Console |
| Dashboard shows "Fallback" | Firestore rules too strict | Ensure rules allow public read access |
| Out of memory | Buffer overflow | Reduce `RX_BUFFER_SIZE` or use external storage |

---

## 14. References

- **Firebase Docs:** https://firebase.google.com/docs/firestore
- **ESP32 Pinout:** https://docs.espressif.com/projects/esp-idf/en/latest/esp32/hw-reference/esp32_devkitc.html
- **Firebase Arduino Client:** https://github.com/mobizt/Firebase-ESP-Client
- **ArduinoJson Guide:** https://arduinojson.org/
- **Buoy Dashboard:** https://zahraa-sattar1.github.io/?buoy=buoy-001
- **Architecture Docs:** See `docs/ARCHITECTURE.md` in this repository

---

## 15. Next Steps

1. **Setup Hardware:**
   - Connect Cortex-M0 UART TX to ESP32 RX (GPIO16)
   - Connect Cortex-M0 UART RX to ESP32 TX (GPIO17)
   - Ensure common ground between boards

2. **Configure Firmware:**
   - Edit `src/credentials.h` with WiFi + Firebase credentials
   - Adjust serial pins if using different GPIO
   - Compile and upload

3. **Deploy Backend:**
   - Deploy Cloud Functions to Firebase
   - Update Firestore security rules
   - Test with `curl`

4. **Monitor & Debug:**
   - Watch serial output for errors
   - Check Firestore Console for data
   - View dashboard for real-time updates

---

**Status:** Ready for integration with ARM Cortex-M0 LoRa controller and Firebase backend.

**Last Updated:** 2026-04-21

**Maintained by:** Zahra Asattar
