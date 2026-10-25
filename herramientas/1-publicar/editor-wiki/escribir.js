// =========================================
// EL EDITOR DE LA WEB — escribir
// =========================================
// Las entradas del blog, los relatos, los días del reto y las notas de las
// partidas: la lista de lo que hay (borradores y publicadas), hacer una
// nueva y escribirla. Habla con herramientas/1-publicar/editor_web.py
// (/api/web/…). El texto se escribe con el editor de redactor.js.
//
// Lo que llega del servidor se pone con textContent; el texto de una
// entrada (que es HTML) pasa antes por limpiarRedactor.

const estadoEscribir = {
    entradas: [], nuevas: null, entrada: null, cambiado: false, guardando: false,
    redactor: null, pie: null, imagen: null, hojas: [], postit: null, ultimaPlantilla: "", tipoNuevo: "",
};
const NOMBRES_DE_LO_NUEVO = {
    entrada: "Una entrada del blog", relato: "Un relato", reto: "Un día del reto", sesion: "Las notas de una partida",
};

// ---- LAS TAREAS LARGAS (crear, publicar, pasar), CON SU BARRA ----
// Si el servidor contesta {tarea: true}, lo que pidió va en otro hilo: se
// le pregunta cada poco cómo va y se enseña en una barra de progreso (un
// <progress> de verdad). Devuelve el resultado al terminar.
function avisoActivoWeb() {
    return document.querySelector(".barra:not([hidden]) [data-aviso-barra]") || $("[data-aviso]");
}

async function seguirTareaWeb(respuesta, texto) {
    if (!respuesta || !respuesta.tarea) {
        return respuesta;
    }
    avisarEditor(texto || "Pasando a la web…");
    const aviso = avisoActivoWeb();
    aviso.setAttribute("aria-busy", "true");
    const caja = crearEditor("div", "progreso");
    const etiqueta = crearEditor("span", "progreso-fase", "Empezando…");
    etiqueta.id = "progreso-fase-web";
    const barra = document.createElement("progress");
    barra.max = 100;
    barra.value = 0;
    barra.setAttribute("aria-labelledby", "progreso-fase-web");
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
        estado = await pedirEditor("/api/web/tarea");
        if (estado.error && !("terminado" in estado)) {
            break;
        }
        const porcentaje = Math.max(0, Math.min(100, Number(estado.porcentaje) || 0));
        barra.value = porcentaje;
        cifra.textContent = porcentaje + "%";
        etiqueta.textContent = (estado.fase || "Pasando") + "… (" + Math.round((Date.now() - empieza) / 1000) + " s)";
        if (estado.terminado && estado.resultado) {
            break;
        }
    }
    aviso.removeAttribute("aria-busy");
    return estado.resultado || estado;
}

// Una imagen elegida en un <input type="file">, subida (pasa por
// imagenes.traer en el servidor). Devuelve {ruta, ancho, alto, aviso} o
// {error}.
async function subirImagenWeb(input, sitio, campos, nombre, mas) {
    const elegido = input.files && input.files[0];
    if (!elegido) {
        return null;
    }
    const datos = await new Promise((r) => {
        const lector = new FileReader();
        lector.onload = () => r(lector.result);
        lector.onerror = () => r("");
        lector.readAsDataURL(elegido);
    });
    return pedirEditor("/api/web/imagen", Object.assign({ sitio, campos: campos || {},
        nombre: nombre || elegido.name.replace(/\.[^.]+$/, ""), archivo: elegido.name, datos }, mas || {}));
}

// Un campo con su etiqueta (y su ayuda) para los formularios de aquí.
function campoWeb(dentro, id, etiqueta, opciones) {
    const o = opciones || {};
    const caja = crearEditor("div", "campo");
    const l = crearEditor("label", "", etiqueta);
    l.htmlFor = id;
    if (o.opcional) {
        l.appendChild(document.createTextNode(" "));
        l.appendChild(crearEditor("span", "opcional", "(opcional)"));
    }
    caja.appendChild(l);
    let ayuda = null;
    if (o.ayuda) {
        ayuda = crearEditor("p", "ayuda", o.ayuda);
        ayuda.id = id + "-ayuda";
        caja.appendChild(ayuda);
    }
    let el;
    if (o.tipo === "largo") {
        el = document.createElement("textarea");
        el.rows = o.filas || 3;
    } else if (o.tipo === "elegir") {
        el = document.createElement("select");
        (o.opciones || []).forEach(([valor, texto]) => {
            const op = document.createElement("option");
            op.value = String(valor);
            op.textContent = texto;
            el.appendChild(op);
        });
    } else {
        el = document.createElement("input");
        el.type = o.tipo || "text";
        el.autocomplete = "off";
        if (o.lista) {
            el.setAttribute("list", o.lista);
        }
    }
    el.id = id;
    if (ayuda) {
        el.setAttribute("aria-describedby", ayuda.id);
    }
    if (o.valor !== undefined && o.valor !== null) {
        el.value = String(o.valor);
    }
    caja.appendChild(el);
    dentro.appendChild(caja);
    return el;
}

function datalistWeb(id, valores) {
    let lista = document.getElementById(id);
    if (!lista) {
        lista = document.createElement("datalist");
        lista.id = id;
        document.body.appendChild(lista);
    }
    lista.textContent = "";
    valores.forEach((v) => {
        const o = document.createElement("option");
        o.value = v;
        lista.appendChild(o);
    });
}

// ---- LA LISTA DE LO QUE HAY ----
async function pintarEscribir() {
    const datos = await pedirEditor("/api/web/entradas");
    if (datos.error) {
        avisarEditor(datos.error, true);
        return;
    }
    estadoEscribir.entradas = datos.entradas;
    estadoEscribir.nuevas = datos.nuevas;
    pintarListaDeEntradas();
}

function pintarListaDeEntradas() {
    const tipo = $("#entradas-tipo").value;
    const estado = $("#entradas-estado").value;
    const busca = sinTildesWeb($("#entradas-buscar").value.trim());
    const vistas = estadoEscribir.entradas.filter((e) => (!tipo || e.tipo === tipo)
        && (!estado || (estado === "borrador") === e.borrador)
        && (!busca || sinTildesWeb(e.titulo).includes(busca)));
    $("[data-entradas-cuantas]").textContent = vistas.length === 1 ? "1 cosa" : vistas.length + " cosas";
    // Buscando o filtrando, las carpetas se abren solas: lo encontrado se ve.
    pintarArbolDeEntradasWeb($("[data-entradas]"), vistas, !!(tipo || estado || busca));
}

// LO QUE HAY, POR CARPETAS, como en el proyecto (web/blog/2026/octubre…):
// cada carpeta se despliega y se cierra, y se acuerda de cómo la dejaste.
// Las carpetas salen en el orden de lo que llevan dentro (lo último
// arriba), así que octubre va antes que septiembre.
const CARPETAS_CERRADAS_WEB = "editor-web-carpetas-cerradas";

function carpetasCerradasWeb() {
    try {
        return new Set(JSON.parse(localStorage.getItem(CARPETAS_CERRADAS_WEB) || "[]"));
    } catch (e) {
        return new Set();
    }
}

function recordarCarpetaWeb(ruta, abierta) {
    const cerradas = carpetasCerradasWeb();
    if (abierta) {
        cerradas.delete(ruta);
    } else {
        cerradas.add(ruta);
    }
    try {
        localStorage.setItem(CARPETAS_CERRADAS_WEB, JSON.stringify([...cerradas]));
    } catch (e) {
        // Sin almacenamiento: se abre todo la próxima vez, y ya.
    }
}

function filaDeEntradaWeb(e) {
    const li = crearEditor("li", "arbol-entrada");
    const texto = crearEditor("span");
    texto.appendChild(crearEditor("span", "faltan-nombre", e.titulo));
    texto.appendChild(document.createTextNode(" "));
    texto.appendChild(crearEditor("span", "faltan-veces", e.que + " · " + (e.fecha_texto || e.fecha)));
    if (e.borrador) {
        texto.appendChild(document.createTextNode(" "));
        texto.appendChild(crearEditor("span", "marca-borrador", "borrador"));
    }
    const boton = crearEditor("button", "", "Abrir");
    boton.type = "button";
    boton.setAttribute("aria-label", "Abrir " + e.titulo);
    boton.addEventListener("click", () => abrirEntradaWeb(e.archivo));
    li.appendChild(texto);
    li.appendChild(boton);
    return li;
}

