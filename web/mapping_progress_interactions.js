(function () {
  "use strict";
  var PRIMARY = "一级市场", SECONDARY = "二级市场";
  var clean = function (v) { return String(v == null ? "" : v).trim(); };
  var esc = function (v) { return clean(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); };
  var theme = function (v) { return clean(v).replace(/^\d{6}\s*/, "").replace(/\s*Mapping\s*$/i, ""); };
  var hasContact = function (row) {
    var f = row.fields || {}, keys = ["座机电话", "电话", "手机", "手机号", "邮箱", "Email", "email", "微信/QQ", "微信", "QQ"];
    return keys.some(function (k) { return clean(f[k]); }) || !!row.hasContact;
  };
  function sourceRows(sourceData, source) { return (sourceData.records || []).filter(function (r) { return r.source_label === source.source_label && r.sheet === source.sheet; }); }
  function getSummaries(sourceData, contacts, level) {
    var map = {};
    (sourceData.sources || []).filter(function (s) { return s.sheet === level; }).forEach(function (s) {
      var list = sourceRows(sourceData, s); if (!list.length) return;
      var name = theme(s.source_label), k = name.toLowerCase();
      if (!map[k]) map[k] = { name: name, total: 0, contacted: 0 };
      map[k].total += list.length;
      var companies = {}; list.forEach(function (r) { companies[clean(r.company).toLowerCase()] = true; });
      var fromContacts = (contacts.rows || []).filter(function (r) { return companies[clean(r.company).toLowerCase()] && r.hasContact; }).length;
      map[k].contacted += Math.max(list.filter(hasContact).length, fromContacts);
    });
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return b.total - a.total || a.name.localeCompare(b.name); });
  }
  function renderVerticalChart(target, sourceData, contacts, level, chosen) {
    var list = getSummaries(sourceData, contacts, level), max = Math.max.apply(null, list.map(function (x) { return x.total; }).concat([1]));
    var items = list.map(function (x) {
      var totalHeight = Math.max(8, Math.round(x.total / max * 100)), contactedHeight = Math.min(totalHeight, Math.round(x.contacted / max * 100));
      return '<button type="button" class="mapping-progress-item' + (x.name === chosen ? ' active' : '') + '" data-progress-theme="' + esc(x.name) + '"><span class="mapping-progress-bar" title="' + esc(x.name + '：' + x.contacted + ' / ' + x.total + ' 家') + '"><i class="mapping-progress-total" style="height:' + totalHeight + '%"></i><i class="mapping-progress-contacted" style="height:' + contactedHeight + '%"></i></span><strong>' + esc(x.name) + '</strong><small>' + x.contacted + ' / ' + x.total + '</small></button>';
    }).join("");
    target.innerHTML = '<div class="mapping-progress-head"><div><div class="column-label">已完成赛道</div><p>柱高代表项目数量，深色部分代表已有联系方式的项目。</p></div><div class="mapping-progress-legend"><span><i class="legend-total"></i>全部项目</span><span><i class="legend-contacted"></i>已联系</span></div></div><div class="mapping-progress-chart">' + items + '</div>';
    target.querySelectorAll("[data-progress-theme]").forEach(function (button) { button.addEventListener("click", function () { var panel = target.closest(".mapping-split-panel"), title = button.dataset.progressTheme, left = panel && panel.querySelector('[data-title="' + CSS.escape(title) + '"]'); if (left) left.click(); }); });
  }
  function refresh() {
    Promise.all([fetch("./data/site_data.json?progress=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.json(); }), fetch("./data/mapping_sources.json?progress=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.json(); })]).then(function (v) {
      var siteData = v[0], sourceData = v[1];
      [{ id: "primary-mappings-overview", level: PRIMARY }, { id: "secondary-mappings-overview", level: SECONDARY }].forEach(function (entry) { var target = document.getElementById(entry.id); if (!target) return; var selected = target.closest(".mapping-split-panel").querySelector(".mapping-sector-card.active"); renderVerticalChart(target, sourceData, siteData.contact_progress || {}, entry.level, selected ? selected.dataset.title : ""); });
    }).catch(function (error) { console.warn("mapping progress unavailable", error); });
  }
  function bindOverviewCards() {
    document.querySelectorAll(".mapping-topic-overview").forEach(function (overview) { if (overview.dataset.bound) return; overview.dataset.bound = "1"; overview.addEventListener("click", function (event) { var card = event.target.closest(".mapping-topic-card"); if (!card) return; var panel = overview.closest(".mapping-split-panel"), left = panel && panel.querySelector('[data-title="' + CSS.escape(card.dataset.theme || "") + '"]'); if (left) left.click(); }); });
  }
  function init() { bindOverviewCards(); refresh(); window.setTimeout(function () { bindOverviewCards(); refresh(); }, 1300); }
  window.setTimeout(init, 1600);
}());
