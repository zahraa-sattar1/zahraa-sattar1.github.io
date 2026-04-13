export function normalizeIncomingPacket(rawPacket) {
  return {
    timestamp: rawPacket?.timestamp || new Date().toISOString(),
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
