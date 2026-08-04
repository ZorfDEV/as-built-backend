import XLSX from 'xlsx';
import {getPortHistory,} from "./observiumService.js";
import { devicesConfig, manualLinksConfig } from "./../config/devices.js";
import { resolveManualLinks } from "./neighbourService.js";


async function fetchAllAlertLogEntries(deviceId, entityId, tsFrom, tsTo) {
  const baseUrl = "http://10.1.28.35/api/v0/alert_log/";
  const pagesize = 1000;
  const allEntries = [];
  let pageno = 1;

  while (true) {
    const params = new URLSearchParams({
      device_id: deviceId,
      entity_type: "port",
      entity_id: entityId,
      timestamp_from: tsFrom,
      timestamp_to: tsTo,
      pagesize: pagesize,
      pageno: pageno,
      username: "LBV",
      password: "LBV",
    });

    const url = `${baseUrl}?${params.toString()}`;
    //console.log("Url send", url);

    let res;
    try {
      res = await fetch(url);
    } catch (networkErr) {
      throw new Error(`alert_log network error (page ${pageno}): ${networkErr.message}`);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `alert_log request failed: ${res.status} ${res.statusText} (page ${pageno}) — ${body.slice(0, 300)}`
      );
    }

    const data = await res.json();
    if (data.status !== "ok") {
      throw new Error(`alert_log API error: ${data.message || "unknown error"}`);
    }

    const entries = data?.entries;
    allEntries.push(...entries);
    console.log(`Fetched ${allEntries.length} entries (page ${pageno})`);

    if (entries.length < pagesize) break;
    pageno++;
  }



  return allEntries;
}

function parseObserviumTimestamp(ts) {
  return new Date(ts.replace(" ", "T") + "Z").getTime();
}
async function computeAvailabilityFromPort(deviceId, portId, dateFrom, dateTo) {
  const start = new Date(dateFrom).getTime();
  const endDate = new Date(dateTo);
  endDate.setHours(23, 59, 59, 999);
  const end = endDate.getTime();
  const totalMs = end - start;

  if (totalMs <= 0) return { availability: 100, method: "période-invalide" };

  const tsFrom = Math.floor(start / 1000);
  const tsTo = Math.floor(end / 1000);

  //console.log(`Fetching alert_log for device ${deviceId}, port ${portId} from ${dateFrom} to ${dateTo}`);
  const entries = await fetchAllAlertLogEntries(deviceId, portId, dateFrom, dateTo);
// console.log("les entrée", entries)
  // Filtrer seulement FAIL/OK, trier chronologiquement
  const events = entries
    .filter(e => e.log_type === "FAIL" || e.log_type === "OK")
    .map(e => ({ ...e, ts: parseObserviumTimestamp(e.timestamp) }))
    .sort((a, b) => a.ts - b.ts);

  let downMs = 0;
  let downSince = null;

  for (const ev of events) {
    if (ev.log_type === "FAIL" && downSince === null) {
      downSince = ev.ts;
    } else if (ev.log_type === "OK" && downSince !== null) {
      const from = Math.max(downSince, start);
      const to   = Math.min(ev.ts, end);
      downMs += Math.max(0, to - from);
      downSince = null;
    }
  }
  // Toujours down à la fin de la période
  if (downSince !== null) {
    const from = Math.max(downSince, start);
    downMs += Math.max(0, end - from);
  }

  const availability = ((totalMs - downMs) / totalMs) * 100;
  return {
    availability: Math.min(100, Math.max(0, Math.round(availability * 100) / 100)),
    downMs,
    downHours: Math.round((downMs / 3600000) * 100) / 100,
    eventCount: events.length,
    method: "alert-log-reconstruit",
  };
}

// ─── Conversion "8.06G" → Mbps ───────────────────────────────────────────────

function parseObserviumValue(str) {
  if (!str || str.trim() === "0" || str.trim() === "") return 0;

  const clean = str.trim();
  const num   = parseFloat(clean);

  if (isNaN(num)) return 0;

  if (clean.includes("T"))                    return num * 1_000_000; // Tbps → Mbps
  if (clean.includes("G"))                    return num * 1_000;     // Gbps → Mbps
  if (clean.includes("M"))                    return num;             // Mbps → Mbps
  if (clean.includes("k") || clean.includes("K")) return num / 1_000; // Kbps → Mbps
  if (clean.includes("µ") || clean.includes("u")) return num / 1_000_000; // µbps → Mbps

  return num / 1_000_000; // valeur brute bits/s → Mbps
}


