// =========================================
// LA VENTANA «taberna» de la pantalla de máster (sale de
// pantalla-master.js; se carga antes que él). Lo que usa del núcleo,
// por window.ocPM («PM.algo»); lo que el núcleo usa de aquí, a PM al final.
// =========================================
(function () {
    const PM = window.ocPM = window.ocPM || {};

    // ---- NEGOCIOS: tabernas y posadas, tiendas y servicios, según lo
    // buenos que sean (pobre, modesta, acomodada, lujosa): nombre (del
    // generador o con el nombre de quien lo lleva), ambiente, quién está
    // al frente (un PNJ rápido), lo que vende con su precio, servicios y
    // un gancho. La taberna, con su carta, sus habitaciones y un rumor
    // (master-tablas.json, «taberna»); las tiendas venden los objetos del
    // SRD de tienda.json (lo de su tienda, hasta un tope según lo buenas
    // que sean; la de magia, hasta una rareza) y el resto es de tablas
    // propias (master-tablas.json, «negocios»). Se copia, se guarda como
    // texto o como imagen. ----
    const ESTILO_EN = { miserable: "Squalid", pobre: "Poor", modesta: "Modest", "cómoda": "Comfortable", rica: "Wealthy",
        "aristocrática": "Aristocratic" };
    function descargarArchivo(blob, archivo) {
        const a = PM.crear("a");
        const archivoBlob = URL.createObjectURL(blob);
        a.href = archivoBlob;
        a.download = archivo;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(archivoBlob), 1000);
        PM.avisar(ocT("Descargado: {archivo}.", { archivo: archivo }));
    }

    const precioDe = (cp) => (cp ? PM.moneda(cp) : ocT("a convenir"));

    // Un negocio de antes (sólo taberna, en m.datos.taberna) al de ahora.
    function negocioDeTaberna(x) {
        return {
            tipo: "taberna", calidad: x.calidad, nombre: x.nombre, emoji: "🍺", ambiente: x.ambiente, quien: x.quien,
            destacado: [ocT("⭐ Especialidad de la casa:"), x.especialidad[0] + " — " + PM.moneda(x.especialidad[1])],
            secciones: [{ titulo: ocT("🍷 Bebidas"), filas: x.bebidas }, { titulo: ocT("🍲 Comidas"), filas: x.comidas },
                { titulo: ocT("🛏️ Habitaciones (por noche)"), filas: x.habitaciones }],
            gancho: [ocT("👂 Se oye que"), x.rumor + "."],
        };
    }

    function negocioEnTexto(x, nombreTipo) {
        const lineas = [x.nombre + " — " + nombreTipo + " (" + x.calidad + ")", "",
            x.ambiente.charAt(0).toUpperCase() + x.ambiente.slice(1) + ".", ocT("Al frente: {quien}.", { quien: x.quien })];
        if (x.destacado) {
            lineas.push("", x.destacado.join(" "));
        }
        x.secciones.forEach((s) => {
            lineas.push("", s.titulo.replace(/^\S+\s/u, "").toUpperCase());
            s.filas.forEach(([n, cp, extra]) => lineas.push("· " + n + ": " + precioDe(cp) + (extra ? " (" + extra + ")" : "")));
        });
        lineas.push("", x.gancho.join(" "));
        return lineas.join("\n");
    }

    // La ficha en un canvas de colores fijos (pergamino), para bajarla.
    function negocioEnLienzo(x, nombreTipo) {
        const lienzo = PM.crear("canvas");
        const ctx = lienzo.getContext("2d");
        const ancho = 820;
        const margen = 54;
        const util = ancho - margen * 2;
        const letra = (tam, estilo) => estilo + " " + tam + "px Georgia, 'Times New Roman', serif";
        const pasos = [];
        let y = margen;
        const trocear = (texto, max) => {
            const salen = [];
            let linea = "";
            texto.split(" ").forEach((p) => {
                const prueba = linea ? linea + " " + p : p;
                if (linea && ctx.measureText(prueba).width > max) {
                    salen.push(linea);
                    linea = p;
                } else {
                    linea = prueba;
                }
            });
            salen.push(linea);
            return salen;
        };
        const parrafo = (texto, tam, estilo, color) => {
            ctx.font = letra(tam, estilo);
            trocear(texto, util).forEach((l) => {
                pasos.push({ texto: l, x: margen, y, font: ctx.font, color });
                y += Math.round(tam * 1.4);
            });
        };
        parrafo(x.emoji + " " + x.nombre, 34, "bold", "#3b2a17");
        parrafo(nombreTipo + " · " + x.calidad, 18, "italic", "#6b4e2a");
        y += 10;
        parrafo(ocT("{n}. Al frente: {quien}.", { n: x.ambiente.charAt(0).toUpperCase() + x.ambiente.slice(1), quien: x.quien }), 18, "normal", "#3b2a17");
        if (x.destacado) {
            y += 6;
            parrafo(x.destacado.join(" "), 18, "bold", "#3b2a17");
        }
        x.secciones.forEach((s) => {
            y += 18;
            parrafo(s.titulo, 22, "bold", "#7a1f12");
            pasos.push({ raya: true, y: y - 4 });
            y += 6;
            s.filas.forEach(([n, cp, extra]) => {
                ctx.font = letra(18, "bold");
                const precio = precioDe(cp);
                const anchoPrecio = ctx.measureText(precio).width;
                ctx.font = letra(18, "normal");
                const lineas = trocear(n, util - anchoPrecio - 24);
                pasos.push({ texto: precio, x: ancho - margen, y, font: letra(18, "bold"), color: "#3b2a17", derecha: true });
                lineas.forEach((l) => {
                    pasos.push({ texto: l, x: margen, y, font: letra(18, "normal"), color: "#3b2a17" });
                    y += 26;
                });
                if (extra) {
                    ctx.font = letra(15, "italic");
                    trocear(extra, util - anchoPrecio - 24).forEach((l) => {
                        pasos.push({ texto: l, x: margen + 14, y, font: ctx.font, color: "#6b4e2a" });
                        y += 21;
                    });
                }
                y += 4;
            });
        });
        y += 14;
        parrafo(x.gancho.join(" "), 18, "italic", "#3b2a17");
        lienzo.width = ancho;
        lienzo.height = y + margen;
        ctx.fillStyle = "#efe2bf";
        ctx.fillRect(0, 0, lienzo.width, lienzo.height);
        ctx.strokeStyle = "#8a6a3a";
        ctx.lineWidth = 6;
        ctx.strokeRect(14, 14, lienzo.width - 28, lienzo.height - 28);
        ctx.textBaseline = "top";
        pasos.forEach((p) => {
            if (p.raya) {
                ctx.strokeStyle = "#8a6a3a";
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(margen, p.y);
                ctx.lineTo(ancho - margen, p.y);
                ctx.stroke();
                return;
            }
            ctx.font = p.font;
            ctx.fillStyle = p.color;
            ctx.textAlign = p.derecha ? "right" : "left";
            ctx.fillText(p.texto, p.x, p.y);
        });
        return lienzo;
    }

    // Servicios de lanzamiento de conjuros (SRD 5.2), en pc, por nivel.
    const PRECIO_CONJURO = [3000, 5000, 20000, 30000, 200000, 200000, 2000000, 2000000, 2000000, 10000000];

    function montarNegocio(dentro, m) {
        m.datos = m.datos || {};
        dentro.appendChild(PM.crear("p", "oc-hoja-nota", ocT("Cargando…")));
        Promise.all([PM.pedir(PM.TABLAS), PM.pedir(PM.NOMBRES), PM.pedir(PM.TIENDA), PM.pedir(PM.CONJUROS_SRD)]).then(([tablas, nombres, tienda, conjuros]) => {
            const d = m.datos;
            if (d.taberna && !d.negocio) {
                d.negocio = negocioDeTaberna(d.taberna);
                delete d.taberna;
            }
            const t = tablas.taberna;
            const N = tablas.negocios;
            const tipo = PM.elegirDe("master-negocio-tipo-" + m.id, ocT("qué negocio"),
                Object.keys(N.tipos).map((k) => [k, N.tipos[k].emoji + " " + N.tipos[k].nombre]), d.tipo || "taberna");
            tipo.elegir.addEventListener("change", () => {
                d.tipo = tipo.elegir.value;
                PM.guardar();
            });
            const calidad = PM.botonesDe(ocT("lo bueno que es"), Object.keys(N.calidades).map((k) => [k, PM.verDato(k)]),
                d.calidad || "modesta", (v) => {
                    d.calidad = v;
                    PM.guardar();
                });
            const etCal = PM.crear("p", "oc-dados-etiqueta", ocT("lo bueno que es"));
            etCal.setAttribute("aria-hidden", "true");
            const sale = PM.crear("div", "master-negocio");
            sale.setAttribute("aria-live", "polite");
            const variosDe = (lista, n) => {
                const copia = lista.slice();
                const salen = [];
                while (copia.length && salen.length < n) {
                    salen.push(copia.splice(PM.tiradaSuelta("1d" + copia.length) - 1, 1)[0]);
                }
                return salen;
            };
            const objetoDe = (nombre) => (tienda.objetos || []).find((o) => o.nombre === nombre);
            const conjuroDe = (en) => (conjuros.conjuros || []).find((c) => c.en === en);
            const fila = (o) => [o.nombre, o.cp, PM.verDato(o.rareza) || "", "o"];
            const asalariados = { cualificado: "Skilled Hireling", sin: "Untrained Hireling", mensajero: "Messenger" };
            // Los servicios: asalariados y conjuros (tabla «Servicios de
            // lanzamiento de conjuros» del SRD, más lo que cueste el
            // componente), hasta el nivel que haya según lo bueno que sea.
            const servicios = (tp, nivel) => {
                const filas = (tp.asalariados || []).map((k) => (tienda.objetos || []).find((o) => o.en === asalariados[k]))
                    .filter(Boolean).map(fila);
                (tp.conjuros || []).map(conjuroDe).filter((c) => c && c.nivel <= nivel).forEach((c) => {
                    const componente = /(\d[\d.]*) po/.exec(c.comp || "");
                    const extra = componente ? Number(componente[1].replace(/\./g, "")) * 100 : 0;
                    filas.push([ocT("Lanzar {nombre}", { nombre: c.nombre }), PRECIO_CONJURO[c.nivel] + extra, (c.nivel ? ocT("nivel {nivel}", { nivel: c.nivel }) : "truco") +
                        (extra ? ocT("; con el componente ({moneda})", { moneda: PM.moneda(extra) }) : ""), "c:" + c.en]);
                });
                return filas;
            };
            const generar = () => {
                const k = tipo.elegir.value;
                const tp = N.tipos[k];
                const cal = calidad.valor();
                const nc = N.calidades[cal];
                const g = PM.alAzar(["f", "m"]);
                const especie = PM.alAzar(Object.keys(nombres.especies));
                const dueno = PM.nombreDe(nombres, especie, g, false);
                const quien = ocT("{dueno} ({nombre}), que {alAzar}", { dueno: dueno, nombre: nombres.especies[especie].nombre, alAzar: PM.alAzar(tablas.pnj.rasgos) });
                const caro = (a, b) => a.cp - b.cp;
                if (k === "taberna") {
                    const tc = t.calidades[cal];
                    const deLaTaberna = (tienda.objetos || []).filter((o) => (o.tiendas || []).includes("Taberna"));
                    // Las comidas y las noches de posada, sólo las de su nivel
                    // (por el nombre en inglés: el otro cambia con el idioma).
                    const deSuNivel = (o) => !/^(Meal|Inn Stay) - /.test(o.en || "") ||
                        tc.estilos.some((e) => (o.en || "").endsWith(" - " + ESTILO_EN[e]));
                    const fino = cal === "acomodada" || cal === "lujosa";
                    const comer = deLaTaberna.filter((o) => o.cat !== "alojamiento" && deSuNivel(o) && (fino || o.en !== "Fine Wine (bottle)"))
                        .sort(caro).map(fila);
                    const dormir = deLaTaberna.filter((o) => o.cat === "alojamiento" && deSuNivel(o)).sort(caro).map(fila);
                    const rumor = PM.alAzar(t.rumores);
                    d.negocio = {
                        tipo: k, calidad: cal, nombre: PM.lugarDe(nombres, "taberna"), emoji: tp.emoji, ambiente: PM.alAzar(tc.ambiente), quien,
                        destacado: null, secciones: [{ titulo: ocT("🍺 Comida y bebida"), filas: comer },
                            { titulo: ocT("🛏️ Alojamiento (por noche)"), filas: dormir },
                            { titulo: ocT("🛠️ Servicios"), filas: servicios(tp, nc.nivel) }],
                        gancho: [ocT("👂 Se oye que"), rumor + "."],
                    };
                } else {
                    let nombre;
                    if (PM.alAzar([0, 1])) {
                        const [sust, gs] = PM.alAzar(tp.sust);
                        nombre = PM.nombreConAdjetivo(sust, gs, PM.alAzar(nombres.lugares.taberna.adj));
                    } else {
                        nombre = PM.alAzar(tp.plantillas).replace("{d}", dueno);
                    }
                    const secciones = [];
                    const hay = (tienda.objetos || []).filter((o) => o.cp && (tp.objetos ? tp.objetos.includes(o.nombre)
                        : (o.tiendas || []).includes(tp.tienda)) && (k === "magia"
                        ? PM.RAREZAS.indexOf(o.rareza) > -1 && PM.RAREZAS.indexOf(o.rareza) < nc.rareza : !nc.tope || o.cp <= nc.tope));
                    if (hay.length) {
                        secciones.push({ titulo: ocT("🛒 Lo que vende"), filas: variosDe(hay, nc.cuantos).sort(caro).map(fila) });
                    }
                    const sv = servicios(tp, nc.nivel);
                    if (sv.length) {
                        secciones.push({ titulo: ocT("🛠️ Servicios"), filas: sv });
                    }
                    const gancho = PM.alAzar(tp.ganchos);
                    d.negocio = {
                        tipo: k, calidad: cal, nombre, emoji: tp.emoji, ambiente: PM.alAzar(tp.ambiente) + "; " + PM.alAzar(nc.ambiente), quien,
                        destacado: null, secciones, gancho: [ocT("🪝 Gancho:"), gancho.charAt(0).toUpperCase() + gancho.slice(1) + "."],
                    };
                }
                PM.guardar();
                pintar();
                PM.avisar(tp.nombre.charAt(0).toUpperCase() + tp.nombre.slice(1) + ": " + d.negocio.nombre + ".");
            };
            const nombreTipo = () => (N.tipos[(d.negocio || {}).tipo] || N.tipos.taberna).nombre;
            const carta = (s) => {
                const sec = PM.crear("div", "master-negocio-carta");
                sec.appendChild(PM.crear("h4", "master-negocio-titulo", s.titulo));
                const dl = PM.crear("dl", "master-negocio-lista");
                s.filas.forEach(([n, cp, extra, ref]) => {
                    const dt = PM.crear("dt");
                    const c = typeof ref === "string" && ref.startsWith("c:") ? conjuroDe(ref.slice(2)) : null;
                    const o = !c && ref ? objetoDe(n) : null;
                    if (c) {
                        const ver = PM.botonDe("master-botin-objeto", n, () => PM.abrirConjuro(c, ver, conjuros.fuente), ocT("Ver el conjuro {nombre}", { nombre: c.nombre }));
                        dt.appendChild(ver);
                    } else if (o) {
                        const ver = PM.botonDe("master-botin-objeto", n, () => PM.abrirObjeto(o, ver, tienda.fuente), ocT("Ver {n}", { n: n }));
                        dt.appendChild(ver);
                    } else {
                        dt.textContent = n;
                    }
                    if (extra) {
                        dt.appendChild(PM.crear("span", "master-negocio-extra", extra));
                    }
                    dl.append(dt, PM.crear("dd", "", precioDe(cp)));
                });
                sec.appendChild(dl);
                return sec;
            };
            const acciones = PM.crear("div", "master-negocio-acciones");
            function pintar() {
                const x = d.negocio;
                sale.replaceChildren();
                acciones.hidden = !x;
                if (!x) {
                    sale.appendChild(PM.crear("p", "oc-vacio", ocT("Elige el negocio, cómo es y pulsa «generar».")));
                    return;
                }
                const cab = PM.crear("h3", "master-negocio-nombre", x.emoji + " " + x.nombre);
                const sub = PM.crear("p", "master-negocio-tipo", nombreTipo() + " · " + x.calidad);
                const amb = PM.crear("p", "master-negocio-ambiente", ocT("{n}. Al frente: {quien}.", { n: x.ambiente.charAt(0).toUpperCase() + x.ambiente.slice(1), quien: x.quien }));
                sale.append(cab, sub, amb);
                if (x.destacado) {
                    const esp = PM.crear("p", "master-negocio-ambiente");
                    esp.append(PM.crear("strong", "", x.destacado[0] + " "), document.createTextNode(x.destacado[1]));
                    sale.appendChild(esp);
                }
                x.secciones.forEach((s) => sale.appendChild(carta(s)));
                const gancho = PM.crear("p", "master-negocio-ambiente");
                gancho.append(PM.crear("strong", "", x.gancho[0] + " "), document.createTextNode(x.gancho[1]));
                sale.appendChild(gancho);
            }
            const archivo = (ext) => (d.negocio.nombre || "negocio").replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase() + "." + ext;
            acciones.append(
                PM.botonDe("oc-vida-accion", ocT("⧉ copiar"), () => PM.copiarTexto(negocioEnTexto(d.negocio, nombreTipo()), ocT("Copiado.")),
                    ocT("Copiar el negocio como texto")),
                PM.botonDe("oc-vida-accion", ocT("📄 guardar como texto"), () => descargarArchivo(new Blob([negocioEnTexto(d.negocio,
                    nombreTipo())], { type: "text/plain;charset=utf-8" }), archivo("txt"))),
                PM.botonDe("oc-vida-accion", ocT("🖼️ guardar como imagen"), () => negocioEnLienzo(d.negocio, nombreTipo())
                    .toBlob((blob) => descargarArchivo(blob, archivo("png")), "image/png")));
            const boton = PM.botonDe("oc-vida-accion es-principal master-nombres-generar", ocT("🎲 generar negocio"), generar);
            const arriba = PM.crear("div", "master-nombres-form");
            arriba.append(tipo, etCal, calidad, boton);
            dentro.replaceChildren(arriba, sale, acciones, PM.crear("p", "oc-hoja-nota master-fuente",
                ocT("Lo que venden, los servicios y sus precios: SRD 5.2 (CC BY 4.0). Nombres, ambientes, rumores y ganchos: tablas propias.")));
            pintar();
        }).catch(() => {
            dentro.replaceChildren(PM.crear("p", "oc-vacio", ocT("No he podido cargar las tablas.")));
        });
    }

    Object.assign(PM, { montarNegocio });
})();
