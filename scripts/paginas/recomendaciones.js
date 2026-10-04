// =========================================
// RECOMENDACIONES
// =========================================
// Libros, series, pelis, juegos, anime y música que recomiendo. Sale de
// datos/recomendaciones.json: una ventanita por categoría y, dentro,
// una ficha por cosa. Aquí no se decide nada más que cómo se pinta.
//
// CÓMO SE ABRE CADA FICHA
// -----------------------
// Cada ficha es un <details> de verdad, no un invento con clases:
//   - Tocándola en el móvil se abre y se cierra sola, sin JavaScript.
//   - Con el teclado, el tabulador llega a ella y Enter la abre.
//   - Y con ratón, además, se abre al pasar por encima (eso sí lo hace
//     este archivo) y se vuelve a cerrar al salir. Si le das un clic se
//     queda fijada abierta hasta que la cierres.
// Lo importante es que el texto NO vive solo en un :hover: quien no
// tiene ratón llega a él igual.

const RECOMENDACIONES_URL = "/datos/recomendaciones.json";

initializeRecomendaciones();

async function initializeRecomendaciones() {
    const caja = document.querySelector("[data-recomendaciones]");
    if (!caja) {
        return;
    }

    try {
        const respuesta = await window.pedirDatos(RECOMENDACIONES_URL);
        if (!respuesta.ok) {
            throw new Error("La respuesta no fue correcta");
        }
        const datos = await respuesta.json();
        const bloques = (Array.isArray(datos) ? datos : []).filter(
            (bloque) => bloque && (bloque.nombre || "").trim()
        );

        if (bloques.length === 0) {
            caja.innerHTML =
                '<p class="entries-empty">Todavía no hay nada aquí.</p>';
            return;
        }

        caja.innerHTML = bloques.map(bloqueDeRec).join("");
        // Los botones −■✕ de cada ventanita los rellena
        // scripts/componentes/botones-ventana.js, que ya había pasado
        // por aquí cuando esto estaba vacío.
        document.dispatchEvent(new CustomEvent("ventanas:actualizar"));
        // Y el filtro de categorías (scripts/componentes/filtros.js),
        // que cuando se montó todavía no había ni una ventanita que
        // contar.
        document.dispatchEvent(new CustomEvent("filtros:actualizar"));
        engancharFichas(caja);
    } catch (error) {
        caja.innerHTML =
            '<p class="entries-error">No se han podido cargar las recomendaciones ahora mismo.</p>';
    }
}

// =========================================
// PINTAR
// =========================================

function bloqueDeRec(bloque) {
    const cosas = Array.isArray(bloque.cosas) ? bloque.cosas : [];
    const dentro =
        cosas.length === 0
            ? '<p class="entries-empty">Todavía no hay nada por aquí.</p>'
            : `<ul class="rec-lista">${cosas.map(fichaDeRec).join("")}</ul>`;

    // data-categoria es lo que mira el filtro de arriba
    // (scripts/componentes/filtros.js): con eso solo, una categoría
    // nueva en el JSON aparece sola entre los botones.
    const clave = escapeRec(claveDeRec(bloque));

    return (
        `<section class="rec-bloque" data-categoria="${clave}">` +
        '<div class="recent-entries-header">' +
        `<h2>${escapeRec(bloque.nombre)}</h2>` +
        '<div class="window-controls window-controls-small" data-window-controls aria-hidden="true"></div>' +
        "</div>" +
        `<div class="rec-bloque-cuerpo">${dentro}</div>` +
        "</section>"
    );
}

// El nombre corto de la categoría, que es el que sale en el botón del
// filtro. Si no está escrito en el JSON se saca del nombre de la
// ventanita: "libros.txt" -> "libros".
function claveDeRec(bloque) {
    const clave = (bloque.clave || "").trim();
    if (clave) {
        return clave;
    }
    return (bloque.nombre || "").trim().replace(/\.[^.]*$/, "");
}

