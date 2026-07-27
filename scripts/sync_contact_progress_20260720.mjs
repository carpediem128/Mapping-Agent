import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const ROOT = "C:/Users/Carpe diem/Documents/New project/hardtech_investment_agent";
const workbookPath = "C:/Users/Carpe diem/Desktop/光刻机&电芯片mapping/已联系mapping/公司联系进度统筹表_20260720.xlsx";
const dataDir = path.join(ROOT, "web/data");
const sitePath = path.join(dataDir, "site_data.json");
const sourcePath = path.join(dataDir, "mapping_sources.json");

function text(value) {
  return value === null || value === undefined ? "" : String(value).replace(/\r\n/g, "\n").trim();
}

function normalize(value) {
  return text(value)
    .toLowerCase()
    .replace(/[（(].*?[）)]/g, "")
    .replace(/股份有限公司|有限责任公司|有限公司|科技|技术|集团|公司|电子|半导体/g, "")
    .replace(/[\s·.。,，、\-_]/g, "");
}

function unique(values) {
  return [...new Set(values.map(text).filter(Boolean))];
}

function parseContact(raw) {
  const value = text(raw);
  const phones = unique(value.match(/(?:0\d{2,3}[-－]?[0-9]{7,8}(?:[-－]\d{1,6})?|1[3-9]\d{9})/g) || []);
  const emails = unique(value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []);
  const landline = phones.filter((item) => /^0/.test(item)).join("；");
  const mobile = phones.filter((item) => /^1[3-9]\d{9}$/.test(item)).join("；");
  const social = /微信|wx|wechat|qq/i.test(value) ? value : "";
  return { raw: value, landline, mobile, email: emails.join("；"), social, hasDirect: Boolean(phones.length || emails.length || social) };
}

function firstPerson(team, contact) {
  const match = text(contact).match(/[，,;；\s]([\u4e00-\u9fa5]{2,4})(?:，|,|\s|$)/);
  if (match) return match[1];
  const teamMatch = text(team).match(/^([\u4e00-\u9fa5]{2,4})(?:，|,|\s)/);
  return teamMatch ? teamMatch[1] : "未披露";
}

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(workbookPath));
const sheet = workbook.worksheets.getItemAt(0);
const values = sheet.getUsedRange().values || [];
const headers = (values[0] || []).map((value, index) => text(value) || `列${index + 1}`);
const rawRows = values.slice(1).filter((row) => row.some((value) => text(value)));
const siteData = JSON.parse(await fs.readFile(sitePath, "utf8"));
const sourceData = JSON.parse(await fs.readFile(sourcePath, "utf8"));
const secondaryNames = new Set();
for (const record of sourceData.records || []) {
  if (record.sheet === "二级市场") secondaryNames.add(normalize(record.company));
}
for (const record of siteData.hotspots?.secondary_data || []) secondaryNames.add(normalize(record.name));

const excluded = [];
const rows = [];
const blockedStatuses = new Set(["不联系", "业务不相关"]);
for (let index = 0; index < rawRows.length; index += 1) {
  const record = Object.fromEntries(headers.map((header, col) => [header, text(rawRows[index]?.[col])]));
  const company = record["公司名称"];
  const status = record["联系情况"] || "未记录";
  const source = record["数据来源"];
  const secondary = /二级市场|上市公司|股票代码|证券代码/i.test(`${source} ${record["公司业务"]}`) || secondaryNames.has(normalize(company));
  if (secondary) {
    excluded.push({ company, source, reason: "二级市场标的或二级市场来源" });
    continue;
  }
  const contact = parseContact(record["联系方式"]);
  const note = [record["联系情况备注"], !contact.hasDirect && record["联系方式"] ? `原始联系方式字段：${record["联系方式"]}` : ""].filter(Boolean).join("；");
  const contacted = !["未联系", "未联系上", "无联系方式", "待核实"].includes(status) && !blockedStatuses.has(status);
  const meeting = /约见|见面|会议|拜访|当面/.test(`${status} ${record["联系情况备注"]}`) ? "是" : "未记录";
  rows.push({
    company,
    industry: record["行业"] || "待识别",
    industries: [record["行业"] || "待识别"],
    companyType: "",
    intro: record["公司简介"] || "",
    team: record["公司团队"] || "",
    round: "",
    oneLiner: record["公司业务"] || "",
    landline: contact.landline,
    mobile: contact.mobile,
    email: contact.email,
    wechat: contact.social,
    progress: status,
    meeting,
    person: firstPerson(record["公司团队"], record["联系方式"]),
    source,
    sourceDate: "2026-07-20（统筹表）",
    url: "",
    note,
    evidence: record["联系情况备注"] || "",
    mappingSources: source ? [source] : [],
    contactSources: source ? [source] : [],
    hasContact: contact.hasDirect || contacted,
    rawContact: contact.raw,
  });
}

const withContact = rows.filter((row) => row.hasContact).length;
const contacted = rows.filter((row) => !["未联系", "未联系上", "无联系方式", "待核实", "不联系", "业务不相关"].includes(row.progress)).length;
const meetings = rows.filter((row) => row.meeting === "是").length;
const sectors = new Map();
for (const row of rows) {
  const key = row.industry || "待识别";
  if (!sectors.has(key)) sectors.set(key, { sector: key, rows: 0, with_contact: 0, rate: 0 });
  const item = sectors.get(key);
  item.rows += 1;
  if (row.hasContact) item.with_contact += 1;
}
for (const item of sectors.values()) item.rate = item.rows ? Math.round(item.with_contact / item.rows * 100) : 0;
const contactProgress = {
  source: "公司联系进度统筹表_20260720.xlsx",
  source_date: "2026-07-20",
  rows,
  stats: { total: rows.length, with_contact: withContact, contact_rate: rows.length ? Math.round(withContact / rows.length * 100) : 0, contacted, meetings, excluded_secondary: excluded.length },
  excluded_secondary: excluded,
};
siteData.contact_progress = contactProgress;
siteData.contacts = {
  source: contactProgress.source,
  rows: rows.length,
  with_contact: withContact,
  contact_rate: contactProgress.stats.contact_rate,
  contacted,
  meetings,
  sector_breakdown: [...sectors.values()],
  preview: rows.slice(0, 20).map((row) => ({ sector: row.industry, company: row.company, contact: [row.landline, row.mobile, row.email, row.wechat].filter(Boolean).join("；") || "未找到", reached: row.progress })),
};
siteData.stats = siteData.stats || {};
siteData.stats.contact_rate = contactProgress.stats.contact_rate;
siteData.stats.contact_rows = rows.length;
siteData.stats.contact_with_contact = withContact;
const serialized = JSON.stringify(siteData, null, 2);
await fs.writeFile(sitePath, serialized, "utf8");
await fs.writeFile(path.join(dataDir, "site_data.js"), `window.__MAPPING_SITE_DATA__ = ${serialized};`, "utf8");
await fs.writeFile(path.join(dataDir, "contact_progress_20260720.json"), JSON.stringify(contactProgress, null, 2), "utf8");
console.log(JSON.stringify({ input_rows: rawRows.length, output_rows: rows.length, unique_companies: new Set(rows.map((row) => normalize(row.company))).size, excluded_secondary: excluded, stats: contactProgress.stats }, null, 2));
