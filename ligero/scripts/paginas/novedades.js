/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/paginas/novedades.js
*/
const MIS_MOVIDAS_URL = "/datos/mis_movidas/mis-movidas.json";
const HOME_PROJECTS_COUNT = 4;
initializeMisMovidasFeed();
async function initializeMisMovidasFeed() {
    const list = document.getElementById("home-recent-projects");
    if (!list) {
        return;
    }
    try {
        const response = await window.pedirDatos(MIS_MOVIDAS_URL);
        if (!response.ok) {
            throw new Error("La respuesta no fue correcta");
        }
        const items = await response.json();
        const sorted = colapsarColecciones(
            Array.isArray(items)
                ? items.slice().sort((a, b) => parseItemDate(b.date) - parseItemDate(a.date))
                : []
        );
        if (sorted.length === 0) {
            list.innerHTML = '<li class="entries-empty">Todavía no hay nada publicado.</li>';
            return;
        }
        list.innerHTML = sorted.slice(0, HOME_PROJECTS_COUNT).map(itemToEntryCard).join("");
        if (typeof window.recortarTitulos === "function") {
            window.recortarTitulos(list);
        }
    } catch (error) {
        list.innerHTML =
            '<li class="entries-error">No se han podido cargar los proyectos ahora mismo.</li>';
    }
}
function colapsarColecciones(ordenados) {
    const vistas = {};
    return ordenados.filter((item) => {
        const coleccion = (item.collection || "").trim();
        if (!coleccion) {
            return true;
        }
        if (vistas[coleccion]) {
            return false;
        }
        vistas[coleccion] = true;
        return true;
    });
}
function parseItemDate(rawDate) {
    if (!rawDate) {
        return new Date(NaN);
    }
    const parts = rawDate.split("-");
    if (parts.length !== 3) {
        return new Date(NaN);
    }
    const [day, month, year] = parts.map(Number);
    return new Date(year, month - 1, day);
}
const PAGINAS_POR_CATEGORIA = {
    rol: "/web/mis_movidas/rol/index_rol.html",
    relatos: "/web/mis_movidas/relatos/index_relatos.html",
};
function atributosDeSalida(destino) {
    if (!/^https?:\/\//i.test(destino)) {
        return { extra: "", aviso: "" };
    }
    return {
        extra: ' target="_blank" rel="noopener noreferrer"',
        aviso: '<span class="visually-hidden"> (se abre en otra pestaña)</span>',
    };
}
function itemToEntryCard(item) {
    const title = escapeHtml((item.title || "Sin título").trim());
    const destino = urlSegura(item.url || "#");
    const salida = atributosDeSalida(destino);
    return (
        '<li class="entry-preview">' +
        `<a class="entry-preview-link" href="${escapeHtml(destino)}"${salida.extra}>` +
        `<span class="entry-preview-title">${title}</span>` +
        salida.aviso +
        "</a>" +
        etiquetasDe(item) +
        "</li>"
    );
}
function etiquetasDe(item) {
    const categoria = (item.category || "").trim();
    const subcategoria = (item.subcategory || "").trim();
    if (!categoria && !subcategoria) {
        return "";
    }
    const pagina = PAGINAS_POR_CATEGORIA[categoria.toLowerCase()];
    const enColeccion = !!(item.collection || "").trim();
    const etiquetas = [];
    if (categoria) {
        etiquetas.push(pintarEtiqueta(categoria, pagina));
    }
    if (subcategoria) {
        etiquetas.push(
            pintarEtiqueta(
                subcategoria,
                pagina && !enColeccion
                    ? `${pagina}?cat=${encodeURIComponent(subcategoria)}`
                    : ""
            )
        );
    }
    return '<span class="entry-preview-tags">' + etiquetas.join("") + "</span>";
}
function pintarEtiqueta(texto, enlace) {
    const visible = escapeHtml(texto);
    if (!enlace) {
        return `<span class="entry-tag">${visible}</span>`;
    }
    return `<a class="entry-tag" href="${escapeHtml(urlSegura(enlace))}">${visible}</a>`;
}
function escapeHtml(text) {
    return (text === null || text === undefined ? "" : text.toString())
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
function urlSegura(url) {
    const limpia = (url === null || url === undefined ? "" : url.toString()).trim();
    if (/^\/(?!\/)/.test(limpia) || /^https?:\/\//i.test(limpia)) {
        return limpia;
    }
    return "#";
}
