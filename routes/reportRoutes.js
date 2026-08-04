import { Router } from "express";
import { buildReportData,generateExcel} from "../services/reportService.js";
import { getDeviceStatus } from "../services/observiumService.js";
const router = Router();


router.get("/", async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    if (!dateFrom || !dateTo)
      return res.status(400).json({ error: "dateFrom et dateTo sont requis" });
    //console.log("RAPPORT REQUÊTE:", { dateFrom, dateTo });
    const data = await buildReportData({ dateFrom, dateTo });
    res.json(data);
  } catch (err) {
    console.log("Erreur rapport:", err.message);
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

router.get("/metrics/", async (req, res) => {
  try {
    const metrics = await getDeviceStatus();
    res.json(metrics);
  } catch (err) {
    console.error("Erreur récupération métriques:", err.message);
    res.status(500).json({ error: "Erreur récupération métriques" });
  }
});




export default router;