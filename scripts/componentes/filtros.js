// =========================================
// COMPONENTE: FILTRO POR CATEGORÍA
// =========================================
// Una fila de botones para quedarse solo con una categoría de lo que
// haya debajo (las tarjetas del portfolio de rol, los relatos del
// listado...). Se ve igual que el filtro de etiquetas del archivo del
// blog, y sustituye a las pestañas que tenía el portfolio.
//
// LOS BOTONES NO SE ESCRIBEN A MANO. Salen de dos sitios:
//   1. La categoría que lleve cada elemento en data-categoria.
//   2. Las que se declaren en data-filtros-categorias, para que una
//      categoría todavía vacía siga teniendo su botón (es lo que
//      antes hacía la pestaña con el "Próximamente").
// Así, publicar algo con una categoría nueva la añade sola al filtro
// sin tocar esta página ni este archivo.
//
//   <div class="filtros" data-filtros
//        data-filtros-items=".portfolio-card"
//        data-filtros-categorias="aventuras, mapas, sistemas">
//       <span class="filtros-label" id="filtros-label">filtrar:</span>
//       <button data-filtros-toggle …>   <- solo se ve en móvil
//       <div class="filtros-list" id="filtros-lista" role="group"
//            aria-labelledby="filtros-label"></div>
//   </div>
//   <p class="filtros-vacio" data-filtros-vacio role="status" hidden></p>
//
// Si el listado lo pinta otro script (relatos.js lo saca de un JSON),
// ese script avisa cuando termina con:
//     document.dispatchEvent(new CustomEvent("filtros:actualizar"));
// y aquí se vuelven a contar las categorías.
//
// Se pueden tener VARIAS puestas a la vez y se suman: con "mapas" y
// "recursos" se ve lo que sea de cualquiera de las dos. Volver a pulsar
// una la quita. "todas" no es una categoría más: al pulsarla se vacía
// la selección entera, y si se quita la última que quedaba se vuelve
// sola a "todas", para no dejar la página en blanco sin explicación.

const FILTROS_TODAS = "todas";

// Qué categorías están puestas en cada caja de filtros. Vacío = todas.
// Va por caja y no en una variable suelta porque nada impide que una
// página acabe teniendo dos listados con su propio filtro.
const FILTROS_PUESTAS = new WeakMap();

montarFiltros();

// El listado de relatos llega por fetch, así que cuando esto se
// ejecuta todavía no hay ningún <li>. El propio relatos.js avisa al
// acabar de pintar.
document.addEventListener("filtros:actualizar", montarFiltros);

function montarFiltros() {
    document.querySelectorAll("[data-filtros]").forEach((caja) => {
        const items = elementosFiltrables(caja);
        const lista = caja.querySelector(".filtros-list");
        if (!lista) {
            return;
        }

        const categorias = categoriasDe(caja, items);

        // Con una categoría o ninguna los botones no dicen nada: se
        // esconde la fila entera en vez de dejar un "todas" suelto.
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

        // ?cat=... para poder enlazar una categoría concreta, o varias
        // separadas por comas (?cat=mapas,recursos), que es como las
        // deja este mismo script. Las que ya no existan se ignoran.
        //
        // Esto se vuelve a ejecutar cada vez que un listado termina de
        // pintarse (filtros:actualizar), así que lo que estuviera
        // puesto manda sobre la dirección: si no, al llegar los relatos
        // por fetch se perdería lo que se acabara de elegir.
        const guardadas = FILTROS_PUESTAS.get(caja);
        const puestas =
            guardadas ||
            new Set(
                (new URLSearchParams(window.location.search).get("cat") || "")
                    .split(",")
                    .map((c) => c.trim())
                    .filter((c) => categorias.indexOf(c) !== -1)
            );
        FILTROS_PUESTAS.set(caja, puestas);
        pintarFiltro(caja, false);
    });
}

function elementosFiltrables(caja) {
    const selector = caja.getAttribute("data-filtros-items");
    return selector ? [...document.querySelectorAll(selector)] : [];
}

