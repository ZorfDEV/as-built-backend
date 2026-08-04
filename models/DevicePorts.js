import mongoose from "mongoose";

const { Schema } = mongoose;

const PortSchema = new Schema(
  {
    port_id:  { type: String, required: true },
    ifName:   { type: String, required: true },
    // Ajoute ici les autres champs Observium que tu gardes
    // (ifAlias, ifOperStatus, ifSpeed, ifAdminStatus, etc.)
  },
  { _id: false, strict: false } // strict: false => garde les champs Observium non déclarés
);

const DevicePortsSchema = new Schema(
  {
    device_id: { type: String, required: true, unique: true, index: true },
    hostname:  { type: String, required: true },
    ports:     { type: [PortSchema], default: [] },
    fetchedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("DevicePorts", DevicePortsSchema);
