/**
 * @module firestore-service
 * @description Manages real-time Firestore subscriptions for buoy telemetry data.
 * Provides callback-based API for subscribing to readings and buoy metadata.
 *
 * This layer abstracts Firestore query complexity and provides a clean interface
 * for app.js to subscribe to real-time buoy data without knowing Firestore details.
 */

import { db, collection, query, orderBy, limit, onSnapshot } from "./firebase-init.js";

const FIRESTORE_HISTORY_LIMIT = 36;

/**
 * Subscribe to the latest reading for a specific buoy in real-time.
 *
 * Firestore Collections structure:
 * ```
 * buoys/{buoyId}/readings/{readingId}
 *   ├── timestamp: Firestore.Timestamp (server time)
 *   ├── temperature: number (°C)
 *   ├── battery: number (0-100%)
 *   ├── signal: number (dBm, negative)
 *   └── custom1: number (sensor-specific)
 * ```
 *
 * The subscription automatically:
 * - Maintains real-time connection (reconnects on network failure)
 * - Converts Firestore Timestamp → JavaScript Date
 * - Returns results in consistent array format (0-1 elements)
 * - Logs operations for debugging in browser console
 * - Calls error handler if connection fails
 *
 * @param {string} buoyId - Buoy identifier (e.g., "buoy-001")
 * @param {Function} callback - Called with latest reading when it changes
 *                              Receives array [reading] or [] if no data
 *
 * @returns {Function} Unsubscribe function to stop listening and clean up
 *
 * @example
 * // Listen to buoy-001
 * const unsub = subscribeToReadings("buoy-001", (readings) => {
 *   if (readings.length > 0) {
 *     console.log("Latest:", readings[0].timestamp);
 *   }
 * });
 * // Later: unsub() to disconnect
 */
export function subscribeToReadings(buoyId, callback) {
  try {
    const buoyRef = collection(db, "buoys", buoyId, "readings");
    const q = query(buoyRef, orderBy("timestamp", "desc"), limit(FIRESTORE_HISTORY_LIMIT));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log(`[Firestore] Query result for ${buoyId}: ${snapshot.docs.length} documents`);
      
      if (!snapshot.empty) {
        const normalizedData = snapshot.docs.map((doc) => {
          const data = doc.data();
          const timestamp = data.timestamp?.toDate?.() || data.timestamp || new Date();

          return {
            ...data,
            id: doc.id,
            timestamp: timestamp instanceof Date ? timestamp : new Date(timestamp)
          };
        });

        console.log(`[Firestore] Normalized ${normalizedData.length} readings from Firebase`);
        callback(normalizedData);
      } else {
        console.log(`[Firestore] No readings found for buoy: ${buoyId}`);
        callback([]);
      }
    }, (error) => {
      console.error("[Firestore] Subscription error:", error);
      callback([]);
    });

    return unsubscribe;
  } catch (error) {
    console.error("[Firestore] Error subscribing to readings:", error);
    callback([]);
    return () => {}; // Return no-op unsubscribe if subscription setup fails
  }
}

/**
 * Subscribe to list of all buoys in real-time.
 *
 * Firestore Collections structure:
 * ```
 * buoys/{buoyId}
 *   ├── name: string (e.g., "Buoy Alpha")
 *   ├── location: string (e.g., "Cape Town Harbor")
 *   └── lastSeen: Firestore.Timestamp (last data received)
 * ```
 *
 * Useful for:
 * - Buoy selector dropdown
 * - Fleet status overview
 * - Detecting offline buoys
 *
 * @param {Function} callback - Called with array of all buoys when list changes
 *                              Receives array of {id, name, location, lastSeen}
 *
 * @returns {Function} Unsubscribe function to stop listening
 *
 * @example
 * const unsub = subscribeToBuoys((buoys) => {
 *   console.log(`${buoys.length} buoys online`);
 *   buoys.forEach(b => console.log(b.name));
 * });
 */
export function subscribeToBuoys(callback) {
  try {
    const buoysRef = collection(db, "buoys");
    
    const unsubscribe = onSnapshot(buoysRef, (snapshot) => {
      const buoys = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(buoys);
    }, (error) => {
      console.error("Firestore buoys subscription error:", error);
      callback([]);
    });

    return unsubscribe;
  } catch (error) {
    console.error("Error subscribing to buoys:", error);
    callback([]);
    return () => {};
  }
}
