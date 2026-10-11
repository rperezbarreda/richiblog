/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/componentes/teclado-scroll.js
*/
const TECLADO_SALTO_LINEA = 0.12;
const TECLADO_SALTO_PAGINA = 0.9;
const TECLADO_ESCRIBIENDO = ["INPUT", "TEXTAREA", "SELECT"];
const TECLADO_PULSABLES = ["BUTTON", "A", "SUMMARY", "INPUT", "TEXTAREA", "SELECT", "OPTION"];
const TECLADO_CON_PAPEL = ["UL", "OL", "DL", "TABLE"];
const TECLADO_ENFOCABLE =
    'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';
let tecladoMarcada = null;
initializeTecladoScroll();
function initializeTecladoScroll() {
    if (!document.querySelector("main")) {
        return;
    }
    const marcarTodo = () => {
        marcarRegion();
        marcarCajas();
    };
    marcarTodo();
    window.setTimeout(marcarTodo, 900);
    window.addEventListener("resize", marcarTodo, { passive: true });
    window.addEventListener("load", marcarTodo);
    document.addEventListener("keydown", manejarTecla);
}
function buscarPagina() {
    const seccion = document.querySelector("main > section");
    if (seccion && puedeDesplazarse(seccion)) {
        return seccion;
    }
    const principal = document.querySelector("main");
    if (!principal) {
        return null;
    }
    if (puedeDesplazarse(principal)) {
        return principal;
    }
    let mejor = null;
    principal.querySelectorAll("*").forEach((nodo) => {
        if (!puedeDesplazarse(nodo)) {
            return;
        }
        if (!mejor || nodo.clientHeight > mejor.clientHeight) {
            mejor = nodo;
        }
    });
    return mejor;
}
function marcarRegion() {
    const pagina = buscarPagina();
    if (tecladoMarcada && tecladoMarcada !== pagina) {
        desmarcar(tecladoMarcada);
        tecladoMarcada = null;
    }
    if (!pagina) {
        return;
    }
    if (pagina.getAttribute("role") === "region" && pagina !== tecladoMarcada) {
        return;
    }
    marcar(pagina, "Contenido de la página, con scroll");
    tecladoMarcada = pagina;
}
function marcar(zona, nombre) {
    if (zona.getAttribute("tabindex") === null) {
        zona.setAttribute("tabindex", "0");
    }
    if (TECLADO_CON_PAPEL.indexOf(zona.tagName) === -1 && !zona.hasAttribute("role")) {
        zona.setAttribute("role", "region");
        zona.setAttribute("data-teclado-rol", "");
    }
    if (!zona.hasAttribute("aria-label") && !zona.hasAttribute("aria-labelledby")) {
        zona.setAttribute("aria-label", nombre);
        zona.setAttribute("data-teclado-nombre", "");
    }
    zona.setAttribute("data-teclado-marca", "");
}
function desmarcar(zona) {
    if (zona.getAttribute("tabindex") === "0") {
        zona.removeAttribute("tabindex");
    }
    if (zona.hasAttribute("data-teclado-rol")) {
        zona.removeAttribute("role");
    }
    if (zona.hasAttribute("data-teclado-nombre")) {
        zona.removeAttribute("aria-label");
    }
    zona.removeAttribute("data-teclado-rol");
    zona.removeAttribute("data-teclado-nombre");
    zona.removeAttribute("data-teclado-marca");
}
function marcarCajas() {
    const principal = document.querySelector("main");
    if (!principal) {
        return;
    }
    principal.querySelectorAll("[data-teclado-marca]").forEach((zona) => {
        if (zona !== tecladoMarcada && !puedeDesplazarse(zona)) {
            desmarcar(zona);
        }
    });
    principal.querySelectorAll("*").forEach((zona) => {
        if (zona === tecladoMarcada || zona.hasAttribute("data-teclado-marca")) {
            return;
        }
        if (!puedeDesplazarse(zona) && !seSaleDeLado(zona)) {
            return;
        }
        if (zona.getAttribute("tabindex") !== null || zona.querySelector(TECLADO_ENFOCABLE)) {
            return;
        }
        marcar(zona, nombreDeCaja(zona));
    });
}
function nombreDeCaja(zona) {
    if (zona.querySelector("table") || zona.tagName === "TABLE") {
        return "Tabla, con scroll";
    }
    const ventana = zona.closest(".recent-entries, .character-card");
    const titulo = ventana && ventana.querySelector("h2, h3");
    const texto = titulo ? titulo.textContent.trim() : "";
    return texto ? texto + ", con scroll" : "Zona con scroll";
}
function seSaleDeLado(elemento) {
    if (!elemento || elemento.scrollWidth - elemento.clientWidth <= 1) {
        return false;
    }
    const como = window.getComputedStyle(elemento).overflowX;
    return como === "auto" || como === "scroll";
}
function manejarTecla(evento) {
    if (evento.defaultPrevented || evento.ctrlKey || evento.metaKey || evento.altKey) {
        return;
    }
    const destino = evento.target;
    const etiqueta = destino && destino.tagName ? destino.tagName : "";
    if (TECLADO_ESCRIBIENDO.indexOf(etiqueta) !== -1) {
        return;
    }
    if (destino && destino.isContentEditable) {
        return;
    }
    const visor = document.querySelector(".lightbox-overlay:not([hidden])");
    if (visor) {
        return;
    }
    const zona = buscarZona(destino);
    if (!zona) {
        return;
    }
    const alto = zona.clientHeight;
    let salto = null;
    switch (evento.key) {
        case "ArrowDown":
            salto = Math.max(40, Math.round(alto * TECLADO_SALTO_LINEA));
            break;
        case "ArrowUp":
            salto = -Math.max(40, Math.round(alto * TECLADO_SALTO_LINEA));
            break;
        case "PageDown":
            salto = Math.round(alto * TECLADO_SALTO_PAGINA);
            break;
        case "PageUp":
            salto = -Math.round(alto * TECLADO_SALTO_PAGINA);
            break;
        case " ":
        case "Spacebar":
            if (TECLADO_PULSABLES.indexOf(etiqueta) !== -1) {
                return;
            }
            if (destino && destino.getAttribute && destino.getAttribute("role") === "button") {
                return;
            }
            salto = Math.round(alto * TECLADO_SALTO_PAGINA) * (evento.shiftKey ? -1 : 1);
            break;
        case "Home":
            evento.preventDefault();
            mover(zona, -zona.scrollTop);
            return;
        case "End":
            evento.preventDefault();
            mover(zona, zona.scrollHeight - zona.clientHeight - zona.scrollTop);
            return;
        default:
            return;
    }
    evento.preventDefault();
    mover(zona, salto);
}
function buscarZona(destino) {
    let nodo = destino && destino.nodeType === 1 ? destino : null;
    while (nodo && nodo !== document.body) {
        if (puedeDesplazarse(nodo)) {
            return nodo;
        }
        nodo = nodo.parentElement;
    }
    return buscarPagina();
}
function puedeDesplazarse(elemento) {
    if (!elemento || elemento.scrollHeight - elemento.clientHeight <= 4) {
        return false;
    }
    const como = window.getComputedStyle(elemento).overflowY;
    return como === "auto" || como === "scroll";
}
function mover(zona, salto) {
    if (salto === 0) {
        return;
    }
    const sinAnimacion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    zona.scrollBy({ top: salto, behavior: sinAnimacion ? "auto" : "smooth" });
}
