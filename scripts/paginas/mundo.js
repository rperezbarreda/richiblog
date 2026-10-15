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

// LAS CATEGORÍAS, con su icono y su orden (datos/wiki/mundo-categorias.json,
// el mismo archivo que usa el generador para repartir las páginas). De ahí
// salen los botones de la portada, también los de las categorías que aún no
// tienen ninguna página. Si no llega, salen solo las que tengan algo.
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

    // UN BOTÓN POR SECCIÓN, y cada uno abre su ventana con lo que tiene
    // dentro (ver abrirSeccionMundo). Antes salía todo seguido en la
    // portada: ciento y pico países, luego la historia, luego lo demás, y
    // lo que no fuera el mapamundi quedaba a seis pantallas de bajada.
    const botones = document.createElement("ul");
    botones.className = "mundo-secciones";
    botones.setAttribute("data-mundo-secciones", "");
    // En el orden del archivo de categorías, y detrás lo que haya llegado
    // sin estar en él. Los mapas no llevan botón: ya están a la vista en la
    // columna de la derecha, con su dibujo (ver pintarLosMapasDelMundo).
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
        // El icono es adorno: el nombre va escrito al lado.
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

    // LO QUE SE BUSCA sí sale en la portada, todo junto y por secciones:
    // buscar y tener que abrir cuatro ventanas para ver dónde ha salido
    // algo sería peor que no buscar. Esto solo se ve mientras hay algo
    // escrito en el buscador (ver "buscar:cambiado", abajo).
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

    // Llegar con #mundo-<parte> (las migas de una entrada, la tarjeta de
    // Archipiélagos en «busca una región») abre la ventana del mapamundi
    // en esa parte.
    abrirDesdeLaDireccionMundo();
    window.addEventListener("hashchange", abrirDesdeLaDireccionMundo);

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

    // Lo que cuelga de la parte directamente: ni es de una región de aquí
    // ni es una región. La página de la propia parte, la primera (y en la
    // ventana de la portada, soloPaises, ni sale: ahí van solo países).
    const directas = fichas
        .filter((f) => !regiones.has(llano(f.region)) && !regiones.has(llano(f.titulo)))
        .filter((f) => !soloPaises || llano(f.titulo) !== deParte)
        .sort((a, b) => (llano(a.titulo) === deParte ? -1 : 0) - (llano(b.titulo) === deParte ? -1 : 0));
    if (directas.length && soloPaises && regiones.size) {
        // Con regiones al lado, lo suelto lleva su título: son los que no
        // son de ninguna (Telvetia, Zaustilla, la Cuna de Quimeras).
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

    // UNA ZONA DENTRO DE OTRA (Archipiélago Fragmentado, dentro de Tierras
    // Encantadas): su bloque va justo debajo del de su zona, y no se
    // repite dentro de él como un país más.
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
    // (Por si alguna se queda fuera: dos zonas que se tienen la una a la
    // otra de región. Mejor que salgan a que se pierdan.)
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
        // La página de la región, la primera de su lista: así el buscador
        // la encuentra igual que a las demás. En la ventana, solo países.
        const suyas = propia && !soloPaises ? [propia, ...hijas] : hijas;
        if (soloPaises) {
            cuenta.textContent = String(suyas.length);
        }
        bloque.appendChild(listaDeFichasMundo(suyas, true));
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

    // EN LA REJILLA DEL MAPAMUNDI, la bandera arriba y el nombre debajo
    // (alt="": el nombre va escrito justo debajo). Un país sin bandera
    // lleva el hueco igual, vacío, para que la rejilla no baile.
    // Una región no tiene bandera: lleva su mapa de situación en pequeño.
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
    // Y los botones de las secciones dejan sitio a lo encontrado, y con
    // ellos lo destacado y los últimos cambios.
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
// Como en el portal de geografía de A Wiki of Ice and Fire: cada parte
// del mundo con su mapa de situación en pequeño (sus regiones y países, en
// la ventana del mapamundi). Sale de datos/wiki/mundo-regiones.json,
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
        // Solo la parte, sin sus regiones debajo: cada tarjeta medía
        // distinto. Las regiones y los países, en la ventana del mapamundi.
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
    // (La ventana la abre el cambio de dirección: ver
    // abrirDesdeLaDireccionMundo. Si ya se estaba en esa dirección, el
    // cambio no salta, así que se abre también al pulsar.)
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



// =========================================
// LA BANDERA, EL BLASÓN Y EL MAPA
// =========================================
// Van en el mismo hueco, arriba de la ficha, como un carrusel: se ve uno,
// y debajo hay dos flechas para pasar al anterior o al siguiente (al
// llegar al último, vuelve al primero) y el nombre del que se ve con su
// número («Mapa · 3 de 3»). Ese nombre se anuncia al cambiar (aria-live),
// que si no quien usa un lector de pantalla pulsa la flecha y no se entera
// de qué ha pasado. Sin JavaScript salen todos, uno debajo de otro.

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


// =========================================
// LAS SECCIONES, EN SU VENTANA
// =========================================
// Cada botón de la portada abre la ventana de siempre (ventana-modal.js,
// la de los NPC y el botín) con su sección dentro: el mapamundi por partes
// del mundo y regiones, con los países en rejilla y su bandera; la
// historia; lo demás. La ventana se encarga del foco, del Escape y de
// dejar inerte lo de detrás.

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
                    // Después de pintarse, para que tenga sitio al que bajar.
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
        // EN EL MAPAMUNDI, SOLO LOS PAÍSES: ni la página de la propia parte
        // (Azarasia) ni las de las regiones (Islas de Labros…), que son
        // las que alguna otra página tiene como «región».
        const conRegion = suyas.some((f) => llano(f.region));
        const regiones = new Set(suyas.map((f) => llano(f.region)).filter(Boolean));
        // ¿Tiene regiones propias, aparte de ella misma (los archipiélagos
        // de Archipiélagos)? Entonces, un apartado por región.
        const conSubregiones = [...regiones].some((r) => r !== llano(nombre));
        const lista = conRegion
            ? suyas.filter((f) => !regiones.has(llano(f.titulo)) && llano(f.titulo) !== llano(nombre))
                .sort((a, b) => a.titulo.localeCompare(b.titulo, "es"))
            : suyas;

        // CADA PARTE SE PLIEGA: un <details>, abierto de serie (se pliega
        // lo que se quiera quitar de en medio, no hay que ir abriendo).
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
    // Qué sección tiene esa parte del mundo.
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


// =========================================
// EL CONTENIDO DE LA PÁGINA, PLEGADO O NO
// =========================================
// Es un <details> (se pliega solo, con ratón y teclado). Esto solo
// recuerda cómo lo dejaste, para todas las páginas: si lo plegaste en una,
// sale plegado en la siguiente. En el navegador, con try por si no se
// puede (ventana privada): entonces sale abierto, y ya está.
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
        // Sin almacenamiento: abierto.
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
            // Se pierde al cambiar de página, y ya está.
        }
    });
}


