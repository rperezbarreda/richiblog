// =========================================
// EL EDITOR DE LA WIKI — lo de la página
// =========================================
// Habla con herramientas/1-publicar/editor-wiki.py, que es quien lee y
// escribe los .md. Cuatro vistas (inicio, página nueva, las que faltan y
// escribir) y solo una a la vista; las dos de los mapas están en mapas.js.
// Todo lo que llega del servidor se pone con textContent: un nombre con <
// dentro no es HTML.

const TOKEN_EDITOR = (document.querySelector('meta[name="editor-token"]') || {}).content || "";
const estadoEditor = { datos: null, pagina: null, cambiado: false, guardando: false, quitar: [] };

const $ = (sel, dentro) => (dentro || document).querySelector(sel);

function crearEditor(etiqueta, clase, texto) {
    const el = document.createElement(etiqueta);
    if (clase) {
        el.className = clase;
    }
    if (texto !== undefined) {
        el.textContent = texto;
    }
    return el;
}

async function pedirEditor(ruta, cuerpo) {
    const opciones = { headers: { "X-Editor": TOKEN_EDITOR } };
    if (cuerpo !== undefined) {
        opciones.method = "POST";
        opciones.headers["Content-Type"] = "application/json";
        opciones.body = JSON.stringify(cuerpo);
    }
    try {
        const respuesta = await fetch(ruta, opciones);
        return await respuesta.json();
    } catch (error) {
        return { error: "No hay respuesta del editor. ¿Sigue abierta la ventana donde lo arrancaste?" };
    }
}

function avisarEditor(texto, error, salida) {
    // Editando un mapa, una entrada o unas fichas, los avisos van en la
    // barra de abajo (la que esté a la vista), junto a «Guardar»: arriba
    // empujarían lo de debajo (y, al final de una página larga, no se
    // verían).
    const enBarra = document.querySelector(".barra:not([hidden]) [data-aviso-barra]");
    const aviso = enBarra || $("[data-aviso]");
    document.querySelectorAll("[data-aviso], [data-aviso-barra]").forEach((otro) => {
        if (otro !== aviso) {
            otro.textContent = "";
        }
    });
    aviso.textContent = texto || "";
    aviso.classList.toggle("es-error", !!error);
    if (salida) {
        const mas = crearEditor("details", "salida-mas");
        mas.appendChild(crearEditor("summary", "", "Lo que han dicho las herramientas"));
        mas.appendChild(crearEditor("pre", "salida", salida));
        if (error) {
            mas.open = true;
        }
        aviso.appendChild(mas);
    }
}

function irAEditor(vista) {
    if (vista !== "editar" && estadoEditor.cambiado
        && !window.confirm("Hay cambios sin guardar en esta página. ¿Salir igualmente?")) {
        return;
    }
    // Lo de escribir.js y fichas.js (se cargan después; están si existen).
    const escribiendo = typeof estadoEscribir !== "undefined" ? estadoEscribir : null;
    if (vista !== "entrada" && escribiendo && escribiendo.cambiado
        && !window.confirm("Hay cambios sin guardar en lo que estabas escribiendo. ¿Salir igualmente?")) {
        return;
    }
    const fichas = typeof estadoFichas !== "undefined" ? estadoFichas : null;
    if (vista !== "fichas" && fichas && fichas.cambiado
        && !window.confirm("Hay cambios sin guardar en las fichas. ¿Salir igualmente?")) {
        return;
    }
    if (vista !== "entrada" && escribiendo) {
        escribiendo.cambiado = false;
    }
    if (vista !== "fichas" && fichas) {
        fichas.cambiado = false;
    }
    // El mapa que se está editando (lo lleva mapas.js).
    const mapa = window.estadoMapa;
    if (vista !== "mapa" && mapa && mapa.cambiado
        && !window.confirm("Hay cambios sin guardar en este mapa. ¿Salir igualmente?")) {
        return;
    }
    if (vista !== "editar") {
        estadoEditor.cambiado = false;
    }
    if (vista !== "mapa" && mapa) {
        mapa.cambiado = false;
    }
    document.body.classList.toggle("en-mapa", vista === "mapa");
    const barraMapa = $("[data-barra-mapa]");
    if (barraMapa) {
        barraMapa.hidden = vista !== "mapa";
    }
    document.querySelectorAll("[data-vista]").forEach((v) => {
        v.hidden = v.getAttribute("data-vista") !== vista;
    });
    $("[data-barra]").hidden = vista !== "editar";
    $("[data-barra-entrada]").hidden = vista !== "entrada";
    $("[data-barra-fichas]").hidden = vista !== "fichas";
    document.querySelectorAll(".menu [data-ir]").forEach((b) => {
        if (b.getAttribute("data-ir") === vista) {
            b.setAttribute("aria-current", "page");
        } else {
            b.removeAttribute("aria-current");
        }
    });
    avisarEditor("");
    const titulo = $('[data-vista="' + vista + '"] h1');
    if (titulo) {
        titulo.setAttribute("tabindex", "-1");
        titulo.focus();
    }
    window.scrollTo(0, 0);
}

