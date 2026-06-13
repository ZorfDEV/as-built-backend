import XLSX from 'xlsx';
import {
  getDeviceStatus,
  getDeviceAlerts,
  getPortHistory,
  getAllPortsForDevices,
  loadDeviceHostnames,   // ✅ nouvel import
} from "./observiumService.js";
import { devicesConfig } from "./../config/devices.js";



// ─── Disponibilité ────────────────────────────────────────────────────────────

function computeAvailability(alerts, dateFrom, dateTo) {
  const start   = new Date(dateFrom).getTime();
  const end     = new Date(dateTo).getTime() + 86399000; // ✅ inclut fin de journée
  const totalMs = end - start;
  if (totalMs <= 0) return 100;

  if (!Array.isArray(alerts)) return 100; // ✅ garde-fou

  let downMs = 0;
  alerts
    .filter((a) => a.alert_status === "0") // ✅ "alert_status" et non "status"
    .forEach((alert) => {
      const alertStart   = new Date(alert.timestamp).getTime();
      const alertEnd     = alert.recovered_at
        ? new Date(alert.recovered_at).getTime()
        : end;
      const overlapStart = Math.max(alertStart, start);
      const overlapEnd   = Math.min(alertEnd,   end);
      if (overlapEnd > overlapStart) downMs += overlapEnd - overlapStart;
    });

  return Math.round(((totalMs - downMs) / totalMs) * 10000) / 100;
}

// ─── Extraction stats depuis la réponse getPortHistory ───────────────────────

// Convertit "8.06G" → 8060 Mbps
// Convertit "6.02G" → 6020 Mbps
// Convertit "113.01M" → 113.01 Mbps
// Convertit "452.60T" → valeur en Mbps
function parseObserviumValue(str) {
  if (!str || str.trim() === "0" || str.trim() === "") return 0;

  const clean = str.trim();
  const num   = parseFloat(clean);

  if (isNaN(num)) return 0;

  if (clean.includes("T"))      return num * 1_000_000;  // Tbps → Mbps
  if (clean.includes("G"))      return num * 1_000;      // Gbps → Mbps
  if (clean.includes("M"))      return num;              // Mbps → Mbps
  if (clean.includes("k") ||
      clean.includes("K"))      return num / 1_000;      // Kbps → Mbps
  if (clean.includes("µ") ||
      clean.includes("u"))      return num / 1_000_000;  // µbps → Mbps

  // Valeur brute en bits/s → Mbps
  return num / 1_000_000;
}

