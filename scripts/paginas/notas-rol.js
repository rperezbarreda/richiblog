// =========================================
// NOTAS DE ROL — la página de una campaña
// =========================================
// Pinta las dos cosas que lleva el índice de una campaña: su ficha (qué
// se juega, quién dirige, los personajes y de qué va) y la lista de
// sesiones.
//
// QUIÉN MANDA: el JSON de la campaña, que la propia página dice en el
// atributo data-campana-datos de la lista. Hoy es
// datos/campana-ragna.json. Ahí se escriben a mano la ficha y la intro,
// y las sesiones las va añadiendo herramientas/nuevo.py --sesion al
// crear cada página.
//
// PARA UNA CAMPAÑA NUEVA no hay que tocar este archivo: se copia la
// carpeta de la campaña, se cambia ese atributo y se crea su JSON. Lo
// único que hay que escribir a mano es su enlace en el menú
// (fragmentos/barra-lateral.html).
//
// LOS CAMPOS DE LA FICHA
// ----------------------
// Un campo que NO esté en el JSON no sale. Un campo que esté pero en
// blanco sale marcado como "por rellenar", que es un recordatorio que se
// ve en la propia web en vez de en una lista de tareas que nadie mira.
// Así que para quitar un campo de verdad —una campaña sin director,
// porque la diriges tú— se borra su línea del JSON.

const NOTAS_LISTADO_URL = "/datos/notas-rol.json";

// Los colores que puede llevar un personaje de los jugadores. Son los
// cuatro que están escritos en estilos/paginas/notas-rol.css; si se añade
// uno allí, se añade aquí.
const NOTAS_COLORES = ["verde", "azul", "rojo", "morado"];

// El orden en que salen los campos de la ficha y cómo se llaman. Los
// personajes van aparte (son una lista, no una línea de texto) y se
// cuelan en su sitio por la clave "personajes".
const NOTAS_CAMPOS = [
    { clave: "sistema", nombre: "sistema" },
    { clave: "director", nombre: "dirige" },
    { clave: "personajes", nombre: "personajes" },
    { clave: "sinopsis", nombre: "de qué va" },
];

initializeNotasRol();

async function initializeNotasRol() {
    const lista = document.querySelector("[data-campana-sesiones]");
    if (!lista) {
        return;
    }
    const datos = (lista.getAttribute("data-campana-datos") || "").trim();
    if (!datos) {
        return;
    }

    let campana = null;
    let publicadas = {};
    try {
        const respuesta = await window.pedirDatos(datos);
        if (!respuesta.ok) {
            throw new Error("La respuesta no fue correcta");
        }
        campana = await respuesta.json();
        publicadas = await leerSesionesPublicadas((campana.clave || "").trim());
    } catch (error) {
        lista.innerHTML =
            '<li class="entries-error">No se han podido cargar las sesiones ahora mismo.</li>';
        return;
    }

    pintarCabeceraCampana(campana);
    pintarFichaCampana(campana);
    pintarSesiones(lista, campana, publicadas);
}

// Qué sesiones están PUBLICADAS de verdad. No basta con que el JSON de
// la campaña tenga la dirección: la página se crea antes de pasar las
// notas a limpio y nace como borrador, y un borrador no está en
// datos/notas-rol.json. Así la fila se enciende exactamente cuando se
// publica, con el mismo criterio que el resto del sitio y sin nada que
// sincronizar a mano. Es lo mismo que hace scripts/paginas/reto.js con
// los días del reto de escritura.
async function leerSesionesPublicadas(clave) {
    const respuesta = await window.pedirDatos(NOTAS_LISTADO_URL);
    if (!respuesta.ok) {
        throw new Error("La respuesta no fue correcta");
    }
    const items = await respuesta.json();
    const mapa = {};
    (Array.isArray(items) ? items : []).forEach((item) => {
        if (!clave || (item.campana || "").trim() === clave) {
            mapa[sinExtensionNotas(item.url)] = item;
        }
    });
    return mapa;
}

// El servidor puede entregar la página con o sin ".html", así que las
// direcciones se comparan sin extensión.
function sinExtensionNotas(ruta) {
    return (ruta || "").trim().replace(/\.html$/, "").replace(/\/+$/, "");
}


// =========================================
// LA CABECERA
// =========================================

function pintarCabeceraCampana(campana) {
    const nombre = document.querySelector("[data-campana-nombre]");
    if (nombre && (campana.nombre || "").trim()) {
        nombre.textContent = campana.nombre.trim();
    }
    const intro = document.querySelector("[data-campana-intro]");
    if (intro && (campana.intro || "").trim()) {
        intro.textContent = campana.intro.trim();
    }
}


