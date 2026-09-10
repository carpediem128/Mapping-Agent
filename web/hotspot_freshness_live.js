(function () {
  "use strict";

  function previousBusinessDay(date) {
    var result = new Date(date.getTime());
    if (result.getHours() < 9 || (result.getHours() === 9 && result.getMinutes() < 30)) result.setDate(result.getDate() - 1);
    if (result.getDay() === 0) result.setDate(result.getDate() - 2);
    if (result.getDay() === 6) result.setDate(result.getDate() - 1);
    return result;
  }

  function ymd(date) {
    return String(date.getFullYear()) + String(date.getMonth() + 1).padStart(2, "0") + String(date.getDate()).padStart(2, "0");
  }

  function check(reloadWhenFresh) {
    fetch("./data/site_data.json?fresh=" + Date.now(), { cache: "no-store" }).then(function (response) { return response.json(); }).then(function (data) {
      var hotspots = data.hotspots || {};
      var date = String(hotspots.date || "");
      var dateText = date ? date.slice(0, 4) + "-" + date.slice(4, 6) + "-" + date.slice(6, 8) : "未知";
      var collected = hotspots.collected_at || "";
      var collectedText = collected ? new Date(collected).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false }) : "未知";
      var recent = collected && Date.now() - Date.parse(collected) < 36 * 3600000;
      var available = hotspots.data_status === "akshare_ok" && recent;
      var source = hotspots.market_source || {};
      var partial = !!(source.board_error || source.fund_error || ((source.detail || {}).enrichment_errors || []).length || ((source.detail || {}).errors || []).length);
      var status = document.getElementById("hotspot-status");
      var summary = document.getElementById("market-summary");
      if (status) status.textContent = data.market_refresh_error ? "最近刷新失败 · 保留行情 " + dateText : available ? (partial ? "AKShare 部分更新 · " : "AKShare 已采集 · ") + (date ? "日线核验 " + dateText : "行情日期待核验") : "历史快照 · " + dateText;
      if (status) status.title = "采集时间：" + collectedText;
      if (summary) summary.textContent = (hotspots.market_summary || "暂无大盘概况") + " · 采集：" + collectedText;
      var initial = (window.__MAPPING_SITE_DATA__ || {}).hotspots || {};
      if (available && reloadWhenFresh && collected !== initial.collected_at && ["#hotspots", "#overview"].includes(location.hash) && !document.activeElement.matches("input,textarea,select")) {
        window.location.reload();
      } else {
        window.setTimeout(function () { check(true); }, 30000);
      }
    }).catch(function () {
      window.setTimeout(function () { check(reloadWhenFresh); }, 30000);
    });
  }

  check(false);
}());
