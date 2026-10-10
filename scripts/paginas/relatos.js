// =========================================
// RELATOS — leídos desde datos/mis-movidas.json
// =========================================
// datos/mis-movidas.json es el mismo fichero del que también se
// alimenta la portada (novedades.js) y, más adelante,
// cualquier otra sección de "mis movidas": un único punto de datos
// con TODO lo publicado (rol, relatos y lo que venga después),
// donde cada entrada dice a qué categoría pertenece. Aquí solo se
// pintan las que tienen category "relatos". Para publicar uno
// nuevo: herramientas/1-publicar/nuevo.py crea la página y reconstruye
// ese JSON leyéndola, así que aquí no hay nada que tocar.
//
// Cada <li> se pinta con data-categoria (la subcategoría del relato:
// microrelato, relato corto...). De ahí saca sus botones la ventana
// de filtros — ver scripts/componentes/filtros.js.

const RELATOS_URL = "/datos/mis-movidas.json";

// LOS RETOS DE ESCRITURA
// ----------------------
// Un reto (Writeober y los que vengan) son 31 textos cortos. Aquí no se
// listan de uno en uno —taparían todo lo demás durante un mes— sino
// como UNA entrada, con la etiqueta "retos", que lleva a su página. Un
// reto cuenta como una obra, no como 31.
// Para el reto del año que viene, se añade su JSON a esta lista y ya:
// el nombre y la dirección de su página van dentro del propio archivo.
const RETOS_URLS = ["/datos/reto-writeober26.json"];
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
        // Fuera los días sueltos de un reto: entran como una sola
        // entrada, la que monta entradasDeRetos() con lo que haya
        // publicado de cada uno.
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

    // El listado llega por fetch, así que cuando se monta la ventana
    // de filtros todavía no hay ningún <li> del que sacar las
    // subcategorías. Este aviso le dice que vuelva a contarlas.
    document.dispatchEvent(new CustomEvent("filtros:actualizar"));
}

// =========================================
// LOS RETOS, COMO UNA ENTRADA CADA UNO
// =========================================
// Devuelve una entrada por reto, con la misma forma que las demás para
// que se pinte igual: título, fecha, subcategoría "retos" y la
// dirección de su página. La fecha es la del último día publicado —así
// el reto sube en la lista según lo vas escribiendo— y, mientras no
// haya ninguno, la de su primer día.
// Si alguno de estos archivos falla, ese reto se queda fuera y el
// listado sale igual: no vale la pena romper la página por esto.

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
                // La ficha entera se guarda para la tarjeta, que cuenta
                // lo mismo pero con la descripción: así los dos salen
                // de una sola lectura del archivo.
                fichas.push({ reto: reto, entrada: entrada });
            }
        } catch (error) {
            // Un reto que no carga no se lista, y ya está.
        }
    }
    return { entradas: entradas, fichas: fichas };
}

// =========================================
// LAS TARJETAS DE LOS RETOS
// =========================================
// Una por reto, con su descripción entera, por dónde va y un botón a
// su página. Solo se ven al pulsar el filtro «retos»: en «todas» el
// reto ya está en el listado como una entrada más, y repetirlo arriba
// con todo el texto se comía la página.
// Se montan aquí, y no en reto.js, porque ya tenemos los archivos
// leídos de armar las entradas: así no se piden dos veces.

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

// Qué filtros están puestos ahora mismo, leídos de los botones: es lo
// que ya cuenta la verdad, y evita tener que guardarlo por duplicado.
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
    // Mientras se busca algo, las tarjetas no salen aunque esté puesto
    // el filtro «retos»: buscando se pide "enséñame lo que coincida", y
    // una tarjeta que describe el reto entero no es un resultado. El
    // reto sigue apareciendo en el listado como una entrada más, y ahí
    // sí se filtra por lo escrito.
    const buscando = !!(window.buscador && window.buscador.texto);
    const seVen = hayTarjetas && !buscando && puestas.indexOf(RETOS_ETIQUETA) !== -1;
    TARJETAS_RETOS.hidden = !seVen;

    // Con las tarjetas a la vista, la línea del reto en el listado
    // sobra: dice lo mismo y peor, y encima le quita sitio a la
    // tarjeta. Se esconde, y si no queda ninguna otra línea, se
    // esconde el listado entero en vez de dejar una ventana vacía.
    // Esto corre DESPUÉS de filtros.js (que avisa al terminar), así
    // que lo que se decida aquí es lo último que manda.
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

// El filtro se monta y se pulsa después de todo esto, así que hay que
// estar escuchando: filtros.js avisa cada vez que cambia lo puesto.
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

    // Publicado de verdad = está en el listado. Que el JSON del reto
    // tenga la dirección solo quiere decir que la página existe; puede
    // seguir siendo un borrador.
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
        // Lo que se pinta como segunda etiqueta, al lado de "retos".
        avance: `${hechos.length} de ${dias.length} días`,
        // Para la tarjeta, que cuenta lo mismo con más detalle.
        hechos: hechos.length,
        total: dias.length,
        ultimo: ultimo || null,
    };
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
    // Un reto lleva además una segunda etiqueta con por dónde va
    // ("8 de 31 días"), que es lo que antes decía la tarjeta de arriba.
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

// El tiempo de lectura lo calcula herramientas/3-generadores/generar-posts.py al
// escribir el listado (cuenta las palabras del cuerpo de la entrada),
// así que aquí solo se pinta. Las cosas sin texto que leer —las fichas
// del portfolio de rol, que son enlaces a Ko-fi— no traen el dato y no
// enseñan nada.
function minutosDe(item) {
    const minutos = Number(item && item.minutos);
    if (!minutos || minutos < 1) {
        return "";
    }
    return `<span class="entry-preview-minutos">${minutos} min</span>`;
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
