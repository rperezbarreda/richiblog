// =========================================
// FUEGOS ARTIFICIALES (inspiración y etiqueta bi)
// =========================================
// Efecto puramente decorativo: al pulsar el botón, lanza varias
// ráfagas de partículas en forma de estallido por la pantalla.
//
// Lo usan dos botones de esta página:
//   - inspiración, con las estrellitas amarillas de siempre.
//   - la etiqueta "yep, soy bi" de debajo del retrato, con los mismos
//     estallidos pero pintados con los colores de la bandera.
//
// Si el sistema pide menos movimiento no se lanza nada. El botón de
// inspiración además se esconde por CSS, porque no hace otra cosa; la
// etiqueta bi se queda, porque lo que dice importa aunque no estalle.

const FIREWORK_SYMBOLS = ["✨", "⭐", "✦", "✧", "★", "✴", "✳"];
const FIREWORK_PARTICLES_PER_BURST = 20;
const FIREWORK_BURSTS = 5;
const FIREWORK_LIFETIME = 1600; // ms, debe coincidir con la animación CSS

// Rosa, morado y azul de la bandera bisexual. El azul va algo más
// claro que el de la bandera (#0038a8): medido sobre el fondo oscuro
// del sitio se quedaba en 2:1 y las partículas no se veían.
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
        // Se comprueba al pulsar y no al cargar: así, si cambias la
        // preferencia del sistema sin recargar, se respeta igual.
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
    // Sin colores, se queda el amarillo del sitio (.firework-particle).
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
