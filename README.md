# Buoy Telemetry Dashboard

**Live Site:** https://zahraa-sattar1.github.io/?buoy=buoy-001

A real-time monitoring dashboard for ocean buoy telemetry data. Displays sensor readings (temperature, battery, signal strength) with automated alerts and fallback to demo data when offline.

## Quick Start

### View the Dashboard
Simply visit the live site above. The dashboard will:
1. ✅ Connect to Firebase Firestore for real-time data
2. 🟠 Fall back to demo data if Firebase unavailable  
3. 🔴 Show "No Data Available" if both fail

### Local Development

```bash
# Clone the repository
git clone https://github.com/zahraa-sattar1/zahraa-sattar1.github.io
cd zahraa-sattar1.github.io

# Open in browser
open index.html  # macOS
# or manually open: file:///path/to/index.html
```

**No build process required** - it's a static site with Firebase SDK loaded from CDN.

## Architecture

For detailed architecture documentation, see **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** which includes:

- High-level system design
- Data flow & real-time subscriptions
- Firestore database schema
- Frontend module documentation
- Backend Cloud Functions
- Microcontroller integration guide
- Testing & validation procedures

**TL;DR:** Microcontroller → Cloud Function → Firestore → Real-time Dashboard

## Project Structure

```
.
├── index.html                          # Main dashboard page
├── css/
│   └── styles.css                      # Responsive design & styling
├── js/
│   ├── app.js                          # Main application controller
│   ├── config.js                       # UI configuration
│   ├── firebase-init.js                # Firebase SDK setup
│   ├── firestore-service.js            # Firestore subscriptions
│   └── data-adapter.js                 # Data normalization
├── data/
│   └── mock-readings.json              # Demo data (fallback)
├── firebase/
│   ├── firestore.rules                 # Database security rules
│   ├── firestore.indexes.json          # Query optimizations
│   ├── functions/
│   │   ├── src/index.js                # Cloud Functions code
│   │   └── package.json                # Cloud Functions dependencies
│   └── firebase.json                   # Firebase config
├── docs/
│   ├── ARCHITECTURE.md                 # Complete architecture guide
│   ├── firebase-backend-setup.md       # Backend setup guide
│   ├── github-pages-setup.md           # Deployment guide
│   └── github-secrets.md               # Secrets management
└── README.md                           # This file
```

## Features

### Dashboard Display
- **4 Metric Cards:** Temperature, Battery, Signal Strength, Custom Sensor
- **Alerts Panel:** Automatic warnings for low battery/weak signal/offline status
- **Device Health:** Firmware version, Gateway ID, Data rate, Packet count
- **Connection Badge:** Shows Firebase status (Connected/Fallback/Error)

### Data Sources
1. **Primary:** Real-time Firestore database (< 1 second latency)
2. **Fallback:** Mock JSON data (4-second cycling)
3. **Error State:** "No Data Available" with helpful link

### Smart Fallback
- Tries Firestore for 3 seconds
- Falls back to mock data automatically if timeout
- Shows connection status with color-coded badge
- Never fails silently

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | HTML5, CSS3, ES6 JavaScript, Firebase SDK v10.7.0 |
| **Database** | Firebase Firestore (real-time NoSQL) |
| **Backend** | Cloud Functions (Node.js 20) |
| **Hosting** | GitHub Pages (static) |
| **DevOps** | GitHub Actions (auto-deploy) |

## Configuration

### UI Settings (`js/config.js`)
```javascript
UI_CONFIG = {
  refreshMs: 4000,              // Demo data update interval
  units: {
    temperature: "deg C",
    battery: "%",
    signal: "dBm"
  },
  thresholds: {
    batteryLow: 25,            // Alert if < 25%
    signalWeak: -115           // Alert if < -115 dBm
  }
}
```

### Firebase Project
- **Project ID:** phytowatch
- **Firestore:** Public read access, authenticated writes
- **Cloud Functions:** Data ingestion endpoints

Modify thresholds in `js/config.js` to adjust when alerts trigger.

## Data Flow

```
Microcontroller
     ↓
  (HTTPS POST)
     ↓
Cloud Function: ingestReading()
     ↓
Firestore Database: buoys/{id}/readings/
     ↓
Real-time Listener: onSnapshot()
     ↓
Browser Dashboard
     ↓
User Sees Live Data
```

