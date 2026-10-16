/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/tema.js
*/
const THEME_STORAGE_KEY = "richi-theme";
const TEMAS = [
    "oscuro",
    "claro",
    "oscuro-puro",
    "claro-puro",
    "tranquilo",
    "tranquilo-oscuro",
    "terminal-verde",
    "terminal-azul",
    "terminal-rojo",
    "terminal-ambar",
];
const TEMA_ATRIBUTO = {
    oscuro: "",
    claro: "light",
    "oscuro-puro": "puro-oscuro",
    "claro-puro": "puro-claro",
    tranquilo: "tranquilo",
    "tranquilo-oscuro": "tranquilo-oscuro",
    "terminal-verde": "terminal-verde",
    "terminal-azul": "terminal-azul",
    "terminal-rojo": "terminal-rojo",
    "terminal-ambar": "terminal-ambar",
};
document.addEventListener("sidebar:loaded", initializeThemeToggle);
document.addEventListener("theme:changed", (event) => {
    updatePngPerson(event.detail.theme);
    updateThemeColor(event.detail.theme);
});
function initializeThemeToggle() {
    const botones = document.querySelectorAll("[data-tema]");
    if (!botones.length) {
        return;
    }
    botones.forEach((boton) => {
        boton.addEventListener("click", () => {
            ponerTema(boton.getAttribute("data-tema"));
        });
    });
    pintarTemaElegido();
}
function ponerTema(tema) {
    if (TEMAS.indexOf(tema) === -1) {
        return;
    }
    const atributo = TEMA_ATRIBUTO[tema];
    if (atributo) {
        document.documentElement.setAttribute("data-theme", atributo);
    } else {
        document.documentElement.removeAttribute("data-theme");
    }
    saveTheme(tema);
    pintarTemaElegido();
    dispatchThemeChanged(tema);
}
function pintarTemaElegido() {
    const ahora = getCurrentTheme();
    document.querySelectorAll("[data-tema]").forEach((boton) => {
        boton.setAttribute(
            "aria-pressed",
            boton.getAttribute("data-tema") === ahora ? "true" : "false"
        );
    });
}
function temaDelSistema() {
    try {
        return window.matchMedia("(prefers-color-scheme: light)").matches
            ? "claro"
            : "oscuro";
    } catch (error) {
        return "oscuro";
    }
}
function olvidarTemaGuardado() {
    try {
        localStorage.removeItem(THEME_STORAGE_KEY);
    } catch (error) {
    }
    const tema = temaDelSistema();
    const atributo = TEMA_ATRIBUTO[tema];
    if (atributo) {
        document.documentElement.setAttribute("data-theme", atributo);
    } else {
        document.documentElement.removeAttribute("data-theme");
    }
    pintarTemaElegido();
    dispatchThemeChanged(tema);
}
function getCurrentTheme() {
    const atributo = document.documentElement.getAttribute("data-theme") || "";
    const encontrado = TEMAS.filter((t) => TEMA_ATRIBUTO[t] === atributo);
    return encontrado.length ? encontrado[0] : "oscuro";
}
function saveTheme(theme) {
    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
    }
}
function dispatchThemeChanged(theme) {
    document.dispatchEvent(
        new CustomEvent("theme:changed", { detail: { theme } })
    );
}
const COLOR_BARRA = {
    oscuro: "#12091c",
    claro: "#f3e1d6",
    "oscuro-puro": "#000000",
    "claro-puro": "#ffffff",
    tranquilo: "#f2efe9",
    "tranquilo-oscuro": "#1b1e22",
    "terminal-verde": "#000000",
    "terminal-azul": "#000000",
    "terminal-rojo": "#000000",
    "terminal-ambar": "#000000",
};
function updateThemeColor(theme) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
        return;
    }
    meta.setAttribute("content", COLOR_BARRA[theme] || COLOR_BARRA.oscuro);
}
function updatePngPerson(theme) {
    const img = document.getElementById("pngperson-img");
    if (!img) {
        return;
    }
    const esClaro =
        theme === "claro" || theme === "claro-puro" || theme === "tranquilo";
    const base = esClaro
        ? "/imagenes/main/pngtuber_white_theme"
        : "/imagenes/main/pngtuber_dark_theme";
    img.srcset = `${base}-412.webp 412w, ${base}-620.webp 620w, ${base}.webp 1161w`;
    img.src = `${base}.webp`;
}
