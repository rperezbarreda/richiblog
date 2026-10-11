/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/componentes/buscador.js
*/
const BUSCADOR = {
    texto: "",
    caja: null,
    campo: null,
};
const BUSCADOR_ORIGINALES = new WeakMap();
montarBuscador();
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
            campo.focus();
        });
    }
    campo.addEventListener("keydown", (evento) => {
        if (evento.key === "Escape" && campo.value) {
            evento.preventDefault();
            vaciar();
        }
    });
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
function normalizar(texto) {
    let limpio = "";
    for (const letra of (texto === null || texto === undefined ? "" : texto.toString()).toLowerCase()) {
        const suelta = letra.normalize("NFD").replace(/[̀-ͯ]/g, "");
        limpio += suelta.length === letra.length ? suelta : letra;
    }
    return limpio;
}
const BUSCADOR_MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
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
function resaltar(item) {
    trozosDe(item).forEach((trozo) => resaltarEn(trozo, item.hidden));
}
function resaltarEn(elemento, escondida) {
    const original = textoOriginal(elemento);
    const aguja = normalizar(BUSCADOR.texto);
    const plano = normalizar(original);
    const donde0 = aguja ? plano.indexOf(aguja) : -1;
    if (!aguja || escondida || donde0 === -1) {
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
function aplicarBusqueda() {
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
function contar(cuantas) {
    const cuenta = BUSCADOR.caja.querySelector("[data-buscar-cuenta]");
    const limpiar = BUSCADOR.caja.querySelector("[data-buscar-limpiar]");
    if (limpiar) {
        limpiar.hidden = !BUSCADOR.texto;
    }
    BUSCADOR.caja.classList.toggle("tiene-texto", !!BUSCADOR.texto);
    if (!cuenta) {
        return;
    }
    if (!BUSCADOR.texto) {
        cuenta.textContent = "";
        cuenta.classList.remove("is-vacio");
        return;
    }
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
window.buscador = {
    pasa: pasa,
    aplicar: aplicarBusqueda,
    repasar: repasar,
    normalizar: normalizar,
    formasDeFecha: formasDeFecha,
    get texto() {
        return BUSCADOR.texto;
    },
};
