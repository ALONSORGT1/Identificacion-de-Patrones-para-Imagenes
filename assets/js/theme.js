(() => {
  const key = "nexo-theme";
  const root = document.documentElement;
  function applyTheme(theme) {
    const dark = theme === "dark";
    root.dataset.theme = dark ? "dark" : "light";
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", dark ? "#151e1a" : "#f6f7f3");
    const button = document.getElementById("themeToggle");
    if (button) {
      const label = dark ? "Activar modo claro" : "Activar modo oscuro";
      button.setAttribute("aria-label", label);
      button.title = label;
    }
  }
  // Apply before the stylesheet loads to avoid a light flash on reload.
  let saved = "light";
  try {
    saved = localStorage.getItem(key) || "light";
  } catch {
    /* Storage may be disabled. */
  }
  applyTheme(saved);
  document.addEventListener("DOMContentLoaded", () => {
    applyTheme(root.dataset.theme);
    document.getElementById("themeToggle")?.addEventListener("click", () => {
      const theme = root.dataset.theme === "dark" ? "light" : "dark";
      applyTheme(theme);
      try {
        localStorage.setItem(key, theme);
      } catch {
        /* Switching still works without persistence. */
      }
    });
  });
  window.addEventListener("storage", (event) => {
    if (event.key === key || event.key === null)
      applyTheme(event.newValue || "light");
  });
})();
