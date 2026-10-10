// =========================================
// ENTRADAS DEL BLOG — leídas desde datos/entradas-blog.json
// =========================================
// Un único punto de datos para no tener que actualizar dos sitios
// a mano cada vez que se publica: este script rellena tanto
// "nuevas entradas" de la portada como el archivo del año, leyendo
// siempre del mismo datos/entradas-blog.json.
//
// El JSON ya no se escribe a mano: lo genera
// herramientas/3-generadores/generar-posts.py leyendo las propias páginas. Para
// publicar, lo más cómodo es  python herramientas/1-publicar/nuevo.py ,
// que crea la entrada y pasa los generadores.

const BLOG_POSTS_URL = "/datos/entradas-blog.json";

// Cuatro y no seis: la ventana las coloca en dos columnas, así que un
// número par llena las dos filas enteras y no deja ninguna suelta al
// final (con 5 publicadas quedaba una sola en la columna izquierda y
// cantaba). Cuatro entran a la vista sin tener que desplazar nada.
// Si quieres ver más, están todas en su listado.
const HOME_RECENT_COUNT = 4;

initializeBlogPosts();

async function initializeBlogPosts() {
    const homeList = document.getElementById("home-recent-entries");
    const archiveRoot = document.getElementById("blog-archive");

    if (!homeList && !archiveRoot) {
        return;
    }

    try {
        const response = await window.pedirDatos(BLOG_POSTS_URL);
        if (!response.ok) {
            throw new Error("La respuesta no fue correcta");
        }
        const posts = await response.json();
        const sorted = Array.isArray(posts)
            ? posts.slice().sort((a, b) => parsePostDate(b.date) - parsePostDate(a.date))
            : [];

        if (homeList) {
            renderHomeEntries(homeList, sorted);
        }
        if (archiveRoot) {
            renderArchive(archiveRoot, sorted);
            initializeTagFilters(archiveRoot);
            // Después de las etiquetas: el buscador necesita que los
            // botones ya estén puestos para no deshacer lo que llegue
            // por la dirección (?tag=diario&buscar=sims).
            initializeBuscador(archiveRoot, sorted);
        }
    } catch (error) {
        if (homeList) {
            homeList.innerHTML =
                '<li class="entries-error">No se han podido cargar las entradas ahora mismo.</li>';
        }
        if (archiveRoot) {
            archiveRoot.querySelectorAll("[data-month]").forEach((list) => {
                list.innerHTML =
                    '<li class="entries-error">No se han podido cargar las entradas ahora mismo.</li>';
            });
        }
    }
}

// =========================================
// FECHAS — formato dd-mm-aaaa en el JSON
// =========================================

