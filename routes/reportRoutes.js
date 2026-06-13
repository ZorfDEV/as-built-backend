import { Router } from "express";
import { buildReportData} from "../services/reportService.js";
import axios from "axios";
const router = Router();

const observiumApi = axios.create({
  baseURL: "http://obs.infra.gab/api/v0", // process.env.OBSERVIUM_URL ||,
  authorization: `BearerWq9Ss6#z3%`, // process.env.OBSERVIUM_TOKEN || "Wq9Ss6#z3%",
  auth: {
    username: "LBV", // process.env.OBSERVIUM_USER || "LBV"
    password: "LBV", // process.env.OBSERVIUM_PASS || "LBV"
  },
  timeout: 10000,
});

router.get("/", async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    if (!dateFrom || !dateTo)
      return res.status(400).json({ error: "dateFrom et dateTo sont requis" });

    // console.log("RAPPORT REQUÊTE:", { dateFrom, dateTo });
    const data = await buildReportData({ dateFrom, dateTo });
    res.json(data);
  } catch (err) {
    console.error("Erreur rapport:", err.message);
    res.status(500).json({ error: "Erreur lors de la génération du rapport" });
  }
});

router.get("/export/excel", async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    if (!dateFrom || !dateTo)
      return res.status(400).json({ error: "dateFrom et dateTo sont requis" });

    const data   = await buildReportData({ dateFrom, dateTo });
    const buffer = await generateExcel(data);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=rapport_${dateFrom}_${dateTo}.xlsx`);
    res.send(buffer);
  } catch (err) {
    console.error("Erreur export Excel:", err.message);
    res.status(500).json({ error: "Erreur export Excel" });
  }
});

router.get("/export/pdf", async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    if (!dateFrom || !dateTo)
      return res.status(400).json({ error: "dateFrom et dateTo sont requis" });

    const data   = await buildReportData({ dateFrom, dateTo });
    const buffer = await generatePDF(data);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=rapport_${dateFrom}_${dateTo}.pdf`);
    res.send(buffer);
  } catch (err) {
    console.error("Erreur export PDF:", err.message);
    res.status(500).json({ error: "Erreur export PDF" });
  }
});

// Route de test — à supprimer après vérification
router.get("/test-port/:portId", async (req, res) => {
  try {
    const { portId } = req.params;
    const { dateFrom, dateTo } = req.query;

    const data = await getPortHistory(portId, dateFrom, dateTo);
    res.json(data);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route de diagnostic — à supprimer après
router.get("/debug/:portId", async (req, res) => {
  try {
    const { portId } = req.params;

    // 1. Infos du port
    const portInfo = await observiumApi.get(`/ports/${portId}/`);
    const port     = portInfo.data?.port ?? {};

    // 2. Infos du device
    const deviceInfo = await observiumApi.get(`/devices/${port.device_id}/`);
    const device     = deviceInfo.data?.device ?? {};

    res.json({
      port: {
        port_id:   port.port_id,
        ifName:    port.ifName,
        ifIndex:   port.ifIndex,
        device_id: port.device_id,
        hostname:  port.hostname,
        // Tous les champs qui contiennent "host" ou "name"
        allFields: Object.fromEntries(
          Object.entries(port).filter(([k]) =>
            k.toLowerCase().includes("host") ||
            k.toLowerCase().includes("name") ||
            k.toLowerCase().includes("sys")  ||
            k.toLowerCase().includes("device")
          )
        ),
      },
      device: {
        device_id: device.device_id,
        hostname:  device.hostname,
        sysName:   device.sysName,
        // Tous les champs du device
        allFields: Object.fromEntries(
          Object.entries(device).filter(([k]) =>
            k.toLowerCase().includes("host") ||
            k.toLowerCase().includes("name") ||
            k.toLowerCase().includes("sys")
          )
        ),
      },
    });

  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

export default router;