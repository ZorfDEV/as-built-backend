module.exports = {
  port: 8081,
  JWT_SECRET: process.env.JWT_SECRET || "Wq9Ss6#z3%",
  JWT_TOKEN: process.env.JWT_TOKEN || 60 * 60,
  JWT_REFRESH: process.env.JWT_REFRESH || 60 * 60 * 24 * 7,
  archive_path: process.env.ARCHIVE_PATH || "public/archive",
  logo_path: process.env.LOGO_PATH || "public/logo",
  report_path: process.env.REPORT_PATH || "public/reports",
  API_OBSERVIUM: process.env.API_OBSERVIUM || "http://10.188.12.117/api/v0/",
  API_OBSERVIUM_GRAPH:
  process.env.API_OBSERVIUM_GRAPH || "http://10.188.12.117/graph.php",
  API_OBSERVIUM_USERNAME: process.env.API_OBSERVIUM_USERNAME || "LBV",
  API_OBSERVIUM_PASSWORD: process.env.API_OBSERVIUM_PASSWORD || "LBV",
  EQUIPMENT_USER: process.env.EQUIPMENT_USER || "",
  EQUIPMENT_PASSWORD: process.env.EQUIPMENT_PASSWORD || "",
  OBSERVIUM_REBOND: process.env.OBSERVIUM_REBOND || "",
  OBSERVIUM_USER: process.env.OBSERVIUM_USER || "",
  OBSERVIUM_PASSWORD: process.env.OBSERVIUM_PASSWORD || "",
};