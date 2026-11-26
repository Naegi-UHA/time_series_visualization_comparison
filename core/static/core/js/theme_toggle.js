(function () {
    const themeToggle = document.getElementById("theme-toggle");
    const body = document.body;

    themeToggle.addEventListener("click", () => {
        const isLight = body.dataset.theme !== "light";
        body.dataset.theme = isLight ? "light" : "dark";
        themeToggle.textContent = isLight ? "☾" : "☀";
        themeToggle.setAttribute("aria-pressed", String(isLight));
        themeToggle.setAttribute(
            "aria-label",
            isLight ? "Switch to dark mode" : "Switch to light mode"
        );
        themeToggle.title = isLight ? "Switch to dark mode" : "Switch to light mode";
    });
})();
