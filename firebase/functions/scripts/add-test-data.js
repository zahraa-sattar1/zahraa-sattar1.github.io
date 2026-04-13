const admin = require("firebase-admin");

// Initialize Firebase Admin SDK (uses GOOGLE_APPLICATION_CREDENTIALS env var or default)
admin.initializeApp({
  projectId: "phytowatch"
});

const db = admin.firestore();

async function addTestData() {
  try {
    console.log("Adding test data to Firestore...");

    // Create a buoy document
    const buoyId = "buoy-001";
    await db.collection("buoys").doc(buoyId).set({
      name: "Buoy Alpha",
      location: "Station 1",
      status: "active",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`✓ Created buoy: ${buoyId}`);

    // Add sample readings
    const readingsData = [
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

    for (const reading of readingsData) {
      await db.collection("buoys").doc(buoyId).collection("readings").add(reading);
    }
    console.log(`✓ Added ${readingsData.length} readings to ${buoyId}`);

    // Add a sample alert
    await db.collection("buoys").doc(buoyId).collection("alerts").add({
      type: "battery_low",
      level: "warning",
      message: "Battery level below 25%",
      resolved: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log("✓ Added sample alert");

    console.log("\n✅ Test data added successfully!");
    console.log(`View at: https://zahraa-sattar1.github.io/?buoy=${buoyId}`);
    
    process.exit(0);
  } catch (error) {
    console.error("Error adding test data:", error);
    process.exit(1);
  }
}

addTestData();