// ─── Extraction des stats depuis getPortHistory ───────────────────────────────

function extractPortStats(historyData, portCfg) {
  const port       = historyData?.port    ?? {};
  const inner      = historyData?.legend?.legend ?? {};
  const portErrors = historyData?.legend  ?? {};

  const speedBps  = Number(port.ifSpeed ?? 0);
  const speedMbps = speedBps / 1_000_000;

  const operStatus  = port.ifOperStatus  ?? "unknown";
  const adminStatus = port.ifAdminStatus ?? "unknown";
  const inErrors    = parseFloat((portErrors?.in_max_error  || 0).toFixed(2));
  const outErrors   = parseFloat((portErrors?.out_max_error || 0).toFixed(2));
  const inDiscards  = parseFloat(port.ifInDiscards  ?? 0);
  const outDiscards = parseFloat(port.ifOutDiscards ?? 0);

  const p95InMbps  = parseObserviumValue(inner.in?.["95th"]);
  const p95OutMbps = parseObserviumValue(inner.out?.["95th"]);
  const avgInMbps  = parseObserviumValue(inner.in?.avg);
  const avgOutMbps = parseObserviumValue(inner.out?.avg);
  const maxInMbps  = parseObserviumValue(inner.in?.max);
  const maxOutMbps = parseObserviumValue(inner.out?.max);

  const hasData =
    p95InMbps  > 0 || p95OutMbps > 0 ||
    avgInMbps  > 0 || avgOutMbps > 0 ||
    maxInMbps  > 0 || maxOutMbps > 0;

  if (!hasData) {
   // console.warn(`⚠️  Pas de données pour port ${portCfg.ifName} (${portCfg.port_id})`);
    return {
      hasData:        false,
      noDataReason:   operStatus === "down"
        ? "Port inactif (DOWN)"
        : "Aucun trafic sur la période",
      operStatus,     adminStatus,
      speedMbps,      human_speed:  port.human_speed ?? "—",
      ifLastChange:   port.ifLastChange ?? null,
      p95InMbps:      null, p95OutMbps:    null,
      avgInMbps:      null, avgOutMbps:    null,
      maxInMbps:      null, maxOutMbps:    null,
      utilizationPct: null,
      p95UtilInPct:   null, p95UtilOutPct: null,
      inErrors,       outErrors,
      hasErrors:      inErrors > 0 || outErrors > 0,
      inDiscards,     outDiscards,
    };
  }

  function roundHalfUp(value, decimals = 2) {
    const factor = Math.pow(10, decimals);
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }

  const p95UtilInPct = speedMbps > 0
    ? Math.min(roundHalfUp((p95InMbps  / speedMbps) * 100), 100)
    : 0;

  const p95UtilOutPct = speedMbps > 0
    ? Math.min(roundHalfUp((p95OutMbps / speedMbps) * 100), 100)
    : 0;

  return {
    hasData:        true,
    noDataReason:   null,
    operStatus,     adminStatus,
    speedMbps,      human_speed:  port.human_speed ?? "—",
    ifLastChange:   port.ifLastChange ?? null,  
    p95InMbps,      p95OutMbps,
    p95UtilInPct,   p95UtilOutPct,
    utilizationPct: Math.max(p95UtilInPct, p95UtilOutPct),
    avgInMbps,      avgOutMbps,
    maxInMbps,      maxOutMbps,
    inErrors,       outErrors,
    hasErrors:      inErrors > 0 || outErrors > 0,
    inDiscards,     outDiscards,
  };
}


// ─── Agrégation principale ────────────────────────────────────────────────────