// ---- PASAR A LA WEB, CON SU BARRA ----
// El servidor pasa la wiki en otro hilo; aquí se le pregunta cómo va cada
// poco y se enseña en una barra (un <progress> de verdad, que lo lee el
// lector de pantalla). Mientras tanto el aviso lleva aria-busy, para que
// el lector no cante cada porcentaje: dice el resultado al final.
// Devuelve lo que devolvía /api/pasar: {ok, salida, url} o {error, salida}.
async function pasarALaWebEditor(cuerpo) {
    const empezado = await pedirEditor("/api/pasar", cuerpo);
    if (empezado.error) {
        return empezado;
    }
    avisarEditor("Guardado. Pasando la wiki a la web…");
    const aviso = !$('[data-vista="mapa"]').hidden && $("[data-aviso-mapa]") ? $("[data-aviso-mapa]") : $("[data-aviso]");
    aviso.setAttribute("aria-busy", "true");
    const caja = crearEditor("div", "progreso");
    const etiqueta = crearEditor("span", "progreso-fase", "Empezando…");
    etiqueta.id = "progreso-fase";
    const barra = document.createElement("progress");
    barra.max = 100;
    barra.value = 0;
    barra.setAttribute("aria-labelledby", "progreso-fase");
    const cifra = crearEditor("span", "progreso-cifra", "0%");
    cifra.setAttribute("aria-hidden", "true");
    caja.appendChild(etiqueta);
    caja.appendChild(barra);
    caja.appendChild(cifra);
    aviso.appendChild(caja);
    const empieza = Date.now();
    let estado = {};
    for (;;) {
        await new Promise((r) => setTimeout(r, 400));
        estado = await pedirEditor("/api/pasar/estado");
        if (estado.error && !("terminado" in estado)) {
            break;
        }
        const porcentaje = Math.max(0, Math.min(100, Number(estado.porcentaje) || 0));
        barra.value = porcentaje;
        cifra.textContent = porcentaje + "%";
        const segundos = Math.round((Date.now() - empieza) / 1000);
        etiqueta.textContent = (estado.fase || "Pasando") + "… (" + segundos + " s)";
        if (estado.terminado && estado.resultado) {
            break;
        }
    }
    aviso.removeAttribute("aria-busy");
    return estado.resultado || estado;
}

// ---- AL EMPEZAR ----
async function empezarEditor() {
    const datos = await pedirEditor("/api/inicio");
    if (datos.error) {
        avisarEditor(datos.error, true);
        return;
    }
    estadoEditor.datos = datos;
    llenarListasEditor();
    pintarTiposEditor();
    pintarFaltanEditor();
    document.querySelectorAll("[data-ir]").forEach((b) => {
        b.addEventListener("click", () => irAEditor(b.getAttribute("data-ir")));
    });
    document.querySelectorAll('[data-ir="wiki"]').forEach((b) => b.addEventListener("click", refrescarArbolWikiEditor));
    $("#wiki-arbol-buscar").addEventListener("input", pintarArbolWikiEditor);
    pintarArbolWikiEditor();
    $("[data-abrir]").addEventListener("submit", (e) => {
        e.preventDefault();
        abrirPaginaEditor($("#abrir-nombre").value);
    });
    $("[data-nueva]").addEventListener("submit", (e) => {
        e.preventDefault();
        crearPaginaEditor();
    });
    $("[data-guardar]").addEventListener("click", () => guardarEditor(false));
    $("[data-pasar]").addEventListener("click", () => guardarEditor(true));
    $("[data-campo-nuevo]").addEventListener("click", anadirCampoEditor);
    $("[data-editar]").addEventListener("input", () => {
        estadoEditor.cambiado = true;
    });
    $("[data-editar]").addEventListener("submit", (e) => e.preventDefault());
    document.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && estadoEditor.pagina
            && !$('[data-vista="editar"]').hidden) {
            e.preventDefault();
            guardarEditor(false);
        }
    });
    window.addEventListener("beforeunload", (e) => {
        if (estadoEditor.cambiado || (window.estadoMapa && window.estadoMapa.cambiado)
            || (typeof estadoEscribir !== "undefined" && estadoEscribir.cambiado)
            || (typeof estadoFichas !== "undefined" && estadoFichas.cambiado)) {
            e.preventDefault();
            e.returnValue = "";
        }
    });
    // «editor-wiki.py --en escribir» (lo que usa el menú) lo abre ya en ese
    // apartado: va detrás de la dirección, con #.
    const vista = decodeURIComponent(location.hash.slice(1)).replace(/[^a-z-]/g, "");
    const ir = vista ? document.querySelector('.menu [data-ir="' + vista + '"]') : null;
    if (ir) {
        ir.click();
    }
}

