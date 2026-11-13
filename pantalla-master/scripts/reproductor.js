// =========================================
// EL REPRODUCTOR EN SU VENTANA (reproductor.html)
// =========================================
// La música suena en la pantalla de máster; esta ventana sólo la enseña
// y la manda (por un BroadcastChannel, «pantalla-master-musica»). Así se
// puede compartir en Discord u OBS sin enseñar lo demás: si cambias de
// tablero en la pantalla, aquí sigue igual.
//
// Lo que llega: {t: "estado", nombre, carpeta, suena, pos, total,
// actual, duracion, volumen, modo, imagen, icono, tema}. Lo que se manda:
// {t: "hola"} al abrirse y las órdenes (tocar, siguiente, anterior,
// parar, ir {s}, volumen {v}, modo {m}, aleatorio).

(function () {
    "use strict";

    const $ = (sel) => document.querySelector(sel);
    const raiz = $("[data-repro]");
    const portada = $("[data-repro-portada]");
    const titulo = $("[data-repro-titulo]");
    const carpeta = $("[data-repro-carpeta]");
    const barra = $("[data-repro-barra]");
    const tiempo = $("[data-repro-tiempo]");
    const tocar = $("[data-repro-tocar]");
    const volumen = $("[data-repro-volumen]");
    const aviso = $("[data-repro-aviso]");
    const limpio = $("[data-repro-limpio]");
    const modos = Array.from(document.querySelectorAll("[data-repro-modo]"));
    const aleatorio = $("[data-repro-aleatorio]");

    if (!("BroadcastChannel" in window)) {
        aviso.textContent = ocT("Este navegador no puede hablar con la pantalla de máster.");
        return;
    }
    const canal = new BroadcastChannel("pantalla-master-musica");
    const mandar = (o) => canal.postMessage(o);
    const minutos = (s) => (isFinite(s) && s > 0 ? Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0") : "0:00");

    let ultimo = 0;
    let arrastrando = false;
    let imagenAhora = "";

    function pintar(e) {
        ultimo = Date.now();
        aviso.textContent = "";
        if (e.tema !== undefined) {
            if (e.tema) {
                document.documentElement.setAttribute("data-theme", e.tema);
            } else {
                document.documentElement.removeAttribute("data-theme");
            }
        }
        const hay = !!e.nombre;
        document.title = hay ? ocT("{n} · Música", { n: (e.suena ? "▶ " : "⏸ ") + e.nombre }) : ocT("Música · Pantalla de máster");
        titulo.textContent = hay ? e.nombre : ocT("Nada sonando.");
        carpeta.textContent = hay ? [e.carpeta ? "📁 " + e.carpeta : "", e.total ? ocT("{n} de {total}", { n: e.pos + 1, total: e.total }) : ""]
            .filter(Boolean).join(" · ") : "";
        tocar.textContent = e.suena ? "⏸" : "▶";
        tocar.setAttribute("aria-label", e.suena ? "Pausa" : "Reproducir");
        if (!arrastrando) {
            barra.value = e.duracion ? Math.round(e.actual / e.duracion * 1000) : 0;
        }
        barra.setAttribute("aria-valuetext", minutos(e.actual) + ocT(" de ") + minutos(e.duracion));
        tiempo.textContent = minutos(e.actual) + " / " + minutos(e.duracion);
        if (document.activeElement !== volumen) {
            volumen.value = Math.round((e.volumen || 0) * 100);
        }
        modos.forEach((b) => b.setAttribute("aria-pressed", b.dataset.reproModo === e.modo ? "true" : "false"));
        aleatorio.setAttribute("aria-pressed", e.aleatorio ? "true" : "false");
        // La portada: su imagen (o la de su carpeta) o su emoji.
        if (e.imagen !== imagenAhora || !portada.firstChild) {
            imagenAhora = e.imagen || "";
            portada.replaceChildren();
            if (imagenAhora) {
                const img = document.createElement("img");
                img.alt = "";
                img.src = imagenAhora;
                img.addEventListener("error", () => {
                    portada.textContent = e.icono || "🎵";
                });
                portada.appendChild(img);
            } else {
                portada.textContent = e.icono || "🎵";
            }
        } else if (!imagenAhora) {
            portada.textContent = e.icono || "🎵";
        }
        raiz.classList.toggle("es-sonando", !!e.suena);
    }

    canal.addEventListener("message", (ev) => {
        const e = ev.data || {};
        if (e.t === "estado") {
            pintar(e);
        }
    });

    document.querySelectorAll("[data-repro-orden]").forEach((b) => {
        b.addEventListener("click", () => mandar({ t: b.dataset.reproOrden }));
    });
    barra.addEventListener("pointerdown", () => {
        arrastrando = true;
    });
    const soltar = () => {
        arrastrando = false;
    };
    barra.addEventListener("pointerup", soltar);
    barra.addEventListener("pointercancel", soltar);
    barra.addEventListener("change", soltar);
    barra.addEventListener("input", () => mandar({ t: "ir", f: barra.value / 1000 }));
    volumen.addEventListener("input", () => {
        volumen.setAttribute("aria-valuetext", volumen.value + " %");
        mandar({ t: "volumen", v: volumen.value / 100 });
    });
    modos.forEach((b) => b.addEventListener("click", () => mandar({ t: "modo", m: b.dataset.reproModo })));
    aleatorio.addEventListener("click", () => mandar({ t: "aleatorio" }));

    // «Sólo la canción»: sin mandos, para compartir la ventana limpia.
    // Se recuerda en esta ventana; los mandos vuelven al pasar el ratón o
    // al moverse con el teclado.
    let soloCancion = false;
    try {
        soloCancion = sessionStorage.getItem("richi-repro-limpio") === "1";
    } catch (err) {
        soloCancion = false;
    }
    const ponerLimpio = () => {
        raiz.classList.toggle("es-limpio", soloCancion);
        limpio.setAttribute("aria-pressed", soloCancion ? "true" : "false");
        try {
            sessionStorage.setItem("richi-repro-limpio", soloCancion ? "1" : "0");
        } catch (err) {
            // Sin sitio: no pasa nada.
        }
    };
    limpio.addEventListener("click", () => {
        soloCancion = !soloCancion;
        ponerLimpio();
    });
    ponerLimpio();

    // Al abrir, se pide cómo va; y si la pantalla de máster deja de
    // contestar (está cerrada o en otro navegador), se avisa.
    mandar({ t: "hola" });
    setInterval(() => {
        if (Date.now() - ultimo > 4000) {
            mandar({ t: "hola" });
            if (Date.now() - ultimo > 6000) {
                aviso.textContent = ocT("No encuentro la pantalla de máster: ábrela en este mismo navegador.");
            }
        }
    }, 2000);
}());