// EL IDIOMA DEL TÍTULO
// --------------------
// Un lector de pantalla lee con la fonética del idioma que tenga puesta
// la página, y la de aquí es el español. Un título en inglés —y en una
// lista de libros, series y pelis van a ser mayoría— sale pronunciado a
// la española y no se entiende. Poniéndole lang="en" al trozo, el lector
// cambia de voz solo para esa parte.
//
// Es opcional: en el JSON se escribe "idioma": "en" (o "ja", "fr"...) y
// solo en lo que de verdad esté en otro idioma. Un nombre propio NO lo
// necesita —las reglas lo dicen expresamente— así que "Ko-fi" o
// "Studio Ghibli" se quedan como están; "The Left Hand of Darkness", no.
//
// Se filtra a conciencia: va dentro de un atributo HTML, así que si
// alguien escribe cualquier cosa en el JSON no puede escaparse de ahí.
function idiomaDeRec(cosa) {
    const idioma = (cosa.idioma || "").trim();
    if (!/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(idioma)) {
        return "";
    }
    return ` lang="${idioma}"`;
}

function fichaDeRec(cosa) {
    const titulo = escapeRec((cosa.titulo || "").trim() || "Sin título");
    const texto = (cosa.texto || "").trim();
    const idioma = idiomaDeRec(cosa);

    return (
        '<li class="rec-item-caja">' +
        '<details class="rec-item">' +
        '<summary class="rec-cabeza">' +
        portadaDeRec(cosa) +
        '<span class="rec-nombre">' +
        `<span class="rec-titulo"${idioma}>${titulo}${marcaDeRec(cosa)}</span>` +
        // Los datos van aquí una sola vez, aunque en la galería se vean
        // dentro de la caja flotante: ahí están repetidos a propósito
        // pero con aria-hidden, para que quien escucha la ficha los oiga
        // una vez y no dos.
        metaDeRec(cosa, false) +
        "</span>" +
        // La flecha es un adorno (solo se ve en la lista del móvil): lo
        // que dice si está abierta o cerrada es el propio <details>, que
        // los lectores de pantalla ya anuncian.
        '<span class="rec-flecha" aria-hidden="true">▾</span>' +
        "</summary>" +
        '<div class="rec-texto">' +
        // El título, otra vez, para la caja flotante: allí la portada se
        // queda lejos y hace falta saber de qué se está hablando.
        `<span class="rec-texto-titulo" aria-hidden="true">${titulo}</span>` +
        metaDeRec(cosa, true) +
        (texto ? `<p>${escapeRec(texto)}</p>` : "") +
        enlaceDeRec(cosa) +
        "</div>" +
        "</details>" +
        "</li>"
    );
}

// La portada. Si no hay, en la galería no se deja el hueco vacío: se
// pinta un recuadro con el título dentro, como el lomo de un libro. En
// la lista del móvil ese recuadro no sale (lo esconde el CSS): allí el
// título ya está al lado.
function portadaDeRec(cosa) {
    const ruta = rutaDeImagenRec(cosa.imagen);
    if (!ruta) {
        const titulo = escapeRec((cosa.titulo || "").trim() || "Sin título");
        return (
            '<span class="rec-portada rec-portada-vacia" aria-hidden="true">' +
            `<span>${titulo}${cosa.imprescindible ? ' <span class="rec-marca">★</span>' : ""}</span>` +
            "</span>"
        );
    }
    // El alt lo escribes tú en el JSON. Si no hay, va vacío a propósito
    // y no "portada de X": al lado ya está el título escrito, y
    // repetirlo solo hace que se lea dos veces.
    const alt = escapeRec((cosa.alt || "").trim());
    return (
        `<img class="rec-portada" src="${escapeRec(ruta)}" alt="${alt}"` +
        ' loading="lazy" decoding="async">'
    );
}

// Autor, estudio, año... lo que haya, separado por puntos.
function metaDeRec(cosa, repetido) {
    const trozos = [cosa.autor, cosa.anyo]
        .map((trozo) => (trozo === null || trozo === undefined ? "" : String(trozo).trim()))
        .filter(Boolean);
    if (trozos.length === 0) {
        return "";
    }
    return (
        `<span class="rec-meta"${repetido ? ' aria-hidden="true"' : ""}>` +
        `${escapeRec(trozos.join(" · "))}</span>`
    );
}

