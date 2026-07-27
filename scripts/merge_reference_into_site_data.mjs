import fs from "node:fs/promises";
import path from "node:path";

const webData = "C:/Users/Carpe diem/Documents/New project/hardtech_investment_agent/web/data";
const sitePath = path.join(webData, "site_data.json");
const sourcePath = path.join(webData, "mapping_sources.json");
const data = JSON.parse(await fs.readFile(sitePath, "utf8"));
const source = JSON.parse(await fs.readFile(sourcePath, "utf8"));

function text(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function first(fields, names) {
  for (const name of names) {
    if (text(fields[name])) return text(fields[name]);
  }
  return "";
}

const contactNames = ["联系电话", "座机电话", "手机", "电话", "邮箱", "官网", "地址"];
const groups = new Map();
for (const record of source.records || []) {
  const key = `${record.source_label}|${record.sheet}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(record);
}

const referenceMappings = [...groups.entries()].map(([key, records]) => {
  const [sourceLabel, sheet] = key.split("|");
  const headers = source.sources.find((item) => item.source_label === sourceLabel && item.sheet === sheet)?.headers || [];
  const topicHeader = headers[0] || "主题";
  const topicGroups = new Map();
  for (const record of records) {
    const topic = record.topic || "未分类";
    if (!topicGroups.has(topic)) topicGroups.set(topic, []);
    topicGroups.get(topic).push(record);
  }
  const preview = (rows) => rows.map((record) => {
    const fields = record.fields || {};
    const contact = contactNames.map((name) => fields[name] ? `${name}：${fields[name]}` : "").filter(Boolean).join("；");
    return {
      company: record.company || first(fields, ["标的名称", "公司"]),
      region: first(fields, ["地区", "地址"]),
      business: first(fields, ["业务描述", "主营业务"]),
      product: first(fields, ["核心产品/技术", "产品技术"]),
      round: first(fields, ["融资轮次", "交易所"]),
      amount: first(fields, ["最新融资金额", "当前市值(20260630，亿元人民币)", "当前市值(20260710，亿元人民币)"]),
      contact: contact || "未公开",
      search_text: record.search_text,
      raw_fields: fields,
    };
  });
  const topics = [...topicGroups.entries()].map(([topic, rows]) => ({
    name: topic,
    aliases: [sourceLabel, sheet, topicHeader].filter(Boolean),
    summary: `${sourceLabel} / ${sheet}，共 ${rows.length} 条记录`,
    row_count: rows.length,
    preview: preview(rows),
  }));
  return {
    sector: sourceLabel,
    name: `${sourceLabel} · ${sheet}`,
    url: "data/mapping_sources.json",
    row_count: records.length,
    contact_count: records.filter((record) => contactNames.some((name) => text(record.fields?.[name]))).length,
    secondary_count: sheet === "二级市场" ? records.length : 0,
    source_file: records[0]?.source_file || "",
    source_sheet: sheet,
    topics,
  };
});

data.mappings = [...(data.mappings || []).filter((mapping) => !String(mapping.name || "").includes("· 一级市场") && !String(mapping.name || "").includes("· 二级市场")), ...referenceMappings];
data.stats = data.stats || {};
data.stats.mapping_count = data.mappings.length;
data.stats.topic_count = data.mappings.reduce((count, mapping) => count + (mapping.topics || []).length, 0);
data.stats.mapping_rows = data.mappings.reduce((count, mapping) => count + (Number(mapping.row_count) || 0), 0);
data.reference_workbooks = {
  source_count: source.source_count,
  sheet_count: source.sheet_count,
  record_count: source.record_count,
  sources: source.sources,
};

await fs.writeFile(sitePath, JSON.stringify(data, null, 2), "utf8");
await fs.writeFile(path.join(webData, "site_data.js"), `window.__MAPPING_SITE_DATA__ = ${JSON.stringify(data)};`, "utf8");
console.log(JSON.stringify({ mapping_count: data.stats.mapping_count, topic_count: data.stats.topic_count, mapping_rows: data.stats.mapping_rows, reference: data.reference_workbooks }, null, 2));
