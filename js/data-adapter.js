export function normalizeIncomingPacket(rawPacket) {
  // Handle both string and Date timestamps
  let timestamp = rawPacket?.timestamp;
  if (timestamp instanceof Date) {
    timestamp = timestamp.toISOString();
  } else if (!timestamp) {
    timestamp = new Date().toISOString();
  } else if (typeof timestamp === 'string') {
    // Already a string, use as-is
  } else {
    timestamp = new Date().toISOString();
  }

  return {
    timestamp,
    connection: rawPacket?.connection || "offline",
    firmware: rawPacket?.firmware || "Unknown",
    gateway: rawPacket?.gateway || "Unknown",
    packetCount: Number(rawPacket?.packetCount ?? 0),
    dataRate: rawPacket?.dataRate || "Unknown",
    readings: {
      temperature: safeNumber(rawPacket?.readings?.temperature),
      battery: safeNumber(rawPacket?.readings?.battery),
      signal: safeNumber(rawPacket?.readings?.signal),
      custom1: safeNumber(rawPacket?.readings?.custom1)
    }
  };
}

function safeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