// La marca de "esta es SAGRADA". La estrella es un dibujo; lo que se
// lee en voz alta es la palabra.
function marcaDeRec(cosa) {
    if (!cosa.imprescindible) {
        return "";
    }
    return (
        '<span class="rec-marca">' +
        '<span aria-hidden="true">★</span>' +
        '<span class="visually-hidden"> (imprescindible)</span>' +
        "</span>"
    );
}

function enlaceDeRec(cosa) {
    const ruta = rutaSeguraRec(cosa.enlace);
    if (!ruta) {
        return "";
    }
    const fuera = /^https?:\/\//i.test(ruta);
    const nombre = escapeRec((cosa.enlaceTexto || "").trim() || "más información");
    return (
        `<a class="rec-enlace" href="${escapeRec(ruta)}"` +
        (fuera ? ' target="_blank" rel="noopener noreferrer"' : "") +
        `>${nombre}` +
        (fuera
            ? '<span class="visually-hidden"> (se abre en otra pestaña)</span>'
            : "") +
        ' <span aria-hidden="true">→</span></a>'
    );
}

// =========================================
// ABRIR LA FICHA Y COLOCAR LA CAJA FLOTANTE
// =========================================
// En escritorio (la galería) el texto sale en una cajita flotante al
// lado de la portada. Como es position: fixed, hay que decirle dónde
// cae: se pega a la derecha de la portada y, si ahí se saldría de la
// pantalla, se pasa a la izquierda; y si tampoco cabe de alto, se sube
// hasta que quepa. En móvil no se coloca nada: allí el texto va debajo,
// en el flujo, y el CSS ya lo pone en su sitio.

const REC_GALERIA = window.matchMedia
    ? window.matchMedia("(min-width: 861px)")
    : null;

// Solo puede haber una abierta a la vez en la galería: dos cajas
// flotantes sueltas por la pantalla se pisan y no se entiende cuál es
// de cuál.
let recAbierta = null;

function enGaleria() {
    return !REC_GALERIA || REC_GALERIA.matches;
}

function engancharFichas(caja) {
    const fichas = [...caja.querySelectorAll(".rec-item")];

    for (const ficha of fichas) {
        // "toggle" salta se abra como se abra: con el ratón, con Enter,
        // tocándola o desde aquí mismo.
        ficha.addEventListener("toggle", () => {
            if (!ficha.open) {
                if (recAbierta === ficha) {
                    recAbierta = null;
                }
                return;
            }
            if (!enGaleria()) {
                return;
            }
            if (recAbierta && recAbierta !== ficha) {
                recAbierta.dataset.fijada = "no";
                recAbierta.open = false;
            }
            recAbierta = ficha;
            colocarCaja(ficha);
        });

        // Abrir al pasar por encima es cosa del ratón: en una pantalla
        // táctil no existe "pasar por encima", ahí se toca y ya está,
        // que es lo que hace el <details> él solo.
        if (window.matchMedia && window.matchMedia("(hover: hover)").matches) {
            ficha.addEventListener("pointerenter", (evento) => {
                if (evento.pointerType === "mouse") {
                    ficha.open = true;
                }
            });

            ficha.addEventListener("pointerleave", (evento) => {
                // Una ficha fijada con un clic se queda abierta aunque
                // te vayas: si no, no habría forma de copiar el texto ni
                // de llegar al enlace de dentro sin que se cerrara por
                // el camino.
                if (evento.pointerType === "mouse" && ficha.dataset.fijada !== "si") {
                    ficha.open = false;
                }
            });
        }

        const cabeza = ficha.querySelector("summary");
        if (cabeza) {
            // Esto pasa ANTES de que el navegador abra o cierre, así que
            // ficha.open todavía dice cómo estaba.
            cabeza.addEventListener("click", (evento) => {
                if (ficha.open && ficha.dataset.fijada !== "si") {
                    // Estaba abierta solo porque el ratón está encima.
                    // El clic entonces la FIJA, no la cierra: pulsar
                    // sobre algo que estás leyendo para que se te cierre
                    // en las narices no lo espera nadie.
                    evento.preventDefault();
                    ficha.dataset.fijada = "si";
                    return;
                }
                // Fijada, el clic la cierra y la suelta. Cerrada (con el
                // teclado, o sin ratón encima), la abre y la fija.
                ficha.dataset.fijada = ficha.open ? "no" : "si";
            });
        }
    }

    // La caja va pegada a su portada, y la portada se mueve al
    // desplazar la página. En captura porque quien se desplaza no es la
    // ventana, sino la sección de dentro.
    document.addEventListener("scroll", recolocarCaja, true);
    window.addEventListener("resize", recolocarCaja, { passive: true });

    // Escape cierra la que esté abierta y devuelve el foco a su sitio,
    // como en cualquier cosa que se abra encima de lo demás.
    document.addEventListener("keydown", (evento) => {
        if (evento.key !== "Escape" || !recAbierta) {
            return;
        }
        const cabeza = recAbierta.querySelector("summary");
        recAbierta.dataset.fijada = "no";
        recAbierta.open = false;
        if (cabeza) {
            cabeza.focus();
        }
    });

    // Al pasar de galería a lista (o al revés) la caja tiene que soltar
    // las coordenadas que le pusimos: en la lista va en el flujo.
    if (REC_GALERIA && REC_GALERIA.addEventListener) {
        REC_GALERIA.addEventListener("change", () => {
            for (const ficha of fichas) {
                ficha.dataset.fijada = "no";
                ficha.open = false;
                const texto = ficha.querySelector(".rec-texto");
                if (texto) {
                    texto.style.left = "";
                    texto.style.top = "";
                }
            }
            recAbierta = null;
        });
    }
}

