import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const ROOT = "C:/Users/Carpe diem/Documents/New project/hardtech_investment_agent";
const OUTPUT = path.join(ROOT, "web/data/mapping_sources.json");
const inputs = [
  {
    label: "260708 金刚石散热 Mapping",
    file: "C:/Users/Carpe diem/Desktop/光刻机&电芯片mapping/260630TSV+散热等/260708_金刚石散热_Mapping.xlsx",
  },
  {
    label: "260710 玻璃基板 Mapping",
    file: "C:/Users/Carpe diem/Desktop/光刻机&电芯片mapping/260630TSV+散热等/260710_玻璃基板_Mapping.xlsx",
  },
];

function clean(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\r\n/g, "\n").trim();
}

function asText(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return clean(value);
}

function findCompany(fields) {
  return fields["公司名称"] || fields["企业名称"] || fields["标的名称"] || fields["公司"] || "";
}

function suspiciousContact(field, value) {
  if (!value || !/电话|手机|邮箱|email|phone/i.test(field)) return false;
  return /^\d{1,3}$/.test(value);
}

const records = [];
const sheets = [];
for (const input of inputs) {
  const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(input.file));
  for (const sheet of workbook.worksheets.items) {
    const values = sheet.getUsedRange().values || [];
    const headerIndex = values.findIndex((row) => (row || []).some((cell) => clean(cell)));
    if (headerIndex < 0) continue;
    const headers = (values[headerIndex] || []).map((cell, index) => clean(cell) || `未命名列${index + 1}`);
    const sourceSheet = {
      source_id: input.file,
      source_label: input.label,
      source_file: path.basename(input.file),
      sheet: sheet.name,
      headers,
      row_count: 0,
    };
    sheets.push(sourceSheet);
    for (let rowIndex = headerIndex + 1; rowIndex < values.length; rowIndex += 1) {
      const row = values[rowIndex] || [];
      const fields = {};
      headers.forEach((header, columnIndex) => {
        fields[header] = asText(row[columnIndex]);
      });
      if (!Object.values(fields).some(Boolean)) continue;
      const company = findCompany(fields);
      const searchText = [input.label, sheet.name, ...Object.entries(fields).flat()].join(" ").toLowerCase();
      const qualityFlags = Object.entries(fields)
        .filter(([field, value]) => suspiciousContact(field, value))
        .map(([field, value]) => `${field}=${value}`);
      records.push({
        id: `${input.label}|${sheet.name}|${rowIndex + 1}`,
        source_label: input.label,
        source_file: path.basename(input.file),
        sheet: sheet.name,
        row_number: rowIndex + 1,
        topic: fields[headers[0]] || "",
        company,
        fields,
        search_text: searchText,
        quality_flags: qualityFlags,
      });
      sourceSheet.row_count += 1;
    }
  }
}

const payload = {
  generated_at: new Date().toISOString(),
  source_count: inputs.length,
  sheet_count: sheets.length,
  record_count: records.length,
  sources: sheets,
  records,
};
await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
await fs.writeFile(OUTPUT, JSON.stringify(payload, null, 2), "utf8");
console.log(JSON.stringify({ output: OUTPUT, source_count: payload.source_count, sheet_count: payload.sheet_count, record_count: payload.record_count, sheets }, null, 2));