function llenarListasEditor() {
    const paginas = $("#lista-paginas");
    paginas.textContent = "";
    estadoEditor.datos.paginas.forEach((n) => {
        const o = document.createElement("option");
        o.value = n;
        paginas.appendChild(o);
    });
    const imagenes = $("#lista-imagenes");
    imagenes.textContent = "";
    estadoEditor.datos.imagenes.forEach((n) => {
        const o = document.createElement("option");
        o.value = n;
        imagenes.appendChild(o);
    });
}

// ---- PÁGINA NUEVA ----
function pintarTiposEditor() {
    const caja = $("[data-tipos]");
    caja.textContent = "";
    const visibles = estadoEditor.datos.plantillas.filter((p) => !p.oculta);
    const todos = visibles.concat([{ id: "", nombre: "En blanco", para: "sin plantilla: solo la cabecera y un apartado", preguntas: [] }]);
    todos.forEach((p, i) => {
        const etiqueta = crearEditor("label", "tipo");
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = "tipo";
        radio.value = p.id;
        if (i === 0) {
            radio.checked = true;
        }
        const texto = crearEditor("span");
        texto.appendChild(crearEditor("span", "tipo-nombre", p.nombre));
        texto.appendChild(crearEditor("span", "tipo-para", p.para || ""));
        etiqueta.appendChild(radio);
        etiqueta.appendChild(texto);
        radio.addEventListener("change", () => pintarPreguntasEditor());
        caja.appendChild(etiqueta);
    });
    pintarPreguntasEditor();
}

function plantillaElegidaEditor() {
    const radio = document.querySelector('input[name="tipo"]:checked');
    const id = radio ? radio.value : "";
    document.querySelectorAll(".tipo").forEach((t) => {
        t.classList.toggle("es-elegido", !!t.querySelector("input:checked"));
    });
    return estadoEditor.datos.plantillas.find((p) => p.id === id) || null;
}

function campoTextoEditor(id, texto, ayuda, lista) {
    const caja = crearEditor("div", "campo");
    const etiqueta = crearEditor("label", "", texto);
    etiqueta.htmlFor = id;
    caja.appendChild(etiqueta);
    if (ayuda) {
        const p = crearEditor("p", "ayuda", ayuda);
        p.id = id + "-ayuda";
        caja.appendChild(p);
    }
    const input = document.createElement("input");
    input.id = id;
    input.autocomplete = "off";
    if (ayuda) {
        input.setAttribute("aria-describedby", id + "-ayuda");
    }
    if (lista) {
        input.setAttribute("list", lista);
    }
    caja.appendChild(input);
    return caja;
}

function grupoDeOpcionesEditor(nombre, leyenda, opciones, alCambiar) {
    const grupo = crearEditor("fieldset", "opciones campo");
    grupo.appendChild(crearEditor("legend", "", leyenda));
    opciones.forEach(([valor, texto], i) => {
        const etiqueta = crearEditor("label", "opcion");
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = nombre;
        radio.value = valor;
        radio.checked = i === 0;
        if (alCambiar) {
            radio.addEventListener("change", alCambiar);
        }
        etiqueta.appendChild(radio);
        etiqueta.appendChild(document.createTextNode(texto));
        grupo.appendChild(etiqueta);
    });
    return grupo;
}

function pintarPreguntasEditor() {
    const caja = $("[data-preguntas]");
    caja.textContent = "";
    const p = plantillaElegidaEditor();
    if (!p) {
        // En blanco: la etiqueta (el apartado de la portada) y qué es.
        caja.appendChild(campoTextoEditor("p-_etiqueta", "Etiqueta", "El apartado de la portada: país, lugar, personaje…"));
        caja.appendChild(campoTextoEditor("p-_que", "Qué es, para la ficha", "«Reino», «Ciudad portuaria»…"));
        return;
    }
    if (p.especial === "raza") {
        const razas = estadoEditor.datos.razas;
        const opciones = [["raza", "Una raza (podrá tener subrazas)"]];
        if (razas.length) {
            opciones.push(["de", "Una subraza de una que ya hay"]);
        }
        opciones.push(["nueva", "Una subraza de una raza que aún no existe (se crea también)"]);
        const deCual = campoTextoEditor("p-_raza_de", "¿De qué raza?", "", "lista-razas");
        let lista = $("#lista-razas");
        if (!lista) {
            lista = document.createElement("datalist");
            lista.id = "lista-razas";
            document.body.appendChild(lista);
        }
        lista.textContent = "";
        razas.forEach((r) => {
            const o = document.createElement("option");
            o.value = r;
            lista.appendChild(o);
        });
        deCual.hidden = true;
        const alCambiar = () => {
            const modo = (document.querySelector('input[name="p-_raza_modo"]:checked') || {}).value;
            deCual.hidden = modo === "raza";
            $("label", deCual).textContent = modo === "nueva" ? "¿Cómo se llama la raza nueva?" : "¿De qué raza?";
            $("input", deCual).setAttribute("list", modo === "nueva" ? "" : "lista-razas");
        };
        caja.appendChild(grupoDeOpcionesEditor("p-_raza_modo", "¿Raza o subraza?", opciones, alCambiar));
        caja.appendChild(deCual);
    }
    p.preguntas.forEach((q) => {
        if (q.tipo === "elige") {
            const opciones = q.opciones.map((o) => [o.valor + "|" + o.uno, o.valor]);
            const grupo = grupoDeOpcionesEditor("p-" + q.clave, q.texto, opciones, () => {
                const elegida = (document.querySelector('input[name="p-' + q.clave + '"]:checked') || {}).value || "";
                otro.hidden = !/^otro\|/i.test(elegida);
            });
            const otro = crearEditor("div", "campo");
            otro.hidden = true;
            otro.appendChild(campoTextoEditor("p-" + q.clave + "-otro", "Escríbelo (en plural si es un apartado: «Cometas»)"));
            otro.appendChild(campoTextoEditor("p-" + q.clave + "-uno", "¿Y uno solo cómo se dice? («Cometa»)"));
            caja.appendChild(grupo);
            caja.appendChild(otro);
            otro.hidden = !/^otro$/i.test((q.opciones[0] || {}).valor || "");
        } else {
            const ayuda = q.tipo === "busca"
                ? "Escribe y elige de la lista. Si no existe, se queda escrito sin enlace." : "";
            caja.appendChild(campoTextoEditor("p-" + q.clave, q.texto.replace(/\s*\(.*?\)\s*$/, ""), ayuda,
                "lista-paginas"));
        }
    });
}

