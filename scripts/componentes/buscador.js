// =========================================
// COMPONENTE: BUSCADOR
// =========================================
// Un campo que filtra, mientras se escribe, lo que YA está en la
// página: las entradas del archivo del blog, los relatos o las fichas
// del portfolio de rol. No pide nada al servidor (lo que se busca está
// todo en el DOM desde el principio) ni usa ninguna librería: son un
// par de comparaciones de texto por cosa listada, y aquí las cosas
// listadas se cuentan con los dedos.
//
// CÓMO SE PONE EN UNA PÁGINA
// --------------------------
//   <form class="buscar" role="search" data-buscar
//         data-buscar-items="#relatos-list .entry-preview"
//         data-buscar-en=".entry-preview-title, .entry-preview-date, .entry-tag"
//         data-buscar-nombre="relato|relatos">
//       <label class="buscar-label" for="buscar-campo">buscar:</label>
//       <div class="buscar-caja">
//           <input class="buscar-campo" type="search" id="buscar-campo" …>
//           <button class="buscar-limpiar" … data-buscar-limpiar hidden>…</button>
//       </div>
//       <p class="buscar-cuenta" role="status" data-buscar-cuenta></p>
//   </form>
//
//   data-buscar-items    qué se filtra.
//   data-buscar-en       qué partes de cada cosa se miran (y se
//                        resaltan). Lo que no esté aquí no se busca.
//   data-buscar-nombre   cómo se llama en la cuenta: "1 relato" /
//                        "3 relatos". Por defecto, "cosa|cosas".
//
// Además de eso, de cada cosa se mira siempre:
//   - su data-categoria, aunque no se vea escrita en la tarjeta (en el
//     portfolio de rol la categoría no se pinta, y buscar "mapas" tiene
//     que encontrar los mapas igual);
//   - la fecha de cualquier <time datetime> que haya dentro de lo que
//     se mira, en todas sus formas (ver formasDeFecha).
//
// CÓMO SE LLEVA CON EL FILTRO DE CATEGORÍAS
// -----------------------------------------
// Se suman: con la etiqueta "pelis" puesta y "sims" escrito sale lo que
// sea de pelis Y lleve "sims". Como quien esconde y enseña las cosas es
// el filtro (scripts/componentes/filtros.js) o la propia página (el
// archivo del blog), este componente no las esconde: dice quién pasa y
// avisa de que ha cambiado.
//
//   window.buscador.pasa(item)   ¿esta cosa pasa la búsqueda?
//   window.buscador.aplicar()    se ha escrito algo: avisa a quien
//                                esconde, y luego resalta y cuenta.
//   window.buscador.repasar()    alguien ha escondido cosas por su
//                                cuenta (se ha pulsado una categoría):
//                                vuelve a resaltar y a contar.
//   evento "buscar:cambiado"     lo que escucha quien esconde.
//
// Y al revés: quien pinte un listado por fetch avisa con
// "filtros:actualizar" (ya lo hacía para el filtro), y aquí se vuelve a
// aplicar lo que hubiera escrito o lo que venga en ?buscar= de la
// dirección.

const BUSCADOR = {
    texto: "",
    caja: null,     // el <form>
    campo: null,
};

// El texto de verdad de cada trozo que se resalta, guardado antes de
// meterle los <mark>. Si se leyera del propio HTML se irían acumulando
// marcas dentro de marcas al escribir la segunda letra.
const BUSCADOR_ORIGINALES = new WeakMap();

montarBuscador();

// Los listados llegan por fetch: cuando esto se ejecuta puede que
// todavía no haya ni una entrada. El script que las pinta avisa.
document.addEventListener("filtros:actualizar", () => {
    if (BUSCADOR.caja) {
        aplicarBusqueda();
    }
});

function montarBuscador() {
    const caja = document.querySelector("[data-buscar]");
    const campo = caja && caja.querySelector(".buscar-campo");
    if (!caja || !campo) {
        return;
    }
    BUSCADOR.caja = caja;
    BUSCADOR.campo = campo;

    // No hay nada que enviar: todo pasa aquí mismo. Sin esto, darle a
    // Enter (o a la tecla de buscar del móvil) recargaría la página.
    caja.addEventListener("submit", (evento) => evento.preventDefault());

    campo.addEventListener("input", () => {
        BUSCADOR.texto = campo.value.trim();
        desplazarArriba();
        aplicarBusqueda();
    });

    const limpiar = caja.querySelector("[data-buscar-limpiar]");
    if (limpiar) {
        limpiar.addEventListener("click", () => {
            vaciar();
            // El foco vuelve al campo: si se quedara en un botón que
            // acaba de desaparecer, el teclado se queda sin sitio.
            campo.focus();
        });
    }

    // Escape borra la búsqueda sin tener que buscar el botón.
    campo.addEventListener("keydown", (evento) => {
        if (evento.key === "Escape" && campo.value) {
            evento.preventDefault();
            vaciar();
        }
    });

    // Se puede llegar con la búsqueda hecha: ?buscar=sims. Así una
    // búsqueda se puede copiar, compartir y recargar.
    const pedida = (new URLSearchParams(window.location.search).get("buscar") || "").trim();
    if (pedida) {
        campo.value = pedida;
        BUSCADOR.texto = pedida;
    }
    aplicarBusqueda();
}