export const buildReportData = async ({ dateFrom, dateTo }) => {
  const deviceIds = devicesConfig
    .filter((d) => d.device_id)
    .map((d) => d.device_id);

    //console.log("les ID device",deviceIds);

  //await loadDeviceHostnames(deviceIds);
 
  const manualLinks = resolveManualLinks(manualLinksConfig, devicesConfig);
  const links = [...manualLinks];

  // ✅ Récupère stats + disponibilité pour chaque port de chaque lien
  const linkReports = await Promise.all(
    links.map(async (link) => {

      // ─── Côté A ─────────────────────────────────────────────────────────
      const histA  = await getPortHistory(
        link.portA_id, link.deviceA_id, dateFrom, dateTo
      ).catch(() => ({}));

     // console.log(`Récupération stats côté A (${link.hostnameA} ${link.portA_name})`, histA);

      const statsA    = extractPortStats(histA, {
        port_id: link.portA_id,
        ifName:  link.portA_name,
      });

      // ✅ Disponibilité côté A basée sur ifOperStatus + ifLastChange
      const portDataA  = histA?.port ?? {};
      const { availability: availabilityA, method: methodA } =
  await computeAvailabilityFromPort(link.deviceA_id, link.portA_id, dateFrom, dateTo);

        

        //console.log(`Disponibilité côté A (${link.hostnameA} ${link.portA_name}): ${availabilityA}% (${methodA})`);

      // ─── Côté B ─────────────────────────────────────────────────────────
      let statsB        = null;
      let availabilityB = 100;
      let methodB       = "non-monitoré";

      if (link.portB_id && link.deviceB_id) {
        const histB = await getPortHistory(
          link.portB_id, link.deviceB_id, dateFrom, dateTo
        ).catch(() => ({}));

        statsB = extractPortStats(histB, {
          port_id: link.portB_id,
          ifName:  link.portB_name,
        });

        // ✅ Disponibilité côté B basée sur ifOperStatus + ifLastChange
        const portDataB  = histB?.port ?? {};
        const resultB    = await computeAvailabilityFromPort(link.deviceB_id, link.portB_id, dateFrom, dateTo);
        availabilityB    = resultB.availability;
        methodB          = resultB.method;
      }

      // ─── Métriques agrégées du lien ──────────────────────────────────────

      // Statut global du lien
      const status =
        statsA.operStatus === "up"   && statsB?.operStatus === "up"   ? "UP"      :
        statsA.operStatus === "down" || statsB?.operStatus === "down" ? "DOWN"    :
        statsB === null ? statsA.operStatus.toUpperCase()             : "PARTIAL";

      // Capacité depuis le port A (plus fiable)
      const capacityGbps = (statsA.speedMbps ?? 0) / 1000;

      // Utilisation P95 = max des deux sens
      const utilizationPct = Math.max(
        statsA.utilizationPct  ?? 0,
        statsB?.utilizationPct ?? 0
      );

      // ✅ Disponibilité du lien = maillon faible (min des deux côtés)
      // Si un côté est null (statut inconnu) → on prend l'autre
      const availability =
        availabilityA !== null && availabilityB !== null
          ? Math.min(availabilityA, availabilityB)
          : availabilityA ?? availabilityB ?? null;

      // Erreurs cumulées
      const errorsA = (statsA.inErrors ?? 0) + (statsA.outErrors ?? 0);
      const errorsB = statsB ? (statsB.inErrors ?? 0) + (statsB.outErrors ?? 0) : 0;

      // Label du lien
      const linkLabel =
        `${link.hostnameA}_${link.portA_name} ⇔ ${link.portB_name}_${link.hostnameB}`;

      // Log pour debug
      /*console.log(
        `[DISPO] ${linkLabel} | A: ${availabilityA}% (${methodA}) | B: ${availabilityB}% (${methodB}) | Lien: ${availability}%`
      );*/

      return {
        link_id:            link.link_id,
        linkLabel,
        siteA:              link.siteA,
        siteB:              link.siteB,
        hostnameA:          link.hostnameA,
        hostnameB:          link.hostnameB,
        portA_id:           link.portA_id,
        portB_id:           link.portB_id,
        portA_name:         link.portA_name,
        portB_name:         link.portB_name,
        capacityGbps,
        status,
        availability,           // ✅ disponibilité du lien (maillon faible)
        availabilityA,          // ✅ disponibilité côté A
        availabilityB,          // ✅ disponibilité côté B
        availabilityMethod:     `A:${methodA} | B:${methodB}`, // ✅ transparence
        utilizationPct,
        errors:             `${errorsA} ⇔ ${errorsB}`,
        hasErrors:          errorsA > 0 || errorsB > 0,
        portA:              statsA,
        portB:              statsB,
      };
    })
  );

  // ─── Groupement par paire de sites ──────────────────────────────────────────
  const linksBySitePair = linkReports.reduce((acc, link) => {
    const key = [link.siteA, link.siteB].sort().join(" ↔ ");
    if (!acc[key]) acc[key] = { siteA: link.siteA, siteB: link.siteB, links: [] };
    acc[key].links.push(link);
    return acc;
  }, {});

  return {
    period:          { from: dateFrom, to: dateTo },
    generatedAt:     new Date().toISOString(),
    summary:         buildSummary(linkReports),
    linksBySitePair: Object.values(linksBySitePair),
    links:           linkReports,
  };
};


