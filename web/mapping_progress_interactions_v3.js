(function () {
  "use strict";
  var P = "一级市场", S = "二级市场", data, sourceData, timers = {};
  var clean = function (v) { return String(v == null ? "" : v).trim(); };
  var esc = function (v) { return clean(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); };
  var theme = function (v) { return clean(v).replace(/^\d{6}\s*/, "").replace(/\s*Mapping\s*$/i, ""); };
  var contacted = function (r) { var s = clean(r.progress).toLowerCase(); return !!s && !["未联系", "未找到联系方式", "待联系", "暂无联系方式", "未记录"].some(function (x) { return s.indexOf(x.toLowerCase()) >= 0; }); };
  var rows = function (s) { return (sourceData.records || []).filter(function (r) { return r.source_label === s.source_label && r.sheet === s.sheet; }); };
  function summaries(level) {
    var map = {};
    (sourceData.sources || []).filter(function (s) { return s.sheet === level; }).forEach(function (s) {
      var list = rows(s); if (!list.length) return; var name = theme(s.source_label), k = name.toLowerCase();
      if (!map[k]) map[k] = { name: name, total: 0, contacted: 0 }; map[k].total += list.length;
      var companies = {}; list.forEach(function (r) { companies[clean(r.company).toLowerCase()] = true; });
      map[k].contacted += (data.rows || []).filter(function (r) { return companies[clean(r.company).toLowerCase()] && contacted(r); }).length;
    });
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return b.total - a.total || a.name.localeCompare(b.name); });
  }
  function draw(target, level) {
    if (!data || !sourceData) return;
    var panel = target.closest(".mapping-split-panel"), active = panel && panel.querySelector(".mapping-sector-card.active"), chosen = active ? active.dataset.title : "", list = summaries(level), max = Math.max.apply(null, list.map(function (x) { return x.total; }).concat([1]));
    var html = list.map(function (x) { var ah = Math.max(8, Math.round(x.total / max * 100)), ch = Math.min(ah, Math.round(x.contacted / max * 100)); return '<button type="button" class="mapping-progress-item' + (x.name === chosen ? ' active' : '') + '" data-progress-theme="' + esc(x.name) + '"><span class="mapping-progress-bar" title="' + esc(x.name + '：已联系 ' + x.contacted + ' / ' + x.total + ' 家') + '"><i class="mapping-progress-total" style="height:' + ah + '%"></i><i class="mapping-progress-contacted" style="height:' + ch + '%"></i></span><strong>' + esc(x.name) + '</strong><small>' + x.contacted + ' / ' + x.total + '</small></button>'; }).join("");
    target.dataset.progressBusy = "1";
    target.innerHTML = '<div class="mapping-progress-head"><div><div class="column-label">已完成赛道</div><p>柱高代表项目数量，深色部分代表已联系项目。</p></div><div class="mapping-progress-legend"><span><i class="legend-total"></i>项目总量</span><span><i class="legend-contacted"></i>已联系</span></div></div><div class="mapping-progress-chart">' + html + '</div>';
    target.querySelectorAll("[data-progress-theme]").forEach(function (b) { b.addEventListener("click", function () { var left = panel && panel.querySelector('[data-title="' + CSS.escape(b.dataset.progressTheme) + '"]'); if (left) left.click(); }); });
    window.setTimeout(function () { delete target.dataset.progressBusy; }, 0);
  }
  function sync(target, level) { clearTimeout(timers[target.id]); timers[target.id] = window.setTimeout(function () { if (!target.dataset.progressBusy) draw(target, level); }, 0); }
  function init() {
    Promise.all([fetch("./data/site_data.json?progress=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.json(); }), fetch("./data/mapping_sources.json?progress=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.json(); })]).then(function (v) {
      data = v[0].contact_progress || {}; sourceData = v[1];
      [{ id: "primary-mappings-overview", level: P }, { id: "secondary-mappings-overview", level: S }].forEach(function (e) {
        var target = document.getElementById(e.id); if (!target) return;
        target.addEventListener("click", function (event) { var card = event.target.closest(".mapping-topic-card"); if (!card) return; var panel = target.closest(".mapping-split-panel"), left = panel && panel.querySelector('[data-title="' + CSS.escape(card.dataset.theme || "") + '"]'); if (left) left.click(); });
        new MutationObserver(function () { if (!target.dataset.progressBusy) sync(target, e.level); }).observe(target, { childList: true });
        draw(target, e.level);
      });
    }).catch(function (e) { console.warn("mapping progress unavailable", e); });
  }
  window.setTimeout(init, 1600);
}());
