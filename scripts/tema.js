// =========================================
// TEMA (CLARO / OSCURO)
// =========================================
// El botón vive dentro del sidebar, que se carga de forma
// dinámica (ver component_barra-lateral.js), así que esperamos al
// evento "sidebar:loaded" en vez de asumir que ya existe.

const THEME_STORAGE_KEY = "richi-theme";

document.addEventListener("sidebar:loaded", initializeThemeToggle);
document.addEventListener("theme:changed", (event) => {
    updatePngPerson(event.detail.theme);
    updateThemeColor(event.detail.theme);
});

function initializeThemeToggle() {
    const button = document.getElementById("theme-toggle");
    if (!button) {
        return;
    }
    const icon = button.querySelector(".theme-toggle-icon");
    const text = button.querySelector(".theme-toggle-text");

    applyThemeState(button, icon, text, getCurrentTheme());

    button.addEventListener("click", () => {
        const next = getCurrentTheme() === "light" ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", next);
        applyThemeState(button, icon, text, next);
        saveTheme(next);
        dispatchThemeChanged(next);
    });
}

// =========================================
// TEMA ACTUAL
// =========================================

function getCurrentTheme() {
    return document.documentElement.getAttribute("data-theme") === "light"
        ? "light"
        : "dark";
}

// =========================================
// APLICAR ESTADO AL BOTÓN
// =========================================

function applyThemeState(button, icon, text, theme) {
    const isLight = theme === "light";
    button.setAttribute("aria-pressed", isLight ? "true" : "false");
    button.setAttribute(
        "aria-label",
        isLight ? "Cambiar a modo nocturno" : "Cambiar a modo iluminado"
    );
    if (icon) {
        icon.textContent = isLight ? "💡" : "🌙";
    }
    if (text) {
        text.textContent = isLight ? "MODO CLARO" : "MODO OSCURO";
    }
}

// =========================================
// GUARDAR PREFERENCIA
// =========================================

function saveTheme(theme) {
    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
        // localStorage puede fallar (modo privado, cuota, etc.)
        // No es crítico: el tema seguirá aplicado en esta página.
    }
}

// =========================================
// AVISAR AL RESTO DE LA PÁGINA DEL CAMBIO
// =========================================
// Cualquier elemento sensible al tema (no solo el botón) puede
// escuchar "theme:changed" en vez de depender de este fichero.

function dispatchThemeChanged(theme) {
    document.dispatchEvent(
        new CustomEvent("theme:changed", { detail: { theme } })
    );
}

// =========================================
// COLOR DE LA BARRA DEL NAVEGADOR
// =========================================
// En el móvil, la franja de arriba (y la de abajo en Android) se pinta
// con el color de <meta name="theme-color">. El valor de arranque lo
// pone cada página en su <head>; aquí solo se cambia al pulsar el
// botón, para que la franja no se quede del color del tema anterior.
//
// Son los mismos colores que --purple en estilos/base.css: si alguna
// vez cambias el fondo allí, cámbialos aquí y en el <head> de las
// páginas (la plantilla de herramientas ya los lleva).

const COLOR_BARRA = { dark: "#12091c", light: "#f2ded2" };

function updateThemeColor(theme) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
        return;
    }
    meta.setAttribute("content", COLOR_BARRA[theme] || COLOR_BARRA.dark);
}

// =========================================
// IMAGEN DEL PNGTUBER (portada)
// =========================================

// El dibujo está en tres tamaños por tema (412, 620 y 1161 de ancho);
// el navegador elige el que le toca con el srcset y el sizes que lleva
// puestos en index.html. Al cambiar de tema hay que cambiar los tres,
// no solo el src: con el srcset viejo el navegador se quedaba con la
// imagen del otro tema, porque el srcset manda sobre el src.
function updatePngPerson(theme) {
    const img = document.getElementById("pngperson-img");
    if (!img) {
        return;
    }
    const base =
        theme === "light"
            ? "/imagenes/main/pngtuber_white_theme"
            : "/imagenes/main/pngtuber_dark_theme";
    img.srcset = `${base}-412.webp 412w, ${base}-620.webp 620w, ${base}.webp 1161w`;
    img.src = `${base}.webp`;
}