function respuestasEditor(p) {
    const r = { _subtitulo: $("#nueva-subtitulo").value.trim() };
    const valor = (id) => {
        const el = document.getElementById(id);
        return el ? el.value.trim() : "";
    };
    if (!p) {
        r._etiqueta = valor("p-_etiqueta");
        r._que = valor("p-_que");
        return r;
    }
    if (p.especial === "raza") {
        r._raza_modo = (document.querySelector('input[name="p-_raza_modo"]:checked') || {}).value || "raza";
        r._raza_de = valor("p-_raza_de");
    }
    p.preguntas.forEach((q) => {
        if (q.tipo === "elige") {
            const elegida = (document.querySelector('input[name="p-' + q.clave + '"]:checked') || {}).value || "";
            let [v, uno] = elegida.split("|");
            if (/^otro$/i.test(v || "")) {
                v = valor("p-" + q.clave + "-otro");
                uno = valor("p-" + q.clave + "-uno") || v;
            }
            r[q.clave] = v || "";
            r[q.clave + "_uno"] = uno || v || "";
        } else {
            r[q.clave] = valor("p-" + q.clave);
        }
    });
    return r;
}

async function crearPaginaEditor() {
    const nombre = $("#nueva-nombre").value.trim();
    if (!nombre) {
        avisarEditor("Hace falta el nombre de la página.", true);
        $("#nueva-nombre").focus();
        return;
    }
    const p = plantillaElegidaEditor();
    const boton = $('[data-nueva] button[type="submit"]');
    boton.disabled = true;
    const hecho = await pedirEditor("/api/crear", {
        nombre, plantilla: p ? p.id : "", respuestas: respuestasEditor(p),
    });
    boton.disabled = false;
    if (hecho.error) {
        avisarEditor(hecho.error, true);
        return;
    }
    estadoEditor.datos.paginas.push(nombre);
    (hecho.tambien || []).forEach((a) => estadoEditor.datos.paginas.push(a.split("/").pop().replace(/\.md$/, "")));
    llenarListasEditor();
    $("[data-nueva]").reset();
    pintarTiposEditor();
    estadoEditor.datos.faltan = estadoEditor.datos.faltan.filter((f) => f.nombre.toLowerCase() !== nombre.toLowerCase());
    pintarFaltanEditor();
    await abrirPaginaEditor(nombre);
    const tambien = (hecho.tambien || []).length ? " (y también " + hecho.tambien.join(", ") + ")" : "";
    avisarEditor("Creada: " + hecho.archivo + tambien + ". Ya puedes escribirla aquí.");
}

// ---- LAS QUE FALTAN ----
function pintarFaltanEditor() {
    const lista = $("[data-faltan]");
    lista.textContent = "";
    if (!estadoEditor.datos.faltan.length) {
        lista.appendChild(crearEditor("li", "", "No falta ninguna: todo lo que se enlaza existe."));
        return;
    }
    estadoEditor.datos.faltan.forEach((f) => {
        const li = document.createElement("li");
        const texto = crearEditor("span");
        texto.appendChild(crearEditor("span", "faltan-nombre", f.nombre));
        texto.appendChild(document.createTextNode(" "));
        texto.appendChild(crearEditor("span", "faltan-veces",
            f.veces === 1 ? "la nombra 1 página" : "la nombran " + f.veces + " páginas"));
        const boton = crearEditor("button", "", "Crearla");
        boton.type = "button";
        boton.setAttribute("aria-label", "Crear " + f.nombre);
        boton.addEventListener("click", () => {
            irAEditor("nueva");
            $("#nueva-nombre").value = f.nombre;
            $("#nueva-nombre").focus();
        });
        li.appendChild(texto);
        li.appendChild(boton);
        lista.appendChild(li);
    });
}

