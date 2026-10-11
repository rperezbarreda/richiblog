/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/paginas/recomendaciones.js
*/
const RECOMENDACIONES_URL = "/datos/mi_rincon/recomendaciones.json";
initializeRecomendaciones();
async function initializeRecomendaciones() {
    const caja = document.querySelector("[data-recomendaciones]");
    if (!caja) {
        return;
    }
    try {
        const respuesta = await window.pedirDatos(RECOMENDACIONES_URL);
        if (!respuesta.ok) {
            throw new Error("La respuesta no fue correcta");
        }
        const datos = await respuesta.json();
        const bloques = (Array.isArray(datos) ? datos : []).filter(
            (bloque) => bloque && (bloque.nombre || "").trim()
        );
        if (bloques.length === 0) {
            caja.innerHTML =
                '<p class="entries-empty">Todavía no hay nada aquí.</p>';
            return;
        }
        caja.innerHTML = bloques.map(bloqueDeRec).join("");
        document.dispatchEvent(new CustomEvent("ventanas:actualizar"));
        document.dispatchEvent(new CustomEvent("filtros:actualizar"));
        engancharFichas(caja);
    } catch (error) {
        caja.innerHTML =
            '<p class="entries-error">No se han podido cargar las recomendaciones ahora mismo.</p>';
    }
}
function bloqueDeRec(bloque) {
    const cosas = Array.isArray(bloque.cosas) ? bloque.cosas : [];
    const dentro =
        cosas.length === 0
            ? '<p class="entries-empty">Todavía no hay nada por aquí.</p>'
            : `<ul class="rec-lista">${cosas.map(fichaDeRec).join("")}</ul>`;
    const clave = escapeRec(claveDeRec(bloque));
    return (
        `<section class="rec-bloque" data-categoria="${clave}">` +
        '<div class="recent-entries-header">' +
        `<h2>${escapeRec(bloque.nombre)}</h2>` +
        '<div class="window-controls window-controls-small" data-window-controls aria-hidden="true"></div>' +
        "</div>" +
        `<div class="rec-bloque-cuerpo">${dentro}</div>` +
        "</section>"
    );
}
function claveDeRec(bloque) {
    const clave = (bloque.clave || "").trim();
    if (clave) {
        return clave;
    }
    return (bloque.nombre || "").trim().replace(/\.[^.]*$/, "");
}
function idiomaDeRec(cosa) {
    const idioma = (cosa.idioma || "").trim();
    if (!/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(idioma)) {
        return "";
    }
    return ` lang="${idioma}"`;
}
function fichaDeRec(cosa) {
    const titulo = escapeRec((cosa.titulo || "").trim() || "Sin título");
    const texto = (cosa.texto || "").trim();
    const idioma = idiomaDeRec(cosa);
    return (
        '<li class="rec-item-caja">' +
        '<details class="rec-item">' +
        '<summary class="rec-cabeza">' +
        portadaDeRec(cosa) +
        '<span class="rec-nombre">' +
        `<span class="rec-titulo"${idioma}>${titulo}${marcaDeRec(cosa)}</span>` +
        metaDeRec(cosa, false) +
        "</span>" +
        '<span class="rec-flecha" aria-hidden="true">▾</span>' +
        "</summary>" +
        '<div class="rec-texto">' +
        `<span class="rec-texto-titulo" aria-hidden="true">${titulo}</span>` +
        metaDeRec(cosa, true) +
        (texto ? `<p>${escapeRec(texto)}</p>` : "") +
        enlaceDeRec(cosa) +
        "</div>" +
        "</details>" +
        "</li>"
    );
}
function portadaDeRec(cosa) {
    const ruta = rutaDeImagenRec(cosa.imagen);
    if (!ruta) {
        const titulo = escapeRec((cosa.titulo || "").trim() || "Sin título");
        return (
            '<span class="rec-portada rec-portada-vacia" aria-hidden="true">' +
            `<span>${titulo}${cosa.imprescindible ? ' <span class="rec-marca">★</span>' : ""}</span>` +
            "</span>"
        );
    }
    const alt = escapeRec((cosa.alt || "").trim());
    return (
        `<img class="rec-portada" src="${escapeRec(ruta)}" alt="${alt}"` +
        ' loading="lazy" decoding="async">'
    );
}
function metaDeRec(cosa, repetido) {
    const trozos = [cosa.autor, cosa.anyo]
        .map((trozo) => (trozo === null || trozo === undefined ? "" : String(trozo).trim()))
        .filter(Boolean);
    if (trozos.length === 0) {
        return "";
    }
    return (
        `<span class="rec-meta"${repetido ? ' aria-hidden="true"' : ""}>` +
        `${escapeRec(trozos.join(" · "))}</span>`
    );
}
function marcaDeRec(cosa) {
    if (!cosa.imprescindible) {
        return "";
    }
    return (
        '<span class="rec-marca">' +
        '<span aria-hidden="true">★</span>' +
        '<span class="visually-hidden"> (imprescindible)</span>' +
        "</span>"
    );
}
function enlaceDeRec(cosa) {
    const ruta = rutaSeguraRec(cosa.enlace);
    if (!ruta) {
        return "";
    }
    const fuera = /^https?:\/\//i.test(ruta);
    const nombre = escapeRec((cosa.enlaceTexto || "").trim() || "más información");
    return (
        `<a class="rec-enlace" href="${escapeRec(ruta)}"` +
        (fuera ? ' target="_blank" rel="noopener noreferrer"' : "") +
        `>${nombre}` +
        (fuera
            ? '<span class="visually-hidden"> (se abre en otra pestaña)</span>'
            : "") +
        ' <span aria-hidden="true">→</span></a>'
    );
}
const REC_GALERIA = window.matchMedia
    ? window.matchMedia("(min-width: 861px)")
    : null;