// ─── Résumé global ────────────────────────────────────────────────────────────

function buildSummary(linkReports) {
  // Exclut les liens avec availability null pour la moyenne
  const linksWithAvail = linkReports.filter((l) => l.availability !== null);

  const avgAvail = linksWithAvail.length
    ? Math.round(
        (linksWithAvail.reduce((s, l) => s + l.availability, 0) /
          linksWithAvail.length) * 100
      ) / 100
    : null;

  return {
    totalLinks:       linkReports.length,
    linksUp:          linkReports.filter((l) => l.status === "UP").length,
    linksDown:        linkReports.filter((l) => l.status === "DOWN").length,
    linksPartial:     linkReports.filter((l) => l.status === "PARTIAL").length,
    linksWithErrors:  linkReports.filter((l) => l.hasErrors).length,
    linksBelow99:     linkReports.filter((l) => l.availability !== null && l.availability < 99).length,
    avgAvailability:  avgAvail,
    totalErrors:      linkReports.reduce((s, l) => {
      const [a, b] = (l.errors ?? "0 ⇔ 0").split(" ⇔ ").map(Number);
      return s + (a || 0) + (b || 0);
    }, 0),
  };
}


// ─── Génération du rapport Excel ─────────────────────────────────────────────

export function generateExcel(reportData) {
  const wb = XLSX.utils.book_new();

  const fmt = (val, unit = "") =>
    val !== null && val !== undefined
      ? `${Number(val).toFixed(2)}${unit}`
      : "—";

  const fmtAvail = (val) =>
    val !== null && val !== undefined ? `${val}%` : "N/A";

  // ─── Feuille Résumé ──────────────────────────────────────────────────────────
  const s = reportData.summary;

  const summaryRows = [
    ["RAPPORT RÉSEAU", `${reportData.period.from} → ${reportData.period.to}`],
    ["Généré le", new Date(reportData.generatedAt).toLocaleString("fr-FR")],
    [],
    ["RÉSUMÉ GÉNÉRAL", ""],
    ["Total liens",                       s.totalLinks],
    ["Liens UP",                          s.linksUp],
    ["Liens DOWN",                        s.linksDown],
    ["Liens PARTIAL",                     s.linksPartial],
    ["Liens avec erreurs",                s.linksWithErrors],
    ["Liens disponibilité < 99%",         s.linksBelow99],
    ["Disponibilité moyenne",             fmtAvail(s.avgAvailability)],
    ["Total erreurs cumulées",            s.totalErrors],
    [],
    ["NOTE", "La disponibilité est estimée via ifOperStatus + ifLastChange (Observium)"],
    ["up-stable",          "100% — port UP sans changement détecté sur la période"],
    ["up-avec-transition", "Calculé — port était DOWN puis repassé UP pendant la période"],
    ["down-depuis-lastChange", "Calculé — port DOWN depuis ifLastChange"],
    ["down-sans-date",     "0% — port DOWN, date de passage inconnue"],
    ["non-monitoré",       "Côté B non supervisé par Observium"],
    ["statut-inconnu",     "Données insuffisantes"],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary["!cols"] = [{ wch: 35 }, { wch: 55 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Résumé");

  // ─── Feuille Liens ───────────────────────────────────────────────────────────
  const linkHeaders = [
    "Lien",
    "Site A",
    "Site B",
    "Équipement A",
    "Équipement B",
    "Port A",
    "Port B",
    "Capacité (Gbps)",
    "Statut",
    "Disponibilité lien %",
    "Dispo A %",
    "Dispo B %",
    "Méthode calcul",
    "Dernier chgt A",
    "Dernier chgt B",
    "Utilisation P95 %",
    "P95 In A (Mbps)",
    "P95 Out A (Mbps)",
    "P95 In B (Mbps)",
    "P95 Out B (Mbps)",
    "Avg In A (Mbps)",
    "Avg Out A (Mbps)",
    "Erreurs A ⇔ B",
    "Anomalies",
  ];

  const linkRows = reportData.links.map((l) => {
    const flags = [];
    if (l.status === "DOWN")                          flags.push("LIEN DOWN");
    if (l.status === "PARTIAL")                       flags.push("LIEN PARTIEL");
    if (l.hasErrors)                                  flags.push("Erreurs détectées");
    if (l.utilizationPct >= 80)                       flags.push(`Saturation ${fmt(l.utilizationPct)}%`);
    if (l.availability !== null && l.availability < 99) flags.push(`Dispo ${l.availability}%`);
    if (l.availabilityMethod?.includes("down"))       flags.push("Port DOWN détecté");

    return [
      l.linkLabel,
      l.siteA,
      l.siteB,
      l.hostnameA,
      l.hostnameB,
      l.portA_name,
      l.portB_name                ?? "—",
      fmt(l.capacityGbps),
      l.status,
      fmtAvail(l.availability),
      fmtAvail(l.availabilityA),
      fmtAvail(l.availabilityB),
      l.availabilityMethod        ?? "—",
      l.portA?.ifLastChange       ?? "—",
      l.portB?.ifLastChange       ?? "—",
      fmt(l.utilizationPct, "%"),
      fmt(l.portA?.p95InMbps),
      fmt(l.portA?.p95OutMbps),
      fmt(l.portB?.p95InMbps),
      fmt(l.portB?.p95OutMbps),
      fmt(l.portA?.avgInMbps),
      fmt(l.portA?.avgOutMbps),
      l.errors                    ?? "—",
      flags.length > 0 ? flags.join(" | ") : "✓ OK",
    ];
  });

  const wsLinks = XLSX.utils.aoa_to_sheet([linkHeaders, ...linkRows]);
  wsLinks["!cols"] = [
    { wch: 50 }, // Lien
    { wch: 15 }, // Site A
    { wch: 15 }, // Site B
    { wch: 22 }, // Équipement A
    { wch: 22 }, // Équipement B
    { wch: 18 }, // Port A
    { wch: 18 }, // Port B
    { wch: 16 }, // Capacité
    { wch: 10 }, // Statut
    { wch: 20 }, // Disponibilité lien
    { wch: 12 }, // Dispo A
    { wch: 12 }, // Dispo B
    { wch: 35 }, // Méthode
    { wch: 20 }, // Dernier chgt A
    { wch: 20 }, // Dernier chgt B
    { wch: 16 }, // Utilisation
    { wch: 16 }, // P95 In A
    { wch: 16 }, // P95 Out A
    { wch: 16 }, // P95 In B
    { wch: 16 }, // P95 Out B
    { wch: 16 }, // Avg In A
    { wch: 16 }, // Avg Out A
    { wch: 14 }, // Erreurs
    { wch: 40 }, // Anomalies
  ];
  XLSX.utils.book_append_sheet(wb, wsLinks, "Liens");

  // ─── Une feuille par paire de sites ─────────────────────────────────────────
  for (const sitePair of reportData.linksBySitePair) {
    const pairHeaders = [
      [`${sitePair.siteA} ↔ ${sitePair.siteB}`, ""],
      [],
      [
        "Lien", "Statut", "Disponibilité %",
        "Dispo A %", "Dispo B %", "Méthode",
        "Capacité (Gbps)", "Utilisation P95 %",
        "P95 In A", "P95 Out A", "P95 In B", "P95 Out B",
        "Erreurs", "Anomalies",
      ],
    ];

    const pairRows = sitePair.links.map((l) => {
      const flags = [];
      if (l.status !== "UP")                              flags.push(l.status);
      if (l.hasErrors)                                    flags.push("Erreurs");
      if (l.utilizationPct >= 80)                         flags.push(`Sat. ${fmt(l.utilizationPct)}%`);
      if (l.availability !== null && l.availability < 99) flags.push(`Dispo ${l.availability}%`);

      return [
        l.linkLabel,
        l.status,
        fmtAvail(l.availability),
        fmtAvail(l.availabilityA),
        fmtAvail(l.availabilityB),
        l.availabilityMethod ?? "—",
        fmt(l.capacityGbps),
        fmt(l.utilizationPct, "%"),
        fmt(l.portA?.p95InMbps),
        fmt(l.portA?.p95OutMbps),
        fmt(l.portB?.p95InMbps),
        fmt(l.portB?.p95OutMbps),
        l.errors ?? "—",
        flags.length > 0 ? flags.join(" | ") : "✓ OK",
      ];
    });

    const wsData = [...pairHeaders, ...pairRows];
    const ws     = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"]  = [
      { wch: 50 }, { wch: 10 }, { wch: 18 },
      { wch: 12 }, { wch: 12 }, { wch: 35 },
      { wch: 16 }, { wch: 16 },
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
      { wch: 14 }, { wch: 35 },
    ];

    // Nom de feuille — max 31 caractères
    const sheetName = `${sitePair.siteA}-${sitePair.siteB}`.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}