// ---- LAS PÁGINAS, POR CARPETAS ----
// El árbol lo pinta pintarArbolWeb (escribir.js), el mismo de «Escribir».
function pintarArbolWikiEditor() {
    const arbol = (estadoEditor.datos || {}).arbol;
    const lista = $("[data-wiki-arbol]");
    if (!arbol || !lista) {
        return;
    }
    const busca = sinTildesWeb($("#wiki-arbol-buscar").value.trim());
    const vistas = arbol.paginas.filter((p) => !busca || sinTildesWeb(p.nombre).includes(busca));
    $("[data-wiki-arbol-cuantas]").textContent = vistas.length === 1 ? "1 página" : vistas.length + " páginas";
    pintarArbolWeb(lista, vistas.map((p) => ({
        carpeta: p.carpeta ? p.carpeta.split("/") : [],
        fila: () => {
            const li = document.createElement("li");
            li.appendChild(crearEditor("span", "faltan-nombre", p.nombre));
            const b = crearEditor("button", "", "Abrir");
            b.type = "button";
            b.setAttribute("aria-label", "Abrir " + p.nombre);
            b.addEventListener("click", () => abrirPaginaEditor(p.nombre));
            li.appendChild(b);
            return li;
        },
    })), { abrirTodo: !!busca, memoria: "wiki:", unidad: ["página", "páginas"], carpetasPrimero: true, cerradasDeSalida: true,
        vacias: busca ? [] : arbol.carpetas.map((c) => c.split("/")),
        vaciaDice: "Aún no hay ninguna: las nuevas de este tipo vendrán aquí." });
}

// Al volver a la wiki, el árbol al día (puede haber páginas nuevas).
async function refrescarArbolWikiEditor() {
    const datos = await pedirEditor("/api/inicio");
    if (!datos.error) {
        estadoEditor.datos.arbol = datos.arbol;
    }
    pintarArbolWikiEditor();
}

// ---- ESCRIBIR ----
async function abrirPaginaEditor(nombre) {
    nombre = (nombre || "").trim();
    if (!nombre) {
        return;
    }
    const pagina = await pedirEditor("/api/pagina?nombre=" + encodeURIComponent(nombre));
    if (pagina.error) {
        const mas = (pagina.parecidas || []).length ? " ¿Es " + pagina.parecidas.join(", ") + "?" : "";
        avisarEditor(pagina.error + mas, true);
        return;
    }
    estadoEditor.cambiado = false;
    pintarPaginaEditor(pagina);
    irAEditor("editar");
}

function pintarPaginaEditor(pagina) {
    estadoEditor.pagina = pagina;
    $("[data-editar-titulo]").textContent = pagina.nombre;
    $("[data-editar-archivo]").textContent = "En " + pagina.archivo;
    const ver = $("[data-ver]");
    ver.hidden = !pagina.url;
    ver.href = pagina.url || "#";
    if (window.pintarMapasDePagina) {
        window.pintarMapasDePagina(pagina);
    }

    const campos = $("[data-campos]");
    campos.textContent = "";
    estadoEditor.ultimoDato = null;
    const enlazarFicha = enlazarEditor(() => estadoEditor.ultimoDato, "ficha");
    const donde = crearEditor("span", "enlazar-donde", "Primero pulsa la casilla donde va.");
    donde.setAttribute("data-enlazar-donde", "");
    enlazarFicha.appendChild(donde);
    campos.appendChild(enlazarFicha);
    estadoEditor.quitar = [];
    pagina.campos.forEach((c, i) => {
        if (c.fija || c.clave === "title") {
            return;
        }
        let nota = null;
        if (c.nota) {
            nota = campos.appendChild(crearEditor("p", "dato-nota", c.nota));
        }
        const dato = campos.appendChild(datoEditor(c, i));
        dato.notaDelDato = nota;
    });

    const apartados = $("[data-apartados]");
    apartados.textContent = "";
    pagina.apartados.forEach((a, i) => {
        const caja = crearEditor("div", "apartado");
        const id = "apartado-" + i;
        caja.setAttribute("data-apartado-caja", String(i));
        const cab = crearEditor("div", "apartado-cabeza");
        const titulo = crearEditor("label", "apartado-titulo nivel-" + a.nivel,
            a.nivel ? a.titulo : "La entradilla (el primer párrafo)");
        titulo.htmlFor = id;
        cab.appendChild(titulo);
        if (a.nivel) {
            // Quitar el apartado entero (con su título y lo que tenga
            // dentro: los ### de debajo de un ##).
            const quitar = crearEditor("button", "quitar-pequeno", "Quitar");
            quitar.type = "button";
            quitar.setAttribute("aria-label", "Quitar el apartado «" + a.titulo + "»");
            quitar.addEventListener("click", () => quitarApartadoEditor(i));
            cab.appendChild(quitar);
        }
        caja.appendChild(cab);
        let ayuda = a.nota;
        if (!a.nivel && !ayuda) {
            ayuda = "Qué es, en una o dos frases. Es lo que sale en la portada y en el buscador.";
        }
        if (ayuda) {
            const nota = crearEditor("p", "apartado-nota", ayuda);
            nota.id = id + "-nota";
            caja.appendChild(nota);
        }
        const area = document.createElement("textarea");
        area.id = id;
        area.value = a.texto;
        area.setAttribute("data-apartado", String(i));
        area.rows = Math.min(18, Math.max(4, a.texto.split("\n").length + 2));
        if (ayuda) {
            area.setAttribute("aria-describedby", id + "-nota");
        }
        // Encima, los botones de formato (los mismos que en las entradas,
        // pero poniendo el Markdown de la wiki).
        caja.appendChild(crearBarraMarkdown(area, a.nivel ? a.titulo : "la entradilla", () => {
            estadoEditor.cambiado = true;
        }));
        caja.appendChild(area);
        caja.appendChild(enlazarEditor(area, id));
        apartados.appendChild(caja);
    });
}

