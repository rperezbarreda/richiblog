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
//        data-filtros-categorias="aventuras, mapas, sistemas"
//        data-filtros-orden="aparicion">   <- opcional, ver categoriasDe
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

// LO QUE PEDÍA LA DIRECCIÓN AL ABRIR, leído AQUÍ y no cuando se montan los
// botones. Parece un rodeo y no lo es: en un listado que llega por fetch
// (la wiki del mundo, los relatos) los botones se montan más tarde, y por
// el camino el buscador repinta el filtro con la selección vacía, lo que
// guarda un filtro vacío en la dirección y se lleva por delante el ?cat=
// con el que se acababa de llegar. Se notaba al pulsar una etiqueta en una
// página del mundo: aterrizabas en el índice sin el filtro puesto.
const FILTROS_DE_LA_URL = (new URLSearchParams(window.location.search).get("cat") || "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

montarFiltros();

// El listado de relatos llega por fetch, así que cuando esto se
// ejecuta todavía no hay ningún <li>. El propio relatos.js avisa al
// acabar de pintar.
document.addEventListener("filtros:actualizar", montarFiltros);

// Se ha escrito en el buscador (scripts/componentes/buscador.js). Él no
// esconde nada: avisa, y se vuelve a repartir lo que se ve desde aquí,
// que es donde vive esa decisión. Sin montar otra vez los botones: las
// categorías son las mismas, y remontarlos perdería lo que hubiera
// puesto.
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

        // TODAVÍA NO HAY NADA QUE FILTRAR: la lista se pinta desde un JSON
        // y aún no ha llegado. No se esconde la fila: esconderla aquí y
        // volver a enseñarla al llegar los datos empujaba la lista entera
        // hacia abajo cuando ya se estaba mirando (medido en la página de
        // npcs: 59 px, la mitad del salto de maqueta). Se espera a los
        // datos, que vuelven a llamar aquí con "filtros:actualizar".
        if (!items.length) {
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
                FILTROS_DE_LA_URL
                    .map((pedida) => comoSeLlamaDeVerdad(pedida, categorias))
                    .filter(Boolean)
            );
        FILTROS_PUESTAS.set(caja, puestas);
        pintarFiltro(caja, false);
    });
}

// La categoría que pide la dirección, buscada SIN mirar mayúsculas ni
// tildes: un ?cat=pais tiene que encontrar la etiqueta «País». Devuelve el
// nombre tal y como está escrito en la página, que es el que entiende todo
// lo demás, o "" si no existe ninguna así.
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

// LAS CATEGORÍAS DE UNA COSA, siempre como lista.
//
// Casi todo el sitio pone UNA en data-categoria ("mapas", "Sirevia") y
// entonces la lista tiene un elemento. Pero una página de la wiki del
// mundo puede tener varias etiquetas a la vez —una ciudad es "ciudad" y
// "comercio" y "río"— y ahí van separadas por comas:
//
//     data-categoria="ciudad, comercio, río"
//
// Separar siempre por comas no cambia nada para quien pone una sola:
// "mapas" sin comas sale como ["mapas"]. Lo que sí permite es que una cosa
// salga al filtrar por cualquiera de las suyas, que es lo que se espera de
// una etiqueta.
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
    // Por orden alfabético, que es lo que se espera de una lista de
    // categorías sueltas. Con data-filtros-orden="aparicion" se respeta
    // en cambio el orden en que salen en la página: eso lo usan las
    // recomendaciones, donde los botones acompañan a unas ventanitas
    // que ya vienen ordenadas a mano en su JSON y encontrarlos en otro
    // orden despista.
    if ((caja.getAttribute("data-filtros-orden") || "").trim() === "aparicion") {
        return todas;
    }
    return todas.sort((a, b) => a.localeCompare(b, "es"));
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

    // Se suman, no se cruzan: con "mapas" y "recursos" puestos sale lo que
    // sea de cualquiera de los dos. Cruzarlas (lo que fuera de los dos a
    // la vez) no dejaría nada a la vista donde cada cosa lleva una sola
    // categoría, que es casi todo el sitio.
    //
    // El buscador es la otra condición, y con la categoría se CRUZA: con
    // "mapas" puesto y "bosque" escrito sale lo que sea un mapa Y lleve
    // "bosque". Quien esconde es esto y solo esto —el buscador no toca
    // ningún hidden— porque si los dos escondieran por su cuenta, el
    // último en pasar desharía lo del otro.
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

    // Una categoría declarada pero todavía sin nada dentro deja la
    // rejilla en blanco: sin este aviso parece que la página se ha
    // roto. role="status" en el HTML hace que se lea solo al cambiar.
    //
    // Solo cuando hay algún filtro puesto: si no hay ninguno y tampoco
    // hay nada que enseñar, es que el listado entero está vacío, y eso
    // ya lo dice el propio listado ("todavía no hay nada publicado").
    // Sin esta condición salía un "Todavía no hay nada en ." con el
    // hueco de la categoría en blanco.
    const vacio = document.querySelector("[data-filtros-vacio]");
    if (vacio) {
        // Y solo cuando no se está buscando nada: si la página se ha
        // quedado vacía por lo que se ha escrito, quien lo explica es la
        // cuenta del buscador ("ningún relato con «zzz»"), y un
        // "todavía no hay nada en «microrelato»" al lado diría algo que
        // no es verdad — haberlos, los puede haber.
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

    // Se ha cambiado de categoría, así que lo que se ve es otra cosa:
    // el buscador vuelve a resaltar y a poner su cuenta al día.
    if (window.buscador) {
        window.buscador.repasar();
    }

    // Quien quiera enseñar u ocultar algo según el filtro puesto —las
    // tarjetas de los retos, en el listado de relatos— se engancha
    // aquí en vez de mirar los botones por su cuenta.
    document.dispatchEvent(
        new CustomEvent("filtros:cambiado", { detail: { puestas: [...puestas] } })
    );
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
