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
    pintarElMundo(caja, Array.isArray(fichas) ? fichas : []);
}
function pintarElMundo(caja, fichas) {
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
    orden.forEach((grupo) => {
        const fichas = porGrupo.get(grupo);
        const li = document.createElement("li");
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "mundo-seccion";
        boton.setAttribute("aria-haspopup", "dialog");
        const nombre = document.createElement("span");
        nombre.className = "mundo-seccion-nombre";
        nombre.textContent = grupo;
        boton.appendChild(nombre);
        const cuenta = document.createElement("span");
        cuenta.className = "mundo-seccion-cuenta";
        const n = new Set(fichas.map((f) => f.url)).size;
        cuenta.textContent = grupo === "mapas"
            ? (n === 1 ? "1 mapa" : n + " mapas")
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
function porRegionesMundo(parte, fichas) {
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
        .sort((a, b) => (llano(a.titulo) === deParte ? -1 : 0) - (llano(b.titulo) === deParte ? -1 : 0));
    if (directas.length) {
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
        bloque.appendChild(listaDeFichasMundo(propia ? [propia, ...hijas] : hijas, true));
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
    caja.hidden = !mapas.length;
    if (!mapas.length) {
        return;
    }
    caja.querySelectorAll(".mundo-vista").forEach((vieja) => vieja.remove());
    mapas.forEach((ficha) => caja.appendChild(
        ficha.mini ? tarjetaDeLineaMundo(ficha) : tarjetaDeMapaMundo(ficha)));
    caja.querySelectorAll(".mundo-mini-lista").forEach(colocarLineaEnPequenoMundo);
    const titulo = caja.querySelector(".mundo-vistas-titulo");
    if (titulo) {
        const hayLinea = mapas.some((f) => f.linea === true);
        const hayMapas = mapas.some((f) => f.linea !== true);
        titulo.textContent = hayLinea
            ? (hayMapas ? "mapas y línea de tiempo" : "la línea de tiempo")
            : "los mapas";
    }
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
    enlace.className = "mundo-vista";
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
        const lista = conRegion
            ? suyas.filter((f) => !regiones.has(llano(f.titulo)) && llano(f.titulo) !== llano(nombre))
                .sort((a, b) => a.titulo.localeCompare(b.titulo, "es"))
            : suyas;
        const parte = document.createElement("details");
        parte.className = "mundo-seccion-parte";
        const id = "ventana-" + idDeSubMundo(nombre);
        parte.open = irA === id;
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
        parte.appendChild(listaDeFichasMundo(lista, conRegion));
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
