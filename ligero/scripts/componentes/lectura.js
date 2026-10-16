/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/componentes/lectura.js
*/
const LECTURA_MINIMO_APARTADOS = 2;
initializeLectura();
function initializeLectura() {
    const cuerpo = document.querySelector(".blog-post-body, .relato-post-body");
    if (!cuerpo) {
        return;
    }
    montarIndice(cuerpo);
    prepararGifsLectura();
    document.addEventListener("lectura:entrada", (evento) => {
        pintarMinutos(evento.detail);
    });
}
function pintarMinutos(ficha) {
    const minutos = Number(ficha && ficha.minutos);
    if (!minutos || minutos < 1) {
        return;
    }
    const fecha = document.querySelector(".blog-post-date, .relato-post-date");
    if (!fecha || document.querySelector(".lectura-minutos")) {
        return;
    }
    const caja = document.createElement("p");
    caja.className = "lectura-minutos";
    caja.textContent = `${minutos} min`;
    const resto = document.createElement("span");
    resto.className = "visually-hidden";
    resto.textContent = " de lectura";
    caja.appendChild(resto);
    fecha.insertAdjacentElement("afterend", caja);
}
function montarIndice(cuerpo) {
    const apartados = [...cuerpo.querySelectorAll("h2")];
    if (apartados.length < LECTURA_MINIMO_APARTADOS) {
        return;
    }
    const nav = document.createElement("nav");
    nav.className = "lectura-indice";
    nav.setAttribute("aria-labelledby", "lectura-indice-titulo");
    const titulo = document.createElement("p");
    titulo.className = "lectura-indice-titulo";
    titulo.id = "lectura-indice-titulo";
    titulo.textContent = "en esta entrada";
    nav.appendChild(titulo);
    const lista = document.createElement("ol");
    lista.className = "lectura-indice-lista";
    const usados = new Set();
    apartados.forEach((apartado, numero) => {
        if (!apartado.id) {
            apartado.id = idLibre(apartado.textContent, numero, usados);
        }
        usados.add(apartado.id);
        const item = document.createElement("li");
        const enlace = document.createElement("a");
        enlace.className = "lectura-indice-enlace";
        enlace.href = "#" + apartado.id;
        enlace.textContent = (apartado.textContent || "").trim();
        item.appendChild(enlace);
        lista.appendChild(item);
    });
    nav.appendChild(lista);
    cuerpo.insertBefore(nav, cuerpo.firstChild);
}
function idLibre(texto, numero, usados) {
    let base = (texto || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    if (!base) {
        base = "apartado-" + (numero + 1);
    }
    let id = base;
    let vuelta = 2;
    while (usados.has(id) || document.getElementById(id)) {
        id = base + "-" + vuelta;
        vuelta += 1;
    }
    return id;
}
function prepararGifsLectura() {
    const videos = [...document.querySelectorAll("video[data-gif]")];
    if (!videos.length) {
        return;
    }
    const sistema = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    const quieto = () => (sistema && sistema.matches)
        || document.documentElement.getAttribute("data-movimiento") === "quieto";
    const aplicar = () => {
        videos.forEach((v) => {
            if (quieto()) {
                v.pause();
            } else if (!v.dataset.parado) {
                v.play().catch(() => {});
            }
        });
    };
    videos.forEach((v) => {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "gif-boton";
        v.parentNode.insertBefore(boton, v);
        boton.appendChild(v);
        const nombre = (v.getAttribute("aria-label") || "").trim();
        v.removeAttribute("aria-label");
        v.setAttribute("aria-hidden", "true");
        const decir = () => boton.setAttribute("aria-label", nombre
            + (v.paused ? ": parado, pulsa para que siga" : ": pulsa para pararlo"));
        boton.addEventListener("click", () => {
            if (v.paused) {
                delete v.dataset.parado;
                v.play().catch(() => {});
            } else {
                v.dataset.parado = "1";
                v.pause();
            }
        });
        v.addEventListener("play", decir);
        v.addEventListener("pause", decir);
        decir();
    });
    if (sistema && sistema.addEventListener) {
        sistema.addEventListener("change", aplicar);
    }
    new MutationObserver(aplicar).observe(document.documentElement,
        { attributes: true, attributeFilter: ["data-movimiento"] });
    aplicar();
}
