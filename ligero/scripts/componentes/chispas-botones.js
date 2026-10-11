/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/componentes/chispas-botones.js
*/
const WINDOW_BTN_SYMBOLS = ["✨", "⭐", "✦", "✧"];
const WINDOW_BTN_PARTICLES = 10;
const WINDOW_BTN_LIFETIME = 700;
initializeWindowBtnEffects();
function initializeWindowBtnEffects() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
    }
    document.addEventListener("click", (event) => {
        const button = event.target.closest(".window-btn");
        if (!button) {
            return;
        }
        const enBarra = button.closest(".ventana-barra");
        if (enBarra && button.dataset.ventanaAccion !== "cerrar") {
            return;
        }
        spawnWindowBtnBurst(event.clientX, event.clientY);
    });
}
function spawnWindowBtnBurst(x, y) {
    for (let i = 0; i < WINDOW_BTN_PARTICLES; i++) {
        const angle = (Math.PI * 2 * i) / WINDOW_BTN_PARTICLES;
        const distance = 30 + Math.random() * 30;
        const dx = Math.cos(angle) * distance;
        const dy = Math.sin(angle) * distance;
        spawnWindowBtnParticle(x, y, dx, dy);
    }
}
function spawnWindowBtnParticle(x, y, dx, dy) {
    const particle = document.createElement("span");
    particle.className = "firework-particle";
    particle.textContent =
        WINDOW_BTN_SYMBOLS[Math.floor(Math.random() * WINDOW_BTN_SYMBOLS.length)];
    particle.style.left = `${x}px`;
    particle.style.top = `${y}px`;
    particle.style.fontSize = "0.75rem";
    particle.style.setProperty("--dx", `${dx}px`);
    particle.style.setProperty("--dy", `${dy}px`);
    particle.setAttribute("aria-hidden", "true");
    document.body.appendChild(particle);
    window.setTimeout(() => {
        particle.remove();
    }, WINDOW_BTN_LIFETIME);
}
