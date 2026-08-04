import express from "express";
import DevicePorts from "./../models/DevicePorts.js";
// import { fetchPortsFromObservium } from "../services/observium.js"; // ta fonction existante

const router = express.Router();

// Groupe un tableau brut de ports Observium par device_id
function groupPortsByDevice(rawPorts) {
  const map = new Map();

  for (const port of rawPorts) {
    const id = port.device_id;
    if (!map.has(id)) {
      map.set(id, {
        device_id: id,
        hostname: port.hostname,
        ports: [],
      });
    }
    // On retire device_id/hostname du sous-document port (déjà au niveau device)
    const { device_id, hostname, ...portFields } = port;
    map.get(id).ports.push(portFields);
  }

  return Array.from(map.values());
}

/**
 * POST /api/report/ports/save
 * Body: tableau brut de ports Observium (ou récupéré via fetchPortsFromObservium)
 * Groupe par device_id et upsert chaque device en base.
 */
router.post("/ports/save", async (req, res) => {
  try {
    const rawPorts = req.body; // ou: const rawPorts = await fetchPortsFromObservium();

    if (!Array.isArray(rawPorts)) {
      return res.status(400).json({ error: "Le body doit être un tableau de ports." });
    }

    const grouped = groupPortsByDevice(rawPorts);

    // Upsert : un document par device, mis à jour s'il existe déjà
    const operations = grouped.map((device) => ({
      updateOne: {
        filter: { device_id: device.device_id },
        update: {
          $set: {
            hostname: device.hostname,
            ports: device.ports,
            fetchedAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

    const result = await DevicePorts.bulkWrite(operations);

    res.json({
      message: "Ports sauvegardés avec succès.",
      devicesCount: grouped.length,
      portsCount: rawPorts.length,
      bulkWriteResult: {
        upserted: result.upsertedCount,
        modified: result.modifiedCount,
      },
    });
  } catch (error) {
    console.error("Erreur sauvegarde ports:", error);
    res.status(500).json({ error: "Erreur lors de la sauvegarde des ports." });
  }
});

/**
 * GET /api/report/ports
 * Récupère tous les devices avec leurs ports depuis Mongo.
 */
router.get("/ports", async (req, res) => {
  try {
    const devices = await DevicePorts.find().sort({ hostname: 1 });
    res.json(devices);
  } catch (error) {
    console.error("Erreur lecture ports:", error);
    res.status(500).json({ error: "Erreur lors de la lecture des ports." });
  }
});

/**
 * GET /api/report/ports/:deviceId
 * Récupère un device précis avec ses ports.
 */
router.get("/ports/:deviceId", async (req, res) => {
  try {
    const device = await DevicePorts.findOne({ device_id: req.params.deviceId });
    if (!device) {
      return res.status(404).json({ error: "Device introuvable." });
    }
    res.json(device);
  } catch (error) {
    console.error("Erreur lecture device:", error);
    res.status(500).json({ error: "Erreur lors de la lecture du device." });
  }
});

export default router;