function datoEditor(c, i) {
    const caja = crearEditor("div", "dato");
    const id = "dato-" + i;
    const cab = crearEditor("div", "dato-cabeza");
    const etiqueta = crearEditor("label", "", c.nombre);
    etiqueta.htmlFor = id;
    cab.appendChild(etiqueta);
    // Quitar el dato de la ficha (la línea del .md entera, no dejarlo vacío).
    const quitar = crearEditor("button", "quitar-pequeno", "Quitar");
    quitar.type = "button";
    quitar.setAttribute("aria-label", "Quitar el dato «" + c.nombre + "» de la ficha");
    quitar.addEventListener("click", () => quitarDatoEditor(caja, c));
    cab.appendChild(quitar);
    caja.appendChild(cab);
    const input = document.createElement("input");
    input.id = id;
    input.value = c.valor;
    input.autocomplete = "off";
    input.setAttribute("data-clave", c.clave);
    if (c.imagen) {
        input.setAttribute("list", "lista-imagenes");
    }
    caja.appendChild(input);
    if (c.imagen) {
        caja.appendChild(subirImagenEditor(input, c.clave, id));
    } else if (!["subtitle", "infobox", "tags"].includes(c.clave)) {
        // El enlace de la ficha se pone con el buscador de arriba, en la
        // última casilla en la que se haya escrito.
        input.addEventListener("focus", () => {
            estadoEditor.ultimoDato = input;
            const donde = $("[data-enlazar-donde]");
            if (donde) {
                donde.textContent = "Irá en: " + c.nombre;
            }
        });
    }
    return caja;
}

// Un trocito para poner un [[enlace]] donde está el cursor: se escribe el
// nombre (con la lista de las páginas que hay) y «Poner enlace».
function enlazarEditor(dondeVa, id) {
    // dondeVa: la casilla o el recuadro, o una función que diga cuál (el
    // de la ficha sirve para todas sus casillas).
    const destinoDe = () => (typeof dondeVa === "function" ? dondeVa() : dondeVa);
    const cursores = new WeakMap();
    const caja = crearEditor("div", "enlazar");
    const idBusca = id + "-enlace";
    const etiqueta = crearEditor("label", "", "Enlazar una página:");
    etiqueta.htmlFor = idBusca;
    const busca = document.createElement("input");
    busca.id = idBusca;
    busca.setAttribute("list", "lista-paginas");
    busca.autocomplete = "off";
    const boton = crearEditor("button", "", "Poner enlace");
    boton.type = "button";
    // Dónde estaba el cursor en cada casilla al salir de ella: el enlace va
    // ahí y no al final.
    const apuntar = (e) => {
        cursores.set(e.target, [e.target.selectionStart, e.target.selectionEnd]);
    };
    if (typeof dondeVa !== "function") {
        ["keyup", "click", "select", "blur"].forEach((t) => dondeVa.addEventListener(t, apuntar));
    } else {
        ["keyup", "click", "select", "blur"].forEach((t) => document.addEventListener(t, (e) => {
            if (e.target instanceof HTMLInputElement && e.target.hasAttribute("data-clave")) {
                apuntar(e);
            }
        }, true));
    }
    const poner = () => {
        const destino = destinoDe();
        const nombre = busca.value.trim().replace(/^\[\[|\]\]$/g, "");
        if (!destino) {
            avisarEditor("Primero pulsa la casilla de la ficha donde va el enlace.", true);
            return;
        }
        if (!nombre) {
            busca.focus();
            return;
        }
        const cursor = cursores.get(destino);
        const [a, b] = cursor || [destino.value.length, destino.value.length];
        const elegido = destino.value.slice(a, b);
        // Si había un trozo de texto elegido, se queda como lo que se lee:
        // [[Valderín|la ciudad]].
        const enlace = elegido && elegido !== nombre ? "[[" + nombre + "|" + elegido + "]]" : "[[" + nombre + "]]";
        destino.value = destino.value.slice(0, a) + enlace + destino.value.slice(b);
        const fin = a + enlace.length;
        destino.focus();
        destino.setSelectionRange(fin, fin);
        cursores.set(destino, [fin, fin]);
        busca.value = "";
        estadoEditor.cambiado = true;
        avisarEditor("Enlace puesto: " + enlace);
    };
    boton.addEventListener("click", poner);
    busca.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            poner();
        }
    });
    caja.appendChild(etiqueta);
    caja.appendChild(busca);
    caja.appendChild(boton);
    return caja;
}

