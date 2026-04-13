import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getFirestore, collection, query, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA1ZvgoogoR5KbsVE1Uyb0obJ8hW321JV4",
  authDomain: "phytowatch.firebaseapp.com",
  projectId: "phytowatch",
  storageBucket: "phytowatch.firebasestorage.app",
  messagingSenderId: "946248468918",
  appId: "1:946248468918:web:7077bc68b193868cd55917",
  measurementId: "G-0SNKKWT871"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export { collection, query, orderBy, limit, onSnapshot };
