// =========================================
// EL MUNDO — la portada de la wiki
// =========================================
// Pinta el índice de la wiki: todas las páginas repartidas por la carpeta
// en la que están escritas, con su buscador y sus botones de etiqueta.
//
// AQUÍ NO HAY NINGÚN TEXTO DEL MUNDO. Cada página de la wiki es un HTML de
// verdad (web/wiki/<loquesea>.html), escrito por
// herramientas/3-generadores/generar-mundo.py a partir de la bóveda de
// Chronicler que hay en wiki/. Esto solo pinta la LISTA, y la lista sale
// de datos/wiki/mundo.json, que escribe esa misma herramienta.
//
// Está hecho así y no al revés —una sola página que pinte los artículos
// con JavaScript— por tres motivos que se notan: cada artículo tiene su
// propia dirección y se puede enlazar y compartir; se lee sin JavaScript,
// que es lo que hace que lo encuentre un buscador y que se imprima; y el
// texto está en el HTML, así que el buscador del sitio lo indexa como
// cualquier otra página.
//
// SE REPARTE EN DOS NIVELES: unos apartados grandes (países, lugares,
// personajes, religión, mapas…) y, dentro de cada uno, las etiquetas que
// le queden a cada página. Las carpetas de la bóveda NO se usan para esto:
// una carpeta es cómo tienes guardados los archivos, y eso no tiene por
// qué ser cómo se busca una cosa.
//
// Quién va en qué apartado lo decide datos/wiki/mundo-categorias.json y lo
// calcula el generador: aquí llega hecho, en los campos "grupo" y "sub" de
// cada ficha, y hasta el ORDEN de los apartados es el que traiga el JSON.
//
// UNA PÁGINA PUEDE SALIR VARIAS VECES dentro de su apartado, una por cada
// etiqueta que lleve, igual que un NPC de varios grupos. Por eso la cuenta
// del apartado cuenta direcciones distintas y no tarjetas.
//
// OJO CON LOS NOMBRES: todos los scripts comparten el mismo ámbito global,
// así que lo de aquí lleva "Mundo" en el nombre. Se comprueba con
// herramientas/4-comprobar/nombres-repetidos.py.

initializeMundo();

async function initializeMundo() {
    const caja = document.querySelector("[data-mundo-indice]");
    if (!caja || typeof window.pedirDatos !== "function") {
        return;
    }
    // A la vez, sin esperarse: son dos archivos que no dependen uno de otro.
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

    // Por apartados, EN EL ORDEN EN QUE LLEGAN: el JSON ya viene ordenado
    // como diga datos/wiki/mundo-categorias.json, y reordenar aquí sería
    // decidir dos veces lo mismo en dos sitios distintos.
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

    orden.forEach((grupo) => {
        caja.appendChild(bloqueDeGrupoMundo(grupo, porGrupo.get(grupo)));
    });

    pintarLosMapasDelMundo(buenas);

    // Los botones de etiqueta los monta el componente de siempre contando
    // los data-categoria que acaban de aparecer, y el buscador vuelve a
    // aplicar lo que hubiera escrito. Como esto llega por fetch, cuando
    // esos scripts se ejecutaron no había ni una ficha.
    document.dispatchEvent(new CustomEvent("filtros:actualizar"));
}

// UN APARTADO ES UN <details>, o sea que se pliega y se despliega solo,
// con el teclado y con el lector de pantalla, sin que haya que escribir
// nada de eso. El título es su <summary>.
//
// Lo que esté plegado se recuerda en el navegador de quien mira (la misma
// caja donde el sitio guarda el tema y el tamaño del texto), así que si
// cierras «lo demás» sigue cerrado la próxima vez.
function bloqueDeGrupoMundo(grupo, fichas) {
    const bloque = document.createElement("details");
    bloque.className = "mundo-grupo";
    // Para poder contar los mapas como mapas y no como páginas, abajo.
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

    // Las que no tienen ninguna etiqueta que las reparta van arriba y sin
    // encabezado: en un apartado de cuatro páginas, tres de ellas bajo un
    // título que repite el nombre del apartado no ordenan nada.
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
    // En el orden en que llegan: el generador ya los ordena (el "orden"
    // de datos/wiki/mundo-categorias.json, o el alfabético si no lo hay).
    [...porEtiqueta.keys()].forEach((e) => {
        bloque.appendChild(subapartadoMundo(grupo, e, porEtiqueta.get(e)));
    });
    return bloque;
}

