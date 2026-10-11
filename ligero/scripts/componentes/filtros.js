/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/componentes/filtros.js
*/
const FILTROS_TODAS = "todas";
const FILTROS_PUESTAS = new WeakMap();
const FILTROS_DE_LA_URL = (new URLSearchParams(window.location.search).get("cat") || "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
montarFiltros();
document.addEventListener("filtros:actualizar", montarFiltros);
function pasaElBuscador(item) {
    return window.buscador ? window.buscador.pasa(item) : true;
}
document.addEventListener("buscar:cambiado", () => {
    document.querySelectorAll("[data-filtros]").forEach((caja) => pintarFiltro(caja, false));
});
function montarFiltros() {
    document.querySelectorAll("[data-filtros]").forEach((caja) => {
        const items = elementosFiltrables(caja);
        const lista = caja.querySelector(".filtros-list");
        if (!lista) {
            return;
        }
        if (!items.length) {
            return;
        }
        const categorias = categoriasDe(caja, items);
        if (categorias.length < 2) {
            caja.hidden = true;
            return;
        }
        caja.hidden = false;
        lista.textContent = "";
        [FILTROS_TODAS, ...categorias].forEach((categoria) => {
            const boton = document.createElement("button");
            boton.type = "button";
            boton.className = "filtro-btn";
            boton.textContent = categoria;
            boton.setAttribute("data-categoria", categoria);
            boton.setAttribute("aria-pressed", "false");
            boton.addEventListener("click", () => alternarFiltro(caja, categoria));
            lista.appendChild(boton);
        });
        montarDesplegable(caja);
        const guardadas = FILTROS_PUESTAS.get(caja);
        const puestas =
            guardadas ||
            new Set(
                FILTROS_DE_LA_URL
                    .map((pedida) => comoSeLlamaDeVerdad(pedida, categorias))
                    .filter(Boolean)
            );
        FILTROS_PUESTAS.set(caja, puestas);
        pintarFiltro(caja, false);
    });
}
function comoSeLlamaDeVerdad(pedida, categorias) {
    const llana = aplanarFiltro(pedida);
    return categorias.find((c) => aplanarFiltro(c) === llana) || "";
}
function aplanarFiltro(texto) {
    return (texto || "")
        .toString()
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "");
}
function elementosFiltrables(caja) {
    const selector = caja.getAttribute("data-filtros-items");
    return selector ? [...document.querySelectorAll(selector)] : [];
}
function categoriasDeUno(elemento) {
    return (elemento.getAttribute("data-categoria") || "")
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
}
function categoriasDe(caja, items) {
    const declaradas = (caja.getAttribute("data-filtros-categorias") || "")
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
    const usadas = items.reduce((todas, item) => todas.concat(categoriasDeUno(item)), []);
    const todas = [...new Set([...declaradas, ...usadas])];
    if ((caja.getAttribute("data-filtros-orden") || "").trim() === "aparicion") {
        return todas;
    }
    return todas.sort((a, b) => a.localeCompare(b, "es"));
}
function alternarFiltro(caja, categoria) {
    const puestas = FILTROS_PUESTAS.get(caja) || new Set();
    const limpiando = categoria === FILTROS_TODAS;
    if (limpiando) {
        puestas.clear();
    } else if (puestas.has(categoria)) {
        puestas.delete(categoria);
    } else {
        puestas.add(categoria);
    }
    FILTROS_PUESTAS.set(caja, puestas);
    pintarFiltro(caja, limpiando);
}
function pintarFiltro(caja, cerrar) {
    const puestas = FILTROS_PUESTAS.get(caja) || new Set();
    caja.querySelectorAll(".filtro-btn").forEach((boton) => {
        const suya = boton.getAttribute("data-categoria");
        const activa = suya === FILTROS_TODAS ? puestas.size === 0 : puestas.has(suya);
        boton.setAttribute("aria-pressed", activa ? "true" : "false");
    });
    const items = elementosFiltrables(caja);
    let visibles = 0;
    items.forEach((item) => {
        const suyas = categoriasDeUno(item);
        const fuera =
            (puestas.size !== 0 && !suyas.some((c) => puestas.has(c)))
            || !pasaElBuscador(item);
        item.hidden = fuera;
        if (!fuera) {
            visibles += 1;
        }
    });
    const vacio = document.querySelector("[data-filtros-vacio]");
    if (vacio) {
        const buscando = !!(window.buscador && window.buscador.texto);
        const filtrando = puestas.size !== 0 && !buscando;
        vacio.hidden = visibles !== 0 || !filtrando;
        vacio.textContent =
            visibles === 0 && filtrando
                ? `Todavía no hay nada en ${listaEnTexto([...puestas])}. Próximamente.`
                : "";
    }
    const etiqueta = caja.querySelector("[data-filtros-label]");
    if (etiqueta) {
        etiqueta.textContent = resumenCategorias(puestas);
    }
    if (cerrar) {
        cerrarDesplegable(caja);
    }
    guardarFiltroEnUrl([...puestas]);
    if (window.buscador) {
        window.buscador.repasar();
    }
    document.dispatchEvent(
        new CustomEvent("filtros:cambiado", { detail: { puestas: [...puestas] } })
    );
}
function resumenCategorias(puestas) {
    if (puestas.size === 0) {
        return FILTROS_TODAS;
    }
    if (puestas.size === 1) {
        return [...puestas][0];
    }
    return `${puestas.size} categorías`;
}
function listaEnTexto(nombres) {
    const entrecomillados = nombres.map((n) => `«${n}»`);
    if (entrecomillados.length <= 1) {
        return entrecomillados.join("");
    }
    const ultimo = entrecomillados.pop();
    return `${entrecomillados.join(", ")} ni ${ultimo}`;
}
function montarDesplegable(caja) {
    const boton = caja.querySelector("[data-filtros-toggle]");
    if (!boton || boton.dataset.montado === "si") {
        return;
    }
    boton.dataset.montado = "si";
    boton.addEventListener("click", () => {
        if (caja.classList.contains("is-open")) {
            cerrarDesplegable(caja);
            return;
        }
        caja.classList.add("is-open");
        boton.setAttribute("aria-expanded", "true");
        const puesta = caja.querySelector('.filtro-btn[aria-pressed="true"]');
        if (puesta) {
            puesta.focus({ preventScroll: true });
        }
    });
    caja.addEventListener("keydown", (evento) => {
        if (evento.key === "Escape" && caja.classList.contains("is-open")) {
            evento.preventDefault();
            cerrarDesplegable(caja);
            boton.focus();
            return;
        }
        const botones = [...caja.querySelectorAll(".filtro-btn")];
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
            cerrarDesplegable(caja);
        }
    });
}
function cerrarDesplegable(caja) {
    caja.classList.remove("is-open");
    const boton = caja.querySelector("[data-filtros-toggle]");
    if (boton) {
        boton.setAttribute("aria-expanded", "false");
    }
}
function guardarFiltroEnUrl(categorias) {
    if (!window.history || !window.history.replaceState) {
        return;
    }
    const url = new URL(window.location.href);
    if (!categorias.length) {
        url.searchParams.delete("cat");
    } else {
        url.searchParams.set("cat", categorias.join(","));
    }
    window.history.replaceState(null, "", url);
}
