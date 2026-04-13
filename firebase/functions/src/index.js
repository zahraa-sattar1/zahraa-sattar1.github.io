import { onRequest } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

initializeApp();

const db = getFirestore();

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Api-Key"
};

export const ingestReading = onRequest({ region: "us-central1" }, async (req, res) => {
  if (req.method === "OPTIONS") {
    return res.status(204).set(CORS_HEADERS).send("");
  }

  if (req.method !== "POST") {
    return res.status(405).set(CORS_HEADERS).json({ error: "Method not allowed" });
  }

  const expectedApiKey = process.env.INGEST_API_KEY;
  const providedApiKey = req.get("X-Api-Key");

  if (!expectedApiKey || providedApiKey !== expectedApiKey) {
    return res.status(401).set(CORS_HEADERS).json({ error: "Unauthorized" });
  }

  const payload = req.body;
  const validationError = validatePayload(payload);

  if (validationError) {
    return res.status(400).set(CORS_HEADERS).json({ error: validationError });
  }

  const { buoyId, timestamp, readings, meta } = payload;

  const buoyRef = db.collection("buoys").doc(buoyId);
  const readingRef = buoyRef.collection("readings").doc();

  const parsedTimestamp = Timestamp.fromDate(new Date(timestamp));
  const now = FieldValue.serverTimestamp();

  await db.runTransaction(async (txn) => {
    txn.set(readingRef, {
      buoyId,
      timestamp: parsedTimestamp,
      readings,
      meta: meta || {},
      receivedAt: now
    });

    txn.set(
      buoyRef,
      {
        lastSeenAt: now,
        lastPacketTimestamp: parsedTimestamp,
        packetCount: FieldValue.increment(1),
        status: "online",
        updatedAt: now
      },
      { merge: true }
    );
  });

  return res.status(202).set(CORS_HEADERS).json({
    status: "accepted",
    buoyId,
    readingId: readingRef.id
  });
});

export const getLatestBuoySnapshot = onRequest({ region: "us-central1" }, async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const buoyId = req.query.buoyId;
  if (!buoyId || typeof buoyId !== "string") {
    return res.status(400).json({ error: "Query param buoyId is required" });
  }

  const buoyRef = db.collection("buoys").doc(buoyId);
  const latestQuery = buoyRef.collection("readings").orderBy("timestamp", "desc").limit(1);

  const [buoyDoc, latestSnapshot] = await Promise.all([buoyRef.get(), latestQuery.get()]);

  if (!buoyDoc.exists) {
    return res.status(404).json({ error: "Buoy not found" });
  }

  const latest = latestSnapshot.empty ? null : { id: latestSnapshot.docs[0].id, ...latestSnapshot.docs[0].data() };
  return res.status(200).json({ buoy: buoyDoc.data(), latestReading: latest });
});

function validatePayload(payload) {
  if (!payload || typeof payload !== "object") {
    return "Body must be a JSON object";
  }

  if (!payload.buoyId || typeof payload.buoyId !== "string") {
    return "buoyId is required and must be a string";
  }

  if (!payload.timestamp || Number.isNaN(Date.parse(payload.timestamp))) {
    return "timestamp is required and must be an ISO date string";
  }

  if (!payload.readings || typeof payload.readings !== "object" || Array.isArray(payload.readings)) {
    return "readings is required and must be an object";
  }

  return null;
}