// UN SUBAPARTADO TAMBIÉN SE PLIEGA (Azarasia dentro de Mapamundi, los
// eventos dentro de historia…): otro <details>, con su flecha y su cuenta,
// y lo que dejes plegado se recuerda igual que los apartados, con la
// clave «apartado/subapartado».
function subapartadoMundo(grupo, nombre, fichas) {
    const clave = grupo + "/" + nombre;
    const sub = document.createElement("details");
    sub.className = "mundo-sub";
    sub.setAttribute("data-mundo-sub", nombre);
    sub.setAttribute("data-mundo-clave", clave);
    // Para que la tarjeta de una parte del mundo sin página propia
    // (Archipiélagos, en «busca una región») pueda llevar hasta aquí.
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
    // Si sus páginas dicen de qué región son (el mapamundi), cada país va
    // debajo de su región y en una lista de nombres, no de tarjetas.
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

// =========================================
// LOS PAÍSES, BAJO SU REGIÓN
// =========================================
// Como en los portales de geografía de las wikis grandes: dentro de una
// parte del mundo, primero lo que cuelga de ella directamente (la propia
// Azarasia y sus países sueltos) y después un bloque por región (Islas de
// Labros, con sus países). Y en LISTA DE NOMBRES, no en tarjetas: el
// resumen de estas páginas era «X está en Y», que con la región encima ya
// no dice nada, y ciento y pico tarjetas iguales no se recorren con la
// vista; una lista en columnas sí.
//
// La región de cada página llega hecha en el JSON ("region", el campo
// «región» de su ficha). Una página es una REGIÓN si alguna otra la tiene
// como región.
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

    // Lo que cuelga de la parte directamente: ni es de una región de aquí
    // ni es una región. La página de la propia parte, la primera.
    const directas = fichas
        .filter((f) => !regiones.has(llano(f.region)) && !regiones.has(llano(f.titulo)))
        .sort((a, b) => (llano(a.titulo) === deParte ? -1 : 0) - (llano(b.titulo) === deParte ? -1 : 0));
    if (directas.length) {
        caja.appendChild(listaDeFichasMundo(directas, true));
    }

    [...regiones.keys()].sort((a, b) => a.localeCompare(b, "es")).forEach((llave) => {
        const propia = fichas.find((f) => llano(f.titulo) === llave);
        const hijas = fichas.filter((f) => llano(f.region) === llave);
        const bloque = document.createElement("div");
        bloque.className = "mundo-region";
        const titulo = document.createElement("h4");
        titulo.className = "mundo-region-titulo";
        titulo.textContent = propia ? propia.titulo : regiones.get(llave);
        const cuenta = document.createElement("span");
        cuenta.className = "mundo-grupo-cuenta";
        cuenta.setAttribute("data-mundo-region-cuenta", "");
        titulo.appendChild(document.createTextNode(" "));
        titulo.appendChild(cuenta);
        bloque.appendChild(titulo);
        // La página de la región, la primera de su lista: así el buscador
        // la encuentra igual que a las demás.
        bloque.appendChild(listaDeFichasMundo(propia ? [propia, ...hijas] : hijas, true));
        caja.appendChild(bloque);
    });
    return caja;
}

// QUÉ APARTADOS ESTÁN PLEGADOS. Se guarda la lista de los cerrados y no
// la de los abiertos: así un apartado nuevo (uno que aparezca al escribir
// una página con una etiqueta nueva) nace abierto, que es lo que se
// espera.
const MUNDO_CERRADOS = leerCerradosMundo();

function leerCerradosMundo() {
    try {
        const crudo = window.localStorage.getItem("richi-mundo-cerrados");
        return new Set(crudo ? JSON.parse(crudo) : []);
    } catch (error) {
        // Sin localStorage (navegación privada, permisos) no pasa nada:
        // todos los apartados salen abiertos.
        return new Set();
    }
}

function recordarGrupoMundo(bloque) {
    recordarPlegadoMundo(bloque, bloque.getAttribute("data-mundo-grupo"));
}

function recordarPlegadoMundo(bloque, grupo) {
    // Mientras se busca o se filtra los apartados se abren solos (ver
    // repasarGruposMundo); eso no es una decisión de quien mira, así que
    // no se guarda.
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
        // Si no se puede guardar, se pierde al recargar y ya está.
    }
}

