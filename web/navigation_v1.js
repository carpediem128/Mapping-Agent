(function () {
  "use strict";

  var ROUTES = ["overview", "hotspots", "industries", "contacts", "primary-mappings", "secondary-mappings", "imports"];

  function normalize(view) {
    var value = String(view || "").replace(/^#/, "");
    return value === "mappings" ? "primary-mappings" : value;
  }

  function hasPanel(view) {
    return !!document.querySelector('.view-panel[data-view="' + view + '"]');
  }

  function setActive(view) {
    document.querySelectorAll(".view-panel").forEach(function (panel) {
      panel.classList.toggle("active", panel.dataset.view === view);
    });
    document.querySelectorAll(".side-nav a").forEach(function (link) {
      var target = normalize(link.dataset.split || link.dataset.view || (link.getAttribute("href") || "").replace("#", ""));
      link.classList.toggle("active", target === view);
      link.setAttribute("aria-current", target === view ? "page" : "false");
    });
  }

  function go(view, updateHash) {
    var target = normalize(view);
    if (!hasPanel(target)) target = "overview";
    setActive(target);
    if (updateHash !== false && window.location.hash !== "#" + target) {
      history.pushState(null, "", "#" + target);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.dispatchEvent(new CustomEvent("mapping-route-change", { detail: { view: target } }));
    return target;
  }

  function chooseSector(name) {
    var value = String(name || "").trim().toLowerCase();
    if (!value) return;
    var cards = Array.from(document.querySelectorAll("#primary-mappings .mapping-sector-card[data-title], #secondary-mappings .mapping-sector-card[data-title]"));
    var match = cards.find(function (card) {
      var title = String(card.dataset.title || "").trim().toLowerCase();
      return title === value || title.includes(value) || value.includes(title);
    });
    if (match) match.click();
  }

  function onClick(event) {
    var link = event.target.closest(".side-nav a");
    if (link) {
      event.preventDefault();
      event.stopPropagation();
      go(link.dataset.split || link.dataset.view || link.getAttribute("href"));
      return;
    }

    var overviewLink = event.target.closest(".overview-link[data-sector]");
    var rankLink = event.target.closest(".rank-link[data-sector]");
    var jump = overviewLink || rankLink;
    if (jump) {
      event.preventDefault();
      event.stopPropagation();
      go("primary-mappings");
      window.setTimeout(function () { chooseSector(jump.dataset.sector); }, 100);
    }
  }

  function syncFromHash() {
    var requested = normalize(window.location.hash || "overview");
    go(ROUTES.indexOf(requested) >= 0 ? requested : "overview", false);
  }

  document.addEventListener("click", onClick, true);
  window.addEventListener("hashchange", syncFromHash);
  window.addEventListener("popstate", syncFromHash);
  window.setTimeout(syncFromHash, 700);
  window.setTimeout(syncFromHash, 1500);
}());