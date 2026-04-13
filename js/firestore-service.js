import { db, collection, query, orderBy, limit, onSnapshot } from "./firebase-init.js";

/**
 * Subscribe to real-time updates from Firestore
 * Returns latest reading from buoys collection
 * Falls back to empty array if no data available
 */
export function subscribeToReadings(buoyId, callback) {
  try {
    const buoyRef = collection(db, "buoys", buoyId, "readings");
    const q = query(buoyRef, orderBy("timestamp", "desc"), limit(1));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log(`[Firestore] Query result for ${buoyId}: ${snapshot.docs.length} documents`);
      
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const data = doc.data();
        console.log("[Firestore] Raw data from Firebase:", data);
        
        // Properly convert Firestore Timestamp to JS Date
        const timestamp = data.timestamp?.toDate?.() || data.timestamp || new Date();
        const normalizedData = {
          ...data,
          id: doc.id,
          timestamp: timestamp instanceof Date ? timestamp : new Date(timestamp)
        };
        
        console.log("[Firestore] Normalized data:", normalizedData);
        callback([normalizedData]);
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
    return () => {};
  }
}

/**
 * Get all buoys metadata
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
