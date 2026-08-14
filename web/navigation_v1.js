(function () {
  "use strict";

  var pendingRoute = "";

  function normalize(value) {
    var route = String(value || "").replace(/^#/, "");
    return route === "mappings" ? "primary-mappings" : (route || "overview");
  }

  var initialRoute = normalize(window.__dashboardInitialRoute || window.location.hash);

  function activate(value, updateHistory) {
    var route = normalize(value);
    var panel = document.querySelector('.view-panel[data-view="' + route + '"]');
    if (!panel) {
      pendingRoute = route;
      return false;
    }

    document.querySelectorAll(".view-panel").forEach(function (item) {
      item.classList.toggle("active", item.dataset.view === route);
    });
    document.querySelectorAll(".side-nav a[data-view]").forEach(function (link) {
      var target = normalize(link.dataset.split || link.dataset.view);
      var active = target === route;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });

    pendingRoute = "";
    if (updateHistory && window.location.hash !== "#" + route) {
      history.pushState(null, "", "#" + route);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
    return true;
  }

  function syncFromLocation() {
    var route = normalize(window.location.hash);
    if (pendingRoute && !document.querySelector('.view-panel[data-view="' + pendingRoute + '"]')) {
      route = pendingRoute;
    }
    if (!activate(route, false)) {
      window.setTimeout(function () { activate(route, false); }, 650);
    }
  }

  document.addEventListener("click", function (event) {
    var link = event.target.closest(".side-nav a[data-view]");
    if (!link) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    var route = normalize(link.dataset.split || link.dataset.view);
    if (!activate(route, true)) {
      history.pushState(null, "", "#" + route);
      window.setTimeout(function () { activate(route, false); }, 650);
    }
  }, true);

  window.addEventListener("hashchange", syncFromLocation);
  window.addEventListener("popstate", syncFromLocation);

  var root = document.querySelector(".main-column") || document.body;
  new MutationObserver(function () {
    if (pendingRoute) {
      var route = pendingRoute;
      if (activate(route, false)) history.replaceState(null, "", "#" + route);
    }
  }).observe(root, { childList: true, subtree: true });

  if (initialRoute === "primary-mappings" || initialRoute === "secondary-mappings") {
    pendingRoute = initialRoute;
  }
  syncFromLocation();
  window.setTimeout(syncFromLocation, 900);
}());
