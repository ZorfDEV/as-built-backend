// scripts/migrateUserStatus.js
import mongoose from "mongoose"
import User from "../models/User.js"

await mongoose.connect("mongodb://localhost:27017/fiberdb", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

const result = await User.updateMany(
  { status: { $exists: false } },  // ✅ uniquement les docs sans le champ
  { $set: { status: "actived" } }
)

console.log(`${result.modifiedCount} utilisateurs migrés.`)
await mongoose.disconnect()