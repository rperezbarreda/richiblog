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
        },
        // «mis-datos/ordenado»: lo mismo con sus nombres, para mirarlo (ver
        // «LA CARPETA ORDENADA» en pantalla-master.js).
        ordenado: {
            escribir: function (ruta, texto) {
                return fetch("__ordenado/" + rutaUrl(ruta), { method: "PUT", body: texto });
            },
            copiar: function (ruta, id) {
                return fetch("__ordenado/" + rutaUrl(ruta) + "?archivo=" + encodeURIComponent(id), { method: "PUT" });
            },
            borrar: function (ruta) {
                return fetch("__ordenado/" + rutaUrl(ruta), { method: "DELETE" });
            }
        }
    };
    function rutaUrl(ruta) {
        return String(ruta).split("/").map(encodeURIComponent).join("/");
    }
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

// =========================================
// LOS IDIOMAS: la app está escrita en castellano y cada texto de la
// interfaz pasa por window.ocT("texto original", {variables}). Con otro
// idioma elegido («richi-idioma»), ocT busca el texto en el diccionario
// de ese idioma (idiomas/<código>.js, que se genera desde
// traducciones/<código>.json, lo que traduce la comunidad) y, si no está,
// deja el original. En castellano no hace nada más que poner las variables:
// la app queda igual.
// El compendio (bestiario, conjuros, objetos…) se traduce al cargarse con
// window.ocIdioma.datos(json), desde idiomas/<código>.json.
// «richi-idioma-prueba» guarda un traducciones/<código>.json cargado a mano
// desde Aa, para probar una traducción antes de que esté en la app.
// =========================================
(function () {
    var raiz = document.documentElement;
    var tiene = Object.prototype.hasOwnProperty;
    var codigo = "es";
    var prueba = null;
    try {
        var guardado = localStorage.getItem("richi-idioma");
        if (guardado && /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(guardado)) {
            codigo = guardado;
        }
        prueba = JSON.parse(localStorage.getItem("richi-idioma-prueba") || "null");
    } catch (e) {
        prueba = null;
    }
    // El idioma para fechas, números (1.000 o 1,000) y ordenar.
    window.ocLocale = codigo === "es" ? "es-ES" : codigo;
    if (prueba && (typeof prueba !== "object" || prueba.codigo !== codigo || !prueba.textos)) {
        prueba = null;
    }
    var interfaz = {};
    var compendio = null;
    var pedido = null;
    // Los campos del compendio que no se traducen: nombres en inglés,
    // identificadores, rutas, trozos de nombres inventados y las categorías
    // con las que el programa filtra (clases, rarezas, escuelas…). Éstas se
    // traducen sólo al enseñarlas, con window.ocTd. La «fuente» (de dónde
    // sale cada archivo) sí, salvo la de idiomas.json (una tipografía).
    var FIJOS = { en: 1, id: 1, fuente: 1, url: 1, clave: 1, silabas: 1, emoji: 1, icono: 1, ilus: 1, ilusDe: 1,
        apellido: 1, glifos: 1, asalariados: 1, donde: 1, cr: 1, clases: 1, tiendas: 1, tienda: 1,
        cat: 1, rareza: 1, escuela: 1, tipo: 1, de: 1, habitat: 1, marca: 1, regla: 1, tipos: 1, estilos: 1, et: 1 };
    // En nombres.json, las piezas con las que se inventan los nombres.
    var PIEZAS = { ini: 1, m: 1, f: 1, n: 1, fin: 1 };
    var LETRAS = /[A-Za-zÀ-ÿ]/;
    function buscar(dic, texto) {
        return dic && tiene.call(dic, texto) && typeof dic[texto] === "string" && dic[texto] ? dic[texto] : texto;
    }
    function rellenar(texto, vars) {
        if (!vars) {
            return texto;
        }
        return texto.replace(/\{([A-Za-z0-9_]+)\}/g, function (todo, k) {
            return tiene.call(vars, k) && vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : todo;
        });
    }
    // Un dato del compendio que se guarda en castellano (categorías,
    // rarezas, escuelas, tipos…), en el idioma de la app, para enseñarlo.
    window.ocTd = function (texto) {
        if (codigo === "es" || typeof texto !== "string" || !compendio) {
            return texto;
        }
        return buscar(compendio, texto);
    };
    window.ocT = function (texto, vars) {
        return rellenar(codigo === "es" ? texto : buscar(interfaz, texto), vars);
    };
    function recorrer(x, campo, conPiezas) {
        if (typeof x === "string") {
            if (campo === "fuente" && x.indexOf(" ") > 0) {
                return buscar(compendio, x);
            }
            return FIJOS[campo] || (conPiezas && PIEZAS[campo]) || !LETRAS.test(x) ? x : buscar(compendio, x);
        }
        if (Array.isArray(x)) {
            for (var i = 0; i < x.length; i++) {
                x[i] = recorrer(x[i], campo, conPiezas);
            }
            return x;
        }
        if (x && typeof x === "object") {
            var piezas = conPiezas || tiene.call(x, "especies") || tiene.call(x, "apellidos");
            for (var k in x) {
                // De los fijos, se entra en la «fuente» (si no es una
                // tipografía) y en «tipos» cuando son los negocios (un
                // objeto, no la lista de tipos de monstruo).
                if (tiene.call(x, k) && (!FIJOS[k] || k === "fuente" || k === "tipos" && x[k] && typeof x[k] === "object" && !Array.isArray(x[k]))) {
                    x[k] = recorrer(x[k], k, piezas);
                }
            }
        }
        return x;
    }
    function traducirNodo(n) {
        var t = n.nodeValue;
        var nucleo = t.trim().replace(/\s+/g, " ");
        if (nucleo && LETRAS.test(nucleo)) {
            var otro = buscar(interfaz, nucleo);
            if (otro !== nucleo) {
                n.nodeValue = t.match(/^\s*/)[0] + otro + t.match(/\s*$/)[0];
            }
        }
    }
    var ATRIBUTOS = ["aria-label", "title", "placeholder", "alt", "content", "aria-description"];
    window.ocIdioma = {
        codigo: codigo,
        prueba: !!prueba,
        poner: function (dic) {
            if (dic && typeof dic === "object") {
                interfaz = dic;
            }
        },
        // ¿Hay algo de este idioma? (para avisar si falta el archivo)
        cargado: function () {
            return codigo === "es" || Object.keys(interfaz).length > 0;
        },
        // Traduce (en el sitio) un JSON del compendio; devuelve una promesa.
        datos: function (json) {
            if (codigo === "es") {
                return Promise.resolve(json);
            }
            if (!pedido) {
                pedido = prueba ? Promise.resolve(prueba.textos)
                    : fetch("idiomas/" + codigo + ".json").then(function (r) {
                        return r.ok ? r.json() : {};
                    }).catch(function () {
                        return {};
                    });
                pedido = pedido.then(function (dic) {
                    compendio = dic && typeof dic === "object" ? dic : {};
                });
            }
            return pedido.then(function () {
                return recorrer(json, "", false);
            });
        },
        // Lo escrito tal cual en el HTML (títulos, etiquetas…).
        traducirDom: function (base) {
            if (codigo === "es" || !base) {
                return;
            }
            var andar = document.createTreeWalker(base, NodeFilter.SHOW_TEXT, { acceptNode: function (n) {
                var p = n.parentNode;
                return p && /^(SCRIPT|STYLE|TEXTAREA)$/.test(p.nodeName) || p.closest && p.closest("[translate='no']")
                    ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
            } });
            var n;
            while ((n = andar.nextNode())) {
                traducirNodo(n);
            }
            var todos = base.querySelectorAll ? base.querySelectorAll("*") : [];
            for (var i = 0; i < todos.length; i++) {
                for (var j = 0; j < ATRIBUTOS.length; j++) {
                    var a = ATRIBUTOS[j];
                    var v = todos[i].getAttribute(a);
                    if (v && (a !== "content" || todos[i].getAttribute("name") === "description")) {
                        var limpio = v.trim().replace(/\s+/g, " ");
                        var w = buscar(interfaz, limpio);
                        if (w !== limpio) {
                            todos[i].setAttribute(a, w);
                        }
                    }
                }
            }
        }
    };
    raiz.setAttribute("lang", codigo);
    if (codigo === "es") {
        return;
    }
    if (prueba) {
        window.ocIdioma.poner(prueba.textos);
    } else {
        // Bloqueante a propósito: tiene que estar antes que los scripts «defer».
        document.write('<script src="idiomas/' + codigo + '.js"><\/script>');
    }
    // Lo del HTML se traduce en cuanto está leído, antes que los «defer».
    document.addEventListener("readystatechange", function () {
        if (document.readyState === "interactive") {
            window.ocIdioma.traducirDom(document.documentElement);
        }
    });
})();
