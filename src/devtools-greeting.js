(() => {
  const message = "Hello, software hackers/developers. This console is built for my proteges!";

  // Leave a greeting for visitors exploring the Elements panel.
  document.body.prepend(document.createComment(` ${message} `));

  console.log(
    "%cHello, software hackers/developers.\n%cThis console is built for my proteges!",
    "color: #56d4a0; background: #15151d; padding: 8px 12px; font: bold 18px monospace;",
    "color: #e8e6df; background: #15151d; padding: 8px 12px; font: 14px monospace;"
  );
})();