let recAbierta = null;
function enGaleria() {
    return !REC_GALERIA || REC_GALERIA.matches;
}
function engancharFichas(caja) {
    const fichas = [...caja.querySelectorAll(".rec-item")];
    for (const ficha of fichas) {
        ficha.addEventListener("toggle", () => {
            if (!ficha.open) {
                if (recAbierta === ficha) {
                    recAbierta = null;
                }
                return;
            }
            if (!enGaleria()) {
                return;
            }
            if (recAbierta && recAbierta !== ficha) {
                recAbierta.dataset.fijada = "no";
                recAbierta.open = false;
            }
            recAbierta = ficha;
            colocarCaja(ficha);
        });
        if (window.matchMedia && window.matchMedia("(hover: hover)").matches) {
            ficha.addEventListener("pointerenter", (evento) => {
                if (evento.pointerType === "mouse") {
                    ficha.open = true;
                }
            });
            ficha.addEventListener("pointerleave", (evento) => {
                if (evento.pointerType === "mouse" && ficha.dataset.fijada !== "si") {
                    ficha.open = false;
                }
            });
        }
        const cabeza = ficha.querySelector("summary");
        if (cabeza) {
            cabeza.addEventListener("click", (evento) => {
                if (ficha.open && ficha.dataset.fijada !== "si") {
                    evento.preventDefault();
                    ficha.dataset.fijada = "si";
                    return;
                }
                ficha.dataset.fijada = ficha.open ? "no" : "si";
            });
        }
    }
    document.addEventListener("scroll", recolocarCaja, true);
    window.addEventListener("resize", recolocarCaja, { passive: true });
    document.addEventListener("keydown", (evento) => {
        if (evento.key !== "Escape" || !recAbierta) {
            return;
        }
        const cabeza = recAbierta.querySelector("summary");
        recAbierta.dataset.fijada = "no";
        recAbierta.open = false;
        if (cabeza) {
            cabeza.focus();
        }
    });
    if (REC_GALERIA && REC_GALERIA.addEventListener) {
        REC_GALERIA.addEventListener("change", () => {
            for (const ficha of fichas) {
                ficha.dataset.fijada = "no";
                ficha.open = false;
                const texto = ficha.querySelector(".rec-texto");
                if (texto) {
                    texto.style.left = "";
                    texto.style.top = "";
                }
            }
            recAbierta = null;
        });
    }
}
function recolocarCaja() {
    if (recAbierta && enGaleria()) {
        colocarCaja(recAbierta);
    }
}
function colocarCaja(ficha) {
    const texto = ficha.querySelector(".rec-texto");
    const cabeza = ficha.querySelector("summary");
    if (!texto || !cabeza) {
        return;
    }
    texto.style.left = "0px";
    texto.style.top = "0px";
    const portada = cabeza.getBoundingClientRect();
    const caja = texto.getBoundingClientRect();
    const aire = 12;
    const pegada = 10;
    let izquierda = portada.right + pegada;
    if (izquierda + caja.width > window.innerWidth - aire) {
        izquierda = portada.left - caja.width - pegada;
    }
    if (izquierda < aire) {
        izquierda = Math.max(
            aire,
            Math.min(portada.left, window.innerWidth - caja.width - aire)
        );
    }
    let arriba = portada.top;
    if (arriba + caja.height > window.innerHeight - aire) {
        arriba = window.innerHeight - caja.height - aire;
    }
    if (arriba < aire) {
        arriba = aire;
    }
    texto.style.left = `${Math.round(izquierda)}px`;
    texto.style.top = `${Math.round(arriba)}px`;
}
function escapeRec(texto) {
    return (texto === null || texto === undefined ? "" : texto.toString())
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
function rutaSeguraRec(url) {
    const limpia = (url === null || url === undefined ? "" : url.toString()).trim();
    if (!limpia) {
        return "";
    }
    if (/^\/(?!\/)/.test(limpia) || /^https?:\/\//i.test(limpia)) {
        return limpia;
    }
    return "";
}
function rutaDeImagenRec(url) {
    const limpia = (url === null || url === undefined ? "" : url.toString()).trim();
    return /^\/(?!\/)/.test(limpia) ? limpia : "";
}
