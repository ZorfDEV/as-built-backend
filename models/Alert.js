import mongoose from "mongoose";

const alertSchema = new mongoose.Schema({
  device: String,
  message: String,
  severity: String,
  timestamp: { type: Date, default: Date.now }
});

export default mongoose.model("Alert", alertSchema);