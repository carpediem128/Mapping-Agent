(function () {
  "use strict";
  function choose(panel, title) {
    if (!panel || !title) return;
    var buttons = panel.querySelectorAll(".mapping-sector-card[data-title]");
    for (var i = 0; i < buttons.length; i += 1) {
      if (buttons[i].dataset.title === title && !buttons[i].classList.contains("active")) {
        buttons[i].click();
        return;
      }
    }
  }
  function init() {
    document.addEventListener("click", function (event) {
      var topic = event.target.closest(".mapping-topic-card[data-theme]");
      if (topic) {
        choose(topic.closest(".mapping-split-panel"), topic.dataset.theme);
        return;
      }
      var progress = event.target.closest(".mapping-progress-item[data-progress-theme]");
      if (progress) {
        choose(progress.closest(".mapping-split-panel"), progress.dataset.progressTheme);
      }
    }, true);
  }
  window.setTimeout(init, 1200);
}());
