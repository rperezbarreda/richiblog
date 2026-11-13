// =========================================
// LA VENTANA «documento» de la pantalla de máster (sale de
// pantalla-master.js; se carga antes que él). Lo que usa del núcleo,
// por window.ocPM («PM.algo»); lo que el núcleo usa de aquí, a PM al final.
// =========================================
(function () {
    const PM = window.ocPM = window.ocPM || {};

    const tamanoBonito = (b) => (b > 1048576 ? ocT("{replace} MB", { replace: (b / 1048576).toFixed(1).replace(".", ",") }) : ocT("{max} KB", { max: Math.max(1, Math.round(b / 1024)) }));
    // Una dirección para un enlace: https, o un blob: del propio
    // navegador (los archivos subidos); si no, a ninguna parte.
    function direccionSegura(h) {
        return /^blob:https?:\/\/[^\s"'<>]+$/.test(String(h || "")) ? h : PM.urlImagenSegura(h) || "#";
    }

    // Lo de dentro de un archivo o un enlace: la imagen (con su texto
    // alternativo, el nombre), o el PDF en un marco (los subidos: el visor
    // del navegador) y, siempre, abrirlo en otra pestaña y descargarlo.
    function montarArchivoDoc(n) {
        const caja = PM.crear("div", "master-doc-archivo");
        const mandos = PM.crear("div", "master-docs-botones");
        const enlace = (texto, href, etiqueta, descargar) => {
            const a = PM.crear("a", "oc-vida-accion", texto);
            a.href = direccionSegura(href);
            if (descargar) {
                a.download = descargar;
            } else {
                a.target = "_blank";
                a.rel = "noopener noreferrer";
            }
            a.setAttribute("aria-label", etiqueta);
            return a;
        };
        if (n.tipo === "enlace") {
            const u = PM.urlImagenSegura(n.url);
            if (!u) {
                caja.appendChild(PM.crear("p", "oc-vacio", ocT("La dirección no vale.")));
                return caja;
            }
            if (n.clase === "pdf") {
                caja.appendChild(PM.crear("p", "oc-hoja-nota", ocT("Los PDF de otras webs no se pueden ver aquí dentro: se abren en otra pestaña.")));
            } else {
                const img = PM.crear("img", "master-doc-imagen");
                img.alt = n.titulo;
                img.referrerPolicy = "no-referrer";
                img.loading = "lazy";
                img.src = PM.urlImagenSegura(n.url);
                img.addEventListener("error", () => img.replaceWith(PM.crear("p", "oc-vacio", ocT("No se ha podido cargar la imagen."))));
                caja.appendChild(img);
            }
            mandos.appendChild(enlace(ocT("↗ abrir el original"), u, ocT("Abrir {titulo} en otra pestaña", { titulo: n.titulo })));
            caja.appendChild(mandos);
            return caja;
        }
        caja.appendChild(PM.crear("p", "oc-hoja-nota", ocT("Cargando…")));
        PM.archivoLeer(n.archivo).then((blob) => {
            if (!blob) {
                caja.replaceChildren(PM.crear("p", "oc-vacio", ocT("El archivo no está en este navegador (¿se importó sin él, o se borró?).")));
                return;
            }
            // Una dirección blob: que hace el propio navegador con el archivo.
            const archivoBlob = URL.createObjectURL(blob);
            const esPdf = /pdf/.test(blob.type || n.mime || "");
            caja.replaceChildren();
            if (esPdf && PM.EN_ANDROID) {
                caja.appendChild(PM.crear("p", "oc-hoja-nota", ocT("En la tablet, el PDF se abre con su visor: «↗ abrir».")));
            } else if (esPdf) {
                const marco = PM.crear("iframe", "master-doc-pdf");
                marco.title = ocT("PDF: {titulo}", { titulo: n.titulo });
                marco.src = archivoBlob;
                caja.appendChild(marco);
            } else {
                const img = PM.crear("img", "master-doc-imagen");
                img.alt = n.titulo;
                img.src = archivoBlob;
                caja.appendChild(img);
            }
            const ext = esPdf ? ".pdf" : "." + ((blob.type.split("/")[1] || "png").replace("jpeg", "jpg").replace("svg+xml", "svg"));
            mandos.append(PM.EN_ANDROID ? enlace(ocT("↗ abrir"), archivoBlob, ocT("Abrir {titulo} con otra app", { titulo: n.titulo }))
                : enlace(ocT("↗ abrir en otra pestaña"), archivoBlob, ocT("Abrir {titulo} en otra pestaña", { titulo: n.titulo })),
                enlace(ocT("⬇ descargar"), archivoBlob, ocT("Descargar {titulo}", { titulo: n.titulo }), (n.titulo || "archivo").replace(/[^\p{L}\p{N} _-]+/gu, "") + ext));
            caja.appendChild(mandos);
        }).catch(() => caja.replaceChildren(PM.crear("p", "oc-vacio", ocT("Este navegador no deja leer los archivos guardados."))));
        return caja;
    }

    // UNA NOTA, en su ventana: el título, en qué carpeta va y lo escrito
    // (con la barra de formato). Se guarda sola.
    function montarDocumento(dentro, m) {
        m.datos = m.datos || {};
        const n = PM.docsDe().notas.find((x) => x.id === m.datos.nota && x.tipo !== "dibujo");
        const esNota = n && n.tipo !== "archivo" && n.tipo !== "enlace";
        // Para el lector, qué es (dos con el mismo nombre no se confunden).
        const h2 = m.el && m.el.querySelector(".master-ventana-titulo");
        if (n && h2 && !h2.querySelector(".visually-hidden")) {
            h2.appendChild(PM.crear("span", "visually-hidden", n.tipo === "enlace" ? ocT(" (enlace)") : n.tipo === "archivo"
                ? (/pdf/.test(n.mime || "") ? ocT(" (PDF)") : ocT(" (imagen)")) : ocT(" (nota)")));
        }
        if (!n) {
            dentro.appendChild(PM.crear("p", "oc-vacio", ocT("Esta nota ya no está (se ha borrado, o es de otra campaña).")));
            return;
        }
        const uid = "master-doc-" + m.id;
        const fila = PM.crear("div", "master-doc-cabeza");
        const etT = PM.crear("label", "oc-dados-etiqueta", ocT("título"));
        const titulo = PM.crear("input", "oc-dados-texto");
        titulo.id = uid + "-titulo";
        titulo.value = n.titulo;
        titulo.maxLength = 80;
        titulo.autocomplete = "off";
        etT.htmlFor = titulo.id;
        const cajaT = PM.crear("div", "master-campo");
        cajaT.append(etT, titulo);
        const carpeta = PM.elegirDe(uid + "-carpeta", ocT("carpeta"), PM.opcionesCarpetas([]), n.carpeta || "");
        fila.append(cajaT, carpeta);
        const cuando = PM.crear("p", "oc-hoja-nota master-doc-cuando");
        const pintarCuando = () => {
            cuando.textContent = ocT("{n} · en 📁 {rutaDe}{n2}", { n: (esNota ? ocT("Cambiada: ") : ocT("Añadido: ")) + new Date(n.cambiada || Date.now()).toLocaleString("es-ES",
                { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }), rutaDe: PM.rutaDe(n.carpeta), n2: n.tamano ? " · " + tamanoBonito(n.tamano) : "" });
        };
        pintarCuando();
        let espera = 0;
        if (!esNota) {
            const ver = montarArchivoDoc(n);
            titulo.addEventListener("input", () => {
                n.titulo = titulo.value.trim() || ocT("sin nombre");
                m.titulo = n.titulo;
                PM.ponerTitulo(m);
                clearTimeout(espera);
                espera = setTimeout(() => {
                    PM.guardar();
                    PM.avisarDocs();
                }, 400);
            });
            carpeta.elegir.addEventListener("change", () => {
                n.carpeta = carpeta.elegir.value || null;
                pintarCuando();
                PM.guardar();
                PM.avisarDocs();
                PM.avisar(ocT("Ahora en: {rutaDe}.", { rutaDe: PM.rutaDe(n.carpeta) }));
            });
            dentro.append(fila, cuando, ver);
            return;
        }
        const { area, barra, leer } = PM.editorRico(ocT("Lo que pone la nota {titulo} (se guarda sola)", { titulo: n.titulo }), () => {
            clearTimeout(espera);
            espera = setTimeout(() => {
                n.html = leer();
                n.cambiada = Date.now();
                pintarCuando();
                PM.guardar();
                PM.avisarDocs();
            }, 500);
        });
        area.classList.add("es-notas");
        area.innerHTML = PM.sanearHtml(n.html) || "<p><br></p>";
        titulo.addEventListener("input", () => {
            n.titulo = titulo.value.trim() || ocT("nota sin título");
            n.cambiada = Date.now();
            m.titulo = n.titulo;
            PM.ponerTitulo(m);
            clearTimeout(espera);
            espera = setTimeout(() => {
                PM.guardar();
                PM.avisarDocs();
            }, 400);
        });
        carpeta.elegir.addEventListener("change", () => {
            n.carpeta = carpeta.elegir.value || null;
            n.cambiada = Date.now();
            pintarCuando();
            PM.guardar();
            PM.avisarDocs();
            PM.avisar(ocT("Ahora en: {rutaDe}.", { rutaDe: PM.rutaDe(n.carpeta) }));
        });
        // Si cambian las carpetas (en «documentos»), el desplegable al día.
        PM.mientrasEste(dentro, "master:documentos", () => {
            if (!PM.docsDe().notas.includes(n)) {
                dentro.replaceChildren(PM.crear("p", "oc-vacio", ocT("Esta nota se ha borrado.")));
                return;
            }
            const valor = n.carpeta || "";
            carpeta.elegir.replaceChildren(...PM.opcionesCarpetas([]).map(([v, t]) => {
                const o = PM.crear("option", "", t);
                o.value = v;
                return o;
            }));
            carpeta.elegir.value = valor;
        });
        dentro.append(fila, cuando, barra, area);
    }

    Object.assign(PM, { montarDocumento });
})();
