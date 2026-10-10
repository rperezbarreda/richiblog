// =========================================
// PORTFOLIO DE ROL — leído desde datos/rol.json
// =========================================
// Las tarjetas estaban escritas a mano dentro de index_rol.html, unos
// 2 KB cada una: con veinte cosas publicadas la página pesaría más de
// 50 KB de datos que en realidad no son la página, y había que editar
// HTML para publicar algo. Ahora la página va vacía y las tarjetas
// salen de datos/rol.json, igual que el listado de relatos sale de
// datos/mis-movidas.json.
//
// QUIÉN MANDA: datos/rol.json. Es el archivo que se toca (a mano o con
// herramientas/1-publicar/nuevo.py --rol). De ahí saca también generar-posts.py la
// parte de rol de datos/mis-movidas.json, que es lo que alimenta la
// portada (novedades.exe) y el RSS. O sea: un solo sitio donde
// escribir, y todo lo demás se entera solo.
//
// Cada tarjeta lleva su data-categoria, que es de donde la ventana de
// filtros saca sus botones — ver scripts/componentes/filtros.js. Como
// el listado llega por fetch, al terminar hay que avisarla.
//
// QUÉ LLEVA CADA FICHA EN EL JSON
//   title        el título. Obligatorio.
//   subcategory  en qué filtro entra: aventuras, mapas, recursos…
//   date         dd-mm-aaaa. Ordena el listado (lo más nuevo arriba).
//   image        la portada, ruta dentro del sitio.
//   alt          qué se ve en esa portada, para quien no la ve.
//   system       lo que sale bajo el título ("D&D 5e · 2-5 jugadores").
//   description  el párrafo de la tarjeta.
//   kofi         enlace del botón principal.
//   drive        enlace de descarga directa. Opcional: sin él, la
//                tarjeta se queda con un solo botón.

const ROL_URL = "/datos/rol.json";

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

    // La ventana de filtros se monta antes de que llegue esto, así que
    // cuando cuenta las categorías todavía no hay ninguna tarjeta.
    document.dispatchEvent(new CustomEvent("filtros:actualizar"));
}

// Se quita lo que hubiera (el "Cargando…" o una pasada anterior) y se
// mete lo nuevo ANTES del aviso de categoría vacía, que vive dentro de
// la rejilla porque el CSS lo coloca a lo ancho de ella. Un
// innerHTML de toda la rejilla se lo llevaría por delante, y con él el
// role="status" que hace que se lea al cambiar de filtro.
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

// =========================================
// UNA TARJETA
// =========================================
// El HTML es exactamente el que había escrito a mano, para que no
// cambie ni el aspecto ni lo que oye un lector de pantalla.

function tarjetaRol(ficha) {
    const titulo = escaparHtml(ficha.title || "Sin título");
    const subcategoria = escaparHtml((ficha.subcategory || "").trim());
    const fecha = escaparHtml(ficha.date || "");
    const sistema = (ficha.system || "").trim();
    const descripcion = (ficha.description || "").trim();

    // El texto escondido va dentro del enlace a propósito: a la vista
    // pone solo "Ver en Ko-fi", pero quien usa lector de pantalla saca
    // la lista de enlaces de la página y oiría "Ver en Ko-fi" tres o
    // cuatro veces seguidas sin saber de qué aventura es cada uno. Y de
    // paso avisa de que se abre en otra pestaña.
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
        // h2 y no h3: sin encabezados de categoría, los títulos
        // saltaban de h1 a h3.
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
    // Sin alt escrito, el alt del título es mejor que nada, pero lo
    // suyo es ponerlo en el JSON: lo que importa es qué SE VE en la
    // portada, no cómo se llama la aventura.
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

// =========================================
// FECHAS — dd-mm-aaaa en el JSON
// =========================================

function fechaRol(cruda) {
    const partes = (cruda || "").split("-");
    if (partes.length !== 3) {
        return new Date(NaN);
    }
    const [dia, mes, anyo] = partes.map(Number);
    return new Date(anyo, mes - 1, dia);
}

// =========================================
// SEGURIDAD AL PINTAR
// =========================================
// El JSON lo escribes tú, pero esto se pinta con innerHTML: si algún
// día una descripción lleva un "<" o unas comillas, sin escapar se
// rompe la tarjeta (o algo peor). Mismo criterio que en relatos.js.

function escaparHtml(texto) {
    return (texto === null || texto === undefined ? "" : texto.toString())
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// Solo direcciones normales: una que empiece por "javascript:" dentro
// de un href ejecuta código con solo pulsarla.
function rutaSegura(url) {
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


// =========================================
// LAS SIGLAS DE LOS SISTEMAS
// =========================================
// "DnD 5e" lo entiende quien juega. Quien no, no, y un lector de
// pantalla además lo deletrea o lo intenta pronunciar. Si el sistema
// empieza por una sigla de las de aquí abajo, se le pone su nombre
// entero con <abbr title>, que es lo que los navegadores enseñan al
// pasar por encima y lo que algunos lectores leen.
//
// Es una lista corta y escrita a mano a propósito: inventarse qué
// significa una sigla a partir de las letras sale mal, y aquí lo que
// hay son cuatro juegos. Si algún día pones uno nuevo, añádelo.
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
    // Solo la primera palabra va dentro del <abbr>: el resto ("5e",
    // "2-5 jugadores") no es ninguna sigla.
    const resto = limpio.slice(escaparHtml(primera).length);
    return `<abbr title="${nombre}">${escaparHtml(primera)}</abbr>${resto}`;
}