function subirImagenEditor(input, clave, id) {
    const caja = crearEditor("div", "dato-imagen");
    const muestra = document.createElement("img");
    muestra.alt = "";
    const verMuestra = () => {
        const v = input.value.trim();
        const limpio = /^[\w\-. ]+\.(webp|png|jpe?g|gif|svg)$/i.test(v) ? v : "";
        muestra.hidden = !limpio;
        if (limpio) {
            const enBanderas = /^(bandera|blasón|blason|escudo)$/i.test(clave);
            muestra.src = "/wiki/_imagenes/" + (enBanderas ? "banderas/" : "") + encodeURIComponent(limpio);
            muestra.onerror = () => {
                if (enBanderas && !muestra.dataset.otra) {
                    muestra.dataset.otra = "1";
                    muestra.src = "/wiki/_imagenes/" + encodeURIComponent(limpio);
                } else {
                    muestra.hidden = true;
                }
            };
        }
    };
    input.addEventListener("change", verMuestra);
    verMuestra();
    caja.appendChild(muestra);

    const subir = crearEditor("div", "subir");
    const archivo = document.createElement("input");
    archivo.type = "file";
    archivo.accept = "image/*";
    archivo.id = id + "-subir";
    const etiqueta = crearEditor("label", "boton", "Subir una imagen de tu ordenador");
    etiqueta.htmlFor = archivo.id;
    subir.appendChild(archivo);
    subir.appendChild(etiqueta);
    caja.appendChild(subir);

    const ruta = crearEditor("div", "fila");
    const idRuta = id + "-ruta";
    const etRuta = crearEditor("label", "", "…o pega su ruta (e:\\Descargas\\mapa.png):");
    etRuta.htmlFor = idRuta;
    const campoRuta = document.createElement("input");
    campoRuta.id = idRuta;
    campoRuta.autocomplete = "off";
    const traer = crearEditor("button", "", "Traerla");
    traer.type = "button";
    ruta.appendChild(etRuta);
    ruta.appendChild(campoRuta);
    ruta.appendChild(traer);
    caja.appendChild(ruta);

    const hecha = (respuesta) => {
        if (respuesta.error) {
            avisarEditor(respuesta.error, true);
            return;
        }
        input.value = respuesta.nombre;
        estadoEditor.cambiado = true;
        if (!estadoEditor.datos.imagenes.includes(respuesta.nombre)) {
            estadoEditor.datos.imagenes.push(respuesta.nombre);
            llenarListasEditor();
        }
        verMuestra();
        avisarEditor("Imagen lista: " + respuesta.nombre + " (" + (respuesta.aviso || "") + "). Recuerda guardar.");
    };
    archivo.addEventListener("change", () => {
        const elegido = archivo.files && archivo.files[0];
        if (!elegido) {
            return;
        }
        avisarEditor("Preparando la imagen…");
        const lector = new FileReader();
        lector.onload = async () => {
            hecha(await pedirEditor("/api/imagen", {
                campo: clave, pagina: estadoEditor.pagina.nombre, archivo: elegido.name, datos: lector.result,
            }));
            archivo.value = "";
        };
        lector.readAsDataURL(elegido);
    });
    traer.addEventListener("click", async () => {
        if (!campoRuta.value.trim()) {
            campoRuta.focus();
            return;
        }
        avisarEditor("Trayendo la imagen…");
        hecha(await pedirEditor("/api/imagen", {
            campo: clave, pagina: estadoEditor.pagina.nombre, ruta: campoRuta.value.trim(),
        }));
        campoRuta.value = "";
    });
    return caja;
}

// ---- QUITAR UN DATO O UN APARTADO ----
// Se ven quitados al momento y se quitan del .md al guardar. El foco pasa
// a lo siguiente (o a lo de antes), no al principio de la página.
function quitarDatoEditor(caja, c) {
    const siguiente = caja.nextElementSibling && caja.nextElementSibling.querySelector("input")
        ? caja.nextElementSibling.querySelector("input")
        : (caja.previousElementSibling && caja.previousElementSibling.querySelector
            && caja.previousElementSibling.querySelector("input"));
    if (!estadoEditor.quitar.includes(c.clave)) {
        estadoEditor.quitar.push(c.clave);
    }
    if (caja.notaDelDato) {
        caja.notaDelDato.remove();
    }
    caja.remove();
    estadoEditor.cambiado = true;
    avisarEditor("Quitado «" + c.nombre + "». Se va del todo al guardar (para volver atrás, cierra sin guardar"
        + " o añádelo otra vez abajo).");
    if (siguiente) {
        siguiente.focus();
    }
}

