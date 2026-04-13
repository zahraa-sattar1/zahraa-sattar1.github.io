# Firebase Setup and Deployment Guide

Your buoy telemetry dashboard is now configured to use Firebase as the backend. Here's how to complete the setup and deploy.

## Frontend Configuration (✅ Done)

Your dashboard has been updated to:
- Load Firebase SDK from CDN
- Subscribe to real-time telemetry data from Firestore
- Fall back to mock data if Firestore is unavailable
- Display data automatically as it updates in Firestore

**Project ID:** `phytowatch`

## Database Structure

The Firestore database expects this structure:

```
buoys/
  └── {buoyId}/
      ├── readings/
      │   ├── {readingId}: { timestamp, readings: {...}, connection, ... }
      │   └── ...
      ├── summaries/
      │   └── {summaryId}: { ... }
      └── alerts/
          └── {alertId}: { ... }
```

## Deploy Firestore Rules

Your security rules have been updated to allow public read access to buoy data (for the dashboard) while requiring authentication for writes (ingest service only).

```bash
cd firebase
firebase deploy --only firestore:rules
```

## Deploy Cloud Functions (Backend)

The Firebase Cloud Functions handle incoming telemetry data:

```bash
cd firebase
firebase deploy --only functions
```

The backend expects POST requests to the `ingestReading` function with:
- Header: `X-Api-Key: <your-api-key>`
- Body:
```json
{
  "buoyId": "buoy-001",
  "timestamp": "2026-04-13T10:30:00Z",
  "readings": {
    "temperature": 15.5,
    "battery": 87,
    "signal": -95,
    "custom1": 42.1
  },
  "meta": { "firmware": "v2.1", "gateway": "gw-001" }
}
```

## Frontend Deployment (GitHub Pages)

Your site is already deployed to GitHub Pages at:
**https://zahraa-sattar1.github.io/**

The GitHub Actions workflow in `.github/workflows/deploy-pages.yml` automatically deploys when you push to `main`.

## Query the Dashboard

You can specify which buoy to display by adding a query parameter:

```
https://zahraa-sattar1.github.io/?buoy=buoy-001
https://zahraa-sattar1.github.io/?buoy=buoy-002
```

## Testing with Mock Data

If your Firestore database is empty or unavailable, the dashboard automatically falls back to mock data from `data/mock-readings.json` after 3 seconds. Check the browser console for logs.

## Environment Variables

For Cloud Functions, set the API key:

```bash
firebase functions:config:set ingest.api_key="your-secret-key"
firebase deploy --only functions
```

## Troubleshooting

- **No data shown?** Check browser console (F12) for Firebase connection errors
- **Getting mock data?** Firestore might be empty or unreachable
- **CORS errors?** Ensure Firestore rules allow public read access
- **Authentication failing?** The ingest service needs the custom claim `ingest: true`

## Next Steps

1. Populate Firestore with sample readings using the Cloud Function
2. Update `.firebaserc` with your project ID if different
3. Deploy Cloud Functions
4. Deploy Firestore rules
5. Configure your buoy data source to POST to the Cloud Function
