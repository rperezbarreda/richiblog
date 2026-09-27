// =========================================
// "SIGUE LEYENDO" — otras entradas / otros relatos
// =========================================
// Ventanita al lado del texto, en las páginas de lectura, con lo demás
// publicado en esa misma sección. Sale de los mismos JSON que ya
// alimentan la portada y los listados, así que no hay que mantener
// ningún enlace a mano: al publicar algo nuevo aparece solo aquí
// también.
//
// Uso en el HTML:
//   <ul class="entries-list" data-otras-entradas="blog"></ul>
//   <ul class="entries-list" data-otras-entradas="relatos"></ul>
//   <ul class="entries-list" data-otras-entradas="coleccion:writeober26"></ul>
//
// La última forma es para los textos de un reto de escritura diaria:
// ahí lo que apetece leer después no es otro relato cualquiera, sino
// otro día del mismo reto.
//
// La entrada que se está leyendo se descarta comparando su ruta con la
// de la página actual, para no ofrecer un enlace a donde ya estás.

const OTRAS_FUENTES = {
    blog: { url: "/datos/entradas-blog.json", filtro: null },
    relatos: {
        url: "/datos/mis-movidas.json",
        // Los de una colección tienen la suya propia (abajo), así que
        // aquí no se mezclan: quien lee un relato suelto no quiere que
        // le ofrezcan el día 14 de un reto.
        filtro: (item) => item.category === "relatos" && !(item.collection || "").trim(),
    },
};
const OTRAS_MAXIMO = 4;

// "coleccion:writeober26" -> los textos de esa colección.
function fuenteDe(clave) {
    const nombre = (clave || "").trim();
    if (nombre.indexOf("coleccion:") === 0) {
        const coleccion = nombre.slice("coleccion:".length);
        return {
            url: "/datos/mis-movidas.json",
            filtro: (item) => (item.collection || "").trim() === coleccion,
        };
    }
    return OTRAS_FUENTES[nombre];
}

initializeOtrasEntradas();

async function initializeOtrasEntradas() {
    const lista = document.querySelector("[data-otras-entradas]");
    if (!lista) {
        return;
    }

    const fuente = fuenteDe(lista.getAttribute("data-otras-entradas"));
    if (!fuente) {
        return;
    }

    try {
        const respuesta = await window.pedirDatos(fuente.url);
        if (!respuesta.ok) {
            throw new Error("La respuesta no fue correcta");
        }
        const datos = await respuesta.json();
        const items = Array.isArray(datos) ? datos : [];

        // Sin ".html" ni "/" al final: el servidor puede entregar la
        // página con o sin extensión y la ruta de aquí debe seguir
        // coincidiendo con la "url" del JSON para no listarse a sí misma.
        const sinExtension = (ruta) =>
            (ruta || "").replace(/\.html$/, "").replace(/\/+$/, "");
        const aqui = sinExtension(window.location.pathname);
        const otras = items
            .filter((item) => (fuente.filtro ? fuente.filtro(item) : true))
            .filter((item) => sinExtension(item.url) !== aqui)
            .sort((a, b) => fechaOtras(b.date) - fechaOtras(a.date))
            .slice(0, OTRAS_MAXIMO);

        if (otras.length === 0) {
            // Si no hay nada más publicado, la ventana entera se quita:
            // un "no hay nada" ocupando sitio se ve peor que no estar.
            const caja = lista.closest("[data-otras-caja]");
            if (caja) {
                caja.remove();
            }
            return;
        }

        lista.innerHTML = otras.map(otraAHtml).join("");
    } catch (error) {
        lista.innerHTML =
            '<li class="entries-error">No se han podido cargar ahora mismo.</li>';
    }
}

function fechaOtras(cruda) {
    if (!cruda) {
        return new Date(NaN);
    }
    const partes = cruda.split("-");
    if (partes.length !== 3) {
        return new Date(NaN);
    }
    const [dia, mes, anyo] = partes.map(Number);
    return new Date(anyo, mes - 1, dia);
}

function formatoFechaOtras(cruda) {
    const f = fechaOtras(cruda);
    return isNaN(f.getTime())
        ? ""
        : f.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function otraAHtml(item) {
    return (
        '<li class="entry-preview">' +
        `<a class="entry-preview-link" href="${escapeOtras(urlSeguraOtras(item.url))}">` +
        `<span class="entry-preview-title">${escapeOtras(item.title || "Sin título")}</span>` +
        `<time class="entry-preview-date" datetime="${escapeOtras(fechaISOOtras(item.date))}">${formatoFechaOtras(item.date)}</time>` +
        "</a>" +
        "</li>"
    );
}

// "25-06-2025" -> "2025-06-25", que es como entienden una fecha un
// buscador o un lector de pantalla (el atributo datetime de <time>).
function fechaISOOtras(cruda) {
    const partes = (cruda || "").split("-");
    if (partes.length !== 3) {
        return "";
    }
    const [dia, mes, anyo] = partes;
    return `${anyo}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
}

function escapeOtras(texto) {
    return (texto === null || texto === undefined ? "" : texto.toString())
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// Solo rutas del propio sitio o http(s): así una URL manipulada en el
// JSON no puede colar un "javascript:" en el href.
function urlSeguraOtras(url) {
    const limpia = (url === null || url === undefined ? "" : url.toString()).trim();
    if (/^\/(?!\/)/.test(limpia) || /^https?:\/\//i.test(limpia)) {
        return limpia;
    }
    return "#";
}
