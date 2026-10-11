/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/paginas/relatos.js
*/
const RELATOS_URL = "/datos/mis_movidas/mis-movidas.json";
const RETOS_URLS = ["/datos/mis_movidas/reto-writeober26.json"];
const RETOS_ETIQUETA = "retos";
initializeRelatos();
async function initializeRelatos() {
    const list = document.getElementById("relatos-list");
    if (!list) {
        return;
    }
    try {
        const response = await window.pedirDatos(RELATOS_URL);
        if (!response.ok) {
            throw new Error("La respuesta no fue correcta");
        }
        const allItems = await response.json();
        const todos = Array.isArray(allItems) ? allItems : [];
        const relatos = todos.filter(
            (item) => item.category === "relatos" && !(item.collection || "").trim()
        );
        const { entradas: retos, fichas } = await entradasDeRetos(todos);
        pintarTarjetasDeRetos(fichas);
        const sorted = relatos
            .concat(retos)
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
    document.dispatchEvent(new CustomEvent("filtros:actualizar"));
}
async function entradasDeRetos(todos) {
    const entradas = [];
    const fichas = [];
    for (let i = 0; i < RETOS_URLS.length; i += 1) {
        try {
            const respuesta = await window.pedirDatos(RETOS_URLS[i]);
            if (!respuesta.ok) {
                continue;
            }
            const reto = await respuesta.json();
            const entrada = entradaDeReto(reto, todos);
            if (entrada) {
                entradas.push(entrada);
                fichas.push({ reto: reto, entrada: entrada });
            }
        } catch (error) {
        }
    }
    return { entradas: entradas, fichas: fichas };
}
let TARJETAS_RETOS = null;
function pintarTarjetasDeRetos(fichas) {
    const caja = document.querySelector("[data-reto-avisos]");
    if (!caja) {
        return;
    }
    TARJETAS_RETOS = caja;
    caja.innerHTML = fichas.map(tarjetaDeReto).join("");
    ajustarTarjetasDeRetos(filtrosPuestosAhora());
}
function tarjetaDeReto(ficha) {
    const reto = ficha.reto;
    const nombre = escapeHtml((reto.nombre || "Reto de escritura").trim());
    const intro = (reto.intro || "").trim();
    const pagina = escapeHtml(urlSegura(reto.pagina || "#"));
    const hechos = ficha.entrada.hechos;
    const total = ficha.entrada.total;
    const ultimo = ficha.entrada.ultimo;
    const avance =
        hechos === 1 ? `1 día escrito de ${total}` : `${hechos} días escritos de ${total}`;
    const loUltimo =
        ultimo && (ultimo.titulo || "").trim()
            ? `<p class="reto-aviso-ultimo">Lo último: día ${Number(ultimo.dia) || ""} · ${escapeHtml(ultimo.titulo.trim())}</p>`
            : "";
    return (
        '<div class="reto-aviso">' +
        '<div class="reto-aviso-texto">' +
        `<p class="reto-aviso-nombre">${nombre}</p>` +
        (intro ? `<p class="reto-aviso-desc">${escapeHtml(intro)}</p>` : "") +
        `<p class="reto-aviso-avance">${escapeHtml(avance)}</p>` +
        loUltimo +
        "</div>" +
        `<a class="reto-aviso-enlace" href="${pagina}">ver el reto →</a>` +
        "</div>"
    );
}
function filtrosPuestosAhora() {
    return [...document.querySelectorAll('.filtro-btn[aria-pressed="true"]')].map((boton) =>
        (boton.getAttribute("data-categoria") || "").trim()
    );
}
function ajustarTarjetasDeRetos(puestas) {
    if (!TARJETAS_RETOS) {
        return;
    }
    const hayTarjetas = TARJETAS_RETOS.children.length > 0;
    const buscando = !!(window.buscador && window.buscador.texto);
    const seVen = hayTarjetas && !buscando && puestas.indexOf(RETOS_ETIQUETA) !== -1;
    TARJETAS_RETOS.hidden = !seVen;
    const lista = document.getElementById("relatos-list");
    if (!lista) {
        return;
    }
    let quedan = 0;
    lista.querySelectorAll(".entry-preview").forEach((li) => {
        const esReto = (li.getAttribute("data-categoria") || "").trim() === RETOS_ETIQUETA;
        if (seVen && esReto) {
            li.hidden = true;
        }
        if (!li.hidden) {
            quedan += 1;
        }
    });
    const ventana = lista.closest(".relatos-list-card");
    if (ventana) {
        ventana.hidden = seVen && quedan === 0;
    }
}
document.addEventListener("filtros:cambiado", (evento) => {
    ajustarTarjetasDeRetos((evento.detail && evento.detail.puestas) || []);
});
function entradaDeReto(reto, todos) {
    const pagina = (reto && reto.pagina ? reto.pagina : "").trim();
    const coleccion = (reto && reto.coleccion ? reto.coleccion : "").trim();
    const dias = Array.isArray(reto && reto.dias) ? reto.dias : [];
    if (!pagina || !dias.length) {
        return null;
    }
    const sinExtension = (ruta) =>
        (ruta || "").trim().replace(/\.html$/, "").replace(/\/+$/, "");
    const publicadas = {};
    todos.forEach((item) => {
        if ((item.collection || "").trim() === coleccion) {
            publicadas[sinExtension(item.url)] = item;
        }
    });
    const hechos = dias.filter((dia) => publicadas[sinExtension(dia && dia.url)]);
    const ultimo = hechos[hechos.length - 1];
    const fecha = (ultimo && ultimo.fecha) || (dias[0] && dias[0].fecha) || "";
    return {
        title: (reto.nombre || "Reto de escritura").trim(),
        category: "relatos",
        subcategory: RETOS_ETIQUETA,
        date: fecha,
        url: pagina,
        avance: `${hechos.length} de ${dias.length} días`,
        hechos: hechos.length,
        total: dias.length,
        ultimo: ultimo || null,
    };
}
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
    const avance = (relato.avance || "").trim();
    const etiqueta =
        subcategoria || avance
            ? '<span class="entry-preview-tags">' +
              (subcategoria ? `<span class="entry-tag">${escapeHtml(subcategoria)}</span>` : "") +
              (avance ? `<span class="entry-tag">${escapeHtml(avance)}</span>` : "") +
              "</span>"
            : "";
    return (
        `<li class="entry-preview" data-categoria="${escapeHtml(subcategoria)}">` +
        `<a class="entry-preview-link" href="${escapeHtml(urlSegura(url))}">` +
        `<span class="entry-preview-title">${title}</span>` +
        '<span class="entry-preview-meta">' +
        `<time class="entry-preview-date" datetime="${escapeHtml(fechaISO(relato.date))}">${date}</time>` +
        minutosDe(relato) +
        "</span>" +
        "</a>" +
        etiqueta +
        "</li>"
    );
}
function minutosDe(item) {
    const minutos = Number(item && item.minutos);
    if (!minutos || minutos < 1) {
        return "";
    }
    return `<span class="entry-preview-minutos">${minutos} min</span>`;
}
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
function urlSegura(url) {
    const limpia = (url === null || url === undefined ? "" : url.toString()).trim();
    if (/^\/(?!\/)/.test(limpia) || /^https?:\/\//i.test(limpia)) {
        return limpia;
    }
    return "#";
}
