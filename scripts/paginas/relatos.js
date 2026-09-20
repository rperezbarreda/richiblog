// =========================================
// RELATOS — leídos desde datos/mis-movidas.json
// =========================================
// datos/mis-movidas.json es el mismo fichero del que también se
// alimenta la portada (novedades.js) y, más adelante,
// cualquier otra sección de "mis movidas": un único punto de datos
// con TODO lo publicado (rol, relatos y lo que venga después),
// donde cada entrada dice a qué categoría pertenece. Aquí solo se
// pintan las que tienen category "relatos". Para publicar uno
// nuevo: herramientas/nueva-entrada.py crea la página y reconstruye
// ese JSON leyéndola, así que aquí no hay nada que tocar.
//
// Cada <li> se pinta con data-categoria (la subcategoría del relato:
// microrelato, relato corto...). De ahí saca sus botones la ventana
// de filtros — ver scripts/componentes/filtros.js.

const RELATOS_URL = "/datos/mis-movidas.json";

initializeRelatos();

async function initializeRelatos() {
    const list = document.getElementById("relatos-list");
    if (!list) {
        return;
    }

    try {
        const response = await fetch(RELATOS_URL);
        if (!response.ok) {
            throw new Error("La respuesta no fue correcta");
        }
        const allItems = await response.json();
        const relatos = Array.isArray(allItems)
            ? allItems.filter((item) => item.category === "relatos")
            : [];
        const sorted = relatos
            .slice()
            .sort((a, b) => parseRelatoDate(b.date) - parseRelatoDate(a.date));

        if (sorted.length === 0) {
            list.innerHTML = '<li class="entries-empty">Todavía no hay relatos publicados.</li>';
        } else {
            list.innerHTML = sorted.map(relatoToEntryCard).join("");
        }
    } catch (error) {
        list.innerHTML =
            '<li class="entries-error">No se han podido cargar los relatos ahora mismo.</li>';
    }

    // El listado llega por fetch, así que cuando se monta la ventana
    // de filtros todavía no hay ningún <li> del que sacar las
    // subcategorías. Este aviso le dice que vuelva a contarlas.
    document.dispatchEvent(new CustomEvent("filtros:actualizar"));
}

// =========================================
// FECHAS — formato dd-mm-aaaa en el JSON
// =========================================

function parseRelatoDate(rawDate) {
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

function formatRelatoDate(rawDate) {
    const parsed = parseRelatoDate(rawDate);
    if (isNaN(parsed.getTime())) {
        return "";
    }
    return parsed.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function relatoToEntryCard(relato) {
    const title = escapeHtml(relato.title || "Sin título");
    const date = formatRelatoDate(relato.date);
    const url = relato.url || "#";
    const subcategoria = (relato.subcategory || "").trim();

    // La subcategoría se pinta como etiqueta, pero NO como enlace: en
    // el blog cada etiqueta lleva al archivo filtrado, y aquí el
    // filtro ya está en esta misma página.
    const etiqueta = subcategoria
        ? '<span class="entry-preview-tags">' +
          `<span class="entry-tag">${escapeHtml(subcategoria)}</span>` +
          "</span>"
        : "";

    return (
        `<li class="entry-preview" data-categoria="${escapeHtml(subcategoria)}">` +
        `<a class="entry-preview-link" href="${escapeHtml(urlSegura(url))}">` +
        `<span class="entry-preview-title">${title}</span>` +
        `<time class="entry-preview-date" datetime="${escapeHtml(fechaISO(relato.date))}">${date}</time>` +
        "</a>" +
        etiqueta +
        "</li>"
    );
}

// Escapa también las comillas, no solo < y >. El truco de meter el
// texto en un div y leer su innerHTML —que es lo que había antes— deja
// las comillas intactas: sirve para texto suelto, pero no dentro de un
// atributo. Una URL con una comilla se salía del href e inyectaba
// atributos propios (probado: colaba un onmouseover).
// "25-06-2025" -> "2025-06-25", que es como entienden una fecha un
// buscador o un lector de pantalla (el atributo datetime de <time>).
function fechaISO(cruda) {
    const partes = (cruda || "").split("-");
    if (partes.length !== 3) {
        return "";
    }
    const [dia, mes, anyo] = partes;
    return `${anyo}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
}

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
