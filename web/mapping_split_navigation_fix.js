(function () {
  "use strict";
  window.setTimeout(function () {
    document.querySelectorAll(".overview-link[data-topic], .rank-link[data-sector]").forEach(function (button) {
      button.addEventListener("click", function () {
        var value = button.dataset.topic || button.dataset.sector || "";
        var input = document.getElementById("primary-search");
        if (input) input.value = value;
        document.querySelectorAll(".view-panel").forEach(function (panel) { panel.classList.toggle("active", panel.dataset.view === "primary-mappings"); });
        document.querySelectorAll("a[data-split]").forEach(function (link) { link.classList.toggle("active", link.dataset.split === "primary-mappings"); });
        history.replaceState(null, "", "#primary-mappings");
      });
    });
  }, 1200);
}());
