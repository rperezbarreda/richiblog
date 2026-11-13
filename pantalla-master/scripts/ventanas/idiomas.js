// =========================================
// LA VENTANA «idiomas» de la pantalla de máster (sale de
// pantalla-master.js; se carga antes que él). Lo que usa del núcleo,
// por window.ocPM («PM.algo»); lo que el núcleo usa de aquí, a PM al final.
// =========================================
(function () {
    const PM = window.ocPM = window.ocPM || {};

    const NOTAS_AL_AZAR = [
        ocT("Nos vemos en {taberna} cuando suene la {hora} campanada. Ven solo."),
        ocT("{nombre} sabe lo que hiciste. Paga {numero} piezas de oro o hablará."),
        ocT("La entrada está bajo {pueblo}. No pises la tercera losa."),
        ocT("Aquí yace {nombre}, que entró sin llamar."),
        ocT("Prohibido el paso. Los intrusos serán devorados."),
        ocT("El cargamento cruza {region} dentro de {numero} días. Que nadie lo vea."),
        ocT("Si lees esto, ya es tarde."),
        ocT("No te fíes de {nombre}. Lleva el anillo."),
        ocT("{nombre}: la llave está en {mazmorra}. Quema esta nota."),
        ocT("Tres pasos al norte, dos al este, y cava."),
        ocT("Hemos perdido a {numero}. Los túneles cambian de sitio."),
        ocT("Por orden de {nombre}, nadie sale de {pueblo} hasta la luna nueva."),
        ocT("Lo que duerme bajo {region} no debe despertar."),
        ocT("Debo {numero} monedas en {taberna}. Si no vuelvo, que las pague {nombre}."),
        ocT("Al portador: dadle cama, comida y silencio."),
        ocT("Cuidado: el puente no aguanta a más de dos."),
        ocT("La puerta solo se abre a quien dice su nombre verdadero."),
        ocT("{nombre} no murió en {mazmorra}. Lo he visto en {pueblo}."),
    ];

    function notaAlAzar(nombres) {
        const lugar = (t) => PM.lugarDe(nombres, t);
        return PM.alAzar(NOTAS_AL_AZAR).replace(/\{(\w+)\}/g, (x, que) => {
            if (que === "nombre") {
                return PM.nombreDe(nombres, PM.alAzar(Object.keys(nombres.especies)), "cualquiera", PM.alAzar([true, false]));
            }
            if (que === "numero") {
                return String(PM.alAzar([2, 3, 5, 7, 12, 20, 50, 100]));
            }
            if (que === "hora") {
                return PM.alAzar([ocT("primera"), ocT("tercera"), ocT("sexta"), ocT("novena"), ocT("duodécima")]);
            }
            return nombres.lugares[que] ? lugar(que) : x;
        });
    }

    // La nota escrita en una imagen PNG (para enseñarla o pasarla).
    function notaEnImagen(texto, idioma, familia) {
        const tam = 44;
        const fuente = tam + "px \"" + familia + "\", \"Pangolin\", sans-serif";
        return document.fonts.load(fuente, texto).then(() => {
            const lienzo = document.createElement("canvas");
            const ctx = lienzo.getContext("2d");
            ctx.font = fuente;
            const ancho = 900;
            const lineas = [];
            texto.split("\n").forEach((parrafo) => {
                let linea = "";
                parrafo.split(" ").forEach((p) => {
                    const prueba = linea ? linea + " " + p : p;
                    if (linea && ctx.measureText(prueba).width > ancho) {
                        lineas.push(linea);
                        linea = p;
                    } else {
                        linea = prueba;
                    }
                });
                lineas.push(linea);
            });
            const alto = Math.round(tam * 1.6);
            lienzo.width = ancho + 120;
            lienzo.height = lineas.length * alto + 120;
            ctx.fillStyle = "#efe2bf";
            ctx.fillRect(0, 0, lienzo.width, lienzo.height);
            ctx.strokeStyle = "#8a6a3a";
            ctx.lineWidth = 6;
            ctx.strokeRect(12, 12, lienzo.width - 24, lienzo.height - 24);
            ctx.fillStyle = "#3b2a17";
            ctx.font = fuente;
            ctx.textBaseline = "top";
            lineas.forEach((l, i) => ctx.fillText(l, 60, 60 + i * alto));
            return new Promise((hecho) => lienzo.toBlob(hecho, "image/png"));
        }).then((blob) => {
            const a = PM.crear("a");
            const archivoBlob = URL.createObjectURL(blob);
            a.href = archivoBlob;
            a.download = "nota-" + idioma.id + ".png";
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(archivoBlob), 1000);
            PM.avisar(ocT("Descargada la imagen: {download}.", { download: a.download }));
        });
    }

    // El alfabeto de referencia de un idioma: cada letra con su símbolo.
    // El símbolo, escondido al lector de pantalla (no dice nada); la
    // letra, no.
    function claveDe(idioma, clase) {
        const lista = PM.crear("ul", "master-idioma-clave " + clase + " es-" + idioma.id);
        lista.setAttribute("aria-label", ocT("Alfabeto {toLowerCase}", { toLowerCase: idioma.nombre.toLowerCase() }));
        const glifos = Array.from(idioma.glifos || "");
        "abcdefghijklmnopqrstuvwxyzñ".split("").forEach((letra, i) => {
            const li = PM.crear("li", "master-idioma-letra");
            const g = PM.crear("span", "master-idioma-glifo", glifos[i] || "");
            g.setAttribute("aria-hidden", "true");
            li.append(g, PM.crear("span", "master-idioma-latina", letra));
            lista.appendChild(li);
        });
        return lista;
    }

    function montarIdiomas(dentro, m) {
        m.datos = m.datos || {};
        dentro.appendChild(PM.crear("p", "oc-hoja-nota", ocT("Cargando…")));
        Promise.all([PM.pedir(PM.IDIOMAS), PM.pedir(PM.NOMBRES)]).then(([datos, nombres]) => {
            const d = m.datos;
            const de = (id) => datos.idiomas.find((x) => x.id === id) || datos.idiomas[1];
            const idioma = PM.elegirDe("master-idioma-que-" + m.id, ocT("idioma"),
                datos.idiomas.map((x) => [x.id, x.nombre + " (" + x.alfabeto + ")"]), de(d.idioma).id);
            const como = PM.botonesDe(ocT("cómo se escribe"), [["letras", ocT("🔤 letra a letra")], ["inventado", ocT("🗣️ palabras inventadas")]],
                d.como || "letras", (v) => {
                    d.como = v;
                    PM.guardar();
                    pintar();
                });
            como.title = ocT("Letra a letra: se puede descifrar. Palabras inventadas: cada palabra pasa a una de ese idioma.");
            const etT = PM.crear("label", "oc-dados-etiqueta", ocT("lo que pone"));
            const texto = PM.crear("textarea", "oc-notas-texto es-corta");
            texto.id = "master-idioma-texto-" + m.id;
            texto.rows = 3;
            texto.value = d.texto || "";
            etT.htmlFor = texto.id;
            const azar = PM.botonDe("oc-vida-accion", ocT("🎲 nota al azar"), () => {
                texto.value = notaAlAzar(nombres);
                d.texto = texto.value;
                PM.guardar();
                pintar();
                PM.avisar(ocT("Nota nueva: {value}", { value: texto.value }));
            });
            const hoja = PM.crear("div", "master-idioma-hoja");
            hoja.setAttribute("role", "img");
            const dice = PM.crear("p", "master-idioma-dice");
            const ver = PM.crear("label", "master-nombres-apellido");
            const verCaja = PM.crear("input");
            verCaja.type = "checkbox";
            verCaja.checked = d.ver !== false;
            ver.append(verCaja, document.createTextNode(ocT(" ver lo que pone debajo")));
            const tam = d.tam || 2;
            hoja.style.setProperty("--tam", tam + "rem");
            const cambiaTam = (mas) => {
                d.tam = Math.min(4, Math.max(1, (d.tam || 2) + mas));
                hoja.style.setProperty("--tam", d.tam + "rem");
                PM.guardar();
                PM.avisar(ocT("Tamaño {round} %.", { round: Math.round(d.tam * 50) }));
            };
            const menos = PM.botonDe("master-nombre-boton", ocT("A−"), () => cambiaTam(-0.25), ocT("Letra más pequeña"));
            const mas = PM.botonDe("master-nombre-boton", ocT("A+"), () => cambiaTam(0.25), ocT("Letra más grande"));
            const escrito = () => {
                const id = de(idioma.elegir.value);
                const palabras = (d.como || "letras") === "inventado" ? PM.inventar(texto.value, id) : texto.value;
                return { id, palabras, letras: PM.aSuAlfabeto(palabras, id) };
            };
            const ensenar = PM.botonDe("oc-vida-accion es-principal", ocT("👁️ enseñar"), () => {
                const e = escrito();
                const grande = PM.crear("div", "master-idioma-hoja es-grande es-" + e.id.id);
                grande.textContent = e.letras;
                grande.setAttribute("role", "img");
                grande.setAttribute("aria-label", ocT("Nota en {nombre}. Pone: {value}", { nombre: e.id.nombre, value: texto.value }));
                window.ocVentana.abrir({ titulo: ocT("Nota en {toLowerCase}", { toLowerCase: e.id.nombre.toLowerCase() }), cuerpo: grande, vuelta: ensenar,
                    clase: "es-ancha" });
            }, ocT("Enseñar la nota en grande"));
            const copiar = PM.botonDe("oc-vida-accion", ocT("⧉ copiar"), () => PM.copiarTexto(escrito().letras, ocT("Copiada la nota.")),
                ocT("Copiar la nota en su alfabeto"));
            const imagen = PM.botonDe("oc-vida-accion", ocT("🖼️ imagen"), () => {
                const e = escrito();
                notaEnImagen(e.letras || " ", e.id, e.id.glifos ? ocT("Richi {fuente}", { fuente: e.id.fuente }) : "Pangolin")
                    .catch(() => PM.avisar(ocT("No se ha podido hacer la imagen.")));
            }, ocT("Descargar la nota como imagen"));
            const clave = PM.crear("div", "master-idioma-panel");
            clave.id = "master-idioma-clave-" + m.id;
            const verClave = PM.botonDe("oc-vida-accion", ocT("🔑 alfabeto"), () => {
                d.clave = !d.clave;
                PM.guardar();
                pintar();
            }, ocT("Alfabeto de referencia"));
            verClave.setAttribute("aria-controls", clave.id);
            const pintarClave = (id) => {
                verClave.hidden = !id.glifos;
                verClave.setAttribute("aria-expanded", String(!!d.clave));
                clave.hidden = !d.clave || !id.glifos;
                if (clave.hidden) {
                    clave.replaceChildren();
                    return;
                }
                const grande = PM.botonDe("oc-vida-accion", ocT("👁️ enseñar el alfabeto"), () => {
                    window.ocVentana.abrir({ titulo: ocT("Alfabeto {toLowerCase} ({alfabeto})", { toLowerCase: id.nombre.toLowerCase(), alfabeto: id.alfabeto }),
                        cuerpo: claveDe(id, "es-grande"), vuelta: grande, clase: "es-ancha" });
                });
                clave.replaceChildren(claveDe(id, ""), grande);
                if (Array.from(new Set(Array.from(id.glifos))).length < 27) {
                    clave.insertBefore(PM.crear("p", "oc-hoja-nota", ocT("Este alfabeto tiene menos símbolos: algunas letras comparten el mismo.")),
                        grande);
                }
            };
            const pintar = () => {
                const e = escrito();
                pintarClave(e.id);
                hoja.className = "master-idioma-hoja es-" + e.id.id;
                hoja.textContent = e.letras || "…";
                hoja.setAttribute("aria-label", ocT("Nota en {nombre} ({alfabeto}). Pone: {n}", { nombre: e.id.nombre, alfabeto: e.id.alfabeto, n: texto.value || ocT("nada todavía") }));
                dice.replaceChildren();
                if (verCaja.checked && texto.value) {
                    dice.append(PM.crear("strong", "", ocT("Pone: ")), document.createTextNode(texto.value));
                    if (e.palabras !== texto.value) {
                        dice.append(PM.crear("br"), PM.crear("strong", "", ocT("Suena: ")), document.createTextNode(e.palabras));
                    }
                }
                dice.hidden = !dice.childNodes.length;
            };
            let espera = 0;
            texto.addEventListener("input", () => {
                pintar();
                clearTimeout(espera);
                espera = setTimeout(() => {
                    d.texto = texto.value;
                    PM.guardar();
                }, 400);
            });
            idioma.elegir.addEventListener("change", () => {
                d.idioma = idioma.elegir.value;
                PM.guardar();
                pintar();
            });
            verCaja.addEventListener("change", () => {
                d.ver = verCaja.checked;
                PM.guardar();
                pintar();
            });
            const arriba = PM.crear("div", "master-nombres-form");
            arriba.append(idioma, como);
            const escribir = PM.crear("div", "master-idioma-escribir");
            escribir.append(etT, texto, azar);
            const tamanos = PM.crear("div", "master-idioma-tam");
            tamanos.setAttribute("role", "group");
            tamanos.setAttribute("aria-label", ocT("Tamaño de la letra"));
            tamanos.append(menos, mas);
            const botones = PM.crear("div", "master-idioma-botones");
            botones.append(ensenar, copiar, imagen, verClave, tamanos);
            dentro.replaceChildren(arriba, escribir, hoja, ver, dice, botones, clave);
            pintar();
        }).catch(() => {
            dentro.replaceChildren(PM.crear("p", "oc-vacio", ocT("No he podido cargar los idiomas.")));
        });
    }

    Object.assign(PM, { montarIdiomas });
})();
