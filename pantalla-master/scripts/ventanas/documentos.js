// =========================================
// LA VENTANA «documentos» de la pantalla de máster (sale de
// pantalla-master.js; se carga antes que él). Lo que usa del núcleo,
// por window.ocPM («PM.algo»); lo que el núcleo usa de aquí, a PM al final.
// =========================================
(function () {
    const PM = window.ocPM = window.ocPM || {};

    // El texto de una nota (sin formato), para buscar.
    function textoDeHtml(html) {
        const t = document.createElement("template");
        t.innerHTML = PM.sanearHtml(html);
        return (t.content.textContent || "").replace(/\s+/g, " ").trim();
    }
    // Todas las carpetas de dentro (para no meter una carpeta en sí misma).
    function dentroDe(idCarpeta) {
        const { carpetas } = PM.docsDe();
        const salen = [idCarpeta];
        for (let i = 0; i < salen.length; i += 1) {
            carpetas.filter((c) => c.padre === salen[i]).forEach((c) => salen.push(c.id));
        }
        return salen;
    }
    const iconoDoc = (n) => (n.tipo === "dibujo" ? "🖼️" : n.tipo === "archivo" ? (/pdf/.test(n.mime || "") ? "📕" : "🏞️")
        : n.tipo === "enlace" ? (n.clase === "pdf" ? "🔗📕" : "🔗🏞️") : "📄");

    function abrirDocumento(id) {
        const n = PM.docsDe().notas.find((x) => x.id === id);
        const esDibujo = n && n.tipo === "dibujo";
        const ya = PM.estado.modulos.find((x) => x.datos && (esDibujo ? x.tipo === "dibujo" && x.datos.doc === id
            : x.tipo === "documento" && x.datos.nota === id));
        if (ya && ya.grupo && !ya.delante) {
            PM.verEnGrupo(ya, false);
        }
        if (ya && ya.el) {
            PM.alFrente(ya);
            ya.el.scrollIntoView({ block: "nearest" });
            PM.focoDe(ya).focus();
            return;
        }
        if (esDibujo) {
            // Una copia, para dibujar en ella (y «📁» la guarda encima).
            PM.anadir("dibujo", { titulo: n.titulo, datos: Object.assign(JSON.parse(JSON.stringify(n.datos || {})), { doc: id }) });
            return;
        }
        PM.anadir("documento", { titulo: n ? n.titulo : "", datos: { nota: id } });
    }

    function montarDocumentos(dentro, m) {
        m.datos = m.datos || {};
        const d = m.datos;
        d.abiertas = Array.isArray(d.abiertas) ? d.abiertas : [];
        const uid = "master-docs-" + m.id;
        // Dónde se crean las nuevas: la carpeta elegida (o la raíz).
        let aqui = d.aqui || null;
        const etBuscar = PM.crear("label", "oc-dados-etiqueta", ocT("buscar en los nombres y en lo escrito"));
        const buscar = PM.crear("input", "oc-dados-texto");
        buscar.type = "search";
        buscar.id = uid + "-buscar";
        buscar.placeholder = ocT("taberna, Elara, deuda…");
        buscar.autocomplete = "off";
        etBuscar.htmlFor = buscar.id;
        const donde = PM.crear("p", "master-docs-donde");
        const nuevaCarpeta = PM.botonDe("oc-vida-accion", ocT("＋ 📁 carpeta"), () => {
            PM.pedirNombreDoc(ocT("carpeta nueva"), "", nuevaCarpeta, (n) => {
                const c = { id: PM.idDoc("c"), nombre: n, padre: aqui };
                PM.docsDe().carpetas.push(c);
                if (aqui && d.abiertas.indexOf(aqui) < 0) {
                    d.abiertas.push(aqui);
                }
                PM.guardar();
                PM.avisarDocs();
                PM.avisar(ocT("Carpeta nueva: {n}.", { n: n }));
            });
        });
        const nuevaNota = PM.botonDe("oc-vida-accion es-principal", ocT("＋ 📄 nota"), () => {
            const n = { id: PM.idDoc("n"), titulo: ocT("nota sin título"), carpeta: aqui, html: "", cambiada: Date.now() };
            PM.docsDe().notas.push(n);
            if (aqui && d.abiertas.indexOf(aqui) < 0) {
                d.abiertas.push(aqui);
            }
            PM.guardar();
            PM.avisarDocs();
            abrirDocumento(n.id);
        });
        // SUBIR imágenes o PDF (uno o varios), a la carpeta de ahora.
        const subir = PM.crear("input");
        subir.type = "file";
        subir.accept = "image/*,application/pdf";
        subir.multiple = true;
        subir.hidden = true;
        const nuevoArchivo = PM.botonDe("oc-vida-accion", ocT("＋ 📎 archivo"), () => subir.click(), ocT("Subir una imagen o un PDF"));
        nuevoArchivo.title = ocT("Una imagen o un PDF de tu ordenador (se guarda en este navegador)");
        subir.addEventListener("change", () => {
            const lista = Array.from(subir.files || []);
            subir.value = "";
            const valen = lista.filter((f) => /^image\/|^application\/pdf$/.test(f.type) && f.size <= PM.MAX_ARCHIVO);
            if (valen.length < lista.length) {
                PM.avisar(ocT("Sólo imágenes y PDF de hasta 50 MB."));
            }
            Promise.all(valen.map((f) => {
                const id = PM.idDoc("a");
                return PM.archivoGuardar(id, f).then(() => {
                    PM.docsDe().notas.push({ id: PM.idDoc("n"), tipo: "archivo", titulo: f.name.replace(/\.[^.]+$/, "") || f.name, carpeta: aqui,
                        archivo: id, mime: f.type, tamano: f.size, cambiada: Date.now() });
                    return f.name;
                });
            })).then((nombres) => {
                if (!nombres.length) {
                    return;
                }
                if (aqui && d.abiertas.indexOf(aqui) < 0) {
                    d.abiertas.push(aqui);
                }
                PM.guardar();
                PM.avisarDocs();
                PM.avisar(ocT("Subido a 📁 {rutaDe}: {join}. Se queda sólo en este navegador: para no perderlo, ⚙ → exportar.", { rutaDe: PM.rutaDe(aqui), join: nombres.join(", ") }));
            }).catch(() => PM.avisar(ocT("No se ha podido guardar el archivo (este navegador no deja, o no cabe).")));
        });
        const botones = PM.crear("div", "master-docs-botones");
        botones.append(nuevaNota, nuevaCarpeta, nuevoArchivo, subir);
        // Dónde se quedan las cosas (no en la web).
        const privado = PM.crear("p", "oc-hoja-nota master-docs-aviso");
        privado.append(PM.crear("strong", "", ocT("🔒 Todo se queda en este navegador: ")),
            document.createTextNode(ocT("las notas, los dibujos y lo que subes no se suben a la web ni los ve nadie más. Tampoco pasan solos a otro ordenador, y se pierden si se borran los datos del navegador: para guardarlos o llevarlos, ⚙ → exportar (y luego importar).")));

        const arbol = PM.crear("div", "master-docs-arbol");
        const cuantos = PM.crear("p", "visually-hidden");
        cuantos.setAttribute("role", "status");

        // Un botón pequeño de las filas (✎ y ✕).
        const mando = (texto, etiqueta, alPulsar) => {
            const b = PM.botonDe("master-docs-mando", texto, alPulsar, etiqueta);
            b.title = etiqueta;
            return b;
        };
        // Borrar pide pulsar dos veces.
        const borrador = (etiqueta, alBorrar) => {
            let seguro = false;
            const b = mando("✕", etiqueta, () => {
                if (!seguro) {
                    seguro = true;
                    b.classList.add("es-seguro");
                    b.setAttribute("aria-label", ocT("¿Seguro? Pulsa otra vez: {etiqueta}", { etiqueta: etiqueta }));
                    PM.avisar(ocT("Pulsa otra vez para borrar."));
                    return;
                }
                alBorrar();
            });
            return b;
        };
        const filaNota = (n, conRuta, trozo) => {
            const li = PM.crear("li", "master-docs-fila es-nota");
            const abrir = PM.botonDe("master-docs-abrir", "", () => abrirDocumento(n.id), ocT("Abrir la nota {titulo}", { titulo: n.titulo }));
            const em = PM.crear("span", "master-docs-icono", iconoDoc(n));
            em.setAttribute("aria-hidden", "true");
            abrir.append(em, PM.crear("span", "master-docs-nombre", n.titulo));
            if (n.tipo === "dibujo") {
                abrir.setAttribute("aria-label", ocT("Abrir el dibujo {titulo}", { titulo: n.titulo }));
            } else if (n.tipo === "archivo" || n.tipo === "enlace") {
                abrir.setAttribute("aria-label", ocT("Abrir {n}{titulo}", { n: n.tipo === "enlace" ? ocT("el enlace ") : (/pdf/.test(n.mime || "")
                    ? ocT("el PDF ") : ocT("la imagen ")), titulo: n.titulo }));
            }
            if (conRuta) {
                abrir.appendChild(PM.crear("span", "master-docs-ruta", PM.rutaDe(n.carpeta)));
            }
            if (trozo) {
                abrir.appendChild(PM.crear("span", "master-docs-trozo", trozo));
            }
            const quitar = borrador(ocT("Borrar la nota {titulo}", { titulo: n.titulo }), () => {
                PM.docsDe().notas = PM.docsDe().notas.filter((x) => x !== n);
                if (n.tipo === "archivo" && n.archivo) {
                    PM.archivoBorrar(n.archivo);
                }
                // Sus ventanas, fuera.
                PM.estado.modulos.filter((x) => x.tipo === "documento" && x.datos && x.datos.nota === n.id).forEach((x) => {
                    x.datos.nota = null;
                });
                PM.estado.modulos.filter((x) => x.datos && x.datos.doc === n.id).forEach((x) => {
                    delete x.datos.doc;
                });
                PM.guardar();
                PM.avisarDocs();
                PM.avisar(ocT("Borrada la nota {titulo}.", { titulo: n.titulo }));
                buscar.focus();
            });
            li.append(abrir, quitar);
            return li;
        };
        const lista = (padre, nivel) => {
            const { carpetas, notas } = PM.docsDe();
            const ul = PM.crear("ul", "master-docs-lista");
            carpetas.filter((c) => (c.padre || null) === padre).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")).forEach((c) => {
                const li = PM.crear("li", "master-docs-fila es-carpeta");
                const abierta = d.abiertas.indexOf(c.id) >= 0;
                const b = PM.botonDe("master-docs-abrir", "", () => {
                    const i = d.abiertas.indexOf(c.id);
                    if (i >= 0 && aqui === c.id) {
                        d.abiertas.splice(i, 1);
                    } else if (i < 0) {
                        d.abiertas.push(c.id);
                    }
                    aqui = c.id;
                    d.aqui = aqui;
                    PM.guardar();
                    pintar(c.id);
                });
                b.setAttribute("aria-expanded", abierta ? "true" : "false");
                b.dataset.carpeta = c.id;
                if (aqui === c.id) {
                    b.setAttribute("aria-current", "true");
                }
                const em = PM.crear("span", "master-docs-icono", abierta ? "📂" : "📁");
                em.setAttribute("aria-hidden", "true");
                const n = notas.filter((x) => x.carpeta === c.id).length;
                b.append(em, PM.crear("span", "master-docs-nombre", c.nombre), PM.crear("span", "master-docs-ruta", n + (n === 1 ? ocT(" documento") : ocT(" documentos"))));
                const cambiar = mando("✎", ocT("Renombrar o mover la carpeta {nombre}", { nombre: c.nombre }), () => {
                    PM.pedirNombreDoc("carpeta", c.nombre, cambiar, (nombre, padreNuevo) => {
                        c.nombre = nombre;
                        c.padre = padreNuevo;
                        PM.guardar();
                        PM.avisarDocs();
                    }, { sin: dentroDe(c.id), valor: c.padre || "" });
                });
                cambiar.setAttribute("aria-haspopup", "dialog");
                const quitar = borrador(ocT("Borrar la carpeta {nombre} (lo de dentro sube un nivel)", { nombre: c.nombre }), () => {
                    const docs = PM.docsDe();
                    docs.carpetas.filter((x) => x.padre === c.id).forEach((x) => {
                        x.padre = c.padre || null;
                    });
                    docs.notas.filter((x) => x.carpeta === c.id).forEach((x) => {
                        x.carpeta = c.padre || null;
                    });
                    docs.carpetas = docs.carpetas.filter((x) => x !== c);
                    if (aqui === c.id) {
                        aqui = c.padre || null;
                        d.aqui = aqui;
                    }
                    PM.guardar();
                    PM.avisarDocs();
                    PM.avisar(ocT("Borrada la carpeta {nombre}; lo de dentro, un nivel más arriba.", { nombre: c.nombre }));
                    buscar.focus();
                });
                li.append(b, cambiar, quitar);
                if (abierta) {
                    li.appendChild(lista(c.id, nivel + 1));
                }
                ul.appendChild(li);
            });
            notas.filter((x) => (x.carpeta || null) === padre).sort((a, b) => a.titulo.localeCompare(b.titulo, "es"))
                .forEach((x) => ul.appendChild(filaNota(x)));
            return ul;
        };
        // Un trozo de lo escrito alrededor de lo que se busca.
        const trozoDe = (texto, q) => {
            let plano = "";
            const mapa = [];
            Array.from(texto).forEach((ch, i) => {
                Array.from(PM.llano(ch)).forEach((x) => {
                    plano += x;
                    mapa.push(i);
                });
            });
            const k = plano.indexOf(q);
            if (k < 0) {
                return "";
            }
            const letras = Array.from(texto);
            const a = Math.max(0, mapa[k] - 40);
            const b = Math.min(letras.length, mapa[Math.min(mapa.length - 1, k + q.length)] + 60);
            return (a ? "…" : "") + letras.slice(a, b).join("") + (b < letras.length ? "…" : "");
        };
        function pintar(foco) {
            const q = PM.llano(buscar.value.trim());
            donde.replaceChildren(PM.crear("strong", "", ocT("Las nuevas van en: ")), document.createTextNode("📁 " + PM.rutaDe(aqui)));
            if (aqui) {
                const raiz = PM.botonDe("master-docs-mando es-texto", ocT("↑ fuera"), () => {
                    aqui = null;
                    d.aqui = null;
                    PM.guardar();
                    pintar();
                }, ocT("Que las nuevas vayan fuera de las carpetas"));
                donde.append(" ", raiz);
            }
            const docs = PM.docsDe();
            if (!q) {
                arbol.replaceChildren(docs.carpetas.length || docs.notas.length ? lista(null, 0)
                    : PM.crear("p", "oc-vacio", ocT("Todavía no hay nada: crea una nota o una carpeta, o sube una imagen o un PDF.")));
                cuantos.textContent = "";
            } else {
                const ul = PM.crear("ul", "master-docs-lista");
                let n = 0;
                docs.carpetas.filter((c) => PM.llano(c.nombre).includes(q)).forEach((c) => {
                    n += 1;
                    const li = PM.crear("li", "master-docs-fila es-carpeta");
                    const b = PM.botonDe("master-docs-abrir", "", () => {
                        // A la carpeta: sin buscar, abierta (y las de fuera).
                        let x = c;
                        while (x) {
                            if (d.abiertas.indexOf(x.id) < 0) {
                                d.abiertas.push(x.id);
                            }
                            x = docs.carpetas.find((y) => y.id === x.padre);
                        }
                        aqui = c.id;
                        d.aqui = aqui;
                        buscar.value = "";
                        PM.guardar();
                        pintar(c.id);
                    });
                    const em = PM.crear("span", "master-docs-icono", "📁");
                    em.setAttribute("aria-hidden", "true");
                    b.append(em, PM.crear("span", "master-docs-nombre", c.nombre), PM.crear("span", "master-docs-ruta", PM.rutaDe(c.padre)));
                    li.appendChild(b);
                    ul.appendChild(li);
                });
                docs.notas.forEach((x) => {
                    const enNombre = PM.llano(x.titulo).includes(q);
                    const trozo = trozoDe(x.tipo === "dibujo" ? (x.datos && x.datos.desc) || "" : x.tipo === "enlace" ? x.url || ""
                        : x.tipo === "archivo" ? "" : textoDeHtml(x.html), q);
                    if (enNombre || trozo) {
                        n += 1;
                        ul.appendChild(filaNota(x, true, trozo));
                    }
                });
                arbol.replaceChildren(n ? ul : PM.crear("p", "oc-vacio", ocT("Nada con eso.")));
                cuantos.textContent = n ? n + (n === 1 ? ocT(" resultado") : ocT(" resultados")) : ocT("Nada con eso.");
            }
            if (foco) {
                const b = arbol.querySelector("[data-carpeta='" + foco + "']");
                if (b) {
                    b.focus();
                }
            }
        }
        let espera = 0;
        buscar.addEventListener("input", () => {
            clearTimeout(espera);
            espera = setTimeout(() => pintar(), 150);
        });
        dentro.append(etBuscar, buscar, botones, privado, donde, cuantos, arbol);
        pintar();
        PM.mientrasEste(dentro, "master:documentos", () => pintar());
    }

    Object.assign(PM, { montarDocumentos });
})();
