(function () {
  "use strict";

  function previousBusinessDay(date) {
    var result = new Date(date.getTime());
    var day = result.getDay();
    if (day === 0) result.setDate(result.getDate() - 2);
    if (day === 6) result.setDate(result.getDate() - 1);
    return result;
  }

  function ymd(date) {
    return String(date.getFullYear()) + String(date.getMonth() + 1).padStart(2, "0") + String(date.getDate()).padStart(2, "0");
  }

  fetch("./data/site_data.json", { cache: "no-store" }).then(function (response) { return response.json(); }).then(function (data) {
    var hotspots = data.hotspots || {};
    var date = String(hotspots.date || "");
    var expected = ymd(previousBusinessDay(new Date()));
    var status = document.getElementById("hotspot-status");
    var summary = document.getElementById("market-summary");
    var isFresh = date >= expected;
    var dateText = date ? (date.slice(0, 4) + "-" + date.slice(4, 6) + "-" + date.slice(6, 8)) : "未知";
    if (status) status.textContent = (hotspots.data_status === "akshare_ok" ? "AKShare 已接入" : "行情数据待检查") + " · 数据日 " + dateText + (isFresh ? "" : " · 需要刷新");
    if (summary) summary.textContent = (hotspots.market_summary || "暂无大盘概况") + " · 数据日：" + dateText + " · 看板生成：" + String(data.generated_at || "").replace("T", " ");
  }).catch(function () {
    var status = document.getElementById("hotspot-status");
    if (status) status.textContent = "热点日期检查失败";
  });
}());
