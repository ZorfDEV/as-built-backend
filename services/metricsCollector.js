import cron from "node-cron";
import PortMetric from "./../models/PortMetrics.js";
import { fetchPorts } from "./observiumService.js";

export const startCollector = () => {

  cron.schedule("*/5 * * * *", async () => {

    console.log("Collecting metrics");

    const ports = await fetchPorts();

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