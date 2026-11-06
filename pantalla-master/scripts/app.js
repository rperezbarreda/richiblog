// =========================================
// LA APP: lo que no es de la pantalla de máster en sí.
//   - El botón «Aa» (accesibilidad: tamaño, letra, temas…) va a la barra
//     de arriba, junto al buscador y las opciones.
//   - El service worker (sw.js) guarda la app entera en el dispositivo
//     para que funcione sin conexión, y avisa cuando hay una versión nueva.
// =========================================
(function () {
    // EL «Aa» A LA BARRA, en cuanto la pantalla la ha montado.
    function moverAa() {
        const aa = document.querySelector("[data-ajustes-abrir]");
        const mandos = document.querySelector(".master-barra-mandos");
        if (!aa || !mandos) {
            return false;
        }
        aa.classList.add("master-pestana-mando", "app-aa");
        mandos.appendChild(aa);
        aa.hidden = false;
        return true;
    }
    document.addEventListener("DOMContentLoaded", () => {
        if (!moverAa()) {
            const vigia = new MutationObserver(() => {
                if (moverAa()) {
                    vigia.disconnect();
                }
            });
            vigia.observe(document.body, { childList: true, subtree: true });
        }
    });

    // CON EL EJECUTABLE (lanzador/): se le avisa cada 20 s de que la
    // ventana sigue abierta; cuando no queda ninguna, se cierra solo.
    if (location.hostname === "127.0.0.1" && location.port === "47321") {
        // Cada ventana con su id; al cerrarse avisa (y el ejecutable se cierra
        // en cuanto no queda ninguna).
        const id = Math.random().toString(36).slice(2, 12);
        const vivo = () => fetch("__vivo", { method: "POST", body: id, cache: "no-store" }).catch(() => {});
        vivo();
        setInterval(vivo, 20000);
        window.addEventListener("pagehide", () => navigator.sendBeacon("__adios", id));
        // Al volver de la caché del navegador (atrás/adelante), otra vez viva.
        window.addEventListener("pageshow", (e) => {
            if (e.persisted) {
                vivo();
            }
        });
    }

    // SIN CONEXIÓN. Sólo en https (o localhost): en file:// no hay. Con el
    // ejecutable tampoco hace falta (los archivos ya están en el ordenador):
    // su sw.js es otro que borra lo guardado y se da de baja.
    if (!("serviceWorker" in navigator) || !/^(https:|http:\/\/(localhost|127\.0\.0\.1)[:/])/.test(location.href)
        || (location.hostname === "127.0.0.1" && location.port === "47321")) {
        return;
    }
    const aviso = document.createElement("p");
    aviso.className = "visually-hidden";
    aviso.setAttribute("role", "status");
    document.addEventListener("DOMContentLoaded", () => document.body.appendChild(aviso));
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js").then((reg) => {
            reg.addEventListener("updatefound", () => {
                const nuevo = reg.installing;
                if (!nuevo) {
                    return;
                }
                nuevo.addEventListener("statechange", () => {
                    if (nuevo.state !== "installed") {
                        return;
                    }
                    if (navigator.serviceWorker.controller) {
                        mostrarActualizar(nuevo);
                    } else {
                        aviso.textContent = "Lista para usarse sin conexión.";
                    }
                });
            });
        }).catch(() => {
            // Sin service worker: funciona igual, pero con conexión.
        });
        let recargando = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
            if (!recargando) {
                recargando = true;
                location.reload();
            }
        });
    });
    // Hay una versión nueva: un aviso con «actualizar» (no se recarga sola
    // en mitad de una partida).
    function mostrarActualizar(nuevo) {
        const caja = document.createElement("div");
        caja.className = "app-actualizar";
        caja.setAttribute("role", "status");
        const texto = document.createElement("p");
        texto.textContent = "Hay una versión nueva de la pantalla de máster.";
        const si = document.createElement("button");
        si.type = "button";
        si.className = "oc-vida-accion es-principal";
        si.textContent = "↻ actualizar";
        si.addEventListener("click", () => nuevo.postMessage("activar"));
        const no = document.createElement("button");
        no.type = "button";
        no.className = "oc-vida-accion";
        no.textContent = "luego";
        no.addEventListener("click", () => caja.remove());
        caja.append(texto, si, no);
        document.body.appendChild(caja);
    }
})();