function vaciar() {
    BUSCADOR.campo.value = "";
    BUSCADOR.texto = "";
    aplicarBusqueda();
}

// Lo que se estuviera viendo ya no vale: con otra búsqueda las cosas de
// arriba son otras, y quedarse a media lista parece que no ha pasado
// nada. Se mueve la caja con scroll que haya, no la página entera.
function desplazarArriba() {
    const items = elementos();
    const dentro = items.length ? items[0].closest("[tabindex], .blog-months, main > section") : null;
    if (dentro) {
        dentro.scrollTop = 0;
    }
}

function elementos() {
    const selector = BUSCADOR.caja && BUSCADOR.caja.getAttribute("data-buscar-items");
    return selector ? [...document.querySelectorAll(selector)] : [];
}

function trozosDe(item) {
    const selector = (BUSCADOR.caja && BUSCADOR.caja.getAttribute("data-buscar-en")) || "";
    return selector ? [...item.querySelectorAll(selector)] : [];
}

// =========================================
// BUSCAR
// =========================================

// Minúsculas y sin tildes, pero LETRA A LETRA y conservando el tamaño:
// "Crepùsculo" -> "crepusculo", con la u en la misma posición que la ù.
// Eso es lo que permite resaltar el trozo que coincide en el texto de
// verdad. Con un normalize("NFD") de toda la cadena, cada tilde añade un
// carácter y las posiciones dejan de cuadrar.
function normalizar(texto) {
    let limpio = "";
    for (const letra of (texto === null || texto === undefined ? "" : texto.toString()).toLowerCase()) {
        const suelta = letra.normalize("NFD").replace(/[̀-ͯ]/g, "");
        limpio += suelta.length === letra.length ? suelta : letra;
    }
    return limpio;
}

// Los meses con su nombre entero. En un listado la fecha se pinta
// cortada ("21 sept 2026"), así que buscando "septiembre" no saldría
// nada: quien busca un mes lo escribe entero casi siempre.
const BUSCADOR_MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// Todas las formas razonables de escribir una fecha, para poder buscar
// por cualquiera de ellas: "2026-09-21", "21-09-2026", "21/09/2026",
// "21 septiembre 2026" y "septiembre 2026". Así valen tanto "sept" como
// "septiembre", tanto "2026" como "09-2026".
//
// Van en una lista y se comparan de una en una, no pegadas en un solo
// texto: pegadas, "...2026 septiembre 2026..." hacía que buscar
// "26 sept" sacara entradas de cualquier día del mes, por pillar el
// final de un año y el principio del mes siguiente.
function formasDeFecha(iso) {
    const partes = (iso || "").split("-");
    if (partes.length !== 3) {
        return [];
    }
    const [anyo, mes, dia] = partes;
    const nombre = BUSCADOR_MESES[Number(mes) - 1] || "";
    return [
        iso,
        `${dia}-${mes}-${anyo}`,
        `${dia}/${mes}/${anyo}`,
        `${dia} ${nombre} ${anyo}`,
        `${nombre} ${anyo}`,
    ];
}

// Todo lo que se mira de una cosa listada, como lista de textos sueltos.
function textosDe(item) {
    const textos = [item.getAttribute("data-categoria") || ""];
    trozosDe(item).forEach((trozo) => {
        textos.push(trozo.textContent);
        const cuando = trozo.matches("time") ? trozo : trozo.querySelector("time");
        if (cuando) {
            formasDeFecha(cuando.getAttribute("datetime")).forEach((forma) => textos.push(forma));
        }
    });
    return textos;
}

function pasa(item) {
    const aguja = normalizar(BUSCADOR.texto);
    if (!aguja) {
        return true;
    }
    return textosDe(item).some((texto) => normalizar(texto).indexOf(aguja) !== -1);
}

// =========================================
// RESALTAR LO QUE COINCIDE
// =========================================
// Además de verse bonito, es lo que explica por qué ha salido algo que
// no esperabas: la palabra puede estar en la fecha o en la descripción,
// no en el título.

function resaltar(item) {
    trozosDe(item).forEach((trozo) => resaltarEn(trozo, item.hidden));
}