function parsePostDate(rawDate) {
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

function formatPostDate(rawDate) {
    const parsed = parsePostDate(rawDate);
    if (isNaN(parsed.getTime())) {
        return "";
    }
    return parsed.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

// =========================================
// PORTADA — "nuevas entradas"
// =========================================

function renderHomeEntries(homeList, posts) {
    const latest = posts.slice(0, HOME_RECENT_COUNT);

    if (latest.length === 0) {
        homeList.innerHTML =
            '<li class="entries-empty">Todavía no hay entradas publicadas.</li>';
        return;
    }

    // En la portada, sin el tiempo de lectura: ahí la ventana es
    // estrecha y lo que importa es el titular. Los minutos están en el
    // archivo del año, que es donde se elige qué leer.
    homeList.innerHTML = latest.map((post) => postToEntryCard(post, false)).join("");

    // Y los títulos, cortados a lo que quepa de verdad en la caja. Lo
    // mide scripts/componentes/recortar-titulos.js; aquí solo se le
    // avisa de que ya hay lista que medir.
    if (typeof window.recortarTitulos === "function") {
        window.recortarTitulos(homeList);
    }
}

// =========================================
// ARCHIVO DEL AÑO — un <details> por mes
// =========================================

function renderArchive(archiveRoot, posts) {
    const monthLists = archiveRoot.querySelectorAll("[data-month]");

    monthLists.forEach((list) => {
        const month = list.getAttribute("data-month"); // p.ej. "2026-09"
        const [year, monthNumber] = month.split("-").map(Number);

        const monthPosts = posts.filter((post) => {
            const parsed = parsePostDate(post.date);
            return (
                !isNaN(parsed.getTime()) &&
                parsed.getFullYear() === year &&
                parsed.getMonth() + 1 === monthNumber
            );
        });

        if (monthPosts.length === 0) {
            list.innerHTML =
                '<li class="entries-empty">Todavía no hay entradas este mes.</li>';
            return;
        }

        list.innerHTML = monthPosts.map((post) => postToEntryCard(post, true)).join("");
    });
}

// =========================================
// COMPARTIDO
// =========================================

function postToEntryCard(post, conMinutos) {
    // El título va ENTERO. En la portada lo recorta después
    // scripts/componentes/recortar-titulos.js, midiendo el hueco que
    // tiene de verdad; aquí no se puede saber, que depende del ancho de
    // la pantalla y del tamaño de letra elegido.
    const title = escapeHtml((post.title || "Sin título").trim());
    const date = formatPostDate(post.date);
    const url = post.url || "#";

    const tags = Array.isArray(post.tags) ? post.tags : [];
    // data-tags permite filtrar sin repintar la lista: los <li> ya están,
    // solo se esconden los que no toquen.
    const marcaTags = tags.length
        ? ` data-tags="${escapeHtml(tags.join(" "))}"`
        : "";
    // Cada etiqueta lleva al archivo del año filtrado por ella. Van
    // fuera del <a> del título: un enlace dentro de otro no es HTML
    // válido y el navegador lo deshace a su manera.
    const etiquetas = tags.length
        ? '<span class="entry-preview-tags">' +
          tags
              .map(
                  (t) =>
                      `<a class="entry-tag" href="${escapeHtml(urlDeEtiqueta(post, t))}"` +
                      ` data-tag="${escapeHtml(t)}">${escapeHtml(t)}</a>`
              )
              .join("") +
          "</span>"
        : "";

    return (
        `<li class="entry-preview"${marcaTags}>` +
        `<a class="entry-preview-link" href="${escapeHtml(urlSegura(url))}">` +
        `<span class="entry-preview-title">${title}</span>` +
        '<span class="entry-preview-meta">' +
        `<time class="entry-preview-date" datetime="${escapeHtml(fechaISO(post.date))}">${date}</time>` +
        (conMinutos ? minutosDe(post) : "") +
        "</span>" +
        "</a>" +
        etiquetas +
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

// El archivo del año al que lleva una etiqueta. El año sale de la propia
// ruta de la entrada (/web/blog/2026/...) y, si ahí no hay nada que
// sacar, de su fecha: así al abrir 2027 los enlaces apuntan solos al
// archivo de 2027 sin tocar este archivo.
function urlDeEtiqueta(post, tag) {
    const enRuta = (post.url || "").match(/\/blog\/(\d{4})\//);
    const fecha = parsePostDate(post.date);
    const anyo = enRuta
        ? enRuta[1]
        : isNaN(fecha.getTime())
        ? new Date().getFullYear()
        : fecha.getFullYear();
    return `/web/blog/${anyo}/index_${anyo}.html?tag=${encodeURIComponent(tag)}`;
}

// =========================================
// FILTRO POR ETIQUETA (archivo del año)
// =========================================
// Los botones salen de las etiquetas que existan de verdad en el JSON, así
// que no hay ninguna lista que mantener a mano. Filtrar solo esconde <li>
// y bloques de mes: no se vuelve a pedir nada ni se repinta.
//
// Se pueden tener VARIAS puestas a la vez y se suman: con "diario" y
// "pelis" se ven las entradas que lleven cualquiera de las dos, no solo
// las que lleven las dos (que casi siempre serían ninguna). Volver a
// pulsar una la quita. "todas" no es una etiqueta más: al pulsarla se
// vacía la selección entera, y si se quita la última que quedaba se
// vuelve sola a "todas" — así no hay forma de acabar en una página en
// blanco sin saber por qué.

// Qué etiquetas están puestas ahora mismo. Vacío = todas.
const ETIQUETAS_PUESTAS = new Set();

function initializeTagFilters(archiveRoot) {
    const caja = document.querySelector("[data-blog-tags]");
    const lista = caja && caja.querySelector(".blog-tags-list");

    // Las etiquetas salen de las entradas que hay EN ESTA página, no de
    // todo el JSON: en el archivo de un año que solo tenga entradas de
    // diario, ofrecer "opiniones" es ofrecer un botón que deja la
    // página en blanco.
    const todas = [
        ...new Set(
            [...archiveRoot.querySelectorAll(".entry-preview[data-tags]")].flatMap((li) =>
                partirEtiquetas(li.getAttribute("data-tags"))
            )
        ),
    ].sort();

    // Con una etiqueta o ninguna, los botones no sirven de nada; el
    // filtro por URL sí puede seguir llegando, así que eso va aparte.
    if (caja && lista && todas.length >= 2) {
        ["todas", ...todas].forEach((tag) => {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "blog-tag-btn";
            b.textContent = tag;
            b.setAttribute("data-tag", tag);
            b.setAttribute("aria-pressed", tag === "todas" ? "true" : "false");
            b.addEventListener("click", () => alternarEtiqueta(archiveRoot, tag));
            lista.appendChild(b);
        });
        caja.hidden = false;
        montarDesplegableTags(caja);
    }

    // Las etiquetas de cada entrada son enlaces a esta misma página con
    // ?tag=... Estando ya aquí no hace falta recargar: se filtra en el
    // sitio y se deja la dirección actualizada, para que el enlace
    // siga valiendo si alguien lo copia o recarga.
    // Ojo: esto NO suma a lo que hubiera puesto. Pulsar la etiqueta de
    // una entrada es decir "enséñame esto", igual que si se llegara al
    // enlace desde fuera; para sumar están los botones de arriba.
    archiveRoot.addEventListener("click", (evento) => {
        const etiqueta = evento.target.closest(".entry-tag");
        if (!etiqueta) {
            return;
        }
        evento.preventDefault();
        const suya = etiqueta.getAttribute("data-tag") || "";
        ETIQUETAS_PUESTAS.clear();
        if (suya) {
            ETIQUETAS_PUESTAS.add(suya);
        }
        pintarFiltroEtiquetas(archiveRoot, true);
    });

    // Se llega desde la portada con ?tag=diario, o con varias separadas
    // por comas (?tag=diario,pelis), que es como las deja este mismo
    // script al filtrar: se aplican al abrir. Las que ya no existan en
    // este año se ignoran sin más.
    // partirEtiquetas ya corta por comas y por espacios, así que sirve
    // igual para "diario,pelis" que para una sola.
    const pedidas = partirEtiquetas(
        new URLSearchParams(window.location.search).get("tag")
    ).filter((tag) => todas.indexOf(tag) !== -1);
    if (pedidas.length) {
        pedidas.forEach((tag) => ETIQUETAS_PUESTAS.add(tag));
        pintarFiltroEtiquetas(archiveRoot, false);
    }
}

// Espacios o comas, lo mismo da: "diario, testeo" escrito a mano en el
// HTML daba una etiqueta llamada "diario," con su propio botón.
function partirEtiquetas(crudas) {
    return (crudas || "")
        .split(/[\s,]+/)
        .map((e) => e.trim())
        .filter(Boolean);
}

// Pulsar un botón: "todas" vacía la selección; cualquier otro la pone o
// la quita según estuviera. Quitar la última deja la selección vacía,
// que es exactamente lo mismo que "todas".
function alternarEtiqueta(archiveRoot, tag) {
    const limpiando = tag === "todas";
    if (limpiando) {
        ETIQUETAS_PUESTAS.clear();
    } else if (ETIQUETAS_PUESTAS.has(tag)) {
        ETIQUETAS_PUESTAS.delete(tag);
    } else {
        ETIQUETAS_PUESTAS.add(tag);
    }

    // El desplegable de móvil se queda abierto mientras se van marcando
    // etiquetas: cerrarlo en cada toque obligaría a volver a abrirlo
    // para poner la siguiente. Con "todas" sí se cierra, porque ahí ya
    // se ha terminado de elegir.
    pintarFiltroEtiquetas(archiveRoot, limpiando);
}

function pintarFiltroEtiquetas(archiveRoot, cerrar) {
    document.querySelectorAll(".blog-tag-btn").forEach((b) => {
        const suya = b.getAttribute("data-tag");
        const puesta =
            suya === "todas" ? ETIQUETAS_PUESTAS.size === 0 : ETIQUETAS_PUESTAS.has(suya);
        b.setAttribute("aria-pressed", puesta ? "true" : "false");
    });

    aplicarFiltros(archiveRoot);

    // En móvil el botón del desplegable enseña qué hay puesto. Con una
    // se dice cuál es; con varias no caben los nombres en el botón, así
    // que se dice cuántas y la lista de abajo enseña cuáles.
    const etiquetaBoton = document.querySelector("[data-blog-tags-label]");
    if (etiquetaBoton) {
        etiquetaBoton.textContent = resumenEtiquetas(ETIQUETAS_PUESTAS);
    }
    const caja = document.querySelector("[data-blog-tags]");
    if (caja && cerrar) {
        cerrarDesplegableTags(caja);
    }

    guardarEtiquetaEnUrl([...ETIQUETAS_PUESTAS]);
}

// Esconder y enseñar entradas es lo mismo para las etiquetas y para el
// buscador, así que lo hace una sola función: una entrada se ve si pasa
// LAS DOS cosas. Cuando esto estaba dentro del filtro de etiquetas,
// escribir en el buscador deshacía el filtro y al contrario.
function aplicarFiltros(archiveRoot) {
    archiveRoot.querySelectorAll(".entry-preview").forEach((li) => {
        li.hidden = !pasaEtiquetas(li) || !pasaBusquedaDelComponente(li);
    });

    // Un mes sin nada que enseñar se esconde entero: dejarlo con su cabecera
    // y el hueco vacío debajo parece que se ha roto algo.
    archiveRoot.querySelectorAll(".blog-month").forEach((mes) => {
        const quedan = [...mes.querySelectorAll(".entry-preview")].some((li) => !li.hidden);
        mes.hidden = !quedan;
    });

    // Ya está escondido lo que toca: ahora el buscador resalta lo que
    // coincide en lo que ha quedado a la vista y pone la cuenta al día.
    if (window.buscador) {
        window.buscador.repasar();
    }
}

// Sin el componente cargado (una página que no lo lleve), no filtra
// nada y el filtro de etiquetas sigue funcionando igual.
function pasaBusquedaDelComponente(li) {
    return window.buscador ? window.buscador.pasa(li) : true;
}

// Se suman, no se cruzan: basta con que la entrada lleve UNA de las
// puestas. Cruzarlas (pedir que las lleve todas) dejaría la página
// vacía en cuanto se marcan dos etiquetas que no coinciden nunca.
function pasaEtiquetas(li) {
    if (ETIQUETAS_PUESTAS.size === 0) {
        return true;
    }
    return partirEtiquetas(li.getAttribute("data-tags")).some((tag) =>
        ETIQUETAS_PUESTAS.has(tag)
    );
}

// Lo que se lee en el botón del desplegable de móvil: "todas", el
// nombre suelto o "3 etiquetas". Los nombres de varias no caben ahí;
// cuáles son se ve en la lista de abajo, con sus botones marcados.
function resumenEtiquetas(puestas) {
    if (puestas.size === 0) {
        return "todas";
    }
    if (puestas.size === 1) {
        return [...puestas][0];
    }
    return `${puestas.size} etiquetas`;
}

// =========================================
// EL BUSCADOR, EN ESTA PÁGINA
// =========================================
// Quien busca es scripts/componentes/buscador.js, que es el mismo de
// los relatos y del portfolio de rol. Aquí solo se hacen las dos cosas
// que son de esta página:
//
//   1. Esconder lo que no pasa. El buscador no esconde nada por su
//      cuenta: avisa, y esconde quien ya lo hacía (aquí, el filtro de
//      etiquetas de arriba), para que las dos cosas se sumen en vez de
//      pisarse.
//   2. El apunte de "y 2 en 2025". El archivo es de un año, así que
//      buscar algo de otro dejaría la página vacía sin explicar por
//      qué; como el JSON con TODAS las entradas ya está cargado, se
//      mira ahí y se ofrece el enlace al archivo de ese año, ya
//      buscando lo mismo.

const ANYO_DE_LA_PAGINA = { valor: 0 };
const TODAS_LAS_ENTRADAS = { lista: [] };

function initializeBuscador(archiveRoot, posts) {
    ANYO_DE_LA_PAGINA.valor = anyoDeLaPagina(archiveRoot);
    TODAS_LAS_ENTRADAS.lista = Array.isArray(posts) ? posts : [];

    if (!window.buscador) {
        return;
    }

    // Lo que el componente pega a la cuenta ("3 entradas con «x» · y 2
    // en 2025"). Le llega ya normalizado, sin tildes ni mayúsculas.
    window.buscadorApunte = apunteDeOtrosAnyos;

    document.addEventListener("buscar:cambiado", () => aplicarFiltros(archiveRoot));
    window.buscador.aplicar();
}

// El año de esta página, para saber qué entradas del JSON son de otros
// años. Sale de los propios bloques de mes (data-month="2026-09"), que
// es de donde se rellena todo lo demás.
function anyoDeLaPagina(archiveRoot) {
    const mes = archiveRoot.querySelector("[data-month]");
    const anyo = mes && Number((mes.getAttribute("data-month") || "").split("-")[0]);
    return anyo || new Date().getFullYear();
}

// Cuántas entradas de OTROS años coinciden, por año y de más nuevo a
// más viejo, como enlaces a su archivo. No cuentan las etiquetas
// puestas: son de este año y en otro puede que no existan.
function apunteDeOtrosAnyos(aguja) {
    if (!aguja) {
        return "";
    }
    const normalizar = window.buscador.normalizar;
    const porAnyo = new Map();
    TODAS_LAS_ENTRADAS.lista.forEach((post) => {
        const fecha = parsePostDate(post.date);
        if (isNaN(fecha.getTime()) || fecha.getFullYear() === ANYO_DE_LA_PAGINA.valor) {
            return;
        }
        // Lo mismo que mira el buscador en las entradas de esta página:
        // título, fecha y etiquetas.
        const suyos = [post.title, formatPostDate(post.date)]
            .concat(window.buscador.formasDeFecha(fechaISO(post.date)))
            .concat(Array.isArray(post.tags) ? post.tags : []);
        if (suyos.some((texto) => normalizar(texto).indexOf(aguja) !== -1)) {
            const anyo = fecha.getFullYear();
            porAnyo.set(anyo, (porAnyo.get(anyo) || 0) + 1);
        }
    });
    if (!porAnyo.size) {
        return "";
    }
    return (
        "y " +
        [...porAnyo.entries()]
            .sort((a, b) => b[0] - a[0])
            .map(
                ([anyo, cuantas]) =>
                    `<a class="buscar-apunte" href="${enlaceDeAnyo(anyo)}">` +
                    `${cuantas} en ${anyo}</a>`
            )
            .join(", ")
    );
}

function enlaceDeAnyo(anyo) {
    return escapeHtml(
        `/web/blog/${anyo}/index_${anyo}.html?buscar=` +
            encodeURIComponent(window.buscador.texto)
    );
}

// =========================================
// DESPLEGABLE DE ETIQUETAS (solo se ve en móvil)
// =========================================
// Mismo patrón que las categorías del portfolio de rol: en escritorio
// las etiquetas son una fila de botones y esto no se ve; en móvil la
// fila no cabe, así que el CSS la convierte en una lista flotante y este
// botón dice cuál está puesta. Quién enseña qué lo decide entero el CSS
// por ancho de pantalla, así que aquí no hace falta mirar el ancho.

function montarDesplegableTags(caja) {
    const boton = caja.querySelector("[data-blog-tags-toggle]");
    if (!boton) {
        return;
    }

    boton.addEventListener("click", () => {
        if (caja.classList.contains("is-open")) {
            cerrarDesplegableTags(caja);
            return;
        }
        caja.classList.add("is-open");
        boton.setAttribute("aria-expanded", "true");

        // El foco va a la etiqueta activa para poder seguir con las
        // flechas nada más abrir. preventScroll porque la lista sale
        // justo debajo del botón: sin eso el navegador desplazaba la
        // página para "traerla a la vista" y abrir daba un salto.
        const puesta = caja.querySelector('.blog-tag-btn[aria-pressed="true"]');
        if (puesta) {
            puesta.focus({ preventScroll: true });
        }
    });

    // Las flechas recorren la lista, como en el portfolio.
    caja.addEventListener("keydown", (evento) => {
        if (evento.key === "Escape" && caja.classList.contains("is-open")) {
            evento.preventDefault();
            cerrarDesplegableTags(caja);
            boton.focus();
            return;
        }

        const botones = [...caja.querySelectorAll(".blog-tag-btn")];
        const actual = botones.indexOf(evento.target);
        if (actual === -1) {
            return;
        }
        let destino = null;
        if (evento.key === "ArrowDown" || evento.key === "ArrowRight") {
            destino = (actual + 1) % botones.length;
        } else if (evento.key === "ArrowUp" || evento.key === "ArrowLeft") {
            destino = (actual - 1 + botones.length) % botones.length;
        } else if (evento.key === "Home") {
            destino = 0;
        } else if (evento.key === "End") {
            destino = botones.length - 1;
        } else {
            return;
        }
        evento.preventDefault();
        botones[destino].focus();
    });

    document.addEventListener("click", (evento) => {
        if (caja.classList.contains("is-open") && !caja.contains(evento.target)) {
            cerrarDesplegableTags(caja);
        }
    });
}

function cerrarDesplegableTags(caja) {
    caja.classList.remove("is-open");
    const boton = caja.querySelector("[data-blog-tags-toggle]");
    if (boton) {
        boton.setAttribute("aria-expanded", "false");
    }
}

// Las etiquetas puestas van en la dirección separadas por comas, para
// que el enlace se pueda copiar o recargar con la misma vista. Sin
// ninguna, el parámetro desaparece en vez de quedarse vacío. El ?buscar=
// lo pone el componente del buscador, cada uno toca solo el suyo.
// Se llama así, y no guardarFiltroEnUrl, porque ese nombre ya lo usa
// scripts/componentes/filtros.js para lo suyo (el ?cat= de rol y
// relatos). Aquí todos los scripts comparten el mismo global: dos
// funciones con el mismo nombre se pisan aunque hoy no coincidan en
// ninguna página. Lo comprueba herramientas/4-comprobar/nombres-repetidos.py.
function guardarEtiquetaEnUrl(tags) {
    if (!window.history || !window.history.replaceState) {
        return;
    }
    const url = new URL(window.location.href);
    if (!tags.length) {
        url.searchParams.delete("tag");
    } else {
        url.searchParams.set("tag", tags.join(","));
    }
    window.history.replaceState(null, "", url);
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
