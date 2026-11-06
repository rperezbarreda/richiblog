// =========================================
// TEMA (CUATRO)
// =========================================
// Los botones viven dentro de la ventana de accesibilidad
// (fragmentos/ajustes.html, que va dentro del menú), así que se espera al
// evento "sidebar:loaded" en vez de dar por hecho que ya están. En el
// 404, que no tiene menú, los arranca ajustes.js.
//
// LOS SEIS
//     oscuro           el de siempre: morado y amarillo
//     claro            el de siempre en claro: crema y rojo
//     oscuro-puro      negro y blanco, nada más
//     claro-puro       blanco y negro, nada más
//     terminal-verde   fósforo verde sobre negro
//     terminal-rojo    lo mismo en rojo
//
// Los dos puros son un modo de alto contraste: TODO lo que no es el
// fondo va del mismo blanco (o negro), incluido lo que normalmente es
// amarillo o gris. Se pierde la diferencia entre el texto principal y
// lo secundario, y entre el acento y el texto, y es a propósito: quien
// enciende esto quiere que no haya medias tintas.
//
// Un botón por tema y no unos pocos que alternen: con seis opciones,
// alternar obliga a adivinar a dónde te lleva cada pulsación. Y cada
// botón va pintado con los colores de SU tema, para saber lo que te vas
// a encontrar antes de pulsarlo.
//
// "oscuro" es el de fábrica y NO se guarda ni se escribe en el <html>:
// se guarda quitando el atributo, igual que el resto de ajustes.

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

// Lo que se escribe en data-theme para cada uno. El de fábrica no
// escribe nada. "light" se queda con su nombre de siempre para no
// romper lo guardado de quien ya había elegido el tema claro antes de
// que hubiera cuatro.
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

// =========================================
// TEMA ACTUAL
// =========================================

// Se lee del <html>, que es la única verdad: da igual si lo puso el
// trocito del <head> al arrancar o alguien aquí hace un momento.
// EL TEMA QUE TOCA CUANDO NADIE HA ELEGIDO. Lo decide el aparato: si
// tiene el modo claro puesto, la web arranca en claro. Antes arrancaba
// siempre en oscuro, y quien tiene el móvil en claro porque ve mejor así
// se encontraba una web oscura sin haber pedido nada.
//
// Esto NO se guarda: mientras no se toque el mando del tema, la web
// sigue a lo que diga el sistema, y si un día cambia, cambia con él.
// El trocito que va en el <head> de cada página hace esto mismo antes
// del primer pintado; aquí está para el botón de "dejarlo todo como
// estaba", que tiene que saber a dónde volver.
function temaDelSistema() {
    try {
        return window.matchMedia("(prefers-color-scheme: light)").matches
            ? "claro"
            : "oscuro";
    } catch (error) {
        return "oscuro";
    }
}

// Borra lo elegido y vuelve a dejar que mande el aparato. Lo usa el
// botón de "dejarlo todo como estaba" de la ventana de accesibilidad.
function olvidarTemaGuardado() {
    try {
        localStorage.removeItem(THEME_STORAGE_KEY);
    } catch (error) {
        // Ver saveTheme().
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

// =========================================
// GUARDAR PREFERENCIA
// =========================================

// AQUÍ EL OSCURO SÍ SE GUARDA, y es la única excepción a la regla del
// resto de ajustes (donde lo de fábrica se borra en vez de guardarse).
//
// El motivo es que desde que la web hace caso al modo claro u oscuro
// del sistema, "no hay nada guardado" ya no quiere decir "quiere el
// oscuro": quiere decir "todavía no ha elegido, que decida su aparato".
// Borrando la clave al elegir el oscuro, quien tuviera el sistema en
// claro y pulsara "oscuro" se encontraba la web en claro otra vez al
// recargar, con su elección por el suelo.
//
// Así que: clave vacía = manda el sistema; clave puesta = manda quien
// la puso, sea el tema que sea. Lo de borrar se lo queda el botón de
// "dejarlo todo como estaba", que es donde tiene sentido.
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
// Cualquier elemento sensible al tema (no solo los botones) puede
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
// pone cada página en su <head>; aquí solo se cambia al elegir otro
// tema, para que la franja no se quede del color del anterior.
//
// Son los mismos colores que --purple en estilos/base.css: si alguna
// vez cambias un fondo allí, cámbialo aquí y en el <head> de las
// páginas (la plantilla de herramientas ya los lleva).

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

// =========================================
// IMAGEN DEL PNGTUBER (portada)
// =========================================

// El dibujo está en tres tamaños por tema (412, 620 y 1161 de ancho);
// el navegador elige el que le toca con el srcset y el sizes que lleva
// puestos en index.html. Al cambiar de tema hay que cambiar los tres,
// no solo el src: con el srcset viejo el navegador se quedaba con la
// imagen del otro tema, porque el srcset manda sobre el src.
//
// Solo hay dos dibujos, el claro y el oscuro, así que los temas puros
// se reparten el que les toca por el fondo que tienen.
function updatePngPerson(theme) {
    const img = document.getElementById("pngperson-img");
    if (!img) {
        return;
    }
    // El tranquilo también lleva el dibujo claro: su fondo es papel
    // roto, y encima el dibujo de fondo oscuro se recorta como una
    // pegatina mal puesta.
    const esClaro =
        theme === "claro" || theme === "claro-puro" || theme === "tranquilo";
    const base = esClaro
        ? "/imagenes/main/pngtuber_white_theme"
        : "/imagenes/main/pngtuber_dark_theme";
    img.srcset = `${base}-412.webp 412w, ${base}-620.webp 620w, ${base}.webp 1161w`;
    img.src = `${base}.webp`;
}
