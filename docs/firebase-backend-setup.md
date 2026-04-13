# Firebase Backend Setup

## 1. Create Firebase project

- In Firebase Console, create a project.
- Enable Firestore in Native mode.

## 2. Update local project id

Edit firebase/.firebaserc and replace:

- replace-with-your-firebase-project-id

with your real Firebase project id.

## 3. Prepare functions environment

From project root:

```bash
cd firebase/functions
npm install
```

Set function secret for API key (recommended):

```bash
firebase functions:secrets:set INGEST_API_KEY
```

Then deploy from project root:

```bash
cd firebase
firebase deploy --only functions,firestore:rules,firestore:indexes
```

## 4. Ingest endpoint format

Endpoint after deploy:

- https://us-central1-<project-id>.cloudfunctions.net/ingestReading

Headers:

- Content-Type: application/json
- X-Api-Key: <your secret>

Example body:

```json
{
  "buoyId": "buoy-001",
  "timestamp": "2026-04-13T12:00:00Z",
  "readings": {
    "temperature": 19.3,
    "battery": 81,
    "signal": -104,
    "custom1": 4.2
  },
  "meta": {
    "firmware": "v1.0.0",
    "gateway": "shore-gateway-1"
  }
}
```

## 5. Snapshot endpoint

- https://us-central1-<project-id>.cloudfunctions.net/getLatestBuoySnapshot?buoyId=buoy-001

This returns current buoy metadata plus latest reading document.
