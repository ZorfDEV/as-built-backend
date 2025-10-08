import mongoose from "mongoose";
import dotenv from "dotenv";
import Point from "./../models/Point.js";

dotenv.config();

const runMigration = async () => {
  try {
    await mongoose.connect("mongodb://localhost:27017/fiberdb", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ MongoDB connecté");

    // Trouver les points sans champ location
    const points = await Point.find({ location: { $exists: false } });

    console.log(`📌 ${points.length} points à mettre à jour...`);

    for (const p of points) {
      const latNum = parseFloat(p.latitude);
      const lonNum = parseFloat(p.longitude);

      if (!isNaN(latNum) && !isNaN(lonNum)) {
        p.location = {
          type: "Point", // ✅ doit être "Point"
          coordinates: [lonNum, latNum], // ⚠️ ordre GeoJSON [longitude, latitude]
        };
        await p.save();
        console.log(`✅ Point ${p.name} mis à jour avec location`);
      } else {
        console.warn(`⚠️ Coordonnées invalides pour ${p.name}, saut de la mise à jour`);
      }
    }

    console.log("🎉 Migration terminée !");
    process.exit(0);
  } catch (err) {
    console.error("❌ Erreur migration :", err);
    process.exit(1);
  }
};

runMigration();
