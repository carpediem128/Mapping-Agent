(function () {
  "use strict";
  var P = "\u4e00\u7ea7\u5e02\u573a", S = "\u4e8c\u7ea7\u5e02\u573a", C = "\u516c\u53f8\u540d\u79f0";
  var data, sourceData, selected = { primary: "", secondary: "" }, queries = { primary: "", secondary: "" };
  var initialView = String(window.__dashboardInitialRoute || location.hash).replace("#", "");
  var $ = function (id) { return document.getElementById(id); };
  var clean = function (v) { return String(v == null ? "" : v).trim(); };
  var esc = function (v) { return clean(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); };
  var theme = function (v) { return clean(v).replace(/^\d{6}\s*/, "").replace(/\s*Mapping\s*$/i, ""); };
  var key = function (level) { return level === P ? "primary" : "secondary"; };
  var color = function (v) { var n = 0, t = clean(v) || "-"; for (var i = 0; i < t.length; i += 1) n = (n * 31 + t.charCodeAt(i)) % 7; return n; };
  function rows(source) { return (sourceData.records || []).filter(function (r) { return r.source_label === source.source_label && r.sheet === source.sheet; }); }
  function item(source) { return (data.mappings || []).find(function (m) { return String(m.name || "").includes(source.source_label) && String(m.name || "").includes(source.sheet); }) || {}; }
  function sources(level) {
    var q = queries[key(level)].toLowerCase();
    return (sourceData.sources || []).filter(function (s) { return s.sheet === level; }).map(function (s) { return { source: s, rows: rows(s), title: theme(s.source_label), item: item(s) }; }).filter(function (e) { return e.rows.length && (!q || [e.title, e.source.source_label, JSON.stringify(e.rows)].join(" ").toLowerCase().includes(q)); });
  }
  function summaries() {
    var map = {};
    (sourceData.sources || []).forEach(function (s) { var n = rows(s).length, t = theme(s.source_label); if (!n) return; map[t] = map[t] || { name: t, primary: 0, secondary: 0 }; map[t][s.sheet === P ? "primary" : "secondary"] += n; });
    return Object.keys(map).map(function (n) { return map[n]; }).sort(function (a, b) { return b.primary - a.primary || a.name.localeCompare(b.name); });
  }
  function table(source, list) {
    var headers = (source.headers || []).slice(), first = headers[0] || "\u6807\u7b7e", rest = headers.slice(1), company = headers.find(function (h) { return h.includes(C); }) || "";
    var head = [first].concat(rest).map(function (h) { return "<th>" + esc(h) + "</th>"; }).join("");
    var body = list.map(function (r) { var f = r.fields || {}, label = clean(f[first] || r.topic || "-"), cells = ["<td><span class=\"raw-label raw-label-" + color(label) + "\">" + esc(label) + "</span></td>"]; rest.forEach(function (h) { var v = clean(f[h]); cells.push("<td>" + (h === company ? "<strong>" + esc(v || "-") + "</strong>" : esc(v || "-")) + "</td>"); }); return "<tr>" + cells.join("") + "</tr>"; }).join("");
    return "<div class=\"mapping-raw-table-wrap\"><table class=\"mapping-raw-table\"><thead><tr>" + head + "</tr></thead><tbody>" + body + "</tbody></table></div>";
  }
  function overview(target, chosen) {
    var list = summaries(), max = Math.max.apply(null, list.map(function (x) { return x.primary; }).concat([1]));
    target.innerHTML = "<div class=\"mapping-topic-overview-head\"><div><div class=\"column-label\">\u4e3b\u9898\u6982\u89c8</div><p>\u5df2\u8986\u76d6\u8d5b\u9053\u53ca\u4e00\u7ea7\u9879\u76ee\u6570\u91cf</p></div><span class=\"status-tag\">" + list.length + " \u4e2a\u8d5b\u9053</span></div><div class=\"mapping-topic-overview-grid\">" + list.map(function (x) { return "<button type=\"button\" class=\"mapping-topic-card" + (x.name === chosen ? " active" : "") + "\" data-theme=\"" + esc(x.name) + "\"><strong>" + esc(x.name) + "</strong><small>\u4e00\u7ea7 " + x.primary + " \u4e2a · \u4e8c\u7ea7 " + x.secondary + " \u5bb6</small></button>"; }).join("") + "</div><div class=\"mapping-coverage-chart\">" + list.map(function (x) { return "<div class=\"mapping-coverage-row\"><strong>" + esc(x.name) + "</strong><div class=\"mapping-coverage-track\"><i style=\"width:" + Math.round(x.primary / max * 100) + "%\"></i></div><span>" + x.primary + " \u4e2a</span></div>"; }).join("") + "</div>";
  }
  function panel(level) {
    var k = key(level), title = level === P ? "\u4e00\u7ea7\u5e02\u573a Mapping" : "\u4e8c\u7ea7\u5e02\u573a Mapping", id = k + "-mappings", section = document.createElement("section");
    section.className = "view-panel mapping-split-panel"; section.id = id; section.dataset.view = id;
    section.innerHTML = "<div class=\"panel\"><div class=\"panel-head\"><div><div class=\"section-kicker\">" + (level === P ? "05 / PRIMARY MARKET" : "06 / SECONDARY MARKET") + "</div><h2>" + title + "</h2><p>\u6309\u8d5b\u9053\u4e3b\u9898\u6d4f\u89c8\u5df2\u5b8c\u6210\u7684\u7814\u7a76\u9879\u76ee\u3002</p></div><label class=\"search\"><span>\u641c\u7d22</span><input id=\"" + k + "-search\" type=\"search\" placeholder=\"\u8d5b\u9053 / \u516c\u53f8 / \u7814\u7a76\u5b57\u6bb5\" /></label></div><div id=\"" + k + "-overview\" class=\"mapping-topic-overview\"></div><div class=\"mapping-workbench\"><div class=\"mapping-sector-column\"><div class=\"column-label\">\u5df2\u5b8c\u6210\u8d5b\u9053</div><div id=\"" + k + "-list\" class=\"mapping-sector-list\"></div></div><div class=\"topic-column\"><div class=\"topic-toolbar\"><div><div class=\"column-label\">\u8d5b\u9053\u660e\u7ec6</div><div id=\"" + k + "-crumb\" class=\"topic-breadcrumb\"></div></div><a id=\"" + k + "-download\" class=\"outline-link\" href=\"#\" download>\u4e0b\u8f7d\u7814\u7a76\u6587\u4ef6</a></div><div id=\"" + k + "-detail\" class=\"topic-detail-panel\"></div></div></div></div></section>";
    return section;
  }
  function render(level) {
    var k = key(level), entries = sources(level), list = $(k + "-list");
    if (!entries.length) { list.innerHTML = "<div class=\"mapping-raw-empty\">\u6682\u65e0\u5df2\u5b8c\u6210\u7684\u8d5b\u9053\u3002</div>"; return; }
    if (!entries.some(function (e) { return e.title === selected[k]; })) selected[k] = entries[0].title;
    var chosen = entries.find(function (e) { return e.title === selected[k]; }) || entries[0];
    list.innerHTML = entries.map(function (e) { return "<button type=\"button\" class=\"mapping-sector-card" + (e.title === chosen.title ? " active" : "") + "\" data-title=\"" + esc(e.title) + "\"><span><strong>" + esc(e.title) + "</strong><small>" + e.rows.length + " \u4e2a\u9879\u76ee</small></span></button>"; }).join("");
    list.querySelectorAll("[data-title]").forEach(function (b) { b.addEventListener("click", function () { selected[k] = b.dataset.title || ""; render(level); }); });
    overview($(k + "-overview"), chosen.title);
    $(k + "-crumb").textContent = chosen.title + " · " + level;
    if (chosen.item.url) $(k + "-download").href = "./" + encodeURI(chosen.item.url);
    $(k + "-detail").innerHTML = "<div class=\"topic-detail-head\"><div><div class=\"topic-overline\">\u9879\u76ee\u603b\u89c8</div><h3>" + esc(chosen.title) + "</h3><p>\u5305\u542b\u516c\u53f8\u3001\u4e1a\u52a1\u3001\u6280\u672f\u3001\u878d\u8d44\u548c\u56e2\u961f\u7b49\u7814\u7a76\u5b57\u6bb5\u3002</p></div><strong class=\"topic-count\">" + chosen.rows.length + "<small>\u4e2a\u9879\u76ee</small></strong></div><div class=\"topic-meta\"><span>\u8d5b\u9053\uff1a" + esc(chosen.title) + "</span><span>\u5e02\u573a\u5c42\u7ea7\uff1a" + level + "</span><span>\u6765\u6e90\uff1a\u5df2\u5bfc\u5165\u7814\u7a76\u6587\u4ef6</span></div><div class=\"topic-preview-title\">\u9879\u76ee\u660e\u7ec6</div>" + table(chosen.source, chosen.rows);
  }
  function bindSectorSwitching(level) {
    var k = key(level), section = $(k + "-mappings");
    if (!section || section.dataset.sectorSwitchBound) return;
    section.dataset.sectorSwitchBound = "true";
    section.addEventListener("click", function (event) {
      var card = event.target.closest(".mapping-topic-card[data-theme], .mapping-sector-card[data-title]");
      if (!card || !section.contains(card)) return;
      var title = clean(card.dataset.theme || card.dataset.title);
      if (!title || title === selected[k]) return;
      selected[k] = title;
      render(level);
    });
  }
  function nav() {
    var n = document.querySelector(".side-nav");
    if (!n) return;
    var one = n.querySelector('a[data-view="primary-mappings"]') || n.querySelector('a[data-view="mappings"]');
    if (!one) return;
    one.dataset.view = "primary-mappings";
    one.dataset.split = "primary-mappings";
    one.href = "#primary-mappings";
    var two = n.querySelector('a[data-view="secondary-mappings"]');
    if (!two) {
      two = one.cloneNode(true);
      two.dataset.view = "secondary-mappings";
      two.dataset.split = "secondary-mappings";
      two.href = "#secondary-mappings";
      two.innerHTML = "<span>06</span>二级市场 Mapping";
      one.parentNode.insertBefore(two, one.nextSibling);
    }
    var imp = n.querySelector('a[data-view="imports"]');
    if (imp) imp.innerHTML = "<span>07</span>导入与配置";
    n.querySelectorAll("a[data-split]").forEach(function (link) {
      link.addEventListener("click", function (event) {
        event.preventDefault();
        show(link.dataset.split);
      });
    });
  }  function show(view) { document.querySelectorAll(".view-panel").forEach(function (p) { p.classList.toggle("active", p.dataset.view === view); }); document.querySelectorAll("a[data-split]").forEach(function (a) { a.classList.toggle("active", a.dataset.split === view); }); history.replaceState(null, "", "#" + view); }
  function setup() {
    var old = document.getElementById("mappings"); if (!old) return;
    var one = panel(P), two = panel(S); old.replaceWith(one, two); nav(); var current = location.hash.replace("#", ""), requested = /^(primary-mappings|secondary-mappings|mappings)$/.test(initialView) ? initialView : current; show(requested === "secondary-mappings" ? "secondary-mappings" : requested === "primary-mappings" || requested === "mappings" ? "primary-mappings" : requested || "overview");
    [P, S].forEach(function (level) { var k = key(level), search = $(k + "-search"); bindSectorSwitching(level); if (search) search.addEventListener("input", function () { queries[k] = clean(search.value).toLowerCase(); render(level); }); render(level); });
  }
  Promise.all([fetch("./data/site_data.json?split=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.json(); }), fetch("./data/mapping_sources.json?split=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.json(); })]).then(function (v) { data = v[0]; sourceData = v[1]; window.setTimeout(setup, 500); }).catch(function (error) { console.error("Failed to load Mapping data", error); });
}());
