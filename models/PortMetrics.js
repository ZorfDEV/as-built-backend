import mongoose from "mongoose";

const portMetricSchema = new mongoose.Schema({
  deviceId: String,
  hostname: String,

  portId: String,
  portName: String,

  status: {
  type: String,
  default: "unknown"
  },

  bandwidthIn: Number,
  bandwidthOut: Number,

  errorsIn: Number,
  errorsOut: Number,

  availability: Number,

  timestamp: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model(
  "PortMetric",
  portMetricSchema
);