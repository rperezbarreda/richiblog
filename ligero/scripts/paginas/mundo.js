/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/paginas/mundo.js
*/
initializeMundo();
async function initializeMundo() {
    const caja = document.querySelector("[data-mundo-indice]");
    if (!caja || typeof window.pedirDatos !== "function") {
        return;
    }
    pintarRegionesMundo();
    pintarPortadaMundo(caja);
    const pedidas = leerCategoriasMundo(caja);
    const fuente = (caja.getAttribute("data-mundo-datos") || "").trim();
    if (!fuente) {
        return;
    }
    let fichas = null;
    try {
        const respuesta = await window.pedirDatos(fuente);
        if (!respuesta.ok) {
            throw new Error("La respuesta no fue correcta");
        }
        fichas = await respuesta.json();
    } catch (error) {
        caja.innerHTML =
            '<p class="entries-error">No se ha podido cargar el mundo ahora mismo.</p>';
        return;
    }
    pintarElMundo(caja, Array.isArray(fichas) ? fichas : [], await pedidas);
}
async function leerCategoriasMundo(caja) {
    const fuente = (caja.getAttribute("data-mundo-categorias") || "").trim();
    if (!fuente) {
        return [];
    }
    try {
        const respuesta = await window.pedirDatos(fuente);
        if (!respuesta.ok) {
            return [];
        }
        const lista = await respuesta.json();
        return Array.isArray(lista) ? lista.filter((c) => c && (c.nombre || "").toString().trim()) : [];
    } catch (error) {
        return [];
    }
}
function pintarElMundo(caja, fichas, categorias) {
    const buenas = fichas.filter((f) => f && (f.titulo || "").toString().trim());
    caja.textContent = "";
    if (!buenas.length) {
        const vacio = document.createElement("p");
        vacio.className = "entries-empty";
        vacio.textContent = "Todavía no hay nada escrito del mundo.";
        caja.appendChild(vacio);
        return;
    }
    const orden = [];
    const porGrupo = new Map();
    buenas.forEach((ficha) => {
        const grupo = (ficha.grupo || "").toString().trim() || "lo demás";
        if (!porGrupo.has(grupo)) {
            porGrupo.set(grupo, []);
            orden.push(grupo);
        }
        porGrupo.get(grupo).push(ficha);
    });
    const botones = document.createElement("ul");
    botones.className = "mundo-secciones";
    botones.setAttribute("data-mundo-secciones", "");
    const iconos = new Map((categorias || []).map((c) => [c.nombre.toString().trim(),
        (c.icono || "").toString().trim()]));
    const secciones = [...iconos.keys()];
    orden.forEach((grupo) => {
        if (!secciones.includes(grupo)) {
            secciones.push(grupo);
        }
    });
    secciones.forEach((grupo) => {
        if (grupo === "mapas") {
            return;
        }
        const fichas = porGrupo.get(grupo) || [];
        const li = document.createElement("li");
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = fichas.length ? "mundo-seccion" : "mundo-seccion es-vacia";
        boton.setAttribute("aria-haspopup", "dialog");
        if (iconos.get(grupo)) {
            const icono = document.createElement("span");
            icono.className = "mundo-seccion-icono";
            icono.setAttribute("aria-hidden", "true");
            icono.textContent = iconos.get(grupo);
            boton.appendChild(icono);
        }
        const nombre = document.createElement("span");
        nombre.className = "mundo-seccion-nombre";
        nombre.textContent = grupo;
        boton.appendChild(nombre);
        const cuenta = document.createElement("span");
        cuenta.className = "mundo-seccion-cuenta";
        const n = new Set(fichas.map((f) => f.url)).size;
        cuenta.textContent = !n ? "todavía vacía"
            : (n === 1 ? "1 página" : n + " páginas");
        boton.appendChild(cuenta);
        boton.addEventListener("click", () => abrirSeccionMundo(grupo, fichas, boton));
        li.appendChild(boton);
        botones.appendChild(li);
    });
    caja.appendChild(botones);
    MUNDO_SECCIONES.porGrupo = porGrupo;
    MUNDO_SECCIONES.botones = botones;
    const resultados = document.createElement("div");
    resultados.className = "mundo-resultados";
    resultados.setAttribute("data-mundo-resultados", "");
    resultados.hidden = true;
    orden.forEach((grupo) => {
        resultados.appendChild(bloqueDeGrupoMundo(grupo, porGrupo.get(grupo)));
    });
    caja.appendChild(resultados);
    pintarLosMapasDelMundo(buenas);
    pintarDestacadoMundo(buenas);
    prepararAzarMundo(buenas);
    abrirDesdeLaDireccionMundo();
    window.addEventListener("hashchange", abrirDesdeLaDireccionMundo);
    document.dispatchEvent(new CustomEvent("filtros:actualizar"));
}
function bloqueDeGrupoMundo(grupo, fichas) {
    const bloque = document.createElement("details");
    bloque.className = "mundo-grupo";
    bloque.setAttribute("data-mundo-grupo", grupo);
    bloque.open = !MUNDO_CERRADOS.has(grupo);
    bloque.addEventListener("toggle", () => recordarGrupoMundo(bloque));
    const titulo = document.createElement("summary");
    titulo.className = "mundo-grupo-titulo";
    const flecha = document.createElement("span");
    flecha.className = "mundo-grupo-flecha";
    flecha.setAttribute("aria-hidden", "true");
    flecha.textContent = "▾";
    titulo.appendChild(flecha);
    const nombre = document.createElement("span");
    nombre.textContent = grupo;
    titulo.appendChild(nombre);
    const cuenta = document.createElement("span");
    cuenta.className = "mundo-grupo-cuenta";
    cuenta.setAttribute("data-mundo-cuenta", "");
    titulo.appendChild(cuenta);
    bloque.appendChild(titulo);
    const sueltas = fichas.filter((f) => !etiquetasDeReparto(f).length);
    if (sueltas.length) {
        bloque.appendChild(listaDeFichasMundo(sueltas));
    }
    const porEtiqueta = new Map();
    fichas.forEach((ficha) => {
        etiquetasDeReparto(ficha).forEach((e) => {
            if (!porEtiqueta.has(e)) {
                porEtiqueta.set(e, []);
            }
            porEtiqueta.get(e).push(ficha);
        });
    });
    [...porEtiqueta.keys()].forEach((e) => {
        bloque.appendChild(subapartadoMundo(grupo, e, porEtiqueta.get(e)));
    });
    return bloque;
}
function subapartadoMundo(grupo, nombre, fichas) {
    const clave = grupo + "/" + nombre;
    const sub = document.createElement("details");
    sub.className = "mundo-sub";
    sub.setAttribute("data-mundo-sub", nombre);
    sub.setAttribute("data-mundo-clave", clave);
    sub.id = idDeSubMundo(nombre);
    sub.open = !MUNDO_CERRADOS.has(clave);
    sub.addEventListener("toggle", () => recordarPlegadoMundo(sub, clave));
    const cabecera = document.createElement("summary");
    cabecera.className = "mundo-sub-cabecera";
    const flecha = document.createElement("span");
    flecha.className = "mundo-sub-flecha";
    flecha.setAttribute("aria-hidden", "true");
    flecha.textContent = "▾";
    cabecera.appendChild(flecha);
    const suyo = document.createElement("h3");
    suyo.className = "mundo-sub-titulo";
    suyo.textContent = nombre;
    cabecera.appendChild(suyo);
    const cuenta = document.createElement("span");
    cuenta.className = "mundo-grupo-cuenta";
    cuenta.setAttribute("data-mundo-sub-cuenta", "");
    cabecera.appendChild(cuenta);
    sub.appendChild(cabecera);
    if (fichas.some((f) => (f.region || "").toString().trim())) {
        sub.appendChild(porRegionesMundo(nombre, fichas));
    } else {
        sub.appendChild(listaDeFichasMundo(fichas));
    }
    return sub;
}
function idDeSubMundo(nombre) {
    return "mundo-" + (nombre || "").toString()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function porRegionesMundo(parte, fichas, soloPaises) {
    const llano = (texto) => (texto || "").toString().trim().toLowerCase();
    const deParte = llano(parte);
    const regiones = new Map();
    fichas.forEach((f) => {
        const suya = llano(f.region);
        if (suya && suya !== deParte) {
            regiones.set(suya, (f.region || "").toString().trim());
        }
    });
    const caja = document.createElement("div");
    caja.className = "mundo-por-regiones";
    const directas = fichas
        .filter((f) => !regiones.has(llano(f.region)) && !regiones.has(llano(f.titulo)))
        .filter((f) => !soloPaises || llano(f.titulo) !== deParte)
        .sort((a, b) => (llano(a.titulo) === deParte ? -1 : 0) - (llano(b.titulo) === deParte ? -1 : 0));
    if (directas.length && soloPaises && regiones.size) {
        const bloque = document.createElement("div");
        bloque.className = "mundo-region";
        const titulo = document.createElement("h4");
        titulo.className = "mundo-region-titulo";
        titulo.textContent = "Independientes ";
        const cuenta = document.createElement("span");
        cuenta.className = "mundo-grupo-cuenta";
        cuenta.setAttribute("data-mundo-region-cuenta", "");
        cuenta.textContent = String(directas.length);
        titulo.appendChild(cuenta);
        bloque.appendChild(titulo);
        bloque.appendChild(listaDeFichasMundo(directas, true));
        caja.appendChild(bloque);
    } else if (directas.length) {
        caja.appendChild(listaDeFichasMundo(directas, true));
    }
    const madreDe = (llave) => {
        const propia = fichas.find((f) => llano(f.titulo) === llave);
        const suya = propia ? llano(propia.region) : "";
        return regiones.has(suya) ? suya : "";
    };
    const porNombre = (a, b) => a.localeCompare(b, "es");
    const enOrden = [];
    [...regiones.keys()].filter((k) => !madreDe(k)).sort(porNombre).forEach((llave) => {
        enOrden.push(llave);
        [...regiones.keys()].filter((k) => madreDe(k) === llave).sort(porNombre)
            .forEach((hija) => enOrden.push(hija));
    });
    [...regiones.keys()].forEach((k) => {
        if (!enOrden.includes(k)) {
            enOrden.push(k);
        }
    });
    enOrden.forEach((llave) => {
        const propia = fichas.find((f) => llano(f.titulo) === llave);
        const hijas = fichas.filter((f) => llano(f.region) === llave && !regiones.has(llano(f.titulo)));
        const madre = madreDe(llave);
        const bloque = document.createElement("div");
        bloque.className = madre ? "mundo-region es-dentro" : "mundo-region";
        const titulo = document.createElement("h4");
        titulo.className = "mundo-region-titulo";
        titulo.textContent = propia ? propia.titulo : regiones.get(llave);
        if (madre) {
            const dentro = document.createElement("span");
            dentro.className = "mundo-region-dentro";
            dentro.textContent = " · en " + regiones.get(madre);
            titulo.appendChild(dentro);
        }
        const cuenta = document.createElement("span");
        cuenta.className = "mundo-grupo-cuenta";
        cuenta.setAttribute("data-mundo-region-cuenta", "");
        titulo.appendChild(document.createTextNode(" "));
        titulo.appendChild(cuenta);
        bloque.appendChild(titulo);
        const suyas = propia && !soloPaises ? [propia, ...hijas] : hijas;
        if (soloPaises) {
            cuenta.textContent = String(suyas.length);
        }
        bloque.appendChild(listaDeFichasMundo(suyas, true));
        caja.appendChild(bloque);
    });
    return caja;
}
const MUNDO_CERRADOS = leerCerradosMundo();
function leerCerradosMundo() {
    try {
        const crudo = window.localStorage.getItem("richi-mundo-cerrados");
        return new Set(crudo ? JSON.parse(crudo) : []);
    } catch (error) {
        return new Set();
    }
}
function recordarGrupoMundo(bloque) {
    recordarPlegadoMundo(bloque, bloque.getAttribute("data-mundo-grupo"));
}
function recordarPlegadoMundo(bloque, grupo) {
    if (bloque.hasAttribute("data-mundo-forzado")) {
        return;
    }
    if (bloque.open) {
        MUNDO_CERRADOS.delete(grupo);
    } else {
        MUNDO_CERRADOS.add(grupo);
    }
    try {
        window.localStorage.setItem("richi-mundo-cerrados", JSON.stringify([...MUNDO_CERRADOS]));
    } catch (error) {
    }
}
function pintarLosMapasDelMundo(fichas) {
    const caja = document.querySelector("[data-mundo-vistas]");
    if (!caja) {
        return;
    }
    const mapas = fichas.filter((f) => (f.vista || "").toString().trim() ||
        (f.mini && Array.isArray(f.mini.cosas)));
    caja.hidden = !mapas.length && !MUNDO_CALENDARIO.tarjeta;
    caja.querySelectorAll(".mundo-vista").forEach((vieja) => vieja.remove());
    mapas.forEach((ficha) => caja.appendChild(
        ficha.mini ? tarjetaDeLineaMundo(ficha) : tarjetaDeMapaMundo(ficha)));
    colocarCalendarioMundo();
    caja.querySelectorAll(".mundo-mini-lista").forEach(colocarLineaEnPequenoMundo);
    ponerTituloDeVistasMundo();
}
function ponerTituloDeVistasMundo() {
    const caja = document.querySelector("[data-mundo-vistas]");
    const titulo = caja ? caja.querySelector(".mundo-vistas-titulo") : null;
    if (!titulo) {
        return;
    }
    const partes = [];
    if (caja.querySelector(".mundo-vista-mapa")) {
        partes.push("mapas");
    }
    if (caja.querySelector(".mundo-vista-calendario")) {
        partes.push("calendario");
    }
    if (caja.querySelector(".mundo-vista-linea")) {
        partes.push("línea de tiempo");
    }
    const solo = { "mapas": "los mapas", "calendario": "el calendario", "línea de tiempo": "la línea de tiempo" };
    titulo.textContent = partes.length < 2 ? solo[partes[0] || "mapas"]
        : partes.slice(0, -1).join(", ") + " y " + partes[partes.length - 1];
}
const MINI_PX_POR_REM = 6;
const MINI_ARRIBA = 14;
const MINI_ABAJO = 44;
function tarjetaDeLineaMundo(ficha) {
    const caja = document.createElement("div");
    caja.className = "mundo-vista mundo-vista-linea";
    const marco = document.createElement("div");
    marco.className = "mundo-mini";
    const mini = ficha.mini || {};
    const alto = Number(mini.alto) || 0;
    const lista = document.createElement("ol");
    lista.className = "mundo-mini-lista";
    lista.setAttribute("aria-label", "La línea de tiempo, en pequeño");
    lista.style.height = Math.round(MINI_ARRIBA + alto * MINI_PX_POR_REM + MINI_ABAJO) + "px";
    const eje = document.createElement("span");
    eje.className = "mundo-mini-eje";
    eje.setAttribute("aria-hidden", "true");
    eje.style.top = MINI_ARRIBA + "px";
    eje.style.height = Math.round(alto * MINI_PX_POR_REM) + "px";
    lista.appendChild(eje);
    (Array.isArray(mini.cosas) ? mini.cosas : []).forEach((cosa) => {
        const y = MINI_ARRIBA + (Number(cosa.y) || 0) * MINI_PX_POR_REM;
        const hasta = MINI_ARRIBA + (Number(cosa.hasta) || 0) * MINI_PX_POR_REM;
        let item = null;
        if (cosa.tipo === "era") {
            item = eraEnPequenoMundo(cosa);
            item.dataset.hasta = String(hasta);
        } else if (cosa.tipo === "evento") {
            item = eventoEnPequenoMundo(cosa);
        } else if (cosa.tipo === "hoy") {
            item = document.createElement("li");
            item.className = "mundo-mini-hoy";
            item.textContent = (cosa.texto || "").toString().trim();
        } else if (cosa.tipo === "corte") {
            item = document.createElement("li");
            item.className = "mundo-mini-corte";
            item.setAttribute("aria-hidden", "true");
            item.textContent = "≈";
        }
        if (item) {
            item.dataset.y = String(y);
            item.style.top = Math.round(y) + "px";
            lista.appendChild(item);
        }
    });
    marco.appendChild(lista);
    caja.appendChild(marco);
    const enlace = document.createElement("a");
    enlace.className = "mundo-vista-titulo mundo-mini-titulo";
    enlace.href = rutaSeguraMundo(ficha.url);
    enlace.textContent = (ficha.titulo || "").toString().trim();
    caja.appendChild(enlace);
    const que = document.createElement("span");
    que.className = "mundo-vista-que";
    que.textContent = (ficha.que || "").toString().trim();
    caja.appendChild(que);
    return caja;
}
function eraEnPequenoMundo(cosa) {
    const item = document.createElement("li");
    item.className = "mundo-mini-era" + (cosa.par === false ? " es-impar" : "");
    const color = (cosa.color || "").toString().trim();
    if (/^#[0-9a-fA-F]{6}$/.test(color)) {
        item.style.setProperty("--era-color", color);
    }
    const enlace = document.createElement("a");
    enlace.className = "mundo-mini-era-nombre";
    enlace.href = rutaSeguraMundo(cosa.url);
    enlace.textContent = (cosa.nombre || "").toString().trim();
    const fechas = (cosa.fechas || "").toString().trim();
    if (fechas) {
        enlace.title = fechas;
        const oculto = document.createElement("span");
        oculto.className = "visually-hidden";
        oculto.textContent = ", era, " + fechas;
        enlace.appendChild(oculto);
    }
    item.appendChild(enlace);
    return item;
}
function eventoEnPequenoMundo(cosa) {
    const item = document.createElement("li");
    item.className = "mundo-mini-evento es-" + (cosa.lado === "derecha" ? "derecha" : "izquierda");
    const enlace = document.createElement("a");
    enlace.className = "mundo-mini-recuadro";
    enlace.href = rutaSeguraMundo(cosa.url);
    const fecha = document.createElement("span");
    fecha.className = "mundo-mini-fecha";
    fecha.textContent = (cosa.fecha || "").toString().trim();
    const nombre = document.createElement("span");
    nombre.className = "mundo-mini-nombre";
    nombre.textContent = (cosa.nombre || "").toString().trim();
    enlace.appendChild(fecha);
    enlace.appendChild(nombre);
    item.appendChild(enlace);
    return item;
}
const MINI_HOLGURA = 5;
function colocarLineaEnPequenoMundo(lista) {
    const items = Array.from(lista.children).filter((e) => e.dataset && e.dataset.y);
    let extra = 0;
    const fondo = { izquierda: -Infinity, derecha: -Infinity, centro: -Infinity };
    const mudanzas = [];
    items.forEach((item) => {
        const base = Number(item.dataset.y) || 0;
        let y = base + extra;
        if (item.classList.contains("mundo-mini-evento")) {
            const caja = item.querySelector(".mundo-mini-recuadro");
            const alto = caja ? caja.offsetHeight : 0;
            const lado = item.classList.contains("es-derecha") ? "derecha" : "izquierda";
            const arriba = y - 9;
            const tope = Math.max(fondo[lado], fondo.centro) + MINI_HOLGURA;
            if (arriba < tope) {
                extra += tope - arriba;
                y = base + extra;
            }
            fondo[lado] = y - 9 + alto;
        } else if (item.classList.contains("mundo-mini-era") ||
                   item.classList.contains("mundo-mini-hoy")) {
            const rotulo = item.querySelector(".mundo-mini-era-nombre") || item;
            const alto = rotulo.offsetHeight + 3;
            const tope = Math.max(fondo.izquierda, fondo.derecha, fondo.centro) + MINI_HOLGURA;
            if (y < tope) {
                extra += tope - y;
                y = base + extra;
            }
            fondo.centro = y + alto;
        }
        mudanzas.push([base, extra]);
        item.style.top = Math.round(y) + "px";
    });
    const final = (yEscala) => {
        let bajado = 0;
        mudanzas.forEach(([base, extraAhi]) => {
            if (base <= yEscala) {
                bajado = extraAhi;
            }
        });
        return yEscala + bajado;
    };
    items.forEach((item) => {
        if (item.classList.contains("mundo-mini-era")) {
            const desde = parseFloat(item.style.top) || 0;
            const hasta = final(Number(item.dataset.hasta) || 0);
            item.style.height = Math.max(Math.round(hasta - desde), 2) + "px";
        }
    });
    const ultimo = Math.max(fondo.izquierda, fondo.derecha, fondo.centro, 0);
    const eje = lista.querySelector(".mundo-mini-eje");
    const ultimoPunto = items.filter((e) => e.classList.contains("mundo-mini-evento")).pop();
    const hoy = items.find((e) => e.classList.contains("mundo-mini-hoy"));
    const finEje = Math.max(ultimoPunto ? parseFloat(ultimoPunto.style.top) : 0,
        hoy ? parseFloat(hoy.style.top) : 0,
        ...items.filter((e) => e.classList.contains("mundo-mini-era"))
            .map((e) => (parseFloat(e.style.top) || 0) + (parseFloat(e.style.height) || 0)));
    if (eje) {
        eje.style.height = Math.max(Math.round(finEje - MINI_ARRIBA), 0) + "px";
    }
    lista.style.height = Math.round(Math.max(ultimo, finEje) + 12) + "px";
    if (!lista.dataset.vigilada && typeof ResizeObserver === "function") {
        lista.dataset.vigilada = "1";
        let anchos = "";
        const vigia = new ResizeObserver(() => {
            const ahora = Array.from(lista.querySelectorAll(".mundo-mini-recuadro"))
                .map((e) => e.offsetWidth + "x" + e.offsetHeight).join(",");
            if (ahora !== anchos) {
                anchos = ahora;
                colocarLineaEnPequenoMundo(lista);
            }
        });
        lista.querySelectorAll(".mundo-mini-recuadro").forEach((e) => vigia.observe(e));
    }
}
function tarjetaDeMapaMundo(ficha) {
    const enlace = document.createElement("a");
    enlace.className = "mundo-vista mundo-vista-mapa";
    enlace.href = rutaSeguraMundo(ficha.url);
    const marco = document.createElement("span");
    marco.className = "mundo-vista-marco";
    const dibujo = document.createElement("img");
    dibujo.className = "mundo-vista-img";
    dibujo.src = rutaSeguraMundo(ficha.vista);
    dibujo.alt = "";
    dibujo.setAttribute("loading", "lazy");
    dibujo.setAttribute("decoding", "async");
    marco.appendChild(dibujo);
    enlace.appendChild(marco);
    const nombre = document.createElement("strong");
    nombre.className = "mundo-vista-titulo";
    nombre.textContent = (ficha.titulo || "").toString().trim();
    enlace.appendChild(nombre);
    const que = document.createElement("span");
    que.className = "mundo-vista-que";
    que.textContent = (ficha.que || "mapa interactivo").toString().trim();
    enlace.appendChild(que);
    return enlace;
}
function etiquetasDeReparto(ficha) {
    return (Array.isArray(ficha.sub) ? ficha.sub : [])
        .map((e) => (e || "").toString().trim())
        .filter(Boolean);
}
function listaDeFichasMundo(fichas, corta) {
    const lista = document.createElement("ul");
    lista.className = corta ? "mundo-items es-corta" : "mundo-items";
    fichas.forEach((ficha) => lista.appendChild(itemDelMundo(ficha, corta)));
    return lista;
}
function itemDelMundo(ficha, corto) {
    const item = document.createElement("li");
    item.className = "mundo-ficha-item";
    const etiquetas = (Array.isArray(ficha.etiquetas) ? ficha.etiquetas : [])
        .map((e) => (e || "").toString().trim())
        .filter(Boolean);
    item.setAttribute("data-categoria", etiquetas.join(", "));
    item.setAttribute("data-mundo-url", (ficha.url || "").toString());
    const enlace = document.createElement("a");
    enlace.className = "mundo-item";
    enlace.href = rutaSeguraMundo(ficha.url);
    if (corto) {
        const bandera = rutaSeguraMundo(ficha.bandera || ficha.miniatura);
        if (bandera !== "#") {
            const img = document.createElement("img");
            img.className = "mundo-item-bandera";
            img.src = bandera;
            img.alt = "";
            img.width = 150;
            img.height = 100;
            img.setAttribute("loading", "lazy");
            img.setAttribute("decoding", "async");
            enlace.appendChild(img);
        } else {
            const hueco = document.createElement("span");
            hueco.className = "mundo-item-bandera es-hueco";
            hueco.setAttribute("aria-hidden", "true");
            enlace.appendChild(hueco);
        }
    }
    const titulo = document.createElement("strong");
    titulo.className = "mundo-item-titulo";
    titulo.textContent = ficha.titulo.toString().trim();
    enlace.appendChild(titulo);
    if (corto) {
        item.appendChild(enlace);
        return item;
    }
    const que = (ficha.que || "").toString().trim();
    if (que) {
        const linea = document.createElement("span");
        linea.className = "mundo-item-que";
        linea.textContent = que;
        enlace.appendChild(linea);
    }
    const resumen = (ficha.resumen || "").toString().trim();
    if (resumen) {
        const linea = document.createElement("span");
        linea.className = "mundo-item-resumen";
        linea.textContent = resumen;
        enlace.appendChild(linea);
    }
    item.appendChild(enlace);
    return item;
}
function rutaSeguraMundo(url) {
    const limpia = (url || "").toString().trim();
    if (/^\/(?!\/)/.test(limpia) || /^(https?:\/\/|mailto:|#)/i.test(limpia)) {
        return limpia;
    }
    return "#";
}
document.addEventListener("filtros:cambiado", repasarGruposMundo);
document.addEventListener("filtros:actualizar", repasarGruposMundo);
document.addEventListener("buscar:cambiado", () => {
    if (!window.buscador) {
        return;
    }
    document.querySelectorAll("[data-mundo-indice] .mundo-ficha-item").forEach((item) => {
        item.hidden = !window.buscador.pasa(item);
    });
    const regiones = document.querySelector("[data-mundo-regiones]");
    if (regiones && regiones.hasAttribute("data-mundo-cargado")) {
        regiones.hidden = !!window.buscador.texto;
    }
    const buscando = !!window.buscador.texto;
    document.querySelectorAll("[data-mundo-destacado], [data-mundo-cambios]").forEach((bloque) => {
        if (bloque.hasAttribute("data-mundo-cargado")) {
            bloque.hidden = buscando;
        }
    });
    const resultados = document.querySelector("[data-mundo-resultados]");
    const secciones = document.querySelector("[data-mundo-secciones]");
    if (resultados) {
        resultados.hidden = !buscando;
    }
    if (secciones) {
        secciones.hidden = buscando;
    }
    repasarGruposMundo();
});
function repasarGruposMundo() {
    const rebuscandoSub = !!(window.buscador && window.buscador.texto);
    document.querySelectorAll(".mundo-region").forEach((region) => {
        const vivos = [...region.querySelectorAll(".mundo-ficha-item")]
            .filter((item) => !item.hidden).length;
        region.hidden = vivos === 0;
        const cuenta = region.querySelector("[data-mundo-region-cuenta]");
        if (cuenta) {
            cuenta.textContent = String(vivos);
        }
    });
    document.querySelectorAll(".mundo-sub").forEach((sub) => {
        const vivos = [...sub.querySelectorAll(".mundo-ficha-item")]
            .filter((item) => !item.hidden).length;
        sub.hidden = vivos === 0;
        const cuenta = sub.querySelector("[data-mundo-sub-cuenta]");
        if (cuenta) {
            cuenta.textContent = vivos === 1 ? "1" : String(vivos);
        }
        if (rebuscandoSub && vivos && !sub.open) {
            sub.setAttribute("data-mundo-forzado", "");
            sub.open = true;
        } else if (!rebuscandoSub && sub.hasAttribute("data-mundo-forzado")) {
            sub.open = false;
            sub.removeAttribute("data-mundo-forzado");
        }
    });
    const rebuscando = !!(window.buscador && window.buscador.texto)
        || [...document.querySelectorAll(".filtro-btn")]
            .some((b) => b.getAttribute("aria-pressed") === "true"
                && b.getAttribute("data-categoria") !== "todas");
    document.querySelectorAll(".mundo-grupo").forEach((grupo) => {
        const items = [...grupo.querySelectorAll(".mundo-ficha-item")]
            .filter((item) => !item.hidden);
        const vivos = new Set(items.map((item) => item.getAttribute("data-mundo-url"))).size;
        grupo.hidden = vivos === 0;
        const cuenta = grupo.querySelector("[data-mundo-cuenta]");
        if (cuenta) {
            const nombre = grupo.getAttribute("data-mundo-grupo") === "mapas"
                ? ["1 mapa", " mapas"]
                : ["1 página", " páginas"];
            cuenta.textContent = vivos === 1 ? nombre[0] : vivos + nombre[1];
        }
        if (rebuscando && vivos && !grupo.open) {
            grupo.setAttribute("data-mundo-forzado", "");
            grupo.open = true;
        } else if (!rebuscando && grupo.hasAttribute("data-mundo-forzado")) {
            grupo.open = false;
            grupo.removeAttribute("data-mundo-forzado");
        }
    });
}
document.addEventListener("click", (evento) => {
    const tapado = evento.target.closest(".mundo-spoiler");
    if (tapado) {
        destaparMundo(tapado);
    }
});
document.addEventListener("keydown", (evento) => {
    if (evento.key !== "Enter" && evento.key !== " ") {
        return;
    }
    const tapado = document.activeElement
        && document.activeElement.classList
        && document.activeElement.classList.contains("mundo-spoiler")
        ? document.activeElement
        : null;
    if (tapado) {
        evento.preventDefault();
        destaparMundo(tapado);
    }
});
function destaparMundo(tapado) {
    if (tapado.classList.contains("esta-abierto")) {
        return;
    }
    tapado.classList.add("esta-abierto");
    tapado.removeAttribute("role");
    tapado.removeAttribute("tabindex");
}
prepararEmblemasMundo();
prepararAmpliarMundo();
function prepararAmpliarMundo() {
    if (!window.lupa) {
        return;
    }
    const imagenes = document.querySelectorAll(
        ".mundo-articulo img, .mundo-ficha img"
    );
    imagenes.forEach((img) => {
        if (img.closest("a, button, .mundo-spoiler")) {
            return;
        }
        const nombre = (img.getAttribute("alt") || "").trim();
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "mundo-ampliar";
        boton.setAttribute(
            "aria-label",
            nombre ? "Ver en grande: " + nombre : "Ver la imagen en grande"
        );
        img.parentNode.insertBefore(boton, img);
        boton.appendChild(img);
        boton.addEventListener("click", () => abrirAmpliadaMundo(boton, img));
    });
}
function abrirAmpliadaMundo(boton, img) {
    const figura = boton.closest("figure");
    const pie = figura && !boton.closest(".mundo-emblema")
        ? figura.querySelector("figcaption") : null;
    const nombre = (img.getAttribute("alt") || "").trim();
    window.lupa.abrir({
        ruta: img.currentSrc || img.getAttribute("src"),
        texto: pie ? pie.textContent.trim() : nombre,
        que: "",
        alt: nombre,
        devolverA: boton,
    });
}
async function pintarRegionesMundo() {
    const caja = document.querySelector("[data-mundo-regiones]");
    if (!caja) {
        return;
    }
    const fuente = (caja.getAttribute("data-mundo-regiones-datos") || "").trim();
    let partes = null;
    try {
        const respuesta = await window.pedirDatos(fuente);
        if (!respuesta.ok) {
            throw new Error("La respuesta no fue correcta");
        }
        partes = await respuesta.json();
    } catch (error) {
        return;
    }
    if (!Array.isArray(partes) || !partes.length) {
        return;
    }
    const lista = document.createElement("ul");
    lista.className = "mundo-partes";
    partes.forEach((parte) => {
        if (!parte || !(parte.nombre || "").toString().trim()) {
            return;
        }
        const item = document.createElement("li");
        item.className = "mundo-parte";
        item.appendChild(teselaDeRegionMundo(parte, "mundo-parte-enlace"));
        lista.appendChild(item);
    });
    caja.appendChild(lista);
    caja.setAttribute("data-mundo-cargado", "");
    caja.hidden = !!(window.buscador && window.buscador.texto);
}
function teselaDeRegionMundo(cosa, clase) {
    const nombre = (cosa.nombre || "").toString().trim();
    const enlace = document.createElement("a");
    enlace.className = clase;
    const url = (cosa.url || "").toString().trim();
    enlace.href = url ? rutaSeguraMundo(url) : "#" + idDeSubMundo(nombre);
    if (!url) {
        enlace.addEventListener("click", () => {
            if (decodeURIComponent(window.location.hash.slice(1)) === idDeSubMundo(nombre)) {
                abrirDesdeLaDireccionMundo();
            }
        });
    }
    const imagen = rutaSeguraMundo(cosa.imagen);
    if (imagen !== "#") {
        const img = document.createElement("img");
        img.className = clase + "-img";
        img.src = imagen;
        img.alt = "";
        img.width = 360;
        img.height = 240;
        img.setAttribute("loading", "lazy");
        img.setAttribute("decoding", "async");
        enlace.appendChild(img);
    }
    const texto = document.createElement("span");
    texto.className = clase + "-texto";
    const fuerte = document.createElement("strong");
    fuerte.className = clase + "-nombre";
    fuerte.textContent = nombre;
    texto.appendChild(fuerte);
    const n = Number(cosa.cuenta) || 0;
    if (n) {
        const cuenta = document.createElement("span");
        cuenta.className = clase + "-cuenta";
        cuenta.textContent = n === 1 ? "1 página" : n + " páginas";
        texto.appendChild(cuenta);
    }
    enlace.appendChild(texto);
    return enlace;
}
function prepararEmblemasMundo() {
    document.querySelectorAll("[data-mundo-emblemas]").forEach((caja) => {
        const cuales = [...caja.querySelectorAll("[data-mundo-emblema]")];
        if (cuales.length < 2) {
            return;
        }
        caja.setAttribute("role", "group");
        caja.setAttribute("aria-roledescription", "carrusel");
        caja.setAttribute("aria-label", "Bandera, blasón y mapa");
        const mandos = document.createElement("div");
        mandos.className = "mundo-carrusel";
        const flecha = (texto, nombre) => {
            const boton = document.createElement("button");
            boton.type = "button";
            boton.className = "mundo-carrusel-flecha";
            boton.setAttribute("aria-label", nombre);
            const dibujo = document.createElement("span");
            dibujo.setAttribute("aria-hidden", "true");
            dibujo.textContent = texto;
            boton.appendChild(dibujo);
            return boton;
        };
        const antes = flecha("‹", "Anterior");
        const despues = flecha("›", "Siguiente");
        const cual = document.createElement("p");
        cual.className = "mundo-carrusel-cual";
        cual.setAttribute("aria-live", "polite");
        let ahora = 0;
        const enseñar = (n) => {
            ahora = (n + cuales.length) % cuales.length;
            cuales.forEach((li, k) => {
                li.hidden = k !== ahora;
            });
            cual.textContent = (cuales[ahora].getAttribute("data-mundo-emblema") || "")
                + " · " + (ahora + 1) + " de " + cuales.length;
        };
        antes.addEventListener("click", () => enseñar(ahora - 1));
        despues.addEventListener("click", () => enseñar(ahora + 1));
        mandos.appendChild(antes);
        mandos.appendChild(cual);
        mandos.appendChild(despues);
        caja.appendChild(mandos);
        caja.classList.add("con-botones");
        enseñar(0);
    });
}
const MUNDO_SECCIONES = { porGrupo: null, botones: null };
function abrirSeccionMundo(grupo, fichas, boton, irA) {
    if (!window.ventanaModal) {
        return;
    }
    window.ventanaModal.abrir({
        titulo: grupo.toString().toLowerCase().replace(/\s+/g, "_") + ".lst",
        clase: "modal-mundo",
        devolverA: boton,
        llenar: (cuerpo) => {
            cuerpo.appendChild(contenidoDeSeccionMundo(grupo, fichas, irA));
            if (irA) {
                const destino = cuerpo.querySelector("#" + irA);
                if (destino) {
                    requestAnimationFrame(() => destino.scrollIntoView({ block: "start" }));
                    return destino;
                }
            }
            return null;
        },
    });
}
function contenidoDeSeccionMundo(grupo, fichas, irA) {
    const caja = document.createElement("div");
    caja.className = "mundo-seccion-contenido";
    if (!fichas.length) {
        const vacia = document.createElement("p");
        vacia.className = "mundo-seccion-vacia";
        vacia.textContent = "Todavía no hay ninguna página aquí. Sale en cuanto una "
            + "página lleve una de las etiquetas de «" + grupo + "».";
        caja.appendChild(vacia);
        return caja;
    }
    const sueltas = fichas.filter((f) => !etiquetasDeReparto(f).length);
    if (sueltas.length) {
        caja.appendChild(listaDeFichasMundo(sueltas));
    }
    const porEtiqueta = new Map();
    fichas.forEach((ficha) => {
        etiquetasDeReparto(ficha).forEach((e) => {
            if (!porEtiqueta.has(e)) {
                porEtiqueta.set(e, []);
            }
            porEtiqueta.get(e).push(ficha);
        });
    });
    const llano = (texto) => (texto || "").toString().trim().toLowerCase();
    [...porEtiqueta.keys()].forEach((nombre) => {
        const suyas = porEtiqueta.get(nombre);
        const conRegion = suyas.some((f) => llano(f.region));
        const regiones = new Set(suyas.map((f) => llano(f.region)).filter(Boolean));
        const conSubregiones = [...regiones].some((r) => r !== llano(nombre));
        const lista = conRegion
            ? suyas.filter((f) => !regiones.has(llano(f.titulo)) && llano(f.titulo) !== llano(nombre))
                .sort((a, b) => a.titulo.localeCompare(b.titulo, "es"))
            : suyas;
        const parte = document.createElement("details");
        parte.className = "mundo-seccion-parte";
        const id = "ventana-" + idDeSubMundo(nombre);
        parte.open = true;
        const cabecera = document.createElement("summary");
        cabecera.className = "mundo-seccion-parte-cabecera";
        cabecera.id = id;
        const flecha = document.createElement("span");
        flecha.className = "mundo-sub-flecha";
        flecha.setAttribute("aria-hidden", "true");
        flecha.textContent = "▾";
        cabecera.appendChild(flecha);
        const titulo = document.createElement("h3");
        titulo.className = "mundo-seccion-parte-titulo";
        titulo.textContent = nombre;
        cabecera.appendChild(titulo);
        const cuenta = document.createElement("span");
        cuenta.className = "mundo-grupo-cuenta";
        const n = new Set(lista.map((f) => f.url)).size;
        cuenta.textContent = conRegion
            ? (n === 1 ? "1 país" : n + " países")
            : (n === 1 ? "1 página" : n + " páginas");
        cabecera.appendChild(cuenta);
        parte.appendChild(cabecera);
        parte.appendChild(conSubregiones
            ? porRegionesMundo(nombre, suyas, true)
            : listaDeFichasMundo(lista, conRegion));
        caja.appendChild(parte);
    });
    return caja;
}
function abrirDesdeLaDireccionMundo() {
    const hash = decodeURIComponent((window.location.hash || "").slice(1));
    if (!/^mundo-[a-z0-9-]+$/.test(hash) || !MUNDO_SECCIONES.porGrupo) {
        return;
    }
    for (const [grupo, fichas] of MUNDO_SECCIONES.porGrupo) {
        const tiene = fichas.some((f) => etiquetasDeReparto(f)
            .some((e) => idDeSubMundo(e) === hash));
        if (tiene) {
            const boton = [...MUNDO_SECCIONES.botones.querySelectorAll(".mundo-seccion")]
                .find((b) => b.querySelector(".mundo-seccion-nombre").textContent === grupo);
            abrirSeccionMundo(grupo, fichas, boton || null, "ventana-" + hash);
            return;
        }
    }
}
const CONTENIDO_GUARDADO = "richi-contenido-plegado";
prepararContenidoMundo();
function prepararContenidoMundo() {
    const plegable = document.querySelector("[data-mundo-contenido]");
    if (!plegable) {
        return;
    }
    try {
        if (localStorage.getItem(CONTENIDO_GUARDADO) === "si") {
            plegable.open = false;
        }
    } catch (error) {
    }
    ajustarContenidoMundo(plegable);
    plegable.addEventListener("toggle", () => {
        try {
            if (plegable.open) {
                localStorage.removeItem(CONTENIDO_GUARDADO);
            } else {
                localStorage.setItem(CONTENIDO_GUARDADO, "si");
            }
        } catch (error) {
        }
    });
}
function paginasConTextoMundo(fichas) {
    const deRelleno = /\b(está en|es una región)\b/i;
    return fichas.filter((f) => !f.relleno && f.grupo !== "mapas"
        && (f.resumen || "").toString().trim().length > 60
        && !deRelleno.test((f.resumen || "").toString())
        && !(Array.isArray(f.etiquetas) && f.etiquetas.some((e) => (e || "").toString().toLowerCase() === "ejemplo")));
}
async function pintarPortadaMundo(caja) {
    const fuente = (caja.getAttribute("data-mundo-portada") || "").trim();
    if (!fuente) {
        return;
    }
    let datos = null;
    try {
        const respuesta = await window.pedirDatos(fuente);
        if (!respuesta.ok) {
            return;
        }
        datos = await respuesta.json();
    } catch (error) {
        return;
    }
    const hoy = document.querySelector("[data-mundo-hoy]");
    if (hoy && datos && datos.hoy && datos.hoy.anyo) {
        hoy.textContent = "";
        hoy.appendChild(document.createTextNode("Hoy en Cralëa: año " + datos.hoy.anyo));
        if (datos.hoy.era) {
            hoy.appendChild(document.createTextNode(", en la "));
            const era = document.createElement("a");
            era.href = rutaSeguraMundo(datos.hoy.url);
            era.textContent = datos.hoy.era;
            hoy.appendChild(era);
        }
        hoy.appendChild(document.createTextNode("."));
        hoy.hidden = false;
    }
    const cambios = document.querySelector("[data-mundo-cambios]");
    const lista = datos && Array.isArray(datos.cambios) ? datos.cambios : [];
    if (cambios && lista.length) {
        const ul = document.createElement("ul");
        ul.className = "mundo-cambios-lista";
        lista.forEach((cambio) => {
            const li = document.createElement("li");
            const enlace = document.createElement("a");
            enlace.href = rutaSeguraMundo(cambio.url);
            enlace.textContent = (cambio.titulo || "").toString();
            li.appendChild(enlace);
            const fecha = (cambio.fecha || "").toString();
            if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
                const cuando = document.createElement("time");
                cuando.className = "mundo-cambios-fecha";
                cuando.dateTime = fecha;
                cuando.textContent = new Date(fecha + "T12:00:00").toLocaleDateString("es-ES",
                    { day: "numeric", month: "short", year: "numeric" });
                li.appendChild(cuando);
            }
            ul.appendChild(li);
        });
        cambios.appendChild(ul);
        cambios.setAttribute("data-mundo-cargado", "");
        cambios.hidden = !!(window.buscador && window.buscador.texto);
    }
}
function pintarDestacadoMundo(fichas) {
    const caja = document.querySelector("[data-mundo-destacado]");
    const buenas = paginasConTextoMundo(fichas);
    if (!caja || !buenas.length) {
        return;
    }
    caja.textContent = "";
    const dia = Math.floor(Date.now() / 86400000);
    const destacada = buenas[dia % buenas.length];
    const tarjeta = document.createElement("div");
    tarjeta.className = "mundo-destacada";
    const titulo = document.createElement("h2");
    titulo.className = "mundo-regiones-titulo";
    titulo.textContent = "página destacada";
    tarjeta.appendChild(titulo);
    const nombre = document.createElement("a");
    nombre.className = "mundo-destacada-nombre";
    nombre.href = rutaSeguraMundo(destacada.url);
    nombre.textContent = destacada.titulo;
    tarjeta.appendChild(nombre);
    if ((destacada.que || "").toString().trim()) {
        const que = document.createElement("p");
        que.className = "mundo-destacada-que";
        que.textContent = destacada.que;
        tarjeta.appendChild(que);
    }
    const resumen = document.createElement("p");
    resumen.className = "mundo-destacada-resumen";
    resumen.textContent = destacada.resumen;
    tarjeta.appendChild(resumen);
    caja.appendChild(tarjeta);
    const otras = buenas.filter((f) => f !== destacada);
    if (otras.length) {
        const sabias = document.createElement("div");
        sabias.className = "mundo-sabias";
        const suyo = document.createElement("h2");
        suyo.className = "mundo-regiones-titulo";
        suyo.textContent = "¿sabías que…?";
        sabias.appendChild(suyo);
        const ul = document.createElement("ul");
        ul.className = "mundo-sabias-lista";
        const mezcla = otras.slice();
        for (let i = mezcla.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [mezcla[i], mezcla[j]] = [mezcla[j], mezcla[i]];
        }
        mezcla.slice(0, 3).forEach((f) => {
            const li = document.createElement("li");
            const frase = (f.resumen || "").toString().split(/(?<=[.!?])\s/)[0];
            li.appendChild(document.createTextNode(frase + " "));
            const enlace = document.createElement("a");
            enlace.href = rutaSeguraMundo(f.url);
            enlace.textContent = "(" + f.titulo + ")";
            li.appendChild(enlace);
            ul.appendChild(li);
        });
        sabias.appendChild(ul);
        caja.appendChild(sabias);
    }
    caja.setAttribute("data-mundo-cargado", "");
    caja.hidden = !!(window.buscador && window.buscador.texto);
}
function prepararAzarMundo(fichas) {
    const boton = document.querySelector("[data-mundo-azar]");
    const todas = fichas.filter((f) => f.grupo !== "mapas" && rutaSeguraMundo(f.url) !== "#");
    if (!boton || !todas.length) {
        return;
    }
    boton.hidden = false;
    boton.addEventListener("click", () => {
        const una = todas[Math.floor(Math.random() * todas.length)];
        window.location.href = rutaSeguraMundo(una.url);
    });
}
function ajustarContenidoMundo(plegable) {
    const caja = plegable.closest(".mundo-contenido");
    const ficha = document.querySelector(".mundo-ficha");
    if (!caja) {
        return;
    }
    const ajustar = () => {
        if (getComputedStyle(caja).position !== "fixed") {
            caja.style.maxHeight = "";
            return;
        }
        const abajo = parseFloat(getComputedStyle(caja).bottom) || 0;
        let tope = 16;
        if (ficha) {
            const suya = ficha.getBoundingClientRect();
            if (suya.bottom > 0) {
                tope = Math.max(tope, suya.bottom + 16);
            }
        }
        const libre = window.innerHeight - abajo - tope;
        caja.style.maxHeight = Math.round(Math.min(Math.max(libre, 150), window.innerHeight * 0.6)) + "px";
    };
    ajustar();
    document.addEventListener("scroll", ajustar, { capture: true, passive: true });
    window.addEventListener("resize", ajustar);
}
const MUNDO_CALENDARIO = { datos: null, tarjeta: null, mes: 1, dia: null };
const CALENDARIO_DIAS_MES = 28;
pintarCalendarioMundo();
async function pintarCalendarioMundo() {
    const caja = document.querySelector("[data-mundo-indice]");
    const fuente = caja ? (caja.getAttribute("data-mundo-calendario") || "").trim() : "";
    if (!fuente || !document.querySelector("[data-mundo-vistas]") ||
        typeof window.pedirDatos !== "function") {
        return;
    }
    let datos = null;
    try {
        const respuesta = await window.pedirDatos(fuente);
        if (!respuesta.ok) {
            return;
        }
        datos = await respuesta.json();
    } catch (error) {
        return;
    }
    const limpios = limpiarCalendarioMundo(datos);
    if (!limpios) {
        return;
    }
    MUNDO_CALENDARIO.datos = limpios;
    MUNDO_CALENDARIO.mes = limpios.hoy ? limpios.hoy.mes : 1;
    MUNDO_CALENDARIO.tarjeta = tarjetaDeCalendarioMundo(limpios);
    pintarMesDelCalendarioMundo();
    colocarCalendarioMundo();
}
function limpiarCalendarioMundo(datos) {
    if (!datos || !Array.isArray(datos.meses) || !datos.meses.length) {
        return null;
    }
    const texto = (v) => (v === null || v === undefined ? "" : v.toString().trim());
    const meses = datos.meses.map((m) => ({
        nombre: texto(m && m.nombre), icono: texto(m && m.icono), heraldo: texto(m && m.heraldo),
        estacion: texto(m && m.estacion), empieza: Boolean(m && m.empieza_estacion),
        ancla: texto(m && m.ancla), costumbres: texto(m && m.costumbres),
    })).filter((m) => m.nombre);
    const fin = datos.fin && Array.isArray(datos.fin.dias) && datos.fin.dias.length ? {
        nombre: texto(datos.fin.nombre) || "Fin del Ciclo", icono: texto(datos.fin.icono),
        heraldo: texto(datos.fin.heraldo), ancla: texto(datos.fin.ancla),
        dias: datos.fin.dias.map((d) => ({ nombre: texto(d && d.nombre), icono: texto(d && d.icono),
            heraldo: texto(d && d.heraldo), ancla: texto(d && d.ancla) })).filter((d) => d.nombre),
    } : null;
    const total = meses.length + (fin ? 1 : 0);
    const diasDe = (mes) => (mes <= meses.length ? CALENDARIO_DIAS_MES : (fin ? fin.dias.length : 0));
    const eventos = (Array.isArray(datos.eventos) ? datos.eventos : []).map((e) => {
        const mes = Number(e && e.mes);
        const dia = e && e.dia !== null && e.dia !== undefined && e.dia !== "" ? Number(e.dia) : null;
        return { nombre: texto(e && e.nombre), mes, dia,
            tipo: texto(e && e.tipo) === "evento" ? "evento" : "festividad",
            anyo: texto(e && e.anyo), resumen: texto(e && e.resumen), enlace: texto(e && e.enlace) };
    }).filter((e) => e.nombre && Number.isInteger(e.mes) && e.mes >= 1 && e.mes <= total &&
        (e.dia === null || (Number.isInteger(e.dia) && e.dia >= 1 && e.dia <= diasDe(e.mes))));
    let hoy = null;
    if (datos.hoy && Number.isInteger(Number(datos.hoy.mes)) && Number.isInteger(Number(datos.hoy.dia))) {
        const mes = Number(datos.hoy.mes);
        const dia = Number(datos.hoy.dia);
        if (mes >= 1 && mes <= total && dia >= 1 && dia <= diasDe(mes)) {
            hoy = { mes, dia };
        }
    }
    const semana = (Array.isArray(datos.semana) ? datos.semana : [])
        .map((d) => ({ nombre: texto(d && d.nombre), icono: texto(d && d.icono),
            titulo: texto(d && d.titulo), representa: texto(d && d.representa) }))
        .filter((d) => d.nombre);
    const estaciones = datos.estaciones && typeof datos.estaciones === "object" ? datos.estaciones : {};
    return { nombre: texto(datos.nombre) || "El calendario", url: texto(datos.url),
        meses, fin, total, semana: semana.length === 7 ? semana : null, estaciones, eventos, hoy };
}
function colocarCalendarioMundo() {
    const columna = document.querySelector("[data-mundo-vistas]");
    const tarjeta = MUNDO_CALENDARIO.tarjeta;
    if (!columna || !tarjeta) {
        return;
    }
    const linea = columna.querySelector(".mundo-vista-linea");
    if (linea) {
        columna.insertBefore(tarjeta, linea);
    } else {
        columna.appendChild(tarjeta);
    }
    columna.hidden = false;
    ponerTituloDeVistasMundo();
}
function tarjetaDeCalendarioMundo(datos) {
    const caja = document.createElement("div");
    caja.className = "mundo-vista mundo-vista-calendario";
    caja.setAttribute("role", "group");
    caja.setAttribute("aria-label", "Calendario: " + datos.nombre);
    const cabeza = document.createElement("div");
    cabeza.className = "mundo-cal-cabeza";
    const flecha = (texto, paso, simbolo) => {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "mundo-cal-flecha";
        boton.setAttribute("aria-label", texto);
        boton.title = texto;
        boton.textContent = simbolo;
        boton.addEventListener("click", () => moverCalendarioMundo(paso));
        return boton;
    };
    cabeza.appendChild(flecha("Mes anterior", -1, "‹"));
    const mes = document.createElement("div");
    mes.className = "mundo-cal-mes";
    mes.setAttribute("aria-live", "polite");
    mes.setAttribute("data-cal-mes", "");
    cabeza.appendChild(mes);
    cabeza.appendChild(flecha("Mes siguiente", 1, "›"));
    caja.appendChild(cabeza);
    const rejilla = document.createElement("div");
    rejilla.className = "mundo-cal-rejilla";
    rejilla.setAttribute("data-cal-rejilla", "");
    caja.appendChild(rejilla);
    const panel = document.createElement("div");
    panel.className = "mundo-cal-panel";
    panel.setAttribute("data-cal-panel", "");
    caja.appendChild(panel);
    cabeza.addEventListener("keydown", (evento) => {
        if (evento.key === "ArrowLeft" || evento.key === "ArrowRight") {
            evento.preventDefault();
            moverCalendarioMundo(evento.key === "ArrowLeft" ? -1 : 1);
        }
    });
    const enlace = document.createElement("a");
    enlace.className = "mundo-vista-titulo mundo-cal-titulo";
    enlace.href = rutaSeguraMundo(datos.url);
    enlace.textContent = datos.nombre;
    caja.appendChild(enlace);
    const que = document.createElement("span");
    que.className = "mundo-vista-que";
    que.textContent = "calendario · " + datos.meses.length + " meses de " + CALENDARIO_DIAS_MES +
        " días" + (datos.fin ? " y " + datos.fin.dias.length + " del " + datos.fin.nombre : "");
    caja.appendChild(que);
    return caja;
}
function moverCalendarioMundo(paso) {
    const datos = MUNDO_CALENDARIO.datos;
    if (!datos) {
        return;
    }
    MUNDO_CALENDARIO.mes = ((MUNDO_CALENDARIO.mes - 1 + paso + datos.total) % datos.total) + 1;
    MUNDO_CALENDARIO.dia = null;
    pintarMesDelCalendarioMundo();
}
function eventosDelCalendarioMundo(mes, dia) {
    return MUNDO_CALENDARIO.datos.eventos.filter((e) => e.mes === mes &&
        (dia === undefined || e.dia === dia));
}
function pintarMesDelCalendarioMundo() {
    const datos = MUNDO_CALENDARIO.datos;
    const tarjeta = MUNDO_CALENDARIO.tarjeta;
    if (!datos || !tarjeta) {
        return;
    }
    const numero = MUNDO_CALENDARIO.mes;
    const esFin = numero > datos.meses.length;
    const mes = esFin ? datos.fin : datos.meses[numero - 1];
    const cabeza = tarjeta.querySelector("[data-cal-mes]");
    cabeza.textContent = "";
    const nombre = document.createElement("p");
    nombre.className = "mundo-cal-nombre";
    if (mes.icono) {
        const icono = document.createElement("span");
        icono.setAttribute("aria-hidden", "true");
        icono.textContent = mes.icono + " ";
        nombre.appendChild(icono);
    }
    nombre.appendChild(document.createTextNode(mes.nombre));
    cabeza.appendChild(nombre);
    const quien = document.createElement("p");
    quien.className = "mundo-cal-heraldo";
    let linea = esFin ? (datos.fin.dias.length + " días sagrados, de " + mes.heraldo)
        : ("Regido por " + mes.heraldo);
    if (!esFin && mes.estacion) {
        const icono = (datos.estaciones[mes.estacion] || "").toString();
        const articulo = mes.estacion === "primavera" ? "la " : "el ";
        linea += " · " + (!mes.empieza ? mes.estacion
            : (icono ? icono + " " : "") + (numero > 1 && mes.estacion === "invierno" ? "vuelve " : "empieza ") +
              articulo + mes.estacion);
    }
    quien.textContent = linea;
    cabeza.appendChild(quien);
    const cuenta = eventosDelCalendarioMundo(numero).length;
    const oculto = document.createElement("span");
    oculto.className = "visually-hidden";
    oculto.textContent = (esFin ? "" : "Mes " + numero + " de " + datos.meses.length + ". ") +
        (cuenta === 0 ? "Nada marcado." : (cuenta === 1 ? "Una cosa marcada." : cuenta + " cosas marcadas."));
    cabeza.appendChild(oculto);
    const rejilla = tarjeta.querySelector("[data-cal-rejilla]");
    rejilla.textContent = "";
    rejilla.appendChild(esFin ? listaDelFinMundo(datos) : tablaDelMesMundo(datos, numero, mes));
    const hayHoy = Boolean(datos.hoy && datos.hoy.mes === numero);
    const hayDias = eventosDelCalendarioMundo(numero).some((e) => e.dia);
    if (!esFin && (hayHoy || hayDias)) {
        const leyenda = document.createElement("p");
        leyenda.className = "mundo-cal-leyenda";
        leyenda.setAttribute("aria-hidden", "true");
        if (hayDias) {
            const marca = document.createElement("span");
            marca.className = "mundo-cal-leyenda-punto";
            leyenda.appendChild(marca);
            leyenda.appendChild(document.createTextNode("tiene algo"));
        }
        if (hayHoy) {
            const marca = document.createElement("span");
            marca.className = "mundo-cal-leyenda-hoy";
            leyenda.appendChild(marca);
            leyenda.appendChild(document.createTextNode("hoy"));
        }
        rejilla.appendChild(leyenda);
    }
    pintarPanelDelCalendarioMundo();
}
function tablaDelMesMundo(datos, numero, mes) {
    const tabla = document.createElement("table");
    tabla.className = "mundo-cal-tabla";
    const titulo = document.createElement("caption");
    titulo.className = "visually-hidden";
    titulo.textContent = mes.nombre;
    tabla.appendChild(titulo);
    if (datos.semana) {
        const cabeza = document.createElement("thead");
        const fila = document.createElement("tr");
        datos.semana.forEach((dia) => {
            const celda = document.createElement("th");
            celda.scope = "col";
            celda.title = (dia.titulo || dia.nombre) + (dia.representa ? ": " + dia.representa : "");
            const icono = document.createElement("span");
            icono.setAttribute("aria-hidden", "true");
            icono.textContent = dia.icono || dia.nombre.charAt(0);
            celda.appendChild(icono);
            const nombre = document.createElement("span");
            nombre.className = "visually-hidden";
            nombre.textContent = dia.titulo || dia.nombre;
            celda.appendChild(nombre);
            fila.appendChild(celda);
        });
        cabeza.appendChild(fila);
        tabla.appendChild(cabeza);
    }
    const cuerpo = document.createElement("tbody");
    for (let semana = 0; semana < CALENDARIO_DIAS_MES / 7; semana++) {
        const fila = document.createElement("tr");
        for (let d = 1; d <= 7; d++) {
            const dia = semana * 7 + d;
            const celda = document.createElement("td");
            celda.appendChild(diaDelCalendarioMundo(numero, dia, String(dia), null));
            fila.appendChild(celda);
        }
        cuerpo.appendChild(fila);
    }
    tabla.appendChild(cuerpo);
    return tabla;
}
function listaDelFinMundo(datos) {
    const lista = document.createElement("ol");
    lista.className = "mundo-cal-fin";
    datos.fin.dias.forEach((dia, i) => {
        const item = document.createElement("li");
        item.appendChild(diaDelCalendarioMundo(datos.total, i + 1,
            (dia.icono ? dia.icono + " " : "") + dia.nombre, dia));
        lista.appendChild(item);
    });
    return lista;
}
function diaDelCalendarioMundo(mes, dia, rotulo, delFin) {
    const datos = MUNDO_CALENDARIO.datos;
    const suyos = eventosDelCalendarioMundo(mes, dia);
    const esHoy = Boolean(datos.hoy && datos.hoy.mes === mes && datos.hoy.dia === dia);
    if (!suyos.length && !esHoy && !delFin) {
        const numero = document.createElement("span");
        numero.className = "mundo-cal-dia";
        numero.textContent = rotulo;
        return numero;
    }
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "mundo-cal-dia es-pulsable" +
        (suyos.some((e) => e.tipo === "festividad") ? " es-fiesta" : "") +
        (suyos.some((e) => e.tipo === "evento") ? " es-evento" : "") +
        (esHoy ? " es-hoy" : "");
    boton.setAttribute("aria-pressed", MUNDO_CALENDARIO.dia === dia ? "true" : "false");
    boton.setAttribute("data-cal-dia", String(dia));
    const numero = document.createElement("span");
    numero.className = "mundo-cal-numero";
    numero.textContent = rotulo;
    boton.appendChild(numero);
    if (suyos.length) {
        const marca = document.createElement("span");
        marca.className = "mundo-cal-marca";
        marca.setAttribute("aria-hidden", "true");
        boton.appendChild(marca);
    }
    const oculto = document.createElement("span");
    oculto.className = "visually-hidden";
    oculto.textContent = (esHoy ? ", hoy" : "") +
        (suyos.length ? ": " + suyos.map((e) => e.nombre).join(", ") : "");
    boton.appendChild(oculto);
    if (suyos.length) {
        boton.title = suyos.map((e) => e.nombre).join(" · ");
    }
    boton.addEventListener("click", () => {
        MUNDO_CALENDARIO.dia = MUNDO_CALENDARIO.dia === dia ? null : dia;
        MUNDO_CALENDARIO.tarjeta.querySelectorAll("[data-cal-dia]").forEach((otro) => {
            otro.setAttribute("aria-pressed",
                Number(otro.getAttribute("data-cal-dia")) === MUNDO_CALENDARIO.dia ? "true" : "false");
        });
        pintarPanelDelCalendarioMundo();
    });
    return boton;
}
function pintarPanelDelCalendarioMundo() {
    const datos = MUNDO_CALENDARIO.datos;
    const panel = MUNDO_CALENDARIO.tarjeta.querySelector("[data-cal-panel]");
    const numero = MUNDO_CALENDARIO.mes;
    const dia = MUNDO_CALENDARIO.dia;
    const esFin = numero > datos.meses.length;
    const mes = esFin ? datos.fin : datos.meses[numero - 1];
    const delFin = esFin && dia ? datos.fin.dias[dia - 1] : null;
    panel.textContent = "";
    const titulo = document.createElement("p");
    titulo.className = "mundo-cal-panel-titulo";
    titulo.textContent = delFin ? delFin.nombre
        : (dia ? "Día " + dia + " · " + mes.nombre : (esFin ? "Los días sagrados" : "Este mes"));
    panel.appendChild(titulo);
    if (delFin && delFin.heraldo) {
        const quien = document.createElement("p");
        quien.className = "mundo-cal-costumbres";
        quien.textContent = "Dedicado a " + delFin.heraldo + ".";
        panel.appendChild(quien);
    }
    const suyos = dia ? eventosDelCalendarioMundo(numero, dia)
        : eventosDelCalendarioMundo(numero).slice().sort((a, b) => (a.dia || 0) - (b.dia || 0));
    if (suyos.length) {
        const lista = document.createElement("ul");
        lista.className = "mundo-cal-eventos";
        suyos.forEach((evento) => lista.appendChild(eventoDelCalendarioMundo(evento, esFin, Boolean(dia))));
        panel.appendChild(lista);
    } else {
        const nada = document.createElement("p");
        nada.className = "mundo-cal-costumbres";
        nada.textContent = dia ? "Nada marcado este día." : "Nada marcado todavía.";
        panel.appendChild(nada);
    }
    if (!dia && !esFin && mes.costumbres) {
        const costumbres = document.createElement("p");
        costumbres.className = "mundo-cal-costumbres";
        costumbres.textContent = mes.costumbres;
        panel.appendChild(costumbres);
    }
    const pie = document.createElement("p");
    pie.className = "mundo-cal-pie";
    if (dia) {
        const todo = document.createElement("button");
        todo.type = "button";
        todo.className = "mundo-cal-todo";
        todo.textContent = esFin ? "ver los cuatro días" : "ver todo el mes";
        todo.addEventListener("click", () => {
            MUNDO_CALENDARIO.dia = null;
            MUNDO_CALENDARIO.tarjeta.querySelectorAll("[data-cal-dia]")
                .forEach((otro) => otro.setAttribute("aria-pressed", "false"));
            pintarPanelDelCalendarioMundo();
            const pulsado = MUNDO_CALENDARIO.tarjeta.querySelector("[data-cal-dia='" + dia + "']");
            if (pulsado) {
                pulsado.focus();
            }
        });
        pie.appendChild(todo);
    }
    const ancla = (delFin && delFin.ancla) || mes.ancla;
    if (datos.url && ancla && /^[a-z0-9_-]+$/i.test(ancla)) {
        const mas = document.createElement("a");
        mas.className = "mundo-cal-mas";
        mas.href = rutaSeguraMundo(datos.url + "#" + ancla);
        mas.textContent = delFin ? "leer sobre este día" : (esFin ? "leer sobre el Fin del Ciclo" : "leer sobre este mes");
        pie.appendChild(mas);
    }
    panel.appendChild(pie);
}
function eventoDelCalendarioMundo(evento, esFin, soloElDia) {
    const item = document.createElement("li");
    item.className = "mundo-cal-evento es-" + evento.tipo;
    const icono = document.createElement("span");
    icono.className = "mundo-cal-evento-icono";
    icono.setAttribute("aria-hidden", "true");
    icono.textContent = evento.tipo === "evento" ? "📌" : "🎉";
    item.appendChild(icono);
    const cuerpo = document.createElement("span");
    cuerpo.className = "mundo-cal-evento-cuerpo";
    const cuando = document.createElement("span");
    cuando.className = "mundo-cal-cuando";
    const fecha = soloElDia ? "" : (evento.dia
        ? (esFin ? MUNDO_CALENDARIO.datos.fin.dias[evento.dia - 1].nombre : "día " + evento.dia)
        : "sin día fijo");
    cuando.textContent = [evento.tipo, fecha, evento.anyo ? "año " + evento.anyo : ""]
        .filter(Boolean).join(" · ");
    cuerpo.appendChild(cuando);
    const nombre = document.createElement(evento.enlace ? "a" : "strong");
    nombre.className = "mundo-cal-evento-nombre";
    if (evento.enlace) {
        nombre.href = rutaSeguraMundo(evento.enlace);
    }
    nombre.textContent = evento.nombre;
    cuerpo.appendChild(nombre);
    if (evento.resumen) {
        const resumen = document.createElement("span");
        resumen.className = "mundo-cal-resumen";
        resumen.textContent = evento.resumen;
        cuerpo.appendChild(resumen);
    }
    item.appendChild(cuerpo);
    return item;
}
