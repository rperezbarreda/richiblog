// =========================================
// EL ARRANQUE: lo primero que se lee (sin defer, en el <head>), para que
// la app se pinte ya con el tema y los ajustes de accesibilidad de cada
// uno y no dé un salto al llegar el resto. Las mismas claves que en el
// blog (richi-theme, richi-texto…): quien use los dos en el mismo
// navegador no las comparte (son webs distintas), pero el código es el
// mismo.
// =========================================
// CON EL EJECUTABLE (127.0.0.1:47321) lo guardado no va al navegador sino
// a la carpeta «mis-datos» junto al programa (ver lanzador/almacen.go):
// «localStorage» se cambia por uno que lo lee al empezar (de una vez) y lo
// escribe allí en cada cambio. Lo del navegador de antes no se toca: queda
// en window.ocAlmacen.navegador (la entrada ofrece traerlo).
(function () {
    if (location.hostname !== "127.0.0.1" || location.port !== "47321") {
        return;
    }
    var datos = {};
    var ok = false;
    try {
        var x = new XMLHttpRequest();
        x.open("GET", "__datos", false);
        x.send();
        if (x.status === 200) {
            datos = JSON.parse(x.responseText) || {};
            ok = true;
        }
    } catch (e) {
        ok = false;
    }
    if (!ok) {
        return;
    }
    var navegador = window.localStorage;
    var cola = Promise.resolve();
    var espera = 0;
    function escribir() {
        clearTimeout(espera);
        espera = setTimeout(function () {
            var cuerpo = JSON.stringify(datos);
            cola = cola.then(function () {
                return fetch("__datos", { method: "POST", body: cuerpo, headers: { "Content-Type": "application/json" },
                    keepalive: cuerpo.length < 60000 });
            }).catch(function () {});
        }, 150);
    }
    var almacen = {
        getItem: function (k) {
            return Object.prototype.hasOwnProperty.call(datos, k) ? datos[k] : null;
        },
        setItem: function (k, v) {
            datos[String(k)] = String(v);
            escribir();
        },
        removeItem: function (k) {
            if (Object.prototype.hasOwnProperty.call(datos, k)) {
                delete datos[k];
                escribir();
            }
        },
        clear: function () {
            datos = {};
            escribir();
        },
        key: function (i) {
            return Object.keys(datos)[i] || null;
        }
    };
    Object.defineProperty(almacen, "length", { get: function () {
        return Object.keys(datos).length;
    } });
    try {
        Object.defineProperty(window, "localStorage", { configurable: true, get: function () {
            return almacen;
        } });
    } catch (e) {
        return;
    }
    window.ocAlmacen = {
        enCarpeta: true,
        vacio: Object.keys(datos).length === 0,
        navegador: navegador,
        // Que lo pendiente se escriba ya (antes de recargar, por ejemplo).
        guardarYa: function () {
            clearTimeout(espera);
            var cuerpo = JSON.stringify(datos);
            return cola.then(function () {
                return fetch("__datos", { method: "POST", body: cuerpo, headers: { "Content-Type": "application/json" } });
            });
        }
    };
})();

(function () {
    var raiz = document.documentElement;
    raiz.classList.add("js");
    try {
        var temas = {
            "claro": ["light", "#f3e1d6"],
            "oscuro-puro": ["puro-oscuro", "#000000"],
            "claro-puro": ["puro-claro", "#ffffff"],
            "tranquilo": ["tranquilo", "#f2efe9"],
            "tranquilo-oscuro": ["tranquilo-oscuro", "#1b1e22"],
            "terminal-verde": ["terminal-verde", "#000000"],
            "terminal-azul": ["terminal-azul", "#000000"],
            "terminal-rojo": ["terminal-rojo", "#000000"],
            "terminal-ambar": ["terminal-ambar", "#000000"]
        };
        var guardado = localStorage.getItem("richi-theme");
        var elegido = temas[guardado];
        if (!elegido && !guardado && window.matchMedia("(prefers-color-scheme: light)").matches) {
            elegido = temas.claro;
        }
        if (elegido) {
            raiz.setAttribute("data-theme", elegido[0]);
            var barra = document.querySelector('meta[name="theme-color"]');
            if (barra) {
                barra.setAttribute("content", elegido[1]);
            }
        }
        var escala = parseFloat(localStorage.getItem("richi-texto"));
        if (escala >= 0.9 && escala <= 1.5) {
            raiz.style.setProperty("--escala", escala);
        }
        var linea = localStorage.getItem("richi-interlineado");
        if (linea === "amplio" || linea === "muy-amplio") {
            raiz.setAttribute("data-interlineado", linea);
        }
        var estilo = localStorage.getItem("richi-estilo");
        if (estilo === "moderno" || estilo === "windows" || estilo === "lapiz") {
            raiz.setAttribute("data-estilo", estilo);
        }
        if (localStorage.getItem("richi-letra") === "legible") {
            raiz.setAttribute("data-letra", "legible");
        }
        if (localStorage.getItem("richi-crt") === "si") {
            raiz.setAttribute("data-crt", "si");
        }
        if (localStorage.getItem("richi-movimiento") === "quieto") {
            raiz.setAttribute("data-movimiento", "quieto");
        }
    } catch (e) {
        // Sin almacenamiento: con lo de fábrica.
    }
})();
