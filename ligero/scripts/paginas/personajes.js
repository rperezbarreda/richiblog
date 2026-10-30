/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/paginas/personajes.js
*/
window.ocMontar = window.ocMontar || {};
(function () {
    const conClave = document.querySelector("[data-oc-clave]");
    const clave = (conClave && conClave.dataset.ocClave) || "";
    const nombre = "richi-oc-partida-" + clave;
    let datos = {};
    try {
        datos = JSON.parse(localStorage.getItem(nombre) || "{}") || {};
    } catch (e) {
        datos = {};
    }
    window.ocPartida = {
        clave,
        leer(campo, porDefecto) {
            return datos[campo] === undefined ? porDefecto : datos[campo];
        },
        guardar(campo, valor) {
            if (valor === undefined) {
                delete datos[campo];
            } else {
                datos[campo] = valor;
            }
            if (!clave) {
                return;
            }
            try {
                localStorage.setItem(nombre, JSON.stringify(datos));
            } catch (e) {
            }
        },
    };
    let fondo = null;
    let cerrarAhora = null;
    window.ocVentana = {
        abrir(opciones) {
            if (cerrarAhora) {
                cerrarAhora(false);
            }
            if (!fondo) {
                fondo = document.createElement("div");
                fondo.className = "oc-menu-fondo";
                fondo.hidden = true;
                fondo.addEventListener("click", (e) => {
                    if (e.target === fondo && cerrarAhora) {
                        cerrarAhora(true);
                    }
                });
                document.body.appendChild(fondo);
            }
            const ventana = document.createElement("div");
            ventana.className = "oc-menu-ventana" + (opciones.clase ? " " + opciones.clase : "");
            ventana.setAttribute("role", "dialog");
            ventana.setAttribute("aria-modal", "true");
            ventana.setAttribute("aria-labelledby", "oc-ventana-titulo");
            const barra = document.createElement("div");
            barra.className = "oc-menu-ventana-barra";
            const titulo = document.createElement("h2");
            titulo.id = "oc-ventana-titulo";
            titulo.className = "oc-menu-ventana-titulo";
            titulo.textContent = opciones.titulo;
            const cerrar = document.createElement("button");
            cerrar.type = "button";
            cerrar.className = "oc-menu-ventana-cerrar";
            cerrar.textContent = "✕";
            cerrar.setAttribute("aria-label", "Cerrar");
            barra.append(titulo, cerrar);
            const cuerpo = document.createElement("div");
            cuerpo.className = "oc-menu-ventana-cuerpo";
            cuerpo.tabIndex = 0;
            cuerpo.setAttribute("role", "region");
            cuerpo.setAttribute("aria-labelledby", "oc-ventana-titulo");
            cuerpo.appendChild(opciones.cuerpo);
            ventana.append(barra, cuerpo);
            const cerrarla = (volver) => {
                fondo.hidden = true;
                fondo.replaceChildren();
                cerrarAhora = null;
                if (opciones.alCerrar) {
                    opciones.alCerrar();
                }
                if (volver && opciones.vuelta) {
                    opciones.vuelta.focus();
                }
            };
            cerrarAhora = cerrarla;
            cerrar.addEventListener("click", () => cerrarla(true));
            ventana.addEventListener("keydown", (e) => {
                if (e.key === "Escape") {
                    e.stopPropagation();
                    cerrarla(true);
                    return;
                }
                if (e.key !== "Tab") {
                    return;
                }
                const todos = Array.from(ventana.querySelectorAll("button, a[href], input, select, textarea"))
                    .filter((x) => !x.disabled && x.offsetParent !== null);
                const primero = todos[0];
                const ultimo = todos[todos.length - 1];
                if (e.shiftKey && document.activeElement === primero) {
                    e.preventDefault();
                    ultimo.focus();
                } else if (!e.shiftKey && document.activeElement === ultimo) {
                    e.preventDefault();
                    primero.focus();
                }
            });
            fondo.replaceChildren(ventana);
            fondo.hidden = false;
            (opciones.foco || cerrar).focus();
            return () => cerrarla(true);
        },
    };
})();
(function () {
    const menu = document.querySelector("[data-oc-menu]");
    const panel = document.querySelector("[data-oc-panel]");
    const contenedor = document.querySelector("[data-oc-partes]");
    if (!menu || !panel || !contenedor) {
        return;
    }
    const partes = Array.from(contenedor.querySelectorAll("[data-oc-parte]"));
    const ficha = document.getElementById("oc-ficha");
    const enlaces = Array.from(menu.querySelectorAll("a[data-oc-ir]"));
    if (!partes.length) {
        return;
    }
    partes.forEach((p) => {
        p.tabIndex = -1;
    });
    contenedor.tabIndex = 0;
    contenedor.setAttribute("role", "region");
    contenedor.setAttribute("aria-label", "Lo elegido del menú");
    const enMovil = window.matchMedia ? window.matchMedia("(max-width: 860px)") : { matches: false };
    const pagina = document.querySelector(".oc-ficha-page");
    const lateral = document.querySelector(".oc-lateral");
    const RESUMEN = "oc-resumen";
    let enResumen = false;
    let botonFicha = null;
    const enlaceFicha = menu.querySelector("a[data-oc-grupo]");
    const sub = document.getElementById("oc-menu-ficha");
    if (enlaceFicha && sub) {
        botonFicha = document.createElement("button");
        botonFicha.type = "button";
        botonFicha.className = enlaceFicha.className + " oc-menu-abrir";
        [...enlaceFicha.childNodes].forEach((n) => botonFicha.appendChild(n.cloneNode(true)));
        const flecha = document.createElement("span");
        flecha.className = "oc-menu-flecha";
        flecha.setAttribute("aria-hidden", "true");
        botonFicha.appendChild(flecha);
        botonFicha.setAttribute("aria-controls", sub.id);
        enlaceFicha.replaceWith(botonFicha);
        botonFicha.addEventListener("click", () => {
            const abrir = botonFicha.getAttribute("aria-expanded") !== "true";
            abrirFicha(abrir);
            if (abrir && !(ficha && ficha.contains(elegida))) {
                const primera = sub.querySelector("a[data-oc-ir]");
                if (primera) {
                    mostrar(primera.dataset.ocIr, false, true);
                }
            }
        });
    }
    function abrirFicha(si) {
        if (!botonFicha) {
            return;
        }
        botonFicha.setAttribute("aria-expanded", si ? "true" : "false");
        sub.hidden = !si;
        botonFicha.querySelector(".oc-menu-flecha").textContent = si ? "−" : "+";
    }
    let elegida = null;
    function nombreDe(id) {
        if (id === RESUMEN) {
            return ["📇", "resumen"];
        }
        const a = enlaces.find((x) => x.dataset.ocIr === id);
        if (!a) {
            return ["", ""];
        }
        const emoji = a.querySelector(".oc-menu-emoji");
        const texto = a.querySelector(".oc-menu-texto");
        const deFicha = ficha && sub && sub.contains(a);
        return [emoji ? emoji.textContent : "", (deFicha ? "ficha · " : "") + (texto ? texto.textContent : "")];
    }
    function mostrar(id, conFoco, apuntar) {
        enResumen = id === RESUMEN && enMovil.matches;
        if (pagina) {
            pagina.classList.toggle("ver-resumen", enResumen);
        }
        let parte = document.getElementById(id);
        if (!parte || !partes.includes(parte)) {
            parte = enResumen && elegida ? elegida : partes[0];
        }
        elegida = parte;
        const enFicha = !!(ficha && ficha.contains(parte));
        partes.forEach((p) => {
            p.hidden = p !== parte;
        });
        if (ficha) {
            ficha.hidden = !enFicha;
        }
        Array.from(contenedor.children).forEach((x) => {
            if (x !== ficha) {
                x.hidden = x !== parte;
            }
        });
        enlaces.forEach((a) => {
            if (a.dataset.ocIr === parte.id) {
                a.setAttribute("aria-current", "true");
            } else {
                a.removeAttribute("aria-current");
            }
        });
        if (botonFicha) {
            botonFicha.classList.toggle("es-la-de-ahora", enFicha);
            if (enFicha) {
                abrirFicha(true);
            }
        }
        pintarBotonMovil();
        contenedor.scrollTop = 0;
        if (conFoco) {
            (enResumen && lateral ? lateral : parte).focus({ preventScroll: true });
        }
        if (apuntar) {
            try {
                history.replaceState(null, "", "#" + (enResumen ? RESUMEN : parte.id));
            } catch (error) {
            }
        }
    }
    const barraMovil = document.createElement("div");
    barraMovil.className = "oc-menu-movil";
    const botonMovil = document.createElement("button");
    botonMovil.type = "button";
    botonMovil.className = "oc-menu-movil-boton";
    botonMovil.setAttribute("aria-haspopup", "dialog");
    botonMovil.setAttribute("aria-expanded", "false");
    barraMovil.appendChild(botonMovil);
    if (pagina) {
        pagina.prepend(barraMovil);
    }
    if (lateral) {
        lateral.tabIndex = -1;
    }
    function pintarBotonMovil() {
        const [emoji, texto] = nombreDe(enResumen ? RESUMEN : elegida && elegida.id);
        const icono = document.createElement("span");
        icono.className = "oc-menu-emoji";
        icono.setAttribute("aria-hidden", "true");
        icono.textContent = emoji;
        const nombre = document.createElement("span");
        nombre.className = "oc-menu-movil-texto";
        nombre.textContent = texto;
        const flecha = document.createElement("span");
        flecha.className = "oc-menu-movil-flecha";
        flecha.setAttribute("aria-hidden", "true");
        flecha.textContent = "▾";
        botonMovil.replaceChildren(icono, nombre, flecha);
        botonMovil.setAttribute("aria-label", "Partes de la ficha (ahora: " + texto + ")");
    }
    function medirTira() {
        if (pagina) {
            pagina.style.setProperty("--oc-tira-alto", enMovil.matches ? barraMovil.offsetHeight + "px" : "");
        }
    }
    let fondo = null;
    function opcion(lista, id, emoji, texto) {
        const li = document.createElement("li");
        const b = document.createElement("button");
        b.type = "button";
        b.className = "oc-menu-ventana-opcion";
        const icono = document.createElement("span");
        icono.className = "oc-menu-emoji";
        icono.setAttribute("aria-hidden", "true");
        icono.textContent = emoji;
        b.append(icono, document.createTextNode(texto));
        if ((enResumen && id === RESUMEN) || (!enResumen && elegida && elegida.id === id)) {
            b.setAttribute("aria-current", "true");
        }
        b.addEventListener("click", () => {
            cerrarVentana(false);
            mostrar(id, true, true);
            subirArriba();
        });
        li.appendChild(b);
        lista.appendChild(li);
    }
    function abrirVentana() {
        if (!fondo) {
            fondo = document.createElement("div");
            fondo.className = "oc-menu-fondo";
            fondo.hidden = true;
            fondo.addEventListener("click", (e) => {
                if (e.target === fondo) {
                    cerrarVentana(true);
                }
            });
            document.body.appendChild(fondo);
        }
        const ventana = document.createElement("div");
        ventana.className = "oc-menu-ventana";
        ventana.setAttribute("role", "dialog");
        ventana.setAttribute("aria-modal", "true");
        ventana.setAttribute("aria-labelledby", "oc-menu-ventana-titulo");
        const barra = document.createElement("div");
        barra.className = "oc-menu-ventana-barra";
        const titulo = document.createElement("h2");
        titulo.id = "oc-menu-ventana-titulo";
        titulo.className = "oc-menu-ventana-titulo";
        titulo.textContent = menu.getAttribute("aria-label") || "partes";
        const cerrar = document.createElement("button");
        cerrar.type = "button";
        cerrar.className = "oc-menu-ventana-cerrar";
        cerrar.textContent = "✕";
        cerrar.setAttribute("aria-label", "Cerrar");
        cerrar.addEventListener("click", () => cerrarVentana(true));
        barra.append(titulo, cerrar);
        const cuerpo = document.createElement("div");
        cuerpo.className = "oc-menu-ventana-cuerpo";
        const lista = document.createElement("ul");
        lista.className = "oc-menu-ventana-lista";
        if (lateral) {
            opcion(lista, RESUMEN, "📇", "resumen");
        }
        Array.from(menu.querySelectorAll(".oc-menu-lista > li")).forEach((li) => {
            const grupo = li.querySelector(".oc-menu-sub");
            if (grupo) {
                const caja = document.createElement("li");
                caja.className = "oc-menu-ventana-grupo";
                const [em, tx] = [botonFicha.querySelector(".oc-menu-emoji"), botonFicha.querySelector(".oc-menu-texto")];
                const cabeza = document.createElement("h3");
                cabeza.className = "oc-menu-ventana-subtitulo";
                cabeza.id = "oc-menu-ventana-ficha";
                cabeza.textContent = (em ? em.textContent + " " : "") + (tx ? tx.textContent : "ficha");
                const dentro = document.createElement("ul");
                dentro.className = "oc-menu-ventana-lista es-de-grupo";
                dentro.setAttribute("aria-labelledby", cabeza.id);
                grupo.querySelectorAll("a[data-oc-ir]").forEach((a) => {
                    const [e2, t2] = nombreDe(a.dataset.ocIr);
                    opcion(dentro, a.dataset.ocIr, e2, t2.replace(/^ficha · /, ""));
                });
                caja.append(cabeza, dentro);
                lista.appendChild(caja);
                return;
            }
            const a = li.querySelector("a[data-oc-ir]");
            if (a) {
                const [e2, t2] = nombreDe(a.dataset.ocIr);
                opcion(lista, a.dataset.ocIr, e2, t2);
            }
        });
        cuerpo.appendChild(lista);
        const volver = menu.querySelector(".oc-menu-volver");
        if (volver) {
            const otra = volver.cloneNode(true);
            otra.className = "oc-menu-ventana-volver";
            cuerpo.appendChild(otra);
        }
        ventana.append(barra, cuerpo);
        ventana.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                e.stopPropagation();
                cerrarVentana(true);
                return;
            }
            if (e.key !== "Tab") {
                return;
            }
            const todos = Array.from(ventana.querySelectorAll("button, a[href]"));
            const primero = todos[0];
            const ultimo = todos[todos.length - 1];
            if (e.shiftKey && document.activeElement === primero) {
                e.preventDefault();
                ultimo.focus();
            } else if (!e.shiftKey && document.activeElement === ultimo) {
                e.preventDefault();
                primero.focus();
            }
        });
        fondo.replaceChildren(ventana);
        fondo.hidden = false;
        botonMovil.setAttribute("aria-expanded", "true");
        const marcada = ventana.querySelector('[aria-current="true"]');
        (marcada || ventana.querySelector(".oc-menu-ventana-opcion")).focus();
        if (marcada) {
            marcada.scrollIntoView({ block: "nearest" });
        }
    }
    function cerrarVentana(volver) {
        if (!fondo || fondo.hidden) {
            return;
        }
        fondo.hidden = true;
        fondo.replaceChildren();
        botonMovil.setAttribute("aria-expanded", "false");
        if (volver) {
            botonMovil.focus();
        }
    }
    botonMovil.addEventListener("click", abrirVentana);
    let ultimaAltura = 0;
    let quietaHasta = 0;
    function alDesplazar() {
        if (!enMovil.matches || !pagina) {
            return;
        }
        const ahora = pagina.scrollHeight > pagina.clientHeight ? pagina.scrollTop : window.scrollY;
        if (performance.now() < quietaHasta) {
            ultimaAltura = ahora;
            return;
        }
        const cambio = ahora - ultimaAltura;
        if (Math.abs(cambio) < 8) {
            return;
        }
        const esconder = cambio > 0 && ahora > barraMovil.offsetHeight && document.activeElement !== botonMovil;
        barraMovil.classList.toggle("es-escondida", esconder);
        ultimaAltura = ahora;
    }
    function subirArriba() {
        if (!enMovil.matches || !pagina) {
            return;
        }
        barraMovil.classList.remove("es-escondida");
        quietaHasta = performance.now() + 500;
        if (pagina.scrollHeight > pagina.clientHeight) {
            pagina.scrollTop = 0;
        } else {
            window.scrollTo(0, 0);
        }
    }
    enlaces.forEach((a) => {
        a.addEventListener("click", (e) => {
            e.preventDefault();
            mostrar(a.dataset.ocIr, true, true);
        });
    });
    function desdeLaDireccion() {
        const pedido = decodeURIComponent((location.hash || "").slice(1));
        if (pedido === "oc-ficha" && sub) {
            const primera = sub.querySelector("a[data-oc-ir]");
            return primera ? primera.dataset.ocIr : "";
        }
        if (!pedido && enMovil.matches && lateral) {
            return RESUMEN;
        }
        return pedido;
    }
    panel.classList.add("con-menu");
    abrirFicha(false);
    medirTira();
    window.addEventListener("resize", medirTira);
    if (enMovil.addEventListener) {
        enMovil.addEventListener("change", () => {
            medirTira();
            barraMovil.classList.remove("es-escondida");
            cerrarVentana(false);
            if (!enMovil.matches && enResumen) {
                mostrar(elegida ? elegida.id : "", false, false);
            }
        });
    }
    if (pagina) {
        pagina.addEventListener("scroll", alDesplazar, { passive: true });
    }
    window.addEventListener("scroll", alDesplazar, { passive: true });
    botonMovil.addEventListener("focus", () => barraMovil.classList.remove("es-escondida"));
    if (window.ResizeObserver) {
        new ResizeObserver(medirTira).observe(barraMovil);
    }
    window.addEventListener("hashchange", () => mostrar(desdeLaDireccion(), false, false));
    mostrar(desdeLaDireccion(), false, false);
})();
document.querySelectorAll(".oc-ataques th[data-oc-desc]").forEach((th) => {
    const fila = document.getElementById(th.dataset.ocDesc);
    if (!fila) {
        return;
    }
    const b = document.createElement("button");
    b.type = "button";
    b.className = "oc-ataque-abrir";
    const flecha = document.createElement("span");
    flecha.className = "oc-desplegable-flecha";
    flecha.setAttribute("aria-hidden", "true");
    flecha.textContent = "▸";
    b.append(flecha, document.createTextNode(th.textContent));
    b.setAttribute("aria-expanded", "false");
    b.setAttribute("aria-controls", fila.id);
    th.replaceChildren(b);
    fila.hidden = true;
    b.addEventListener("click", () => {
        const abrir = fila.hidden;
        fila.hidden = !abrir;
        b.setAttribute("aria-expanded", abrir ? "true" : "false");
    });
});
(function () {
    const PHI = (1 + Math.sqrt(5)) / 2;
    const resta = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const suma = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
    const por = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
    const punto = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const unitario = (a) => por(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));
    function caras(vertices) {
        const salida = [];
        const vistas = new Set();
        const n = vertices.length;
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                for (let k = j + 1; k < n; k++) {
                    let normal = cruz(resta(vertices[j], vertices[i]), resta(vertices[k], vertices[i]));
                    if (Math.hypot(normal[0], normal[1], normal[2]) < 1e-6) {
                        continue;
                    }
                    normal = unitario(normal);
                    let d = punto(normal, vertices[i]);
                    let encima = 0;
                    let debajo = 0;
                    vertices.forEach((v) => {
                        const s = punto(normal, v) - d;
                        if (s > 1e-4) {
                            encima++;
                        } else if (s < -1e-4) {
                            debajo++;
                        }
                    });
                    if (encima && debajo) {
                        continue;
                    }
                    if (encima) {
                        normal = por(normal, -1);
                        d = -d;
                    }
                    const en = [];
                    vertices.forEach((v, x) => {
                        if (Math.abs(punto(normal, v) - d) < 1e-4) {
                            en.push(x);
                        }
                    });
                    const clave = en.slice().sort((a, b) => a - b).join(",");
                    if (vistas.has(clave)) {
                        continue;
                    }
                    vistas.add(clave);
                    const centro = por(en.reduce((s, x) => suma(s, vertices[x]), [0, 0, 0]), 1 / en.length);
                    const ref = unitario(resta(vertices[en[0]], centro));
                    const otro = cruz(normal, ref);
                    en.sort((a, b) => {
                        const pa = resta(vertices[a], centro);
                        const pb = resta(vertices[b], centro);
                        return Math.atan2(punto(pa, otro), punto(pa, ref)) - Math.atan2(punto(pb, otro), punto(pb, ref));
                    });
                    let radio = Infinity;
                    en.forEach((x, m) => {
                        const a = vertices[x];
                        const b = vertices[en[(m + 1) % en.length]];
                        const lado = unitario(resta(b, a));
                        const p = resta(centro, a);
                        const dist = Math.hypot(...resta(p, por(lado, punto(p, lado))));
                        radio = Math.min(radio, dist);
                    });
                    salida.push({ idx: en, normal, centro, arriba: ref, derecha: cruz(ref, normal), radio });
                }
            }
        }
        return salida;
    }
    function vertices(tipo) {
        const s = [-1, 1];
        if (tipo === 4) {
            return [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
        }
        if (tipo === 6 || tipo === "F") {
            return s.flatMap((x) => s.flatMap((y) => s.map((z) => [x, y, z])));
        }
        if (tipo === 8) {
            return [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
        }
        if (tipo === 10) {
            const z0 = 0.105;
            const corona = (i, z, giro) => [Math.cos((i * 72 + giro) * Math.PI / 180),
                Math.sin((i * 72 + giro) * Math.PI / 180), z];
            const a0 = corona(0, z0, 0);
            const b0 = corona(0, -z0, 36);
            const a1 = corona(1, z0, 0);
            const n = cruz(resta(b0, a0), resta(a1, a0));
            const punta = z0 + (n[0] * a0[0] + n[1] * a0[1]) / n[2];
            const vs = [[0, 0, punta], [0, 0, -punta]];
            for (let i = 0; i < 5; i++) {
                vs.push(corona(i, z0, 0), corona(i, -z0, 36));
            }
            return vs;
        }
        if (tipo === 12) {
            const vs = s.flatMap((x) => s.flatMap((y) => s.map((z) => [x, y, z])));
            s.forEach((a) => s.forEach((b) => {
                vs.push([0, a / PHI, b * PHI], [a / PHI, b * PHI, 0], [a * PHI, 0, b / PHI]);
            }));
            return vs;
        }
        if (tipo === 20) {
            const vs = [];
            s.forEach((a) => s.forEach((b) => {
                vs.push([0, a, b * PHI], [a, b * PHI, 0], [a * PHI, 0, b]);
            }));
            return vs;
        }
        const vs = [];
        for (let i = 0; i < 16; i++) {
            const a = i * Math.PI / 8;
            vs.push([Math.cos(a), Math.sin(a), 0.16], [Math.cos(a), Math.sin(a), -0.16]);
        }
        return vs;
    }
    const SOLIDOS = {};
    function solido(tipo) {
        if (!SOLIDOS[tipo]) {
            const vs = vertices(tipo);
            const r = Math.max(...vs.map((v) => Math.hypot(v[0], v[1], v[2])));
            const escalados = vs.map((v) => por(v, 1 / r));
            const todas = caras(escalados);
            const numeradas = tipo === 2 ? todas.filter((c) => c.idx.length > 4) : todas;
            SOLIDOS[tipo] = { vertices: escalados, caras: todas, numeradas };
        }
        return SOLIDOS[tipo];
    }
    function etiquetas(dado) {
        if (dado.caras === "F") {
            return ["+", "+", "−", "−", "", ""];
        }
        if (dado.caras === "decenas") {
            return ["00", "10", "20", "30", "40", "50", "60", "70", "80", "90"];
        }
        if (dado.caras === "unidades") {
            return ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
        }
        return Array.from({ length: dado.caras }, (_, i) => String(i + 1));
    }
    function tipoDe(caras) {
        if (caras === "decenas" || caras === "unidades") {
            return 10;
        }
        return [2, 4, 6, 8, 10, 12, 20, "F"].includes(caras) ? caras : 6;
    }
    function girar(eje, angulo) {
        const [x, y, z] = unitario(eje);
        const c = Math.cos(angulo);
        const s = Math.sin(angulo);
        const t = 1 - c;
        return [[t * x * x + c, t * x * y - s * z, t * x * z + s * y],
            [t * x * y + s * z, t * y * y + c, t * y * z - s * x],
            [t * x * z - s * y, t * y * z + s * x, t * z * z + c]];
    }
    const aplicar = (m, v) => [punto(m[0], v), punto(m[1], v), punto(m[2], v)];
    function componer(a, b) {
        return a.map((fila) => [0, 1, 2].map((j) => fila[0] * b[0][j] + fila[1] * b[1][j] + fila[2] * b[2][j]));
    }
    const ASPECTOS = {
        tema: { nombre: "el del tema" },
        hueso: { nombre: "hueso", cuerpo: [236, 226, 200], tinta: [52, 38, 28], borde: [140, 118, 92],
            fuente: "Georgia, serif" },
        obsidiana: { nombre: "obsidiana", cuerpo: [30, 26, 38], tinta: [228, 186, 84], borde: [150, 120, 60],
            acabado: "brillo", fuente: "Georgia, serif" },
        sangre: { nombre: "sangre", cuerpo: [112, 8, 22], tinta: [248, 228, 205], borde: [50, 0, 8], acabado: "brillo" },
        oro: { nombre: "oro", cuerpo: [214, 166, 58], tinta: [74, 44, 6], borde: [128, 86, 14], acabado: "metal" },
        plata: { nombre: "plata", cuerpo: [192, 198, 208], tinta: [32, 36, 48], borde: [96, 100, 116], acabado: "metal" },
        cristal: { nombre: "cristal", cuerpo: [110, 196, 255], tinta: [255, 255, 255], borde: [225, 246, 255],
            acabado: "cristal" },
        marmol: { nombre: "mármol", cuerpo: [238, 236, 232], tinta: [34, 34, 42], borde: [150, 150, 162],
            acabado: "vetas", vetas: [128, 128, 142] },
        madera: { nombre: "madera", cuerpo: [158, 104, 60], tinta: [248, 234, 205], borde: [86, 52, 24],
            acabado: "madera", vetas: [112, 70, 38], fuente: "Georgia, serif" },
        galaxia: { nombre: "galaxia", cuerpo: [44, 22, 86], tinta: [255, 238, 176], borde: [156, 118, 255],
            acabado: "galaxia" },
        neon: { nombre: "neón", cuerpo: [16, 14, 24], tinta: [70, 255, 210], borde: [70, 255, 210], acabado: "neon" },
        arcoiris: { nombre: "arcoíris", tinta: [255, 255, 255], borde: [255, 255, 255], acabado: "arcoiris" },
    };
    function hsl(h) {
        const f = (n) => {
            const k = (n + h / 30) % 12;
            return Math.round(255 * (0.5 - 0.42 * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
        };
        return [f(0), f(8), f(4)];
    }
    function azarFijo(semilla) {
        let a = semilla >>> 0;
        return () => {
            a = (a + 0x6D2B79F5) >>> 0;
            let x = Math.imul(a ^ (a >>> 15), 1 | a);
            x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
            return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
        };
    }
    let lienzo = null;
    let ctx = null;
    let dados = [];
    let empieza = 0;
    let pedido = 0;
    let sucia = null;
    let esperas = [];
    let ultimoFotograma = 0;
    let lento = 0;
    let fuenteActual = "";
    const RUEDA = 1100;
    const QUIETOS = 1700;
    const SE_VA = 450;
    function colorDe(nombre, porDefecto) {
        const valor = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim() || porDefecto;
        ctx.fillStyle = "#000";
        ctx.fillStyle = valor;
        const hex = ctx.fillStyle;
        const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
        if (m) {
            return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
        }
        const n = (hex.match(/[\d.]+/g) || [0, 0, 0]).map(Number);
        return n.slice(0, 3);
    }
    function montar() {
        lienzo = document.createElement("canvas");
        lienzo.className = "oc-dados-3d";
        lienzo.setAttribute("aria-hidden", "true");
        document.body.appendChild(lienzo);
        ctx = lienzo.getContext("2d");
    }
    function medir() {
        const dpr = window.devicePixelRatio || 1;
        lienzo.width = Math.round(window.innerWidth * dpr);
        lienzo.height = Math.round(window.innerHeight * dpr);
        lienzo.style.width = window.innerWidth + "px";
        lienzo.style.height = window.innerHeight + "px";
        fuenteActual = "";
        return dpr;
    }
    function zona() {
        const ventana = document.getElementById("oc-dados");
        const ancho = window.innerWidth;
        let x = ancho / 2;
        if (ventana && !ventana.hidden && ancho > 700) {
            const r = ventana.getBoundingClientRect();
            x = r.left + r.width / 2 > ancho / 2 ? r.left / 2 : (r.right + ancho) / 2;
        }
        return { x, y: window.innerHeight * 0.55 };
    }
    function lanzar(lista, aspecto) {
        const piel = ASPECTOS[aspecto] || ASPECTOS.tema;
        if (!lista || !lista.length) {
            return;
        }
        if (!lienzo) {
            montar();
        }
        medir();
        const raiz = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        const visibles = lista.slice(0, 20);
        const lado = Math.max(34, Math.min(60, raiz * 2.6, (window.innerWidth - 40) / 7 / 1.7));
        const porFila = Math.max(1, Math.min(visibles.length, Math.floor(Math.min(window.innerWidth - 40, 760)
            / (lado * 2.4))));
        const filas = Math.ceil(visibles.length / porFila);
        const centro = zona();
        const tema = {
            cuerpo: colorDe("--yellow", "#f5d76e"),
            tinta: colorDe("--yellow-contrast", "#1a1423"),
        };
        dados = visibles.map((d, i) => {
            const tipo = tipoDe(d.caras);
            const s = solido(tipo);
            const nombres = etiquetas(d);
            const final = Math.floor(Math.random() * s.numeradas.length);
            const valor = d.caras === "F" && String(d.valor) === "0" ? "" : String(d.valor);
            let resto = nombres.slice();
            const cual = resto.indexOf(valor);
            if (cual >= 0) {
                resto.splice(cual, 1);
            }
            resto = resto.sort(() => Math.random() - 0.5);
            const letras = new Map();
            s.numeradas.forEach((c, j) => {
                letras.set(c, j === final ? valor : (resto.pop() || ""));
            });
            const cara = s.numeradas[final];
            const derecha = cruz(cara.arriba, cara.normal);
            const deFrente = [derecha, cara.arriba, cara.normal];
            const inclinado = componer(componer(girar([1, 0, 0], -0.32), girar([0, 1, 0], (Math.random() - 0.5) * 0.6)),
                componer(girar([0, 0, 1], (Math.random() - 0.5) * 0.35), deFrente));
            const fila = Math.floor(i / porFila);
            const enFila = Math.min(porFila, visibles.length - fila * porFila);
            const destino = {
                x: centro.x + (i % porFila - (enFila - 1) / 2) * lado * 2.4,
                y: centro.y + (fila - (filas - 1) / 2) * lado * 2.5,
            };
            let color = piel.cuerpo || tema.cuerpo;
            let tinta = piel.tinta || tema.tinta;
            let borde = piel.borde || tema.tinta;
            if (piel.acabado === "arcoiris") {
                color = hsl((i * 360) / Math.max(1, visibles.length));
            }
            if (d.color === "vampiro" && !piel.cuerpo && piel.acabado !== "arcoiris") {
                color = [34, 30, 40];
                tinta = [255, 255, 255];
                borde = tinta;
            }
            let acabado = piel.acabado || "liso";
            if (d.color === "hambre") {
                color = [196, 18, 34];
                tinta = [255, 255, 255];
                borde = [90, 0, 10];
                acabado = "brillo";
            }
            return {
                s, letras, final: inclinado, destino, lado: lado * (tipo === 4 ? 1.15 : tipo === 2 ? 0.95 : 1),
                desde: { x: destino.x + (Math.random() - 0.5) * 500, y: destino.y - 260 - Math.random() * 160 },
                eje: [Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5],
                vueltas: (3 + Math.random() * 2.5) * Math.PI * 2,
                retraso: i * 35, color, tinta, borde, acabado, tipo, numero: i,
                fuente: piel.fuente || "system-ui, sans-serif", vetas: piel.vetas,
            };
        });
        const margen = lado * 2.2;
        const xs = dados.flatMap((d) => [d.desde.x, d.destino.x]);
        const ys = dados.flatMap((d) => [d.desde.y - 130, d.destino.y]);
        sucia = { x: Math.min(...xs) - margen, y: Math.min(...ys) - margen,
            x2: Math.max(...xs) + margen, y2: Math.max(...ys) + margen };
        esperas.forEach(clearTimeout);
        esperas = [];
        lienzo.classList.remove("se-va");
        borrar(true);
        empieza = performance.now();
        ultimoFotograma = 0;
        lento = 0;
        cancelAnimationFrame(pedido);
        pedido = requestAnimationFrame(pintar);
    }
    function borrar(todo) {
        const dpr = window.devicePixelRatio || 1;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        if (todo || !sucia) {
            ctx.clearRect(0, 0, lienzo.width, lienzo.height);
            return;
        }
        ctx.clearRect(sucia.x * dpr, sucia.y * dpr, (sucia.x2 - sucia.x) * dpr, (sucia.y2 - sucia.y) * dpr);
    }
    function preparar() {
        [4, 6, 8, 10, 12, 20, 2].forEach(solido);
    }
    const LUZ = unitario([-0.45, 0.6, 0.85]);
    const MEDIO = unitario(suma(LUZ, [0, 0, 1]));
    function pintar(ahora) {
        const dpr = window.devicePixelRatio || 1;
        if (lienzo.width !== Math.round(window.innerWidth * dpr)) {
            medir();
        }
        if (ultimoFotograma && ahora - ultimoFotograma > 30) {
            lento++;
        }
        ultimoFotograma = ahora;
        borrar(false);
        const pasado = ahora - empieza;
        const rodando = RUEDA + dados.length * 35;
        const ligero = lento >= 3;
        dados.forEach((d) => pintarDado(d, Math.min(1, Math.max(0, (pasado - d.retraso) / RUEDA)), dpr, ligero));
        if (pasado < rodando) {
            pedido = requestAnimationFrame(pintar);
            return;
        }
        esperas.push(setTimeout(() => lienzo.classList.add("se-va"), QUIETOS));
        esperas.push(setTimeout(() => {
            borrar(true);
            lienzo.classList.remove("se-va");
            dados = [];
        }, QUIETOS + SE_VA));
    }
    function pintarDado(d, t, dpr, ligero) {
        const suave = 1 - Math.pow(1 - t, 3);
        const bote = Math.abs(Math.sin(t * Math.PI * 2.6)) * Math.pow(1 - t, 2) * 120;
        const x = d.desde.x + (d.destino.x - d.desde.x) * suave;
        const y = d.desde.y + (d.destino.y - d.desde.y) * Math.min(1, t * 1.6) - bote;
        const giro = componer(girar(d.eje, d.vueltas * (1 - suave)), d.final);
        const foco = d.lado * 7;
        const proyectar = (v) => {
            const p = aplicar(giro, v);
            const k = foco / (foco - p[2] * d.lado);
            return [(x + p[0] * d.lado * k) * dpr, (y - p[1] * d.lado * k) * dpr];
        };
        const quieto = t >= 1;
        if (!ligero || quieto) {
            ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
            ctx.beginPath();
            ctx.ellipse(d.destino.x * dpr, (d.destino.y + d.lado * 1.05) * dpr, d.lado * (0.9 - bote / 400) * dpr,
                d.lado * 0.22 * dpr, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        const puntos = d.s.vertices.map(proyectar);
        const rgb = (c, a) => (a === undefined ? "rgb(" : "rgba(") + c.map((x) => Math.max(0, Math.min(255, Math.round(x))))
            .join(",") + (a === undefined ? ")" : "," + a + ")");
        const sencillo = ligero && !quieto;
        const acabado = sencillo ? "liso" : d.acabado;
        const cristal = acabado === "cristal";
        const orden = cristal ? d.s.caras.map((c) => [c, aplicar(giro, c.normal)]).sort((p, q) => p[1][2] - q[1][2])
            : d.s.caras.map((c) => [c, aplicar(giro, c.normal)]);
        orden.forEach(([c, n], j) => {
            const deFrente = n[2] > 0.01;
            if (!deFrente && !cristal) {
                return;
            }
            const luz = 0.42 + 0.58 * Math.max(0, punto(n, LUZ));
            const brillo = Math.pow(Math.max(0, punto(n, MEDIO)), 22);
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.beginPath();
            c.idx.forEach((v, m) => (m ? ctx.lineTo(...puntos[v]) : ctx.moveTo(...puntos[v])));
            ctx.closePath();
            const base = d.color.map((x) => x * luz);
            if (acabado === "metal") {
                const a = puntos[c.idx[0]];
                const b = puntos[c.idx[Math.floor(c.idx.length / 2)]];
                const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
                g.addColorStop(0, rgb(d.color.map((x) => x + (255 - x) * 0.6 * luz)));
                g.addColorStop(0.55, rgb(base));
                g.addColorStop(1, rgb(d.color.map((x) => x * 0.38)));
                ctx.fillStyle = g;
            } else if (cristal) {
                ctx.fillStyle = rgb(base.map((x) => x + 255 * brillo * 0.7), deFrente ? 0.42 : 0.18);
            } else if (acabado === "galaxia") {
                const o = proyectar(c.centro);
                const g = ctx.createRadialGradient(o[0], o[1], 0, o[0], o[1], d.lado * 0.9 * dpr);
                g.addColorStop(0, rgb([d.color[0] * 2.2 * luz, d.color[1] * 1.6 * luz, d.color[2] * 1.9 * luz]));
                g.addColorStop(1, rgb([6, 4, 18]));
                ctx.fillStyle = g;
            } else {
                const reflejo = acabado === "brillo" || acabado === "neon" ? brillo * 0.55 : brillo * 0.12;
                ctx.fillStyle = rgb(base.map((x) => x + 255 * reflejo));
            }
            ctx.fill();
            const enSuPlano = () => {
                const o = proyectar(c.centro);
                const ex = proyectar(suma(c.centro, por(c.derecha, 0.01)));
                const ey = proyectar(suma(c.centro, por(c.arriba, -0.01)));
                ctx.setTransform(ex[0] - o[0], ex[1] - o[1], ey[0] - o[0], ey[1] - o[1], o[0], o[1]);
            };
            if (deFrente && !ligero && ["vetas", "madera", "galaxia"].includes(d.acabado)) {
                ctx.save();
                ctx.clip();
                enSuPlano();
                const azar = azarFijo(d.numero * 97 + j * 13 + 7);
                const r = c.radio * 160;
                if (d.acabado !== "galaxia") {
                    const madera = d.acabado === "madera";
                    ctx.strokeStyle = rgb(d.vetas.map((x) => x * luz), madera ? 0.55 : 0.7);
                    for (let k = 0; k < (madera ? 7 : 3); k++) {
                        ctx.lineWidth = (madera ? 2 + azar() * 3 : 1 + azar() * 2.5) * 1;
                        ctx.beginPath();
                        const y0 = madera ? -r + (k + azar() * 0.6) * (2 * r / 7) : (azar() - 0.5) * 2 * r;
                        ctx.moveTo(-r * 1.2, y0);
                        ctx.bezierCurveTo(-r * 0.4, y0 + (azar() - 0.5) * r * (madera ? 0.4 : 1.4),
                            r * 0.4, y0 + (azar() - 0.5) * r * (madera ? 0.4 : 1.4), r * 1.2,
                            y0 + (azar() - 0.5) * r * (madera ? 0.3 : 1));
                        ctx.stroke();
                    }
                } else {
                    for (let k = 0; k < 14; k++) {
                        ctx.fillStyle = "rgba(255, 255, 255, " + (0.4 + azar() * 0.6).toFixed(2) + ")";
                        ctx.beginPath();
                        ctx.arc((azar() - 0.5) * 2 * r, (azar() - 0.5) * 2 * r, 1 + azar() * 2.4, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
                ctx.restore();
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.beginPath();
                c.idx.forEach((v, m) => (m ? ctx.lineTo(...puntos[v]) : ctx.moveTo(...puntos[v])));
                ctx.closePath();
            }
            ctx.lineWidth = (d.acabado === "neon" ? 2.2 : 1.5) * dpr;
            ctx.lineJoin = "round";
            ctx.strokeStyle = rgb(d.borde, d.acabado === "neon" || cristal ? (deFrente ? 0.95 : 0.35) : 0.75);
            if (d.acabado === "neon" && !ligero) {
                ctx.shadowColor = rgb(d.borde);
                ctx.shadowBlur = 9 * dpr;
            }
            ctx.stroke();
            ctx.shadowBlur = 0;
            const texto = d.letras.get(c);
            if (!deFrente || !texto || n[2] < 0.3 || (ligero && !quieto)) {
                return;
            }
            enSuPlano();
            const tam = c.radio * (texto.length > 1 ? 0.95 : 1.25) * 100;
            const fuente = "700 " + Math.round(tam) + "px " + d.fuente;
            if (fuente !== fuenteActual) {
                ctx.font = fuente;
                fuenteActual = fuente;
            }
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = rgb(d.tinta);
            if (d.acabado === "neon" && !ligero) {
                ctx.shadowColor = rgb(d.tinta);
                ctx.shadowBlur = 8 * dpr;
            }
            ctx.fillText(texto, 0, tam * 0.05);
            if ((texto === "6" || texto === "9") && d.tipo !== 6) {
                ctx.fillRect(-tam * 0.28, tam * 0.42, tam * 0.56, tam * 0.08);
            }
            ctx.shadowBlur = 0;
        });
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    function aspectos() {
        return Object.keys(ASPECTOS).map((k) => [k, ASPECTOS[k].nombre]);
    }
    window.ocDados3d = { lanzar, preparar, aspectos };
})();
(function () {
    const marcas = Array.from(document.querySelectorAll(".oc-dado[data-dados]"));
    const sitioDelBoton = document.querySelector("[data-oc-botones]");
    if (!marcas.length && !sitioDelBoton) {
        return;
    }
    const CARAS = [2, 4, 6, 8, 10, 12, 20, 100];
    const SISTEMA = (sitioDelBoton && sitioDelBoton.dataset.ocSistema) || "dnd5e";
    const menosMovimiento = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const estado = { mano: {}, modo: "normal", tiradas: [], cuenta: 0, sonido: leer("richi-dados-sonido") !== "no",
        tresD: leer("richi-dados-3d") ? leer("richi-dados-3d") === "si" : !menosMovimiento,
        aspecto: leer("richi-dados-aspecto") || "",
        aspectoDelPersonaje: (sitioDelBoton && sitioDelBoton.dataset.ocAspecto) || "",
        reserva: { atributo: null, habilidad: null, extra: 0,
            hambre: window.ocPartida && window.ocPartida.leer("hambre") !== undefined ? window.ocPartida.leer("hambre")
                : parseInt((sitioDelBoton && sitioDelBoton.dataset.ocHambre) || "0", 10) || 0 } };
    function leer(clave) {
        try {
            return localStorage.getItem(clave);
        } catch (e) {
            return null;
        }
    }
    function guardar(clave, valor) {
        try {
            localStorage.setItem(clave, valor);
        } catch (e) {
        }
    }
    function alAzar(caras) {
        const u = new Uint32Array(1);
        const tope = Math.floor(0x100000000 / caras) * caras;
        do {
            crypto.getRandomValues(u);
        } while (u[0] >= tope);
        return (u[0] % caras) + 1;
    }
    let audio = null;
    function sonar() {
        if (!estado.sonido) {
            return;
        }
        try {
            audio = audio || new (window.AudioContext || window.webkitAudioContext)();
            if (audio.state === "suspended") {
                audio.resume();
            }
            const largo = Math.floor(audio.sampleRate * 0.03);
            const ruido = audio.createBuffer(1, largo, audio.sampleRate);
            const datos = ruido.getChannelData(0);
            for (let i = 0; i < largo; i++) {
                datos[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / largo, 3);
            }
            let cuando = audio.currentTime + 0.01;
            for (let n = 0; n < 7; n++) {
                const golpe = audio.createBufferSource();
                golpe.buffer = ruido;
                const filtro = audio.createBiquadFilter();
                filtro.type = "bandpass";
                filtro.frequency.value = 1800 + Math.random() * 2200;
                filtro.Q.value = 3;
                const volumen = audio.createGain();
                volumen.gain.value = 0.55 * Math.pow(0.78, n);
                golpe.connect(filtro).connect(volumen).connect(audio.destination);
                golpe.start(cuando);
                cuando += 0.035 + n * 0.018 + Math.random() * 0.02;
            }
        } catch (e) {
        }
    }
    function sonarFinal(critico) {
        if (!estado.sonido || !audio) {
            return;
        }
        try {
            const notas = critico ? [523, 659, 784, 1047] : [392, 349, 311, 233];
            const empieza = audio.currentTime + 0.42;
            notas.forEach((frecuencia, i) => {
                const osc = audio.createOscillator();
                const volumen = audio.createGain();
                const t = empieza + i * (critico ? 0.09 : 0.16);
                osc.type = critico ? "triangle" : "sawtooth";
                osc.frequency.setValueAtTime(frecuencia, t);
                if (!critico && i === notas.length - 1) {
                    osc.frequency.exponentialRampToValueAtTime(frecuencia * 0.8, t + 0.45);
                }
                const largo = critico ? (i === notas.length - 1 ? 0.5 : 0.14) : (i === notas.length - 1 ? 0.55 : 0.18);
                volumen.gain.setValueAtTime(0.0001, t);
                volumen.gain.exponentialRampToValueAtTime(critico ? 0.22 : 0.09, t + 0.02);
                volumen.gain.exponentialRampToValueAtTime(0.0001, t + largo);
                osc.connect(volumen).connect(audio.destination);
                osc.start(t);
                osc.stop(t + largo + 0.02);
            });
        } catch (e) {
        }
    }
    function trozosDe(formula) {
        const trozos = [];
        const texto = String(formula).replace(/−/g, "-");
        const segmentos = [];
        const conTipo = /([^\[\]]*)\[([^\]]+)\]/g;
        let m;
        let fin = 0;
        while ((m = conTipo.exec(texto))) {
            segmentos.push([m[1], m[2]]);
            fin = conTipo.lastIndex;
        }
        segmentos.push([texto.slice(fin), ""]);
        const patron = /([+-]?)\s*(\d*)d(\d+|F)|([+-]?)\s*(\d+)/g;
        segmentos.forEach(([trozo, tipo]) => {
            patron.lastIndex = 0;
            while ((m = patron.exec(trozo))) {
                if (m[3]) {
                    trozos.push({ signo: m[1] === "-" ? -1 : 1, cuantos: Math.min(parseInt(m[2] || "1", 10), 100),
                        caras: m[3] === "F" ? "F" : parseInt(m[3], 10), tipo });
                } else {
                    trozos.push({ signo: m[4] === "-" ? -1 : 1, fijo: parseInt(m[5], 10), tipo });
                }
            }
        });
        return trozos;
    }
    function formulaParaVer(formula) {
        return String(formula).replace(/\s*\[([^\]]+)\]/g, " $1").replace(/\+/g, " + ").replace(/-/g, " − ")
            .replace(/\s+/g, " ").trim();
    }
    function claveDeTipo(tipo) {
        return String(tipo).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "");
    }
    function tirar(formula, que) {
        const especial = /^(v5|cp):(-?\d+)$/.exec(String(formula));
        if (especial) {
            return especial[1] === "v5" ? tirarReserva(parseInt(especial[2], 10), que, formula)
                : tirarCyberpunk(parseInt(especial[2], 10), que, formula);
        }
        const trozos = trozosDe(formula);
        if (!trozos.length) {
            return null;
        }
        const d20s = trozos.filter((t) => t.caras === 20).reduce((n, t) => n + t.cuantos, 0);
        let total = 0;
        const partes = [];
        let d20 = null;
        const dados3d = [];
        const tipos = [];
        const sumar = (tipo, n) => {
            if (!tipo) {
                return;
            }
            const ya = tipos.find((x) => x.tipo === tipo);
            if (ya) {
                ya.total += n;
            } else {
                tipos.push({ tipo, total: n });
            }
        };
        trozos.forEach((t) => {
            const signo = partes.length ? (t.signo < 0 ? "− " : "+ ") : (t.signo < 0 ? "− " : "");
            if (t.fijo !== undefined) {
                total += t.signo * t.fijo;
                sumar(t.tipo, t.signo * t.fijo);
                partes.push({ texto: (t.signo < 0 ? "− " : "+ ") + t.fijo });
                return;
            }
            if (t.caras === 20 && d20s === 1) {
                const a = alAzar(20);
                d20 = { d20: true, prefijo: signo, signo: t.signo, valores: [a], modo: "normal", queda: a };
                if (estado.modo !== "normal") {
                    ponerModo(d20, estado.modo);
                }
                d20.valores.forEach((v) => dados3d.push({ caras: 20, valor: v }));
                total += t.signo * d20.queda;
                partes.push(d20);
                return;
            }
            const salen = [];
            for (let i = 0; i < t.cuantos; i++) {
                const x = t.caras === "F" ? alAzar(3) - 2 : alAzar(t.caras);
                salen.push(t.caras === "F" ? ["−", "0", "+"][x + 1] : x);
                if (t.caras === 100) {
                    dados3d.push({ caras: "decenas", valor: String(Math.floor((x % 100) / 10) * 10).padStart(2, "0") },
                        { caras: "unidades", valor: x % 10 });
                } else {
                    dados3d.push({ caras: t.caras, valor: t.caras === "F" ? salen[salen.length - 1] : x });
                }
                total += t.signo * x;
                sumar(t.tipo, t.signo * x);
            }
            partes.push({ texto: signo + t.cuantos + "d" + t.caras + " [" + salen.join(", ") + "]" });
        });
        const r = guardarTirada({ que: que || "tirada", formula: String(formula), total, partes, d20, tipos, dados3d });
        if (trozos.some((t) => t.caras === "F")) {
            r.nota = escalera(total);
        }
        return terminar(r);
    }
    function guardarTirada(r) {
        estado.cuenta += 1;
        r.id = estado.cuenta;
        r.tipos = r.tipos || [];
        acabar(r);
        return r;
    }
    function terminar(r) {
        if (estado.agrupando) {
            estado.agrupando.push(r);
            anadir(r);
            return r;
        }
        enTresD(r.dados3d);
        sonar();
        if (r.critico || r.pifia) {
            sonarFinal(r.critico);
        }
        anadir(r);
        return r;
    }
    function doblarDados(formula) {
        return String(formula).replace(/(\d*)d(\d+)/g, (_, n, caras) => (parseInt(n || "1", 10) * 2) + "d" + caras);
    }
    function tirarVarias(lista, nombre) {
        estado.agrupando = [];
        let critico = false;
        lista.forEach((x, i) => {
            const r = tirar(i > 0 && critico ? doblarDados(x.formula) : x.formula,
                i > 0 && critico ? x.que + " (crítico)" : x.que);
            if (i === 0 && r && r.critico && r.d20) {
                critico = true;
            }
        });
        const grupo = estado.agrupando;
        estado.agrupando = null;
        if (!grupo.length) {
            return grupo;
        }
        enTresD(grupo.flatMap((r) => r.dados3d || []));
        sonar();
        const especial = grupo.find((r) => r.critico || r.pifia);
        if (especial) {
            sonarFinal(especial.critico);
        }
        if (ventana.hidden) {
            mostrarResultado(grupo, nombre);
        }
        return grupo;
    }
    function enTresD(lista) {
        if (estado.tresD && lista && lista.length && window.ocDados3d) {
            try {
                window.ocDados3d.lanzar(lista, estado.aspecto || estado.aspectoDelPersonaje || "tema");
            } catch (e) {
            }
        }
    }
    const ESCALERA = { 8: "Legendario", 7: "Épico", 6: "Fantástico", 5: "Soberbio", 4: "Grande", 3: "Bueno",
        2: "Normal", 1: "Mediano", 0: "Mediocre", "-1": "Malo", "-2": "Terrible" };
    function escalera(n) {
        return ESCALERA[Math.max(-2, Math.min(8, n))] || "";
    }
    function tirarReserva(cuantos, que, formula) {
        const n = Math.max(1, cuantos);
        const hambre = Math.min(estado.reserva.hambre, n);
        const normales = [];
        const deHambre = [];
        for (let i = 0; i < n; i++) {
            (i < hambre ? deHambre : normales).push(alAzar(10));
        }
        const todos = normales.concat(deHambre);
        const dieces = todos.filter((x) => x === 10).length;
        const parejas = Math.floor(dieces / 2);
        const exitos = todos.filter((x) => x >= 6).length + parejas * 2;
        const r = guardarTirada({ que: que || "reserva", formula: formula || "v5:" + n, total: exitos,
            unidad: exitos === 1 ? "éxito" : "éxitos", partes: [], d20: null,
            dados3d: normales.map((v) => ({ caras: 10, valor: v, color: "vampiro" }))
                .concat(deHambre.map((v) => ({ caras: 10, valor: v, color: "hambre" }))) });
        r.desglose = n + "d10 [" + (normales.join(", ") || "—") + "]" + (hambre ? " · hambre [" + deHambre.join(", ") + "]" : "");
        r.formulaVista = n + " dados" + (hambre ? ", " + hambre + " de hambre" : "");
        const sucio = parejas && deHambre.includes(10);
        const bestial = deHambre.includes(1);
        r.critico = parejas > 0 && !sucio;
        r.pifia = !!sucio || (bestial && !exitos);
        r.nota = [parejas ? (sucio ? "crítico sucio" : "crítico") : "",
            bestial ? (exitos ? "un 1 de hambre: si no llega, fallo bestial" : "fallo bestial") : ""]
            .filter(Boolean).join("; ");
        return terminar(r);
    }
    function tirarCyberpunk(base, que, formula) {
        const d = alAzar(10);
        const otro = d === 10 || d === 1 ? alAzar(10) : 0;
        const dado = d === 10 ? d + otro : d === 1 ? d - otro : d;
        const r = guardarTirada({ que: que || "tirada", formula, total: dado + base, partes: [], d20: null,
            dados3d: [{ caras: 10, valor: d }].concat(otro ? [{ caras: 10, valor: otro }] : []) });
        r.desglose = "1d10 [" + d + (d === 10 ? " + " + otro : d === 1 ? " − " + otro : "") + "]"
            + (base ? (base > 0 ? " + " : " − ") + Math.abs(base) : "");
        r.formulaVista = "1d10" + (base ? (base > 0 ? " + " : " − ") + Math.abs(base) : "");
        r.critico = d === 10;
        r.pifia = d === 1;
        r.nota = d === 10 ? "¡crítico! (+" + otro + ")" : d === 1 ? "pifia (−" + otro + ")" : "";
        return terminar(r);
    }
    function ponerModo(d20, modo) {
        const b = alAzar(20);
        d20.valores = [d20.valores[0], b];
        d20.modo = modo;
        d20.queda = modo === "ventaja" ? Math.max(d20.valores[0], b) : Math.min(d20.valores[0], b);
    }
    function acabar(r) {
        if (!r.d20 && !r.partes.length) {
            return;
        }
        r.desglose = r.partes.map((p) => {
            if (!p.d20) {
                return p.texto;
            }
            return p.prefijo + "1d20 [" + (p.modo === "normal" ? p.queda
                : p.queda + " (" + p.valores.join(" y ") + ", " + p.modo + ")") + "]";
        }).join(" ");
        r.critico = !!r.d20 && r.d20.queda === 20;
        r.pifia = !!r.d20 && r.d20.queda === 1;
        if (r.d20) {
            r.nota = r.critico ? "¡20 natural!" : r.pifia ? "pifia (1 natural)" : "";
        }
    }
    function dicho(r) {
        return r.que + ": " + r.total + (r.unidad ? " " + r.unidad : "") + (r.nota ? ", " + r.nota : "");
    }
    function cambiarModo(r, modo) {
        if (!r.d20 || r.d20.modo !== "normal") {
            return;
        }
        const antes = r.d20.queda;
        ponerModo(r.d20, modo);
        enTresD(r.d20.valores.map((v) => ({ caras: 20, valor: v })));
        r.total += r.d20.signo * (r.d20.queda - antes);
        acabar(r);
        sonar();
        if (r.critico || r.pifia) {
            sonarFinal(r.critico);
        }
        pintarHistorial();
        avisar(dicho(r).replace(r.que + ":", r.que + " con " + modo + ":") + ". " + r.desglose);
        const li = historial.querySelector('[data-id="' + r.id + '"] .oc-dados-repetir');
        if (li) {
            li.focus();
        }
    }
    const SILUETAS = {
        2: '<circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="5.5"/>',
        4: '<polygon points="12,3 22,20 2,20"/><path d="M12 3 L12 20"/>',
        6: '<rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="9" cy="9" r="1.2"/><circle cx="15" cy="15" r="1.2"/>',
        8: '<polygon points="12,2 21,12 12,22 3,12"/><path d="M3 12 H21"/>',
        10: '<polygon points="12,2 21,10 12,22 3,10"/><path d="M3 10 L12 14 L21 10 M12 14 V22"/>',
        12: '<polygon points="12,2 21.5,9 18,20.5 6,20.5 2.5,9"/><polygon points="12,7 16.5,10.5 15,16 9,16 7.5,10.5"/>',
        20: '<polygon points="12,2 21,7 21,17 12,22 3,17 3,7"/><polygon points="12,7 17,15.5 7,15.5"/>',
        100: '<polygon points="7,3 12,9 7,21 2,9"/><polygon points="17,3 22,9 17,21 12,9"/>',
    };
    function silueta(caras) {
        const ns = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(ns, "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("class", "oc-dados-silueta");
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("focusable", "false");
        svg.innerHTML = SILUETAS[caras];
        return svg;
    }
    let ventana = null;
    let boton = null;
    let historial = null;
    let aviso = null;
    let manoTexto = null;
    let tirarBoton = null;
    let modInput = null;
    let borrarTodo = null;
    function crear(tag, clase, texto) {
        const x = document.createElement(tag);
        if (clase) {
            x.className = clase;
        }
        if (texto !== undefined) {
            x.textContent = texto;
        }
        return x;
    }
    function botonDe(clase, texto, alPulsar, etiqueta) {
        const b = crear("button", clase, texto);
        b.type = "button";
        if (etiqueta) {
            b.setAttribute("aria-label", etiqueta);
        }
        b.addEventListener("click", alPulsar);
        return b;
    }
    function modificador() {
        return parseInt(modInput.value || "0", 10) || 0;
    }
    function formulaDeLaMano() {
        const trozos = CARAS.filter((c) => estado.mano[c]).sort((a, b) => b - a)
            .map((c) => estado.mano[c] + "d" + c);
        let texto = trozos.join(" + ");
        const mod = modificador();
        if (mod) {
            texto += (mod > 0 ? " + " : " − ") + Math.abs(mod);
        }
        return texto;
    }
    const celdas = {};
    function cambiarDado(c, n, volverA) {
        const enPasos = celdas[c].pasos.contains(document.activeElement);
        estado.mano[c] = Math.max(0, Math.min(99, (estado.mano[c] || 0) + n));
        if (!estado.mano[c]) {
            delete estado.mano[c];
        }
        pintarMano();
        if (!estado.mano[c] && enPasos) {
            volverA.focus();
        }
        avisar(estado.mano[c] ? "Llevas " + estado.mano[c] + "d" + c + "." : "Sin d" + c + ".");
    }
    function pintarMano() {
        CARAS.forEach((c) => {
            const x = celdas[c];
            if (!x) {
                return;
            }
            const n = estado.mano[c] || 0;
            x.celda.classList.toggle("tiene", n > 0);
            x.cuantos.textContent = n ? "×" + n : "";
            x.pasos.hidden = !n;
            x.boton.setAttribute("aria-label", "Añadir un d" + c + (n ? " (hay " + n + ")" : ""));
        });
        const hay = CARAS.some((c) => estado.mano[c]);
        manoTexto.textContent = hay ? formulaDeLaMano() : "elige los dados de arriba";
        tirarBoton.disabled = !hay;
    }
    function montar() {
        ventana = crear("div", "oc-dados");
        ventana.id = "oc-dados";
        ventana.setAttribute("role", "region");
        ventana.setAttribute("aria-label", "Lanzador de dados");
        ventana.hidden = true;
        const barra = crear("div", "oc-dados-barra");
        barra.title = "Arrástrala para moverla";
        const titulo = crear("h2", "oc-dados-titulo");
        const emoji = crear("span", "oc-dados-emoji", "🎲");
        emoji.setAttribute("aria-hidden", "true");
        titulo.append(emoji, document.createTextNode("dados.exe"));
        const sonido = botonDe("oc-dados-mando", estado.sonido ? "🔊" : "🔇", () => {
            estado.sonido = !estado.sonido;
            sonido.textContent = estado.sonido ? "🔊" : "🔇";
            sonido.setAttribute("aria-pressed", estado.sonido ? "true" : "false");
            guardar("richi-dados-sonido", estado.sonido ? "si" : "no");
        }, "Sonido al tirar");
        sonido.setAttribute("aria-pressed", estado.sonido ? "true" : "false");
        const tresD = botonDe("oc-dados-mando es-3d", "3D", () => {
            estado.tresD = !estado.tresD;
            tresD.setAttribute("aria-pressed", estado.tresD ? "true" : "false");
            const fila = document.getElementById("oc-dados-aspecto");
            if (fila) {
                fila.parentNode.hidden = !estado.tresD;
            }
            guardar("richi-dados-3d", estado.tresD ? "si" : "no");
        }, "Dados en 3D");
        tresD.setAttribute("aria-pressed", estado.tresD ? "true" : "false");
        const cerrar = botonDe("oc-dados-mando", "✕", () => abrir(false, true), "Cerrar los dados");
        const mandos = crear("div", "oc-dados-mandos");
        mandos.append(tresD, sonido, cerrar);
        barra.append(titulo, mandos);
        arrastrable(barra);
        const cuerpo = crear("div", "oc-dados-cuerpo");
        const bandeja = crear("div", "oc-dados-bandeja");
        bandeja.setAttribute("role", "group");
        bandeja.setAttribute("aria-label", "Añadir dados");
        CARAS.forEach((c) => {
            const celda = crear("div", "oc-dados-celda");
            const b = botonDe("oc-dados-cara", undefined, () => cambiarDado(c, 1, b), "Añadir un d" + c);
            const cuantos = crear("span", "oc-dados-cuantos");
            cuantos.setAttribute("aria-hidden", "true");
            b.append(silueta(c), crear("span", "oc-dados-cara-nombre", "d" + c), cuantos);
            const pasos = crear("div", "oc-dados-cara-pasos");
            pasos.hidden = true;
            pasos.append(
                botonDe("oc-dados-cara-paso", "−", () => cambiarDado(c, -1, b), "Quitar un d" + c),
                botonDe("oc-dados-cara-paso", "+", () => cambiarDado(c, 1, b), "Añadir otro d" + c));
            celda.append(b, pasos);
            celdas[c] = { celda, boton: b, cuantos, pasos };
            bandeja.appendChild(celda);
        });
        manoTexto = crear("p", "oc-dados-mano");
        const fila = crear("div", "oc-dados-fila");
        const etiqueta = crear("label", "oc-dados-etiqueta", "modificador");
        modInput = crear("input", "oc-dados-mod");
        modInput.type = "number";
        modInput.id = "oc-dados-mod";
        modInput.value = "0";
        modInput.step = "1";
        etiqueta.htmlFor = modInput.id;
        modInput.addEventListener("input", pintarMano);
        const cambiar = (n) => {
            modInput.value = String(modificador() + n);
            pintarMano();
        };
        const menos = botonDe("oc-dados-paso", "−", () => cambiar(-1), "Restar 1 al modificador");
        const mas = botonDe("oc-dados-paso", "+", () => cambiar(1), "Sumar 1 al modificador");
        const caja = crear("div", "oc-dados-mod-caja");
        caja.append(menos, modInput, mas);
        fila.append(etiqueta, caja);
        const modos = crear("div", "oc-dados-modos");
        modos.setAttribute("role", "group");
        modos.setAttribute("aria-label", "Ventaja o desventaja (para lo que se tira con un d20)");
        const botonesModo = ["normal", "ventaja", "desventaja"].map((m) => {
            const b = botonDe("oc-dados-modo", m, () => {
                estado.modo = m;
                botonesModo.forEach((x) => x.setAttribute("aria-pressed", x.textContent === m ? "true" : "false"));
            });
            b.setAttribute("aria-pressed", m === estado.modo ? "true" : "false");
            modos.appendChild(b);
            return b;
        });
        const acciones = crear("div", "oc-dados-acciones");
        tirarBoton = botonDe("oc-dados-tirar", "tirar", () => tirar(formulaDeLaMano(), "bandeja"));
        const vaciar = botonDe("oc-dados-vaciar", "vaciar", () => {
            estado.mano = {};
            avisar("Bandeja vacía.");
            modInput.value = "0";
            pintarMano();
        }, "Vaciar la bandeja");
        acciones.append(tirarBoton, vaciar);
        if (SISTEMA === "fate" || SISTEMA === "cpred") {
            const fate = SISTEMA === "fate";
            acciones.appendChild(botonDe("oc-dados-tirar es-del-sistema", fate ? "tirar 4dF" : "tirar 1d10", () => {
                const mod = modificador();
                tirar(fate ? "4dF" + (mod ? (mod > 0 ? "+" : "") + mod : "") : "cp:" + mod, fate ? "4dF" : "1d10");
            }, fate ? "Tirar 4dF más el modificador" : "Tirar 1d10 más el modificador (con críticos y pifias)"));
        }
        const reserva = SISTEMA === "vtm5" ? montarReserva() : null;
        const guardadasCaja = montarGuardadas();
        const filaAspecto = crear("div", "oc-dados-fila");
        const etiquetaAspecto = crear("label", "oc-dados-etiqueta", "aspecto");
        const elegirAspecto = crear("select", "oc-dados-elegir");
        elegirAspecto.id = "oc-dados-aspecto";
        etiquetaAspecto.htmlFor = elegirAspecto.id;
        const propio = ((window.ocDados3d && window.ocDados3d.aspectos()) || [])
            .find((x) => x[0] === estado.aspectoDelPersonaje);
        const deCada = crear("option", "", propio ? "el de este personaje (" + propio[1] + ")" : "el de cada personaje");
        deCada.value = "";
        elegirAspecto.appendChild(deCada);
        ((window.ocDados3d && window.ocDados3d.aspectos()) || []).forEach(([clave, nombre]) => {
            const o = crear("option", "", nombre);
            o.value = clave;
            elegirAspecto.appendChild(o);
        });
        elegirAspecto.value = estado.aspecto;
        elegirAspecto.addEventListener("change", () => {
            estado.aspecto = elegirAspecto.value;
            guardar("richi-dados-aspecto", estado.aspecto);
            enTresD([{ caras: 20, valor: 20 }]);
        });
        filaAspecto.append(etiquetaAspecto, elegirAspecto);
        filaAspecto.hidden = !estado.tresD;
        const cabeza = crear("div", "oc-dados-cabeza-historial");
        cabeza.appendChild(crear("h3", "oc-dados-subtitulo", "tiradas"));
        borrarTodo = botonDe("oc-dados-borrar-todo", "borrar todo", () => {
            estado.tiradas = [];
            pintarHistorial();
            avisar("Tiradas borradas.");
        }, "Borrar todas las tiradas");
        cabeza.appendChild(borrarTodo);
        historial = crear("ol", "oc-dados-historial");
        aviso = crear("p", "visually-hidden");
        aviso.setAttribute("role", "status");
        if (reserva) {
            cuerpo.append(reserva, bandeja, manoTexto, fila, acciones, guardadasCaja, filaAspecto, cabeza, historial);
        } else {
            cuerpo.append(bandeja, manoTexto, fila, modos, acciones, guardadasCaja, filaAspecto, cabeza, historial);
        }
        ventana.append(barra, cuerpo);
        document.body.appendChild(aviso);
        ventana.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                abrir(false, true);
            }
        });
        document.body.appendChild(ventana);
        colocarDondeEstaba();
        pintarMano();
        pintarHistorial();
    }
    let reservaTexto = null;
    const reservaSelects = {};
    let hambreInput = null;
    function opcionesDe(tipo) {
        const vistas = new Map();
        document.querySelectorAll('.oc-dado[data-reserva="' + tipo + '"]').forEach((x) => {
            if (!vistas.has(x.dataset.que)) {
                vistas.set(x.dataset.que, parseInt(x.dataset.valor || "0", 10) || 0);
            }
        });
        return vistas;
    }
    function cuantosEnReserva() {
        const r = estado.reserva;
        return (r.atributo ? r.atributo[1] : 0) + (r.habilidad ? r.habilidad[1] : 0) + r.extra;
    }
    function textoDeReserva() {
        const r = estado.reserva;
        const trozos = [r.atributo, r.habilidad].filter(Boolean).map((x) => x[0] + " " + x[1]);
        if (r.extra) {
            trozos.push((r.extra > 0 ? "+" : "−") + Math.abs(r.extra) + " de más");
        }
        const n = Math.max(0, cuantosEnReserva());
        return (trozos.join(" + ") || "nada") + ": " + n + (n === 1 ? " dado" : " dados")
            + (n ? ", " + Math.min(r.hambre, n) + " de hambre" : "");
    }
    function pintarReserva() {
        if (!reservaTexto) {
            return;
        }
        reservaTexto.textContent = textoDeReserva();
        ["atributo", "habilidad"].forEach((tipo) => {
            reservaSelects[tipo].value = estado.reserva[tipo] ? estado.reserva[tipo][0] : "";
        });
        hambreInput.value = String(estado.reserva.hambre);
    }
    function montarReserva() {
        const caja = crear("div", "oc-dados-reserva");
        caja.setAttribute("role", "group");
        caja.setAttribute("aria-labelledby", "oc-reserva-titulo");
        const titulo = crear("h3", "oc-dados-subtitulo", "reserva");
        titulo.id = "oc-reserva-titulo";
        caja.appendChild(titulo);
        [["atributo", "atributo"], ["habilidad", "habilidad"]].forEach(([tipo, texto]) => {
            const fila = crear("div", "oc-dados-fila");
            const etiqueta = crear("label", "oc-dados-etiqueta", texto);
            const sel = crear("select", "oc-dados-elegir");
            sel.id = "oc-reserva-" + tipo;
            etiqueta.htmlFor = sel.id;
            const ninguno = crear("option", "", "— ninguno —");
            ninguno.value = "";
            sel.appendChild(ninguno);
            const opciones = opcionesDe(tipo);
            opciones.forEach((valor, nombre) => {
                const o = crear("option", "", nombre + " (" + valor + ")");
                o.value = nombre;
                sel.appendChild(o);
            });
            sel.addEventListener("change", () => {
                estado.reserva[tipo] = sel.value ? [sel.value, opciones.get(sel.value)] : null;
                pintarReserva();
            });
            reservaSelects[tipo] = sel;
            fila.append(etiqueta, sel);
            caja.appendChild(fila);
        });
        const numero = (id, texto, leer, poner, etiquetas) => {
            const fila = crear("div", "oc-dados-fila");
            const etiqueta = crear("label", "oc-dados-etiqueta", texto);
            const input = crear("input", "oc-dados-mod");
            input.type = "number";
            input.id = id;
            input.step = "1";
            input.value = String(leer());
            etiqueta.htmlFor = id;
            input.addEventListener("input", () => {
                poner(parseInt(input.value || "0", 10) || 0);
                pintarReserva();
            });
            const cambiar = (n) => {
                poner(leer() + n);
                pintarReserva();
            };
            const mandos = crear("div", "oc-dados-mod-caja");
            mandos.append(botonDe("oc-dados-paso", "−", () => cambiar(-1), etiquetas[0]), input,
                botonDe("oc-dados-paso", "+", () => cambiar(1), etiquetas[1]));
            fila.append(etiqueta, mandos);
            caja.appendChild(fila);
            return input;
        };
        numero("oc-reserva-extra", "dados de más", () => estado.reserva.extra, (n) => {
            estado.reserva.extra = Math.max(-20, Math.min(20, n));
        }, ["Un dado menos", "Un dado más"]);
        hambreInput = numero("oc-reserva-hambre", "hambre", () => estado.reserva.hambre, (n) => {
            estado.reserva.hambre = Math.max(0, Math.min(5, n));
            if (window.ocPartida) {
                window.ocPartida.guardar("hambre", estado.reserva.hambre);
            }
        }, ["Un punto menos de hambre", "Un punto más de hambre"]);
        reservaTexto = crear("p", "oc-dados-mano");
        caja.appendChild(reservaTexto);
        const tirarla = botonDe("oc-dados-tirar es-del-sistema", "tirar reserva", () => {
            const r = estado.reserva;
            const que = [r.atributo, r.habilidad].filter(Boolean).map((x) => x[0]).join(" + ") || "reserva";
            tirarReserva(cuantosEnReserva(), que);
        });
        caja.appendChild(tirarla);
        pintarReserva();
        return caja;
    }
    function ponerEnReserva(b) {
        const tipo = b.dataset.reserva === "habilidad" ? "habilidad" : "atributo";
        estado.reserva[tipo] = [b.dataset.que, parseInt(b.dataset.valor || "0", 10) || 0];
        pintarReserva();
        if (ventana.hidden) {
            abrir(true, false);
        }
        avisar("Reserva: " + textoDeReserva() + ". Tírala con «tirar reserva», en los dados.");
    }
    function dejarDentro(x, y) {
        const ancho = ventana.offsetWidth;
        const alto = ventana.offsetHeight;
        return [Math.min(Math.max(0, x), Math.max(0, window.innerWidth - ancho)),
            Math.min(Math.max(0, y), Math.max(0, window.innerHeight - Math.min(alto, 60)))];
    }
    function ponerEn(x, y) {
        const [a, b] = dejarDentro(x, y);
        ventana.style.left = a + "px";
        ventana.style.top = b + "px";
        ventana.style.right = "auto";
        ventana.style.bottom = "auto";
        ventana.style.maxHeight = Math.max(200, window.innerHeight - b - 12) + "px";
        return [a, b];
    }
    function colocarDondeEstaba() {
        const sitio = (leer("richi-dados-sitio") || "").split(",").map(Number);
        if (sitio.length === 2 && sitio.every(Number.isFinite)) {
            ventana.dataset.sitio = sitio.join(",");
        }
    }
    function arrastrable(barra) {
        let desde = null;
        barra.addEventListener("pointerdown", (e) => {
            if (e.button !== 0 || e.target.closest("button")) {
                return;
            }
            const caja = ventana.getBoundingClientRect();
            desde = { x: e.clientX - caja.left, y: e.clientY - caja.top };
            barra.setPointerCapture(e.pointerId);
            ventana.classList.add("se-mueve");
            e.preventDefault();
        });
        barra.addEventListener("pointermove", (e) => {
            if (desde) {
                ponerEn(e.clientX - desde.x, e.clientY - desde.y);
            }
        });
        const soltar = () => {
            if (!desde) {
                return;
            }
            desde = null;
            ventana.classList.remove("se-mueve");
            guardar("richi-dados-sitio", parseInt(ventana.style.left, 10) + "," + parseInt(ventana.style.top, 10));
        };
        barra.addEventListener("pointerup", soltar);
        barra.addEventListener("pointercancel", soltar);
        window.addEventListener("resize", () => {
            if (!ventana.hidden && ventana.style.left) {
                ponerEn(parseInt(ventana.style.left, 10), parseInt(ventana.style.top, 10));
            }
        });
    }
    function abrir(si, devolverFoco) {
        ventana.hidden = !si;
        if (si) {
            cerrarResultado();
        }
        if (si && estado.tresD && window.ocDados3d) {
            (window.requestIdleCallback || setTimeout)(() => window.ocDados3d.preparar());
        }
        if (si && ventana.dataset.sitio) {
            const [x, y] = ventana.dataset.sitio.split(",").map(Number);
            delete ventana.dataset.sitio;
            ponerEn(x, y);
        } else if (si && ventana.style.left) {
            ponerEn(parseInt(ventana.style.left, 10), parseInt(ventana.style.top, 10));
        }
        if (boton) {
            boton.setAttribute("aria-expanded", si ? "true" : "false");
            if (!si && devolverFoco) {
                boton.focus();
            }
        }
    }
    function avisar(texto) {
        aviso.textContent = "";
        setTimeout(() => {
            aviso.textContent = texto;
        }, 50);
    }
    function anadir(r) {
        if (ventana.hidden && !estado.agrupando) {
            mostrarResultado(r);
        }
        estado.tiradas.unshift(r);
        estado.tiradas = estado.tiradas.slice(0, 30);
        pintarHistorial();
        avisar(dicho(r)
            + (r.tipos.length ? " (" + r.tipos.map((x) => x.total + " " + x.tipo).join(", ") + ")" : "")
            + ". " + r.desglose);
    }
    let listaGuardadas = null;
    function leerGuardadas() {
        return (window.ocPartida && window.ocPartida.leer("guardadas", [])) || [];
    }
    function apuntarGuardada(nombre, formulas) {
        const todas = leerGuardadas();
        todas.push({ nombre: String(nombre || "tirada").slice(0, 60), formulas });
        if (window.ocPartida) {
            window.ocPartida.guardar("guardadas", todas.slice(-30));
        }
        pintarGuardadas();
        avisar("Guardada: " + nombre + ".");
    }
    function pintarGuardadas() {
        if (!listaGuardadas) {
            return;
        }
        const todas = leerGuardadas();
        listaGuardadas.replaceChildren(...todas.map((g, i) => {
            const li = crear("li", "oc-guardada");
            const que = g.formulas.map((f) => formulaParaVer(f.formula)).join(" · ");
            const tirarla = botonDe("oc-guardada-tirar", undefined, () => {
                if (g.formulas.length === 1) {
                    tirar(g.formulas[0].formula, g.formulas[0].que || g.nombre);
                } else {
                    tirarVarias(g.formulas, g.nombre);
                }
            }, "Tirar " + g.nombre + " (" + que + ")");
            tirarla.append(crear("span", "oc-guardada-nombre", g.nombre), crear("span", "oc-guardada-formula", que));
            const quitarla = botonDe("oc-dados-quitar", "✕", () => {
                const quedan = leerGuardadas().filter((_, j) => j !== i);
                window.ocPartida.guardar("guardadas", quedan);
                pintarGuardadas();
                avisar("Quitada: " + g.nombre + ".");
                (listaGuardadas.querySelectorAll(".oc-guardada-tirar")[Math.min(i, quedan.length - 1)]
                    || nuevaNombre).focus();
            }, "Quitar la guardada: " + g.nombre);
            li.append(tirarla, quitarla);
            return li;
        }));
        listaGuardadas.hidden = !todas.length;
    }
    let nuevaNombre = null;
    function montarGuardadas() {
        const caja = crear("div", "oc-dados-guardadas");
        const cabeza = crear("h3", "oc-dados-subtitulo", "guardadas");
        cabeza.id = "oc-guardadas-titulo";
        listaGuardadas = crear("ul", "oc-guardadas");
        listaGuardadas.setAttribute("aria-labelledby", cabeza.id);
        const detalles = crear("details", "oc-guardada-nueva");
        const resumen = crear("summary", "", "＋ nueva");
        nuevaNombre = crear("input", "oc-dados-texto");
        nuevaNombre.id = "oc-guardada-nombre";
        nuevaNombre.placeholder = "ataque con espada";
        const etNombre = crear("label", "oc-dados-etiqueta", "nombre");
        etNombre.htmlFor = nuevaNombre.id;
        const formulas = crear("input", "oc-dados-texto");
        formulas.id = "oc-guardada-formulas";
        formulas.placeholder = "1d20+5; 1d8+3";
        formulas.setAttribute("aria-describedby", "oc-guardada-ayuda");
        const etFormulas = crear("label", "oc-dados-etiqueta", "dados");
        etFormulas.htmlFor = formulas.id;
        const ayuda = crear("p", "oc-dados-ayuda", "Varias, separadas por «;», se tiran a la vez.");
        ayuda.id = "oc-guardada-ayuda";
        const guardarla = botonDe("oc-dados-vaciar", "guardar", () => {
            const lista = formulas.value.split(";").map((x) => x.trim()).filter((x) => /^(v5|cp):-?\d+$/.test(x)
                || /\d*d(\d+|F)/i.test(x));
            if (!lista.length) {
                avisar("Escribe los dados: «1d20+5; 1d8+3».");
                formulas.focus();
                return;
            }
            const nombre = nuevaNombre.value.trim() || lista.join(" · ");
            apuntarGuardada(nombre, lista.map((f, i) => ({ formula: f, que: lista.length > 1 ? nombre + " (" + (i + 1) + ")" : nombre })));
            nuevaNombre.value = "";
            formulas.value = "";
        });
        detalles.append(resumen, etNombre, nuevaNombre, etFormulas, formulas, ayuda, guardarla);
        caja.append(cabeza, listaGuardadas, detalles);
        pintarGuardadas();
        return caja;
    }
    let flotante = null;
    let flotanteVa = 0;
    let flotanteSale = 0;
    function montarFlotante() {
        flotante = crear("div", "oc-resultado");
        flotante.hidden = true;
        flotante.setAttribute("role", "region");
        flotante.setAttribute("aria-label", "Resultado de la tirada");
        const quedarse = () => clearTimeout(flotanteVa);
        const irse = () => {
            clearTimeout(flotanteVa);
            flotanteVa = setTimeout(cerrarResultado, 2500);
        };
        flotante.addEventListener("mouseenter", quedarse);
        flotante.addEventListener("focusin", quedarse);
        flotante.addEventListener("mouseleave", irse);
        flotante.addEventListener("focusout", irse);
        flotante.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                cerrarResultado();
            }
        });
        document.body.appendChild(flotante);
    }
    function cerrarResultado() {
        clearTimeout(flotanteVa);
        clearTimeout(flotanteSale);
        if (!flotante || flotante.hidden) {
            return;
        }
        const tenia = flotante.contains(document.activeElement);
        flotante.hidden = true;
        if (tenia && boton) {
            boton.focus();
        }
    }
    function bloqueDeResultado(r, varias) {
        const caja = crear("div", "oc-resultado-uno" + (varias ? " es-de-varias" : ""));
        const cabeza = crear("p", "oc-resultado-que");
        cabeza.append(crear("span", "", r.que), crear("span", "oc-resultado-formula",
            r.formulaVista || formulaParaVer(r.formula)));
        const total = crear("p", "oc-resultado-total" + (r.critico ? " es-critico" : "") + (r.pifia ? " es-pifia" : ""),
            String(r.total));
        if (r.unidad) {
            total.appendChild(crear("span", "oc-resultado-unidad", r.unidad));
        }
        caja.append(cabeza, total);
        if (r.nota) {
            caja.appendChild(crear("p", "oc-resultado-nota", r.nota));
        }
        if (r.tipos && r.tipos.length) {
            const tipos = crear("p", "oc-dados-tipos");
            r.tipos.forEach((x) => tipos.appendChild(crear("span", "oc-dano oc-dano-" + claveDeTipo(x.tipo),
                x.total + " " + x.tipo)));
            caja.appendChild(tipos);
        }
        caja.appendChild(crear("p", "oc-resultado-desglose", r.desglose));
        return caja;
    }
    function mostrarResultado(cual, nombre) {
        if (!flotante) {
            montarFlotante();
        }
        clearTimeout(flotanteVa);
        clearTimeout(flotanteSale);
        const lista = Array.isArray(cual) ? cual : [cual];
        const pintar = () => {
            const filas = [];
            if (lista.length > 1 && nombre) {
                filas.push(crear("p", "oc-resultado-nombre", nombre));
            }
            lista.forEach((r) => filas.push(bloqueDeResultado(r, lista.length > 1)));
            const botones = crear("div", "oc-resultado-botones");
            botones.append(
                botonDe("oc-resultado-ver", "ver tiradas", () => {
                    cerrarResultado();
                    abrir(true, false);
                    const repetir = historial.querySelector(".oc-dados-repetir");
                    (repetir || ventana).focus();
                }, "Ver todas las tiradas (abre los dados)"),
                botonDe("oc-resultado-cerrar", "✕", cerrarResultado, "Cerrar el resultado"));
            filas.push(botones);
            flotante.replaceChildren(...filas);
            let arriba = 16;
            document.querySelectorAll(".mobile-topbar, .oc-menu-movil").forEach((x) => {
                if (getComputedStyle(x).position === "fixed") {
                    arriba = Math.max(arriba, x.getBoundingClientRect().bottom + 12);
                }
            });
            flotante.style.top = arriba + "px";
            flotante.hidden = false;
            flotanteVa = setTimeout(cerrarResultado, lista.length > 1 ? 7000 : 5000);
        };
        flotanteSale = setTimeout(pintar, estado.tresD ? 1000 : 0);
    }
    function filaDeTirada(r, i, alQuitar) {
        const li = crear("li", "oc-dados-tirada" + (r.critico ? " es-critico" : "") + (r.pifia ? " es-pifia" : ""));
        li.dataset.id = r.id;
        const cabeza = crear("p", "oc-dados-que");
        cabeza.append(crear("span", "oc-dados-que-nombre", r.que),
            crear("span", "oc-dados-formula", r.formulaVista || formulaParaVer(r.formula)));
        const total = crear("p", "oc-dados-total", String(r.total));
        if (r.unidad) {
            total.appendChild(crear("span", "oc-dados-unidad", r.unidad));
        }
        if (r.nota) {
            total.appendChild(crear("span", "oc-dados-natural", r.nota));
        }
        const tipos = crear("p", "oc-dados-tipos");
        (r.tipos || []).forEach((x) => {
            tipos.appendChild(crear("span", "oc-dano oc-dano-" + claveDeTipo(x.tipo), x.total + " " + x.tipo));
        });
        const botones = crear("div", "oc-dados-tirada-botones");
        if (r.d20 && r.d20.modo === "normal") {
            botones.append(
                botonDe("oc-dados-ventaja", "▲ ventaja", () => cambiarModo(r, "ventaja"),
                    "Añadir ventaja a: " + r.que + ", " + r.total),
                botonDe("oc-dados-ventaja", "▼ desventaja", () => cambiarModo(r, "desventaja"),
                    "Añadir desventaja a: " + r.que + ", " + r.total));
        }
        botones.append(
            botonDe("oc-dados-guardar", "☆", () => apuntarGuardada(r.que, [{ formula: r.formula, que: r.que }]),
                "Guardar esta tirada: " + r.que),
            botonDe("oc-dados-repetir", "↻ repetir", () => tirar(r.formula, r.que), "Repetir: " + r.que),
            botonDe("oc-dados-quitar", "✕", () => alQuitar(r.id, i), "Borrar esta tirada: " + r.que + ", " + r.total));
        li.append(cabeza, total);
        if (tipos.childNodes.length) {
            li.appendChild(tipos);
        }
        li.append(crear("p", "oc-dados-desglose", r.desglose), botones);
        return li;
    }
    function pintarHistorial() {
        historial.replaceChildren(...estado.tiradas.map((r, i) => filaDeTirada(r, i, quitar)));
        borrarTodo.disabled = !estado.tiradas.length;
        document.dispatchEvent(new CustomEvent("oc-dados:registro"));
    }
    function quitar(id, i) {
        estado.tiradas = estado.tiradas.filter((r) => r.id !== id);
        pintarHistorial();
        avisar("Tirada borrada.");
        const quedan = historial.querySelectorAll(".oc-dados-quitar");
        (quedan[Math.min(i, quedan.length - 1)] || tirarBoton).focus();
    }
    montar();
    if (estado.tresD && window.ocDados3d) {
        (window.requestIdleCallback || setTimeout)(() => window.ocDados3d.preparar());
    }
    if (sitioDelBoton) {
        boton = crear("button", "oc-boton oc-boton-dados");
        boton.type = "button";
        boton.title = "Lanzador de dados";
        boton.append(silueta(20), crear("span", "visually-hidden", "dados"));
        boton.setAttribute("aria-controls", "oc-dados");
        boton.setAttribute("aria-expanded", "false");
        boton.addEventListener("click", () => abrir(ventana.hidden, false));
        const movil = window.matchMedia ? window.matchMedia("(max-width: 860px)") : { matches: false };
        const colocar = () => {
            boton.classList.toggle("es-flotante", movil.matches);
            (movil.matches ? document.body : sitioDelBoton).appendChild(boton);
        };
        colocar();
        if (movil.addEventListener) {
            movil.addEventListener("change", colocar);
        }
    }
    marcas.forEach((m) => {
        const b = crear("button", "oc-dado");
        b.type = "button";
        b.dataset.dados = m.dataset.dados;
        b.dataset.que = m.dataset.que || "";
        if (m.dataset.reserva) {
            b.dataset.reserva = m.dataset.reserva;
            b.dataset.valor = m.dataset.valor || "0";
        }
        b.innerHTML = m.innerHTML;
        if (m.dataset.reserva && SISTEMA === "vtm5") {
            b.setAttribute("aria-label", m.dataset.que + ", " + m.dataset.valor + ": a la reserva de dados");
            b.title = "A la reserva de los dados";
        } else {
            b.setAttribute("aria-label", m.textContent.trim() + ", tirar " + (m.dataset.que || m.dataset.dados)
                + " (" + formulaParaVer(m.dataset.dados).replace(/−/g, "menos") + ")");
            b.title = "Tirar " + formulaParaVer(m.dataset.dados);
        }
        m.replaceWith(b);
    });
    document.querySelectorAll("table.oc-ataques").forEach((tabla) => {
        const filas = Array.from(tabla.querySelectorAll("tbody tr:not(.oc-ataque-desc)"));
        const conLasDos = filas.filter((tr) => tr.querySelector(".oc-ataque-mod .oc-dado") && tr.querySelector(".oc-ataque-dano .oc-dado"));
        if (!conLasDos.length) {
            return;
        }
        const th = crear("th", "", "a la vez");
        th.scope = "col";
        tabla.querySelector("thead tr").appendChild(th);
        tabla.querySelectorAll("tr.oc-ataque-desc td[colspan]").forEach((td) => {
            td.colSpan = td.colSpan + 1;
        });
        filas.forEach((tr) => {
            const td = crear("td", "oc-ataque-ambas");
            if (conLasDos.includes(tr)) {
                const ataque = tr.querySelector(".oc-ataque-mod .oc-dado");
                const dano = tr.querySelector(".oc-ataque-dano .oc-dado");
                const nombre = tr.querySelector("th").textContent.replace(/^[▸▾\s]+/, "").trim();
                const b = botonDe("oc-ataque-ambas-boton", "🎲🎲", () => tirarVarias([
                    { formula: ataque.dataset.dados, que: ataque.dataset.que },
                    { formula: dano.dataset.dados, que: dano.dataset.que }], nombre),
                "Tirar ataque y daño a la vez: " + nombre);
                b.title = "Ataque y daño a la vez";
                td.appendChild(b);
            }
            tr.appendChild(td);
        });
    });
    window.ocDados = {
        tirar,
        tirarVarias,
        registro(alQuitar) {
            return estado.tiradas.map((r, i) => filaDeTirada(r, i, (id) => {
                estado.tiradas = estado.tiradas.filter((x) => x.id !== id);
                pintarHistorial();
                avisar("Tirada borrada.");
                if (alQuitar) {
                    alQuitar(i);
                }
            }));
        },
        borrarRegistro() {
            estado.tiradas = [];
            pintarHistorial();
            avisar("Tiradas borradas.");
        },
        reiniciarHambre() {
            estado.reserva.hambre = parseInt((sitioDelBoton && sitioDelBoton.dataset.ocHambre) || "0", 10) || 0;
            if (window.ocPartida) {
                window.ocPartida.guardar("hambre", undefined);
            }
            pintarReserva();
        },
    };
    document.addEventListener("click", (e) => {
        const b = e.target.closest("button.oc-dado");
        if (!b) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        if (b.dataset.reserva && SISTEMA === "vtm5") {
            ponerEnReserva(b);
            return;
        }
        tirar(b.dataset.dados, b.dataset.que);
    });
})();
(function () {
    const grupos = Array.from(document.querySelectorAll("[data-oc-casillas]"));
    if (!grupos.length) {
        return;
    }
    const ESTADOS = ["libre", "superficial", "agravado"];
    let aviso = null;
    const avisar = (texto) => {
        if (!aviso) {
            aviso = document.createElement("p");
            aviso.className = "visually-hidden";
            aviso.setAttribute("role", "status");
            document.body.appendChild(aviso);
        }
        aviso.textContent = "";
        setTimeout(() => {
            aviso.textContent = texto;
        }, 50);
    };
    const partida = window.ocPartida;
    const guardadas = (partida && partida.leer("casillas", {})) || {};
    const todos = [];
    function guardar() {
        if (!partida) {
            return;
        }
        const salida = {};
        todos.forEach((g) => {
            salida[g.clave] = g.botones.map((b) => g.leer(b));
        });
        partida.guardar("casillas", salida);
    }
    grupos.forEach((grupo, n) => {
        const que = grupo.dataset.ocCasillas;
        const tres = grupo.dataset.ocEstados === "3";
        const sueltas = Array.from(grupo.querySelectorAll(".oc-casilla"));
        const clave = n + ":" + que;
        const antes = guardadas[clave];
        const g = { clave, recarga: grupo.dataset.ocRecarga || "", botones: [], inicio: [] };
        g.leer = (b) => (tres ? ESTADOS.indexOf(b.dataset.estado) : (b.getAttribute("aria-pressed") === "true" ? 1 : 0));
        sueltas.forEach((s, i) => {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "oc-casilla";
            const nombre = que + ": " + (i + 1) + " de " + sueltas.length;
            const deInicio = s.classList.contains("es-marcada") ? 1 : 0;
            const empieza = Array.isArray(antes) && antes.length === sueltas.length ? antes[i] : deInicio;
            if (tres) {
                const poner = (cual) => {
                    b.dataset.estado = ESTADOS[cual] || "libre";
                    b.setAttribute("aria-label", nombre + ", " + b.dataset.estado);
                };
                b.poner = poner;
                poner(empieza);
                b.addEventListener("click", () => {
                    poner((ESTADOS.indexOf(b.dataset.estado) + 1) % 3);
                    avisar(b.getAttribute("aria-label"));
                    guardar();
                });
            } else {
                b.poner = (cual) => b.setAttribute("aria-pressed", cual ? "true" : "false");
                b.poner(empieza);
                b.setAttribute("aria-label", nombre + ", gastado");
                b.addEventListener("click", () => {
                    b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") === "true" ? "false" : "true");
                    guardar();
                });
            }
            g.botones.push(b);
            g.inicio.push(deInicio);
            s.replaceWith(b);
        });
        todos.push(g);
    });
    window.ocCasillas = {
        descansar(tipo) {
            let cuantos = 0;
            todos.forEach((g) => {
                const vale = tipo === "todo" || (tipo === "largo" && g.recarga) || (tipo === "corto" && g.recarga === "corto");
                if (vale) {
                    g.botones.forEach((b, i) => b.poner(tipo === "todo" ? g.inicio[i] : 0));
                    cuantos++;
                }
            });
            guardar();
            return cuantos;
        },
    };
})();
(function () {
    const conVentana = document.querySelectorAll("details[data-oc-modal]");
    if (!conVentana.length) {
        return;
    }
    const fondo = document.createElement("div");
    fondo.className = "oc-modal-fondo";
    fondo.hidden = true;
    const ventana = document.createElement("div");
    ventana.className = "oc-modal";
    ventana.setAttribute("role", "dialog");
    ventana.setAttribute("aria-modal", "true");
    const cerrar = document.createElement("button");
    cerrar.type = "button";
    cerrar.className = "oc-modal-cerrar";
    cerrar.setAttribute("aria-label", "Cerrar");
    cerrar.textContent = "✕";
    const cuerpo = document.createElement("div");
    cuerpo.className = "oc-modal-cuerpo";
    ventana.append(cerrar, cuerpo);
    fondo.appendChild(ventana);
    document.body.appendChild(fondo);
    let vuelta = null;
    function abrir(detalles) {
        const carta = detalles.querySelector(".oc-carta");
        if (!carta) {
            return;
        }
        const copia = carta.cloneNode(true);
        copia.querySelectorAll("[id]").forEach((x) => x.removeAttribute("id"));
        const titulo = copia.querySelector(".oc-carta-titulo");
        if (titulo) {
            titulo.id = "oc-modal-titulo";
            ventana.setAttribute("aria-labelledby", "oc-modal-titulo");
        }
        ventana.classList.toggle("es-objeto", detalles.dataset.ocModal === "objeto");
        cuerpo.replaceChildren(copia);
        vuelta = detalles.querySelector("summary");
        fondo.hidden = false;
        cuerpo.scrollTop = 0;
        cerrar.focus();
    }
    function cerrarla() {
        if (fondo.hidden) {
            return;
        }
        fondo.hidden = true;
        cuerpo.replaceChildren();
        if (vuelta) {
            vuelta.focus();
        }
    }
    conVentana.forEach((d) => {
        const s = d.querySelector("summary");
        s.setAttribute("aria-haspopup", "dialog");
        s.addEventListener("click", (e) => {
            e.preventDefault();
            abrir(d);
        });
    });
    cerrar.addEventListener("click", cerrarla);
    fondo.addEventListener("click", (e) => {
        if (e.target === fondo) {
            cerrarla();
        }
    });
    ventana.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            e.stopPropagation();
            cerrarla();
            return;
        }
        if (e.key !== "Tab") {
            return;
        }
        const enfocables = Array.from(ventana.querySelectorAll("button, a[href], [tabindex]:not([tabindex='-1'])"))
            .filter((x) => !x.disabled && x.offsetParent !== null);
        if (!enfocables.length) {
            return;
        }
        const primero = enfocables[0];
        const ultimo = enfocables[enfocables.length - 1];
        if (e.shiftKey && document.activeElement === primero) {
            e.preventDefault();
            ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
            e.preventDefault();
            primero.focus();
        }
    });
})();
(function () {
    const sitio = document.querySelector("[data-oc-botones-pdf]");
    if (!sitio || sitio.querySelector(".oc-boton-pdf")) {
        return;
    }
    const b = document.createElement("button");
    b.type = "button";
    b.className = "oc-boton oc-boton-pdf";
    const icono = document.createElement("span");
    icono.className = "oc-boton-icono";
    icono.setAttribute("aria-hidden", "true");
    icono.textContent = "📄";
    b.append(icono, document.createTextNode(" ficha en pdf"));
    b.title = "Abre imprimir: elige «Guardar como PDF»";
    b.addEventListener("click", () => window.print());
    sitio.appendChild(b);
})();
(function () {
    document.querySelectorAll("[data-oc-spotify]").forEach((cancion) => {
        const [tipo, id] = cancion.dataset.ocSpotify.split("/");
        if (!/^[a-z]+$/.test(tipo || "") || !/^[A-Za-z0-9]+$/.test(id || "")) {
            return;
        }
        const titulo = cancion.dataset.ocTitulo || "Spotify";
        const sitio = cancion.querySelector(".oc-cancion-botones");
        const b = document.createElement("button");
        b.type = "button";
        b.className = "oc-cancion-escuchar";
        b.textContent = "▶ escuchar aquí";
        b.setAttribute("aria-label", "Escuchar aquí: " + titulo + " (carga el reproductor de Spotify)");
        b.addEventListener("click", () => {
            const marco = document.createElement("iframe");
            marco.className = "oc-cancion-reproductor";
            marco.src = "https://open.spotify.com/embed/" + encodeURIComponent(tipo) + "/" + encodeURIComponent(id);
            marco.title = "Reproductor de Spotify: " + titulo;
            marco.height = tipo === "track" || tipo === "episode" ? "152" : "352";
            marco.loading = "lazy";
            marco.setAttribute("allow", "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture");
            cancion.querySelector(".oc-cancion-texto").appendChild(marco);
            b.remove();
            marco.focus();
        });
        sitio.prepend(b);
    });
})();
(function () {
    const botones = document.querySelector("[data-oc-botones]");
    const maximo = botones ? parseInt(botones.dataset.ocPg || "", 10) : NaN;
    const vital = Array.from(document.querySelectorAll(".oc-vital"))
        .find((v) => /puntos de golpe/i.test(v.querySelector("dt") ? v.querySelector("dt").textContent : ""));
    if (!vital || !maximo || !window.ocPartida) {
        return;
    }
    const partida = window.ocPartida;
    const vida = Object.assign({ actual: maximo, temp: 0, exitos: 0, fallos: 0 }, partida.leer("vida", {}));
    const dd = vital.querySelector("dd");
    vital.classList.add("es-vida");
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "oc-vida-boton";
    boton.setAttribute("aria-haspopup", "dialog");
    dd.replaceChildren(boton);
    function crear(tag, clase, texto) {
        const x = document.createElement(tag);
        if (clase) {
            x.className = clase;
        }
        if (texto !== undefined) {
            x.textContent = texto;
        }
        return x;
    }
    function guardar() {
        partida.guardar("vida", vida);
        pintarBoton();
        if (pintarVentana) {
            pintarVentana();
        }
    }
    function pintarBoton() {
        boton.replaceChildren(document.createTextNode(String(vida.actual)),
            crear("span", "oc-vida-max", "/" + maximo), crear("span", "oc-vital-corto", "PG"));
        if (vida.temp) {
            boton.appendChild(crear("span", "oc-vida-temp", "+" + vida.temp));
        }
        boton.classList.toggle("es-caido", vida.actual <= 0);
        boton.setAttribute("aria-label", "Puntos de golpe: " + vida.actual + " de " + maximo
            + (vida.temp ? ", y " + vida.temp + " temporales" : "") + ". Abrir la vida");
    }
    let pintarVentana = null;
    let aviso = null;
    function avisar(texto) {
        if (!aviso) {
            return;
        }
        aviso.textContent = "";
        setTimeout(() => {
            aviso.textContent = texto;
        }, 50);
    }
    function cambiar(tipo, n) {
        if (!(n > 0)) {
            avisar("Pon cuánto.");
            return;
        }
        if (tipo === "dano") {
            const deTemp = Math.min(vida.temp, n);
            vida.temp -= deTemp;
            const antes = vida.actual;
            vida.actual = Math.max(0, vida.actual - (n - deTemp));
            if (antes === 0 && n - deTemp > 0) {
                vida.fallos = Math.min(3, vida.fallos + 1);
            }
            avisar(n + " de daño" + (deTemp ? " (" + deTemp + " de los temporales)" : "") + ". Quedan "
                + vida.actual + (vida.actual === 0 ? ": a 0, tiradas de muerte." : "."));
        } else if (tipo === "curar") {
            const desde0 = vida.actual === 0;
            vida.actual = Math.min(maximo, vida.actual + n);
            if (desde0) {
                vida.exitos = 0;
                vida.fallos = 0;
            }
            avisar("Curados " + n + ". Tiene " + vida.actual + " de " + maximo + ".");
        } else {
            vida.temp = Math.max(vida.temp, n);
            avisar("Temporales: " + vida.temp + ".");
        }
        guardar();
    }
    function tirarMuerte() {
        if (!window.ocDados) {
            return;
        }
        const r = window.ocDados.tirar("1d20", "salvación de muerte");
        const d = r && r.d20 ? r.d20.queda : r ? r.total : 0;
        if (d === 20) {
            vida.actual = 1;
            vida.exitos = 0;
            vida.fallos = 0;
            avisar("¡20 natural! Recupera 1 PG.");
        } else if (d === 1) {
            vida.fallos = Math.min(3, vida.fallos + 2);
            avisar("1 natural: dos fallos.");
        } else if (d >= 10) {
            vida.exitos = Math.min(3, vida.exitos + 1);
            avisar(d + ": éxito." + (vida.exitos === 3 ? " Estable." : ""));
        } else {
            vida.fallos = Math.min(3, vida.fallos + 1);
            avisar(d + ": fallo." + (vida.fallos === 3 ? " Muere." : ""));
        }
        guardar();
    }
    function descansar(tipo) {
        const cuantas = window.ocCasillas ? window.ocCasillas.descansar(tipo) : 0;
        if (tipo === "largo") {
            vida.actual = maximo;
            vida.temp = 0;
            vida.exitos = 0;
            vida.fallos = 0;
            partida.guardar("dadosGolpe", {});
        }
        guardar();
        avisar(tipo === "largo" ? "Descanso largo: PG al máximo y todo recargado."
            : "Descanso corto: " + (cuantas ? "recargado lo que se recarga con él." : "nada que recargar.")
            + " Los dados de golpe, en la ficha.");
    }
    function marcas(que, campo) {
        const fila = crear("div", "oc-vida-muerte-fila");
        const nombre = crear("span", "oc-vida-muerte-nombre", que);
        fila.appendChild(nombre);
        for (let i = 1; i <= 3; i++) {
            const b = crear("button", "oc-casilla");
            b.type = "button";
            b.setAttribute("aria-pressed", vida[campo] >= i ? "true" : "false");
            b.setAttribute("aria-label", que + ": " + i + " de 3");
            b.addEventListener("click", () => {
                vida[campo] = vida[campo] >= i ? i - 1 : i;
                guardar();
                fila.querySelectorAll(".oc-casilla")[i - 1].focus();
            });
            fila.appendChild(b);
        }
        return fila;
    }
    function abrirVentana() {
        const cuerpo = crear("div", "oc-vida");
        const grande = crear("p", "oc-vida-grande");
        const cantidad = crear("input", "oc-dados-mod oc-vida-cantidad");
        cantidad.type = "number";
        cantidad.min = "0";
        cantidad.id = "oc-vida-cantidad";
        cantidad.inputMode = "numeric";
        const etiqueta = crear("label", "oc-dados-etiqueta", "cuánto");
        etiqueta.htmlFor = cantidad.id;
        const fila = crear("div", "oc-vida-fila");
        const acciones = crear("div", "oc-vida-acciones");
        [["dano", "💥 daño"], ["curar", "💚 curar"], ["temp", "🛡️ temporales"]].forEach(([tipo, texto]) => {
            const b = crear("button", "oc-vida-accion es-" + tipo, texto);
            b.type = "button";
            b.addEventListener("click", () => {
                cambiar(tipo, parseInt(cantidad.value || "0", 10));
                cantidad.value = "";
                cantidad.focus();
            });
            acciones.appendChild(b);
        });
        fila.append(etiqueta, cantidad);
        const muerte = crear("fieldset", "oc-vida-muerte");
        muerte.appendChild(crear("legend", "", "salvaciones de muerte"));
        const dentroMuerte = crear("div", "");
        const tirarla = crear("button", "oc-vida-accion", "🎲 tirar salvación");
        tirarla.type = "button";
        tirarla.addEventListener("click", tirarMuerte);
        muerte.append(dentroMuerte, tirarla);
        const descansos = crear("div", "oc-vida-descansos");
        [["corto", "☕ descanso corto"], ["largo", "🛏️ descanso largo"]].forEach(([tipo, texto]) => {
            const b = crear("button", "oc-vida-accion", texto);
            b.type = "button";
            b.addEventListener("click", () => descansar(tipo));
            descansos.appendChild(b);
        });
        aviso = crear("p", "oc-vida-aviso");
        aviso.setAttribute("role", "status");
        cuerpo.append(grande, fila, acciones, muerte, descansos, aviso);
        pintarVentana = () => {
            grande.replaceChildren(crear("span", "oc-vida-actual", String(vida.actual)),
                document.createTextNode(" / " + maximo + " PG"));
            if (vida.temp) {
                grande.appendChild(crear("span", "oc-vida-temp", "+" + vida.temp + " temporales"));
            }
            const foco = document.activeElement;
            const enMuerte = dentroMuerte.contains(foco);
            dentroMuerte.replaceChildren(marcas("éxitos", "exitos"), marcas("fallos", "fallos"));
            if (enMuerte) {
                tirarla.focus();
            }
        };
        pintarVentana();
        window.ocVentana.abrir({ titulo: "vida", cuerpo, vuelta: boton, foco: cantidad, clase: "es-vida",
            alCerrar: () => {
                pintarVentana = null;
                aviso = null;
            } });
    }
    boton.addEventListener("click", abrirVentana);
    pintarBoton();
    const dg = (botones.dataset.ocDg || "").split(" ").map((x) => /^(\d+)d(\d+)$/.exec(x)).filter(Boolean)
        .map((m) => ({ cuantos: parseInt(m[1], 10), caras: parseInt(m[2], 10) }));
    const con = parseInt(botones.dataset.ocCon || "0", 10) || 0;
    const huecoDescanso = document.createElement("div");
    huecoDescanso.className = "oc-vital es-descanso";
    const dtDescanso = crear("dt", "visually-hidden", "Descansos");
    const ddDescanso = document.createElement("dd");
    const botonDescanso = crear("button", "oc-descanso-boton");
    botonDescanso.type = "button";
    botonDescanso.setAttribute("aria-haspopup", "dialog");
    const iconoDescanso = crear("span", "oc-vital-emoji", "🛏️");
    iconoDescanso.setAttribute("aria-hidden", "true");
    botonDescanso.append(iconoDescanso, document.createTextNode("descansar"));
    ddDescanso.appendChild(botonDescanso);
    huecoDescanso.append(dtDescanso, ddDescanso);
    vital.parentNode.appendChild(huecoDescanso);
    function abrirDescansos() {
        const cuerpo = crear("div", "oc-vida");
        const vidaAhora = crear("p", "oc-vida-grande");
        const pintarVida = () => {
            vidaAhora.replaceChildren(crear("span", "oc-vida-actual", String(vida.actual)),
                document.createTextNode(" / " + maximo + " PG"));
        };
        pintarVida();
        const corto = crear("fieldset", "oc-vida-muerte");
        corto.appendChild(crear("legend", "", "☕ descanso corto (1 hora)"));
        const usados = partida.leer("dadosGolpe", {});
        dg.forEach((g) => {
            const fila = crear("div", "oc-vida-fila es-dados-golpe");
            const quedan = () => g.cuantos - (usados["d" + g.caras] || 0);
            const texto = crear("span", "oc-vida-muerte-nombre");
            const gastar = crear("button", "oc-vida-accion");
            gastar.type = "button";
            const pintarDg = () => {
                texto.textContent = "d" + g.caras + ": " + quedan() + " de " + g.cuantos;
                gastar.textContent = "🎲 gastar un d" + g.caras + (con ? (con > 0 ? " + " : " − ") + Math.abs(con) : "");
                gastar.disabled = quedan() <= 0;
            };
            gastar.addEventListener("click", () => {
                if (quedan() <= 0 || !window.ocDados) {
                    return;
                }
                const r = window.ocDados.tirar("1d" + g.caras + (con ? (con > 0 ? "+" : "") + con : ""), "dado de golpe");
                const cura = Math.max(0, r ? r.total : 0);
                usados["d" + g.caras] = (usados["d" + g.caras] || 0) + 1;
                partida.guardar("dadosGolpe", usados);
                vida.actual = Math.min(maximo, vida.actual + cura);
                guardar();
                pintarDg();
                pintarVida();
                avisarDescanso("Cura " + cura + ". Tiene " + vida.actual + " de " + maximo + ".");
                if (gastar.disabled) {
                    terminarCorto.focus();
                }
            });
            pintarDg();
            fila.append(texto, gastar);
            corto.appendChild(fila);
        });
        if (!dg.length) {
            corto.appendChild(crear("p", "oc-hoja-nota", "Sin dados de golpe apuntados en su ficha."));
        }
        const terminarCorto = crear("button", "oc-vida-accion es-principal", "terminar el descanso corto");
        terminarCorto.type = "button";
        terminarCorto.addEventListener("click", () => {
            descansar("corto");
            avisarDescanso("Descanso corto: recargado lo que se recarga con él.");
        });
        corto.appendChild(terminarCorto);
        const largo = crear("fieldset", "oc-vida-muerte");
        largo.appendChild(crear("legend", "", "🛏️ descanso largo (8 horas)"));
        largo.appendChild(crear("p", "oc-hoja-nota", "Todo recargado, la vida al máximo, sin temporales ni"
            + " salvaciones de muerte, y los dados de golpe de vuelta (en 2014, solo la mitad)."));
        const hacerLargo = crear("button", "oc-vida-accion es-principal", "hacer el descanso largo");
        hacerLargo.type = "button";
        hacerLargo.addEventListener("click", () => {
            descansar("largo");
            Object.keys(usados).forEach((k) => delete usados[k]);
            cerrarDescansos();
            avisarFuera("Descanso largo hecho: " + vida.actual + " PG.");
        });
        largo.appendChild(hacerLargo);
        const avisoDescanso = crear("p", "oc-vida-aviso");
        avisoDescanso.setAttribute("role", "status");
        const avisarDescanso = (x) => {
            avisoDescanso.textContent = "";
            setTimeout(() => {
                avisoDescanso.textContent = x;
            }, 50);
        };
        cuerpo.append(vidaAhora, corto, largo, avisoDescanso);
        const primero = corto.querySelector("button:not([disabled])") || terminarCorto;
        const cerrarDescansos = window.ocVentana.abrir({ titulo: "descansos", cuerpo, vuelta: botonDescanso,
            foco: primero, clase: "es-vida" });
    }
    const avisoFuera = crear("p", "visually-hidden");
    avisoFuera.setAttribute("role", "status");
    document.body.appendChild(avisoFuera);
    function avisarFuera(x) {
        avisoFuera.textContent = "";
        setTimeout(() => {
            avisoFuera.textContent = x;
        }, 50);
    }
    botonDescanso.addEventListener("click", abrirDescansos);
    window.ocVida = {
        descansar,
        reiniciar() {
            Object.assign(vida, { actual: maximo, temp: 0, exitos: 0, fallos: 0 });
            guardar();
        },
    };
})();
window.ocMontar.notas = function (sitio, opciones) {
    const soloNotas = !!(opciones && opciones.soloNotas);
    if (!window.ocPartida) {
        return;
    }
    const partida = window.ocPartida;
    const botones = document.querySelector("[data-oc-botones]");
    const nombre = (botones && botones.dataset.ocNombre) || "personaje";
    const caja = document.createElement("div");
    caja.className = "oc-hoja";
    const crear = (tag, clase, texto) => {
        const x = document.createElement(tag);
        if (clase) {
            x.className = clase;
        }
        if (texto !== undefined) {
            x.textContent = texto;
        }
        return x;
    };
    const ventanita = (titulo, emoji, dentro) => {
        const v = crear("div", "oc-hoja-caja es-ancha");
        const barra = crear("div", "recent-entries-header");
        const h = crear("h3", "oc-hoja-titulo");
        const em = crear("span", "oc-hoja-emoji", emoji);
        em.setAttribute("aria-hidden", "true");
        h.append(em, document.createTextNode(titulo));
        barra.appendChild(h);
        const d = crear("div", "oc-hoja-dentro");
        d.append(...dentro);
        v.append(barra, d);
        return v;
    };
    const aviso = crear("p", "oc-hoja-nota");
    aviso.setAttribute("role", "status");
    const avisar = (texto) => {
        aviso.textContent = "";
        setTimeout(() => {
            aviso.textContent = texto;
        }, 50);
    };
    const etiqueta = crear("label", "oc-notas-etiqueta", "Lo que pasa en la sesión (se guarda solo)");
    const texto = crear("textarea", "oc-notas-texto");
    texto.id = "oc-notas-texto";
    etiqueta.htmlFor = texto.id;
    texto.rows = 12;
    texto.value = partida.leer("notas", "");
    let espera = 0;
    texto.addEventListener("input", () => {
        clearTimeout(espera);
        espera = setTimeout(() => partida.guardar("notas", texto.value), 400);
    });
    const fecha = crear("button", "oc-vida-accion", "📅 poner la fecha");
    fecha.type = "button";
    fecha.addEventListener("click", () => {
        const hoy = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
        texto.value = (texto.value.trim() ? texto.value.replace(/\s*$/, "") + "\n\n" : "") + "## " + hoy + "\n";
        partida.guardar("notas", texto.value);
        texto.focus();
        texto.selectionStart = texto.selectionEnd = texto.value.length;
    });
    const bajar = crear("button", "oc-vida-accion", "💾 descargar");
    bajar.type = "button";
    bajar.addEventListener("click", () => {
        const a = document.createElement("a");
        const blobSegura = (contenido) => URL.createObjectURL(new Blob([contenido], { type: "text/plain;charset=utf-8" }));
        a.href = blobSegura(texto.value);
        a.download = "notas-" + (partida.clave || "personaje") + ".txt";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    const borrar = crear("button", "oc-vida-accion", "🗑️ borrar");
    borrar.type = "button";
    let seguro = false;
    borrar.addEventListener("click", () => {
        if (!seguro) {
            seguro = true;
            borrar.textContent = "🗑️ ¿seguro? pulsa otra vez";
            setTimeout(() => {
                seguro = false;
                borrar.textContent = "🗑️ borrar";
            }, 4000);
            return;
        }
        texto.value = "";
        partida.guardar("notas", "");
        seguro = false;
        borrar.textContent = "🗑️ borrar";
        avisar("Notas borradas.");
        texto.focus();
    });
    const filaNotas = crear("div", "oc-vida-descansos");
    filaNotas.append(fecha, bajar, borrar);
    const filaPartida = crear("div", "oc-vida-descansos");
    const esDnd = botones && botones.dataset.ocSistema === "dnd5e";
    const boton = (txt, alPulsar) => {
        const b = crear("button", "oc-vida-accion", txt);
        b.type = "button";
        b.addEventListener("click", alPulsar);
        filaPartida.appendChild(b);
        return b;
    };
    const descansar = (tipo) => {
        if (window.ocVida) {
            window.ocVida.descansar(tipo);
        } else if (window.ocCasillas) {
            window.ocCasillas.descansar(tipo);
        }
    };
    if (esDnd) {
        boton("☕ descanso corto", () => {
            descansar("corto");
            avisar("Descanso corto: recargado lo que se recarga con él.");
        });
        boton("🛏️ descanso largo", () => {
            descansar("largo");
            avisar("Descanso largo: todo recargado y la vida al máximo.");
        });
    }
    let deCero = false;
    const cero = boton("🔄 empezar de cero", () => {
        if (!deCero) {
            deCero = true;
            cero.textContent = "🔄 ¿seguro? pulsa otra vez";
            setTimeout(() => {
                deCero = false;
                cero.textContent = "🔄 empezar de cero";
            }, 4000);
            return;
        }
        deCero = false;
        cero.textContent = "🔄 empezar de cero";
        if (window.ocCasillas) {
            window.ocCasillas.descansar("todo");
        }
        if (window.ocVida) {
            window.ocVida.reiniciar();
        }
        if (window.ocDados && window.ocDados.reiniciarHambre) {
            window.ocDados.reiniciarHambre();
        }
        avisar("Partida de cero: todo desmarcado y la vida al máximo. Las notas se quedan.");
    });
    if (soloNotas) {
        etiqueta.textContent = "Notas del máster (se guardan solas)";
        caja.className = "oc-notas-sueltas";
        caja.append(etiqueta, texto, filaNotas, aviso);
    } else {
        caja.append(
            ventanita("notas-de-" + (partida.clave || "sesion") + ".txt", "📝", [etiqueta, texto, filaNotas]),
            ventanita("partida.dat", "🎲", [crear("p", "oc-hoja-nota", "Lo que marcas en la ficha de " + nombre
                + " (usos, espacios, la vida…) se guarda en este navegador."), filaPartida, aviso]));
    }
    sitio.replaceChildren(caja);
};
(function () {
    const sitio = document.querySelector("[data-oc-notas]");
    if (sitio) {
        window.ocMontar.notas(sitio);
    }
})();
window.ocMontar.iniciativa = function (sitio, opciones) {
    const suelta = !!(opciones && opciones.suelta);
    const CLAVE = "richi-oc-iniciativa";
    const COLORES = [["#3fae5a", "verde"], ["#3b7ddd", "azul"], ["#d23b3b", "rojo"], ["#8e5bd6", "morado"],
        ["#e88a2a", "naranja"], ["#e6c229", "amarillo"], ["#e05aa8", "rosa"], ["#8a8a99", "gris"]];
    const DE_TIPO = { personaje: "#3fae5a", npc: "#3b7ddd", monstruo: "#d23b3b" };
    const colorDe = (c) => (/^#[0-9a-f]{6}$/i.test(c.color || "") ? c.color : DE_TIPO[c.tipo] || COLORES[0][0]);
    const nombreDeColor = (hex) => (COLORES.find((x) => x[0] === hex) || [hex, "a medida"])[1];
    let datos = { lista: [], turno: -1, ronda: 1 };
    try {
        datos = Object.assign(datos, JSON.parse(localStorage.getItem(CLAVE) || "{}"));
    } catch (e) {
    }
    const guardar = () => {
        try {
            localStorage.setItem(CLAVE, JSON.stringify(datos));
        } catch (e) {
        }
        document.dispatchEvent(new CustomEvent("oc-iniciativa:guardada", { detail: { ronda: datos.ronda, modo: datos.modo } }));
    };
    const crear = (tag, clase, texto) => {
        const x = document.createElement(tag);
        if (clase) {
            x.className = clase;
        }
        if (texto !== undefined) {
            x.textContent = texto;
        }
        return x;
    };
    const botonDe = (clase, texto, alPulsar, etiqueta) => {
        const b = crear("button", clase, texto);
        b.type = "button";
        if (etiqueta) {
            b.setAttribute("aria-label", etiqueta);
        }
        b.addEventListener("click", alPulsar);
        return b;
    };
    const aviso = crear("p", "visually-hidden");
    aviso.setAttribute("role", "status");
    const avisar = (texto) => {
        aviso.textContent = "";
        setTimeout(() => {
            aviso.textContent = texto;
        }, 50);
    };
    const numeroDe = (v) => (v === "" || v === null || v === undefined || isNaN(parseInt(v, 10)) ? "" : parseInt(v, 10));
    const form = crear("form", "oc-ini-nuevo");
    const campo = (id, texto, tipo, extra) => {
        const caja = crear("div", "oc-ini-campo" + (extra ? " " + extra : ""));
        const l = crear("label", "oc-dados-etiqueta", texto);
        const i = crear("input", "oc-dados-texto");
        i.id = id;
        i.type = tipo;
        if (tipo === "number") {
            i.inputMode = "numeric";
        }
        l.htmlFor = id;
        caja.append(l, i);
        form.appendChild(caja);
        return i;
    };
    const nombre = campo("oc-ini-nombre", "nombre", "text", "es-nombre");
    nombre.autocomplete = "off";
    const ini = campo("oc-ini-ini", "ini", "number");
    const ca = campo("oc-ini-ca", "CA", "number");
    const pg = campo("oc-ini-pg", "PG", "number");
    const colores = crear("div", "oc-ini-colores");
    colores.setAttribute("role", "radiogroup");
    colores.setAttribute("aria-label", "Color");
    let elegido = COLORES[2][0];
    const muestras = [];
    const marcar = (hex) => {
        elegido = hex;
        muestras.forEach((b) => b.setAttribute("aria-checked", b.dataset.color === hex ? "true" : "false"));
        muestras.forEach((b) => {
            b.tabIndex = b.dataset.color === hex ? 0 : -1;
        });
    };
    COLORES.forEach(([hex, n]) => {
        const b = botonDe("oc-ini-color", "", () => marcar(hex), n);
        b.setAttribute("role", "radio");
        b.dataset.color = hex;
        b.style.backgroundColor = hex;
        b.addEventListener("keydown", (e) => {
            const i = muestras.indexOf(b);
            const a = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1 }[e.key];
            if (a !== undefined) {
                e.preventDefault();
                const otra = muestras[(a + muestras.length) % muestras.length];
                marcar(otra.dataset.color);
                otra.focus();
            }
        });
        muestras.push(b);
        colores.appendChild(b);
    });
    const aMedida = crear("input", "oc-ini-color-medida");
    aMedida.type = "color";
    aMedida.value = "#ffffff";
    aMedida.setAttribute("aria-label", "Otro color, a medida");
    aMedida.title = "Otro color";
    aMedida.addEventListener("input", () => {
        elegido = aMedida.value;
        muestras.forEach((b) => b.setAttribute("aria-checked", "false"));
    });
    colores.appendChild(aMedida);
    marcar(elegido);
    const anadir = crear("button", "oc-vida-accion es-principal", "＋ añadir");
    anadir.type = "submit";
    const pie = crear("div", "oc-ini-pie");
    pie.append(colores, anadir);
    form.appendChild(pie);
    form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (!nombre.value.trim()) {
            avisar("Ponle nombre.");
            nombre.focus();
            return;
        }
        meter({ nombre: nombre.value.trim(), color: elegido, ini: numeroDe(ini.value), ca: numeroDe(ca.value),
            pg: numeroDe(pg.value) });
        nombre.value = "";
        ini.value = "";
        ca.value = "";
        pg.value = "";
        nombre.focus();
    });
    const botones = document.querySelector("[data-oc-botones]");
    const yo = botones && botones.dataset.ocNombre;
    let anadirme = null;
    if (yo) {
        anadirme = botonDe("oc-vida-accion", "＋ " + yo + " (tirar su iniciativa)", () => {
            const bono = parseInt(botones.dataset.ocIni || "0", 10) || 0;
            const r = window.ocDados ? window.ocDados.tirar("1d20" + (bono ? (bono > 0 ? "+" : "") + bono : ""),
                "iniciativa de " + yo) : null;
            const vida = window.ocPartida && window.ocPartida.leer("vida");
            meter({ nombre: yo, color: COLORES[0][0], ini: r ? r.total : "", ca: numeroDe(botones.dataset.ocCa),
                pg: vida && vida.actual !== undefined ? vida.actual : numeroDe(botones.dataset.ocPg) });
        });
    }
    function meter(c) {
        c.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        datos.lista.push(c);
        guardar();
        pintar();
        avisar("Añadido: " + c.nombre + (c.ini !== "" ? ", iniciativa " + c.ini : "") + ".");
    }
    const MARCAS = [["concentración", "🧘"], ["bendecido", "✨"], ["maldito", "💀"], ["ventaja", "⬆️"], ["desventaja", "⬇️"],
        ["escondido", "🥷"], ["agarrado", "🤝"], ["apresado", "⛓️"], ["asustado", "😱"], ["aturdido", "💫"], ["cegado", "🙈"],
        ["derribado", "🛌"], ["ensordecido", "🙉"], ["envenenado", "🤢"], ["hechizado", "💘"], ["incapacitado", "🚫"],
        ["inconsciente", "😵"], ["invisible", "👻"], ["paralizado", "🧊"], ["petrificado", "🗿"], ["agotamiento", "🥵"]];
    const ICONO = {};
    MARCAS.forEach(([t, i]) => {
        ICONO[t] = i;
    });
    const QUE_ES = { "concentración": "Mantiene un conjuro de concentración: lo pierde si lanza otro, queda incapacitado"
            + " o falla la salvación de Constitución al recibir daño (CD 10 o la mitad del daño).",
        bendecido: "Bajo un efecto que ayuda (como Bendición: suma 1d4 a sus ataques y salvaciones).",
        maldito: "Bajo un efecto que estorba (como Perdición: resta 1d4 a sus ataques y salvaciones, o una maldición).",
        ventaja: "Tira dos d20 y se queda con el mayor.", desventaja: "Tira dos d20 y se queda con el menor.",
        escondido: "No se le ve ni se le oye: los ataques contra él tienen desventaja y los suyos, ventaja.",
        agarrado: "Velocidad 0; desventaja al atacar a cualquiera que no sea quien le agarra.",
        apresado: "Velocidad 0; desventaja en sus ataques y en las salvaciones de Destreza; los ataques contra él, con ventaja.",
        asustado: "Desventaja en pruebas y ataques mientras ve lo que le asusta; no puede acercarse a ello.",
        aturdido: "Incapacitado; falla las salvaciones de Fuerza y Destreza; los ataques contra él, con ventaja.",
        cegado: "No ve: falla lo que necesite la vista; sus ataques, con desventaja; los de los demás, con ventaja.",
        derribado: "Solo se arrastra; desventaja al atacar; ataques cuerpo a cuerpo contra él a 5 pies, con ventaja.",
        ensordecido: "No oye: falla lo que necesite el oído.",
        envenenado: "Desventaja en las tiradas de ataque y en las pruebas de característica.",
        hechizado: "No puede atacar a quien le hechiza; este tiene ventaja en sus pruebas sociales con él.",
        incapacitado: "No puede hacer acciones, acciones adicionales ni reacciones; pierde la concentración.",
        inconsciente: "Incapacitado y derribado; falla Fuerza y Destreza; golpes a 5 pies, críticos.",
        invisible: "No se le ve: sus ataques, con ventaja; los de los demás contra él, con desventaja.",
        paralizado: "Incapacitado, velocidad 0; falla Fuerza y Destreza; golpes a 5 pies, críticos.",
        petrificado: "Convertido en piedra: incapacitado, resistencia a todo el daño, no envejece.",
        agotamiento: "Cada nivel resta 2 a sus pruebas de d20 y 5 pies a su velocidad; con 6, muere." };
    const REGLA_DE = { "concentración": "Concentración", ventaja: "Ventaja y desventaja", desventaja: "Ventaja y desventaja",
        escondido: "Esconderse" };
    let reglasTexto = null;
    function leerReglas() {
        if (!reglasTexto) {
            reglasTexto = fetch("/datos/personajes/reglas-dnd.json").then((r) => r.json()).then((d) => {
                const porNombre = {};
                (d.reglas || []).forEach((x) => {
                    porNombre[x.nombre.toLowerCase()] = x.texto;
                });
                return porNombre;
            }).catch(() => ({}));
        }
        return reglasTexto;
    }
    function textoConFormato(texto) {
        const caja = crear("div", "oc-texto");
        String(texto || "").split(/\n{2,}/).forEach((bloque) => {
            const lineas = bloque.split("\n");
            const esLista = lineas.every((l) => /^- /.test(l));
            const pon = (dentro, t) => {
                t.split(/(\*\*[^*]+\*\*)/).forEach((trozo) => {
                    const m = /^\*\*([^*]+)\*\*$/.exec(trozo);
                    dentro.appendChild(m ? crear("strong", "", m[1]) : document.createTextNode(trozo));
                });
            };
            if (esLista) {
                const ul = crear("ul");
                lineas.forEach((l) => {
                    const li = crear("li");
                    pon(li, l.slice(2));
                    ul.appendChild(li);
                });
                caja.appendChild(ul);
            } else {
                const p = crear("p");
                pon(p, bloque.replace(/\n/g, " "));
                caja.appendChild(p);
            }
        });
        return caja;
    }
    const FORMAS = [["●", "círculo"], ["■", "cuadrado"], ["▲", "triángulo"], ["◆", "rombo"], ["★", "estrella"], ["♥", "corazón"]];
    const COLORES_MARCA = [["#ffe873", "amarillo"], ["#ffb870", "naranja"], ["#ff8f8f", "rojo"], ["#ffa6d5", "rosa"],
        ["#c9a2ff", "morado"], ["#8fb8ff", "azul"], ["#7fdcff", "celeste"], ["#8fe8a2", "verde"]];
    let propias = [];
    try {
        propias = JSON.parse(localStorage.getItem("richi-oc-marcas") || "[]");
    } catch (e) {
        propias = [];
    }
    const guardarPropias = () => {
        try {
            localStorage.setItem("richi-oc-marcas", JSON.stringify(propias));
        } catch (e) {
        }
    };
    const marcasDe = (c) => (Array.isArray(c.marcas) ? c.marcas : (c.marcas = []));
    const textoMarca = (mk) => mk.t + (mk.r ? " (" + mk.r + (mk.r === 1 ? " ronda" : " rondas") + ")" : "");
    function dibujoDe(mk) {
        const propia = propias.find((p) => p.t === mk.t);
        const forma = mk.f || (propia && propia.f);
        const color = mk.c || (propia && propia.c);
        if (!ICONO[mk.t] && !forma) {
            return null;
        }
        const d = crear("span", "oc-ini-marca-dibujo", ICONO[mk.t] || forma);
        d.setAttribute("aria-hidden", "true");
        if (!ICONO[mk.t] && color) {
            d.style.color = color;
        }
        return d;
    }
    function chapa(mk) {
        const li = crear("li", "oc-ini-marca");
        const d = dibujoDe(mk);
        if (d) {
            li.appendChild(d);
        }
        li.appendChild(document.createTextNode(textoMarca(mk)));
        return li;
    }
    const queEs = (mk) => {
        const propia = propias.find((p) => p.t === mk.t);
        return mk.d || (propia && propia.d) || QUE_ES[mk.t] || "";
    };
    function chapaCorta(mk, c) {
        const li = crear("li", "oc-ini-marca es-corta");
        const desc = queEs(mk);
        const b = botonDe("oc-ini-marca-boton", "", () => verMarca(mk, c, b),
            textoMarca(mk) + (desc ? ": " + desc : ""));
        b.title = textoMarca(mk) + (desc ? "\n" + desc : "");
        b.setAttribute("aria-haspopup", "dialog");
        b.appendChild(dibujoDe(mk) || crear("span", "oc-ini-marca-dibujo", "●"));
        if (mk.r) {
            const r = crear("span", "oc-ini-marca-rondas", String(mk.r));
            r.setAttribute("aria-hidden", "true");
            b.appendChild(r);
        }
        li.appendChild(b);
        return li;
    }
    function chapasDe(c) {
        const ul = crear("ul", "oc-ini-marcas");
        ul.setAttribute("aria-label", "Marcas de " + c.nombre);
        marcasDe(c).forEach((mk) => ul.appendChild(chapaCorta(mk, c)));
        ul.hidden = !marcasDe(c).length;
        return ul;
    }
    function verMarca(mk, c, vuelta) {
        const cuerpo = crear("div", "oc-regla-ventana oc-ini-marca-ventana");
        const grande = crear("p", "oc-regla-ventana-dibujo");
        grande.setAttribute("aria-hidden", "true");
        const d = dibujoDe(mk);
        if (d) {
            grande.appendChild(d);
        }
        cuerpo.appendChild(grande);
        cuerpo.appendChild(crear("p", "oc-hoja-nota", c.nombre + (mk.r ? " · le quedan " + mk.r + (mk.r === 1 ? " ronda" : " rondas")
            : " · sin límite de rondas")));
        const texto = crear("div", "oc-ini-marca-que");
        texto.appendChild(crear("p", "", queEs(mk) || "Una marca propia, sin descripción."));
        cuerpo.appendChild(texto);
        const regla = REGLA_DE[mk.t] || (ICONO[mk.t] ? mk.t : "");
        if (regla && !mk.d) {
            leerReglas().then((porNombre) => {
                const t = porNombre[regla.toLowerCase()];
                if (t) {
                    texto.replaceChildren(textoConFormato(t));
                }
            });
        }
        const quitarla = botonDe("oc-vida-accion", "✕ quitar la marca", () => {
            const i = marcasDe(c).indexOf(mk);
            if (i >= 0) {
                marcasDe(c).splice(i, 1);
            }
            guardar();
            cerrar();
            pintar();
            avisar("Quitada: " + mk.t + " de " + c.nombre + ".");
            const visible = Array.from(caja.querySelectorAll('.oc-ini-fila[data-id="' + CSS.escape(c.id) + '"] .es-marcas'))
                .find((x) => x.offsetParent);
            (visible || vuelta).focus();
        });
        cuerpo.appendChild(quitarla);
        const cerrar = window.ocVentana.abrir({ titulo: textoMarca(mk), cuerpo, vuelta, clase: "es-regla" });
    }
    function editarMarcas(c, vuelta) {
        const cuerpo = crear("div", "oc-ini-marcas-ventana");
        const actuales = crear("ul", "oc-ini-marcas-actuales");
        const rehacer = () => {
            actuales.replaceChildren(...marcasDe(c).map((mk, i) => {
                const li = chapa(mk);
                li.append(document.createTextNode(" "),
                    botonDe("oc-ini-marca-quitar", "✕", () => {
                        marcasDe(c).splice(i, 1);
                        guardar();
                        rehacer();
                        pintar();
                        avisar("Quitada: " + mk.t + ".");
                    }, "Quitar la marca " + mk.t));
                return li;
            }));
            if (!marcasDe(c).length) {
                actuales.appendChild(crear("li", "oc-vacio", "Sin marcas."));
            }
            hacerRapidas();
        };
        const buscar = crear("input", "oc-dados-texto");
        buscar.type = "search";
        buscar.id = "oc-ini-marca-buscar";
        buscar.placeholder = "envenenado, bendecido…";
        buscar.autocomplete = "off";
        const etBuscar = crear("label", "oc-dados-etiqueta", "buscar");
        etBuscar.htmlFor = buscar.id;
        const rapidasCaja = crear("div", "oc-ini-marcas-rapidas");
        let rapidas = [];
        function hacerRapidas() {
            const q = String(buscar.value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
            const todas = MARCAS.map(([t]) => ({ t })).concat(propias.map((p) => ({ t: p.t, c: p.c, f: p.f, propia: true })));
            rapidas = todas.filter((x) => !q || x.t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(q))
                .map((x) => {
                    const b = botonDe("oc-ini-marca-rapida", "", () => {
                        const i = marcasDe(c).findIndex((mk) => mk.t === x.t);
                        if (i >= 0) {
                            marcasDe(c).splice(i, 1);
                        } else {
                            marcasDe(c).push({ t: x.t, r: numeroDe(rondas.value) || null });
                        }
                        guardar();
                        rehacer();
                        pintar();
                        const otra = rapidasCaja.querySelector('[data-marca="' + CSS.escape(x.t) + '"]');
                        if (otra) {
                            otra.focus();
                        }
                    });
                    const d = dibujoDe(x);
                    if (d) {
                        b.appendChild(d);
                    }
                    b.appendChild(document.createTextNode(x.t));
                    b.dataset.marca = x.t;
                    b.setAttribute("aria-pressed", marcasDe(c).some((mk) => mk.t === x.t) ? "true" : "false");
                    return b;
                });
            rapidasCaja.replaceChildren(...rapidas);
            if (!rapidas.length) {
                rapidasCaja.appendChild(crear("p", "oc-vacio", "Ninguna con eso: créala abajo."));
            }
        }
        buscar.addEventListener("input", hacerRapidas);
        const form = crear("form", "oc-ini-marca-nueva");
        const etT = crear("label", "oc-dados-etiqueta", "otra marca");
        const texto = crear("input", "oc-dados-texto");
        texto.id = "oc-ini-marca-texto";
        texto.placeholder = "Escudo de fe, +2 CA, quemándose…";
        texto.autocomplete = "off";
        etT.htmlFor = texto.id;
        const etR = crear("label", "oc-dados-etiqueta", "rondas");
        const rondas = crear("input", "oc-dados-texto");
        rondas.id = "oc-ini-marca-rondas";
        rondas.type = "number";
        rondas.min = "1";
        rondas.inputMode = "numeric";
        etR.htmlFor = rondas.id;
        const etD = crear("label", "oc-dados-etiqueta es-desc", "qué hace (opcional)");
        const desc = crear("input", "oc-dados-texto es-desc");
        desc.id = "oc-ini-marca-desc";
        desc.placeholder = "+2 a la CA mientras rece…";
        desc.autocomplete = "off";
        etD.htmlFor = desc.id;
        const poner = crear("button", "oc-vida-accion es-principal", "＋ poner");
        poner.type = "submit";
        const aspecto = crear("fieldset", "oc-ini-marca-aspecto");
        aspecto.appendChild(crear("legend", "oc-dados-etiqueta", "color y forma (para una nueva)"));
        let color = COLORES_MARCA[2][0];
        let forma = FORMAS[0][0];
        const muestrasC = COLORES_MARCA.map(([hex, nombre]) => {
            const b = botonDe("oc-ini-color", "", () => {
                color = hex;
                muestrasC.forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
                muestrasF.forEach((x) => {
                    x.style.color = color;
                });
            }, nombre);
            b.style.backgroundColor = hex;
            b.setAttribute("aria-pressed", hex === color ? "true" : "false");
            return b;
        });
        const muestrasF = FORMAS.map(([sim, nombre]) => {
            const b = botonDe("oc-ini-forma", sim, () => {
                forma = sim;
                muestrasF.forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
            }, nombre);
            b.style.color = color;
            b.setAttribute("aria-pressed", sim === forma ? "true" : "false");
            return b;
        });
        const filaC = crear("div", "oc-ini-colores");
        filaC.append(...muestrasC);
        const filaF = crear("div", "oc-ini-colores");
        filaF.append(...muestrasF);
        const etGuardar = crear("label", "oc-ini-marca-guardar");
        const guardarla = crear("input");
        guardarla.type = "checkbox";
        guardarla.checked = true;
        etGuardar.append(guardarla, document.createTextNode(" guardarla para otra vez"));
        aspecto.append(filaC, filaF, etGuardar);
        form.append(etT, texto, etR, rondas, etD, desc, poner, aspecto);
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            const t = texto.value.trim();
            if (!t) {
                texto.focus();
                return;
            }
            const yaPropia = propias.find((p) => p.t === t);
            const d = desc.value.trim();
            if (!ICONO[t] && guardarla.checked && !yaPropia) {
                propias.push(d ? { t, c: color, f: forma, d } : { t, c: color, f: forma });
                guardarPropias();
            }
            const nueva = ICONO[t] || yaPropia || guardarla.checked ? { t, r: numeroDe(rondas.value) || null }
                : { t, r: numeroDe(rondas.value) || null, c: color, f: forma };
            if (d && (ICONO[t] || yaPropia || !guardarla.checked)) {
                nueva.d = d;
            }
            marcasDe(c).push(nueva);
            texto.value = "";
            desc.value = "";
            guardar();
            rehacer();
            pintar();
            avisar("Puesta: " + t + ".");
            texto.focus();
        });
        const buscarCaja = crear("div", "oc-ini-marca-buscador");
        buscarCaja.append(etBuscar, buscar);
        cuerpo.append(crear("p", "oc-hoja-nota", "Las rondas son opcionales y valen también para las de un toque."),
            buscarCaja, rapidasCaja, form, crear("h3", "oc-ini-marcas-titulo", "Lleva ahora"), actuales);
        rehacer();
        window.ocVentana.abrir({ titulo: "marcas de " + c.nombre, cuerpo, vuelta, foco: buscar });
    }
    function gastarRonda() {
        const acabadas = [];
        datos.lista.forEach((c) => {
            c.marcas = marcasDe(c).filter((mk) => {
                if (!mk.r) {
                    return true;
                }
                mk.r -= 1;
                if (mk.r <= 0) {
                    acabadas.push(mk.t + " en " + c.nombre);
                    return false;
                }
                return true;
            });
        });
        return acabadas;
    }
    const ronda = crear("p", "oc-ini-ronda");
    const lista = crear("ol", "oc-ini-lista");
    lista.setAttribute("aria-label", "Orden de los turnos");
    const pasar = (paso) => {
        if (!datos.lista.length) {
            return;
        }
        let acabadas = [];
        datos.turno += paso;
        if (datos.turno >= datos.lista.length) {
            datos.turno = 0;
            datos.ronda += 1;
            acabadas = gastarRonda();
        }
        if (datos.turno < 0) {
            if (datos.ronda > 1) {
                datos.turno = datos.lista.length - 1;
                datos.ronda -= 1;
            } else {
                datos.turno = 0;
            }
        }
        guardar();
        pintar();
        const c = datos.lista[datos.turno];
        avisar("Ronda " + datos.ronda + ": le toca a " + c.nombre + "."
            + (acabadas.length ? " Se acaba: " + acabadas.join(", ") + "." : ""));
    };
    const siguiente = botonDe("oc-vida-accion es-principal", "siguiente ▶", () => pasar(1));
    const anterior = botonDe("oc-vida-accion", "◀ anterior", () => pasar(-1));
    const empezar = botonDe("oc-vida-accion es-principal", "⚔️ empezar el combate", () => {
        if (!datos.lista.length) {
            avisar("Primero añade a alguien.");
            return;
        }
        datos.modo = "combate";
        datos.turno = 0;
        datos.ronda = 1;
        guardar();
        pintar();
        avisar("¡Combate! Ronda 1: le toca a " + datos.lista[0].nombre + ".");
        pestanas[1].focus();
    });
    const terminar = botonDe("oc-vida-accion", "🏁 terminar el combate", () => {
        datos.modo = "preparar";
        datos.turno = -1;
        datos.ronda = 1;
        guardar();
        pintar();
        avisar("Combate terminado.");
        pestanas[0].focus();
    });
    const ordenar = botonDe("oc-vida-accion", "⇅ por iniciativa", () => {
        const deAhora = datos.lista[datos.turno];
        datos.lista.sort((a, b) => (b.ini === "" ? -999 : b.ini) - (a.ini === "" ? -999 : a.ini));
        datos.turno = deAhora ? datos.lista.indexOf(deAhora) : -1;
        guardar();
        pintar();
        avisar("Ordenados por iniciativa.");
    });
    let seguro = false;
    const vaciar = botonDe("oc-vida-accion", "🗑️ vaciar", () => {
        if (!seguro) {
            seguro = true;
            vaciar.textContent = "🗑️ ¿seguro? pulsa otra vez";
            setTimeout(() => {
                seguro = false;
                vaciar.textContent = "🗑️ vaciar";
            }, 4000);
            return;
        }
        seguro = false;
        vaciar.textContent = "🗑️ vaciar";
        datos = { lista: [], turno: -1, ronda: 1 };
        guardar();
        pintar();
        avisar("Combate vacío.");
    });
    function mover(desde, hasta, foco) {
        if (hasta < 0 || hasta >= datos.lista.length || desde === hasta) {
            return;
        }
        const deAhora = datos.lista[datos.turno];
        const [c] = datos.lista.splice(desde, 1);
        datos.lista.splice(hasta, 0, c);
        datos.turno = deAhora ? datos.lista.indexOf(deAhora) : -1;
        guardar();
        pintar();
        avisar(c.nombre + ": puesto " + (hasta + 1) + " de " + datos.lista.length + ".");
        if (foco) {
            const b = lista.querySelectorAll(foco)[hasta];
            if (b) {
                b.focus();
            }
        }
    }
    function numeroEn(c, campoN, texto, i) {
        const caja = crear("label", "oc-ini-dato");
        caja.appendChild(crear("span", "oc-ini-dato-nombre", texto));
        const input = crear("input", "oc-ini-numero");
        input.type = "number";
        input.inputMode = "numeric";
        input.value = c[campoN] === "" || c[campoN] === undefined ? "" : String(c[campoN]);
        input.setAttribute("aria-label", texto + " de " + c.nombre);
        input.addEventListener("change", () => {
            c[campoN] = numeroDe(input.value);
            guardar();
        });
        caja.appendChild(input);
        return caja;
    }
    function pintar() {
        const enCombate = datos.modo === "combate" && datos.lista.length > 0;
        pestanas.forEach((b, i) => {
            const activa = (i === 1) === enCombate;
            b.setAttribute("aria-selected", activa ? "true" : "false");
            b.tabIndex = activa ? 0 : -1;
        });
        panelPreparar.hidden = enCombate;
        panelCombate.hidden = !enCombate;
        if (enCombate) {
            pintarCombate();
        }
        ronda.textContent = "";
        lista.replaceChildren(...datos.lista.map((c, i) => {
            const li = crear("li", "oc-ini-fila" + (i === datos.turno ? " es-su-turno" : ""));
            li.dataset.id = c.id;
            li.style.borderLeftColor = colorDe(c);
            if (i === datos.turno) {
                li.setAttribute("aria-current", "true");
            }
            const asa = crear("span", "oc-ini-asa", "⠿");
            asa.setAttribute("aria-hidden", "true");
            asa.title = "Arrástralo para cambiarlo de sitio";
            asa.addEventListener("pointerdown", (e) => empezarArrastre(e, li, i));
            const quien = crear("div", "oc-ini-quien");
            const n = crear("input", "oc-ini-nombre es-campo");
            n.value = c.nombre;
            n.maxLength = 60;
            n.autocomplete = "off";
            n.setAttribute("aria-label", "Nombre (" + nombreDeColor(colorDe(c)) + ")");
            n.addEventListener("change", () => {
                const nuevo = n.value.trim();
                if (!nuevo) {
                    n.value = c.nombre;
                    return;
                }
                c.nombre = nuevo;
                guardar();
                avisar("Ahora se llama " + nuevo + ".");
            });
            quien.append(n, chapasDe(c));
            if (i === datos.turno) {
                quien.prepend(crear("span", "oc-ini-le-toca", "▶ le toca"));
            }
            const datosC = crear("div", "oc-ini-datos");
            datosC.append(numeroEn(c, "ini", "ini", i), numeroEn(c, "ca", "CA", i), numeroEn(c, "pg", "PG", i));
            const mandos = crear("div", "oc-ini-mandos");
            const bMarcas = botonDe("oc-ini-mando es-marcas", "⭐", () => editarMarcas(c, bMarcas), "Marcas de " + c.nombre);
            bMarcas.setAttribute("aria-haspopup", "dialog");
            mandos.append(bMarcas,
                botonDe("oc-ini-mando es-subir", "↑", () => mover(i, i - 1, ".es-subir"), "Subir a " + c.nombre),
                botonDe("oc-ini-mando es-bajar", "↓", () => mover(i, i + 1, ".es-bajar"), "Bajar a " + c.nombre),
                botonDe("oc-ini-mando", "✕", () => {
                    const deAhora = datos.lista[datos.turno];
                    datos.lista.splice(i, 1);
                    datos.turno = deAhora && deAhora !== c ? datos.lista.indexOf(deAhora) : Math.min(datos.turno, datos.lista.length - 1);
                    guardar();
                    pintar();
                    avisar("Quitado: " + c.nombre + ".");
                    (lista.querySelectorAll(".oc-ini-mando")[Math.min(i, datos.lista.length - 1) * 4 + 3] || nombre).focus();
                }, "Quitar a " + c.nombre));
            li.append(asa, quien, datosC, mandos);
            return li;
        }));
        lista.hidden = !datos.lista.length;
        vacio.hidden = !!datos.lista.length;
        empezar.hidden = !datos.lista.length;
    }
    const rondaC = crear("p", "oc-ini-combate-ronda");
    const toca = crear("p", "oc-ini-combate-toca");
    toca.setAttribute("aria-live", "polite");
    const listaC = crear("ol", "oc-ini-lista es-combate");
    listaC.setAttribute("aria-label", "Orden de los turnos");
    function pintarCombate() {
        if (datos.turno < 0 || datos.turno >= datos.lista.length) {
            datos.turno = 0;
        }
        const ahora = datos.lista[datos.turno];
        rondaC.textContent = "Ronda " + datos.ronda;
        toca.replaceChildren(crear("span", "oc-ini-combate-le", "le toca a "), crear("strong", "", ahora.nombre), chapasDe(ahora));
        toca.style.borderLeftColor = colorDe(ahora);
        listaC.replaceChildren(...datos.lista.map((c, i) => {
            const li = crear("li", "oc-ini-fila es-combate" + (i === datos.turno ? " es-su-turno" : ""));
            li.dataset.id = c.id;
            li.style.borderLeftColor = colorDe(c);
            if (i === datos.turno) {
                li.setAttribute("aria-current", "true");
            }
            const quien = crear("div", "oc-ini-quien");
            const n = crear("span", "oc-ini-nombre", c.nombre);
            n.appendChild(crear("span", "visually-hidden", " (" + nombreDeColor(colorDe(c)) + ")"));
            quien.append(n, chapasDe(c));
            if (i === datos.turno) {
                quien.prepend(crear("span", "oc-ini-le-toca", "▶ le toca"));
            }
            const datosC = crear("div", "oc-ini-datos es-combate");
            datosC.appendChild(crear("span", "oc-ini-fijo", "ini " + (c.ini === "" || c.ini === undefined ? "—" : c.ini)
                + " · CA " + (c.ca === "" || c.ca === undefined ? "—" : c.ca)));
            const pgCaja = numeroEn(c, "pg", "PG", i);
            const pgIn = pgCaja.querySelector("input");
            const sumar = (d) => {
                c.pg = (numeroDe(c.pg) || 0) + d;
                pgIn.value = String(c.pg);
                guardar();
                avisar(c.nombre + ": " + c.pg + " PG.");
            };
            datosC.append(botonDe("oc-ini-mando", "−", () => sumar(-1), "Quitar 1 PG a " + c.nombre), pgCaja,
                botonDe("oc-ini-mando", "+", () => sumar(1), "Sumar 1 PG a " + c.nombre));
            const bMarcas = botonDe("oc-ini-mando es-marcas", "⭐", () => editarMarcas(c, bMarcas), "Marcas de " + c.nombre);
            bMarcas.setAttribute("aria-haspopup", "dialog");
            const mandos = crear("div", "oc-ini-mandos");
            mandos.appendChild(bMarcas);
            li.append(quien, datosC, mandos);
            return li;
        }));
    }
    function empezarArrastre(e, li, desde) {
        e.preventDefault();
        const filas = Array.from(lista.children);
        const alto = li.getBoundingClientRect().height;
        const inicioY = e.clientY;
        let hasta = desde;
        li.classList.add("es-arrastrado");
        const mientras = (ev) => {
            const dy = ev.clientY - inicioY;
            li.style.transform = "translateY(" + dy + "px)";
            hasta = Math.max(0, Math.min(filas.length - 1, desde + Math.round(dy / (alto + 8))));
            filas.forEach((f, j) => {
                let mueve = 0;
                if (j !== desde) {
                    if (desde < hasta && j > desde && j <= hasta) {
                        mueve = -(alto + 8);
                    } else if (desde > hasta && j < desde && j >= hasta) {
                        mueve = alto + 8;
                    }
                    f.style.transform = mueve ? "translateY(" + mueve + "px)" : "";
                }
            });
        };
        const fin = () => {
            document.removeEventListener("pointermove", mientras);
            document.removeEventListener("pointerup", fin);
            document.removeEventListener("pointercancel", fin);
            filas.forEach((f) => {
                f.style.transform = "";
            });
            li.classList.remove("es-arrastrado");
            mover(desde, hasta, null);
        };
        document.addEventListener("pointermove", mientras);
        document.addEventListener("pointerup", fin);
        document.addEventListener("pointercancel", fin);
    }
    const vacio = crear("p", "oc-vacio", "Todavía no hay nadie en el combate.");
    const caja = crear("div", suelta ? "oc-ini-suelta" : "oc-hoja");
    const ventanita = (titulo, emoji, dentro) => {
        if (suelta) {
            const v = crear("div", "oc-ini-bloque");
            v.append(...dentro);
            return v;
        }
        const v = crear("div", "oc-hoja-caja es-ancha");
        const barra = crear("div", "recent-entries-header");
        const h = crear("h3", "oc-hoja-titulo");
        const em = crear("span", "oc-hoja-emoji", emoji);
        em.setAttribute("aria-hidden", "true");
        h.append(em, document.createTextNode(titulo));
        barra.appendChild(h);
        const d = crear("div", "oc-hoja-dentro");
        d.append(...dentro);
        v.append(barra, d);
        return v;
    };
    const mandos = crear("div", "oc-vida-descansos");
    mandos.append(empezar, ordenar, vaciar);
    const leyenda = crear("p", "oc-hoja-nota", "Arrastra por el ⠿ (o usa ↑ y ↓) para cambiar el orden. Iniciativa, CA y"
        + " PG son opcionales; ⭐ pone marcas (estados, concentración, conjuros…).");
    const barraModos = crear("div", "oc-ini-modos");
    barraModos.setAttribute("role", "tablist");
    barraModos.setAttribute("aria-label", "Iniciativa");
    const pestanas = [["preparar", "🛠️ preparar"], ["combate", "⚔️ combate"]].map(([modo, texto], i) => {
        const b = botonDe("oc-ini-modo", texto, () => {
            if (modo === "combate" && datos.modo !== "combate") {
                empezar.click();
                return;
            }
            if (modo === "preparar") {
                datos.modo = "preparar";
                guardar();
                pintar();
            }
        });
        b.setAttribute("role", "tab");
        b.id = "oc-ini-pestana-" + modo + (suelta ? "-suelta" : "");
        b.addEventListener("keydown", (e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                pestanas[1 - i].focus();
            }
        });
        barraModos.appendChild(b);
        return b;
    });
    const panelPreparar = crear("div", "oc-ini-panel");
    const panelCombate = crear("div", "oc-ini-panel es-combate");
    [[panelPreparar, pestanas[0]], [panelCombate, pestanas[1]]].forEach(([p, b]) => {
        p.setAttribute("role", "tabpanel");
        p.id = b.id + "-panel";
        p.setAttribute("aria-labelledby", b.id);
        b.setAttribute("aria-controls", p.id);
    });
    const mandosC = crear("div", "oc-vida-descansos oc-ini-combate-mandos");
    mandosC.append(anterior, siguiente, terminar);
    panelPreparar.append(
        ventanita("combate.ini", "⏱️", [ronda, mandos, vacio, lista, leyenda]),
        ventanita("añadir.txt", "＋", anadirme ? [form, anadirme] : [form]));
    panelCombate.append(ventanita("¡combate!", "⚔️", [rondaC, toca, mandosC, listaC]));
    caja.append(barraModos, panelPreparar, panelCombate);
    sitio.replaceChildren(caja, aviso);
    pintar();
    document.addEventListener("oc-iniciativa:cambio", () => {
        try {
            datos = Object.assign({ lista: [], turno: -1, ronda: 1 }, JSON.parse(localStorage.getItem(CLAVE) || "{}"));
        } catch (e) {
            return;
        }
        pintar();
    });
};
(function () {
    const sitio = document.querySelector("[data-oc-iniciativa]");
    if (sitio) {
        window.ocMontar.iniciativa(sitio);
    }
})();
window.ocMontar.reglas = function (sitio, idBuscar) {
    const llano = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const reglas = Array.from(sitio.querySelectorAll(".oc-regla"));
    const grupos = Array.from(sitio.querySelectorAll(".oc-reglas-grupo"));
    reglas.forEach((r) => {
        const detalles = r.querySelector("details");
        const icono = r.querySelector(".oc-regla-icono");
        const nombre = r.querySelector(".oc-regla-nombre") || r.querySelector("summary");
        const texto = r.querySelector(".oc-texto");
        const b = document.createElement("button");
        b.type = "button";
        b.className = "oc-regla-boton";
        b.setAttribute("aria-haspopup", "dialog");
        const dibujo = document.createElement("span");
        dibujo.className = "oc-regla-dibujo";
        dibujo.setAttribute("aria-hidden", "true");
        dibujo.textContent = icono ? icono.textContent : "📖";
        const n = document.createElement("span");
        n.className = "oc-regla-texto";
        n.textContent = nombre.textContent.replace(/^▸\s*/, "");
        b.append(dibujo, n);
        b.addEventListener("click", () => {
            const cuerpo = document.createElement("div");
            cuerpo.className = "oc-regla-ventana";
            const grande = document.createElement("p");
            grande.className = "oc-regla-ventana-dibujo";
            grande.setAttribute("aria-hidden", "true");
            grande.textContent = dibujo.textContent;
            const copia = texto.cloneNode(true);
            copia.hidden = false;
            cuerpo.append(grande, copia);
            window.ocVentana.abrir({ titulo: n.textContent, cuerpo, vuelta: b, clase: "es-regla" });
        });
        texto.hidden = true;
        r.dataset.buscar = llano(n.textContent + " " + texto.textContent);
        detalles.replaceWith(b, texto);
    });
    const caja = document.createElement("div");
    caja.className = "oc-reglas-buscar";
    const etiqueta = document.createElement("label");
    etiqueta.className = "oc-dados-etiqueta";
    etiqueta.textContent = "buscar";
    const input = document.createElement("input");
    input.type = "search";
    input.id = idBuscar || "oc-reglas-buscar";
    input.className = "oc-dados-texto";
    input.placeholder = "concentración, derribado, cobertura…";
    etiqueta.htmlFor = input.id;
    const cuantas = document.createElement("p");
    cuantas.className = "oc-hoja-nota";
    cuantas.setAttribute("role", "status");
    caja.append(etiqueta, input, cuantas);
    sitio.prepend(caja);
    let espera = 0;
    input.addEventListener("input", () => {
        clearTimeout(espera);
        espera = setTimeout(() => {
            const q = llano(input.value.trim());
            let n = 0;
            reglas.forEach((r) => {
                const vale = !q || r.dataset.buscar.includes(q);
                r.hidden = !vale;
                if (vale) {
                    n++;
                }
            });
            grupos.forEach((g) => {
                g.hidden = !g.querySelector(".oc-regla:not([hidden])");
            });
            cuantas.textContent = q ? (n ? n + (n === 1 ? " regla" : " reglas") : "Ninguna regla con eso.") : "";
        }, 150);
    });
};
(function () {
    const sitio = document.querySelector("[data-oc-reglas]");
    if (sitio) {
        window.ocMontar.reglas(sitio);
    }
})();
(function () {
    const DADOS = /\b(\d+d\d+(?:\s*[+−-]\s*\d+)?)\b/g;
    const ATAQUE = /^(\s*)([+−-]\d+)\b/;
    function boton(texto, formula, que) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "oc-dado-texto";
        b.textContent = texto;
        b.dataset.formula = formula;
        if (que) {
            b.dataset.que = que;
        }
        b.setAttribute("aria-label", "Tirar " + texto + (que ? " (" + que + ")" : ""));
        return b;
    }
    const limpia = (f) => f.replace(/\s+/g, "").replace(/−/g, "-");
    function trocear(nodo) {
        const t = nodo.nodeValue;
        DADOS.lastIndex = 0;
        if (!DADOS.test(t)) {
            return;
        }
        DADOS.lastIndex = 0;
        const trozo = document.createDocumentFragment();
        let fin = 0;
        let m;
        while ((m = DADOS.exec(t))) {
            trozo.appendChild(document.createTextNode(t.slice(fin, m.index)));
            trozo.appendChild(boton(m[1], limpia(m[1])));
            fin = DADOS.lastIndex;
        }
        trozo.appendChild(document.createTextNode(t.slice(fin)));
        nodo.replaceWith(trozo);
    }
    window.ocDadosEnTexto = function (raiz) {
        if (!raiz) {
            return;
        }
        const nodos = [];
        const andar = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, {
            acceptNode(n) {
                return n.parentElement && n.parentElement.closest("button, a, input, textarea, select, script, style, summary")
                    ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
            },
        });
        while (andar.nextNode()) {
            nodos.push(andar.currentNode);
        }
        nodos.forEach((n) => {
            const antes = n.previousSibling;
            const m = ATAQUE.exec(n.nodeValue);
            if (m && antes && antes.nodeType === 1 && /^Ataque\b.*:$/.test(antes.textContent.trim())) {
                const resto = document.createTextNode(n.nodeValue.slice(m[0].length));
                n.replaceWith(document.createTextNode(m[1]), boton(m[2], "1d20" + limpia(m[2]).replace(/^\+?/, "+").replace("+-", "-"), "ataque"), resto);
                trocear(resto);
                return;
            }
            trocear(n);
        });
    };
    window.ocDadoBoton = boton;
    function nombreDe(b) {
        if (b.closest("[data-que-solo]")) {
            return "";
        }
        const caja = b.closest("p, li, td, dd, .oc-texto, details");
        const fuerte = caja && caja.querySelector("strong");
        let n = fuerte ? fuerte.textContent : "";
        if (!n) {
            const det = b.closest("details");
            const ven = b.closest("[role=dialog], .master-ventana");
            n = det ? (det.querySelector("summary") || {}).textContent || ""
                : ven ? (ven.querySelector(".master-ventana-nombre, h2") || {}).textContent || "" : "";
        }
        return n.replace(/[.:]\s*$/, "").trim();
    }
    document.addEventListener("click", (e) => {
        const b = e.target.closest(".oc-dado-texto");
        if (!b || !window.ocDados) {
            return;
        }
        const que = [nombreDe(b), b.dataset.que].filter(Boolean).join(" · ") || b.textContent;
        window.ocDados.tirar(b.dataset.formula, que);
    });
    document.querySelectorAll(".oc-texto").forEach((t) => window.ocDadosEnTexto(t));
})();