function quitarApartadoEditor(i) {
    const aps = estadoEditor.pagina.apartados;
    const nivel = aps[i].nivel;
    // Los de dentro: los que vienen detrás con más nivel.
    const dentro = [];
    for (let j = i + 1; j < aps.length && aps[j].nivel > nivel; j += 1) {
        dentro.push(j);
    }
    const nombres = dentro.map((j) => aps[j].titulo).filter((t, k) => document.querySelector('[data-apartado-caja="'
        + dentro[k] + '"]'));
    if (!window.confirm("¿Quitar el apartado «" + aps[i].titulo + "» con todo su texto"
        + (nombres.length ? " (y lo que tiene dentro: " + nombres.join(", ") + ")" : "") + "?")) {
        return;
    }
    let despues = null;
    [i].concat(dentro).forEach((j) => {
        const caja = document.querySelector('[data-apartado-caja="' + j + '"]');
        if (caja) {
            despues = caja.nextElementSibling || despues;
            caja.remove();
        }
    });
    estadoEditor.cambiado = true;
    avisarEditor("Quitado «" + aps[i].titulo + "». Se va del .md al guardar.");
    const foco = (despues && despues.isConnected ? despues : document.querySelector("[data-apartados] .apartado:last-child"));
    const area = foco && foco.querySelector("textarea");
    if (area) {
        area.focus();
    }
}

function anadirCampoEditor() {
    const clave = $("#campo-nuevo-clave");
    const nombre = clave.value.trim().replace(/:/g, "");
    if (!nombre || !estadoEditor.pagina) {
        clave.focus();
        return;
    }
    if (document.querySelector('[data-clave="' + CSS.escape(nombre) + '"]')) {
        avisarEditor("Ese dato ya está en la ficha.", true);
        return;
    }
    // Si se había quitado, ya no se quita: vuelve.
    estadoEditor.quitar = estadoEditor.quitar.filter((q) => q !== nombre);
    const c = { clave: nombre, valor: "", nombre: nombre[0].toUpperCase() + nombre.slice(1), imagen: false };
    const caja = datoEditor(c, "nuevo-" + Date.now());
    $("[data-campos]").appendChild(caja);
    clave.value = "";
    $("input", caja).focus();
}

async function guardarEditor(yPasar) {
    if (!estadoEditor.pagina || estadoEditor.guardando) {
        return;
    }
    estadoEditor.guardando = true;
    const botones = document.querySelectorAll("[data-guardar], [data-pasar]");
    botones.forEach((b) => {
        b.disabled = true;
    });
    const campos = {};
    document.querySelectorAll("[data-clave]").forEach((el) => {
        campos[el.getAttribute("data-clave")] = el.value;
    });
    // Uno por apartado de los que había; null, el que se ha quitado.
    const apartados = estadoEditor.pagina.apartados.map(() => null);
    document.querySelectorAll("[data-apartado]").forEach((el) => {
        apartados[Number(el.getAttribute("data-apartado"))] = el.value;
    });
    const quitado = estadoEditor.quitar.length > 0 || apartados.some((a) => a === null);
    avisarEditor("Guardando…");
    const hecho = await pedirEditor("/api/guardar", { nombre: estadoEditor.pagina.nombre, campos, apartados,
        quitar: estadoEditor.quitar });
    if (hecho.error) {
        avisarEditor(hecho.error, true);
    } else {
        estadoEditor.cambiado = false;
        estadoEditor.pagina = hecho.pagina;
        if (quitado) {
            // Lo quitado cambia los números de los apartados: se pinta otra
            // vez desde lo guardado.
            const y = window.scrollY;
            pintarPaginaEditor(hecho.pagina);
            window.scrollTo(0, y);
        }
        if (!yPasar) {
            avisarEditor("Guardado en " + hecho.pagina.archivo + ".");
        } else {
            const pasado = await pasarALaWebEditor({ nombre: estadoEditor.pagina.nombre });
            if (pasado.error) {
                avisarEditor(pasado.error, true, pasado.salida);
            } else {
                const ver = $("[data-ver]");
                ver.hidden = !pasado.url;
                ver.href = pasado.url || "#";
                avisarEditor(pasado.url ? "Guardado y pasado a la web. Ya puedes verla con «Ver cómo queda»."
                    : "Guardado y pasado a la web.", false, pasado.salida);
            }
        }
    }
    botones.forEach((b) => {
        b.disabled = false;
    });
    estadoEditor.guardando = false;
}

empezarEditor();