// =========================================
// LOS MAPAS, A LA DERECHA
// =========================================
// Las fichas que traen una silueta (el campo "vista", que solo tienen los
// mapas) salen además en su propia columna, grandes y con el dibujo. Es
// la puerta de entrada al mapa: en una wiki de un mundo, el mapa es lo
// primero que se busca, y «Mapamundi de Cralëa — mapa interactivo» en una
// lista no se parece en nada a verlo.
//
// La silueta es un <img> con un .svg que escribe el generador. Va así y no
// metida en la página porque una imagen se guarda en la caché del
// navegador, no puede tocar nada de lo que hay alrededor y deja que la
// portada siga siendo un HTML que se edita a mano.

function pintarLosMapasDelMundo(fichas) {
    const caja = document.querySelector("[data-mundo-vistas]");
    if (!caja) {
        return;
    }
    // Los mapas traen su silueta ("vista") y la línea de tiempo su versión
    // en pequeño ("mini"): las dos cosas van en esta columna.
    const mapas = fichas.filter((f) => (f.vista || "").toString().trim() ||
        (f.mini && Array.isArray(f.mini.cosas)));
    // Sin mapas no hay columna: un título suelto encima de un hueco no
    // dice nada.
    caja.hidden = !mapas.length;
    if (!mapas.length) {
        return;
    }
    caja.querySelectorAll(".mundo-vista").forEach((vieja) => vieja.remove());
    mapas.forEach((ficha) => caja.appendChild(
        ficha.mini ? tarjetaDeLineaMundo(ficha) : tarjetaDeMapaMundo(ficha)));
    // Con la columna ya a la vista, los recuadros miden lo que miden: ahora
    // se puede apartar lo que se pise (ver colocarLineaEnPequenoMundo).
    caja.querySelectorAll(".mundo-mini-lista").forEach(colocarLineaEnPequenoMundo);

    // La línea de tiempo también va en esta columna (la escribe
    // generar-linea-tiempo.py, con "linea": true), y entonces la columna ya
    // no es solo de mapas. La columna está escondida hasta aquí, así que
    // el cambio de título no se ve.
    const titulo = caja.querySelector(".mundo-vistas-titulo");
    if (titulo) {
        const hayLinea = mapas.some((f) => f.linea === true);
        const hayMapas = mapas.some((f) => f.linea !== true);
        titulo.textContent = hayLinea
            ? (hayMapas ? "mapas y línea de tiempo" : "la línea de tiempo")
            : "los mapas";
    }
}

// =========================================
// LA LÍNEA DE TIEMPO, EN PEQUEÑO
// =========================================
// Lo mismo que en su página, pero de bolsillo: la línea de arriba abajo,
// cada evento en un recuadrito con su año y su nombre (y que lleva a su
// página) y cada era como una franja con su nombre (que lleva a su sitio
// en la línea grande). Las posiciones vienen calculadas en el JSON, en rem
// de la escala de la página (ver mini() en
// herramientas/3-generadores/mundo_linea.py); aquí solo se pasan a píxeles.
//
// NO ES UN ENLACE ENTERO, como la tarjeta de un mapa: dentro hay un enlace
// por evento, y un enlace no puede ir dentro de otro. El título de abajo
// es el que lleva a la línea entera.
//
// Es una lista (<ol>) en el orden del tiempo, así que un lector de
// pantalla la lee como lo que es: era, evento, evento, era…

// Píxeles por cada rem de la escala de la página. Con 6, dos eventos
// seguidos quedan como poco a 39 px (el tramo mínimo es 6,5 rem), y dos del
// mismo lado, al doble: sitio para un recuadro de dos líneas.
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
            // Dónde le toca según la escala. colocarLineaEnPequenoMundo lo
            // baja si se pisa con lo de antes.
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
    // Su color, solo si es un #rrggbb de verdad: va a parar a un estilo.
    const color = (cosa.color || "").toString().trim();
    if (/^#[0-9a-fA-F]{6}$/.test(color)) {
        item.style.setProperty("--era-color", color);
    }

    const enlace = document.createElement("a");
    enlace.className = "mundo-mini-era-nombre";
    enlace.href = rutaSeguraMundo(cosa.url);
    enlace.textContent = (cosa.nombre || "").toString().trim();
    // Los años no caben en el rótulo; se oyen y salen al pasar el ratón.
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

