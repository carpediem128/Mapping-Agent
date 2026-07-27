import fs from "node:fs/promises";
import path from "node:path";

const dataDir = "C:/Users/Carpe diem/Documents/New project/hardtech_investment_agent/web/data";
const sitePath = path.join(dataDir, "site_data.json");
const raw = await fs.readFile(sitePath, "utf8");
const normalized = raw.replace(/\bNaN\b/g, "null").replace(/\bInfinity\b/g, "null").replace(/\b-Infinity\b/g, "null");
const data = JSON.parse(normalized);
const serialized = JSON.stringify(data, null, 2);
await fs.writeFile(sitePath, serialized, "utf8");
await fs.writeFile(path.join(dataDir, "site_data.js"), `window.__MAPPING_SITE_DATA__ = ${serialized};`, "utf8");
console.log(JSON.stringify({ repaired: raw === normalized ? 0 : 1, bytes: serialized.length }, null, 2));
