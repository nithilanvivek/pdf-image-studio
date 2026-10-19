(() => {
  let originalTitle = document.title;
  let showingAwayTitle = false;

  function updateTitle() {
    if (document.hidden) {
      if (!showingAwayTitle) originalTitle = document.title;
      document.title = "Come Back!";
      showingAwayTitle = true;
    } else if (showingAwayTitle) {
      document.title = originalTitle;
      showingAwayTitle = false;
    }
  }

  document.addEventListener("visibilitychange", updateTitle);
  updateTitle();
})();
