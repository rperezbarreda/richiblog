/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/paginas/personajes.js
*/
const ocPestanas = document.querySelector("[data-oc-pestanas]");
const ocPanel = document.querySelector("[data-oc-panel]");
const ocSubpestanas = document.querySelector("[data-oc-subpestanas]");
const ocSubpanel = document.querySelector("[data-oc-subpanel]");
if (ocPestanas && ocPanel) {
    montarPestanasDePersonaje(ocPestanas, ocPanel, { apartado: "data-oc-apartado", prefijo: "oc-pestana-",
        clase: "oc-pestana", lista: "oc-pestanas-lista", conDireccion: true });
}
if (ocSubpestanas && ocSubpanel) {
    montarPestanasDePersonaje(ocSubpestanas, ocSubpanel, { apartado: "data-oc-subapartado",
        prefijo: "oc-subpestana-", clase: "oc-subpestana", lista: "oc-subpestanas-lista", conDireccion: false });
}
function montarPestanasDePersonaje(menu, panel, o) {
    const enlaces = Array.from(menu.querySelectorAll("[data-oc-pestana]"));
    const apartados = enlaces.map((a) => panel.querySelector("[" + o.apartado + "='" + a.dataset.ocPestana + "']"));
    if (!enlaces.length || apartados.some((x) => !x)) {
        return;
    }
    const lista = document.createElement("div");
    lista.className = o.lista;
    lista.setAttribute("role", "tablist");
    lista.setAttribute("aria-label", menu.getAttribute("aria-label") || "Apartados");
    const botones = enlaces.map((a, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = o.clase;
        b.id = o.prefijo + a.dataset.ocPestana;
        [...a.childNodes].forEach((n) => b.appendChild(n.cloneNode(true)));
        b.setAttribute("role", "tab");
        b.setAttribute("aria-controls", apartados[i].id);
        b.dataset.ocPestana = a.dataset.ocPestana;
        lista.appendChild(b);
        return b;
    });
    menu.replaceWith(lista);
    panel.classList.add("con-pestanas");
    apartados.forEach((ap, i) => {
        ap.setAttribute("role", "tabpanel");
        ap.setAttribute("aria-labelledby", botones[i].id);
        ap.tabIndex = 0;
    });
    function elegir(i, conFoco, apuntar) {
        botones.forEach((b, j) => {
            const es = j === i;
            b.setAttribute("aria-selected", es ? "true" : "false");
            b.tabIndex = es ? 0 : -1;
            apartados[j].hidden = !es;
        });
        if (conFoco) {
            botones[i].focus();
        }
        if (apuntar && o.conDireccion) {
            try {
                history.replaceState(null, "", "#" + apartados[i].id);
            } catch (error) {
            }
        }
    }
    botones.forEach((b, i) => {
        b.addEventListener("click", () => elegir(i, false, true));
        b.addEventListener("keydown", (evento) => {
            const ultimo = botones.length - 1;
            const a = {
                ArrowRight: i === ultimo ? 0 : i + 1,
                ArrowLeft: i === 0 ? ultimo : i - 1,
                Home: 0,
                End: ultimo,
            }[evento.key];
            if (a === undefined) {
                return;
            }
            evento.preventDefault();
            elegir(a, true, true);
        });
    });
    function desdeLaDireccion() {
        const pedido = decodeURIComponent((location.hash || "").slice(1));
        const i = apartados.findIndex((ap) => ap.id === pedido);
        return i < 0 ? 0 : i;
    }
    if (o.conDireccion) {
        window.addEventListener("hashchange", () => elegir(desdeLaDireccion(), false, false));
        elegir(desdeLaDireccion(), false, false);
    } else {
        elegir(0, false, false);
    }
}
(function () {
    const marcas = Array.from(document.querySelectorAll(".oc-dado[data-dados]"));
    const sitioDelBoton = document.querySelector("[data-oc-botones]");
    if (!marcas.length && !sitioDelBoton) {
        return;
    }
    const CARAS = [4, 6, 8, 10, 12, 20, 100];
    const estado = { mano: {}, modo: "normal" };
    function alAzar(caras) {
        const u = new Uint32Array(1);
        const tope = Math.floor(0x100000000 / caras) * caras;
        do {
            crypto.getRandomValues(u);
        } while (u[0] >= tope);
        return (u[0] % caras) + 1;
    }
    function trozosDe(formula) {
        const trozos = [];
        const texto = String(formula).replace(/−/g, "-").replace(/\s+/g, "");
        const patron = /([+-]?)(\d*)d(\d+)|([+-]?)(\d+)/g;
        let m;
        while ((m = patron.exec(texto))) {
            if (m[3]) {
                trozos.push({ signo: m[1] === "-" ? -1 : 1, cuantos: Math.min(parseInt(m[2] || "1", 10), 100),
                    caras: parseInt(m[3], 10) });
            } else {
                trozos.push({ signo: m[4] === "-" ? -1 : 1, fijo: parseInt(m[5], 10) });
            }
        }
        return trozos;
    }
    function tirar(formula, que) {
        const trozos = trozosDe(formula);
        if (!trozos.length) {
            return null;
        }
        const d20s = trozos.filter((t) => t.caras === 20).reduce((n, t) => n + t.cuantos, 0);
        const conVentaja = estado.modo !== "normal" && d20s === 1;
        let total = 0;
        let natural = null;
        const partes = [];
        trozos.forEach((t) => {
            if (t.fijo !== undefined) {
                total += t.signo * t.fijo;
                partes.push((t.signo < 0 ? "− " : "+ ") + t.fijo);
                return;
            }
            const salen = [];
            for (let i = 0; i < t.cuantos; i++) {
                if (t.caras === 20 && conVentaja) {
                    const a = alAzar(20);
                    const b = alAzar(20);
                    const queda = estado.modo === "ventaja" ? Math.max(a, b) : Math.min(a, b);
                    salen.push(queda + " (" + a + " y " + b + ", " + estado.modo + ")");
                    total += t.signo * queda;
                    natural = queda;
                } else {
                    const x = alAzar(t.caras);
                    salen.push(String(x));
                    total += t.signo * x;
                    if (t.caras === 20 && t.cuantos === 1) {
                        natural = x;
                    }
                }
            }
            partes.push((partes.length ? (t.signo < 0 ? "− " : "+ ") : (t.signo < 0 ? "− " : ""))
                + t.cuantos + "d" + t.caras + " [" + salen.join(", ") + "]");
        });
        const r = { que: que || "tirada", formula: String(formula).replace(/-/g, "−"), total,
            desglose: partes.join(" "), critico: d20s === 1 && natural === 20,
            pifia: d20s === 1 && natural === 1 };
        mostrar(r);
        return r;
    }
    let ventana = null;
    let boton = null;
    let historial = null;
    let aviso = null;
    let manoTexto = null;
    let tirarBoton = null;
    let modInput = null;
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
    function formulaDeLaMano() {
        const trozos = CARAS.filter((c) => estado.mano[c]).sort((a, b) => b - a)
            .map((c) => estado.mano[c] + "d" + c);
        const mod = parseInt(modInput.value || "0", 10) || 0;
        if (mod) {
            trozos.push((mod > 0 ? "+" : "−") + Math.abs(mod));
        }
        return trozos.join(" + ").replace(/\+ −/g, "− ").replace(/\+ \+/g, "+ ");
    }
    function pintarMano() {
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
        const barra = crear("div", "recent-entries-header oc-dados-barra");
        const titulo = crear("h2", "oc-dados-titulo");
        titulo.append(crear("span", "oc-dados-emoji", "🎲"), document.createTextNode("dados.exe"));
        titulo.firstChild.setAttribute("aria-hidden", "true");
        const cerrar = crear("button", "oc-dados-cerrar", "✕");
        cerrar.type = "button";
        cerrar.setAttribute("aria-label", "Cerrar los dados");
        cerrar.addEventListener("click", () => abrir(false, true));
        barra.append(titulo, cerrar);
        const cuerpo = crear("div", "oc-dados-cuerpo");
        const bandeja = crear("div", "oc-dados-bandeja");
        bandeja.setAttribute("role", "group");
        bandeja.setAttribute("aria-label", "Añadir dados");
        CARAS.forEach((c) => {
            const b = crear("button", "oc-dados-cara", "d" + c);
            b.type = "button";
            b.setAttribute("aria-label", "Añadir un d" + c);
            b.addEventListener("click", () => {
                estado.mano[c] = (estado.mano[c] || 0) + 1;
                pintarMano();
            });
            bandeja.appendChild(b);
        });
        const fila = crear("div", "oc-dados-fila");
        const etiqueta = crear("label", "oc-dados-etiqueta", "modificador");
        modInput = crear("input", "oc-dados-mod");
        modInput.type = "number";
        modInput.id = "oc-dados-mod";
        modInput.value = "0";
        modInput.step = "1";
        etiqueta.htmlFor = modInput.id;
        modInput.addEventListener("input", pintarMano);
        fila.append(etiqueta, modInput);
        manoTexto = crear("p", "oc-dados-mano");
        const modos = crear("div", "oc-dados-modos");
        modos.setAttribute("role", "group");
        modos.setAttribute("aria-label", "Ventaja o desventaja (para lo que se tira con un d20)");
        const botonesModo = ["normal", "ventaja", "desventaja"].map((m) => {
            const b = crear("button", "oc-dados-modo", m);
            b.type = "button";
            b.setAttribute("aria-pressed", m === estado.modo ? "true" : "false");
            b.addEventListener("click", () => {
                estado.modo = m;
                botonesModo.forEach((x) => x.setAttribute("aria-pressed", x.textContent === m ? "true" : "false"));
            });
            modos.appendChild(b);
            return b;
        });
        const acciones = crear("div", "oc-dados-acciones");
        tirarBoton = crear("button", "oc-dados-tirar", "tirar");
        tirarBoton.type = "button";
        tirarBoton.addEventListener("click", () => tirar(formulaDeLaMano(), "bandeja"));
        const borrar = crear("button", "oc-dados-borrar", "borrar");
        borrar.type = "button";
        borrar.addEventListener("click", () => {
            estado.mano = {};
            modInput.value = "0";
            pintarMano();
        });
        acciones.append(tirarBoton, borrar);
        const tituloHistorial = crear("h3", "oc-dados-subtitulo", "tiradas");
        historial = crear("ol", "oc-dados-historial");
        aviso = crear("p", "visually-hidden");
        aviso.setAttribute("role", "status");
        cuerpo.append(bandeja, manoTexto, fila, modos, acciones, tituloHistorial, historial, aviso);
        ventana.append(barra, cuerpo);
        ventana.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                abrir(false, true);
            }
        });
        document.body.appendChild(ventana);
        pintarMano();
    }
    function abrir(si, devolverFoco) {
        ventana.hidden = !si;
        if (boton) {
            boton.setAttribute("aria-expanded", si ? "true" : "false");
            if (!si && devolverFoco) {
                boton.focus();
            }
        }
    }
    function mostrar(r) {
        if (ventana.hidden) {
            abrir(true, false);
        }
        const li = crear("li", "oc-dados-tirada" + (r.critico ? " es-critico" : "") + (r.pifia ? " es-pifia" : ""));
        const cabeza = crear("p", "oc-dados-que");
        cabeza.append(crear("span", "oc-dados-que-nombre", r.que), crear("span", "oc-dados-formula", r.formula));
        const total = crear("p", "oc-dados-total", String(r.total));
        if (r.critico || r.pifia) {
            total.appendChild(crear("span", "oc-dados-natural", r.critico ? "¡20 natural!" : "1 natural"));
        }
        li.append(cabeza, total, crear("p", "oc-dados-desglose", r.desglose));
        historial.prepend(li);
        while (historial.children.length > 20) {
            historial.lastChild.remove();
        }
        aviso.textContent = "";
        setTimeout(() => {
            aviso.textContent = r.que + ": " + r.total + (r.critico ? ", ¡20 natural!" : "")
                + (r.pifia ? ", 1 natural" : "") + ". " + r.desglose;
        }, 50);
    }
    montar();
    if (sitioDelBoton) {
        boton = crear("button", "oc-boton oc-boton-dados");
        boton.type = "button";
        boton.title = "Lanzador de dados";
        const dibujo = crear("span", "oc-boton-dados-emoji", "🎲");
        dibujo.setAttribute("aria-hidden", "true");
        boton.append(dibujo, crear("span", "visually-hidden", "dados"));
        boton.setAttribute("aria-controls", "oc-dados");
        boton.setAttribute("aria-expanded", "false");
        boton.addEventListener("click", () => abrir(ventana.hidden, false));
        sitioDelBoton.appendChild(boton);
    }
    marcas.forEach((m) => {
        const b = crear("button", "oc-dado");
        b.type = "button";
        b.dataset.dados = m.dataset.dados;
        b.dataset.que = m.dataset.que || "";
        b.innerHTML = m.innerHTML;
        b.setAttribute("aria-label", m.textContent.trim() + ", tirar " + (m.dataset.que || m.dataset.dados)
            + " (" + m.dataset.dados.replace(/-/g, " menos ") + ")");
        b.title = "Tirar " + m.dataset.dados;
        b.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            tirar(b.dataset.dados, b.dataset.que);
        });
        m.replaceWith(b);
    });
})();