function categoriaDe(elemento) {
    return (elemento.getAttribute("data-categoria") || "").trim();
}

function categoriasDe(caja, items) {
    const declaradas = (caja.getAttribute("data-filtros-categorias") || "")
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
    const usadas = items.map(categoriaDe).filter(Boolean);
    return [...new Set([...declaradas, ...usadas])].sort((a, b) => a.localeCompare(b, "es"));
}

// Pulsar un botón: "todas" vacía la selección; cualquier otro la pone o
// la quita según estuviera. Quitar la última deja la selección vacía,
// que es exactamente lo mismo que "todas".
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

    // El desplegable de móvil se queda abierto mientras se van marcando
    // categorías: cerrarlo en cada toque obligaría a volver a abrirlo
    // para poner la siguiente. Con "todas" sí se cierra, porque ahí ya
    // se ha terminado de elegir.
    pintarFiltro(caja, limpiando);
}

function pintarFiltro(caja, cerrar) {
    const puestas = FILTROS_PUESTAS.get(caja) || new Set();

    caja.querySelectorAll(".filtro-btn").forEach((boton) => {
        const suya = boton.getAttribute("data-categoria");
        const activa = suya === FILTROS_TODAS ? puestas.size === 0 : puestas.has(suya);
        boton.setAttribute("aria-pressed", activa ? "true" : "false");
    });

    // Se suman, no se cruzan: cada elemento lleva UNA categoría, así que
    // cruzarlas no dejaría nunca nada a la vista.
    const items = elementosFiltrables(caja);
    let visibles = 0;
    items.forEach((item) => {
        const fuera = puestas.size !== 0 && !puestas.has(categoriaDe(item));
        item.hidden = fuera;
        if (!fuera) {
            visibles += 1;
        }
    });

    // Una categoría declarada pero todavía sin nada dentro deja la
    // rejilla en blanco: sin este aviso parece que la página se ha
    // roto. role="status" en el HTML hace que se lea solo al cambiar.
    const vacio = document.querySelector("[data-filtros-vacio]");
    if (vacio) {
        vacio.hidden = visibles !== 0;
        vacio.textContent =
            visibles === 0
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
}

// Lo que se lee en el botón del desplegable de móvil: "todas", el
// nombre suelto o "3 categorías". Los nombres de varias no caben ahí;
// cuáles son se ve en la lista de abajo, con sus botones marcados.
function resumenCategorias(puestas) {
    if (puestas.size === 0) {
        return FILTROS_TODAS;
    }
    if (puestas.size === 1) {
        return [...puestas][0];
    }
    return `${puestas.size} categorías`;
}

// «mapas», «mapas» ni «sistemas», «a», «b» ni «c»: el aviso de vacío es
// una frase, y "no hay nada en «mapas», «sistemas»" no se lee como tal.
function listaEnTexto(nombres) {
    const entrecomillados = nombres.map((n) => `«${n}»`);
    if (entrecomillados.length <= 1) {
        return entrecomillados.join("");
    }
    const ultimo = entrecomillados.pop();
    return `${entrecomillados.join(", ")} ni ${ultimo}`;
}

// =========================================
// DESPLEGABLE (solo se ve en móvil)
// =========================================
// Mismo patrón que las etiquetas del blog: en escritorio los botones
// se ven en fila y el botón de abajo está escondido por CSS; en móvil
// la fila no cabe, así que la lista pasa a flotar y este botón dice
// cuál está puesta. Quién enseña qué lo decide entero el CSS por ancho
// de pantalla, así que aquí no se mira el ancho en ningún momento.

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

        // El foco va a la categoría activa para poder seguir con las
        // flechas nada más abrir. preventScroll porque la lista sale
        // justo debajo del botón: sin eso el navegador desplazaba la
        // página para "traerla a la vista" y abrir daba un salto.
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

// Las categorías puestas van en la dirección separadas por comas, para
// que el enlace se pueda copiar o recargar con la misma vista. Sin
// ninguna, el parámetro desaparece en vez de quedarse vacío.
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
