import axios from "axios";
import dotenv from 'dotenv';
dotenv.config();
//import { devicesConfig } from "./../config/devices.js";

const observiumApi = axios.create({
  baseURL: "http://obs.infra.gab/api/v0", // process.env.OBSERVIUM_URL ||,
  authorization: `BearerWq9Ss6#z3%`, // process.env.OBSERVIUM_TOKEN || "Wq9Ss6#z3%",
  auth: {
    username: "LBV", // process.env.OBSERVIUM_USER || "LBV"
    password: "LBV", // process.env.OBSERVIUM_PASS || "LBV"
  },
  timeout: 10000,
});

const observiumApiGraph = axios.create({
  baseURL: "http://obs.infra.gab/graph.php", // process.env.OBSERVIUM_URL ||,
  authorization: `BearerWq9Ss6#z3%`, // process.env.OBSERVIUM_TOKEN || "Wq9Ss6#z3%",
  auth: {
    username: "LBV", // process.env.OBSERVIUM_USER || "LBV"
    password: "LBV", // process.env.OBSERVIUM_PASS || "LBV"
  },
  timeout: 10000,
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

// Dans getPortGraphData et getDeviceAlerts /opt/observium/rrd/mpe-lbv10-01/port-69500928.rrd :

export const  getDevices = async () => {
   const { data } = await observiumApi.get("/devices/");
  return data.devices ?? {}
};

export const getPorts = async () => {
  const { data } = await observiumApi.get("/ports/", {
    params: { pagesize: 1000 },
  });
  console.log(`Fetched ports: ${data.ports ? Object.keys(data.ports).length : 0} ports received`);
  return data.ports ?? {};
};

export const getAlerts = async (startDate, endDate) => {
  const { data } = await observiumApi.get("/alert_log/", {
    params: { date_from: startDate, date_to: endDate, pagesize: 1000 },
  });
  return data.alert_log ?? {};
};


export const getPortsByDevices = async (deviceId) => {
  try {
    // ✅ Endpoint direct device → ports
    const { data } = await observiumApi.get(`/devices/${deviceId}/ports/`);

    const ports = Object.values(data?.ports ?? {});
    console.log(`Device ${deviceId}: ${ports.length} ports`);
    return { deviceId, ports };

  } catch (error) {
   // console.error(`Erreur device ${deviceId}:`, error.response?.status, error.response?.data);
    return { deviceId, ports: [] }; // ✅ ne bloque pas les autres devices
  }
};

//Statut temps réel d'un device
export const getDeviceStatus = async (deviceId) => {
  const { data } = await observiumApi.get(`/devices/${deviceId}/`);
 // console.log(`Fetched device ${deviceId}:`, data ?? "N/A");
  return data.device ?? {};
};

// Statut périodique d'un port
export const getPortStatus = async (portId,dateFrom, dateTo) => {
  const idport = parseInt(portId, 10);
   const from =toUnixTimestamp(dateFrom);
   const to   = toUnixTimestampEndOfDay(dateTo);
   console.log(`Fetching port ${portId} history from ${dateFrom} (${from}) to ${dateTo} (${to})`);
 const { data } = await observiumApi.get(`/ports/${idport}/detail/from=${from}/to=${to}`);
  // console.log(`Fetched port ${portId}:`, data.legend?.legend.raw ?? "N/A");
  //console.log(`Port ${portId} history raw:`, JSON.stringify(data, null, 2));
   return  data.port ?? {};
};

// Données historiques bande passante d'un port sur une période
export const getPortGraphData = async (portId, dateFrom, dateTo) => {
   const idport = parseInt(portId, 10);
   const { data } = await observiumApiGraph.get(`?type=port_bits&id=${idport}&from=${toUnixTimestampEndOfDay(dateFrom)}&to=${toUnixTimestampEndOfDay(dateTo)}&height=300&width=800`);
    console.log(`Fetched graph data for port ${portId}:`, data ? "Data received" : "No data");
  return data ?? {};
};
// Historique des alertes d'un device sur une période toUnixTimestampEndOfDay(dateTo),
export const getDeviceAlerts = async (deviceId, dateFrom, dateTo) => {
  const device_id = parseInt(deviceId, 10);
  const { data } = await observiumApi.get(`/alert_log/?device_id=${device_id}&`, {
    params: {
      timestamp_from: toUnixTimestamp(dateFrom), 
      timestamp_to: toUnixTimestampEndOfDay(dateTo),     
       pagesize: 10,
    },
  });
 // console.log(`Fetched alerts for device ${deviceId}:`, data.status ?? {});
  //console.log("RAW alerts response:", JSON.stringify(data, null, 2)); // ← ajoute ça
  return Object.values(data.alert_log ?? {});
  //return data.alert_log ?? {};
};


export const getAllPortsForDevices = async (deviceIds) => {
  try {
    const { data } = await observiumApi.get(`/ports/?pagesize=5000`);
    const allPorts = Object.values(data?.ports ?? {});

    console.log(`Total ports récupérés : ${allPorts.length}`);

    // Groupe les ports par device_id
    const portsByDevice = deviceIds.reduce((acc, deviceId) => {
      acc[deviceId] = allPorts.filter(
        (p) => String(p.device_id) === String(deviceId)
      );
      console.log(`Device ${deviceId}: ${acc[deviceId].length} ports`);
      return acc;
    }, {});

    return portsByDevice;

  } catch (error) {
    console.error("Erreur getAllPorts:", error.response?.status, error.response?.data);
    throw error;
  }
};

// ─── Cache des hostnames ──────────────────────────────────────────────────────

const deviceHostnameCache = new Map();

export async function loadDeviceHostnames(deviceIds) {
  for (const deviceId of deviceIds) {
    try {
      const { data } = await observiumApi.get(`/devices/${deviceId}/`);
      const hostname  = data?.device?.hostname;
      if (hostname) {
        deviceHostnameCache.set(String(deviceId), hostname);
        console.log(`✅ Device ${deviceId} → ${hostname}`);
      }
    } catch (err) {
      console.error(`Erreur hostname device ${deviceId}:`, err.message);
    }
  }
  console.log("Cache hostnames:", Object.fromEntries(deviceHostnameCache));
}

export function getDeviceHostname(deviceId) {
  return deviceHostnameCache.get(String(deviceId)) ?? null;
}

// ─── getPortHistory avec hostname corrigé ─────────────────────────────────────

export async function getPortHistory(portId, deviceId, dateFrom, dateTo) {
  try {
    const from     = toUnixTimestamp(dateFrom);
    const to       = toUnixTimestampEndOfDay(dateTo);
    const hostname = getDeviceHostname(deviceId);

    // ✅ Log la requête complète
    console.log("Requête envoyée :", {
      url:    `/ports/${portId}/detail/from=${from}/to=${to}`,
      params: hostname ? { hostname } : "aucun",
    });

    const { data } = await observiumApi.get(
      `/ports/${portId}/detail/from=${from}/to=${to}`,
      hostname ? { params: { hostname } } : {}
    );

    // ✅ Log la réponse complète de legend
     console.log("===========Detail=============");
    console.log("port ID:", portId, "device ID:", deviceId);
    console.log("legend complet :", JSON.stringify(data?.legend, null, 2));
    console.log("========================");
    
    return data ?? {};

  } catch (err) {
    console.error(`Erreur getPortHistory ${portId}:`, err.message);
    return {};
  }
}