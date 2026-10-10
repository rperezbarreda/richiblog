// =========================================
// RETO LITERARIO — la rejilla de días
// =========================================
// Un reto de escritura diaria (Writeober y los que vengan) no cabe bien
// en el listado de relatos: son 31 textos cortos que taparían todo lo
// demás durante un mes. Por eso tiene sección propia, y aquí se pinta
// su rejilla: una casilla por día, con la palabra que toca. La casilla
// enlaza si ese día ya está escrito; si no, sale apagada.
//
// QUIÉN MANDA: datos/reto-writeober26.json. Ahí están las 31 palabras y,
// de cada día que publicas, su título y su dirección (los rellena
// herramientas/1-publicar/nuevo.py --reto al crear la página). Las palabras las
// escribes tú una vez, al principio.
//
// Esto solo corre en la página de un reto. En el listado de relatos,
// el reto sale como una entrada más (con su etiqueta "retos") y, al
// pulsar ese filtro, con su tarjeta y su descripción: las dos cosas
// las monta scripts/paginas/relatos.js.
//
// PARA EL RETO DEL AÑO QUE VIENE no hay que tocar este archivo: la
// página dice cuál es su JSON en el atributo data-reto-datos de la
// rejilla. Copiar la carpeta, cambiar ese atributo y añadir el JSON
// a la lista RETOS_URLS de relatos.js es todo.

const RETO_LISTADO_URL = "/datos/mis-movidas.json";

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
            // El título bueno es el de la página (su <h1>), no el que se
            // apuntó al crearla: si lo cambias al escribir, aquí se ve
            // el cambio sin tocar el JSON del reto.
            ? Object.assign({}, dia, { titulo: publicado.title || dia.titulo, hecho: true })
            : Object.assign({}, dia, { hecho: false });
    });
    const hechos = dias.filter((dia) => dia.hecho);

    pintarRejilla(rejilla, dias);
    pintarAvance(hechos.length, dias.length);
    pintarCabecera(reto);
}

// Qué días están PUBLICADOS de verdad. No basta con que el JSON del
// reto tenga la dirección: la página se crea antes de escribirla y nace
// como borrador, y un borrador no está en datos/mis-movidas.json. Así
// la casilla se enciende exactamente cuando el texto se publica, con el
// mismo criterio que el resto del sitio, sin nada que sincronizar a
// mano.
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

// El servidor puede entregar la página con o sin ".html", así que las
// direcciones se comparan sin extensión.
function sinExtension(ruta) {
    return (ruta || "").trim().replace(/\.html$/, "").replace(/\/+$/, "");
}

// =========================================
// LA REJILLA DE DÍAS
// =========================================

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

    // El número se lee aparte (aria-hidden arriba) para que un lector de
    // pantalla no diga "cero uno" sino "día 1", y para que la casilla se
    // anuncie entera de una vez en vez de trozo a trozo.
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

// =========================================
// EL AVANCE Y LA CABECERA
// =========================================

function pintarAvance(hechos, total) {
    const texto = document.querySelector("[data-reto-avance]");
    if (texto) {
        texto.textContent =
            hechos === 1
                ? `1 día escrito de ${total}`
                : `${hechos} días escritos de ${total}`;
    }
    // La barra es decoración: lo que de verdad dice cómo va es la línea
    // de arriba, que es texto y se lee sola. Por eso va aria-hidden.
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

// =========================================
// SEGURIDAD AL PINTAR
// =========================================
// Mismo criterio que en relatos.js y rol.js: el JSON lo escribes tú,
// pero esto se pinta con innerHTML, así que todo va escapado y las
// direcciones se comprueban.

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
    // Una dirección de ESTA web (que empiece por "/" pero no por "//",
    // que sería otra web), una http(s) entera, un correo o un ancla. Lo
    // demás —"javascript:", "data:", "//otrositio.com"— no es una
    // dirección: es código o es irse de aquí sin que se note.
    if (/^\/(?!\/)/.test(limpia) || /^(https?:\/\/|mailto:|#)/i.test(limpia)) {
        return limpia;
    }
    return "#";
}
