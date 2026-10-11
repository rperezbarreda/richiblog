/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/paginas/rol.js
*/
const ROL_URL = "/datos/mis_movidas/rol.json";
initializeRol();
async function initializeRol() {
    const rejilla = document.querySelector("[data-rol-grid]");
    if (!rejilla) {
        return;
    }
    try {
        const respuesta = await window.pedirDatos(ROL_URL);
        if (!respuesta.ok) {
            throw new Error("La respuesta no fue correcta");
        }
        const fichas = await respuesta.json();
        const ordenadas = (Array.isArray(fichas) ? fichas : [])
            .slice()
            .sort((a, b) => fechaRol(b.date) - fechaRol(a.date));
        if (ordenadas.length === 0) {
            pintar(rejilla, '<p class="entries-empty" data-rol-estado>Todavía no hay nada publicado por aquí.</p>');
        } else {
            pintar(rejilla, ordenadas.map(tarjetaRol).join(""));
        }
    } catch (error) {
        pintar(
            rejilla,
            '<p class="entries-error" data-rol-estado>No se ha podido cargar el portfolio ahora mismo.</p>'
        );
    }
    document.dispatchEvent(new CustomEvent("filtros:actualizar"));
}
function pintar(rejilla, html) {
    rejilla
        .querySelectorAll(".portfolio-card, [data-rol-estado]")
        .forEach((nodo) => nodo.remove());
    const vacio = rejilla.querySelector("[data-filtros-vacio]");
    if (vacio) {
        vacio.insertAdjacentHTML("beforebegin", html);
    } else {
        rejilla.insertAdjacentHTML("beforeend", html);
    }
}
function tarjetaRol(ficha) {
    const titulo = escaparHtml(ficha.title || "Sin título");
    const subcategoria = escaparHtml((ficha.subcategory || "").trim());
    const fecha = escaparHtml(ficha.date || "");
    const sistema = (ficha.system || "").trim();
    const descripcion = (ficha.description || "").trim();
    const botones = [
        boton(ficha.kofi, "Ver en Ko-fi →", titulo, ""),
        boton(ficha.drive, "Descargar gratis ↓", titulo, " portfolio-card-btn-secondary"),
    ]
        .filter(Boolean)
        .join("");
    return (
        `<div class="portfolio-card" data-categoria="${subcategoria}" data-fecha="${fecha}">` +
        imagen(ficha, titulo) +
        '<div class="portfolio-card-info">' +
        `<h2 class="portfolio-card-title">${titulo}</h2>` +
        (sistema ? `<p class="portfolio-card-system">${sistemaDeRol(sistema)}</p>` : "") +
        (descripcion
            ? `<p class="portfolio-card-desc">${escaparHtml(descripcion)}</p>`
            : "") +
        (botones ? `<div class="portfolio-card-actions">${botones}</div>` : "") +
        "</div>" +
        "</div>"
    );
}
function imagen(ficha, titulo) {
    const ruta = (ficha.image || "").trim();
    if (!ruta) {
        return "";
    }
    const alt = escaparHtml((ficha.alt || "").trim() || `Portada de ${ficha.title || ""}`);
    return (
        `<img class="portfolio-card-photo" src="${escaparHtml(rutaSegura(ruta))}"` +
        ` alt="${alt}" loading="lazy">`
    );
}
function boton(enlace, texto, tituloEscapado, claseExtra) {
    const url = (enlace || "").trim();
    if (!url) {
        return "";
    }
    return (
        `<a class="portfolio-card-btn${claseExtra}" href="${escaparHtml(rutaSegura(url))}"` +
        ' target="_blank" rel="noopener noreferrer">' +
        texto +
        `<span class="visually-hidden"> — ${tituloEscapado} (se abre en otra pestaña)</span>` +
        "</a>"
    );
}
function fechaRol(cruda) {
    const partes = (cruda || "").split("-");
    if (partes.length !== 3) {
        return new Date(NaN);
    }
    const [dia, mes, anyo] = partes.map(Number);
    return new Date(anyo, mes - 1, dia);
}
function escaparHtml(texto) {
    return (texto === null || texto === undefined ? "" : texto.toString())
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
function rutaSegura(url) {
    const limpia = (url || "").trim();
    if (/^\/(?!\/)/.test(limpia) || /^(https?:\/\/|mailto:|#)/i.test(limpia)) {
        return limpia;
    }
    return "#";
}
const ROL_SIGLAS = {
    DND: "Dungeons &amp; Dragons",
    "D&D": "Dungeons &amp; Dragons",
    PBTA: "Powered by the Apocalypse",
    FATE: "Fate",
    COC: "Call of Cthulhu",
    CDR: "La Call de Rol",
};
function sistemaDeRol(sistema) {
    const limpio = escaparHtml(sistema);
    const primera = sistema.trim().split(/\s+/)[0] || "";
    const nombre = ROL_SIGLAS[primera.toUpperCase()];
    if (!nombre) {
        return limpio;
    }
    const resto = limpio.slice(escaparHtml(primera).length);
    return `<abbr title="${nombre}">${escaparHtml(primera)}</abbr>${resto}`;
}
