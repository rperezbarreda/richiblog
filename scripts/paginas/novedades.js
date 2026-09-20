// =========================================
// PORTADA — "proyectos más nuevos" (mis movidas)
// =========================================
// Lee datos/mis-movidas.json (el mismo fichero del que se alimenta
// el listado de relatos) y muestra en la portada las entradas más
// recientes de CUALQUIER categoría — rol, relatos y las que
// añadas — mezcladas y ordenadas por fecha. Sustituye a la
// antigua tarjeta de "mis progresos" (backlog de juegos/libros a
// mano): esto se actualiza solo con lo que ya publiques en
// datos/mis-movidas.json, sin tocar este archivo ni el HTML de la
// portada.

const MIS_MOVIDAS_URL = "/datos/mis-movidas.json";
// Mismo criterio que la ventana de entradas de al lado: la ventana
// scrollea, así que enseña más de las que caben a la vista. Con 3, un
// relato publicado hoy pero fechado hace un año no aparecía en la
// portada por ningún lado.
const HOME_PROJECTS_COUNT = 6;

initializeMisMovidasFeed();

async function initializeMisMovidasFeed() {
    const list = document.getElementById("home-recent-projects");
    if (!list) {
        return;
    }

    try {
        const response = await fetch(MIS_MOVIDAS_URL);
        if (!response.ok) {
            throw new Error("La respuesta no fue correcta");
        }
        const items = await response.json();
        const sorted = Array.isArray(items)
            ? items.slice().sort((a, b) => parseItemDate(b.date) - parseItemDate(a.date))
            : [];

        if (sorted.length === 0) {
            list.innerHTML = '<li class="entries-empty">Todavía no hay nada publicado.</li>';
            return;
        }

        list.innerHTML = sorted.slice(0, HOME_PROJECTS_COUNT).map(itemToEntryCard).join("");
    } catch (error) {
        list.innerHTML =
            '<li class="entries-error">No se han podido cargar los proyectos ahora mismo.</li>';
    }
}

// =========================================
// FECHAS — formato dd-mm-aaaa en el JSON
// =========================================

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

// =========================================
// TARJETA — reutiliza .entry-preview de base.css
// =========================================
// Debajo del título van la categoría y la subcategoría como
// etiquetas, igual que las entradas del blog en la ventana de al
// lado. Y son enlaces: llevan a su listado (y la subcategoría, con el
// filtro ya puesto), que es lo que uno espera al pulsarlas.
// Van FUERA del enlace del título: un enlace dentro de otro no es
// HTML válido y el navegador lo deshace por su cuenta.

// A dónde lleva cada categoría de datos/mis-movidas.json. Si algún día
// añades una sección nueva, basta con ponerla aquí; mientras tanto su
// etiqueta se pinta sin enlace en vez de llevar a una página que no
// existe.
const PAGINAS_POR_CATEGORIA = {
    rol: "/web/mis_movidas/rol/index_rol.html",
    relatos: "/web/mis_movidas/relatos/index_relatos.html",
};

// Lo del portfolio de rol no tiene página aquí: lleva a Ko-fi o a
// Drive. Esos salen en otra pestaña, como el resto de enlaces de
// fuera, con su aviso escondido para el lector de pantalla. Lo del
// propio sitio (relatos) se abre en la misma, que es lo normal.
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
    const title = escapeHtml(item.title || "Sin título");
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
    const etiquetas = [];
    if (categoria) {
        etiquetas.push(pintarEtiqueta(categoria, pagina));
    }
    if (subcategoria) {
        etiquetas.push(
            pintarEtiqueta(
                subcategoria,
                pagina ? `${pagina}?cat=${encodeURIComponent(subcategoria)}` : ""
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

// Escapa también las comillas, no solo < y >. El truco de meter el
// texto en un div y leer su innerHTML —que es lo que había antes— deja
// las comillas intactas: sirve para texto suelto, pero no dentro de un
// atributo. Una URL con una comilla se salía del href e inyectaba
// atributos propios (probado: colaba un onmouseover).
function escapeHtml(text) {
    return (text === null || text === undefined ? "" : text.toString())
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// Solo se aceptan rutas del propio sitio o enlaces http(s). Así, si en
// el JSON se cuela (o se pega por error) algo como "javascript:...",
// no acaba convertido en código al hacer clic. Las dobles barras del
// principio también se descartan: "//otrositio.com" es un enlace
// externo disfrazado de ruta interna.
function urlSegura(url) {
    const limpia = (url === null || url === undefined ? "" : url.toString()).trim();
    if (/^\/(?!\/)/.test(limpia) || /^https?:\/\//i.test(limpia)) {
        return limpia;
    }
    return "#";
}
