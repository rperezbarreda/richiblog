/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/paginas/otras-entradas.js
*/
const OTRAS_FUENTES = {
    blog: { url: "/datos/blog/entradas-blog.json", filtro: null },
    relatos: {
        url: "/datos/mis_movidas/mis-movidas.json",
        filtro: (item) => item.category === "relatos" && !(item.collection || "").trim(),
    },
};
const OTRAS_MAXIMO = 2;
function fuenteDe(clave) {
    const nombre = (clave || "").trim();
    if (nombre.indexOf("coleccion:") === 0) {
        const coleccion = nombre.slice("coleccion:".length);
        return {
            url: "/datos/mis_movidas/mis-movidas.json",
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
        const sinExtension = (ruta) =>
            (ruta || "").replace(/\.html$/, "").replace(/\/+$/, "");
        const aqui = sinExtension(window.location.pathname);
        const suya = items.find((item) => sinExtension(item.url) === aqui);
        if (suya) {
            document.dispatchEvent(
                new CustomEvent("lectura:entrada", { detail: suya })
            );
        }
        const candidatas = items
            .filter((item) => (fuente.filtro ? fuente.filtro(item) : true))
            .filter((item) => sinExtension(item.url) !== aqui);
        const otras = barajar(candidatas)
            .slice(0, OTRAS_MAXIMO)
            .sort((a, b) => fechaOtras(b.date) - fechaOtras(a.date));
        if (otras.length === 0) {
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
function barajar(lista) {
    const copia = lista.slice();
    for (let i = copia.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        const guarda = copia[i];
        copia[i] = copia[j];
        copia[j] = guarda;
    }
    return copia;
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
        '<span class="entry-preview-meta">' +
        `<time class="entry-preview-date" datetime="${escapeOtras(fechaISOOtras(item.date))}">${formatoFechaOtras(item.date)}</time>` +
        minutosOtras(item) +
        "</span>" +
        "</a>" +
        "</li>"
    );
}
function minutosOtras(item) {
    const minutos = Number(item && item.minutos);
    if (!minutos || minutos < 1) {
        return "";
    }
    return `<span class="entry-preview-minutos">${minutos} min</span>`;
}
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
function urlSeguraOtras(url) {
    const limpia = (url === null || url === undefined ? "" : url.toString()).trim();
    if (/^\/(?!\/)/.test(limpia) || /^https?:\/\//i.test(limpia)) {
        return limpia;
    }
    return "#";
}
