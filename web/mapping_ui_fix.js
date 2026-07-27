(function () {
  "use strict";

  var mappingState = {
    data: null,
    sourceData: null,
    selected: "",
    query: "",
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalize(value) {
    return String(value == null ? "" : value).trim().toLowerCase();
  }

  function labelColor(label) {
    var text = String(label || "未分类");
    var total = 0;
    for (var i = 0; i < text.length; i += 1) total = (total * 31 + text.charCodeAt(i)) % 7;
    return total;
  }

  function sheetOf(item) {
    return String(item.name || "").includes("二级市场") ? "二级市场" : "一级市场";
  }

  function sourceLabelOf(item) {
    return String(item.name || "").replace(/\s*[·/]\s*(一级市场|二级市场).*$/, "").trim();
  }

  function recordsFor(item) {
    var label = sourceLabelOf(item);
    var sheet = sheetOf(item);
    return (mappingState.sourceData.records || []).filter(function (row) {
      return row.source_label === label && row.sheet === sheet;
    });
  }

  function itemMatches(item, records) {
    if (!mappingState.query) return true;
    var blob = [item.name, item.sector].concat(records.map(function (row) {
      return [row.topic, row.company, row.search_text, JSON.stringify(row.fields || {})].join(" ");
    })).join(" ");
    return normalize(blob).includes(mappingState.query);
  }

  function rowLabel(row, headers) {
    return String(row.topic || (row.fields || {})[headers[0]] || "未分类").trim() || "未分类";
  }

  function companyValue(row, headers) {
    var fields = row.fields || {};
    var companyHeader = headers.find(function (header) {
      return String(header).includes("公司名称") || String(header).includes("企业名称");
    });
    return companyHeader ? fields[companyHeader] : (row.company || "");
  }

  function renderRawTable(item, records, source) {
    if (!records.length) {
      return '<div class="mapping-raw-empty"><strong>当前文件没有可展示的原始项目</strong><p>请检查该 Excel 是否包含表头和项目行。</p></div>';
    }
    var headers = source && source.headers ? source.headers.slice() : [];
    if (!headers.length) headers = Object.keys(records[0].fields || {});
    var labelHeader = headers[0] || "标签";
    var visibleHeaders = headers.filter(function (header) { return header !== labelHeader; });
    var head = ["原始标签"].concat(visibleHeaders).map(function (header) { return "<th>" + esc(header) + "</th>"; }).join("");
    var body = records.map(function (row) {
      var fields = row.fields || {};
      var label = rowLabel(row, headers);
      var cells = ["<td><span class=\"raw-label raw-label-" + labelColor(label) + "\">" + esc(label) + "</span></td>"];
      visibleHeaders.forEach(function (header) {
        var value = fields[header] == null ? "" : fields[header];
        var isCompany = String(header).includes("公司名称") || String(header).includes("企业名称");
        cells.push("<td>" + (isCompany ? "<strong>" + esc(value || "-") + "</strong>" : esc(value || "-")) + "</td>");
      });
      return "<tr>" + cells.join("") + "</tr>";
    }).join("");
    return '<div class="mapping-raw-table-wrap"><table class="mapping-raw-table"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  function render() {
    if (!mappingState.data || !mappingState.sourceData) return;
    var mappings = (mappingState.data.mappings || []).filter(function (item) {
      return itemMatches(item, recordsFor(item));
    });
    var sectorList = byId("mapping-sector-list");
    if (!mappings.length) {
      sectorList.innerHTML = '<div class="mapping-raw-empty">没有匹配的 Mapping。</div>';
      byId("topic-tags").innerHTML = "";
      byId("topic-detail").innerHTML = '<div class="mapping-raw-empty"><strong>没有匹配结果</strong><p>请换一个公司、赛道或 Excel 字段关键词。</p></div>';
      return;
    }
    if (!mappings.some(function (item) { return item.name === mappingState.selected; })) mappingState.selected = mappings[0].name;
    sectorList.innerHTML = mappings.map(function (item) {
      var records = recordsFor(item);
      var active = item.name === mappingState.selected ? " active" : "";
      return '<button class="mapping-sector' + active + '" type="button" data-mapping-name="' + esc(item.name) + '"><strong>' + esc(item.name) + '</strong><small>' + esc(sheetOf(item)) + " · " + records.length + ' 条原始记录</small></button>';
    }).join("");
    sectorList.querySelectorAll("[data-mapping-name]").forEach(function (button) {
      button.addEventListener("click", function () {
        mappingState.selected = button.dataset.mappingName || "";
        render();
      });
    });

    var selected = mappings.find(function (item) { return item.name === mappingState.selected; }) || mappings[0];
    var records = recordsFor(selected);
    var source = (mappingState.sourceData.sources || []).find(function (sourceItem) {
      return sourceItem.source_label === sourceLabelOf(selected) && sourceItem.sheet === sheetOf(selected);
    });
    var labels = [];
    records.forEach(function (row) {
      var label = rowLabel(row, (source && source.headers) || []);
      if (!labels.includes(label)) labels.push(label);
    });
    byId("topic-breadcrumb").textContent = selected.name + " · 原始 Excel 项目表";
    var download = byId("topic-download");
    if (selected.url) download.href = "./" + encodeURI(selected.url);
    download.textContent = "下载原始 Excel";
    byId("topic-tags").innerHTML = '<span class="raw-label-intro">原始 Excel 标签</span>' + labels.map(function (label) {
      return '<span class="raw-label raw-label-' + labelColor(label) + '">' + esc(label) + '</span>';
    }).join("");
    byId("topic-detail").innerHTML = '<div class="topic-detail-head"><div><div class="topic-overline">RAW EXCEL VIEW</div><h3>' + esc(selected.name) + '</h3><p>不再按主题拆分项目；保留原始 Excel 的全部项目行，第一列为原始标签。</p></div><strong class="topic-count">' + records.length + '<small>条原始记录</small></strong></div><div class="topic-meta"><span>Sheet：' + esc(sheetOf(selected)) + '</span><span>标签：' + labels.length + ' 类</span><span>联系方式：' + (selected.contact_count || 0) + ' / ' + records.length + '</span></div><div class="topic-preview-title">项目明细</div>' + renderRawTable(selected, records, source);
  }

  function bootFix() {
    Promise.all([
      fetch("./data/site_data.json", { cache: "no-store" }).then(function (response) { return response.json(); }),
      fetch("./data/mapping_sources.json", { cache: "no-store" }).then(function (response) { return response.json(); }),
    ]).then(function (values) {
      mappingState.data = values[0];
      mappingState.sourceData = values[1];
      var search = byId("mapping-search");
      if (search) search.addEventListener("input", function (event) {
        mappingState.query = normalize(event.target.value);
        render();
      });
      render();
    }).catch(function (error) {
      var detail = byId("topic-detail");
      if (detail) detail.innerHTML = '<div class="mapping-raw-empty"><strong>原始 Excel 数据加载失败</strong><p>' + esc(error.message) + '</p></div>';
    });
  }

  window.setTimeout(bootFix, 300);
}());
