/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/componentes/recortar-titulos.js
*/
const RECORTE_DONDE = ".entries-projects-row .entry-preview-title";
const RECORTE_REGLA = (function regla() {
    try {
        return document.createElement("canvas").getContext("2d");
    } catch (error) {
        return null;
    }
})();
const RECORTE_PUNTOS = "…";
const RECORTE_SOBRAS = /[\s,.;:—–-]+$/;
window.recortarTitulos = function (raiz) {
    const donde = raiz && raiz.querySelectorAll ? raiz : document;
    donde.querySelectorAll(RECORTE_DONDE).forEach(recortarUnTitulo);
};
function recortarUnTitulo(titulo) {
    const entero = enteroDeRecorte(titulo);
    if (!entero) {
        return;
    }
    const hueco = titulo.clientWidth - flechaDeRecorte(titulo);
    if (hueco < 20) {
        return;
    }
    const fuente = fuenteDeRecorte(titulo);
    let visible = recorteQueCabe(entero, hueco, fuente);
    pintarRecorte(titulo, visible, entero);
    let vueltas = 0;
    while (anchoPintadoDeRecorte(titulo) > hueco + 1 && vueltas < 8) {
        vueltas += 1;
        visible = unaPalabraMenosDeRecorte(visible === null ? entero : visible);
        if (!visible) {
            break;
        }
        pintarRecorte(titulo, visible, entero);
    }
}
function anchoPintadoDeRecorte(titulo) {
    const seVe = titulo.firstElementChild;
    if (!seVe) {
        return 0;
    }
    return seVe.getBoundingClientRect().width;
}
function flechaDeRecorte(titulo) {
    const pinta = window.getComputedStyle(titulo, "::after");
    if (!pinta || pinta.content === "none" || pinta.content === "normal") {
        return 0;
    }
    return (parseFloat(pinta.width) || 0) + (parseFloat(pinta.marginLeft) || 0);
}
function enteroDeRecorte(titulo) {
    if (titulo.dataset.recorteEntero === undefined) {
        titulo.dataset.recorteEntero = (titulo.textContent || "").trim();
    }
    return titulo.dataset.recorteEntero;
}
function fuenteDeRecorte(titulo) {
    const como = window.getComputedStyle(titulo);
    return (
        como.fontStyle +
        " " +
        como.fontWeight +
        " " +
        como.fontSize +
        " " +
        como.fontFamily
    );
}
function anchoDeRecorte(texto, fuente) {
    if (!RECORTE_REGLA) {
        return 0;
    }
    RECORTE_REGLA.font = fuente;
    return RECORTE_REGLA.measureText(texto).width;
}
function recorteQueCabe(entero, hueco, fuente) {
    if (!RECORTE_REGLA || anchoDeRecorte(entero, fuente) <= hueco) {
        return null;
    }
    for (let i = entero.length - 1; i > 0; i--) {
        if (entero[i] !== " ") {
            continue;
        }
        const trozo = entero.slice(0, i).replace(RECORTE_SOBRAS, "");
        if (trozo && anchoDeRecorte(trozo + RECORTE_PUNTOS, fuente) <= hueco) {
            return trozo + RECORTE_PUNTOS;
        }
    }
    for (let corte = entero.length - 1; corte > 0; corte--) {
        const trozo = entero.slice(0, corte);
        if (anchoDeRecorte(trozo + RECORTE_PUNTOS, fuente) <= hueco) {
            return trozo + RECORTE_PUNTOS;
        }
    }
    return RECORTE_PUNTOS;
}
function unaPalabraMenosDeRecorte(visible) {
    const sinPuntos = visible.replace(/…$/, "");
    const espacio = sinPuntos.lastIndexOf(" ");
    if (espacio <= 0) {
        const corta = sinPuntos.slice(0, -1);
        return corta ? corta + RECORTE_PUNTOS : "";
    }
    return sinPuntos.slice(0, espacio).replace(RECORTE_SOBRAS, "") + RECORTE_PUNTOS;
}
function pintarRecorte(titulo, visible, entero) {
    const puesto = visible === null ? "" : visible;
    if (titulo.dataset.recortePuesto === puesto) {
        return;
    }
    titulo.dataset.recortePuesto = puesto;
    titulo.textContent = "";
    const seVe = document.createElement("span");
    seVe.textContent = visible === null ? entero : visible;
    titulo.appendChild(seVe);
    if (visible === null) {
        return;
    }
    seVe.setAttribute("aria-hidden", "true");
    const seOye = document.createElement("span");
    seOye.className = "visually-hidden";
    seOye.textContent = entero;
    titulo.appendChild(seOye);
}
let recorteEspera = null;
function repasarRecortes() {
    window.clearTimeout(recorteEspera);
    recorteEspera = window.setTimeout(() => window.recortarTitulos(), 120);
}
window.addEventListener("resize", repasarRecortes);
document.addEventListener("ajustes:actualizar", repasarRecortes);
if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => window.recortarTitulos());
}
if (typeof MutationObserver === "function") {
    const fila = document.querySelector(".entries-projects-row");
    if (fila) {
        let pendienteRecorte = false;
        const vigia = new MutationObserver(() => {
            if (pendienteRecorte) {
                return;
            }
            pendienteRecorte = true;
            window.requestAnimationFrame(() => {
                pendienteRecorte = false;
                window.recortarTitulos(fila);
            });
        });
        vigia.observe(fila, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["class"],
        });
    }
}