function resaltarEn(elemento, escondida) {
    const original = textoOriginal(elemento);
    const aguja = normalizar(BUSCADOR.texto);
    const plano = normalizar(original);
    const donde0 = aguja ? plano.indexOf(aguja) : -1;

    if (!aguja || escondida || donde0 === -1) {
        // Quitar las marcas de la búsqueda anterior. Hay que mirar si
        // las hay, no comparar el texto: un <mark> no cambia el
        // textContent ("Día de <mark>a</mark>" sigue siendo "Día de a"),
        // así que comparando textos las marcas viejas se quedaban
        // pegadas y se iban acumulando a cada letra.
        if (elemento.querySelector("mark")) {
            elemento.textContent = original;
        }
        return;
    }

    let html = "";
    let desde = 0;
    let donde = donde0;
    while (donde !== -1) {
        html += escapar(original.slice(desde, donde));
        html +=
            '<mark class="buscar-marca">' +
            escapar(original.slice(donde, donde + aguja.length)) +
            "</mark>";
        desde = donde + aguja.length;
        donde = plano.indexOf(aguja, desde);
    }
    html += escapar(original.slice(desde));
    elemento.innerHTML = html;
}

function textoOriginal(elemento) {
    if (!BUSCADOR_ORIGINALES.has(elemento)) {
        BUSCADOR_ORIGINALES.set(elemento, elemento.textContent);
    }
    return BUSCADOR_ORIGINALES.get(elemento);
}

function escapar(texto) {
    return (texto === null || texto === undefined ? "" : texto.toString())
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// =========================================
// APLICAR Y CONTAR
// =========================================

function aplicarBusqueda() {
    // Primero que esconda quien tenga que esconder. Esto es síncrono:
    // cuando dispatchEvent vuelve, los hidden ya están puestos, y por
    // eso se puede contar y resaltar justo después.
    document.dispatchEvent(new CustomEvent("buscar:cambiado"));
    repasar();
    guardarBusquedaEnUrl();
}

function repasar() {
    if (!BUSCADOR.caja) {
        return;
    }
    let cuantas = 0;
    elementos().forEach((item) => {
        resaltar(item);
        if (!item.hidden) {
            cuantas += 1;
        }
    });
    contar(cuantas);
}

// La línea de debajo del campo: cuántas quedan y, si la página tiene
// algo más que decir (en el blog, que lo buscado está en otro año), su
// apunte. Sin esa línea, buscar algo que no está deja la página en
// blanco y parece que se ha roto.
function contar(cuantas) {
    const cuenta = BUSCADOR.caja.querySelector("[data-buscar-cuenta]");
    const limpiar = BUSCADOR.caja.querySelector("[data-buscar-limpiar]");
    if (limpiar) {
        limpiar.hidden = !BUSCADOR.texto;
    }
    // El CSS le deja sitio al ✕ solo cuando el ✕ está (ver
    // .buscar.tiene-texto en estilos/componentes/buscador.css).
    BUSCADOR.caja.classList.toggle("tiene-texto", !!BUSCADOR.texto);
    if (!cuenta) {
        return;
    }

    if (!BUSCADOR.texto) {
        cuenta.textContent = "";
        cuenta.classList.remove("is-vacio");
        return;
    }

    // "relato|relatos|ningún": lo tercero es solo para que concuerde el
    // "ninguna entrada" / "ningún relato" cuando no hay resultados.
    const nombres = (BUSCADOR.caja.getAttribute("data-buscar-nombre") || "cosa|cosas").split("|");
    const singular = nombres[0] || "cosa";
    const plural = nombres[1] || singular + "s";
    const ninguna = nombres[2] || "ninguna";
    const que = escapar(BUSCADOR.texto);

    let texto =
        cuantas === 0
            ? `${ninguna} ${singular} con «${que}»`
            : cuantas === 1
            ? `1 ${singular} con «${que}»`
            : `${cuantas} ${plural} con «${que}»`;

    // El apunte lo pone la página, si tiene alguno: es cosa suya saber
    // qué más hay (ver scripts/paginas/entradas-blog.js).
    const apunte =
        typeof window.buscadorApunte === "function"
            ? window.buscadorApunte(normalizar(BUSCADOR.texto))
            : "";
    if (apunte) {
        texto += " · " + apunte;
    }

    cuenta.innerHTML = texto;
    cuenta.classList.toggle("is-vacio", cuantas === 0 && !apunte);
}

// Lo que se busca va en la dirección, para que el enlace se pueda
// copiar o recargar con la misma vista. Sin nada escrito el parámetro
// desaparece en vez de quedarse vacío. El ?cat= y el ?tag= los llevan
// sus propios scripts, y cada uno toca solo el suyo.
function guardarBusquedaEnUrl() {
    if (!window.history || !window.history.replaceState) {
        return;
    }
    const url = new URL(window.location.href);
    if (!BUSCADOR.texto) {
        url.searchParams.delete("buscar");
    } else {
        url.searchParams.set("buscar", BUSCADOR.texto);
    }
    window.history.replaceState(null, "", url);
}

// =========================================
// LO QUE VE EL RESTO DEL SITIO
// =========================================

window.buscador = {
    pasa: pasa,
    aplicar: aplicarBusqueda,
    repasar: repasar,
    // Para que una página pueda buscar por su cuenta en sus datos (el
    // archivo del blog mira si lo buscado está en otro año).
    normalizar: normalizar,
    formasDeFecha: formasDeFecha,
    get texto() {
        return BUSCADOR.texto;
    },
};