// QUE NADA SE PISE. A escala, dos eventos cercanos pueden quedar a 39 px,
// y un recuadro con un nombre largo ocupa tres líneas; y el rótulo de una
// era va en medio, encima de la línea. Así que se repasa todo en orden y,
// si algo empezaría antes de que acabe lo de su mismo lado (o el rótulo de
// la era de antes), se baja lo justo, y con él todo lo que viene detrás.
// El orden y las distancias relativas se conservan; solo se estira.
//
// Se vuelve a hacer si cambia el tamaño de los recuadros (el botón de
// tamaño de letra, o al girar el móvil).
const MINI_HOLGURA = 5;

function colocarLineaEnPequenoMundo(lista) {
    const items = Array.from(lista.children).filter((e) => e.dataset && e.dataset.y);
    let extra = 0;
    const fondo = { izquierda: -Infinity, derecha: -Infinity, centro: -Infinity };
    const mudanzas = [];   // [y según la escala, lo que se ha bajado desde ahí]
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
            // El rótulo de una era y el de «hoy» van en el centro, encima
            // de la línea: no pueden pisar ningún recuadro de los dos lados.
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

    // Cada y de la escala, con lo que se haya bajado lo de antes.
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
    // El mapa no se describe aquí: lo que hay dentro está en su página,
    // en la lista de sitios, y repetirlo en un alt de doscientas palabras
    // no ayuda a nadie. El nombre va debajo, en texto de verdad.
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

// Se monta con createElement y no con innerHTML: cada dato es un texto
// suelto y textContent lo pone tal cual, sin que haya que acordarse de
// escapar nada.
function itemDelMundo(ficha, corto) {
    const item = document.createElement("li");
    item.className = "mundo-ficha-item";
    // Esto es lo que leen el filtro Y el buscador. Las etiquetas van todas
    // en el mismo atributo porque una página puede tener varias y el
    // filtro mira si la suya está entre ellas.
    const etiquetas = (Array.isArray(ficha.etiquetas) ? ficha.etiquetas : [])
        .map((e) => (e || "").toString().trim())
        .filter(Boolean);
    item.setAttribute("data-categoria", etiquetas.join(", "));
    // La misma página puede salir en varios subapartados del mismo
    // apartado: la cuenta de arriba cuenta direcciones distintas.
    item.setAttribute("data-mundo-url", (ficha.url || "").toString());

    const enlace = document.createElement("a");
    enlace.className = "mundo-item";
    enlace.href = rutaSeguraMundo(ficha.url);

    // Su bandera, pequeña, delante del nombre (alt="": el nombre va al
    // lado, escrito). Solo en la lista corta, la del mapamundi.
    const bandera = rutaSeguraMundo(ficha.bandera);
    if (corto && bandera !== "#") {
        const img = document.createElement("img");
        img.className = "mundo-item-bandera";
        img.src = bandera;
        img.alt = "";
        img.width = 36;
        img.height = 24;
        img.setAttribute("loading", "lazy");
        img.setAttribute("decoding", "async");
        enlace.appendChild(img);
    }

    const titulo = document.createElement("strong");
    titulo.className = "mundo-item-titulo";
    titulo.textContent = ficha.titulo.toString().trim();
    enlace.appendChild(titulo);

    // En la lista corta (el mapamundi), solo el nombre.
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

// Mismo criterio que en el resto del sitio: el JSON lo escribe una
// herramienta nuestra, pero de ahí sale una dirección que acaba en un
// href, y una que empiece por "javascript:" es código que se ejecuta al
// pulsar. Se comprueba que sea una dirección de las que valen y, si no, no
// se pone.
function rutaSeguraMundo(url) {
    const limpia = (url || "").toString().trim();
    if (/^\/(?!\/)/.test(limpia) || /^(https?:\/\/|mailto:|#)/i.test(limpia)) {
        return limpia;
    }
    return "#";
}


// =========================================
// LOS APARTADOS QUE SE QUEDAN SIN NADA
// =========================================
// Quien esconde las fichas es el filtro (filtros.js), que mira el
// data-categoria de cada una y, de paso, si pasa el buscador. Pero el
// TÍTULO de la carpeta no es una ficha, así que al buscar algo quedaban
// cuatro títulos flotando encima de cuatro huecos vacíos. Es lo mismo que
// hace la página de npcs, y por lo mismo.

document.addEventListener("filtros:cambiado", repasarGruposMundo);
document.addEventListener("filtros:actualizar", repasarGruposMundo);

// SIN BOTONES DE ETIQUETAS, quien esconde lo que no pasa la búsqueda es
// esto: el buscador dice quién pasa (window.buscador.pasa) y avisa con
// "buscar:cambiado", pero no esconde nada él mismo (ver
// scripts/componentes/buscador.js). Si algún día vuelve filtros.js a la
// portada, esto se quita: lo haría él.
document.addEventListener("buscar:cambiado", () => {
    if (!window.buscador) {
        return;
    }
    document.querySelectorAll("[data-mundo-indice] .mundo-ficha-item").forEach((item) => {
        item.hidden = !window.buscador.pasa(item);
    });
    // Mientras se busca, la rejilla de regiones se quita: lo que importa
    // entonces es lo que se ha encontrado, que está debajo.
    const regiones = document.querySelector("[data-mundo-regiones]");
    if (regiones && regiones.hasAttribute("data-mundo-cargado")) {
        regiones.hidden = !!window.buscador.texto;
    }
    repasarGruposMundo();
});

function repasarGruposMundo() {
    // Primero los subapartados: un título de etiqueta encima de un hueco
    // vacío es lo mismo que un apartado vacío, pero más pequeño.
    const rebuscandoSub = !!(window.buscador && window.buscador.texto);
    // Las regiones dentro de un subapartado: fuera si no queda ninguna de
    // sus páginas, y su cuenta con las que queden.
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
        // Igual que los apartados (abajo): abierto mientras se busca, y
        // como estaba al dejar de buscar.
        if (rebuscandoSub && vivos && !sub.open) {
            sub.setAttribute("data-mundo-forzado", "");
            sub.open = true;
        } else if (!rebuscandoSub && sub.hasAttribute("data-mundo-forzado")) {
            sub.open = false;
            sub.removeAttribute("data-mundo-forzado");
        }
    });

    // ¿Se está buscando o filtrando algo? Entonces los apartados se abren
    // solos: encontrar tres páginas y que no se vean porque el apartado
    // estaba plegado es peor que no encontrarlas.
    const rebuscando = !!(window.buscador && window.buscador.texto)
        || [...document.querySelectorAll(".filtro-btn")]
            .some((b) => b.getAttribute("aria-pressed") === "true"
                && b.getAttribute("data-categoria") !== "todas");

    document.querySelectorAll(".mundo-grupo").forEach((grupo) => {
        const items = [...grupo.querySelectorAll(".mundo-ficha-item")]
            .filter((item) => !item.hidden);
        // Páginas distintas, no tarjetas: dentro de un apartado la misma
        // página sale una vez por cada etiqueta que lleve.
        const vivos = new Set(items.map((item) => item.getAttribute("data-mundo-url"))).size;
        grupo.hidden = vivos === 0;
        const cuenta = grupo.querySelector("[data-mundo-cuenta]");
        if (cuenta) {
            // El apartado de los mapas cuenta mapas: "3 páginas" debajo de
            // un título que dice MAPAS es un despiste tonto pero se nota.
            const nombre = grupo.getAttribute("data-mundo-grupo") === "mapas"
                ? ["1 mapa", " mapas"]
                : ["1 página", " páginas"];
            cuenta.textContent = vivos === 1 ? nombre[0] : vivos + nombre[1];
        }

        // Abrirlo mientras dure la búsqueda, y devolverlo a como estaba
        // al terminarla. data-mundo-forzado es lo que distingue "lo he
        // abierto yo" de "lo ha abierto la búsqueda", para no guardar
        // como decisión de nadie algo que decide el buscador.
        if (rebuscando && vivos && !grupo.open) {
            grupo.setAttribute("data-mundo-forzado", "");
            grupo.open = true;
        } else if (!rebuscando && grupo.hasAttribute("data-mundo-forzado")) {
            grupo.open = false;
            grupo.removeAttribute("data-mundo-forzado");
        }
    });
}


// =========================================
// LOS SPOILERS
// =========================================
// En las páginas del mundo, lo que está escrito ||así|| en Chronicler sale
// tapado y se destapa al pulsarlo. Esto vive aquí y no en la página de la
// wiki porque las dos lo llevan: la portada puede tener uno en un resumen.
//
// Se destapa con el ratón Y con el teclado (Enter o espacio sobre él, que
// para eso lleva tabindex y role="button" puestos por el generador), y al
// destaparse deja de ser un botón: ya no hay nada que hacer con él.

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


// =========================================
// LAS IMÁGENES, EN GRANDE
// =========================================
// Cualquier imagen de una página de la wiki —el mapa de situación, las
// fotos de la ficha, las del artículo— se amplía al pulsarla, con la lupa
// (scripts/componentes/lupa.js): la misma capa a pantalla completa que el
// retrato de un NPC.
//
// Se envuelve cada una en un <button> aquí y no en el generador, porque
// sin JavaScript un botón que no hace nada es peor que una imagen quieta.
// Las que ya están dentro de un enlace se dejan: pulsarlas ya lleva a
// algún sitio. Y las de un spoiler también, que pulsar ahí es destaparlo.

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
    // El pie que tenga debajo, si lo tiene, es lo que se escribe debajo en
    // grande; si no, el texto alternativo.
    const figura = boton.closest("figure");
    // La bandera y el blasón: su pie es solo «Bandera», y en grande se
    // escribe entero («Bandera de Reino de Prunia», el alt).
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


// =========================================
// BUSCA UNA REGIÓN
// =========================================
// Lo primero de la portada, como en el portal de geografía de A Wiki of
// Ice and Fire: cada parte del mundo con su mapa de situación en pequeño,
// y debajo sus regiones, igual. Sale de datos/wiki/mundo-regiones.json,
// que escribe generar-mundo.py (y las miniaturas, mundo_situacion.py).
//
// Las imágenes llevan alt="": el nombre va al lado, en texto, y un mapa
// de situación en miniatura no cuenta nada que el nombre no diga.

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
        // Sin regiones la portada sigue valiendo: el índice está debajo.
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
        const hijas = Array.isArray(parte.hijas) ? parte.hijas : [];
        if (hijas.length) {
            const suyas = document.createElement("ul");
            suyas.className = "mundo-parte-hijas";
            hijas.forEach((hija) => {
                const li = document.createElement("li");
                li.appendChild(teselaDeRegionMundo(hija, "mundo-hija"));
                suyas.appendChild(li);
            });
            item.appendChild(suyas);
        }
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
    // Sin página propia (Archipiélagos): a su apartado de la lista.
    const url = (cosa.url || "").toString().trim();
    enlace.href = url ? rutaSeguraMundo(url) : "#" + idDeSubMundo(nombre);
    if (!url) {
        enlace.addEventListener("click", () => abrirHastaMundo(idDeSubMundo(nombre)));
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

// El apartado al que lleva una tarjeta sin página, abierto aunque se
// hubiera dejado plegado: llevar a un título cerrado es llevar a nada.
function abrirHastaMundo(id) {
    const destino = document.getElementById(id);
    let paso = destino;
    while (paso) {
        if (paso.tagName === "DETAILS" && !paso.open) {
            paso.open = true;
        }
        paso = paso.parentElement;
    }
}


// =========================================
// LA BANDERA Y EL BLASÓN
// =========================================
// Van en el mismo hueco, arriba de la ficha. Con los dos, se ve uno y
// debajo hay un botón por cada uno («Bandera», «Blasón»): el pulsado es el
// que se ve, como un carrusel de dos. Botones con aria-pressed y no
// pestañas: son dos imágenes, no dos paneles con contenido. Sin
// JavaScript salen las dos, una debajo de otra.

function prepararEmblemasMundo() {
    document.querySelectorAll("[data-mundo-emblemas]").forEach((caja) => {
        const cuales = [...caja.querySelectorAll("[data-mundo-emblema]")];
        if (cuales.length < 2) {
            return;
        }
        const botones = document.createElement("div");
        botones.className = "mundo-emblemas-botones";
        botones.setAttribute("role", "group");
        botones.setAttribute("aria-label", "Qué ver");
        const enseñar = (elegido) => {
            cuales.forEach((li, n) => {
                li.hidden = n !== elegido;
                botones.children[n].setAttribute("aria-pressed", n === elegido ? "true" : "false");
            });
        };
        cuales.forEach((li, n) => {
            const boton = document.createElement("button");
            boton.type = "button";
            boton.className = "mundo-emblemas-boton";
            boton.textContent = li.getAttribute("data-mundo-emblema") || "";
            boton.addEventListener("click", () => enseñar(n));
            botones.appendChild(boton);
        });
        caja.appendChild(botones);
        caja.classList.add("con-botones");
        enseñar(0);
    });
}
