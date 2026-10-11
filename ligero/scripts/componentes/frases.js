/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/componentes/frases.js
*/
const MARQUEE_PX_PER_SECOND = 45;
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
    let resizeTimer = null;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => buildTrack(viewport, track, original), 200);
    });
}
function montarBotonDeParar(track) {
    const boton = document.querySelector("[data-quotes-pausa]");
    if (!boton) {
        return;
    }
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
    boton.setAttribute("aria-label", parado ? "seguir con las frases" : "parar las frases");
}
function leerSiEstaParado() {
    try {
        return localStorage.getItem(FRASES_CLAVE) === "parado";
    } catch (e) {
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
    }
}
function buildTrack(viewport, track, original) {
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
    let copiesNeeded = Math.ceil((barWidth * 2.2) / contentWidth);
    if (copiesNeeded < 2) {
        copiesNeeded = 2;
    }
    if (copiesNeeded % 2 !== 0) {
        copiesNeeded += 1;
    }
    for (let i = 1; i < copiesNeeded; i++) {
        const clone = original.cloneNode(true);
        clone.setAttribute("aria-hidden", "true");
        track.appendChild(clone);
    }
    const totalWidth = contentWidth * copiesNeeded;
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
loadComponent("quotes-container", "/fragmentos/frases.html", () => {
    initializeQuotesMarquee();
});
