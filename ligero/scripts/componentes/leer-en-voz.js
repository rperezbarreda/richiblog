/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/componentes/leer-en-voz.js
*/
const VOZ_ESPERA_VOCES = 2500;
const VOZ_VELOCIDADES = { lenta: 0.75, rapida: 1.35 };
const VOZ_PASOS = [
    { valor: "lenta", nombre: "lenta" },
    { valor: "", nombre: "normal" },
    { valor: "rapida", nombre: "rápida" },
];
const VOZ = {
    cuerpo: null,
    ventana: null,
    boton: null,
    velocidad: null,
    aviso: null,
    voz: null,
    leyendo: false,
    resaltado: null,
};
initializeLeerEnVoz();
function initializeLeerEnVoz() {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
        return;
    }
    const cuerpo = document.querySelector(".blog-post-body, .relato-post-body");
    if (!cuerpo) {
        return;
    }
    VOZ.cuerpo = cuerpo;
    montarBotonDeVoz();
    buscarVozEnEspanyol();
    window.addEventListener("pagehide", pararVoz);
}
function dondeVaElBotonDeVoz() {
    return (
        document.querySelector(".blog-post-side, .relato-post-side") ||
        document.querySelector(".blog-post-aside, .relato-post-aside") ||
        VOZ.cuerpo
    );
}
function montarBotonDeVoz() {
    if (VOZ.boton) {
        return true;
    }
    const sitio = dondeVaElBotonDeVoz();
    if (!sitio) {
        return false;
    }
    const ventana = document.createElement("div");
    ventana.className = "voz-ventana";
    const barra = document.createElement("div");
    barra.className = "recent-entries-header";
    const titulo = document.createElement("h2");
    titulo.textContent = "texto_a_voz.mp3";
    const mandos = document.createElement("div");
    mandos.className = "window-controls window-controls-small";
    mandos.setAttribute("data-window-controls", "");
    mandos.setAttribute("aria-hidden", "true");
    barra.appendChild(titulo);
    barra.appendChild(mandos);
    ventana.appendChild(barra);
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "voz-boton";
    boton.addEventListener("click", alPulsarVoz);
    pintarVoz(boton, "escuchar");
    ventana.appendChild(boton);
    sitio.insertBefore(ventana, sitio.firstChild);
    VOZ.ventana = ventana;
    VOZ.boton = boton;
    montarVelocidadDeVoz(ventana);
    document.dispatchEvent(new CustomEvent("ventanas:actualizar"));
    return true;
}
function montarVelocidadDeVoz(ventana) {
    if (VOZ.velocidad) {
        return;
    }
    const caja = document.createElement("div");
    caja.className = "voz-velocidad";
    caja.setAttribute("role", "group");
    const nombre = document.createElement("p");
    nombre.className = "voz-velocidad-nombre";
    nombre.id = "voz-velocidad-nombre";
    nombre.textContent = "velocidad";
    caja.setAttribute("aria-labelledby", "voz-velocidad-nombre");
    const mandos = document.createElement("div");
    mandos.className = "voz-velocidad-mandos";
    VOZ_PASOS.forEach((paso) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "voz-velocidad-boton";
        b.setAttribute("data-voz-paso", paso.valor);
        b.textContent = paso.nombre;
        b.addEventListener("click", () => ponerVelocidadDeVoz(paso.valor));
        mandos.appendChild(b);
    });
    caja.appendChild(nombre);
    caja.appendChild(mandos);
    ventana.appendChild(caja);
    VOZ.velocidad = caja;
    pintarVelocidadDeVoz();
}
function ponerVelocidadDeVoz(valor) {
    const raiz = document.documentElement;
    if (valor) {
        raiz.setAttribute("data-voz", valor);
    } else {
        raiz.removeAttribute("data-voz");
    }
    if (typeof guardarAjuste === "function") {
        guardarAjuste("richi-voz", valor, !valor);
    }
    pintarVelocidadDeVoz();
    document.dispatchEvent(new CustomEvent("ajustes:actualizar"));
}
function pintarVelocidadDeVoz() {
    if (!VOZ.velocidad) {
        return;
    }
    const ahora = document.documentElement.getAttribute("data-voz") || "";
    VOZ.velocidad.querySelectorAll("[data-voz-paso]").forEach((b) => {
        b.setAttribute(
            "aria-pressed",
            b.getAttribute("data-voz-paso") === ahora ? "true" : "false"
        );
    });
}
document.addEventListener("ajustes:actualizar", pintarVelocidadDeVoz);
function escogerVozEnEspanyol() {
    let voces = [];
    try {
        voces = window.speechSynthesis.getVoices() || [];
    } catch (error) {
        return null;
    }
    const enEspanyol = voces.filter((v) => (v.lang || "").toLowerCase().startsWith("es"));
    if (!enEspanyol.length) {
        return null;
    }
    return (
        enEspanyol.find((v) => (v.lang || "").toLowerCase() === "es-es") || enEspanyol[0]
    );
}
function buscarVozEnEspanyol() {
    VOZ.voz = escogerVozEnEspanyol();
    if (VOZ.voz) {
        return;
    }
    const alCambiar = () => {
        VOZ.voz = escogerVozEnEspanyol();
        if (VOZ.voz) {
            window.speechSynthesis.removeEventListener("voiceschanged", alCambiar);
        }
    };
    window.speechSynthesis.addEventListener("voiceschanged", alCambiar);
    window.setTimeout(alCambiar, VOZ_ESPERA_VOCES);
}
function alPulsarVoz() {
    if (!VOZ.voz) {
        VOZ.voz = escogerVozEnEspanyol();
    }
    if (!VOZ.voz) {
        alternarAvisoDeVoz();
        return;
    }
    if (VOZ.leyendo) {
        pararVoz();
        return;
    }
    empezarVoz();
}
function empezarVoz() {
    const texto = textoDeLaEntrada();
    if (!texto) {
        return;
    }
    window.speechSynthesis.cancel();
    const velocidad =
        VOZ_VELOCIDADES[document.documentElement.dataset.voz || ""] || 1;
    texto.forEach(({ palabras, elemento }) => {
        const frase = new SpeechSynthesisUtterance(palabras);
        frase.rate = velocidad;
        frase.addEventListener("start", () => resaltarVoz(elemento));
        frase.addEventListener("end", () => {
            if (VOZ.resaltado === elemento) {
                quitarResaltadoDeVoz();
            }
        });
        try {
            frase.voice = VOZ.voz;
        } catch (error) {
        }
        frase.lang = (VOZ.voz && VOZ.voz.lang) || "es-ES";
        window.speechSynthesis.speak(frase);
    });
    const ultima = window.speechSynthesis;
    VOZ.leyendo = true;
    pintarVoz(VOZ.boton, "parar");
    let silencios = 0;
    const vigilar = window.setInterval(() => {
        if (ultima.speaking || ultima.pending) {
            silencios = 0;
            return;
        }
        silencios += 1;
        if (silencios < 2) {
            return;
        }
        window.clearInterval(vigilar);
        VOZ.leyendo = false;
        quitarResaltadoDeVoz();
        pintarVoz(VOZ.boton, "escuchar");
    }, 500);
}
function pararVoz() {
    try {
        window.speechSynthesis.cancel();
    } catch (error) {
    }
    quitarResaltadoDeVoz();
    VOZ.leyendo = false;
    if (VOZ.boton) {
        pintarVoz(VOZ.boton, "escuchar");
    }
}
function textoDeLaEntrada() {
    const trozos = [];
    VOZ.cuerpo.querySelectorAll("h2, h3, p, li, blockquote").forEach((elemento) => {
        if (elemento.closest(".lectura-indice, figcaption, .voz-aviso")) {
            return;
        }
        const palabras = (elemento.textContent || "").trim();
        if (palabras) {
            trozos.push({ palabras, elemento });
        }
    });
    return trozos;
}
function resaltarVoz(elemento) {
    quitarResaltadoDeVoz();
    elemento.classList.add("voz-leyendo");
    VOZ.resaltado = elemento;
    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    try {
        elemento.scrollIntoView({
            block: "center",
            behavior: quieto ? "auto" : "smooth",
        });
    } catch (error) {
    }
}
function quitarResaltadoDeVoz() {
    if (VOZ.resaltado) {
        VOZ.resaltado.classList.remove("voz-leyendo");
        VOZ.resaltado = null;
    }
}
function pintarVoz(boton, estado) {
    const parando = estado === "parar";
    boton.innerHTML =
        '<span class="voz-icono" aria-hidden="true">' +
        (parando ? "■" : "▶") +
        "</span>" +
        '<span class="voz-texto">' +
        (parando ? "parar" : "escuchar") +
        "</span>";
    boton.setAttribute(
        "aria-label",
        parando ? "Parar la lectura en voz alta" : "Escuchar esta entrada en voz alta"
    );
    boton.setAttribute("aria-pressed", parando ? "true" : "false");
}
function alternarAvisoDeVoz() {
    if (VOZ.aviso) {
        const abierto = !VOZ.aviso.hidden;
        VOZ.aviso.hidden = abierto;
        VOZ.boton.setAttribute("aria-expanded", abierto ? "false" : "true");
        return;
    }
    const aviso = document.createElement("div");
    aviso.className = "voz-aviso";
    aviso.id = "voz-aviso";
    aviso.innerHTML = avisoDeVozHTML();
    (VOZ.ventana || VOZ.boton).insertAdjacentElement("afterend", aviso);
    document.dispatchEvent(new CustomEvent("ventanas:actualizar"));
    VOZ.boton.setAttribute("aria-expanded", "true");
    VOZ.boton.setAttribute("aria-controls", "voz-aviso");
    VOZ.aviso = aviso;
    const cerrar = aviso.querySelector("[data-voz-cerrar]");
    if (cerrar) {
        cerrar.addEventListener("click", () => {
            aviso.hidden = true;
            VOZ.boton.setAttribute("aria-expanded", "false");
            VOZ.boton.focus();
        });
    }
}
function avisoDeVozHTML() {
    const pasos = [
        ["Windows", "en la configuración, busca «voz» y añade una en español."],
        ["Mac y iPhone", "Ajustes → Accesibilidad → Contenido hablado → Voces."],
        ["Android", "Ajustes → Accesibilidad, y busca «texto a voz»."],
        ["Linux", "instala speech-dispatcher con una voz en español, como espeak-ng."],
    ];
    const lista = pasos
        .map(([sistema, como]) => `<li><strong>${sistema}:</strong> ${como}</li>`)
        .join("");
    return (
        '<div class="recent-entries-header">' +
        "<h2>sin_voz.txt</h2>" +
        '<div class="window-controls window-controls-small" data-window-controls aria-hidden="true"></div>' +
        "</div>" +
        '<div class="voz-aviso-cuerpo">' +
        "<p>La lectura en voz alta la hace tu navegador con las voces de tu " +
        "sistema, y no tienes ninguna en español. Se añade una vez y vale " +
        "para todas las webs:</p>" +
        `<ul class="voz-aviso-lista">${lista}</ul>` +
        '<p class="voz-aviso-nota">Luego recarga esta página. ' +
        'En <a href="/web/accesibilidad/accesibilidad.html">accesibilidad</a> ' +
        "está lo demás que sí puedes ajustar aquí mismo.</p>" +
        '<button class="voz-aviso-cerrar" type="button" data-voz-cerrar>entendido</button>' +
        "</div>"
    );
}
