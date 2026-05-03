/**
 * @module firebase-init
 * @description Initializes Firebase SDK and Firestore database connection.
 * Exports Firestore instance and common query functions for use throughout the app.
 *
 * Firebase Project: phytowatch
 * - Firestore Database: Real-time cloud database for buoy telemetry data
 * - Security: Public read access for dashboard, authenticated writes for ingestion
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getFirestore, collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, doc, setDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

/**
 * Firebase configuration for phytowatch project.
 * WARNING: These are intentionally public keys for browser-based access (read-only).
 * Security is enforced via Firestore rules that allow public reads only.
 *
 * @type {Object}
 */
const firebaseConfig = {
  apiKey: "AIzaSyA1ZvgoogoR5KbsVE1Uyb0obJ8hW321JV4",
  authDomain: "phytowatch.firebaseapp.com",
  projectId: "phytowatch",
  storageBucket: "phytowatch.firebasestorage.app",
  messagingSenderId: "946248468918",
  appId: "1:946248468918:web:7077bc68b193868cd55917",
  measurementId: "G-0SNKKWT871"
};

/**
 * Initialize Firebase application instance
 */
const app = initializeApp(firebaseConfig);

/**
 * Firestore database instance - used throughout app for real-time subscriptions
 * @type {Database}
 */
export const db = getFirestore(app);

/**
 * Re-export common Firestore query and write functions for convenience
 */
export { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, doc, setDoc, writeBatch };