// lista: el <ul> donde va; entradas: las que se enseñan (en su orden);
// abrirTodo: con todo desplegado (al buscar).
function pintarArbolDeEntradasWeb(lista, entradas, abrirTodo) {
    pintarArbolWeb(lista, entradas.map((e) => ({ carpeta: e.archivo.replace(/^web\//, "").split("/").slice(0, -1),
        fila: () => filaDeEntradaWeb(e) })), { abrirTodo, memoria: "" });
}

// UN ÁRBOL DE CARPETAS PLEGABLES (lo que hay en Escribir, las páginas de la
// wiki). cosas: [{carpeta: ["blog", "2026"], fila: () => <li>}], en su
// orden; las carpetas salen en el orden de lo primero que llevan.
// opciones: abrirTodo (al buscar), memoria (el prefijo con que se
// recuerda lo plegado), vacias (carpetas sin nada que también salen, como
// listas de nombres), unidad ([«cosa», «cosas»]), abrir (carpetas que salen
// abiertas sí o sí, como «Sitios/Capital/»: la de lo elegido).
function pintarArbolWeb(lista, cosas, opciones) {
    const o = opciones || {};
    const unidad = o.unidad || ["cosa", "cosas"];
    lista.textContent = "";
    lista.classList.add("arbol");
    if (!cosas.length && !(o.vacias || []).length) {
        lista.appendChild(crearEditor("li", "ayuda", "Nada con eso."));
        return;
    }
    const raiz = { hijas: new Map(), cosas: [] };
    const bajar = (trozos) => {
        let aqui = raiz;
        trozos.forEach((t) => {
            if (!aqui.hijas.has(t)) {
                aqui.hijas.set(t, { hijas: new Map(), cosas: [] });
            }
            aqui = aqui.hijas.get(t);
        });
        return aqui;
    };
    // Con carpetasPrimero, las carpetas en el orden de «vacias» (las de la
    // wiki, por orden alfabético) y luego lo de dentro.
    if (o.carpetasPrimero) {
        (o.vacias || []).forEach((v) => bajar(v));
    }
    cosas.forEach((c) => bajar(c.carpeta).cosas.push(c));
    (o.vacias || []).forEach((v) => bajar(v));
    const cuantas = (nodo) => nodo.cosas.length + [...nodo.hijas.values()].reduce((n, h) => n + cuantas(h), 0);
    const cerradas = carpetasCerradasWeb();
    const pintar = (nodo, dentro, ruta) => {
        nodo.hijas.forEach((hija, nombre) => {
            const suya = ruta + nombre + "/";
            const li = crearEditor("li", "arbol-carpeta");
            const pliegue = document.createElement("details");
            // Lo apuntado es lo que se ha cambiado de cómo sale: cerrada
            // (o, con cerradasDeSalida, abierta).
            const cambiada = cerradas.has((o.memoria || "") + suya);
            pliegue.open = o.abrirTodo || (o.abrir || []).includes(suya)
                || (o.cerradasDeSalida ? cambiada : !cambiada);
            const cabeza = document.createElement("summary");
            cabeza.className = "arbol-cabeza";
            cabeza.appendChild(iconoRedactor("carpeta"));
            cabeza.appendChild(crearEditor("span", "arbol-nombre", nombre));
            const n = cuantas(hija);
            cabeza.appendChild(crearEditor("span", "faltan-veces", n ? (n === 1 ? "1 " + unidad[0] : n + " " + unidad[1])
                : "vacía"));
            pliegue.appendChild(cabeza);
            const ul = crearEditor("ul", "arbol-dentro");
            pintar(hija, ul, suya);
            if (!n) {
                ul.appendChild(crearEditor("li", "ayuda", o.vaciaDice || "Aún no hay nada aquí."));
            }
            pliegue.appendChild(ul);
            pliegue.addEventListener("toggle", () => {
                if (!o.abrirTodo) {
                    recordarCarpetaWeb((o.memoria || "") + suya, o.cerradasDeSalida ? !pliegue.open : pliegue.open);
                }
            });
            li.appendChild(pliegue);
            dentro.appendChild(li);
        });
        nodo.cosas.forEach((c) => dentro.appendChild(c.fila()));
    };
    pintar(raiz, lista, "");
}

// Las notas de las partidas, en Rol: las mismas de «Escribir», por campaña.
async function pintarNotasDeRolWeb() {
    await pintarEscribir();
    pintarArbolDeEntradasWeb($("[data-notas-rol]"), estadoEscribir.entradas.filter((e) => e.tipo === "sesion"), false);
}

function sinTildesWeb(texto) {
    return (texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// ---- LOS BORRADORES AUTOMÁTICOS ----
// Lo que llevas sin guardar se manda al servidor cada pocos segundos
// (editor_web.apuntar_borrador lo deja en la carpeta temporal del
// ordenador). Al abrir otra vez esa entrada o esa página, si hay uno
// distinto de lo guardado, se ofrece recuperarlo. Al guardar, se borra.
// Hay un hueco por cosa abierta: «entrada» y «wiki».
const BORRADORES_WEB = {};

// recoger: () => los datos sin guardar (o null si no hay nada que apuntar).
function vigilarBorradorWeb(hueco, clave, recoger) {
    BORRADORES_WEB[hueco] = { clave, recoger, ultimo: "" };
}

async function borrarBorradorWeb(hueco) {
    const b = BORRADORES_WEB[hueco];
    if (!b) {
        return;
    }
    b.ultimo = "";
    await pedirEditor("/api/web/borrador", { clave: b.clave, datos: null });
}

setInterval(() => {
    Object.values(BORRADORES_WEB).forEach((b) => {
        let datos = null;
        try {
            datos = b.recoger();
        } catch (e) {
            datos = null;
        }
        if (!datos) {
            return;
        }
        const texto = JSON.stringify(datos);
        if (texto === b.ultimo) {
            return;
        }
        b.ultimo = texto;
        pedirEditor("/api/web/borrador", { clave: b.clave, datos });
    });
}, 5000);

// Si hay un borrador de esto y no es lo que ya está guardado, un aviso
// con «Recuperarlo» (aplicar(datos)) y «Descartarlo».
async function ofrecerBorradorWeb(hueco, caja, actual, aplicar) {
    caja.textContent = "";
    const b = BORRADORES_WEB[hueco];
    if (!b) {
        return;
    }
    const r = await pedirEditor("/api/web/borrador?clave=" + encodeURIComponent(b.clave));
    if (!r.borrador || r.error) {
        return;
    }
    if (JSON.stringify(r.borrador.datos) === JSON.stringify(actual)) {
        borrarBorradorWeb(hueco);
        return;
    }
    const aviso = crearEditor("div", "aviso-borrador");
    aviso.setAttribute("role", "region");
    aviso.setAttribute("aria-label", "Cambios sin guardar");
    aviso.tabIndex = -1;
    aviso.appendChild(crearEditor("p", "", "Hay cambios sin guardar de aquí, del " + r.borrador.cuando
        + " (se cerró la ventana o el editor antes de guardar). ¿Los recuperas?"));
    const fila = crearEditor("div", "fila");
    const si = crearEditor("button", "principal", "Recuperarlos");
    si.type = "button";
    si.addEventListener("click", () => {
        caja.textContent = "";
        aplicar(r.borrador.datos);
        b.ultimo = JSON.stringify(r.borrador.datos);
        avisarEditor("Recuperados. Están sin guardar: guarda cuando quieras.");
    });
    const no = crearEditor("button", "", "Descartarlos");
    no.type = "button";
    no.addEventListener("click", () => {
        caja.textContent = "";
        borrarBorradorWeb(hueco);
        avisarEditor("Descartados: se queda lo guardado.");
    });
    fila.appendChild(si);
    fila.appendChild(no);
    aviso.appendChild(fila);
    caja.appendChild(aviso);
    aviso.focus();
}

// Mientras trabaja, sus botones no se pueden pulsar. Un botón desactivado
// pierde el foco (se iría al principio de la página), así que luego vuelve
// adonde estaba.
function ocuparWeb(botones, ocupado) {
    if (ocupado) {
        ocuparWeb.foco = document.activeElement;
    }
    botones.forEach((b) => {
        b.disabled = ocupado;
    });
    const antes = ocuparWeb.foco;
    if (!ocupado && antes && antes.isConnected && (!document.activeElement || document.activeElement === document.body)) {
        antes.focus();
    }
}

// ---- HACER UNA NUEVA ----
function empezarNuevaWeb(tipo) {
    estadoEscribir.tipoNuevo = tipo;
    const n = estadoEscribir.nuevas || {};
    const form = $("[data-nueva-entrada]");
    form.textContent = "";
    $("[data-nueva-entrada-titulo]").textContent = NOMBRES_DE_LO_NUEVO[tipo];
    const hoy = n.hoy || "";
    if (tipo === "entrada" || tipo === "relato") {
        campoWeb(form, "nueva-e-titulo", "Título", { ayuda: "De aquí sale el nombre del archivo." });
        campoWeb(form, "nueva-e-fecha", "Fecha", { valor: hoy, ayuda: "dd-mm-aaaa." });
        if (tipo === "entrada") {
            datalistWeb("lista-etiquetas-web", n.etiquetas || []);
            campoWeb(form, "nueva-e-etiquetas", "Etiquetas", { lista: "lista-etiquetas-web",
                ayuda: "Separadas por espacios o comas: diario, opiniones… (las que hay: " + (n.etiquetas || []).join(", ") + ")." });
        } else {
            datalistWeb("lista-relatos-web", n.relatos || []);
            campoWeb(form, "nueva-e-sub", "Tipo de relato", { lista: "lista-relatos-web", valor: (n.relatos || [])[0] || "",
                ayuda: "Uno de los que hay (" + (n.relatos || []).join(", ") + ") o uno nuevo: sale su filtro solo." });
        }
        campoWeb(form, "nueva-e-descripcion", "Resumen de una línea", { opcional: true, tipo: "largo", filas: 2,
            ayuda: "Lo que sale al compartir el enlace. Vacío: «el título — El Blog de Richi»." });
        const caja = crearEditor("fieldset", "opciones campo nueva-imagen");
        caja.appendChild(crearEditor("legend", "", "Imagen de la columna de la derecha (opcional)"));
        const subir = crearEditor("div", "subir");
        const archivo = document.createElement("input");
        archivo.type = "file";
        archivo.accept = "image/*";
        archivo.id = "nueva-e-imagen";
        const l = crearEditor("label", "boton", "Elegir la imagen de tu ordenador");
        l.htmlFor = "nueva-e-imagen";
        subir.appendChild(archivo);
        subir.appendChild(l);
        caja.appendChild(subir);
        const elegida = crearEditor("p", "ayuda");
        elegida.setAttribute("aria-live", "polite");
        caja.appendChild(elegida);
        archivo.addEventListener("change", () => {
            elegida.textContent = archivo.files && archivo.files[0] ? "Elegida: " + archivo.files[0].name : "";
        });
        const dentro = crearEditor("div", "nueva-imagen-datos");
        caja.appendChild(dentro);
        campoWeb(dentro, "nueva-e-alt", "Qué se ve", { ayuda: "Para quien no la ve. Vacío si es de adorno." });
        campoWeb(dentro, "nueva-e-pie", "Pie de foto", { opcional: true });
        form.appendChild(caja);
    } else if (tipo === "reto") {
        const dias = ((n.reto || {}).dias || []).filter((d) => !d.escrito);
        if (!dias.length) {
            form.appendChild(crearEditor("p", "aviso", "Están todos los días escritos. Enhorabuena."));
            irAEditor("nueva-entrada");
            return;
        }
        const dia = campoWeb(form, "nueva-r-dia", "Qué día", { tipo: "elegir",
            opciones: dias.map((d) => [d.dia, "Día " + d.dia + " (" + d.fecha + ")" + (d.palabra ? ": " + d.palabra : ", sin palabra")]),
            ayuda: "De salida, el siguiente que falta." });
        const palabra = campoWeb(form, "nueva-r-palabra", "Palabra del día", { ayuda: "Ese día aún no la tiene: escríbela." });
        const titulo = campoWeb(form, "nueva-r-titulo", "Título del texto", { opcional: true, ayuda: "Vacío: la palabra." });
        const ponerPalabra = () => {
            const d = dias.find((x) => String(x.dia) === dia.value);
            palabra.parentNode.hidden = !!(d && d.palabra);
            titulo.placeholder = d && d.palabra ? d.palabra : "";
        };
        dia.addEventListener("change", ponerPalabra);
        ponerPalabra();
    } else if (tipo === "sesion") {
        const campanas = n.campanas || [];
        if (!campanas.length) {
            form.appendChild(crearEditor("p", "aviso", "No hay ninguna campaña (datos/notas_rol/campana-*.json)."));
            irAEditor("nueva-entrada");
            return;
        }
        const campana = campoWeb(form, "nueva-s-campana", "Campaña", { tipo: "elegir",
            opciones: campanas.map((c) => [c.clave, c.nombre]) });
        const numero = campoWeb(form, "nueva-s-numero", "Número de sesión", { tipo: "number" });
        const ponerNumero = () => {
            const c = campanas.find((x) => x.clave === campana.value);
            numero.value = c ? c.siguiente : 1;
        };
        campana.addEventListener("change", ponerNumero);
        ponerNumero();
        campoWeb(form, "nueva-s-fecha", "Qué día se jugó", { valor: hoy, ayuda: "dd-mm-aaaa." });
        campoWeb(form, "nueva-s-titulo", "Nombre de la sesión", { opcional: true,
            ayuda: "Sale detrás: «Sesión 4 — El mercado»." });
        campoWeb(form, "nueva-s-pdf", "Enlace al cuaderno escaneado (PDF)", { opcional: true,
            ayuda: "Si ya lo tienes en Drive. Se puede poner después." });
    }
    const boton = crearEditor("button", "principal", "Hacerla (nace como borrador)");
    boton.type = "submit";
    form.appendChild(boton);
    irAEditor("nueva-entrada");
}

async function crearEntradaWeb() {
    const tipo = estadoEscribir.tipoNuevo;
    const valor = (id) => (document.getElementById(id) ? document.getElementById(id).value.trim() : "");
    let cuerpo = { tipo };
    if (tipo === "entrada" || tipo === "relato") {
        if (!valor("nueva-e-titulo")) {
            avisarEditor("Hace falta un título.", true);
            $("#nueva-e-titulo").focus();
            return;
        }
        cuerpo = Object.assign(cuerpo, { titulo: valor("nueva-e-titulo"), fecha: valor("nueva-e-fecha"),
            etiquetas: valor("nueva-e-etiquetas"), subcategoria: valor("nueva-e-sub"),
            descripcion: valor("nueva-e-descripcion") });
        const archivo = $("#nueva-e-imagen");
        if (archivo.files && archivo.files[0]) {
            avisarEditor("Trayendo la imagen…");
            const anyo = (valor("nueva-e-fecha").match(/(\d{4})$/) || [])[1] || String(new Date().getFullYear());
            const hecha = await subirImagenWeb(archivo, tipo === "entrada" ? "blog" : "relatos", { anyo },
                valor("nueva-e-titulo"));
            if (hecha.error) {
                avisarEditor(hecha.error, true);
                return;
            }
            cuerpo.imagen = { src: hecha.ruta, alt: valor("nueva-e-alt"), pie: valor("nueva-e-pie") };
        }
    } else if (tipo === "reto") {
        cuerpo = Object.assign(cuerpo, { dia: valor("nueva-r-dia"), palabra: valor("nueva-r-palabra"),
            titulo: valor("nueva-r-titulo") });
    } else if (tipo === "sesion") {
        cuerpo = Object.assign(cuerpo, { campana: valor("nueva-s-campana"), numero: valor("nueva-s-numero"),
            fecha: valor("nueva-s-fecha"), titulo: valor("nueva-s-titulo"), pdf: valor("nueva-s-pdf") });
    }
    const boton = $('[data-nueva-entrada] button[type="submit"]');
    ocuparWeb([boton], true);
    const hecho = await seguirTareaWeb(await pedirEditor("/api/web/entrada/nueva", cuerpo), "Haciéndola…");
    ocuparWeb([boton], false);
    if (hecho.error) {
        avisarEditor(hecho.error, true, hecho.salida);
        return;
    }
    if (hecho.entrada && !hecho.entrada.error) {
        ponerEntradaWeb(hecho.entrada);
        irAEditor("entrada");
        avisarEditor("Hecha, como borrador: ya puedes escribirla. Cuando esté, «Publicar».", false, hecho.salida);
        if (estadoEscribir.redactor) {
            estadoEscribir.redactor.foco();
        }
    }
}

// ---- ESCRIBIR UNA ----
async function abrirEntradaWeb(archivo) {
    if (estadoEscribir.cambiado && !window.confirm("Hay cambios sin guardar en la que tienes abierta. ¿Abrir esta igualmente?")) {
        return;
    }
    const entrada = await pedirEditor("/api/web/entrada?archivo=" + encodeURIComponent(archivo));
    if (entrada.error) {
        avisarEditor(entrada.error, true);
        return;
    }
    estadoEscribir.cambiado = false;
    ponerEntradaWeb(entrada);
    irAEditor("entrada");
    vigilarBorradorWeb("entrada", "entrada:" + entrada.archivo,
        () => (estadoEscribir.cambiado && estadoEscribir.entrada && estadoEscribir.entrada.archivo === entrada.archivo
            && !$('[data-vista="entrada"]').hidden ? datosDeLaEntradaWeb() : null));
    await ofrecerBorradorWeb("entrada", $("[data-borrador-entrada]"), datosDeLaEntradaWeb(), (d) => {
        const e = Object.assign({}, entrada);
        ["titulo", "titulo_corto", "pdf", "descripcion", "etiquetas", "subcategoria", "cuerpo", "hojas", "postit"].forEach((k) => {
            if (d[k] !== undefined) {
                e[k] = d[k];
            }
        });
        if (d.imagen !== undefined) {
            e.imagen = d.imagen && d.imagen.src ? Object.assign({}, entrada.imagen || {}, d.imagen) : null;
        }
        ponerEntradaWeb(e);
        // La imagen: lo del borrador, para que al guardar se cambie.
        if (d.imagen !== undefined) {
            estadoEscribir.imagen = d.imagen ? Object.assign({}, entrada.imagen || {}, d.imagen) : null;
        }
        estadoEscribir.cambiado = true;
    });
}

function ponerEntradaWeb(e) {
    estadoEscribir.entrada = e;
    estadoEscribir.cambiado = false;
    $("[data-entrada-titulo]").textContent = e.titulo || "(sin título)";
    $("[data-entrada-que]").textContent = e.que + " · " + (e.fecha_texto || e.fecha) + " · " + e.archivo;
    const estado = $("[data-entrada-estado]");
    estado.textContent = e.borrador ? "Borrador: no sale en los listados ni en el RSS." : "Publicada.";
    estado.classList.toggle("marca-borrador", e.borrador);
    ["[data-entrada-ver]", "[data-entrada-ver-barra]"].forEach((s) => {
        $(s).href = e.url;
    });
    $("[data-entrada-publicar]").textContent = e.borrador ? "Publicar" : "Volver a borrador";
    const form = $("[data-entrada]");
    form.textContent = "";
    const datos = crearEditor("section", "bloque");
    datos.setAttribute("aria-labelledby", "t-entrada-datos");
    const h2 = crearEditor("h2", "", "Los datos");
    h2.id = "t-entrada-datos";
    datos.appendChild(h2);
    if (e.tipo === "sesion") {
        campoWeb(datos, "entrada-titulo-corto", "Nombre de la sesión", { opcional: true, valor: e.titulo_corto,
            ayuda: "Sale detrás de «Sesión " + e.numero + "»: «Sesión " + e.numero + " — El mercado»." });
        campoWeb(datos, "entrada-pdf", "Enlace al cuaderno escaneado (PDF)", { opcional: true, valor: e.pdf,
            ayuda: "Con él, debajo del post-it sale el botón de descargarlo." });
    } else {
        campoWeb(datos, "entrada-titulo", "Título", { valor: e.titulo,
            ayuda: "Cambiarlo no cambia el nombre del archivo (ni su dirección)." });
    }
    campoWeb(datos, "entrada-descripcion", "Resumen de una línea", { tipo: "largo", filas: 2, valor: e.descripcion,
        ayuda: "Lo que sale al compartir el enlace (y en los buscadores)." });
    const n = estadoEscribir.nuevas || {};
    if (e.tipo === "entrada") {
        datalistWeb("lista-etiquetas-web", n.etiquetas || []);
        campoWeb(datos, "entrada-etiquetas", "Etiquetas", { valor: e.etiquetas, lista: "lista-etiquetas-web",
            ayuda: "Separadas por espacios o comas." });
    }
    if (e.tipo === "relato") {
        datalistWeb("lista-relatos-web", n.relatos || []);
        campoWeb(datos, "entrada-sub", "Tipo de relato", { valor: e.subcategoria, lista: "lista-relatos-web" });
    }
    form.appendChild(datos);

    estadoEscribir.redactor = null;
    estadoEscribir.hojas = [];
    if (e.tipo === "sesion") {
        const cuaderno = crearEditor("section", "bloque");
        cuaderno.setAttribute("aria-labelledby", "t-cuaderno");
        const h = crearEditor("h2", "", "El cuaderno");
        h.id = "t-cuaderno";
        cuaderno.appendChild(h);
        cuaderno.appendChild(crearEditor("p", "ayuda", "Cada hoja, con sus escenas (lo que se pliega, con su nombre) y"
            + " el texto suelto que quieras. En el texto: los personajes de la mesa salen de su color (el muñequito"
            + " relleno, con el desplegable de al lado), la demás gente en negrita (el muñequito hueco) y los lugares en"
            + " cursiva (la chincheta); la bolsa es la lista de lo que se consigue."));
        const dentro = crearEditor("div", "cuaderno-hojas");
        dentro.setAttribute("data-cuaderno-hojas", "");
        cuaderno.appendChild(dentro);
        form.appendChild(cuaderno);
        estadoEscribir.hojas = (e.hojas || []).map((h) => ({ titulo: h.titulo,
            bloques: h.bloques.map((b) => Object.assign({}, b)) }));
        if (!estadoEscribir.hojas.length) {
            estadoEscribir.hojas.push({ titulo: "", bloques: [{ tipo: "escena", nombre: "", abierta: true, html: "" }] });
        }
        pintarCuadernoWeb();
        // EL POST-IT, si la página lo tiene (las de la plantilla, todas). Es de
        // esta sesión y de nadie más: no tiene que ver con las misiones de la
        // campaña (que son el post-it de la página de la campaña).
        estadoEscribir.postit = null;
        if (Array.isArray(e.postit)) {
            const nota = crearEditor("section", "bloque");
            nota.setAttribute("aria-labelledby", "t-postit");
            const h2 = crearEditor("h2", "", "El post-it: cosas pendientes");
            h2.id = "t-postit";
            nota.appendChild(h2);
            nota.appendChild(crearEditor("p", "ayuda", "La nota amarilla de al lado del cuaderno: lo que quedó a medias"
                + " para la próxima. Una cosa por casilla; «Hecha» la deja tachada y con la casilla marcada en vez de"
                + " borrarla."));
            const lista = crearEditor("div", "postit-cosas");
            lista.setAttribute("data-postit-cosas", "");
            nota.appendChild(lista);
            form.appendChild(nota);
            estadoEscribir.postit = e.postit.map((c) => {
                const texto = textoDeHtmlWeb(c.html);
                return { html: c.html || "", texto, original: texto, hecho: !!c.hecho };
            });
            pintarPostitWeb();
        }
    } else {
        const texto = crearEditor("section", "bloque");
        texto.setAttribute("aria-labelledby", "t-entrada-texto");
        const h = crearEditor("h2", "", "El texto");
        h.id = "t-entrada-texto";
        texto.appendChild(h);
        const r = crearRedactor({ etiqueta: "El texto de la entrada", grande: true,
            imagenes: () => ({ sitio: e.sitio_imagen, campos: { anyo: e.anyo } }) });
        r.ponerHTML(e.cuerpo);
        r.alCambiar = () => {
            estadoEscribir.cambiado = true;
        };
        texto.appendChild(r.caja);
        form.appendChild(texto);
        estadoEscribir.redactor = r;
        pintarImagenDelLadoWeb(form, e);
    }
}

// LA IMAGEN DE LA COLUMNA DE LA DERECHA: la que hay (con su vista), y
// cambiarla, quitarla, su descripción y su pie (que puede llevar un
// enlace a quien hizo la foto).
function pintarImagenDelLadoWeb(form, e) {
    const imagen = e.imagen ? Object.assign({}, e.imagen) : null;
    estadoEscribir.imagen = imagen;
    const caja = crearEditor("section", "bloque");
    caja.setAttribute("aria-labelledby", "t-entrada-imagen");
    const h = crearEditor("h2", "", "La imagen de la derecha");
    h.id = "t-entrada-imagen";
    caja.appendChild(h);
    const vista = crearEditor("div", "dato-imagen imagen-del-lado");
    caja.appendChild(vista);
    const datos = crearEditor("div");
    caja.appendChild(datos);
    form.appendChild(caja);
    const pintar = () => {
        vista.textContent = "";
        datos.textContent = "";
        const im = estadoEscribir.imagen;
        if (im && im.a_mano && !im.cambiar) {
            vista.appendChild(crearEditor("p", "ayuda", "Esta está escrita a mano en la página (un vídeo que hace de"
                + " gif, o algo así): aquí no se toca."));
            const cambiar = crearEditor("button", "", "Cambiarla por una imagen");
            cambiar.type = "button";
            cambiar.addEventListener("click", () => {
                im.cambiar = true;
                im.src = "";
                estadoEscribir.cambiado = true;
                pintar();
            });
            vista.appendChild(cambiar);
            return;
        }
        if (im && im.src) {
            const img = document.createElement("img");
            img.src = im.src;
            img.alt = "";
            vista.appendChild(img);
            vista.appendChild(crearEditor("span", "faltan-veces", im.src));
        } else {
            vista.appendChild(crearEditor("p", "ayuda", "Sin imagen: la columna sale solo con «otras entradas»."));
        }
        const subir = crearEditor("div", "subir");
        const archivo = document.createElement("input");
        archivo.type = "file";
        archivo.accept = "image/*";
        archivo.id = "entrada-imagen-archivo";
        const l = crearEditor("label", "boton", im && im.src ? "Cambiarla (de tu ordenador)" : "Ponerle una (de tu ordenador)");
        l.htmlFor = archivo.id;
        subir.appendChild(archivo);
        subir.appendChild(l);
        vista.appendChild(subir);
        archivo.addEventListener("change", async () => {
            avisarEditor("Trayendo la imagen…");
            const hecha = await subirImagenWeb(archivo, e.sitio_imagen, { anyo: e.anyo }, $("#entrada-titulo")
                ? $("#entrada-titulo").value : e.titulo);
            if (!hecha) {
                return;
            }
            if (hecha.error) {
                avisarEditor(hecha.error, true);
                return;
            }
            estadoEscribir.imagen = Object.assign(estadoEscribir.imagen || {}, { src: hecha.ruta, cambiar: true,
                a_mano: false });
            estadoEscribir.cambiado = true;
            avisarEditor("Imagen lista: " + hecha.ruta + " (" + hecha.aviso + "). Se pone al guardar.");
            pintar();
        });
        if (im && im.src) {
            const quitar = crearEditor("button", "", "Quitarla");
            quitar.type = "button";
            quitar.addEventListener("click", () => {
                estadoEscribir.imagen = { src: "", alt: "", pie: "", cambiar: true };
                estadoEscribir.cambiado = true;
                pintar();
            });
            vista.appendChild(quitar);
            const alt = campoWeb(datos, "entrada-imagen-alt", "Qué se ve", { valor: im.alt || "",
                ayuda: "Para quien no la ve. Vacío si es de adorno." });
            alt.addEventListener("input", () => {
                estadoEscribir.imagen.alt = alt.value;
                estadoEscribir.cambiado = true;
            });
            const etiqueta = crearEditor("p", "etiqueta-suelta", "Pie de foto");
            etiqueta.id = "entrada-imagen-pie-etiqueta";
            datos.appendChild(etiqueta);
            const pie = crearRedactor({ etiqueta: "Pie de foto", enLinea: true });
            pie.ponerHTML(im.pie || "");
            pie.alCambiar = () => {
                estadoEscribir.imagen.pie = pie.darHTML();
                estadoEscribir.cambiado = true;
            };
            datos.appendChild(pie.caja);
        }
    };
    pintar();
}

// ---- EL CUADERNO DE UNA PARTIDA ----
// Las hojas y sus bloques (escenas y texto suelto) se pintan desde
// estadoEscribir.hojas; cada bloque lleva su editor. Al mover, añadir o
// quitar, se recoge lo escrito y se vuelve a pintar todo.
function recogerCuadernoWeb() {
    estadoEscribir.hojas.forEach((h) => h.bloques.forEach((b) => {
        if (b.redactor) {
            b.html = b.redactor.darHTML();
        }
    }));
}

function pintarCuadernoWeb(enfocar) {
    recogerCuadernoWeb();
    const caja = $("[data-cuaderno-hojas]");
    caja.textContent = "";
    const e = estadoEscribir.entrada;
    const hojas = estadoEscribir.hojas;
    const mover = (lista, i, hacia) => {
        const j = i + hacia;
        if (j < 0 || j >= lista.length) {
            return;
        }
        [lista[i], lista[j]] = [lista[j], lista[i]];
    };
    const botonCuaderno = (dentro, texto, ayuda, alPulsar) => {
        const b = crearEditor("button", "", texto);
        b.type = "button";
        b.setAttribute("aria-label", ayuda);
        b.addEventListener("click", () => {
            estadoEscribir.cambiado = true;
            alPulsar();
        });
        dentro.appendChild(b);
        return b;
    };
    hojas.forEach((hoja, i) => {
        const sec = crearEditor("section", "cuaderno-hoja-editor");
        sec.setAttribute("aria-labelledby", "hoja-web-" + i);
        const cab = crearEditor("div", "fila cuaderno-hoja-cab");
        const h3 = crearEditor("h3", "", "Hoja " + (i + 1));
        h3.id = "hoja-web-" + i;
        h3.tabIndex = -1;
        cab.appendChild(h3);
        botonCuaderno(cab, "↑", "Subir la hoja " + (i + 1), () => {
            mover(hojas, i, -1);
            pintarCuadernoWeb("hoja-web-" + Math.max(0, i - 1));
        });
        botonCuaderno(cab, "↓", "Bajar la hoja " + (i + 1), () => {
            mover(hojas, i, 1);
            pintarCuadernoWeb("hoja-web-" + Math.min(hojas.length - 1, i + 1));
        });
        if (hojas.length > 1) {
            botonCuaderno(cab, "Quitar la hoja", "Quitar la hoja " + (i + 1), () => {
                if (!window.confirm("¿Quitar la hoja " + (i + 1) + " con todo lo que tiene?")) {
                    return;
                }
                hojas.splice(i, 1);
                pintarCuadernoWeb("hoja-web-" + Math.max(0, i - 1));
            });
        }
        sec.appendChild(cab);
        hoja.bloques.forEach((b, k) => {
            const caja2 = crearEditor("fieldset", "cuaderno-bloque");
            const id = "bloque-web-" + i + "-" + k;
            const leyenda = crearEditor("legend", "", b.tipo === "escena" ? "Escena " : "Texto suelto");
            caja2.appendChild(leyenda);
            if (b.tipo === "escena") {
                leyenda.textContent = "Escena: " + (b.nombre || "sin nombre");
                const nombre = campoWeb(caja2, id + "-nombre", "Nombre de la escena", { valor: b.nombre });
                nombre.addEventListener("input", () => {
                    b.nombre = nombre.value;
                    leyenda.textContent = "Escena: " + (b.nombre || "sin nombre");
                    estadoEscribir.cambiado = true;
                });
                const abierta = crearEditor("label", "opcion");
                const casilla = document.createElement("input");
                casilla.type = "checkbox";
                casilla.checked = b.abierta !== false;
                casilla.addEventListener("change", () => {
                    b.abierta = casilla.checked;
                    estadoEscribir.cambiado = true;
                });
                abierta.appendChild(casilla);
                abierta.appendChild(document.createTextNode(" Desplegada al abrir la página"));
                caja2.appendChild(abierta);
            }
            const r = crearRedactor({ etiqueta: b.tipo === "escena" ? "Lo que pasó en " + (b.nombre || "la escena")
                : "Texto suelto de la hoja " + (i + 1), clases: /^(pj-[a-z]+|cuaderno-(objetos|flavor|mecanica|descubrimiento))$/,
            extras: extrasDelCuadernoWeb(e), enlaces: (datos) => enlacesDelCuadernoWeb(e, datos),
            gente: (datos) => enlacesDelCuadernoWeb(e, datos).slice(0, 2),
            avisos: (area, avisar) => avisosDeNombresWeb(area, e, avisar),
            imagenes: () => ({ sitio: "notas", campos: { campana: e.campana } }) });
            r.ponerHTML(b.html || "");
            r.alCambiar = () => {
                estadoEscribir.cambiado = true;
            };
            b.redactor = r;
            caja2.appendChild(r.caja);
            // Los avisos de nombres necesitan la lista de NPC: en cuanto
            // llega, se vuelven a mirar.
            enlazablesWeb().then(() => r.contar && r.contar());
            const fila = crearEditor("div", "fila");
            const que = b.tipo === "escena" ? "la escena «" + (b.nombre || "sin nombre") + "»" : "el texto suelto";
            botonCuaderno(fila, "↑", "Subir " + que, () => {
                mover(hoja.bloques, k, -1);
                pintarCuadernoWeb(id.replace(/-\d+$/, "-" + Math.max(0, k - 1)) + "-leyenda");
            });
            botonCuaderno(fila, "↓", "Bajar " + que, () => {
                mover(hoja.bloques, k, 1);
                pintarCuadernoWeb(id.replace(/-\d+$/, "-" + Math.min(hoja.bloques.length - 1, k + 1)) + "-leyenda");
            });
            botonCuaderno(fila, "Quitar", "Quitar " + que, () => {
                if (!window.confirm("¿Quitar " + que + "?")) {
                    return;
                }
                hoja.bloques.splice(k, 1);
                pintarCuadernoWeb("hoja-web-" + i);
            });
            leyenda.id = id + "-leyenda";
            leyenda.tabIndex = -1;
            caja2.appendChild(fila);
            sec.appendChild(caja2);
        });
        const anadir = crearEditor("div", "fila cuaderno-anadir");
        const plantilla = document.createElement("select");
        plantilla.id = "plantilla-hoja-" + i;
        plantilla.className = "redactor-elegir";
        plantilla.setAttribute("aria-label", "De qué es la escena nueva (plantilla) de la hoja " + (i + 1));
        PLANTILLAS_DE_ESCENA.forEach(([clave, texto]) => plantilla.appendChild(new Option(texto, clave)));
        plantilla.value = estadoEscribir.ultimaPlantilla || "";
        plantilla.addEventListener("change", () => {
            estadoEscribir.ultimaPlantilla = plantilla.value;
        });
        anadir.appendChild(plantilla);
        botonCuaderno(anadir, "Añadir una escena", "Añadir una escena a la hoja " + (i + 1)
            + " (con la plantilla elegida al lado)", () => {
            const p = PLANTILLAS_DE_ESCENA.find(([clave]) => clave === plantilla.value) || PLANTILLAS_DE_ESCENA[0];
            hoja.bloques.push({ tipo: "escena", nombre: p[2], abierta: true, html: p[3] });
            pintarCuadernoWeb("bloque-web-" + i + "-" + (hoja.bloques.length - 1) + "-nombre");
        });
        botonCuaderno(anadir, "Añadir texto suelto", "Añadir texto suelto a la hoja " + (i + 1), () => {
            hoja.bloques.push({ tipo: "texto", html: "" });
            pintarCuadernoWeb("bloque-web-" + i + "-" + (hoja.bloques.length - 1) + "-leyenda");
        });
        sec.appendChild(anadir);
        caja.appendChild(sec);
    });
    const otra = crearEditor("div", "fila");
    botonCuaderno(otra, "Añadir una hoja", "Añadir una hoja al cuaderno", () => {
        hojas.push({ titulo: "", bloques: [{ tipo: "escena", nombre: "", abierta: true, html: "" }] });
        pintarCuadernoWeb("hoja-web-" + (hojas.length - 1));
    });
    caja.appendChild(otra);
    if (enfocar && document.getElementById(enfocar)) {
        document.getElementById(enfocar).focus();
    }
}

// Los botones de más del cuaderno: un personaje de la mesa (de su color),
// alguien que no es de la mesa (negrita), un lugar (cursiva) y la lista de
// lo conseguido.
// Al escribir [[ en las notas: los de la mesa (de su color), los NPC de la
// campaña (en negrita) y las páginas de la wiki (enlace).
function enlacesDelCuadernoWeb(e, datos) {
    const pjs = (e.personajes || []).filter((p) => p.nombre);
    return [
        { nombre: "Personaje de la mesa", cosas: pjs.map((p) => ({ texto: p.nombre,
            poner: (r) => r.envolver("strong", p.color ? "pj-" + p.color : "", p.nombre) })) },
        { nombre: "NPC de la campaña", cosas: ((datos.npcs || {})[e.campana] || []).map((p) => ({ texto: p.nombre,
            detalle: [p.que, p.grupo, p.estado && p.estado !== "vivo" ? p.estado : ""].filter(Boolean).join(" · "),
            busca: [p.donde, p.estado, p.notas].filter(Boolean).join(" "), foto: p.foto,
            poner: (r) => r.envolver("strong", "", p.nombre, undefined, { "data-npc": p.nombre }) })) },
        paginasParaEnlazarRedactor(datos),
    ];
}

// «Hacer NPC»: lo elegido en las notas pasa a ser un NPC de la campaña
// (editor_web.crear_npc), sale en negrita y ya está en sus fichas.
async function hacerNpcDesdeLasNotasWeb(r, e) {
    const datos = await enlazablesWeb();
    r.panel((panel, cerrar) => {
        panel.appendChild(crearEditor("h3", "", "Un NPC nuevo, de la campaña"));
        const campo = (id, texto, valor, lista) => {
            const c = crearEditor("div", "campo");
            const l = crearEditor("label", "", texto);
            l.htmlFor = id;
            const i = document.createElement("input");
            i.id = id;
            i.value = valor || "";
            i.autocomplete = "off";
            if (lista) {
                i.setAttribute("list", lista);
            }
            c.appendChild(l);
            c.appendChild(i);
            panel.appendChild(c);
            return i;
        };
        datalistWeb("lista-grupos-npc-web", (datos.grupos || {})[e.campana] || []);
        const nombre = campo("npc-nuevo-nombre", "Nombre", r.elegido().trim());
        const grupo = campo("npc-nuevo-grupo", "Grupo (la caravana, Sirevia…)", "", "lista-grupos-npc-web");
        const que = campo("npc-nuevo-que", "Qué es (raza, oficio…)", "");
        const fila = crearEditor("div", "fila");
        const si = crearEditor("button", "principal", "Crear el NPC");
        si.type = "button";
        const no = crearEditor("button", "", "Cancelar");
        no.type = "button";
        fila.appendChild(si);
        fila.appendChild(no);
        panel.appendChild(fila);
        no.addEventListener("click", () => cerrar(true));
        si.addEventListener("click", async () => {
            if (!nombre.value.trim()) {
                avisarEditor("Hace falta su nombre.", true);
                nombre.focus();
                return;
            }
            ocuparWeb([si], true);
            const hecho = await seguirTareaWeb(await pedirEditor("/api/web/npc/nuevo", { campana: e.campana,
                nombre: nombre.value.trim(), grupo: grupo.value.trim(), que: que.value.trim(), sesion: e.numero }),
            "NPC apuntado. Pasándolo a la web…");
            ocuparWeb([si], false);
            if (hecho.error) {
                avisarEditor(hecho.error, true, hecho.salida);
                return;
            }
            ENLAZABLES_WEB.cuando = 0;
            const lo = nombre.value.trim();
            cerrar(true);
            r.envolver("strong", "", r.elegido().trim() === lo ? undefined : lo, true, { "data-npc": lo });
            avisarEditor("«" + lo + "» ya es NPC de la campaña (en sus fichas, para ponerle foto y lo que sepáis).",
                false, hecho.salida);
        });
        nombre.focus();
    });
}

// NOMBRES CASI IGUALES. Una negrita que no es nadie pero se parece mucho
// a un NPC o a alguien de la mesa («Rukkus», «Apacca», «Thenaris») es
// casi seguro una errata: en la web no abriría su ficha. Sale en los
// avisos de debajo del texto, con un botón que la cambia por el nombre
// bueno (y le pone su etiqueta o su color). Lo que no se parece a nadie
// (un caballo, «25 monedas de oro») no avisa. Una etiqueta de NPC que ya
// no existe (se le cambió el nombre), también.
function avisosDeNombresWeb(area, e, avisar) {
    const datos = ENLAZABLES_WEB.datos;
    if (!datos) {
        return [];
    }
    const llano = (s) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const distancia = (a, b) => {
        let antes = Array.from({ length: b.length + 1 }, (_, i) => i);
        for (let i = 1; i <= a.length; i += 1) {
            const fila = [i];
            for (let j = 1; j <= b.length; j += 1) {
                fila[j] = Math.min(antes[j] + 1, fila[j - 1] + 1, antes[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
            }
            antes = fila;
        }
        return antes[b.length];
    };
    const npcs = ((datos.npcs || {})[e.campana] || []).map((p) => ({ nombre: p.nombre, npc: true }));
    const pjs = (e.personajes || []).filter((p) => p.nombre).map((p) => ({ nombre: p.nombre, color: p.color }));
    const gente = npcs.concat(pjs);
    const avisos = new Map();
    area.querySelectorAll("strong").forEach((s) => {
        const texto = s.textContent.replace(/\s+/g, " ").trim();
        if (!texto || /\d/.test(texto)) {
            return;
        }
        const etiqueta = s.getAttribute("data-npc");
        if (etiqueta) {
            if (!npcs.some((p) => llano(p.nombre) === llano(etiqueta)) && !avisos.has("etiqueta" + etiqueta)) {
                avisos.set("etiqueta" + etiqueta, { texto: "«" + texto + "» lleva la etiqueta de «" + etiqueta
                    + "», que no es ningún NPC de la campaña" });
            }
            return;
        }
        const t = llano(texto);
        // Ya es alguien: su nombre, o su nombre de pila (como lo busca la web).
        if (gente.some((g) => llano(g.nombre) === t || llano(g.nombre).split(/\s+/)[0] === t)) {
            return;
        }
        let mejor = null;
        let menor = 99;
        gente.forEach((g) => {
            const n = llano(g.nombre);
            [n].concat(n.split(/\s+/)).forEach((c) => {
                const d = distancia(c, t);
                if (d < menor) {
                    menor = d;
                    mejor = g;
                }
            });
        });
        const tope = t.length >= 5 ? 2 : (t.length >= 3 ? 1 : 0);
        if (!mejor || menor === 0 || menor > tope) {
            return;
        }
        const clave = texto + "\u0000" + mejor.nombre;
        const ya = avisos.get(clave);
        if (ya) {
            ya.veces += 1;
            ya.texto = "«" + texto + "» (" + ya.veces + " veces) se parece a " + mejor.nombre
                + (mejor.npc ? " (NPC)" : " (de la mesa)");
            return;
        }
        const quien = mejor;
        avisos.set(clave, { veces: 1, texto: "«" + texto + "» se parece a " + quien.nombre
            + (quien.npc ? " (NPC)" : " (de la mesa)"), comoArreglar: "Cambiarlo por " + quien.nombre,
        arreglar: () => {
            area.querySelectorAll("strong").forEach((x) => {
                if (x.getAttribute("data-npc") || x.textContent.replace(/\s+/g, " ").trim() !== texto) {
                    return;
                }
                x.textContent = quien.nombre;
                if (quien.npc) {
                    x.setAttribute("data-npc", quien.nombre);
                } else if (quien.color) {
                    x.className = "pj-" + quien.color;
                }
            });
            avisar();
        } });
    });
    return [...avisos.values()];
}

// LAS PLANTILLAS DE ESCENA: al añadir una escena se puede elegir de qué
// es, y sale con su nombre y su esqueleto para rellenar (los «…»). Con lo
// de los botones de las notas: la caja de «Lo que descubrimos», la lista
// de objetos, la ambientación.
const PLANTILLAS_DE_ESCENA = [
    ["", "Vacía", "", ""],
    ["combate", "Combate", "Combate contra …",
        "<ul><li>Contra quién: …</li><li>Cómo empieza: …</li><li>Lo más destacado: …</li><li>Cómo acaba: …</li></ul>"
        + "<p>Lo que conseguimos:</p><ul class=\"cuaderno-objetos\"><li>…</li></ul>"],
    ["viaje", "Viaje", "De … a …",
        "<ul><li>Salimos de <em>…</em> rumbo a <em>…</em>.</li><li>Por el camino: …</li>"
        + "<li>Llegamos a <em>…</em> (o acampamos en …).</li></ul>"],
    ["descanso", "Descanso o acampada", "Noche en …",
        "<ul><li>Acampamos en <em>…</em>.</li><li>Primera guardia: …</li><li>Segunda guardia: …</li>"
        + "<li>Lo que se habló: …</li></ul>"],
    ["interrogatorio", "Interrogatorio", "Interrogatorio a …",
        "<ul><li>Interrogamos a <strong>…</strong> en …</li></ul>"
        + "<blockquote class=\"cuaderno-descubrimiento\"><ul><li>…</li></ul></blockquote>"
        + "<ul><li>Qué hacemos con él: …</li></ul>"],
    ["llegada", "Llegada a un sitio", "Llegada a …",
        "<ul><li>Llegamos a <em>…</em>. <span class=\"cuaderno-flavor\">Cómo es: lo que se ve, se oye y se huele"
        + " al llegar.</span></li><li>Quién nos recibe: …</li><li>Lo que nos cuentan: …</li></ul>"],
    ["comercio", "Compras y ventas", "Compras en …",
        "<ul><li>Vamos a <em>…</em> (la tienda o el puesto de <strong>…</strong>).</li></ul>"
        + "<p>Compramos:</p><ul class=\"cuaderno-objetos\"><li>…</li></ul>"
        + "<p>Vendimos:</p><ul class=\"cuaderno-objetos\"><li>…</li></ul>"],
    ["investigacion", "Investigación o pista", "Investigando …",
        "<ul><li>Qué investigamos y dónde: …</li><li>Quién: …</li></ul>"
        + "<blockquote class=\"cuaderno-descubrimiento\"><ul><li>…</li></ul></blockquote>"],
];

function extrasDelCuadernoWeb(e) {
    const pjs = (e.personajes || []).filter((p) => p.nombre);
    const extras = [];
    if (pjs.length) {
        const elegir = document.createElement("select");
        elegir.className = "redactor-elegir";
        elegir.setAttribute("aria-label", "Qué personaje de la mesa");
        pjs.forEach((p) => {
            const o = document.createElement("option");
            o.value = p.color || "";
            o.textContent = p.nombre;
            elegir.appendChild(o);
        });
        extras.push({ elemento: elegir, separar: true });
        extras.push({ texto: "Personaje de la mesa", icono: "personaje",
            ayuda: "Lo elegido, como personaje de la mesa (de su color). Sin nada elegido, mete su nombre",
            hacer: (r) => r.envolver("strong", elegir.value ? "pj-" + elegir.value : "",
                elegir.options[elegir.selectedIndex].textContent) });
    }
    // UN NPC DE LA CAMPAÑA, con su etiqueta: <strong data-npc="Brandr
    // Vindahl">Brandr</strong>. En las notas se puede escribir solo el
    // nombre de pila (o un mote) y sigue siendo él: el globo y su ficha
    // salen por la etiqueta, no por lo escrito. El botón abre el buscador
    // de la gente (como escribir @): lo elegido se envuelve con quien se
    // elija; sin nada elegido, mete su nombre entero.
    extras.push({ texto: "Buscar a alguien (NPC o de la mesa)", icono: "npc", separar: true,
        ayuda: "Buscar un NPC o a alguien de la mesa (también escribiendo @): lo elegido pasa a ser él, con su"
            + " etiqueta. Sin nada elegido, mete su nombre",
        hacer: (r) => r.buscarGente() });
    extras.push({ texto: "Alguien", icono: "alguien", ayuda: "Lo elegido, como alguien que no es de la mesa (en negrita)",
        hacer: (r) => r.envolver("strong") });
    extras.push({ texto: "Lugar", icono: "lugar", ayuda: "Lo elegido, como un lugar (en cursiva)", hacer: (r) => r.envolver("em") });
    extras.push({ texto: "Hacer NPC", icono: "npcNuevo",
        ayuda: "Lo elegido (un nombre), como NPC nuevo de la campaña: con su grupo y qué es",
        hacer: (r) => hacerNpcDesdeLasNotasWeb(r, e) });
    // Lo que se cuenta aparte: la AMBIENTACIÓN (cómo es algo, en cursiva y
    // con su raya), la REGLA (lo que hace en el juego, de máquina y en su
    // recuadro) y LO QUE DESCUBRIMOS (un interrogatorio, una pista: una
    // caja con su título). Ver estilos/paginas/notas-rol.css.
    extras.push({ texto: "Ambientación", icono: "ambientacion", separar: true,
        ayuda: "Lo elegido, como texto de ambientación: cómo es, cómo suena, a qué huele (en cursiva, aparte)",
        hacer: (r) => r.envolver("span", "cuaderno-flavor") });
    extras.push({ texto: "Regla", icono: "regla",
        ayuda: "Lo elegido, como la regla de juego: lo que hace (daño, tiradas, CD…), en su recuadro",
        hacer: (r) => r.envolver("span", "cuaderno-mecanica") });
    extras.push({ texto: "Lo que descubrimos", icono: "descubrimiento",
        ayuda: "Lo de donde está el cursor (o lo elegido), en una caja aparte: lo que sacamos de un interrogatorio,"
            + " una pista… Otra vez, lo saca de la caja",
        hacer: (r) => r.envolverBloque("blockquote", "cuaderno-descubrimiento") });
    extras.push({ texto: "Lista de objetos", icono: "objetos", ayuda: "Una lista de lo que se consiguió (con su formato)",
        hacer: (r) => {
            r.hacer("insertUnorderedList");
            const sel = window.getSelection();
            const nodo = sel.rangeCount ? sel.getRangeAt(0).commonAncestorContainer : null;
            const lista = nodo && (nodo.nodeType === 1 ? nodo : nodo.parentNode).closest("ul");
            if (lista && r.area.contains(lista)) {
                lista.className = "cuaderno-objetos";
            }
        } });
    return extras;
}

// ---- EL POST-IT DE UNA PARTIDA ----
// Cada cosa, una fila: «Hecha», lo que es, subir, bajar y quitar. Lo que
// no se toca conserva su HTML (un nombre en negrita, de color…); lo que se
// reescribe se guarda tal cual se escribe.
function textoDeHtmlWeb(trozo) {
    const d = document.createElement("div");
    d.innerHTML = trozo || "";
    return (d.textContent || "").replace(/\s+/g, " ").trim();
}

function htmlDeTextoWeb(texto) {
    const d = document.createElement("div");
    d.textContent = texto;
    return d.innerHTML;
}

function pintarPostitWeb(enfocar) {
    const caja = $("[data-postit-cosas]");
    const cosas = estadoEscribir.postit;
    if (!caja || !cosas) {
        return;
    }
    caja.textContent = "";
    const cambiado = () => {
        estadoEscribir.cambiado = true;
    };
    const lista = crearEditor("ol", "postit-lista");
    cosas.forEach((c, i) => {
        const li = crearEditor("li", "postit-cosa");
        const hecha = crearEditor("label", "opcion");
        const casilla = document.createElement("input");
        casilla.type = "checkbox";
        casilla.checked = c.hecho;
        casilla.addEventListener("change", () => {
            c.hecho = casilla.checked;
            cambiado();
        });
        hecha.appendChild(casilla);
        hecha.appendChild(document.createTextNode(" Hecha"));
        const campo = document.createElement("input");
        campo.type = "text";
        campo.id = "postit-web-" + i;
        campo.value = c.texto;
        campo.autocomplete = "off";
        campo.setAttribute("aria-label", "Cosa pendiente " + (i + 1));
        campo.addEventListener("input", () => {
            c.texto = campo.value;
            cambiado();
        });
        const botones = crearEditor("div", "fila");
        const boton = (texto, ayuda, alPulsar, apagado) => {
            const b = crearEditor("button", "", texto);
            b.type = "button";
            b.setAttribute("aria-label", ayuda);
            b.disabled = !!apagado;
            b.addEventListener("click", () => {
                cambiado();
                alPulsar();
            });
            botones.appendChild(b);
        };
        boton("↑", "Subir la cosa " + (i + 1), () => {
            [cosas[i - 1], cosas[i]] = [cosas[i], cosas[i - 1]];
            pintarPostitWeb("postit-web-" + (i - 1));
        }, i === 0);
        boton("↓", "Bajar la cosa " + (i + 1), () => {
            [cosas[i + 1], cosas[i]] = [cosas[i], cosas[i + 1]];
            pintarPostitWeb("postit-web-" + (i + 1));
        }, i === cosas.length - 1);
        boton("Quitar", "Quitar la cosa " + (i + 1), () => {
            cosas.splice(i, 1);
            pintarPostitWeb(cosas.length ? "postit-web-" + Math.min(i, cosas.length - 1) : "postit-web-anadir");
        });
        li.appendChild(hecha);
        li.appendChild(campo);
        li.appendChild(botones);
        lista.appendChild(li);
    });
    if (cosas.length) {
        caja.appendChild(lista);
    } else {
        caja.appendChild(crearEditor("p", "ayuda", "No hay nada pendiente (el post-it sale vacío)."));
    }
    const anadir = crearEditor("button", "", "Añadir una cosa");
    anadir.type = "button";
    anadir.id = "postit-web-anadir";
    anadir.addEventListener("click", () => {
        cosas.push({ html: "", texto: "", original: "", hecho: false });
        estadoEscribir.cambiado = true;
        pintarPostitWeb("postit-web-" + (cosas.length - 1));
    });
    caja.appendChild(anadir);
    if (enfocar && document.getElementById(enfocar)) {
        document.getElementById(enfocar).focus();
    }
}

function datosDelPostitWeb() {
    return estadoEscribir.postit.filter((c) => c.texto.trim()).map((c) => ({ hecho: c.hecho,
        html: c.texto === c.original && c.html ? c.html : htmlDeTextoWeb(c.texto.trim()) }));
}

// ---- GUARDAR Y PUBLICAR ----
function datosDeLaEntradaWeb() {
    const e = estadoEscribir.entrada;
    const valor = (id) => (document.getElementById(id) ? document.getElementById(id).value : "");
    const cuerpo = { archivo: e.archivo, descripcion: valor("entrada-descripcion") };
    if (e.tipo === "sesion") {
        recogerCuadernoWeb();
        cuerpo.titulo_corto = valor("entrada-titulo-corto");
        cuerpo.pdf = valor("entrada-pdf");
        cuerpo.hojas = estadoEscribir.hojas.map((h) => ({ titulo: h.titulo,
            bloques: h.bloques.map((b) => ({ tipo: b.tipo, nombre: b.nombre || "", abierta: b.abierta !== false, html: b.html || "" })) }));
        if (estadoEscribir.postit) {
            cuerpo.postit = datosDelPostitWeb();
        }
    } else {
        cuerpo.titulo = valor("entrada-titulo");
        cuerpo.cuerpo = estadoEscribir.redactor ? estadoEscribir.redactor.darHTML() : "";
        cuerpo.etiquetas = valor("entrada-etiquetas");
        cuerpo.subcategoria = valor("entrada-sub");
        const im = estadoEscribir.imagen;
        cuerpo.imagen = im ? { src: im.src || "", alt: im.alt || "", pie: im.pie || "", cambiar: !!im.cambiar } : null;
    }
    return cuerpo;
}

async function guardarEntradaWeb(yPasar) {
    if (!estadoEscribir.entrada || estadoEscribir.guardando) {
        return false;
    }
    estadoEscribir.guardando = true;
    const botones = document.querySelectorAll("[data-barra-entrada] button");
    ocuparWeb(botones, true);
    avisarEditor("Guardando…");
    const cuerpo = Object.assign(datosDeLaEntradaWeb(), { pasar: !!yPasar });
    const hecho = await seguirTareaWeb(await pedirEditor("/api/web/entrada/guardar", cuerpo), "Guardado. Pasándolo a la web…");
    ocuparWeb(botones, false);
    estadoEscribir.guardando = false;
    if (hecho.error) {
        avisarEditor(hecho.error, true, hecho.salida);
        return false;
    }
    estadoEscribir.cambiado = false;
    borrarBorradorWeb("entrada");
    if (hecho.entrada && !hecho.entrada.error) {
        actualizarCabeceraDeEntradaWeb(hecho.entrada);
    }
    avisarEditor(yPasar ? "Guardada y pasada a la web." : "Guardada en " + estadoEscribir.entrada.archivo + ".", false,
        hecho.salida);
    return true;
}

// Después de guardar: el título y el estado de arriba (sin volver a pintar
// lo escrito, que se quedaría sin el foco).
function actualizarCabeceraDeEntradaWeb(e) {
    const vieja = estadoEscribir.entrada;
    estadoEscribir.entrada = Object.assign({}, vieja, { titulo: e.titulo, borrador: e.borrador, descripcion: e.descripcion,
        imagen: e.imagen });
    $("[data-entrada-titulo]").textContent = e.titulo || "(sin título)";
    const estado = $("[data-entrada-estado]");
    estado.textContent = e.borrador ? "Borrador: no sale en los listados ni en el RSS." : "Publicada.";
    estado.classList.toggle("marca-borrador", e.borrador);
    $("[data-entrada-publicar]").textContent = e.borrador ? "Publicar" : "Volver a borrador";
    if (estadoEscribir.imagen) {
        estadoEscribir.imagen.cambiar = false;
        if (e.imagen) {
            estadoEscribir.imagen.a_mano = e.imagen.a_mano;
        }
    }
}

async function publicarEntradaWeb() {
    const e = estadoEscribir.entrada;
    if (!e) {
        return;
    }
    const despublicar = !e.borrador;
    if (despublicar && !window.confirm("¿Volver a dejarla en borrador? Deja de salir en los listados (ojo: quien ya la"
        + " tenga en el RSS se la queda).")) {
        return;
    }
    // Lo escrito, primero.
    if (estadoEscribir.cambiado && !(await guardarEntradaWeb(false))) {
        return;
    }
    const botones = document.querySelectorAll("[data-barra-entrada] button");
    ocuparWeb(botones, true);
    const hecho = await seguirTareaWeb(await pedirEditor("/api/web/entrada/publicar", { archivo: e.archivo, despublicar }),
        despublicar ? "Volviendo a borrador…" : "Publicando…");
    ocuparWeb(botones, false);
    if (hecho.error) {
        avisarEditor(hecho.error, true, hecho.salida);
        return;
    }
    if (hecho.entrada && !hecho.entrada.error) {
        actualizarCabeceraDeEntradaWeb(hecho.entrada);
    }
    avisarEditor(despublicar ? "Vuelve a ser un borrador." : "¡Publicada! Ya sale en los listados y en el RSS. Sube el"
        + " sitio a Neocities cuando quieras.", false, hecho.salida);
}

// ---- AL EMPEZAR ----
function empezarEscribirWeb() {
    document.querySelectorAll('[data-ir="escribir"]').forEach((b) => b.addEventListener("click", pintarEscribir));
    document.querySelectorAll('[data-ir="rol"]').forEach((b) => b.addEventListener("click", pintarNotasDeRolWeb));
    ["#entradas-tipo", "#entradas-estado"].forEach((s) => $(s).addEventListener("change", pintarListaDeEntradas));
    $("#entradas-buscar").addEventListener("input", pintarListaDeEntradas);
    document.querySelectorAll("[data-nueva-tipo]").forEach((b) => {
        b.addEventListener("click", async () => {
            if (!estadoEscribir.nuevas) {
                await pintarEscribir();
            }
            empezarNuevaWeb(b.getAttribute("data-nueva-tipo"));
        });
    });
    $("[data-nueva-entrada]").addEventListener("submit", (e) => {
        e.preventDefault();
        crearEntradaWeb();
    });
    $("[data-entrada]").addEventListener("submit", (e) => e.preventDefault());
    $("[data-entrada]").addEventListener("input", () => {
        estadoEscribir.cambiado = true;
    });
    $("[data-entrada-guardar]").addEventListener("click", () => guardarEntradaWeb(false));
    $("[data-entrada-pasar]").addEventListener("click", () => guardarEntradaWeb(true));
    $("[data-entrada-publicar]").addEventListener("click", publicarEntradaWeb);
    document.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && !$('[data-vista="entrada"]').hidden) {
            e.preventDefault();
            guardarEntradaWeb(false);
        }
    });
    // La barra de abajo crece con los avisos: la página le deja su hueco.
    const hueco = () => {
        const barra = document.querySelector(".barra:not([hidden])");
        document.body.style.paddingBottom = barra ? (barra.offsetHeight + 24) + "px" : "";
    };
    if (window.ResizeObserver) {
        document.querySelectorAll(".barra").forEach((b) => new ResizeObserver(hueco).observe(b));
    }
    window.addEventListener("resize", hueco);
}

empezarEscribirWeb();