// =========================================
// LO DEMÁS DE LA PORTADA
// =========================================
// Lo que tienen las portadas de las wikis de mundos (Kanka, World Anvil,
// las de Fandom) y la nuestra no tenía: la fecha de hoy en el mundo, una
// página destacada, un «¿sabías que…?», una página al azar y los últimos
// cambios. Las páginas de relleno («*Texto de relleno.*») y la de ejemplo
// no salen de destacadas: no tienen nada que contar todavía.

function paginasConTextoMundo(fichas) {
    // Fuera también las que solo dicen dónde están («X está en Y», «es una
    // región de…»): son las frases que puso el generador, no texto de
    // verdad.
    const deRelleno = /\b(está en|es una región)\b/i;
    return fichas.filter((f) => !f.relleno && f.grupo !== "mapas"
        && (f.resumen || "").toString().trim().length > 60
        && !deRelleno.test((f.resumen || "").toString())
        && !(Array.isArray(f.etiquetas) && f.etiquetas.some((e) => (e || "").toString().toLowerCase() === "ejemplo")));
}

// La fecha de hoy y los últimos cambios: datos/wiki/mundo-portada.json.
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
                // Al mediodía: a las 00:00 en UTC, al oeste de Greenwich
                // saldría el día de antes.
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

// La DESTACADA cambia cada día (la misma para todos ese día: sale del
// número del día, no del azar), y el «¿sabías que…?» son tres al azar de
// las demás, distintas cada vez que se entra.
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
        // Barajadas y las tres primeras.
        const mezcla = otras.slice();
        for (let i = mezcla.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [mezcla[i], mezcla[j]] = [mezcla[j], mezcla[i]];
        }
        mezcla.slice(0, 3).forEach((f) => {
            const li = document.createElement("li");
            // La primera frase de su resumen, y su nombre de enlace.
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

// UNA PÁGINA AL AZAR, de todas (menos los mapas, que están a la vista).
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


// QUE NO TAPE LA FICHA. En escritorio el contenido va fijo abajo a la
// derecha, justo debajo de donde está la ficha; con una página larga (el
// calendario tiene veintiún apartados) crecía hacia arriba y se le ponía
// encima. Así que mide lo que queda libre entre el final de la ficha y el
// fondo de la pantalla, y como mucho ocupa eso (con su propio scroll si
// no cabe). Al bajar y perderse la ficha de vista, tiene todo el sitio.
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
        // Nunca menos de lo que mide con tres o cuatro apartados, ni más
        // del 60% de la pantalla.
        caja.style.maxHeight = Math.round(Math.min(Math.max(libre, 150), window.innerHeight * 0.6)) + "px";
    };
    ajustar();
    // El scroll es el de la sección de la página, no el de la ventana: se
    // escucha en captura para oírlo venga de donde venga.
    document.addEventListener("scroll", ajustar, { capture: true, passive: true });
    window.addEventListener("resize", ajustar);
}
