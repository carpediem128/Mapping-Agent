(function () {
  "use strict";

  var SECONDARY = "\u4e8c\u7ea7\u5e02\u573a";
  var MAPPING = "\u4e00\u7ea7\u5e02\u573a";
  var COMPANY = "\u516c\u53f8\u540d\u79f0";
  var ENTERPRISE = "\u4f01\u4e1a\u540d\u79f0";
  var state = { data: null, sources: null, selected: "", query: "" };

  function id(name) { return document.getElementById(name); }
  function esc(value) { return String(value == null ? "" : value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
  function text(value) { return String(value == null ? "" : value).trim(); }
  function theme(label) { return text(label).replace(/^\d{6}\s*/, "").replace(/\s*Mapping\s*$/i, "").trim(); }
  function sheetOf(source) { return source.sheet === SECONDARY ? SECONDARY : MAPPING; }
  function color(value) { var result = 0; var input = text(value) || "-"; for (var i = 0; i < input.length; i += 1) result = (result * 31 + input.charCodeAt(i)) % 7; return result; }

  function recordsFor(source) {
    return (state.sources.records || []).filter(function (record) {
      return record.source_label === source.source_label && record.sheet === source.sheet;
    });
  }

  function mappingItemFor(source) {
    return (state.data.mappings || []).find(function (item) {
      return String(item.name || "").includes(source.source_label) && String(item.name || "").includes(source.sheet);
    }) || {};
  }

  function companyHeader(headers) {
    return headers.find(function (header) { return header.includes(COMPANY) || header.includes(ENTERPRISE); }) || "";
  }

  function renderTable(source, records) {
    var headers = (source.headers || []).slice();
    if (!headers.length && records[0]) headers = Object.keys(records[0].fields || {});
    if (!records.length) return "<div class=\"mapping-raw-empty\"><strong>\u6682\u65e0\u9879\u76ee\u6570\u636e</strong><p>\u8be5\u8d5b\u9053\u7684\u7814\u7a76\u6570\u636e\u5c1a\u672a\u5b8c\u6210\u3002</p></div>";
    var labelHeader = headers[0] || "\u6807\u7b7e";
    var rest = headers.slice(1);
    var company = companyHeader(headers);
    var head = [labelHeader].concat(rest).map(function (header) { return "<th>" + esc(header) + "</th>"; }).join("");
    var body = records.map(function (record) {
      var fields = record.fields || {};
      var label = text(fields[labelHeader] || record.topic || "-");
      var cells = ["<td><span class=\"raw-label raw-label-" + color(label) + "\">" + esc(label) + "</span></td>"];
      rest.forEach(function (header) {
        var value = text(fields[header]);
        cells.push("<td>" + (header === company ? "<strong>" + esc(value || "-") + "</strong>" : esc(value || "-")) + "</td>");
      });
      return "<tr>" + cells.join("") + "</tr>";
    }).join("");
    return "<div class=\"mapping-raw-table-wrap\"><table class=\"mapping-raw-table\"><thead><tr>" + head + "</tr></thead><tbody>" + body + "</tbody></table></div>";
  }

  function matchingSources() {
    var query = state.query.toLowerCase();
    return (state.sources.sources || []).map(function (source) {
      var records = recordsFor(source);
      var item = mappingItemFor(source);
      return { source: source, records: records, item: item, title: theme(source.source_label) + " · " + sheetOf(source) };
    }).filter(function (entry) {
      if (!entry.records.length) return false;
      if (!query) return true;
      return [entry.title, entry.source.source_label, entry.source.sheet, JSON.stringify(entry.records)].join(" ").toLowerCase().includes(query);
    });
  }

  function render() {
    if (!state.data || !state.sources) return;
    var entries = matchingSources();
    var sectorList = id("mapping-sector-list");
    if (!entries.length) {
      sectorList.innerHTML = "<div class=\"mapping-raw-empty\">\u6682\u65e0\u5339\u914d\u7684\u8d5b\u9053\u3002</div>";
      id("topic-tags").innerHTML = "";
      id("topic-detail").innerHTML = "<div class=\"mapping-raw-empty\"><strong>\u6682\u65e0\u641c\u7d22\u7ed3\u679c</strong><p>\u8bf7\u8c03\u6574\u8d5b\u9053\u3001\u516c\u53f8\u6216\u7814\u7a76\u5b57\u6bb5\u3002</p></div>";
      return;
    }
    if (!entries.some(function (entry) { return entry.title === state.selected; })) state.selected = entries[0].title;
    sectorList.innerHTML = entries.map(function (entry) {
      var active = entry.title === state.selected ? " active" : "";
      return "<button class=\"mapping-sector" + active + "\" type=\"button\" data-mapping-title=\"" + esc(entry.title) + "\"><strong>" + esc(entry.title) + "</strong><small>" + entry.records.length + " \u4e2a\u9879\u76ee</small></button>";
    }).join("");
    sectorList.querySelectorAll("[data-mapping-title]").forEach(function (button) {
      button.addEventListener("click", function () { state.selected = button.dataset.mappingTitle || ""; render(); });
    });

    var selected = entries.find(function (entry) { return entry.title === state.selected; }) || entries[0];
    var item = selected.item;
    id("topic-breadcrumb").textContent = selected.title;
    var download = id("topic-download");
    download.textContent = "\u4e0b\u8f7d\u7814\u7a76\u6587\u4ef6";
    if (item.url) download.href = "./" + encodeURI(item.url);
    id("topic-tags").innerHTML = "";
    id("topic-detail").innerHTML = "<div class=\"topic-detail-head\"><div><div class=\"topic-overline\">\u9879\u76ee\u603b\u89c8</div><h3>" + esc(theme(selected.source.source_label)) + "</h3><p>" + esc(sheetOf(selected.source)) + " · \u5b8c\u6574\u7814\u7a76\u6570\u636e\u4e0e\u516c\u53f8\u660e\u7ec6</p></div><strong class=\"topic-count\">" + selected.records.length + "<small>\u4e2a\u9879\u76ee</small></strong></div><div class=\"topic-meta\"><span>\u7814\u7a76\u65b9\u5411：" + esc(theme(selected.source.source_label)) + "</span><span>\u5e02\u573a\u5c42\u7ea7：" + esc(sheetOf(selected.source)) + "</span><span>\u5173\u8054\u4f01\u4e1a：" + selected.records.length + " \u5bb6</span></div><div class=\"topic-preview-title\">\u9879\u76ee\u660e\u7ec6</div>" + renderTable(selected.source, selected.records);
  }

  function boot() {
    Promise.all([fetch("./data/site_data.json?clean=" + Date.now(), { cache: "no-store" }).then(function (response) { return response.json(); }), fetch("./data/mapping_sources.json?clean=" + Date.now(), { cache: "no-store" }).then(function (response) { return response.json(); })]).then(function (values) {
      state.data = values[0];
      state.sources = values[1];
      var search = id("mapping-search");
      if (search) search.addEventListener("input", function (event) { state.query = text(event.target.value).toLowerCase(); render(); });
      render();
    });
  }

  window.setTimeout(boot, 800);
}());
