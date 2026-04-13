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
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const data = doc.data();
        callback([{
          ...data,
          id: doc.id,
          timestamp: data.timestamp?.toDate?.() || new Date()
        }]);
      } else {
        callback([]);
      }
    }, (error) => {
      console.error("Firestore subscription error:", error);
      callback([]);
    });

    return unsubscribe;
  } catch (error) {
    console.error("Error subscribing to readings:", error);
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
