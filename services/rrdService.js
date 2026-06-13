import { execFile } from "child_process";
import path from "path";

const RRD_BASE_PATH = process.env.OBSERVIUM_RRD_PATH ?? "/opt/observium/rrd";

// ─── Utilitaires timestamps ───────────────────────────────────────────────────

const toUnixTimestamp = (dateStr) =>
  Math.floor(new Date(dateStr).getTime() / 1000);

const toUnixTimestampEndOfDay = (dateStr) =>
  toUnixTimestamp(dateStr) + 86399;

// ─── Exécution rrdtool ────────────────────────────────────────────────────────

function rrdFetch(rrdFilePath, dateFrom, dateTo) {
  return new Promise((resolve, reject) => {
    execFile(
      "rrdtool",
      [
        "fetch", rrdFilePath,
        "AVERAGE",
        "--start", String(toUnixTimestamp(dateFrom)),
        "--end",   String(toUnixTimestampEndOfDay(dateTo)),
      ],
      { maxBuffer: 10 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          console.error(`rrdtool error for ${rrdFilePath}:`, stderr);
          return reject(err);
        }
        resolve(stdout);
      }
    );
  });
}

// ─── Parsing sortie rrdtool ───────────────────────────────────────────────────

function parseRrdOutput(stdout) {
  const lines = stdout.trim().split("\n");
  const inValues  = [];
  const outValues = [];

  // Ignore la première ligne (en-tête des colonnes)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Format : "1735689600: 1.2345e+06 8.7654e+05"
    const parts = line.split(/:\s+/);
    if (parts.length < 2) continue;

    const values = parts[1].trim().split(/\s+/);
    const inVal  = parseFloat(values[0]);
    const outVal = parseFloat(values[1]);

    if (!isNaN(inVal))  inValues.push(inVal);
    if (!isNaN(outVal)) outValues.push(outVal);
  }

  return { inValues, outValues };
}

// ─── Calcul statistiques ──────────────────────────────────────────────────────

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

const toMbps = (bitsPerSec) =>
  Math.round((bitsPerSec / 1_000_000) * 100) / 100;

function defaultPortStats() {
  return {
    p95InMbps:  0, p95OutMbps:  0,
    avgInMbps:  0, avgOutMbps:  0,
    maxInMbps:  0, maxOutMbps:  0,
    samples: 0,
  };
}

// ─── Fonction principale ──────────────────────────────────────────────────────

export async function getPortP95(hostname, ifIndex, dateFrom, dateTo) {
  const rrdFile = path.join(
    RRD_BASE_PATH,
    hostname,
    `port-${ifIndex}.rrd`
  );

  console.log("Chemin RRD tenté :", rrdFile);
  try {
    const stdout = await rrdFetch(rrdFile, dateFrom, dateTo);
    const { inValues, outValues } = parseRrdOutput(stdout);

    if (!inValues.length && !outValues.length) {
      console.warn(`Aucune donnée RRD pour ${hostname} port ${ifIndex}`);
      return defaultPortStats();
    }

    // Valeurs RRD en octets/s → bits/s (×8)
    const inBits  = inValues.map((v)  => v * 8);
    const outBits = outValues.map((v) => v * 8);

    const p95In  = percentile(inBits,  95);
    const p95Out = percentile(outBits, 95);
    const avgIn  = inBits.reduce((a, b)  => a + b, 0) / inBits.length;
    const avgOut = outBits.reduce((a, b) => a + b, 0) / outBits.length;
    const maxIn  = Math.max(...inBits);
    const maxOut = Math.max(...outBits);

    return {
      p95InMbps:  toMbps(p95In),
      p95OutMbps: toMbps(p95Out),
      avgInMbps:  toMbps(avgIn),
      avgOutMbps: toMbps(avgOut),
      maxInMbps:  toMbps(maxIn),
      maxOutMbps: toMbps(maxOut),
      samples:    inValues.length,
    };
  } catch (err) {
    console.error(`Erreur RRD ${hostname}/${ifIndex}:`, err.message);
    return defaultPortStats();
  }
}