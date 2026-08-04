import cron from "node-cron";
import PortMetric from "./../models/PortMetrics.js";
import { getPorts } from "./observiumService.js";

export const startCollector = () => {

  cron.schedule("*/5 * * * *", async () => {

    console.log("Collecting metrics");

    const ports = await getPorts();

    const metrics = ports.map(port => ({
      deviceId: port.device_id,
      hostname: port.hostname,

      portId: port.port_id,
      portName: port.ifDescr,

      status: port.ifOperStatus,

      bandwidthIn: port.ifInOctets_rate,
      bandwidthOut: port.ifOutOctets_rate,

      errorsIn: port.ifInErrors,
      errorsOut: port.ifOutErrors,

      availability:
        port.ifOperStatus === "up"
          ? 100
          : 0,

      timestamp: new Date()
    }));

    await PortMetric.insertMany(metrics);

  });
};

// récupération des métriques dans la base de données pour tous les ports d'un device.
export async function getDeviceMetrics() {
  const metrics = await PortMetric.find()
    .limit(4000)
    .sort({ timestamp: -1 })
    .lean();

  const groupedMetrics = metrics.reduce((acc, metric) => {
    const deviceId = metric.deviceId;
    if (!acc[deviceId]) {
      acc[deviceId] = {
        deviceId,
        hostname:  metric.hostname,
        metrics:   [],
      };
    }
    acc[deviceId].metrics.push(metric);
    return acc;
  }, {});

  // ✅ Retourne un tableau au lieu d'un objet
  return Object.values(groupedMetrics);
}