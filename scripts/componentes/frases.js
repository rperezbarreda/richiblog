// =========================================
// MARQUEE SIN CORTES
// =========================================
// En vez de asumir que "2 copias" del texto siempre son más
// anchas que la barra (no lo son: depende del ancho de pantalla
// y de lo largo que sea el texto), clonamos tantas copias como
// hagan falta para que la pista mida de sobra el doble de ancho
// que la barra visible. Así, al desplazar exactamente un 50%,
// siempre hay contenido idéntico detrás y el bucle no se corta.

const MARQUEE_PX_PER_SECOND = 45;

// Dónde se apunta que alguien ha parado las frases, para que sigan
// paradas la próxima vez. Igual que el tema o los brillitos del cursor:
// se queda en el navegador de cada uno.
const FRASES_CLAVE = "richi-frases";

function initializeQuotesMarquee() {
    const bar = document.querySelector(".quotes-bar");
    const viewport = document.querySelector(".quotes-viewport") || bar;
    const track = document.querySelector(".quotes-track");
    const original = document.querySelector(".quotes-content");

    if (!bar || !track || !original) {
        return;
    }

    buildTrack(viewport, track, original);
    montarBotonDeParar(track);

    // Si la ventana cambia de tamaño (p.ej. se redimensiona el
    // navegador), recalculamos por si hacen falta más o menos copias.
    let resizeTimer = null;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => buildTrack(viewport, track, original), 200);
    });
}

// =========================================
// PARAR LAS FRASES
// =========================================
// Un texto que se mueve solo, empieza sin que nadie se lo pida y no
// termina nunca tiene que poder pararse a la vista (es lo que pide la
// pauta 2.2.2 de la WCAG, "poner en pausa, detener u ocultar"). Aquí
// además molesta de verdad: la barra está abajo del todo en la portada,
// moviéndose al lado de lo que estás leyendo.
//
// Lo que elija cada uno se guarda, porque a quien le moleste el
// movimiento le molesta SIEMPRE, y tener que pararlo en cada visita es
// casi peor que no poder pararlo.

function montarBotonDeParar(track) {
    const boton = document.querySelector("[data-quotes-pausa]");
    if (!boton) {
        return;
    }

    // Con "reducir movimiento" puesto en el sistema esto ya está quieto
    // (lo para el CSS), así que el botón no pinta nada.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        boton.hidden = true;
        return;
    }

    pintarBotonDeParar(track, boton, leerSiEstaParado());

    boton.addEventListener("click", () => {
        const parado = !track.classList.contains("esta-parado");
        pintarBotonDeParar(track, boton, parado);
        guardarSiEstaParado(parado);
    });
}

function pintarBotonDeParar(track, boton, parado) {
    track.classList.toggle("esta-parado", parado);

    const icono = boton.querySelector(".quotes-pausa-icono");
    const texto = boton.querySelector(".quotes-pausa-texto");
    if (icono) {
        icono.textContent = parado ? "▶" : "❚❚";
    }
    if (texto) {
        texto.textContent = parado ? "seguir" : "parar";
    }
    // El nombre largo lleva dentro la palabra que se ve, que es lo que
    // dice por voz quien maneja el ordenador hablándole.
    boton.setAttribute("aria-label", parado ? "seguir con las frases" : "parar las frases");
}

function leerSiEstaParado() {
    try {
        return localStorage.getItem(FRASES_CLAVE) === "parado";
    } catch (e) {
        // Navegación privada o almacenamiento bloqueado: se empieza en
        // marcha, como siempre, y el botón sigue funcionando.
        return false;
    }
}

function guardarSiEstaParado(parado) {
    try {
        if (parado) {
            localStorage.setItem(FRASES_CLAVE, "parado");
        } else {
            localStorage.removeItem(FRASES_CLAVE);
        }
    } catch (e) {
        // Sin guardar: se vuelve a mover en la próxima visita.
    }
}

// "viewport" es la ventanilla por la que se ve pasar el texto
// (.quotes-viewport). Antes se medía la barra entera, pero ahora la
// barra lleva también el botón de parar: midiéndola se calculaban copias
// de más.
function buildTrack(viewport, track, original) {
    // Partimos siempre de una única copia (la original, visible
    // para lectores de pantalla) y quitamos el resto de clones
    // antes de recalcular, por si esto se llama de nuevo en un resize.
    track.querySelectorAll(".quotes-content").forEach((el, index) => {
        if (index > 0) {
            el.remove();
        }
    });

    const barWidth = viewport.clientWidth;
    const contentWidth = original.getBoundingClientRect().width;

    if (contentWidth === 0 || barWidth === 0) {
        return;
    }

    // Cuántas copias hacen falta para que la pista mida de sobra
    // el doble del ancho visible (con margen extra de seguridad).
    let copiesNeeded = Math.ceil((barWidth * 2.2) / contentWidth);
    if (copiesNeeded < 2) {
        copiesNeeded = 2;
    }
    // Número par, para que el 50% de translateX caiga siempre
    // justo en un límite entre repeticiones.
    if (copiesNeeded % 2 !== 0) {
        copiesNeeded += 1;
    }

    for (let i = 1; i < copiesNeeded; i++) {
        const clone = original.cloneNode(true);
        clone.setAttribute("aria-hidden", "true");
        track.appendChild(clone);
    }

    const totalWidth = contentWidth * copiesNeeded;

    // Velocidad constante en píxeles/segundo, en vez de una
    // duración fija: así el ticker se mueve siempre a la misma
    // velocidad visual, tengan más o menos copias.
    const durationSeconds = (totalWidth / 2) / MARQUEE_PX_PER_SECOND;

    const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
        track.style.animation = "none";
    } else {
        track.style.animationDuration = `${durationSeconds}s`;
    }
}

// =========================================
// CARGAR QUOTES
// =========================================

loadComponent("quotes-container", "/fragmentos/frases.html", () => {
    initializeQuotesMarquee();
});