function recolocarCaja() {
    if (recAbierta && enGaleria()) {
        colocarCaja(recAbierta);
    }
}

function colocarCaja(ficha) {
    const texto = ficha.querySelector(".rec-texto");
    const cabeza = ficha.querySelector("summary");
    if (!texto || !cabeza) {
        return;
    }

    // Medir desde la esquina: si se midiera donde estaba puesta antes,
    // la cuenta saldría corrida.
    texto.style.left = "0px";
    texto.style.top = "0px";

    const portada = cabeza.getBoundingClientRect();
    const caja = texto.getBoundingClientRect();
    const aire = 12;
    const pegada = 10;

    // A la derecha de la portada; si no cabe, a la izquierda; y si
    // tampoco, lo más pegada al borde que se pueda.
    let izquierda = portada.right + pegada;
    if (izquierda + caja.width > window.innerWidth - aire) {
        izquierda = portada.left - caja.width - pegada;
    }
    if (izquierda < aire) {
        izquierda = Math.max(
            aire,
            Math.min(portada.left, window.innerWidth - caja.width - aire)
        );
    }

    // Arriba, a la altura de la portada, y subiéndola si se sale por
    // abajo.
    let arriba = portada.top;
    if (arriba + caja.height > window.innerHeight - aire) {
        arriba = window.innerHeight - caja.height - aire;
    }
    if (arriba < aire) {
        arriba = aire;
    }

    texto.style.left = `${Math.round(izquierda)}px`;
    texto.style.top = `${Math.round(arriba)}px`;
}

// =========================================
// LO DE SIEMPRE
// =========================================

function escapeRec(texto) {
    return (texto === null || texto === undefined ? "" : texto.toString())
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// Solo rutas del propio sitio o http(s): así una dirección mal escrita
// en el JSON no puede colar un "javascript:" en el href.
function rutaSeguraRec(url) {
    const limpia = (url === null || url === undefined ? "" : url.toString()).trim();
    if (!limpia) {
        return "";
    }
    if (/^\/(?!\/)/.test(limpia) || /^https?:\/\//i.test(limpia)) {
        return limpia;
    }
    return "";
}

// Las portadas son archivos de esta web y nada más: nada de imágenes
// traídas de fuera, que se caen el día menos pensado y además le
// cuentan a otro servidor quién está mirando la página.
function rutaDeImagenRec(url) {
    const limpia = (url === null || url === undefined ? "" : url.toString()).trim();
    return /^\/(?!\/)/.test(limpia) ? limpia : "";
}