// =========================================
// LA FICHA
// =========================================
// Se monta con createElement y no con innerHTML, al revés que la lista de
// sesiones. No es por capricho: aquí cada dato es UN texto suelto, y
// textContent lo pone tal cual sin que haya que acordarse de escapar
// nada. En la lista de abajo hay que pegar varios trozos con sus clases y
// sus enlaces, y ahí sale más corto escribir el HTML y escapar.

function pintarFichaCampana(campana) {
    const ficha = document.querySelector("[data-campana-ficha]");
    const cuerpo = document.querySelector("[data-campana-ficha-cuerpo]");
    if (!ficha || !cuerpo) {
        return;
    }

    const filas = NOTAS_CAMPOS.filter((campo) =>
        Object.prototype.hasOwnProperty.call(campana, campo.clave)
    );
    if (!filas.length) {
        // Ni un campo en el JSON: la ficha no existe para esta campaña y
        // la ventana se queda escondida, que es mejor que un marco vacío.
        return;
    }

    cuerpo.textContent = "";
    // Una <dl> de verdad: así un lector de pantalla dice "sistema, D&D
    // 5e" y no dos textos sueltos uno detrás de otro.
    const lista = document.createElement("dl");
    lista.className = "campana-ficha-lista";

    filas.forEach((campo) => {
        const bloque = document.createElement("div");
        bloque.className = "campana-dato";

        const nombre = document.createElement("dt");
        nombre.className = "campana-dato-nombre";
        nombre.textContent = campo.nombre;
        bloque.appendChild(nombre);

        const valor = document.createElement("dd");
        valor.className = "campana-dato-valor";
        if (campo.clave === "personajes") {
            const gente = personajesDe(campana.personajes);
            if (gente.length) {
                valor.appendChild(listaDePersonajes(gente));
            } else {
                valor.appendChild(porRellenar());
            }
        } else {
            const texto = (campana[campo.clave] || "").toString().trim();
            if (texto) {
                valor.textContent = texto;
            } else {
                valor.appendChild(porRellenar());
            }
        }
        bloque.appendChild(valor);
        lista.appendChild(bloque);
    });

    cuerpo.appendChild(lista);
    ficha.hidden = false;
    // Por si la ventana estrena sus botones −■✕ ahora: la cabecera ya
    // estaba en el HTML, pero los cuadraditos los pone
    // scripts/componentes/botones-ventana.js al avisar.
    document.dispatchEvent(new CustomEvent("ventanas:actualizar"));
}

// Los personajes con nombre. Los que estén en blanco se saltan: el JSON
// nace con uno vacío de muestra, para que se vea qué forma tienen, y ése
// no es un personaje.
function personajesDe(crudos) {
    return (Array.isArray(crudos) ? crudos : [])
        .filter((p) => p && (p.nombre || "").toString().trim())
        .map((p) => ({
            nombre: p.nombre.toString().trim(),
            // De qué color sale su nombre, aquí y en las notas. Lo dice el
            // JSON ("color": "verde") y solo valen estos cuatro: así un
            // dedazo en el JSON no deja el nombre con una clase que no
            // existe en ninguna hoja de estilo.
            color: NOTAS_COLORES.indexOf(
                (p.color || "").toString().trim().toLowerCase()
            ) === -1
                ? ""
                : (p.color || "").toString().trim().toLowerCase(),
            // Lo que va detrás del nombre: qué es y quién lo lleva.
            // "Guerrero · lo lleva Ana" si están los dos.
            extra: [
                (p.clase || "").toString().trim(),
                (p.jugador || "").toString().trim()
                    ? "lo lleva " + p.jugador.toString().trim()
                    : "",
            ]
                .filter(Boolean)
                .join(" · "),
        }));
}

function listaDePersonajes(gente) {
    const lista = document.createElement("ul");
    lista.className = "campana-personajes";
    gente.forEach((quien) => {
        const fila = document.createElement("li");
        fila.className = "campana-personaje";

        const nombre = document.createElement("strong");
        nombre.className =
            "campana-personaje-nombre" +
            (quien.color ? " pj-" + quien.color : "");
        nombre.textContent = quien.nombre;
        fila.appendChild(nombre);

        if (quien.extra) {
            const extra = document.createElement("span");
            extra.className = "campana-personaje-extra";
            extra.textContent = " " + quien.extra;
            fila.appendChild(extra);
        }
        lista.appendChild(fila);
    });
    return lista;
}

