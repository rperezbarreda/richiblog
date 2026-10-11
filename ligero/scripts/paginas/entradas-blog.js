/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/paginas/entradas-blog.js
*/
const BLOG_POSTS_URL = "/datos/blog/entradas-blog.json";
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
function renderHomeEntries(homeList, posts) {
    const latest = posts.slice(0, HOME_RECENT_COUNT);
    if (latest.length === 0) {
        homeList.innerHTML =
            '<li class="entries-empty">Todavía no hay entradas publicadas.</li>';
        return;
    }
    homeList.innerHTML = latest.map((post) => postToEntryCard(post, false)).join("");
    if (typeof window.recortarTitulos === "function") {
        window.recortarTitulos(homeList);
    }
}
function renderArchive(archiveRoot, posts) {
    const monthLists = archiveRoot.querySelectorAll("[data-month]");
    monthLists.forEach((list) => {
        const month = list.getAttribute("data-month");
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
function postToEntryCard(post, conMinutos) {
    const title = escapeHtml((post.title || "Sin título").trim());
    const date = formatPostDate(post.date);
    const url = post.url || "#";
    const tags = Array.isArray(post.tags) ? post.tags : [];
    const marcaTags = tags.length
        ? ` data-tags="${escapeHtml(tags.join(" "))}"`
        : "";
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
function minutosDe(item) {
    const minutos = Number(item && item.minutos);
    if (!minutos || minutos < 1) {
        return "";
    }
    return `<span class="entry-preview-minutos">${minutos} min</span>`;
}
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
const ETIQUETAS_PUESTAS = new Set();
function initializeTagFilters(archiveRoot) {
    const caja = document.querySelector("[data-blog-tags]");
    const lista = caja && caja.querySelector(".blog-tags-list");
    const todas = [
        ...new Set(
            [...archiveRoot.querySelectorAll(".entry-preview[data-tags]")].flatMap((li) =>
                partirEtiquetas(li.getAttribute("data-tags"))
            )
        ),
    ].sort();
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
    const pedidas = partirEtiquetas(
        new URLSearchParams(window.location.search).get("tag")
    ).filter((tag) => todas.indexOf(tag) !== -1);
    if (pedidas.length) {
        pedidas.forEach((tag) => ETIQUETAS_PUESTAS.add(tag));
        pintarFiltroEtiquetas(archiveRoot, false);
    }
}
function partirEtiquetas(crudas) {
    return (crudas || "")
        .split(/[\s,]+/)
        .map((e) => e.trim())
        .filter(Boolean);
}
function alternarEtiqueta(archiveRoot, tag) {
    const limpiando = tag === "todas";
    if (limpiando) {
        ETIQUETAS_PUESTAS.clear();
    } else if (ETIQUETAS_PUESTAS.has(tag)) {
        ETIQUETAS_PUESTAS.delete(tag);
    } else {
        ETIQUETAS_PUESTAS.add(tag);
    }
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
function aplicarFiltros(archiveRoot) {
    archiveRoot.querySelectorAll(".entry-preview").forEach((li) => {
        li.hidden = !pasaEtiquetas(li) || !pasaBusquedaDelComponente(li);
    });
    archiveRoot.querySelectorAll(".blog-month").forEach((mes) => {
        const quedan = [...mes.querySelectorAll(".entry-preview")].some((li) => !li.hidden);
        mes.hidden = !quedan;
    });
    if (window.buscador) {
        window.buscador.repasar();
    }
}
function pasaBusquedaDelComponente(li) {
    return window.buscador ? window.buscador.pasa(li) : true;
}
function pasaEtiquetas(li) {
    if (ETIQUETAS_PUESTAS.size === 0) {
        return true;
    }
    return partirEtiquetas(li.getAttribute("data-tags")).some((tag) =>
        ETIQUETAS_PUESTAS.has(tag)
    );
}
function resumenEtiquetas(puestas) {
    if (puestas.size === 0) {
        return "todas";
    }
    if (puestas.size === 1) {
        return [...puestas][0];
    }
    return `${puestas.size} etiquetas`;
}
const ANYO_DE_LA_PAGINA = { valor: 0 };
const TODAS_LAS_ENTRADAS = { lista: [] };
function initializeBuscador(archiveRoot, posts) {
    ANYO_DE_LA_PAGINA.valor = anyoDeLaPagina(archiveRoot);
    TODAS_LAS_ENTRADAS.lista = Array.isArray(posts) ? posts : [];
    if (!window.buscador) {
        return;
    }
    window.buscadorApunte = apunteDeOtrosAnyos;
    document.addEventListener("buscar:cambiado", () => aplicarFiltros(archiveRoot));
    window.buscador.aplicar();
}
function anyoDeLaPagina(archiveRoot) {
    const mes = archiveRoot.querySelector("[data-month]");
    const anyo = mes && Number((mes.getAttribute("data-month") || "").split("-")[0]);
    return anyo || new Date().getFullYear();
}
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
        const puesta = caja.querySelector('.blog-tag-btn[aria-pressed="true"]');
        if (puesta) {
            puesta.focus({ preventScroll: true });
        }
    });
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
