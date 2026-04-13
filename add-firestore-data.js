#!/usr/bin/env node

/**
 * Add test data to Firestore
 * Run: node add-firestore-data.js
 * 
 * Prerequisites:
 * 1. Download service account key from Firebase Console
 * 2. Save it as: firebase/service-account-key.json
 * 3. Run: npm install firebase-admin (in firebase/functions folder)
 */

const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

// Load service account key
const keyPath = path.join(__dirname, "firebase", "service-account-key.json");

if (!fs.existsSync(keyPath)) {
  console.error("❌ Service account key not found!");
  console.error(`Please download it from Firebase Console and save to: ${keyPath}`);
  console.error("\nSteps:");
  console.error("1. Go to: https://console.firebase.google.com/project/phytowatch/settings/serviceaccounts/adminsdk");
  console.error("2. Click 'Generate New Private Key'");
  console.error("3. Save as: firebase/service-account-key.json");
  process.exit(1);
}

const serviceAccount = require("./firebase/service-account-key.json");

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "phytowatch"
});

const db = admin.firestore();

async function addTestData() {
  try {
    console.log("🚀 Adding test data to Firestore...\n");

    // Step 1: Create buoy document
    const buoyId = "buoy-001";
    console.log(`📍 Creating buoy: ${buoyId}`);
    await db.collection("buoys").doc(buoyId).set({
      name: "Buoy Alpha",
      location: "Station 1",
      status: "active",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log("   ✓ Buoy created\n");

    // Step 2: Add readings
    console.log("📊 Adding readings...");
    const readings = [
      {
        timestamp: admin.firestore.Timestamp.now(),
        connection: "online",
        firmware: "v2.1",
        gateway: "gw-001",
        packetCount: 1234,
        dataRate: "LoRa",
        readings: {
          temperature: 15.5,
          battery: 87,
          signal: -95,
          custom1: 42.1
        }
      },
      {
        timestamp: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 60000)),
        connection: "online",
        firmware: "v2.1",
        gateway: "gw-001",
        packetCount: 1233,
        dataRate: "LoRa",
        readings: {
          temperature: 15.3,
          battery: 86,
          signal: -98,
          custom1: 41.8
        }
      },
      {
        timestamp: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 120000)),
        connection: "online",
        firmware: "v2.1",
        gateway: "gw-001",
        packetCount: 1232,
        dataRate: "LoRa",
        readings: {
          temperature: 15.1,
          battery: 85,
          signal: -92,
          custom1: 41.5
        }
      }
    ];

    for (let i = 0; i < readings.length; i++) {
      await db.collection("buoys").doc(buoyId).collection("readings").add(readings[i]);
      console.log(`   ✓ Reading ${i + 1}/${readings.length} added`);
    }
    console.log("");

    // Step 3: Add alert
    console.log("🚨 Adding sample alert...");
    await db.collection("buoys").doc(buoyId).collection("alerts").add({
      type: "battery_low",
      level: "warning",
      message: "Battery level below threshold",
      active: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log("   ✓ Alert added\n");

    console.log("✅ Success! Test data added to Firestore");
    console.log(`\n📺 View your dashboard: https://zahraa-sattar1.github.io/?buoy=${buoyId}`);
    console.log("   (It will show 🟢 Connected when pulling from Firebase)\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

addTestData();
