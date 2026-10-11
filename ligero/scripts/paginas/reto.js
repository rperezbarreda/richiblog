/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/paginas/reto.js
*/
const RETO_LISTADO_URL = "/datos/mis_movidas/mis-movidas.json";
initializeReto();
async function initializeReto() {
    const rejilla = document.querySelector("[data-reto-dias]");
    if (!rejilla) {
        return;
    }
    const datos = (rejilla.getAttribute("data-reto-datos") || "").trim();
    if (!datos) {
        return;
    }
    let reto = null;
    let publicados = {};
    try {
        const respuesta = await window.pedirDatos(datos);
        if (!respuesta.ok) {
            throw new Error("La respuesta no fue correcta");
        }
        reto = await respuesta.json();
        publicados = await leerPublicados((reto.coleccion || "").trim());
    } catch (error) {
        rejilla.innerHTML =
            '<li class="entries-error">No se ha podido cargar el reto ahora mismo.</li>';
        return;
    }
    const dias = (Array.isArray(reto.dias) ? reto.dias : []).map((dia) => {
        const publicado = publicados[sinExtension(dia && dia.url)];
        return publicado
            ? Object.assign({}, dia, { titulo: publicado.title || dia.titulo, hecho: true })
            : Object.assign({}, dia, { hecho: false });
    });
    const hechos = dias.filter((dia) => dia.hecho);
    pintarRejilla(rejilla, dias);
    pintarAvance(hechos.length, dias.length);
    pintarCabecera(reto);
}
async function leerPublicados(coleccion) {
    const respuesta = await window.pedirDatos(RETO_LISTADO_URL);
    if (!respuesta.ok) {
        throw new Error("La respuesta no fue correcta");
    }
    const items = await respuesta.json();
    const mapa = {};
    (Array.isArray(items) ? items : []).forEach((item) => {
        if (coleccion && (item.collection || "").trim() === coleccion) {
            mapa[sinExtension(item.url)] = item;
        }
    });
    return mapa;
}
function sinExtension(ruta) {
    return (ruta || "").trim().replace(/\.html$/, "").replace(/\/+$/, "");
}
function pintarRejilla(rejilla, dias) {
    if (!dias.length) {
        rejilla.innerHTML =
            '<li class="entries-empty">Todavía no hay días preparados en este reto.</li>';
        return;
    }
    rejilla.innerHTML = dias.map(casillaDia).join("");
}
function casillaDia(dia) {
    const numero = Number(dia.dia) || 0;
    const dosDigitos = numero < 10 ? "0" + numero : String(numero);
    const palabra = (dia.palabra || "").trim();
    const titulo = (dia.titulo || "").trim();
    const hecho = !!dia.hecho;
    const dentro =
        `<span class="reto-dia-num" aria-hidden="true">${escaparHtmlReto(dosDigitos)}</span>` +
        `<span class="reto-dia-palabra">${escaparHtmlReto(palabra || "—")}</span>` +
        (hecho && titulo
            ? `<span class="reto-dia-titulo">${escaparHtmlReto(titulo)}</span>`
            : "");
    const nombre = hecho
        ? `Día ${numero}${palabra ? ", palabra: " + palabra : ""}${titulo ? ". " + titulo : ""}`
        : `Día ${numero}${palabra ? ", palabra: " + palabra : ""}. Todavía sin escribir`;
    if (!hecho) {
        return (
            '<li class="reto-dia-casilla">' +
            `<span class="reto-dia is-pendiente" aria-label="${escaparHtmlReto(nombre)}">` +
            dentro +
            "</span></li>"
        );
    }
    return (
        '<li class="reto-dia-casilla">' +
        `<a class="reto-dia is-hecho" href="${escaparHtmlReto(rutaSeguraReto(dia.url))}"` +
        ` aria-label="${escaparHtmlReto(nombre)}">` +
        dentro +
        "</a></li>"
    );
}
function pintarAvance(hechos, total) {
    const texto = document.querySelector("[data-reto-avance]");
    if (texto) {
        texto.textContent =
            hechos === 1
                ? `1 día escrito de ${total}`
                : `${hechos} días escritos de ${total}`;
    }
    const barra = document.querySelector("[data-reto-barra]");
    if (barra) {
        const parte = total ? Math.round((hechos / total) * 100) : 0;
        barra.style.setProperty("--avance", parte + "%");
    }
}
function pintarCabecera(reto) {
    const intro = document.querySelector("[data-reto-intro]");
    if (intro && (reto.intro || "").trim()) {
        intro.textContent = reto.intro.trim();
    }
    const origen = document.querySelector("[data-reto-origen]");
    if (origen && (reto.origen || "").trim()) {
        origen.setAttribute("href", rutaSeguraReto(reto.origen));
        origen.hidden = false;
    }
    const quien = document.querySelector("[data-reto-propone]");
    if (quien && (reto.propone || "").trim()) {
        quien.textContent = reto.propone.trim();
    }
    const etiqueta = document.querySelector("[data-reto-hashtag]");
    if (etiqueta && (reto.hashtag || "").trim()) {
        etiqueta.textContent = reto.hashtag.trim();
    }
}
function escaparHtmlReto(texto) {
    return (texto === null || texto === undefined ? "" : texto.toString())
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
function rutaSeguraReto(url) {
    const limpia = (url || "").trim();
    if (/^\/(?!\/)/.test(limpia) || /^(https?:\/\/|mailto:|#)/i.test(limpia)) {
        return limpia;
    }
    return "#";
}
