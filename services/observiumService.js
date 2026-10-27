import axios from "axios";
import dotenv from 'dotenv';
dotenv.config();
import { devicesConfig,devicesIdConfig } from "./../config/devices.js";

// Auth Basic : Observium n'accepte plus username/password en query string.
// ⚠️ OBSERVIUM_USER / OBSERVIUM_PASSWORD (.env = "operation") renvoient 401 → on utilise API_OBSERVIUM_*.
const observiumAuth = {
  username: process.env.API_OBSERVIUM_USERNAME,
  password: process.env.API_OBSERVIUM_PASSWORD,
};

if (!observiumAuth.username || !observiumAuth.password) {
  console.warn("⚠️  API_OBSERVIUM_USERNAME / API_OBSERVIUM_PASSWORD manquants dans .env");
}

const observiumApi = axios.create({
  baseURL: process.env.API_OBSERVIUM || "http://10.1.28.35/api/v0/",
  auth: observiumAuth,
  timeout: 30000,
});

const observiumApiGraph = axios.create({
  baseURL: process.env.API_OBSERVIUM_GRAPH || "http://10.1.28.35/graph.php",
  auth: observiumAuth,
  timeout: 30000,
});

function toUnixTimestampEndOfDay(dateStr) {
  //return Math.floor(new Date(dateStr).getTime() / 1000) + 86399;
   const date = new Date(`${dateStr}T23:59:59Z`);
  const ts   = Math.floor(date.getTime() / 1000);
 // console.log(`toUnixTimestampEndOfDay("${dateStr}") → ${ts} → ${date.toISOString()}`);
  return ts;
}

function toUnixTimestamp(dateStr) {
 const date = new Date(`${dateStr}T00:00:00Z`);
  const ts   = Math.floor(date.getTime() / 1000);
 // console.log(`toUnixTimestamp("${dateStr}") → ${ts} → ${date.toISOString()}`);
  return ts;
}

export { observiumApi, observiumApiGraph, toUnixTimestamp, toUnixTimestampEndOfDay };

//Statut temps réel d'un device
export const getDeviceStatus = async () => {
  const deviceIds = devicesIdConfig
      .filter((d) => d.device_id)
      .map((d) => d.device_id);
  try {
    // L'API accepte une liste séparée par des virgules : device_id=19,95,...
    const { data } = await observiumApi.get("/devices/", {
      params: { device_id: deviceIds.join(",") },
    });
    return data?.devices ?? {};
  } catch (error) {
    console.error("Erreur getDeviceStatus:", error.response?.status, error.response?.data ?? error.message);
    return {};
  }
};

// ─── getPortHistory  ─────────────────────────────────────

export async function getPortHistory(portId, deviceId, dateFrom, dateTo) {
  try {
    const from     = toUnixTimestamp(dateFrom);
    const to       = toUnixTimestampEndOfDay(dateTo);
    //const hostname = getDeviceHostname(deviceId);
    const hostname = devicesConfig.find((d) => d.device_id === String(deviceId))?.hostname;
    const { data } = await observiumApi.get(
      `/ports/${portId}/detail/from=${from}/to=${to}`,
      hostname ? { params: { hostname } } : {}
    );
    return data ?? {};

  } catch (err) {
    console.error(`Erreur getPortHistory ${portId}:`, err.response?.status, err.message);
    return {};
  }
}

// ─── getAlertLogEntries ─────────────────────────────────────
// dateFrom / dateTo au format "YYYY-MM-DD" (l'API ne filtre pas avec des timestamps Unix)
export async function getAlertLogEntries(deviceId, entityId, dateFrom, dateTo) {
  const pagesize   = 1000;
  const allEntries = [];
  let pageno = 1;

  while (true) {
    const { data } = await observiumApi.get("/alert_log/", {
      params: {
        device_id:      deviceId,
        entity_type:    "port",
        entity_id:      entityId,
        timestamp_from: dateFrom,
        timestamp_to:   dateTo,
        pagesize,
        pageno,
      },
    });

    if (data?.status !== "ok") {
      throw new Error(`alert_log API error: ${data?.message || "unknown error"}`);
    }

    const entries = Object.values(data.entries ?? {});
    allEntries.push(...entries);

    if (entries.length < pagesize) break;
    pageno++;
  }

  return allEntries;
}

// Utilisé par metricsCollector.js
// pagesize=5000 → erreur 500 côté Observium, on pagine par 1000
export const getPorts = async () => {
  const pagesize = 1000;
  const allPorts = [];
  let pageno = 1;

  while (true) {
    const { data } = await observiumApi.get("/ports/", {
      params: { pagesize, pageno },
    });
    const ports = Object.values(data?.ports ?? {});
    allPorts.push(...ports);

    if (ports.length < pagesize) break;
    pageno++;
  }

  return allPorts;
};

/* Données historiques bande passante d'un port sur une période
export const getPortGraphData = async (portId, dateFrom, dateTo) => {
   const idport = parseInt(portId, 10);
   const { data } = await observiumApiGraph.get(`?type=port_bits&id=${idport}&from=${toUnixTimestampEndOfDay(dateFrom)}&to=${toUnixTimestampEndOfDay(dateTo)}&height=300&width=800`);
    console.log(`Fetched graph data for port ${portId}:`, data ? "Data received" : "No data");
  return data ?? {};
};*/

/* Historique des alertes d'un device sur une période toUnixTimestampEndOfDay(dateTo),
export const getDeviceAlerts = async (deviceId, dateFrom, dateTo) => {
  const device_id = parseInt(deviceId, 10);
  const { data } = await observiumApi.get(`/alert_log/?device_id=${device_id}&`, {
    params: {
      timestamp_from: toUnixTimestamp(dateFrom), 
      timestamp_to: toUnixTimestampEndOfDay(dateTo),     
       pagesize: 10,
    },
  });
 //console.log(`Fetched alerts for device ${deviceId}:`, data ?? {});
  //console.log("RAW alerts response:", JSON.stringify(data, null, 2)); // ← ajoute ça
  return Object.values(data.alert_log ?? {});
  //return data.alert_log ?? {};
};*/

// Dans getPortGraphData et getDeviceAlerts /opt/observium/rrd/mpe-lbv10-01/port-69500928.rrd :

/*export const  getDevices = async () => {
   const { data } = await observiumApi.get("/devices/");
  return data.devices ?? {}
};

export const getPorts = async () => {
  const { data } = await observiumApi.get("/ports/", {
    params: { pagesize: 5000 },
  });
  //console.log(`Fetched ports: ${data.ports ? Object.keys(data.ports).length : 0} ports received`);
  return data.ports ?? {};
};

export const getAlerts = async (startDate, endDate) => {
  const { data } = await observiumApi.get("/alert_log/", {
    params: { date_from: startDate, date_to: endDate, pagesize: 1000 },
  });
  return data.alert_log ?? {};
};*/


/*export const getPortsByDevices = async () => {

   const deviceIds = devicesConfig
      .filter((d) => d.device_id)
      .map((d) => d.device_id);
  try {
    // Endpoint direct device → ports
    const { data } = await observiumApi.get(`/devices/${deviceId}/ports/`);

    const ports = Object.values(data?.ports ?? {});
    console.log(`Device ${deviceId}: ${ports.length} ports`);
    return { deviceId, ports };

  } catch (error) {
   // console.error(`Erreur device ${deviceId}:`, error.response?.status, error.response?.data);
    return { deviceId, ports: [] }; // ne bloque pas les autres devices
  }
};*/


