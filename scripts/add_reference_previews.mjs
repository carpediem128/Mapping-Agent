import fs from "node:fs/promises";
import path from "node:path";

const dataDir = "C:/Users/Carpe diem/Documents/New project/hardtech_investment_agent/web/data";
const sitePath = path.join(dataDir, "site_data.json");
const data = JSON.parse(await fs.readFile(sitePath, "utf8"));
const referenceMappings = (data.mappings || []).filter((mapping) => mapping.source_file && mapping.source_sheet);
for (const mapping of referenceMappings) {
  mapping.preview = (mapping.topics || []).flatMap((topic) => topic.preview || []);
}
await fs.writeFile(sitePath, JSON.stringify(data, null, 2), "utf8");
await fs.writeFile(path.join(dataDir, "site_data.js"), `window.__MAPPING_SITE_DATA__ = ${JSON.stringify(data)};`, "utf8");
console.log(JSON.stringify({ updated_mappings: referenceMappings.length, preview_rows: referenceMappings.reduce((sum, item) => sum + item.preview.length, 0) }, null, 2));