**Alternative Fallback:** If Firebase unavailable → Show mock data

## Firestore Schema

### Collection: `buoys/{buoyId}`
Device metadata (name, location, status)

### Sub-Collection: `buoys/{buoyId}/readings`
Time-series sensor data with automatic real-time synchronization

```firestore
{
  "timestamp": Timestamp,    // Server time (auto)
  "temperature": 15.3,       // °C
  "battery": 87,            // %
  "signal": -95,            // dBm
  "custom1": 42.1           // Sensor-specific
}
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#firestore-database-schema) for complete schema.

## Cloud Functions

### Data Ingestion Endpoint
```
POST /ingestReading
X-API-Key: YOUR_API_KEY

Receives: {
  "buoyId": "buoy-001",
  "temperature": 15.3,
  "battery": 87,
  "signal": -95
}
```

### Data Retrieval Endpoint
```
GET /getLatestBuoySnapshot?buoyId=buoy-001

Returns: {
  "buoy": {...},
  "latest": {...}
}
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#backend-cloud-functions) for full API documentation.

## Integration with Hardware

To connect real microcontrollers (ESP32, Arduino, etc.):

1. **Send HTTPS POST** to Cloud Function with sensor readings
2. **Function validates** and writes to Firestore
3. **Dashboard updates** in real-time via Firestore subscription
4. **Cloud logs** track all ingestions and errors

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#integration-with-microcontrollers) for:
- Arduino C++ example code
- Minimal WiFi + HTTPS setup
- Data format specification
- RTC / timestamp synchronization
- Integration checklist

## Testing

### View Demo Dashboard
```
https://zahraa-sattar1.github.io/?buoy=buoy-001
```
Shows mock data (since no hardware connected yet)

### Test Real Data
1. Add a document to Firestore Console:
   - Collection: `buoys/buoy-001/readings`
   - Fields: timestamp, temperature, battery, signal
2. Refresh dashboard
3. See real-time update (< 1 second)

### Debug
Open browser console (F12) and filter for `[Firestore]` logs to trace data flow.

## Troubleshooting

### Dashboard Shows "🔴 No Data Available"
- Check Firestore has data: https://console.firebase.google.com/project/phytowatch/firestore
- Check mock-readings.json is populated
- Clear browser cache (Cmd+Shift+R)

### Shows "🟠 Fallback Mode"  
- Firebase is unavailable (offline/blocked)
- Using mock demo data (normal)
- Auto-switches to real data when Firebase available

### Metrics Show "--"
- Sensor value missing from Firestore document
- Firestore document missing that field entirely

### No Real-Time Updates
- Firestore rules too restrictive
- Browser console shows errors (F12)
- Firestore listener not connected

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#troubleshooting-guide) for full troubleshooting table.

## Deployment

### Frontend (GitHub Pages)
```bash
git add .
git commit -m "Update dashboard"
git push origin main
```
Auto-deployed by GitHub Actions to https://zahraa-sattar1.github.io

### Firestore Rules
```bash
firebase deploy --only firestore:rules
```

### Cloud Functions
```bash
cd firebase/functions
npm install
firebase deploy --only functions
```

## Browser Compatibility

- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

Requires:
- ES6 modules support
- CSS Grid support
- HTTPS (for Firestore)
- Third-party cookies (Firebase)

## Security

- 🔒 Firestore rules enforce public read-only access
- 🔒 Cloud Functions require API key validation
- 🔒 HTTPS-only API endpoints
- 🔒 Service account key NOT stored in repository

See [docs/github-secrets.md](docs/github-secrets.md) for credential management.

## License

[Add your license here]

## Contributing

1. Fork repository
2. Create feature branch
3. Test locally (open index.html)
4. Commit with clear messages
5. Push and submit PR

## References

- [Firebase Firestore Docs](https://firebase.google.com/docs/firestore)
- [Cloud Functions Docs](https://firebase.google.com/docs/functions)
- [GitHub Pages Docs](https://pages.github.com/)
- **[Complete Architecture Guide](docs/ARCHITECTURE.md)**

## Status

✅ **MVP Complete** - Real-time dashboard with Firebase backend  
🚧 **Next Phase** - Hardware integration & Cloud Functions deployment

---

**Questions?** Check [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for comprehensive documentation.

