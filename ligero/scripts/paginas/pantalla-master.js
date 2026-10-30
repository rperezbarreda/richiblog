/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/paginas/pantalla-master.js
*/
(function () {
    const lienzo = document.querySelector("[data-master-lienzo]");
    const barra = document.querySelector("[data-master-barra]");
    if (!lienzo || !barra || !window.ocMontar) {
        return;
    }
    const CLAVE = "richi-master";
    const enMovil = window.matchMedia ? window.matchMedia("(max-width: 860px)") : { matches: false };
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
    const aviso = crear("p", "visually-hidden");
    aviso.setAttribute("role", "status");
    document.body.appendChild(aviso);
    function avisar(texto) {
        aviso.textContent = "";
        setTimeout(() => {
            aviso.textContent = texto;
        }, 50);
    }
    const llano = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    function enLinea(texto) {
        const nodos = [];
        const patron = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
        let fin = 0;
        let m;
        while ((m = patron.exec(texto))) {
            if (m.index > fin) {
                nodos.push(document.createTextNode(texto.slice(fin, m.index)));
            }
            nodos.push(crear(m[1] ? "strong" : "em", "", m[1] || m[2]));
            fin = patron.lastIndex;
        }
        if (fin < texto.length) {
            nodos.push(document.createTextNode(texto.slice(fin)));
        }
        return nodos;
    }
    function markdown(texto) {
        const caja = crear("div", "oc-texto");
        let lista = null;
        let parrafo = [];
        const cerrarParrafo = () => {
            if (parrafo.length) {
                const p = crear("p");
                p.append(...enLinea(parrafo.join(" ")));
                caja.appendChild(p);
                parrafo = [];
            }
        };
        String(texto || "").split("\n").forEach((linea) => {
            const l = linea.trim();
            if (/^[-*] /.test(l)) {
                cerrarParrafo();
                if (!lista) {
                    lista = crear("ul");
                    caja.appendChild(lista);
                }
                const li = crear("li");
                li.append(...enLinea(l.slice(2)));
                lista.appendChild(li);
                return;
            }
            lista = null;
            if (!l) {
                cerrarParrafo();
                return;
            }
            if (/^#{1,6} /.test(l)) {
                cerrarParrafo();
                const h = crear("h4", "oc-hoja-subtitulo");
                h.append(...enLinea(l.replace(/^#+ /, "")));
                caja.appendChild(h);
                return;
            }
            parrafo.push(l);
        });
        cerrarParrafo();
        return caja;
    }
    const pedidos = {};
    function pedir(ruta) {
        if (!pedidos[ruta]) {
            pedidos[ruta] = fetch(ruta).then((r) => {
                if (!r.ok) {
                    throw new Error(r.status);
                }
                return r.json();
            });
        }
        return pedidos[ruta];
    }
    function montarReglas(dentro, m, soloEstados) {
        dentro.appendChild(crear("p", "oc-hoja-nota", "Cargando las reglas…"));
        pedir("/datos/personajes/reglas-dnd.json").then((datos) => {
            const reglas = (datos.reglas || []).filter((r) => !soloEstados || r.grupo === "Estados");
            const caja = crear("div", "oc-reglas");
            const grupos = {};
            reglas.forEach((r) => {
                if (!grupos[r.grupo]) {
                    const g = crear("div", "oc-reglas-grupo");
                    const lista = crear("ul", "oc-reglas-lista");
                    if (!soloEstados) {
                        g.appendChild(crear("h3", "oc-reglas-titulo", r.grupo));
                    }
                    g.appendChild(lista);
                    caja.appendChild(g);
                    grupos[r.grupo] = lista;
                }
                const li = crear("li", "oc-regla");
                const detalles = crear("details");
                const resumen = crear("summary");
                if (r.icono) {
                    resumen.appendChild(crear("span", "oc-regla-icono", r.icono));
                }
                resumen.appendChild(crear("span", "oc-regla-nombre", r.nombre));
                detalles.append(resumen, markdown(r.texto));
                li.appendChild(detalles);
                grupos[r.grupo].appendChild(li);
            });
            dentro.replaceChildren(caja);
            window.ocMontar.reglas(caja, "master-buscar-" + m.id);
        }).catch(() => {
            dentro.replaceChildren(crear("p", "oc-vacio", "No he podido cargar las reglas."));
        });
    }
    function montarConjuros(dentro, m) {
        dentro.appendChild(crear("p", "oc-hoja-nota", "Cargando los conjuros…"));
        pedir("/datos/personajes/compendio/conjuros.json").then((datos) => {
            const conjuros = (datos.conjuros || []).map((c) => {
                const trozos = String(c.datos || "").split("·").map((x) => x.trim()).filter(Boolean);
                const nivel = /truco/i.test(trozos[0] || "") ? 0 : parseInt((/(\d+)/.exec(trozos[0] || "") || [])[1], 10);
                return { c, trozos, nivel: isNaN(nivel) ? -1 : nivel, buscar: llano(c.nombre + " " + c.datos) };
            });
            const fila = crear("div", "master-conjuros-buscar");
            const et = crear("label", "oc-dados-etiqueta", "buscar");
            const input = crear("input", "oc-dados-texto");
            input.type = "search";
            input.id = "master-conjuros-" + m.id;
            input.placeholder = "bola de fuego, evocación, concentración…";
            et.htmlFor = input.id;
            const etNivel = crear("label", "oc-dados-etiqueta", "nivel");
            const nivel = crear("select", "oc-dados-elegir");
            nivel.id = "master-conjuros-nivel-" + m.id;
            etNivel.htmlFor = nivel.id;
            [["", "todos"], ["0", "trucos"]].concat([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [String(n), "nivel " + n]))
                .forEach(([v, t]) => {
                    const o = crear("option", "", t);
                    o.value = v;
                    nivel.appendChild(o);
                });
            const cuantos = crear("p", "oc-hoja-nota");
            cuantos.setAttribute("role", "status");
            const lista = crear("ul", "master-conjuros");
            fila.append(et, input, etNivel, nivel);
            const pintar = () => {
                const q = llano(input.value.trim());
                const n = nivel.value === "" ? null : parseInt(nivel.value, 10);
                const salen = conjuros.filter((x) => (!q || x.buscar.includes(q)) && (n === null || x.nivel === n));
                lista.replaceChildren(...salen.slice(0, 60).map((x) => {
                    const li = crear("li");
                    const b = botonDe("master-conjuro", "", () => {
                        const cuerpo = crear("div", "oc-regla-ventana");
                        const chapas = crear("ul", "oc-desplegable-datos");
                        x.trozos.forEach((t) => chapas.appendChild(crear("li", "", t)));
                        cuerpo.append(chapas, markdown(x.c.texto));
                        window.ocVentana.abrir({ titulo: x.c.nombre, cuerpo, vuelta: b, clase: "es-regla" });
                    });
                    b.setAttribute("aria-haspopup", "dialog");
                    b.append(crear("span", "master-conjuro-nombre", x.c.nombre),
                        crear("span", "master-conjuro-datos", x.trozos.slice(0, 2).join(" · ")));
                    li.appendChild(b);
                    return li;
                }));
                cuantos.textContent = salen.length ? salen.length + (salen.length === 1 ? " conjuro" : " conjuros")
                    + (salen.length > 60 ? " (salen los 60 primeros)" : "") : "Ningún conjuro con eso.";
            };
            let espera = 0;
            input.addEventListener("input", () => {
                clearTimeout(espera);
                espera = setTimeout(pintar, 150);
            });
            nivel.addEventListener("change", pintar);
            dentro.replaceChildren(fila, cuantos, lista);
            pintar();
        }).catch(() => {
            dentro.replaceChildren(crear("p", "oc-vacio", "No he podido cargar los conjuros."));
        });
    }
    function montarDados(dentro, m) {
        const fila = crear("div", "master-dados");
        [4, 6, 8, 10, 12, 20, 100].forEach((c) => {
            fila.appendChild(botonDe("oc-vida-accion", "d" + c, () => {
                if (window.ocDados) {
                    window.ocDados.tirar("1d" + c, "d" + c);
                }
            }, "Tirar un d" + c));
        });
        const formula = crear("form", "master-formula");
        const et = crear("label", "oc-dados-etiqueta", "dados");
        const input = crear("input", "oc-dados-texto");
        input.id = "master-formula-" + m.id;
        input.placeholder = "2d6+3, 4d6, 1d20+5…";
        input.autocomplete = "off";
        et.htmlFor = input.id;
        const tirar = crear("button", "oc-vida-accion es-principal", "tirar");
        tirar.type = "submit";
        formula.append(et, input, tirar);
        formula.addEventListener("submit", (e) => {
            e.preventDefault();
            const f = input.value.replace(/\s+/g, "");
            if (!/^[+-]?(\d*d(\d+|F)|\d+)([+-](\d*d(\d+|F)|\d+))*$/i.test(f)) {
                avisar("Escribe los dados así: 2d6+3.");
                input.focus();
                return;
            }
            if (window.ocDados) {
                window.ocDados.tirar(f, f);
            }
        });
        const nota = crear("p", "oc-hoja-nota", "El registro, las tiradas guardadas y la bandeja, en la ventana de los"
            + " dados (el botón de arriba).");
        dentro.append(fila, formula, nota);
    }
    function montarTarjeta(dentro, m) {
        m.datos = m.datos || {};
        const ver = crear("div", "master-tarjeta");
        const editar = crear("div", "master-tarjeta-editar");
        editar.hidden = true;
        const etT = crear("label", "oc-dados-etiqueta", "título");
        const titulo = crear("input", "oc-dados-texto");
        titulo.id = "master-tarjeta-titulo-" + m.id;
        etT.htmlFor = titulo.id;
        const etX = crear("label", "oc-dados-etiqueta", "texto (con «- » para listas, **negrita**, *cursiva*)");
        const texto = crear("textarea", "oc-notas-texto");
        texto.id = "master-tarjeta-texto-" + m.id;
        etX.htmlFor = texto.id;
        texto.rows = 8;
        const pintar = () => {
            m.titulo = m.datos.titulo || "tarjeta";
            ponerTitulo(m);
            ver.replaceChildren(m.datos.texto ? markdown(m.datos.texto)
                : crear("p", "oc-vacio", "Vacía: pulsa «editar» y escribe lo que quieras tener a mano."));
        };
        const guardarla = botonDe("oc-vida-accion es-principal", "guardar", () => {
            m.datos.titulo = titulo.value.trim();
            m.datos.texto = texto.value;
            guardar();
            editar.hidden = true;
            ver.hidden = false;
            boton.hidden = false;
            pintar();
            boton.focus();
        });
        editar.append(etT, titulo, etX, texto, guardarla);
        const boton = botonDe("oc-vida-accion", "✏️ editar", () => {
            titulo.value = m.datos.titulo || "";
            texto.value = m.datos.texto || "";
            editar.hidden = false;
            ver.hidden = true;
            boton.hidden = true;
            titulo.focus();
        });
        dentro.append(ver, editar, boton);
        pintar();
    }
    function montarTabla(dentro, m) {
        m.datos = m.datos || {};
        m.titulo = m.datos.titulo || "";
        ponerTitulo(m);
        const etT = crear("label", "oc-dados-etiqueta", "nombre");
        const titulo = crear("input", "oc-dados-texto");
        titulo.id = "master-tabla-titulo-" + m.id;
        titulo.value = m.datos.titulo || "";
        titulo.placeholder = "encuentros en el bosque";
        etT.htmlFor = titulo.id;
        const etX = crear("label", "oc-dados-etiqueta", "lo que puede salir (una cosa por línea)");
        const texto = crear("textarea", "oc-notas-texto es-corta");
        texto.id = "master-tabla-texto-" + m.id;
        texto.rows = 6;
        texto.value = m.datos.texto || "";
        etX.htmlFor = texto.id;
        const sale = crear("p", "master-tabla-sale");
        sale.setAttribute("role", "status");
        let espera = 0;
        const alEscribir = () => {
            clearTimeout(espera);
            espera = setTimeout(() => {
                m.datos.titulo = titulo.value.trim();
                m.datos.texto = texto.value;
                m.titulo = m.datos.titulo || "tabla";
                ponerTitulo(m);
                guardar();
            }, 400);
        };
        titulo.addEventListener("input", alEscribir);
        texto.addEventListener("input", alEscribir);
        const tirar = botonDe("oc-vida-accion es-principal", "🎲 tirar en la tabla", () => {
            const cosas = texto.value.split("\n").map((x) => x.trim()).filter(Boolean);
            if (!cosas.length) {
                sale.textContent = "Escribe primero lo que puede salir.";
                return;
            }
            const u = new Uint32Array(1);
            crypto.getRandomValues(u);
            const i = u[0] % cosas.length;
            sale.textContent = "";
            setTimeout(() => {
                sale.textContent = (i + 1) + " de " + cosas.length + ": " + cosas[i];
            }, 50);
        });
        dentro.append(etT, titulo, etX, texto, tirar, sale);
    }
    const MODULOS = {
        iniciativa: { nombre: "iniciativa", emoji: "⏱️", unico: true, w: 420, h: 520,
            montar: (d) => window.ocMontar.iniciativa(d, { suelta: true }) },
        condiciones: { nombre: "condiciones", emoji: "🙈", unico: true, w: 460, h: 420,
            montar: (d, m) => montarReglas(d, m, true) },
        reglas: { nombre: "reglas", emoji: "📚", unico: true, w: 480, h: 520, montar: (d, m) => montarReglas(d, m, false) },
        conjuros: { nombre: "conjuros", emoji: "✨", unico: true, w: 420, h: 480, montar: montarConjuros },
        dados: { nombre: "dados", emoji: "🎲", w: 360, h: 230, montar: montarDados },
        notas: { nombre: "notas", emoji: "📝", unico: true, w: 420, h: 420,
            montar: (d) => window.ocMontar.notas(d, { soloNotas: true }) },
        tarjeta: { nombre: "tarjeta", emoji: "📌", w: 320, h: 280, montar: montarTarjeta },
        tabla: { nombre: "tabla para tirar", emoji: "🔮", w: 340, h: 380, montar: montarTabla },
    };
    let estado = null;
    try {
        estado = JSON.parse(localStorage.getItem(CLAVE) || "null");
    } catch (e) {
        estado = null;
    }
    const DE_INICIO = () => ({ modulos: [
        { tipo: "iniciativa", x: 0, y: 0 },
        { tipo: "condiciones", x: 440, y: 0 },
        { tipo: "dados", x: 920, y: 0 },
        { tipo: "notas", x: 920, y: 250 },
    ] });
    if (!estado || !Array.isArray(estado.modulos)) {
        estado = DE_INICIO();
        estado.nueva = true;
    }
    let siguienteId = 1;
    estado.modulos = estado.modulos.filter((m) => MODULOS[m.tipo]);
    estado.modulos.forEach((m) => {
        m.id = m.id || "m" + siguienteId++;
        siguienteId = Math.max(siguienteId, parseInt(String(m.id).slice(1), 10) + 1 || siguienteId);
    });
    function guardar() {
        const salida = { modulos: estado.modulos.map((m) => ({ id: m.id, tipo: m.tipo, x: m.x, y: m.y, w: m.w, h: m.h,
            plegado: !!m.plegado, datos: m.datos })) };
        try {
            localStorage.setItem(CLAVE, JSON.stringify(salida));
        } catch (e) {
        }
    }
    let encima = 10;
    function topeX(m) {
        return Math.max(0, lienzo.clientWidth - m.w - 4);
    }
    function ponerTitulo(m) {
        if (m.el) {
            m.el.querySelector(".master-ventana-nombre").textContent = m.titulo || MODULOS[m.tipo].nombre;
        }
    }
    function colocar(m) {
        if (enMovil.matches) {
            m.el.style.left = "";
            m.el.style.top = "";
            m.el.style.width = "";
            m.el.style.height = "";
            return;
        }
        m.el.style.left = m.x + "px";
        m.el.style.top = m.y + "px";
        m.el.style.width = m.w + "px";
        m.el.style.height = m.plegado ? "" : m.h + "px";
    }
    function alFrente(m) {
        encima += 1;
        m.el.style.zIndex = String(encima);
    }
    function ventanaDe(m) {
        const def = MODULOS[m.tipo];
        m.w = m.w || def.w;
        m.h = m.h || def.h;
        m.x = Math.max(0, m.x || 0);
        m.y = Math.max(0, m.y || 0);
        const v = crear("div", "master-ventana oc-hoja-caja");
        v.setAttribute("role", "region");
        const cabeza = crear("div", "recent-entries-header master-ventana-barra");
        const titulo = crear("h2", "oc-hoja-titulo master-ventana-titulo");
        const idTitulo = "master-titulo-" + m.id;
        titulo.id = idTitulo;
        v.setAttribute("aria-labelledby", idTitulo);
        const em = crear("span", "oc-hoja-emoji", def.emoji);
        em.setAttribute("aria-hidden", "true");
        titulo.append(em, crear("span", "master-ventana-nombre", m.titulo || def.nombre));
        const asa = botonDe("master-ventana-mando es-asa", "⠿", () => {}, "Mover la ventana (con las flechas)");
        asa.title = "Arrástrala por la barra, o pulsa aquí y usa las flechas";
        asa.addEventListener("keydown", (e) => {
            const paso = e.shiftKey ? 60 : 20;
            const d = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] }[e.key];
            if (!d || enMovil.matches) {
                return;
            }
            e.preventDefault();
            m.x = Math.min(topeX(m), Math.max(0, m.x + d[0]));
            m.y = Math.max(0, m.y + d[1]);
            colocar(m);
            crecerLienzo();
            guardar();
        });
        const plegar = botonDe("master-ventana-mando", m.plegado ? "+" : "−", () => {
            m.plegado = !m.plegado;
            cuerpo.hidden = m.plegado;
            plegar.textContent = m.plegado ? "+" : "−";
            plegar.setAttribute("aria-expanded", m.plegado ? "false" : "true");
            v.classList.toggle("es-plegada", m.plegado);
            colocar(m);
            guardar();
        }, "Plegar o desplegar");
        plegar.setAttribute("aria-expanded", m.plegado ? "false" : "true");
        const quitar = botonDe("master-ventana-mando", "✕", () => {
            estado.modulos = estado.modulos.filter((x) => x !== m);
            v.remove();
            guardar();
            avisar("Quitado: " + (m.titulo || def.nombre) + ".");
            botonAnadir.focus();
        }, "Quitar este módulo");
        const mandos = crear("div", "master-ventana-mandos");
        mandos.append(asa, plegar, quitar);
        cabeza.append(titulo, mandos);
        const cuerpo = crear("div", "oc-hoja-dentro master-ventana-cuerpo");
        cuerpo.hidden = !!m.plegado;
        v.classList.toggle("es-plegada", !!m.plegado);
        v.append(cabeza, cuerpo);
        m.el = v;
        cabeza.addEventListener("pointerdown", (e) => {
            if (enMovil.matches || e.target.closest("button:not(.es-asa)") || e.button > 0) {
                return;
            }
            e.preventDefault();
            alFrente(m);
            const x0 = e.clientX;
            const y0 = e.clientY;
            const mx = m.x;
            const my = m.y;
            v.classList.add("es-arrastrada");
            const mover = (ev) => {
                m.x = Math.min(topeX(m), Math.max(0, mx + ev.clientX - x0));
                m.y = Math.max(0, my + ev.clientY - y0);
                colocar(m);
            };
            const soltar = () => {
                document.removeEventListener("pointermove", mover);
                document.removeEventListener("pointerup", soltar);
                document.removeEventListener("pointercancel", soltar);
                v.classList.remove("es-arrastrada");
                crecerLienzo();
                guardar();
            };
            document.addEventListener("pointermove", mover);
            document.addEventListener("pointerup", soltar);
            document.addEventListener("pointercancel", soltar);
        });
        v.addEventListener("pointerdown", () => alFrente(m));
        if (window.ResizeObserver) {
            let primera = true;
            new ResizeObserver(() => {
                if (primera) {
                    primera = false;
                    return;
                }
                if (enMovil.matches || m.plegado) {
                    return;
                }
                m.w = Math.round(v.offsetWidth);
                m.h = Math.round(v.offsetHeight);
                crecerLienzo();
                guardar();
            }).observe(v);
        }
        colocar(m);
        def.montar(cuerpo, m);
        return v;
    }
    function crecerLienzo() {
        if (enMovil.matches) {
            lienzo.style.height = "";
            return;
        }
        const fondo = Math.max(400, ...estado.modulos.map((m) => m.y + (m.plegado ? 60 : m.h) + 40));
        lienzo.style.height = fondo + "px";
    }
    function pintarTodo() {
        const orden = estado.modulos.slice().sort((a, b) => (a.y - b.y) || (a.x - b.x));
        lienzo.replaceChildren(...orden.map((m) => m.el || ventanaDe(m)));
        orden.forEach(colocar);
        crecerLienzo();
    }
    const botonAnadir = botonDe("oc-vida-accion es-principal", "＋ añadir", () => {
        const cuerpo = crear("div", "master-anadir");
        const lista = crear("ul", "oc-menu-ventana-lista");
        Object.keys(MODULOS).forEach((tipo) => {
            const def = MODULOS[tipo];
            const ya = def.unico && estado.modulos.some((m) => m.tipo === tipo);
            const li = crear("li");
            const b = botonDe("oc-menu-ventana-opcion", "", () => {
                cerrar();
                anadir(tipo);
            });
            const em = crear("span", "oc-menu-emoji", def.emoji);
            em.setAttribute("aria-hidden", "true");
            b.append(em, document.createTextNode(def.nombre + (ya ? " (ya está)" : "")));
            b.disabled = ya;
            li.appendChild(b);
            lista.appendChild(li);
        });
        cuerpo.appendChild(lista);
        const cerrar = window.ocVentana.abrir({ titulo: "añadir un módulo", cuerpo, vuelta: botonAnadir,
            foco: lista.querySelector("button:not([disabled])") || undefined });
    });
    botonAnadir.setAttribute("aria-haspopup", "dialog");
    function anadir(tipo) {
        const def = MODULOS[tipo];
        const y = estado.modulos.length ? Math.max(...estado.modulos.map((m) => m.y + (m.plegado ? 60 : m.h))) + 20 : 0;
        const m = { id: "m" + siguienteId++, tipo, x: 0, y: enMovil.matches ? 0 : y, w: def.w, h: def.h };
        estado.modulos.push(m);
        pintarTodo();
        guardar();
        alFrente(m);
        m.el.scrollIntoView({ block: "nearest" });
        const primero = m.el.querySelector(".master-ventana-cuerpo button, .master-ventana-cuerpo input, .master-ventana-cuerpo textarea")
            || m.el.querySelector(".es-asa");
        primero.focus();
        avisar("Añadido: " + def.nombre + ".");
    }
    function ordenar() {
        const ancho = Math.max(400, lienzo.clientWidth);
        let x = 0;
        let y = 0;
        let alto = 0;
        estado.modulos.forEach((m) => {
            if (x + m.w > ancho && x > 0) {
                x = 0;
                y += alto + 20;
                alto = 0;
            }
            m.x = x;
            m.y = y;
            x += m.w + 20;
            alto = Math.max(alto, m.plegado ? 60 : m.h);
        });
    }
    const botonOrdenar = botonDe("oc-vida-accion", "▦ ordenar", () => {
        ordenar();
        pintarTodo();
        guardar();
        avisar("Ordenados.");
    });
    let seguro = false;
    const botonInicio = botonDe("oc-vida-accion", "↺ como al principio", () => {
        if (!seguro) {
            seguro = true;
            botonInicio.textContent = "↺ ¿seguro? pulsa otra vez";
            setTimeout(() => {
                seguro = false;
                botonInicio.textContent = "↺ como al principio";
            }, 4000);
            return;
        }
        seguro = false;
        botonInicio.textContent = "↺ como al principio";
        estado = DE_INICIO();
        estado.modulos.forEach((m) => {
            m.id = "m" + siguienteId++;
            m.w = MODULOS[m.tipo].w;
            m.h = MODULOS[m.tipo].h;
        });
        ordenar();
        pintarTodo();
        guardar();
        avisar("La pantalla, como al principio.");
    });
    const mandos = crear("div", "master-barra-mandos");
    mandos.append(botonAnadir, botonOrdenar, botonInicio);
    barra.prepend(mandos);
    lienzo.classList.add("con-lienzo");
    if (estado.nueva) {
        estado.modulos.forEach((m) => {
            m.w = MODULOS[m.tipo].w;
            m.h = MODULOS[m.tipo].h;
        });
        ordenar();
    }
    pintarTodo();
    if (enMovil.addEventListener) {
        enMovil.addEventListener("change", pintarTodo);
    }
})();