function extractPortStats(historyData, portCfg) {
  const port   = historyData?.port    ?? {};
  const inner  = historyData?.legend?.legend ?? {}; // ✅ legend.legend

  const speedBps  = Number(port.ifSpeed ?? 0);
  const speedMbps = speedBps / 1_000_000;

  const operStatus  = port.ifOperStatus  ?? "unknown";
  const adminStatus = port.ifAdminStatus ?? "unknown";
  const inErrors    = parseInt(port.ifInErrors    ?? 0);
  const outErrors   = parseInt(port.ifOutErrors   ?? 0);
  const inDiscards  = parseInt(port.ifInDiscards  ?? 0);
  const outDiscards = parseInt(port.ifOutDiscards ?? 0);

  // ✅ Lecture depuis legend.legend avec parsing des strings formatées
  const p95InMbps  = parseObserviumValue(inner.in?.["95th"]);
  const p95OutMbps = parseObserviumValue(inner.out?.["95th"]);
  const avgInMbps  = parseObserviumValue(inner.in?.avg);
  const avgOutMbps = parseObserviumValue(inner.out?.avg);
  const maxInMbps  = parseObserviumValue(inner.in?.max);
  const maxOutMbps = parseObserviumValue(inner.out?.max);

  console.log(`Port ${portCfg.ifName} (${portCfg.port_id})`);
  console.log(`  P95 In : ${p95InMbps} Mbps | P95 Out : ${p95OutMbps} Mbps`);
  console.log(`  Avg In : ${avgInMbps} Mbps | Avg Out : ${avgOutMbps} Mbps`);
  console.log(`  Max In : ${maxInMbps} Mbps | Max Out : ${maxOutMbps} Mbps`);

  const hasData =
    p95InMbps  > 0 || p95OutMbps > 0 ||
    avgInMbps  > 0 || avgOutMbps > 0 ||
    maxInMbps  > 0 || maxOutMbps > 0;

  if (!hasData) {
    console.warn(`⚠️  Pas de données pour port ${portCfg.ifName} (${portCfg.port_id})`);
    return {
      hasData:        false,
      noDataReason:   operStatus === "down"
        ? "Port inactif (DOWN)"
        : "Aucun trafic sur la période",
      operStatus,     adminStatus,
      speedMbps,      human_speed:    port.human_speed ?? "—",
      p95InMbps:      null, p95OutMbps:      0,
      avgInMbps:      null, avgOutMbps:      0,
      maxInMbps:      null, maxOutMbps:      0,
      utilizationPct: null,
      p95UtilInPct:   null, p95UtilOutPct:   0,
      inErrors,       outErrors,
      hasErrors:      inErrors > 0 || outErrors > 0,
      inDiscards,     outDiscards,
    };
  }

 /* const p95UtilInPct = speedMbps > 0
    ? Math.min(Math.round((p95InMbps  / speedMbps) * 100), 100) : 0;
  const p95UtilOutPct = speedMbps > 0
    ? Math.min(Math.round((p95OutMbps / speedMbps) * 100), 100) : 0;*/

    // Arrondi standard : >5 on arrondit au supérieur, ≤5 on tronque
function roundHalfUp(value, decimals = 2) {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

// Calcul du taux d'utilisation avec 2 décimales
const p95UtilInPct = speedMbps > 0
  ? Math.min(roundHalfUp((p95InMbps  / speedMbps) * 100), 100)
  : 0;

const p95UtilOutPct = speedMbps > 0
  ? Math.min(roundHalfUp((p95OutMbps / speedMbps) * 100), 100)
  : 0;

  return {
    hasData:        true,
    noDataReason:   null,
    operStatus,     adminStatus,
    speedMbps,      human_speed:    port.human_speed ?? "—",
    p95InMbps,      p95OutMbps,
    p95UtilInPct,   p95UtilOutPct,
    utilizationPct: Math.max(p95UtilInPct, p95UtilOutPct),
    avgInMbps,      avgOutMbps,
    maxInMbps,      maxOutMbps,
    inErrors,       outErrors,
    hasErrors:      inErrors > 0 || outErrors > 0,
    inDiscards,     outDiscards,
  };
}

// ─── Agrégation principale ────────────────────────────────────────────────────

export const buildReportData = async ({ dateFrom, dateTo }) => {
  const results   = [];
  const deviceIds = devicesConfig.map((d) => d.device_id);

  // ✅ Charge les hostnames en premier — un seul appel par device
  await loadDeviceHostnames(deviceIds);

  // ✅ Récupère tous les ports en une seule requête
  const portsByDevice = await getAllPortsForDevices(deviceIds);

  for (const deviceCfg of devicesConfig) {
    let deviceStatus = {};
    let alerts       = [];

    try {
      [deviceStatus, alerts] = await Promise.all([
        getDeviceStatus(deviceCfg.device_id),
        getDeviceAlerts(deviceCfg.device_id, dateFrom, dateTo),
      ]);
    } catch (err) {
      console.error(`❌ Erreur device ${deviceCfg.hostname}:`, err.message);
    }

    if (!Array.isArray(alerts)) alerts = [];
    const availability = computeAvailability(alerts, dateFrom, dateTo);

    const portsFromApi = portsByDevice[deviceCfg.device_id] ?? [];

    const ports = await Promise.all(
      deviceCfg.ports.map(async (portCfg) => {
        const portFromApi = portsFromApi.find(
          (p) => String(p.port_id) === String(portCfg.port_id)
        );

        try {
          // ✅ Passe le device_id pour récupérer le bon hostname
          const historyData = await getPortHistory(
            portCfg.port_id,
            deviceCfg.device_id,  // ← nouveau paramètre
            dateFrom,
            dateTo
          );

          const stats = extractPortStats(historyData, portCfg);

          return {
            port_id:     portCfg.port_id,
            ifName:      portCfg.ifName,
            alias:       portCfg.alias ?? portFromApi?.ifAlias ?? "—",
            human_speed: portFromApi?.human_speed ?? "—",
            ifSpeed:     portFromApi?.ifSpeed     ?? 0,
            ...stats,
          };

        } catch (err) {
          console.error(`❌ Erreur port ${portCfg.ifName}:`, err.message);
          return {
            port_id:        portCfg.port_id,
            ifName:         portCfg.ifName,
            // alias:          portCfg.alias ?? "—",
            human_speed:    portFromApi?.human_speed ?? "—",
            hasData:        false,
            operStatus:     portFromApi?.ifOperStatus  ?? "unknown",
            adminStatus:    portFromApi?.ifAdminStatus ?? "unknown",
            speedMbps:      (portFromApi?.ifSpeed ?? 0) / 1_000_000,
            p95InMbps:      null, p95OutMbps:      0,
            avgInMbps:      null, avgOutMbps:      0,
            maxInMbps:      null, maxOutMbps:      0,
            utilizationPct: null,
            inErrors:       parseInt(portFromApi?.ifInErrors  ?? 0),
            outErrors:      parseInt(portFromApi?.ifOutErrors ?? 0),
            hasErrors:      false,
            inDiscards:     parseInt(portFromApi?.ifInDiscards  ?? 0),
            outDiscards:    parseInt(portFromApi?.ifOutDiscards ?? 0),
          };
        }
      })
    );

    results.push({
      device_id:    deviceCfg.device_id,
      hostname:     deviceCfg.hostname,
      status:       deviceStatus.status  ?? "unknown",
      uptimeHours:  Math.round((deviceStatus.uptime ?? 0) / 3600),
      availability,
      alertCount:   alerts.length,
      ports,
    });
  }

  // ─── Summary ───────────────────────────────────────────────────────────────
  const allPorts        = results.flatMap((d) => d.ports);
  const portsDown       = allPorts.filter((p) => p.operStatus === "down");
  const portsWithErrors = allPorts.filter((p) => p.hasErrors);
  const devicesDown     = results.filter((d) => d.status === "down");
  const avgAvailability = results.length
    ? Math.round(
        (results.reduce((s, d) => s + d.availability, 0) / results.length) * 100
      ) / 100
    : 0;

  return {
    period:      { from: dateFrom, to: dateTo },
    generatedAt: new Date().toISOString(),
    summary: {
      totalDevices:     results.length,
      devicesUp:        results.length - devicesDown.length,
      devicesDown:      devicesDown.length,
      avgAvailability,
      totalPorts:       allPorts.length,
      portsUp:          allPorts.length - portsDown.length,
      portsDown:        portsDown.length,
      portsWithErrors:  portsWithErrors.length,
      totalErrors:      allPorts.reduce((s, p) => s + p.inErrors + p.outErrors, 0),
    },
    devices: results,
  };
};