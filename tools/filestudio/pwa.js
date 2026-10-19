(() => {
  const button = document.querySelector("[data-install]");
  const dialog = document.querySelector("[data-install-dialog]");
  const confirm = document.querySelector("[data-confirm-install]");
  const message = document.querySelector("[data-install-message]");
  const dedicated = ["files.nithi.land", "files.localhost"].includes(location.hostname);
  if (document.querySelector('meta[name="pdf-studio-runtime"][content="python"]')) {
    button.hidden = true;
    return;
  }
  let installPrompt;
  let prompting = false;
  let knownInstalled = false;
  const display = matchMedia("(display-mode: standalone)");
  const installed = () => knownInstalled || display.matches || navigator.standalone === true;
  const render = () => {
    button.hidden = installed();
    button.disabled = prompting;
    confirm.hidden = !installPrompt || installed();
    confirm.disabled = prompting;
    if (installed() && dialog.open) dialog.close();
  };
  render();
  display.addEventListener("change", render);
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    if (installed()) return;
    installPrompt = event;
    message.textContent = "Your browser can install this app. Choose Install app to continue.";
    render();
  });
  window.addEventListener("appinstalled", () => {
    knownInstalled = true;
    installPrompt = null;
    render();
  });
  // This API is optional. An empty result is not proof that an app is absent.
  if (dedicated && navigator.getInstalledRelatedApps) {
    try {
      navigator.getInstalledRelatedApps().then(apps => {
        knownInstalled ||= apps.some(app => app.platform === "webapp" &&
          (app.id === `${location.origin}/` || app.url === new URL("/tools/filestudio/manifest.webmanifest", location.origin).href));
        render();
      }).catch(() => {});
    } catch { /* Standalone/appinstalled and beforeinstallprompt remain available. */ }
  }
  async function requestInstall() {
    if (installed() || prompting) return;
    if (!installPrompt) {
      message.textContent = "Use your browser’s install menu below if a native install button is not available yet.";
      if (!dialog.open) dialog.showModal();
      return;
    }
    const prompt = installPrompt;
    installPrompt = null;
    prompting = true;
    render();
    try {
      // Call synchronously from the click, before any await: browsers require activation.
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") knownInstalled = true;
    } catch {
      message.textContent = "Use the browser’s install menu to finish installing this app.";
      if (!dialog.open) dialog.showModal();
    } finally {
      prompting = false;
      render();
    }
  }
  button.addEventListener("click", requestInstall);
  confirm.addEventListener("click", requestInstall);
  const url = new URL(location.href);
  if (url.searchParams.get("install") === "1") {
    const showInstall = () => {
      if (!installed() && !dialog.open) { dialog.showModal(); render(); }
    };
    if (document.readyState === "complete") showInstall();
    else window.addEventListener("load", showInstall, { once: true });
    url.searchParams.delete("install");
    history.replaceState(history.state, "", url);
  }
  if ("serviceWorker" in navigator && isSecureContext) {
    navigator.serviceWorker.register("/tools/filestudio/service-worker.js", {
      scope: dedicated ? "/" : "/tools/filestudio/", updateViaCache: "none",
    }).catch(() => {
      const note = document.querySelector("[data-offline-status]");
      if (note) note.textContent = "Offline setup unavailable · online tools still work";
    });
    navigator.serviceWorker.addEventListener("message", event => {
      if (event.data?.type === "STUDIO_OFFLINE_READY") {
        const note = document.querySelector("[data-offline-status]");
        if (note) note.textContent = "Ready for offline browser processing";
      } else if (event.data?.type === "STUDIO_MOVED" && ["nithi.land", "www.nithi.land"].includes(location.hostname)) {
        location.replace("https://files.nithi.land/" + location.search + location.hash);
      }
    });
  }
})();