function porRellenar() {
    const aviso = document.createElement("span");
    aviso.className = "campana-dato-vacio";
    aviso.textContent = "por rellenar";
    return aviso;
}


// =========================================
// LA LISTA DE SESIONES
// =========================================

function pintarSesiones(lista, campana, publicadas) {
    const sesiones = (Array.isArray(campana.sesiones) ? campana.sesiones : [])
        .map((sesion) => {
            const publicada = publicadas[sinExtensionNotas(sesion && sesion.url)];
            if (!publicada) {
                return Object.assign({}, sesion, { hecha: false });
            }
            // El título bueno es el de la página (su <h1>), no el que se
            // apuntó al crearla: si lo cambias al pasar las notas a
            // limpio, aquí se ve el cambio sin tocar el JSON.
            return Object.assign({}, sesion, {
                titulo: publicada.title || sesion.titulo,
                fecha: publicada.date || sesion.fecha,
                hecha: true,
            });
        })
        // Por número de sesión y de la primera a la última: una campaña
        // se lee en el orden en que se jugó, no al revés que un blog.
        .sort((a, b) => (Number(a.numero) || 0) - (Number(b.numero) || 0));

    if (!sesiones.length) {
        lista.innerHTML =
            '<li class="entries-empty">Todavía no hay notas de esta campaña.</li>';
        return;
    }
    lista.innerHTML = sesiones.map(filaDeSesion).join("");
}

function filaDeSesion(sesion) {
    const numero = Number(sesion.numero) || 0;
    const titulo = (sesion.titulo || "").trim();
    const fecha = (sesion.fecha || "").trim();
    const hecha = !!sesion.hecha;

    // El título de la página es "Sesión 4" o "Sesión 4 · El mercado", y
    // aquí al lado ya va escrito "sesión 4": sin quitarle esa parte, las
    // filas salían como "sesión 4   Sesión 4   03-10-2026". Una sesión sin
    // nombre se queda solo con su número y su fecha, que es suficiente.
    const corto = titulo
        .replace(/^\s*sesi[oó]n\s*\d+\s*(?:[·.:\-–—]\s*)?/i, "")
        .trim();

    // Dos líneas: arriba el número a la izquierda y la fecha a la
    // derecha, abajo el nombre de la sesión. En una sola línea, en cuanto
    // la sesión tenía nombre la fecha se caía debajo y acababa pegada al
    // número, que parecía otra fila. Y una sesión sin nombre se queda en
    // una línea sola, porque el trozo de abajo se va si está vacío.
    const dentro =
        '<span class="campana-sesion-meta">' +
        `<span class="campana-sesion-num">sesión ${escaparHtmlNotas(numero)}</span>` +
        (fecha
            ? `<span class="campana-sesion-fecha">${escaparHtmlNotas(fecha)}</span>`
            : "") +
        (hecha
            ? ""
            : '<span class="campana-sesion-aviso">sin publicar</span>') +
        "</span>" +
        `<span class="campana-sesion-titulo">${escaparHtmlNotas(corto)}</span>`;

    // El nombre que se lee en voz alta, de una vez y entero, en vez de
    // trozo a trozo: "sesión 1, El mercado, 03-10-2026".
    const nombre =
        `Sesión ${numero}` +
        (corto ? ", " + corto : "") +
        (fecha ? ", " + fecha : "") +
        (hecha ? "" : ". Todavía sin publicar");

    if (!hecha) {
        return (
            "<li>" +
            `<span class="campana-sesion is-pendiente" aria-label="${escaparHtmlNotas(nombre)}">` +
            dentro +
            "</span></li>"
        );
    }
    return (
        "<li>" +
        `<a class="campana-sesion" href="${escaparHtmlNotas(rutaSeguraNotas(sesion.url))}"` +
        ` aria-label="${escaparHtmlNotas(nombre)}">` +
        dentro +
        "</a></li>"
    );
}


// =========================================
// SEGURIDAD AL PINTAR
// =========================================
// Mismo criterio que en reto.js, relatos.js y rol.js: el JSON lo
// escribes tú, pero esto se pinta con innerHTML, así que todo va
// escapado y las direcciones se comprueban.

function escaparHtmlNotas(texto) {
    return (texto === null || texto === undefined ? "" : texto.toString())
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function rutaSeguraNotas(url) {
    const limpia = (url || "").trim();
    if (/^(https?:|mailto:|\/|#)/i.test(limpia)) {
        return limpia;
    }
    return "#";
}
