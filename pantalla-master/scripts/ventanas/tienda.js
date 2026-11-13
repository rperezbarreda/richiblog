// =========================================
// LA VENTANA «tienda» de la pantalla de máster (sale de
// pantalla-master.js; se carga antes que él). Lo que usa del núcleo,
// por window.ocPM («PM.algo»); lo que el núcleo usa de aquí, a PM al final.
// =========================================
(function () {
    const PM = window.ocPM = window.ocPM || {};

    function montarTienda(dentro, m) {
        m.datos = m.datos || {};
        dentro.appendChild(PM.crear("p", "oc-hoja-nota", ocT("Abriendo la tienda…")));
        PM.pedir("datos/personajes/compendio/tienda.json").then((datos) => {
            const objetos = (datos.objetos || []).map((o) => ({ o, buscar: PM.llano(o.nombre + " " + o.en + " " + o.cat) }));
            const elegir = (id, texto, opciones, valor) => {
                const et = PM.crear("label", "oc-dados-etiqueta", texto);
                const sel = PM.crear("select", "oc-dados-elegir");
                sel.id = id + m.id;
                et.htmlFor = sel.id;
                opciones.forEach(([v, t]) => {
                    const op = PM.crear("option", "", t);
                    op.value = v;
                    sel.appendChild(op);
                });
                sel.value = valor || "";
                return [et, sel];
            };
            const [etTienda, tienda] = elegir("master-tienda-", "tienda",
                [["", ocT("todas")]].concat((datos.tiendas || []).map((t) => [t, t])), m.datos.tienda);
            const [etCat, cat] = elegir("master-tienda-cat-", "categoría", [["", ocT("todas")]], "");
            const [etRareza, rareza] = elegir("master-tienda-rareza-", "rareza",
                [["", ocT("todas")]].concat(PM.RAREZAS.map((r) => [r, r])), m.datos.rareza);
            // El precio de la tienda, en %: 100 es lo normal; 80, un 20 % más
            // barato; 150, la mitad más caro. (Lo de antes, ×1,5…, pasa a %.)
            if (m.datos.porc === undefined && m.datos.precio) {
                m.datos.porc = Math.round(parseFloat(m.datos.precio) * 100) || 100;
            }
            const etPrecio = PM.crear("label", "oc-dados-etiqueta", ocT("precios (%)"));
            const precio = PM.crear("input", "oc-dados-texto");
            precio.type = "number";
            precio.min = "0";
            precio.max = "1000";
            precio.step = "5";
            precio.inputMode = "numeric";
            precio.value = String(m.datos.porc || 100);
            precio.id = "master-tienda-precio-" + m.id;
            precio.setAttribute("aria-describedby", "master-tienda-precio-ayuda-" + m.id);
            etPrecio.htmlFor = precio.id;
            const ayudaPrecio = PM.crear("p", "oc-hoja-nota master-tienda-ayuda", ocT("100 = normal; 80 = un 20 % más barato; 150 = la mitad más caro."));
            ayudaPrecio.id = "master-tienda-precio-ayuda-" + m.id;
            const etBuscar = PM.crear("label", "oc-dados-etiqueta", ocT("buscar"));
            const buscar = PM.crear("input", "oc-dados-texto");
            buscar.type = "search";
            buscar.id = "master-tienda-buscar-" + m.id;
            buscar.placeholder = ocT("cuerda, poción, espada…");
            etBuscar.htmlFor = buscar.id;
            const campos = PM.crear("div", "master-tienda-campos");
            [[etTienda, tienda], [etCat, cat], [etRareza, rareza], [etPrecio, precio], [etBuscar, buscar]].forEach(([e, c]) => {
                const caja = PM.crear("div", "master-tienda-campo" + (c === buscar ? " es-ancho" : ""));
                caja.append(e, c);
                if (c === precio) {
                    caja.appendChild(ayudaPrecio);
                }
                campos.appendChild(caja);
            });
            // El surtido: unos cuantos al azar de lo que se ve (y se guarda).
            const cuantosAzar = PM.crear("input", "oc-dados-texto master-tienda-cuantos");
            cuantosAzar.type = "number";
            cuantosAzar.min = "1";
            cuantosAzar.max = "40";
            cuantosAzar.value = String(m.datos.cuantos || 8);
            cuantosAzar.id = "master-tienda-cuantos-" + m.id;
            const etCuantos = PM.crear("label", "oc-dados-etiqueta", ocT("cuántos"));
            etCuantos.htmlFor = cuantosAzar.id;
            const azar = PM.botonDe("oc-vida-accion es-principal", ocT("🎲 surtido al azar"), () => {
                const n = Math.max(1, Math.min(40, parseInt(cuantosAzar.value, 10) || 8));
                const pool = filtrados(false).slice();
                const u = new Uint32Array(pool.length);
                crypto.getRandomValues(u);
                for (let i = pool.length - 1; i > 0; i -= 1) {
                    const j = u[i] % (i + 1);
                    [pool[i], pool[j]] = [pool[j], pool[i]];
                }
                m.datos.surtido = pool.slice(0, n).map((x) => x.o.en);
                m.datos.cuantos = n;
                PM.guardar();
                pintar();
                PM.avisar(ocT("Surtido nuevo: {n} objetos.", { n: m.datos.surtido.length }));
            });
            const todo = PM.botonDe("oc-vida-accion", ocT("ver todo"), () => {
                delete m.datos.surtido;
                PM.guardar();
                pintar();
                PM.avisar(ocT("Se ve todo."));
            });
            const surtidoFila = PM.crear("div", "master-tienda-azar");
            const cajaCuantos = PM.crear("div", "master-tienda-campo");
            cajaCuantos.append(etCuantos, cuantosAzar);
            surtidoFila.append(cajaCuantos, azar, todo);
            const cuantos = PM.crear("p", "oc-hoja-nota");
            cuantos.setAttribute("role", "status");
            const tabla = PM.crear("table", "master-tienda-tabla");
            const cap = PM.crear("caption", "visually-hidden", ocT("Objetos y precios"));
            const cab = PM.crear("tr");
            [["Objeto", ""], ["Precio", "es-precio"]].forEach(([t, c]) => {
                const th = PM.crear("th", c, t);
                th.scope = "col";
                cab.appendChild(th);
            });
            const thead = PM.crear("thead");
            thead.appendChild(cab);
            const cuerpo = PM.crear("tbody");
            tabla.append(cap, thead, cuerpo);

            function filtrados(conSurtido) {
                const q = PM.llano(buscar.value.trim());
                const enSurtido = conSurtido && m.datos.surtido ? new Set(m.datos.surtido) : null;
                return objetos.filter((x) => (!tienda.value || x.o.tiendas.indexOf(tienda.value) >= 0)
                    && (!cat.value || x.o.cat === cat.value) && (!rareza.value || x.o.rareza === rareza.value)
                    && (!q || x.buscar.includes(q)) && (!enSurtido || enSurtido.has(x.o.en)));
            }

            // Las categorías que hay en la tienda elegida.
            function categorias() {
                const antes = cat.value;
                const hay = Array.from(new Set(objetos.filter((x) => !tienda.value || x.o.tiendas.indexOf(tienda.value) >= 0)
                    .map((x) => x.o.cat))).sort();
                cat.replaceChildren(...[["", ocT("todas")]].concat(hay.map((c) => [c, c])).map(([v, t]) => {
                    const op = PM.crear("option", "", t);
                    op.value = v;
                    return op;
                }));
                cat.value = hay.indexOf(antes) >= 0 ? antes : "";
            }

            const porcentaje = () => Math.max(0, parseFloat(precio.value) || 0) / 100 || (precio.value === "0" ? 0 : 1);

            // La ventana de cada objeto: sus datos, el precio de lista, el de
            // la tienda y el regateo (un % propio, con lo que queda).
            function ficha(o, vuelta) {
                const cuerpo = PM.datosObjeto(Object.assign({}, o, { cp: 0 }));
                if (o.cp) {
                    const precios = PM.crear("dl", "master-bicho-datos master-objeto-precios");
                    const tiendaP = Math.round(porcentaje() * 100);
                    precios.append(PM.crear("dt", "", ocT("De lista")), PM.crear("dd", "", PM.moneda(o.cp)),
                        PM.crear("dt", "", ocT("En esta tienda ({tiendaP} %)", { tiendaP: tiendaP })), PM.crear("dd", "", PM.moneda(o.cp * porcentaje())));
                    const form = PM.crear("form", "master-regateo");
                    const et = PM.crear("label", "oc-dados-etiqueta", ocT("regatear: precio final (%)"));
                    const pct = PM.crear("input", "oc-dados-texto");
                    pct.type = "number";
                    pct.min = "0";
                    pct.max = "1000";
                    pct.step = "5";
                    pct.inputMode = "numeric";
                    pct.id = "master-regateo-" + m.id;
                    pct.value = String(tiendaP);
                    et.htmlFor = pct.id;
                    const queda = PM.crear("p", "master-regateo-queda");
                    queda.setAttribute("aria-live", "polite");
                    const echar = () => {
                        const v = Math.max(0, parseFloat(pct.value) || 0);
                        queda.textContent = ocT("Queda en {moneda} ({v} % del precio de lista).", { moneda: PM.moneda(o.cp * v / 100), v: v });
                    };
                    pct.addEventListener("input", echar);
                    const rapidos = PM.crear("div", "master-regateo-rapidos");
                    [-20, -10, -5, 5, 10, 20].forEach((d) => {
                        rapidos.appendChild(PM.botonDe("oc-vida-accion", (d > 0 ? "+" : "−") + Math.abs(d) + " %", () => {
                            pct.value = String(Math.max(0, (parseFloat(pct.value) || 0) + d));
                            echar();
                        }, ocT("{n} puntos", { n: (d > 0 ? ocT("Subir ") : ocT("Bajar ")) + Math.abs(d) })));
                    });
                    form.addEventListener("submit", (e) => {
                        e.preventDefault();
                        echar();
                    });
                    form.append(et, pct, rapidos, queda);
                    echar();
                    cuerpo.append(precios, form);
                } else {
                    cuerpo.appendChild(PM.crear("p", "oc-hoja-nota", ocT("No tiene precio: lo pone el DM.")));
                }
                cuerpo.appendChild(PM.crear("p", "oc-hoja-nota master-fuente", datos.fuente || ""));
                window.ocVentana.abrir({ titulo: o.nombre, cuerpo, vuelta, clase: "es-regla" });
            }

            function pintar() {
                const veces = porcentaje();
                const salen = filtrados(true);
                todo.hidden = !m.datos.surtido;
                cuerpo.replaceChildren(...salen.slice(0, 100).map((x) => {
                    const tr = PM.crear("tr");
                    const td = PM.crear("td");
                    const b = PM.botonDe("master-tienda-nombre", x.o.nombre, () => ficha(x.o, b));
                    b.setAttribute("aria-haspopup", "dialog");
                    td.appendChild(b);
                    const extra = [x.o.cat, x.o.rareza, x.o.sint ? ocT("requiere sintonía") : "", x.o.det, x.o.peso, x.o.nota]
                        .filter(Boolean).join(" · ");
                    td.appendChild(PM.crear("span", "master-tienda-datos", extra));
                    const tdP = PM.crear("td", "es-precio", x.o.cp ? PM.moneda(x.o.cp * veces) : "—");
                    tr.append(td, tdP);
                    return tr;
                }));
                cuantos.textContent = (m.datos.surtido ? ocT("Surtido de hoy: ") : "") + (salen.length
                    ? salen.length + (salen.length === 1 ? ocT(" objeto") : ocT(" objetos")) + (salen.length > 100 ? ocT(" (salen los 100 primeros)") : "")
                    : ocT("Nada con eso."));
            }

            const alCambiar = () => {
                m.datos.tienda = tienda.value;
                m.datos.rareza = rareza.value;
                m.datos.porc = parseFloat(precio.value) || 0;
                delete m.datos.precio;
                PM.guardar();
                pintar();
            };
            tienda.addEventListener("change", () => {
                categorias();
                alCambiar();
            });
            [cat, rareza].forEach((c) => c.addEventListener("change", alCambiar));
            precio.addEventListener("input", alCambiar);
            let espera = 0;
            buscar.addEventListener("input", () => {
                clearTimeout(espera);
                espera = setTimeout(pintar, 150);
            });
            categorias();
            dentro.replaceChildren(campos, surtidoFila, cuantos, tabla, PM.crear("p", "oc-hoja-nota master-fuente", datos.fuente || ""));
            pintar();
        }).catch(() => {
            dentro.replaceChildren(PM.crear("p", "oc-vacio", ocT("No he podido abrir la tienda.")));
        });
    }

    Object.assign(PM, { montarTienda });
})();
