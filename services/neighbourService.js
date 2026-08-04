import { observiumApi } from "./observiumService.js";

export function resolveManualLinks(manualLinksConfig, devicesConfig) {
  const deviceByHostname = Object.fromEntries(
    devicesConfig.map((d) => [d.hostname, d])
  );

  return manualLinksConfig.map((link, idx) => {
    const deviceA = deviceByHostname[link.hostnameA];
    const deviceB = deviceByHostname[link.hostnameB];
    const portsA  = link.portA_id ?? [];
    const portsB  = link.portB_id ?? [];
    const portNameA = link.portA_name ?? "—";
    const portNameB = link.portB_name ?? "—";

    return {
      link_id:    `M${String(idx + 1).padStart(3, "0")}`,
      siteA:      link.siteA,
      siteB:      link.siteB,
      hostnameA:  link.hostnameA,
      hostnameB:  link.hostnameB,
      deviceA_id: deviceA?.device_id ?? null,
      deviceB_id: deviceB?.device_id ?? null,
      portA_id:   portsA?? null,
      portA_name: portNameA,
      portB_id:   portsB?? null,
      portB_name: portNameB,
      capacity_gbps: link.capacity_gbps,
      protocol:   "manual",
      active:     true,
    };
  });
}

/*export async function getNeighbours() {
  try {
    const { data } = await observiumApi.get("/neighbours/");
    const raw = data?.entries ?? data?.neighbours ?? {};
    const neighbours = Object.values(raw);
    console.log(`${neighbours.length} voisins récupérés`);
    return neighbours;
  } catch (err) {
    console.error("Erreur getNeighbours:", err.message);
    return [];
  }
}
Construit les liens automatiquement depuis devicesConfig
export function buildLinksFromNeighbours(neighbours, devicesConfig) {

  const deviceByHostname = Object.fromEntries(
    devicesConfig.map((d) => [d.hostname, d])
  );
  const deviceById = Object.fromEntries(
    devicesConfig
      .filter((d) => d.device_id)
      .map((d) => [String(d.device_id), d])
  );
  const monitoredHostnames = new Set(devicesConfig.map((d) => d.hostname));
  neighbours.forEach((n) => {
    const deviceA = deviceById[String(n.device_id)];
    if (deviceA) {
      const isBmonitored = monitoredHostnames.has(n.remote_hostname);
    /*  console.log(
        `device_id=${n.device_id} (${deviceA.hostname}, site=${deviceA.site}) → ` +
        `remote_hostname="${n.remote_hostname}" isBmonitored=${isBmonitored}`
      );
    }
  });

  const links = [];
  const seen  = new Set();
  let linkCounter = 1;

  for (const n of neighbours) {
    const deviceA = deviceById[String(n.device_id)];
    if (!deviceA) continue;

    const deviceB = deviceByHostname[n.remote_hostname] ?? null;
    const isBmonitored = monitoredHostnames.has(n.remote_hostname);
    if (!isBmonitored) continue;

    const portAId = String(n.port_id);
    const portBId = n.remote_port_id ? String(n.remote_port_id) : null;

    const dedupeKey = [
      deviceA.hostname, portAId,
      n.remote_hostname, portBId ?? n.remote_port,
    ].sort().join("|");

    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    links.push({
      link_id:      `L${String(linkCounter++).padStart(3, "0")}`,
      neighbour_id: n.neighbour_id,
      siteA:        deviceA.site,
      siteB:        deviceB?.site ?? n.remote_hostname,
      hostnameA:    deviceA.hostname,
      hostnameB:    n.remote_hostname,
      deviceA_id:   String(n.device_id),
      deviceB_id:   deviceB?.device_id ? String(deviceB.device_id) : null,
      portA_id:     portAId,
      portA_name:   n.local_port ?? "—",
      portB_id:     portBId,
      portB_name:   n.remote_port ?? "—",
      protocol:     n.protocol ?? "LLDP",
      active:       n.active === "1",
    });
  }

  //console.log(`${links.length} liens construits automatiquement`);
  links.forEach((l) =>
    console.log(`  ${l.hostnameA} (${l.siteA}) ↔ ${l.hostnameB} (${l.siteB})`)
  );

  return links;
}*/
