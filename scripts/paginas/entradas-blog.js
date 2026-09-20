// =========================================
// ENTRADAS DEL BLOG — leídas desde datos/entradas-blog.json
// =========================================
// Un único punto de datos para no tener que actualizar dos sitios
// a mano cada vez que se publica: este script rellena tanto
// "nuevas entradas" de la portada como el archivo del año, leyendo
// siempre del mismo datos/entradas-blog.json.
//
// El JSON ya no se escribe a mano: lo genera
// herramientas/generar-posts.py leyendo las propias páginas. Para
// publicar, lo más cómodo es  python herramientas/nueva-entrada.py ,
// que crea la entrada y pasa los generadores.

const BLOG_POSTS_URL = "/datos/entradas-blog.json";
// Cuántas entradas enseña la ventana de la portada. La ventana tiene
// scroll propio (ver .recent-entries-body en paginas/portada.css), así que
// caben más de las que se ven de una vez: con 3 nunca había nada que
// desplazar y algo recién publicado con fecha vieja se quedaba fuera
// de la portada sin más.
const HOME_RECENT_COUNT = 6;

initializeBlogPosts();

async function initializeBlogPosts() {
    const homeList = document.getElementById("home-recent-entries");
    const archiveRoot = document.getElementById("blog-archive");

    if (!homeList && !archiveRoot) {
        return;
    }

    try {
        const response = await fetch(BLOG_POSTS_URL);
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

    homeList.innerHTML = latest.map(postToEntryCard).join("");
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

        list.innerHTML = monthPosts.map(postToEntryCard).join("");
    });
}

// =========================================
// COMPARTIDO
// =========================================

function postToEntryCard(post) {
    const title = escapeHtml(post.title || "Sin título");
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
        `<time class="entry-preview-date" datetime="${escapeHtml(fechaISO(post.date))}">${date}</time>` +
        "</a>" +
        etiquetas +
        "</li>"
    );
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
            b.addEventListener("click", () => aplicarFiltro(archiveRoot, tag));
            lista.appendChild(b);
        });
        caja.hidden = false;
        montarDesplegableTags(caja);
    }

    // Las etiquetas de cada entrada son enlaces a esta misma página con
    // ?tag=... Estando ya aquí no hace falta recargar: se filtra en el
    // sitio y se deja la dirección actualizada, para que el enlace
    // siga valiendo si alguien lo copia o recarga.
    archiveRoot.addEventListener("click", (evento) => {
        const etiqueta = evento.target.closest(".entry-tag");
        if (!etiqueta) {
            return;
        }
        evento.preventDefault();
        aplicarFiltro(archiveRoot, etiqueta.getAttribute("data-tag") || "todas");
    });

    // Se llega desde la portada con ?tag=diario: se aplica al abrir.
    const pedida = new URLSearchParams(window.location.search).get("tag");
    if (pedida && todas.indexOf(pedida) !== -1) {
        aplicarFiltro(archiveRoot, pedida);
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

function aplicarFiltro(archiveRoot, tag) {
    document.querySelectorAll(".blog-tag-btn").forEach((b) => {
        b.setAttribute("aria-pressed", b.getAttribute("data-tag") === tag ? "true" : "false");
    });

    archiveRoot.querySelectorAll(".entry-preview").forEach((li) => {
        const suyas = partirEtiquetas(li.getAttribute("data-tags"));
        li.hidden = tag !== "todas" && !suyas.includes(tag);
    });

    // Un mes sin nada que enseñar se esconde entero: dejarlo con su cabecera
    // y el hueco vacío debajo parece que se ha roto algo.
    archiveRoot.querySelectorAll(".blog-month").forEach((mes) => {
        const quedan = [...mes.querySelectorAll(".entry-preview")].some((li) => !li.hidden);
        mes.hidden = !quedan;
    });

    // En móvil el botón del desplegable enseña cuál está puesta.
    const etiquetaBoton = document.querySelector("[data-blog-tags-label]");
    if (etiquetaBoton) {
        etiquetaBoton.textContent = tag;
    }
    const caja = document.querySelector("[data-blog-tags]");
    if (caja) {
        cerrarDesplegableTags(caja);
    }

    guardarFiltroEnUrl(tag);
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

function guardarFiltroEnUrl(tag) {
    if (!window.history || !window.history.replaceState) {
        return;
    }
    const url = new URL(window.location.href);
    if (tag === "todas") {
        url.searchParams.delete("tag");
    } else {
        url.searchParams.set("tag", tag);
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
