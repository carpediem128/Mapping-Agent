(function () {
  "use strict";

  function applyCustomerCopy() {
    document.querySelectorAll(".topic-detail-panel p").forEach(function (node) {
      if (node.textContent.indexOf("不再按主题拆分项目") >= 0) node.textContent = "查看该赛道的完整项目清单、研究字段与联系方式。";
    });
    document.querySelectorAll(".topic-overline").forEach(function (node) {
      if (node.textContent === "RAW EXCEL VIEW") node.textContent = "项目总览";
    });
    document.querySelectorAll(".raw-label-intro").forEach(function (node) {
      node.textContent = "赛道标签";
    });
  }

  window.setTimeout(applyCustomerCopy, 450);
  var target = document.getElementById("topic-detail");
  if (target && window.MutationObserver) new MutationObserver(applyCustomerCopy).observe(target, { childList: true, subtree: true });
}());
