(function () {
  "use strict";

  function previousBusinessDay(date) {
    var result = new Date(date.getTime());
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
      var expected = ymd(previousBusinessDay(new Date()));
      var dateText = date ? date.slice(0, 4) + "-" + date.slice(4, 6) + "-" + date.slice(6, 8) : "未知";
      var fresh = date >= expected && hotspots.data_status === "akshare_ok";
      var status = document.getElementById("hotspot-status");
      var summary = document.getElementById("market-summary");
      if (status) status.textContent = fresh ? "AKShare 已接入 · 数据日 " + dateText : "AKShare 正在刷新 · 当前缓存 " + dateText;
      if (summary && fresh) summary.textContent = (hotspots.market_summary || "暂无大盘概况") + " · 数据日：" + dateText + " · 看板生成：" + String(data.generated_at || "").replace("T", " ");
      if (fresh && reloadWhenFresh) {
        window.location.reload();
      } else if (!fresh) {
        window.setTimeout(function () { check(true); }, 3000);
      }
    }).catch(function () {
      window.setTimeout(function () { check(reloadWhenFresh); }, 5000);
    });
  }

  check(false);
}());
