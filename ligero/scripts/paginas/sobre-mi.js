/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/paginas/sobre-mi.js
*/
const FIREWORK_SYMBOLS = ["✨", "⭐", "✦", "✧", "★", "✴", "✳"];
const FIREWORK_PARTICLES_PER_BURST = 20;
const FIREWORK_BURSTS = 5;
const FIREWORK_LIFETIME = 1600;
const COLORES_BI = ["#d60270", "#9b4f96", "#2f6bdb"];
initializeInspirationButton();
initializeOrgulloButton();
function initializeInspirationButton() {
    lanzarAlPulsar(document.getElementById("inspiration-button"), {
        clase: "firework-particle-inspiration",
    });
}
function initializeOrgulloButton() {
    lanzarAlPulsar(document.getElementById("orgullo-boton"), {
        clase: "firework-particle-orgullo",
        colores: COLORES_BI,
    });
}
function lanzarAlPulsar(button, opciones) {
    if (!button) {
        return;
    }
    button.addEventListener("click", () => {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            return;
        }
        for (let i = 0; i < FIREWORK_BURSTS; i++) {
            window.setTimeout(() => {
                const x = window.innerWidth * (0.05 + Math.random() * 0.9);
                const y = window.innerHeight * (0.08 + Math.random() * 0.8);
                spawnBurst(x, y, opciones);
            }, i * 220);
        }
    });
}
function spawnBurst(x, y, opciones) {
    for (let i = 0; i < FIREWORK_PARTICLES_PER_BURST; i++) {
        const angle = (Math.PI * 2 * i) / FIREWORK_PARTICLES_PER_BURST;
        const distance = 80 + Math.random() * 100;
        const dx = Math.cos(angle) * distance;
        const dy = Math.sin(angle) * distance;
        spawnFireworkParticle(x, y, dx, dy, opciones);
    }
}
function spawnFireworkParticle(x, y, dx, dy, opciones) {
    const particle = document.createElement("span");
    particle.className = "firework-particle " + opciones.clase;
    particle.textContent =
        FIREWORK_SYMBOLS[Math.floor(Math.random() * FIREWORK_SYMBOLS.length)];
    particle.style.left = `${x}px`;
    particle.style.top = `${y}px`;
    particle.style.setProperty("--dx", `${dx}px`);
    particle.style.setProperty("--dy", `${dy}px`);
    if (opciones.colores) {
        particle.style.color =
            opciones.colores[Math.floor(Math.random() * opciones.colores.length)];
    }
    particle.setAttribute("aria-hidden", "true");
    document.body.appendChild(particle);
    window.setTimeout(() => {
        particle.remove();
    }, FIREWORK_LIFETIME);
}
