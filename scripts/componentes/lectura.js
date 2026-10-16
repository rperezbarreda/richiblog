// =========================================
// COMPONENTE: AYUDAS DE LECTURA
// =========================================
// Dos cosas pequeñas para las páginas de leer (una entrada del blog o
// un relato):
//
//   1. El tiempo de lectura al lado de la fecha ("4 min").
//   2. El índice de la entrada, cuando tiene apartados.
//
// EL TIEMPO DE LECTURA NO SE CUENTA AQUÍ
// --------------------------------------
// Lo calcula herramientas/3-generadores/generar-posts.py al escribir el listado, y
// esta página lo recibe de scripts/paginas/otras-entradas.js —que ya se
// trae ese listado para la ventana de "sigue leyendo"— en el evento
// "lectura:entrada". Contarlo otra vez aquí, con el texto del navegador
// en vez de con el HTML, daría números distintos en el listado y en la
// entrada justo en los casos que se notan (una entrada de 400 palabras
// pasando de 2 a 3 minutos), y de las dos cifras ninguna sería la
// buena.
//
// EL ÍNDICE
// ---------
// Solo sale si la entrada tiene DOS apartados o más (<h2> dentro del
// cuerpo). Con uno solo no hay nada que elegir, y con ninguno —que es
// como están casi todas— no se pinta nada: no hay ni una caja vacía.
// Los <h2> se escriben a mano en el HTML de la entrada, como explica
// herramientas/5-consulta/ejemplo-formatos.html.

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

// =========================================
// "4 MIN", AL LADO DE LA FECHA
// =========================================

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
    // A la vista, "4 min": escrito entero ("4 min de lectura") la fila
    // de la cabecera crecía 235px y en una pantalla de 1024 el título
    // se quedaba sin sitio. Lo que se lee en voz alta sí va entero, que
    // ahí no ocupa nada.
    // El "·" de separación lo pone el CSS, para que quien escucha la
    // página no oiga un punto suelto en medio de la cabecera.
    caja.textContent = `${minutos} min`;
    const resto = document.createElement("span");
    resto.className = "visually-hidden";
    resto.textContent = " de lectura";
    caja.appendChild(resto);
    fecha.insertAdjacentElement("afterend", caja);
}

// =========================================
// ÍNDICE DE LA ENTRADA
// =========================================

function montarIndice(cuerpo) {
    const apartados = [...cuerpo.querySelectorAll("h2")];
    if (apartados.length < LECTURA_MINIMO_APARTADOS) {
        return;
    }

    const nav = document.createElement("nav");
    nav.className = "lectura-indice";
    // aria-labelledby y no aria-label: el título se ve, así que vale
    // como nombre de la zona y no hay que escribirlo dos veces.
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
        // Si el apartado ya trae un id escrito a mano, se respeta: puede
        // que alguien haya compartido ese enlace.
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

// "Un apartado de la entrada" -> "un-apartado-de-la-entrada", sin
// tildes ni eñes (en una dirección dan problemas) y sin repetirse.
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


// =========================================
// LOS «GIF», QUE SON VÍDEOS
// =========================================
// Un GIF animado pesa muchísimo: el de los gatos con la fregona eran
// 1,25 MB para 320x320. Pasado a vídeo (sin sonido y en bucle) se queda
// en 150 KB y se ve igual. En la entrada va así, en MP4 y en WebM (cada
// navegador coge el primero que sepa leer; el Chromium sin códecs de
// pago, por ejemplo, no lee MP4):
//
//     <video poster="….webp" width="320" height="320" autoplay muted
//            loop playsinline data-gif aria-label="…">
//         <source src="….mp4" type="video/mp4">
//         <source src="….webm" type="video/webm">
//     </video>
//
// Aquí se mete dentro de un botón, que es el que lleva el nombre.
//
// Y como es un vídeo, a diferencia del GIF, SE PUEDE PARAR: quieto si el
// aparato pide menos movimiento o si en accesibilidad está «movimiento:
// quieto» (data-movimiento en el <html>), y pulsándolo se para o sigue.
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
        // Dentro de un botón (un <video> no puede hacer de botón él
        // mismo): con el teclado se llega y se para con Intro o espacio.
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "gif-boton";
        v.parentNode.insertBefore(boton, v);
        boton.appendChild(v);
        const nombre = (v.getAttribute("aria-label") || "").trim();
        v.removeAttribute("aria-label");
        v.setAttribute("aria-hidden", "true");
        // Lo que dice el lector de pantalla: qué es y qué pasa si se pulsa.
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
