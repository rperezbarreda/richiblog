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
    // Sin mapas (ni calendario) no hay columna.
    caja.hidden = !mapas.length && !MUNDO_CALENDARIO.tarjeta;
    caja.querySelectorAll("[data-vistas-bloque='mapa'], [data-vistas-bloque='linea']")
        .forEach((viejo) => viejo.remove());
    // Cada cosa en su bloque y con su título encima: el mapamundi (o los
    // mapas, si algún día hay más de uno), el calendario y la línea de
    // tiempo. Los bloques van en ese orden: mapas, calendario, línea.
    const soloMapas = mapas.filter((f) => !f.mini);
    const lineas = mapas.filter((f) => f.mini);
    if (soloMapas.length) {
        const bloque = bloqueDeVistasMundo("mapa", soloMapas.length === 1 ? "mapamundi" : "mapas");
        soloMapas.forEach((ficha) => bloque.appendChild(tarjetaDeMapaMundo(ficha)));
        caja.insertBefore(bloque, caja.firstChild);
    }
    if (lineas.length) {
        const bloque = bloqueDeVistasMundo("linea", "línea de tiempo");
        lineas.forEach((ficha) => bloque.appendChild(tarjetaDeLineaMundo(ficha)));
        caja.appendChild(bloque);
    }
    // El calendario llega por su cuenta (ver pintarCalendarioMundo): si
    // ya está, se asegura de que quede entre los dos.
    colocarCalendarioMundo();
    // Con la columna ya a la vista, los recuadros miden lo que miden: ahora
    // se puede apartar lo que se pise (ver colocarLineaEnPequenoMundo).
    caja.querySelectorAll(".mundo-mini-lista").forEach(colocarLineaEnPequenoMundo);
}

function bloqueDeVistasMundo(cual, titulo) {
    const bloque = document.createElement("div");
    bloque.className = "mundo-vistas-bloque";
    bloque.setAttribute("data-vistas-bloque", cual);
    const cabeza = document.createElement("h2");
    cabeza.className = "mundo-vistas-titulo";
    cabeza.textContent = titulo;
    bloque.appendChild(cabeza);
    return bloque;
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
            img.src = rutaSeguraMundo(bandera);
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
        boton.addEventListener("click", () => {
            const pulsar = img.closest("[data-mundo-pulsar]");
            if (pulsar) {
                abrirMapaParaPulsarMundo(boton, img, pulsar.getAttribute("data-mundo-pulsar"));
            } else {
                abrirAmpliadaMundo(boton, img);
            }
        });
    });
}

// EL MAPA DE SITUACIÓN, PARA PULSAR. Ampliado, encima del dibujo van las
// formas de los países que se ven, y cada una es un enlace a su página:
// así se pasa de un país a su vecino. Las formas salen de
// datos/wiki/situacion/<página>.json (lo escribe generar-mundo.py con
// mundo_situacion.para_pulsar). Debajo, los mismos países en una lista de
// enlaces, para quien no use el ratón o no vea bien las fronteras: al
// pasar por uno de la lista se resalta en el mapa. Si el archivo no
// llega, se amplía la imagen de siempre.
async function abrirMapaParaPulsarMundo(boton, img, fuente) {
    let datos = null;
    try {
        const respuesta = await window.pedirDatos(rutaSeguraMundo(fuente));
        datos = respuesta.ok ? await respuesta.json() : null;
    } catch (error) {
        datos = null;
    }
    const vista = datos && Array.isArray(datos.vista) && datos.vista.length === 4
        && datos.vista.every((n) => Number.isFinite(n)) ? datos.vista : null;
    const vecinos = datos && Array.isArray(datos.vecinos) ? datos.vecinos : [];
    if (!vista || !vecinos.length) {
        abrirAmpliadaMundo(boton, img);
        return;
    }
    const SVG = "http://www.w3.org/2000/svg";
    const caminoMundo = (formas) => (Array.isArray(formas) ? formas : []).map((plano) => {
        if (!Array.isArray(plano) || plano.length < 6) {
            return "";
        }
        let d = "";
        for (let i = 0; i + 1 < plano.length; i += 2) {
            const x = Number(plano[i]);
            const y = Number(plano[i + 1]);
            if (!Number.isFinite(x) || !Number.isFinite(y)) {
                return "";
            }
            d += (i ? "L" : "M") + x + " " + y;
        }
        return d + "Z";
    }).join("");
    const yo = (datos.yo && datos.yo.titulo || "").toString();

    const marco = document.createElement("div");
    marco.className = "lupa-mapa";
    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("class", "lupa-mapa-svg");
    svg.setAttribute("viewBox", vista.join(" "));
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("role", "group");
    svg.setAttribute("aria-label", "Mapa de situación de " + yo + ": pulsa un país vecino para ir a su página");
    const fondo = document.createElementNS(SVG, "image");
    fondo.setAttribute("href", rutaSeguraMundo(img.getAttribute("src")));
    fondo.setAttribute("x", vista[0]);
    fondo.setAttribute("y", vista[1]);
    fondo.setAttribute("width", vista[2]);
    fondo.setAttribute("height", vista[3]);
    fondo.setAttribute("preserveAspectRatio", "none");
    svg.appendChild(fondo);

    // EL GLOBO, como en el mapamundi: la bandera del país (si tiene), su
    // nombre y su subtítulo, pegado al ratón; o, si se llega con el
    // teclado desde la lista, encima de su forma. aria-hidden: lo mismo
    // está en la lista.
    const globo = document.createElement("div");
    globo.className = "lupa-mapa-globo";
    globo.setAttribute("aria-hidden", "true");
    globo.hidden = true;
    const lista = document.createElement("ul");
    lista.className = "lupa-mapa-lista";
    const enMapa = new Map();
    const banderaDe = (v) => {
        const ruta = rutaSeguraMundo(v && v.bandera);
        return ruta !== "#" && ruta.startsWith("/") ? ruta : "";
    };
    const colocarGlobo = (x, y) => {
        const caja = marco.getBoundingClientRect();
        const suyo = globo.getBoundingClientRect();
        let izquierda = x - caja.left + 16;
        let arriba = y - caja.top + 18;
        if (izquierda + suyo.width > caja.width - 6) {
            izquierda = Math.max(6, x - caja.left - suyo.width - 12);
        }
        if (arriba + suyo.height > caja.height - 6) {
            arriba = Math.max(6, y - caja.top - suyo.height - 12);
        }
        // Y nunca fuera del mapa por arriba o por la izquierda: una forma
        // que asoma por el borde tiene el centro fuera del recorte.
        globo.style.left = Math.round(Math.max(6, Math.min(izquierda, caja.width - suyo.width - 6))) + "px";
        globo.style.top = Math.round(Math.max(6, arriba)) + "px";
    };
    const llenarGlobo = (v) => {
        globo.textContent = "";
        const bandera = banderaDe(v);
        if (bandera) {
            const img = document.createElement("img");
            img.className = "lupa-mapa-globo-bandera";
            img.src = rutaSeguraMundo(bandera);
            img.alt = "";
            // Con su tamaño puesto: si no, se coloca antes de que llegue la
            // imagen y al llegar se sale por el borde.
            img.width = 120;
            img.height = 80;
            globo.appendChild(img);
        }
        const n = document.createElement("strong");
        n.className = "lupa-mapa-globo-nombre";
        n.textContent = (v.titulo || "").toString();
        globo.appendChild(n);
        if ((v.que || "").toString().trim()) {
            const q = document.createElement("span");
            q.className = "lupa-mapa-globo-que";
            q.textContent = v.que.toString();
            globo.appendChild(q);
        }
        globo.hidden = false;
    };
    const resaltar = (url, si, evento) => {
        const forma = enMapa.get(url);
        if (forma) {
            forma.classList.toggle("es-resaltado", si);
        }
        const v = vecinos.find((x) => rutaSeguraMundo(x.url) === url);
        if (!si || !v) {
            globo.hidden = true;
            return;
        }
        llenarGlobo(v);
        if (evento && evento.clientX !== undefined && evento.type !== "focus") {
            colocarGlobo(evento.clientX, evento.clientY);
        } else if (forma) {
            const caja = forma.getBoundingClientRect();
            colocarGlobo(caja.left + caja.width / 2, caja.top + caja.height / 2);
        }
    };
    vecinos.forEach((v) => {
        const url = rutaSeguraMundo(v.url);
        const d = caminoMundo(v.formas);
        if (url === "#" || !d) {
            return;
        }
        const titulo = (v.titulo || "").toString();
        const enlace = document.createElementNS(SVG, "a");
        enlace.setAttribute("href", rutaSeguraMundo(url));
        enlace.setAttribute("class", "lupa-mapa-vecino");
        enlace.setAttribute("aria-label", titulo);
        const camino = document.createElementNS(SVG, "path");
        camino.setAttribute("d", d);
        camino.setAttribute("vector-effect", "non-scaling-stroke");
        enlace.appendChild(camino);
        // En el mapa, fuera del tabulador: se llega a cada país por la
        // lista de debajo, que va en orden (en el dibujo saltaría de un
        // lado a otro).
        enlace.setAttribute("tabindex", "-1");
        enlace.addEventListener("mouseenter", (e) => resaltar(url, true, e));
        enlace.addEventListener("mousemove", (e) => {
            if (!globo.hidden) {
                colocarGlobo(e.clientX, e.clientY);
            }
        });
        enlace.addEventListener("mouseleave", () => resaltar(url, false));
        svg.appendChild(enlace);
        enMapa.set(url, enlace);

        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = rutaSeguraMundo(url);
        // En la lista, la bandera en pequeño delante del nombre.
        const bandera = banderaDe(v);
        if (bandera) {
            const img = document.createElement("img");
            img.className = "lupa-mapa-lista-bandera";
            img.src = rutaSeguraMundo(bandera);
            img.alt = "";
            img.width = 30;
            img.height = 20;
            img.loading = "lazy";
            a.appendChild(img);
        }
        a.appendChild(document.createTextNode(titulo));
        ["mouseenter", "focus"].forEach((t) => a.addEventListener(t, () => resaltar(url, true)));
        ["mouseleave", "blur"].forEach((t) => a.addEventListener(t, () => resaltar(url, false)));
        li.appendChild(a);
        lista.appendChild(li);
    });
    const suyo = caminoMundo(datos.yo && datos.yo.formas);
    if (suyo) {
        const camino = document.createElementNS(SVG, "path");
        camino.setAttribute("d", suyo);
        camino.setAttribute("class", "lupa-mapa-yo");
        camino.setAttribute("vector-effect", "non-scaling-stroke");
        camino.setAttribute("aria-hidden", "true");
        svg.appendChild(camino);
    }
    marco.appendChild(svg);
    marco.appendChild(globo);

    const debajo = document.createElement("nav");
    debajo.className = "lupa-mapa-vecinos";
    debajo.setAttribute("aria-label", "Países que se ven en el mapa");
    const titulo = document.createElement("p");
    titulo.className = "lupa-mapa-titulo";
    titulo.textContent = "Pulsa un país en el mapa, o elige uno:";
    debajo.appendChild(titulo);
    debajo.appendChild(lista);

    window.lupa.abrir({
        ruta: img.currentSrc || img.getAttribute("src"),
        texto: (img.getAttribute("alt") || "").trim(),
        que: "",
        dibujo: marco,
        debajo,
        devolverA: boton,
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
        // EN LAS RAZAS, como en D&D, cada raza con sus subrazas (elfos
        // altos, drow…): la página de la raza primero y sus subrazas
        // detrás, que son las que dicen «subraza de» en su ficha.
        const subrazas = suyas.filter((f) => llano(f.subraza_de));
        const lista = conRegion
            ? suyas.filter((f) => !regiones.has(llano(f.titulo)) && llano(f.titulo) !== llano(nombre))
                .sort((a, b) => a.titulo.localeCompare(b.titulo, "es"))
            : (subrazas.length
                ? suyas.slice().sort((a, b) => (llano(b.titulo) === llano(nombre)) - (llano(a.titulo) === llano(nombre))
                    || a.titulo.localeCompare(b.titulo, "es"))
                : suyas);

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
        const nSub = new Set(subrazas.map((f) => f.url)).size;
        cuenta.textContent = conRegion
            ? (n === 1 ? "1 país" : n + " países")
            : (nSub ? (nSub === 1 ? "1 subraza" : nSub + " subrazas")
                : (n === 1 ? "1 página" : n + " páginas"));
        cabecera.appendChild(cuenta);
        parte.appendChild(cabecera);
        parte.appendChild(conSubregiones
            ? porRegionesMundo(nombre, suyas, true)
            : listaDeFichasMundo(lista, conRegion));
        caja.appendChild(parte);
    });
    filtrosDeSeccionMundo(caja, fichas, grupo);
    return caja;
}

// LOS FILTROS DE UNA VENTANA: un desplegable por cada campo de las fichas
// que tenga al menos dos valores distintos entre las páginas de la
// sección (los monstruos por hábitat y tamaño, los personajes por raza,
// los lugares por tipo o por dónde están…). Lo que no pasa se esconde, y
// las partes que se quedan sin nada, también. El Mapamundi no lleva: ahí
// ya se reparte por regiones.
function filtrosDeSeccionMundo(caja, fichas, grupo) {
    if ((grupo || "").toString().toLowerCase() === "mapamundi") {
        return;
    }
    const porUrl = new Map();
    fichas.forEach((f) => porUrl.set((f.url || "").toString(), f.filtros || {}));
    const valores = new Map();
    porUrl.forEach((filtros) => {
        Object.entries(filtros).forEach(([campo, valor]) => {
            if (!valores.has(campo)) {
                valores.set(campo, new Set());
            }
            valores.get(campo).add(valor.toString());
        });
    });
    const campos = [...valores.keys()].filter((c) => valores.get(c).size >= 2);
    if (!campos.length) {
        return;
    }
    const barra = document.createElement("div");
    barra.className = "mundo-filtros";
    barra.setAttribute("role", "group");
    barra.setAttribute("aria-label", "Filtrar esta sección");
    const cuenta = document.createElement("p");
    cuenta.className = "mundo-filtros-cuenta";
    cuenta.setAttribute("aria-live", "polite");
    const selects = new Map();
    campos.forEach((campo) => {
        const opciones = [["", "todo"]].concat([...valores.get(campo)].sort((a, b) => a.localeCompare(b, "es"))
            .map((v) => [v, v]));
        const select = selectMundo(opciones, "");
        selects.set(campo, select);
        barra.appendChild(campoDeFormularioMundo(campo, select));
        select.addEventListener("change", aplicar);
    });
    barra.appendChild(cuenta);
    caja.insertBefore(barra, caja.firstChild);

    function aplicar() {
        const pedidos = [...selects].filter(([, s]) => s.value).map(([c, s]) => [c, s.value]);
        const vistas = new Set();
        caja.querySelectorAll(".mundo-ficha-item").forEach((item) => {
            const suyos = porUrl.get(item.getAttribute("data-mundo-url") || "") || {};
            const pasa = pedidos.every(([c, v]) => (suyos[c] || "") === v);
            item.hidden = !pasa;
            if (pasa) {
                vistas.add(item.getAttribute("data-mundo-url"));
            }
        });
        // Las partes (y las listas sueltas) que se quedan vacías, fuera.
        caja.querySelectorAll(".mundo-seccion-parte").forEach((parte) => {
            parte.hidden = !parte.querySelector(".mundo-ficha-item:not([hidden])");
        });
        cuenta.textContent = pedidos.length
            ? (vistas.size === 1 ? "1 página" : vistas.size + " páginas") + " con eso."
            : "";
    }
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
prepararMigasFijasMundo();

// LAS MIGAS SIEMPRE A MANO. Al bajar por una entrada, el «Wiki Cralëa ›
// Mapamundi › Azarasia» de arriba se queda pegado arriba del marco de la
// página, para volver a la portada o a la página de arriba sin subir.
// Con position: fixed y no sticky (sticky no funciona en el navegador de
// Richi; ver el contenido, más arriba): mientras está pegado, un hueco de
// su mismo alto ocupa su sitio para que el texto no dé un salto.
//
// La página no se desplaza con la ventana sino dentro de su sección
// (main > section), así que lo que se mira es el scroll de esa sección y
// la caja de la sección dice dónde va la barra.
function prepararMigasFijasMundo() {
    const migas = document.querySelector(".mundo-migas");
    const seccion = migas ? migas.closest("main > section") : null;
    if (!migas || !seccion) {
        return;
    }
    const hueco = document.createElement("div");
    hueco.className = "mundo-migas-hueco";
    hueco.hidden = true;
    hueco.setAttribute("aria-hidden", "true");
    migas.parentNode.insertBefore(hueco, migas);
    const soltar = () => {
        migas.classList.remove("es-fija");
        migas.style.top = migas.style.left = migas.style.width = migas.style.paddingLeft =
            migas.style.paddingRight = migas.style.backgroundColor = "";
        hueco.hidden = true;
    };
    const ajustar = () => {
        const caja = seccion.getBoundingClientRect();
        const estilo = getComputedStyle(seccion);
        const arriba = caja.top + (parseFloat(estilo.borderTopWidth) || 0);
        const fija = migas.classList.contains("es-fija");
        const donde = (fija ? hueco : migas).getBoundingClientRect();
        if (donde.top >= arriba) {
            if (fija) {
                soltar();
            }
            return;
        }
        if (!fija) {
            hueco.style.height = migas.offsetHeight + "px";
            hueco.hidden = false;
            migas.classList.add("es-fija");
        }
        migas.style.top = Math.round(arriba) + "px";
        migas.style.left = Math.round(caja.left + (parseFloat(estilo.borderLeftWidth) || 0)) + "px";
        migas.style.width = seccion.clientWidth + "px";
        // Del mismo color que el fondo de la sección (opaco: el texto pasa
        // por debajo y no tiene que verse a través).
        migas.style.backgroundColor = estilo.backgroundColor && !/rgba\([^)]*,\s*0\)|transparent/.test(estilo.backgroundColor)
            ? estilo.backgroundColor : "";
        migas.style.paddingLeft = estilo.paddingLeft;
        migas.style.paddingRight = estilo.paddingRight;
    };
    seccion.addEventListener("scroll", ajustar, { passive: true });
    window.addEventListener("resize", () => {
        soltar();
        ajustar();
    });
    ajustar();
}

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
        // Si lo ha plegado o abierto ajustarContenidoMundo para no tapar
        // la ficha, no es una elección de quien lee: no se apunta.
        if (plegable.dataset.automatico) {
            delete plegable.dataset.automatico;
            return;
        }
        plegable.dataset.tocado = "1";
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
    pintarProgresoMundo(datos && datos.progreso);
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
    if (!boton) {
        return;
    }
    // Nace ocupando su sitio sin verse (data-por-ver, ver mundo.css): si
    // apareciera ahora, la línea crecería y empujaría la portada.
    boton.removeAttribute("data-por-ver");
    if (!todas.length) {
        boton.hidden = true;
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
//
// Y SI NO QUEDA SITIO (la ficha de un país, con todos sus datos, llena la
// pantalla entera), se pliega solo y se queda en su barra de título; al
// bajar y dejar sitio, se vuelve a abrir. Eso no se apunta como elección
// (ver prepararContenidoMundo), y si mientras tanto lo abres o lo pliegas
// tú, no se le lleva la contraria hasta que vuelva a haber sitio.
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
        const apretado = libre < 150;
        if (apretado && plegable.open && !plegable.dataset.tocado && !plegable.dataset.plegadoSolo) {
            plegable.dataset.plegadoSolo = "1";
            plegable.dataset.automatico = "1";
            plegable.open = false;
        } else if (!apretado) {
            if (plegable.dataset.plegadoSolo && !plegable.open && !plegable.dataset.tocado) {
                plegable.dataset.automatico = "1";
                plegable.open = true;
            }
            delete plegable.dataset.plegadoSolo;
            delete plegable.dataset.tocado;
        }
    };
    ajustar();
    // El scroll es el de la sección de la página, no el de la ventana: se
    // escucha en captura para oírlo venga de donde venga.
    document.addEventListener("scroll", ajustar, { capture: true, passive: true });
    window.addEventListener("resize", ajustar);
}


// =========================================
// EL CALENDARIO, EN LA PORTADA
// =========================================
// Una tarjeta en la columna de la derecha, entre los mapas y la línea de
// tiempo: el Ciclo de los Heraldos mes a mes, con flechas para pasar de uno
// a otro (los doce meses y, detrás, los cuatro días del Fin del Ciclo) y
// los días que tienen algo resaltados. Lo de cada día no va escrito debajo:
// sale en un globo al pasar por encima (como los países en el mapamundi) o
// al llegar con el tabulador. Cada día resaltado es un ENLACE: lleva a la
// página de lo que pasa ese día, si la tiene, o a su mes en la entrada del
// calendario. Abajo, el enlace a la entrada entera.
//
// Los meses no dicen quién los rige: eso puede cambiar, y está en la
// entrada.
//
// Lo que se pinta sale de datos/wiki/calendario.json, que se lleva con
// herramientas/1-publicar/calendario.py (o a mano). Llega por su cuenta,
// sin esperar al índice, y se coloca en la columna cuando llega; si los
// mapas se vuelven a pintar después, pintarLosMapasDelMundo lo vuelve a
// poner en su sitio (ver colocarCalendarioMundo).
//
// Como todos los meses tienen 28 días, que son cuatro semanas justas, todos
// empiezan en Día del Sol: la rejilla es siempre la misma, 7 × 4.

const MUNDO_CALENDARIO = { datos: null, tarjeta: null, globo: null, mes: 1 };
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

// Lo que no tenga forma de calendario se queda fuera: un evento en el mes
// 14 o en el día 30 no se puede pintar en ningún sitio, y uno sin día
// tampoco (no hay número que resaltar).
function limpiarCalendarioMundo(datos) {
    if (!datos || !Array.isArray(datos.meses) || !datos.meses.length) {
        return null;
    }
    const texto = (v) => (v === null || v === undefined ? "" : v.toString().trim());
    const meses = datos.meses.map((m) => ({
        nombre: texto(m && m.nombre), icono: texto(m && m.icono), heraldo: texto(m && m.heraldo),
        estacion: texto(m && m.estacion), momento: texto(m && m.momento), ancla: texto(m && m.ancla),
    })).filter((m) => m.nombre);
    const fin = datos.fin && Array.isArray(datos.fin.dias) && datos.fin.dias.length ? {
        nombre: texto(datos.fin.nombre) || "Fin del Ciclo", icono: texto(datos.fin.icono),
        heraldo: texto(datos.fin.heraldo), ancla: texto(datos.fin.ancla),
        dias: datos.fin.dias.map((d) => ({ nombre: texto(d && d.nombre), icono: texto(d && d.icono),
            heraldo: texto(d && d.heraldo), ancla: texto(d && d.ancla) })).filter((d) => d.nombre),
    } : null;
    const total = meses.length + (fin ? 1 : 0);
    const diasDe = (mes) => (mes <= meses.length ? CALENDARIO_DIAS_MES : (fin ? fin.dias.length : 0));
    const eventos = (Array.isArray(datos.eventos) ? datos.eventos : []).map((e) => ({
        nombre: texto(e && e.nombre), mes: Number(e && e.mes), dia: Number(e && e.dia),
        tipo: texto(e && e.tipo) === "evento" ? "evento" : "festividad",
        anyo: texto(e && e.anyo), resumen: texto(e && e.resumen), enlace: texto(e && e.enlace),
    })).filter((e) => e.nombre && Number.isInteger(e.mes) && e.mes >= 1 && e.mes <= total &&
        Number.isInteger(e.dia) && e.dia >= 1 && e.dia <= diasDe(e.mes));
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
    // LA LUNA: sus fases caen siempre el mismo día de cada mes (el ciclo es
    // de 28 días, como el mes), y los eclipses, el día que se diga. Un
    // eclipse se apunta como una cosa más del calendario: sale resaltado y
    // con su globo, y lleva a la página de la Luna.
    const luna = datos.luna && typeof datos.luna === "object" ? datos.luna : {};
    const fases = (Array.isArray(luna.fases) ? luna.fases : []).map((f) => ({
        dia: Number(f && f.dia), nombre: texto(f && f.nombre), icono: texto(f && f.icono),
        efecto: texto(f && f.efecto),
    })).filter((f) => f.nombre && Number.isInteger(f.dia) && f.dia >= 1 && f.dia <= CALENDARIO_DIAS_MES);
    (Array.isArray(luna.eclipses) ? luna.eclipses : []).forEach((e) => {
        const mes = Number(e && e.mes);
        const dia = Number(e && e.dia);
        if (Number.isInteger(mes) && mes >= 1 && mes <= meses.length &&
            Number.isInteger(dia) && dia >= 1 && dia <= CALENDARIO_DIAS_MES && !texto(e && e.anyo)) {
            eventos.push({ nombre: texto(e && e.nombre) || "Eclipse", mes, dia, tipo: "eclipse",
                anyo: "", resumen: texto(e && e.efecto) || texto(luna.efecto_eclipse),
                enlace: texto(luna.enlace) });
        }
    });
    // EL CICLO DE ECLIPSES: uno cada «cada» días del año, de cada tipo por
    // turno (con 340 días y uno cada 85, cuatro al año, uno de cada tipo).
    // Pueden caer también en el Fin del Ciclo.
    const ciclo = luna.ciclo_de_eclipses && typeof luna.ciclo_de_eclipses === "object" ? luna.ciclo_de_eclipses : null;
    const tiposEclipse = ciclo && Array.isArray(ciclo.tipos) ? ciclo.tipos.filter((t) => t && texto(t.nombre)) : [];
    const diasAnyo = meses.length * CALENDARIO_DIAS_MES + (fin ? fin.dias.length : 0);
    const cada = ciclo ? Number(ciclo.cada) : 0;
    if (tiposEclipse.length && Number.isInteger(cada) && cada > 0) {
        let n = 0;
        for (let d = Number(ciclo.primero) || cada; d <= diasAnyo; d += cada, n++) {
            const mes = d <= meses.length * CALENDARIO_DIAS_MES ? Math.floor((d - 1) / CALENDARIO_DIAS_MES) + 1 : total;
            const dia = mes <= meses.length ? ((d - 1) % CALENDARIO_DIAS_MES) + 1 : d - meses.length * CALENDARIO_DIAS_MES;
            const tipo = tiposEclipse[n % tiposEclipse.length];
            eventos.push({ nombre: texto(tipo.nombre), mes, dia, tipo: "eclipse", anyo: "",
                resumen: texto(tipo.efecto) || texto(luna.efecto_eclipse), enlace: texto(luna.enlace) });
        }
    }
    return { nombre: texto(datos.nombre) || "El calendario", url: texto(datos.url),
        meses, fin, total, semana: semana.length === 7 ? semana : null, estaciones, eventos, hoy,
        fases, nombreLuna: texto(luna.nombre) || "la Luna" };
}

// La fase de la luna de un día de un mes (no de los del Fin del Ciclo), o null.
function faseDeLunaMundo(mes, dia) {
    const datos = MUNDO_CALENDARIO.datos;
    if (!datos || mes > datos.meses.length) {
        return null;
    }
    return datos.fases.find((f) => f.dia === dia) || null;
}

// En la columna, en su bloque con su título, detrás del mapamundi y
// delante de la línea de tiempo.
function colocarCalendarioMundo() {
    const columna = document.querySelector("[data-mundo-vistas]");
    const tarjeta = MUNDO_CALENDARIO.tarjeta;
    if (!columna || !tarjeta) {
        return;
    }
    let bloque = tarjeta.parentElement;
    if (!bloque || !bloque.matches("[data-vistas-bloque='calendario']")) {
        bloque = bloqueDeVistasMundo("calendario", "calendario");
        bloque.appendChild(tarjeta);
    }
    const linea = columna.querySelector("[data-vistas-bloque='linea']");
    if (linea) {
        columna.insertBefore(bloque, linea);
    } else {
        columna.appendChild(bloque);
    }
    columna.hidden = false;
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
    // Lo que se oye al pasar de mes: el nombre, quién lo rige y cuántos
    // días tiene algo. Por eso el aria-live va en la cabecera entera y no
    // solo en el nombre.
    const mes = document.createElement("div");
    mes.className = "mundo-cal-mes";
    mes.setAttribute("aria-live", "polite");
    mes.setAttribute("data-cal-mes", "");
    cabeza.appendChild(mes);
    cabeza.appendChild(flecha("Mes siguiente", 1, "›"));
    caja.appendChild(cabeza);

    // Las flechas del teclado también pasan de mes, si se está dentro de la
    // cabecera.
    cabeza.addEventListener("keydown", (evento) => {
        if (evento.key === "ArrowLeft" || evento.key === "ArrowRight") {
            evento.preventDefault();
            moverCalendarioMundo(evento.key === "ArrowLeft" ? -1 : 1);
        }
    });

    const rejilla = document.createElement("div");
    rejilla.className = "mundo-cal-rejilla";
    rejilla.setAttribute("data-cal-rejilla", "");
    caja.appendChild(rejilla);

    const pie = document.createElement("p");
    pie.className = "mundo-cal-pie";
    pie.setAttribute("data-cal-pie", "");
    caja.appendChild(pie);

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

    // EL GLOBO, uno para toda la tarjeta. Se mueve al lado del día que toca.
    const globo = document.createElement("div");
    globo.className = "mundo-cal-globo";
    globo.setAttribute("aria-hidden", "true");
    globo.hidden = true;
    caja.appendChild(globo);
    MUNDO_CALENDARIO.globo = globo;
    caja.addEventListener("keydown", (evento) => {
        if (evento.key === "Escape" && !globo.hidden) {
            soltarGloboDelCalendarioMundo();
        }
    });
    return caja;
}

// De un mes al siguiente, y del último (el Fin del Ciclo) otra vez al
// primero: es un ciclo.
function moverCalendarioMundo(paso) {
    const datos = MUNDO_CALENDARIO.datos;
    if (!datos) {
        return;
    }
    soltarGloboDelCalendarioMundo();
    MUNDO_CALENDARIO.mes = ((MUNDO_CALENDARIO.mes - 1 + paso + datos.total) % datos.total) + 1;
    pintarMesDelCalendarioMundo();
}

function eventosDelCalendarioMundo(mes, dia) {
    return MUNDO_CALENDARIO.datos.eventos.filter((e) => e.mes === mes &&
        (dia === undefined || e.dia === dia));
}

// «principio de la primavera», «primavera», «fin de la primavera».
function estacionDelMesMundo(mes) {
    if (!mes.estacion) {
        return "";
    }
    const de = mes.estacion === "primavera" ? "de la " : "del ";
    const icono = (MUNDO_CALENDARIO.datos.estaciones[mes.estacion] || "").toString();
    const texto = mes.momento === "principio" ? "principio " + de + mes.estacion
        : (mes.momento === "fin" ? "fin " + de + mes.estacion : mes.estacion);
    return (icono ? icono + " " : "") + texto;
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

    // LA CABECERA: icono, nombre, quién lo rige y la estación.
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
    quien.textContent = esFin ? datos.fin.dias.length + " días sagrados" : estacionDelMesMundo(mes);
    cabeza.appendChild(quien);
    const cuenta = eventosDelCalendarioMundo(numero).length;
    const oculto = document.createElement("span");
    oculto.className = "visually-hidden";
    oculto.textContent = (esFin ? "" : "Mes " + numero + " de " + datos.meses.length + ". ") +
        (cuenta === 0 ? "Nada marcado." : (cuenta === 1 ? "Una cosa marcada." : cuenta + " cosas marcadas."));
    cabeza.appendChild(oculto);

    // LA REJILLA: siete columnas y cuatro filas, o los cuatro días del Fin
    // del Ciclo uno debajo de otro, que tienen nombre propio.
    const rejilla = tarjeta.querySelector("[data-cal-rejilla]");
    rejilla.textContent = "";
    rejilla.appendChild(esFin ? listaDelFinMundo(datos) : tablaDelMesMundo(datos, numero, mes));
    // Qué quiere decir el recuadro de hoy, solo en su mes. Para quien no
    // ve la rejilla ya lo dice el día con palabras.
    if (!esFin && datos.hoy && datos.hoy.mes === numero) {
        const leyenda = document.createElement("p");
        leyenda.className = "mundo-cal-leyenda";
        leyenda.setAttribute("aria-hidden", "true");
        const marca = document.createElement("span");
        marca.className = "mundo-cal-leyenda-hoy";
        leyenda.appendChild(marca);
        leyenda.appendChild(document.createTextNode("hoy"));
        rejilla.appendChild(leyenda);
    }

    // EL PIE: a su apartado de la entrada.
    const pie = tarjeta.querySelector("[data-cal-pie]");
    pie.textContent = "";
    if (datos.url && mes.ancla && /^[a-z0-9_-]+$/i.test(mes.ancla)) {
        const mas = document.createElement("a");
        mas.className = "mundo-cal-mas";
        mas.href = rutaSeguraMundo(datos.url + "#" + mes.ancla);
        mas.textContent = esFin ? "leer sobre el Fin del Ciclo" : "leer sobre este mes";
        pie.appendChild(mas);
    }
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

// UN DÍA. Si tiene algo es un enlace, con su globo; si no, es solo su
// número (veintiocho enlaces que no llevan a nada serían veintiocho
// paradas de tabulador para nada). Hoy, sin nada, es su número en un
// recuadro. Los del Fin del Ciclo son siempre enlaces: cada uno tiene su
// apartado en la entrada.
//
// A DÓNDE LLEVA: a la página de lo que pasa ese día, si tiene una; si no,
// a su mes (o a su día del Fin del Ciclo) en la entrada del calendario,
// que es donde se cuenta.
function diaDelCalendarioMundo(mes, dia, rotulo, delFin) {
    const datos = MUNDO_CALENDARIO.datos;
    const suyos = eventosDelCalendarioMundo(mes, dia);
    const esHoy = Boolean(datos.hoy && datos.hoy.mes === mes && datos.hoy.dia === dia);
    const fase = faseDeLunaMundo(mes, dia);
    const conLuna = (caja) => {
        if (fase && fase.icono) {
            const icono = document.createElement("span");
            icono.className = "mundo-cal-luna";
            icono.setAttribute("aria-hidden", "true");
            icono.textContent = fase.icono;
            caja.appendChild(icono);
        }
    };
    if (!suyos.length && !delFin) {
        const numero = document.createElement("span");
        numero.className = "mundo-cal-dia" + (esHoy ? " es-hoy" : "") + (fase ? " es-luna" : "");
        numero.textContent = rotulo;
        conLuna(numero);
        if (fase) {
            numero.title = fase.nombre + (fase.efecto ? ": " + fase.efecto : "");
        }
        if (esHoy || fase) {
            const oculto = document.createElement("span");
            oculto.className = "visually-hidden";
            oculto.textContent = (esHoy ? ", hoy" : "") + (fase ? ", " + fase.nombre.toLowerCase() : "");
            numero.appendChild(oculto);
        }
        return numero;
    }
    const enlace = document.createElement("a");
    enlace.className = "mundo-cal-dia es-pulsable" + (suyos.length ? " es-marcado" : "") +
        (esHoy ? " es-hoy" : "");
    const conPagina = suyos.find((e) => e.enlace);
    const ancla = (delFin && delFin.ancla) || (datos.meses[mes - 1] || datos.fin || {}).ancla || "";
    enlace.href = conPagina ? rutaSeguraMundo(conPagina.enlace)
        : rutaSeguraMundo(datos.url + (/^[a-z0-9_-]+$/i.test(ancla) ? "#" + ancla : ""));
    const numero = document.createElement("span");
    numero.className = "mundo-cal-numero";
    numero.textContent = rotulo;
    enlace.appendChild(numero);
    conLuna(enlace);
    if (suyos.length) {
        const marca = document.createElement("span");
        marca.className = "mundo-cal-marca";
        marca.setAttribute("aria-hidden", "true");
        enlace.appendChild(marca);
    }
    // Lo que se oye: el día y qué tiene, sin tener que ver el globo.
    const oculto = document.createElement("span");
    oculto.className = "visually-hidden";
    oculto.textContent = (esHoy ? ", hoy" : "") + (fase ? ", " + fase.nombre.toLowerCase() : "") +
        (suyos.length ? ": " + suyos.map((e) => e.nombre).join(", ") : "");
    enlace.appendChild(oculto);

    const ensenar = () => abrirGloboDelCalendarioMundo(enlace, mes, dia, delFin, esHoy);
    enlace.addEventListener("mouseenter", ensenar);
    enlace.addEventListener("focus", ensenar);
    enlace.addEventListener("mouseleave", soltarGloboDelCalendarioMundo);
    enlace.addEventListener("blur", soltarGloboDelCalendarioMundo);
    return enlace;
}

function abrirGloboDelCalendarioMundo(boton, mes, dia, delFin, esHoy) {
    const datos = MUNDO_CALENDARIO.datos;
    const globo = MUNDO_CALENDARIO.globo;
    globo.textContent = "";

    const cuando = document.createElement("p");
    cuando.className = "mundo-cal-globo-cuando";
    cuando.textContent = (delFin ? delFin.nombre : "Día " + dia + " · " + datos.meses[mes - 1].nombre) +
        (esHoy ? " · hoy" : "");
    globo.appendChild(cuando);
    const fase = faseDeLunaMundo(mes, dia);
    if (fase) {
        const luna = document.createElement("p");
        luna.className = "mundo-cal-globo-tipo";
        luna.textContent = (fase.icono ? fase.icono + " " : "") + fase.nombre +
            (fase.efecto ? ": " + fase.efecto : "");
        globo.appendChild(luna);
    }
    eventosDelCalendarioMundo(mes, dia).forEach((evento) => {
        const bloque = document.createElement("div");
        bloque.className = "mundo-cal-globo-evento";
        const nombre = document.createElement("p");
        nombre.className = "mundo-cal-globo-nombre";
        const icono = document.createElement("span");
        icono.setAttribute("aria-hidden", "true");
        icono.textContent = (evento.tipo === "evento" ? "📌" : (evento.tipo === "eclipse" ? "🌘" : "🎉")) + " ";
        nombre.appendChild(icono);
        nombre.appendChild(document.createTextNode(evento.nombre));
        bloque.appendChild(nombre);
        const tipo = document.createElement("p");
        tipo.className = "mundo-cal-globo-tipo";
        tipo.textContent = evento.tipo + (evento.anyo ? " · año " + evento.anyo : "");
        bloque.appendChild(tipo);
        if (evento.resumen) {
            const resumen = document.createElement("p");
            resumen.className = "mundo-cal-globo-texto";
            resumen.textContent = evento.resumen;
            bloque.appendChild(resumen);
        }
        globo.appendChild(bloque);
    });

    // Lo que dice ya lo lleva el propio día escrito para el lector de
    // pantalla (y el globo va aria-hidden): esto es para la vista.
    globo.hidden = false;
    colocarGloboDelCalendarioMundo(boton);
}

// Debajo del día, centrado con él pero sin salirse de la tarjeta; si
// debajo no cabe en la pantalla, encima.
function colocarGloboDelCalendarioMundo(boton) {
    const globo = MUNDO_CALENDARIO.globo;
    const tarjeta = MUNDO_CALENDARIO.tarjeta.getBoundingClientRect();
    const dia = boton.getBoundingClientRect();
    const suyo = globo.getBoundingClientRect();
    let izquierda = dia.left - tarjeta.left + dia.width / 2 - suyo.width / 2;
    izquierda = Math.max(6, Math.min(izquierda, tarjeta.width - suyo.width - 6));
    let arriba = dia.bottom - tarjeta.top + 6;
    if (dia.bottom + 6 + suyo.height > window.innerHeight && dia.top - suyo.height - 6 > 0) {
        arriba = dia.top - tarjeta.top - suyo.height - 6;
    }
    globo.style.left = Math.round(izquierda) + "px";
    globo.style.top = Math.round(arriba) + "px";
}

function soltarGloboDelCalendarioMundo() {
    if (MUNDO_CALENDARIO.globo) {
        MUNDO_CALENDARIO.globo.hidden = true;
    }
}


// =========================================
// LAS PIEZAS DE LAS PÁGINAS DE HERRAMIENTAS
// =========================================
// El conversor de fechas, el generador de nombres y el buscador del
// diccionario. Van en páginas de la wiki escritas a mano, como
// <div class="pieza-conversor"></div>, y el generador las cambia por una caja
// con de dónde sacar los datos (ver con_piezas en generar-mundo.py). Sin
// JavaScript se queda la frase de que hace falta; el diccionario sí se ve
// entero sin él (la tabla la escribe el generador).

prepararConversorMundo();
prepararNombresMundo();
prepararDiccionarioMundo();

async function pedirJsonMundo(ruta) {
    const limpia = rutaSeguraMundo(ruta);
    if (limpia === "#" || typeof window.pedirDatos !== "function") {
        return null;
    }
    try {
        const respuesta = await window.pedirDatos(limpia);
        return respuesta.ok ? await respuesta.json() : null;
    } catch (error) {
        return null;
    }
}

function campoDeFormularioMundo(texto, control) {
    const caja = document.createElement("label");
    caja.className = "mundo-pieza-campo";
    const nombre = document.createElement("span");
    nombre.className = "mundo-pieza-etiqueta";
    nombre.textContent = texto;
    caja.appendChild(nombre);
    caja.appendChild(control);
    return caja;
}

function selectMundo(opciones, elegida) {
    const select = document.createElement("select");
    select.className = "mundo-pieza-control";
    opciones.forEach(([valor, texto]) => {
        const opcion = document.createElement("option");
        opcion.value = String(valor);
        opcion.textContent = texto;
        if (String(valor) === String(elegida)) {
            opcion.selected = true;
        }
        select.appendChild(opcion);
    });
    return select;
}

function milesMundo(n) {
    return Math.round(n).toLocaleString("es-ES");
}

// ---- EL CONVERSOR DE FECHAS ----
// Un año (AEM o DEM), un mes y un día del Ciclo de los Heraldos, y dice qué
// día de la semana es, en qué era cae, la luna, qué se celebra y cuánto
// queda o ha pasado desde hoy en Cralëa. Como cada mes empieza en Día del
// Sol, el día de la semana depende solo del día del mes; los cuatro días
// del Fin del Ciclo van fuera de la semana.
async function prepararConversorMundo() {
    const caja = document.querySelector("[data-mundo-conversor]");
    if (!caja) {
        return;
    }
    const [conversor, calendarioCrudo] = await Promise.all([
        pedirJsonMundo(caja.getAttribute("data-conversor-datos")),
        pedirJsonMundo(caja.getAttribute("data-calendario-datos")),
    ]);
    const calendario = limpiarCalendarioMundo(calendarioCrudo);
    if (!conversor || !calendario) {
        return;
    }
    MUNDO_CALENDARIO.datos = MUNDO_CALENDARIO.datos || calendario;
    const antes = (conversor.antes || "").toString();
    const despues = (conversor.despues || "").toString();
    const base = Number(conversor.base_antes) || -1e10;
    const hoyAnyo = Number.isFinite(Number(conversor.hoy)) ? Number(conversor.hoy) : null;
    const diasAnyo = calendario.meses.length * CALENDARIO_DIAS_MES + (calendario.fin ? calendario.fin.dias.length : 0);

    caja.textContent = "";
    const form = document.createElement("form");
    form.className = "mundo-pieza-form";
    form.addEventListener("submit", (evento) => evento.preventDefault());
    const anyo = document.createElement("input");
    anyo.type = "number";
    anyo.min = "0";
    anyo.step = "1";
    anyo.inputMode = "numeric";
    anyo.className = "mundo-pieza-control";
    anyo.value = hoyAnyo !== null && hoyAnyo >= 0 ? String(hoyAnyo) : "1";
    const era = selectMundo([[despues, despues || "después"], [antes, antes || "antes"]], despues);
    const meses = calendario.meses.map((m, i) => [i + 1, m.nombre]);
    if (calendario.fin) {
        meses.push([calendario.total, calendario.fin.nombre]);
    }
    const mesInicial = calendario.hoy ? calendario.hoy.mes : 1;
    const mes = selectMundo(meses, mesInicial);
    const dia = selectMundo([], 1);
    const llenarDias = (elegido) => {
        const n = Number(mes.value);
        const opciones = n > calendario.meses.length
            ? calendario.fin.dias.map((d, i) => [i + 1, d.nombre])
            : Array.from({ length: CALENDARIO_DIAS_MES }, (_, i) => [i + 1, String(i + 1)]);
        dia.textContent = "";
        opciones.forEach(([v, t]) => {
            const o = document.createElement("option");
            o.value = String(v);
            o.textContent = t;
            dia.appendChild(o);
        });
        dia.value = String(Math.min(Number(elegido) || 1, opciones.length));
    };
    llenarDias(calendario.hoy ? calendario.hoy.dia : 1);
    form.appendChild(campoDeFormularioMundo("Año", anyo));
    form.appendChild(campoDeFormularioMundo("Antes o después", era));
    form.appendChild(campoDeFormularioMundo("Mes", mes));
    form.appendChild(campoDeFormularioMundo("Día", dia));
    caja.appendChild(form);

    const salida = document.createElement("div");
    salida.className = "mundo-pieza-salida";
    salida.setAttribute("aria-live", "polite");
    caja.appendChild(salida);

    const linea = (texto, clase) => {
        const p = document.createElement("p");
        p.className = clase || "mundo-pieza-linea";
        p.textContent = texto;
        salida.appendChild(p);
        return p;
    };

    const calcular = () => {
        salida.textContent = "";
        const y = Math.max(0, Math.floor(Number(anyo.value) || 0));
        const esAntes = era.value === antes && antes;
        const numero = esAntes ? base - y : y;
        const m = Number(mes.value);
        const d = Number(dia.value);
        const esFin = m > calendario.meses.length;
        const nombreMes = esFin ? calendario.fin.nombre : calendario.meses[m - 1].nombre;
        const etiquetaAnyo = milesMundo(y) + " " + (esAntes ? antes : despues);
        let cuando;
        if (esFin) {
            cuando = calendario.fin.dias[d - 1].nombre + ", en el " + calendario.fin.nombre +
                " (fuera de la semana)";
        } else {
            const semana = calendario.semana ? calendario.semana[(d - 1) % 7] : null;
            cuando = (semana ? (semana.titulo || semana.nombre) + ", " : "") + d + " del " + nombreMes;
        }
        linea(cuando + ", año " + etiquetaAnyo + ".", "mundo-pieza-titular");

        const suya = (Array.isArray(conversor.eras) ? conversor.eras : []).filter((e) =>
            Number(e.desde) <= numero && (e.fin === null || e.fin === undefined || numero < Number(e.fin))).pop();
        if (suya) {
            const p = linea("En la ");
            const a = document.createElement("a");
            a.className = "mundo-enlace";
            a.href = rutaSeguraMundo(suya.url);
            a.textContent = suya.nombre;
            p.appendChild(a);
            p.appendChild(document.createTextNode("."));
        }
        const fase = esFin ? null : calendario.fases.find((f) => f.dia === d);
        if (fase) {
            linea((fase.icono ? fase.icono + " " : "") + fase.nombre + (fase.efecto ? ": " + fase.efecto : "") + ".");
        }
        const normal = (t) => (t || "").toString().replace(/[.\s]/g, "").toLowerCase();
        const deEseDia = calendario.eventos.filter((e) => e.mes === m && e.dia === d &&
            (!e.anyo || normal(e.anyo) === normal(etiquetaAnyo)));
        (Array.isArray(calendarioCrudo.luna && calendarioCrudo.luna.eclipses) ? calendarioCrudo.luna.eclipses : [])
            .filter((e) => Number(e.mes) === m && Number(e.dia) === d && e.anyo &&
                normal(e.anyo) === normal(etiquetaAnyo))
            .forEach((e) => deEseDia.push({ nombre: e.nombre || "Eclipse", tipo: "eclipse" }));
        deEseDia.forEach((e) => {
            linea((e.tipo === "evento" ? "📌 " : (e.tipo === "eclipse" ? "🌘 " : "🎉 ")) + e.nombre +
                (e.tipo === "festividad" ? " (festividad)" : "") + ".");
        });
        const diaDelAnyo = (esFin ? calendario.meses.length * CALENDARIO_DIAS_MES : (m - 1) * CALENDARIO_DIAS_MES) + d;
        linea("Es el día " + diaDelAnyo + " de los " + diasAnyo + " del año.");

        if (hoyAnyo !== null) {
            const hoyTexto = milesMundo(hoyAnyo) + " " + despues;
            if (esAntes) {
                linea("Hoy en Cralëa es el año " + hoyTexto + ": eso fue hace más de " +
                    milesMundo(y + hoyAnyo) + " años (sin contar lo que duró la " +
                    "época entre " + antes + " y " + despues + ", que nadie midió).");
            } else if (calendario.hoy) {
                const hoyDia = (calendario.hoy.mes > calendario.meses.length
                    ? calendario.meses.length * CALENDARIO_DIAS_MES : (calendario.hoy.mes - 1) * CALENDARIO_DIAS_MES) + calendario.hoy.dia;
                const dif = (y * diasAnyo + diaDelAnyo) - (hoyAnyo * diasAnyo + hoyDia);
                const anyos = Math.floor(Math.abs(dif) / diasAnyo);
                const dias = Math.abs(dif) % diasAnyo;
                const cuanto = (anyos ? milesMundo(anyos) + (anyos === 1 ? " año" : " años") : "") +
                    (anyos && dias ? " y " : "") + (dias ? dias + (dias === 1 ? " día" : " días") : "");
                linea(dif === 0 ? "Es hoy en Cralëa." : (dif < 0 ? "Fue hace " + cuanto + "." : "Será dentro de " + cuanto + "."));
            } else {
                const dif = y - hoyAnyo;
                linea(dif === 0 ? "Es este mismo año (hoy en Cralëa es " + hoyTexto + ")."
                    : (dif < 0 ? "Fue hace " + milesMundo(-dif) + (dif === -1 ? " año" : " años")
                        : "Será dentro de " + milesMundo(dif) + (dif === 1 ? " año" : " años")) +
                      " (hoy en Cralëa es " + hoyTexto + ").");
            }
        }
    };
    mes.addEventListener("change", () => { llenarDias(dia.value); calcular(); });
    [anyo, era, dia].forEach((c) => c.addEventListener("input", calcular));
    calcular();
}

// ---- EL GENERADOR DE NOMBRES ----
// Aprende cómo suenan los nombres de cada sitio con los que ya hay en la
// wiki (datos/wiki/nombres.json, que escribe el generador) y se inventa
// otros parecidos: una cadena de Márkov de letras, que mira las dos
// letras de antes para elegir la siguiente. No devuelve ninguno de los que
// ya existen.
async function prepararNombresMundo() {
    const caja = document.querySelector("[data-mundo-nombres]");
    if (!caja) {
        return;
    }
    const datos = await pedirJsonMundo(caja.getAttribute("data-nombres-datos"));
    const estilos = (datos && Array.isArray(datos.estilos) ? datos.estilos : [])
        .filter((e) => e && e.nombre && Array.isArray(e.ejemplos) && e.ejemplos.length >= 4);
    if (!estilos.length) {
        return;
    }
    caja.textContent = "";
    const form = document.createElement("form");
    form.className = "mundo-pieza-form";
    const estilo = selectMundo(estilos.map((e, i) => [i, e.nombre + " (" + e.ejemplos.length + " de ejemplo)"]), 0);
    form.appendChild(campoDeFormularioMundo("Que suenen a", estilo));
    const boton = document.createElement("button");
    boton.type = "submit";
    boton.className = "mundo-pieza-boton";
    boton.textContent = "Dame nombres";
    form.appendChild(boton);
    caja.appendChild(form);
    const ejemplos = document.createElement("p");
    ejemplos.className = "mundo-pieza-linea mundo-pieza-ejemplos";
    caja.appendChild(ejemplos);
    const lista = document.createElement("ul");
    lista.className = "mundo-nombres-lista";
    lista.setAttribute("aria-live", "polite");
    lista.setAttribute("aria-label", "Nombres inventados");
    caja.appendChild(lista);

    const pintar = () => {
        const elegido = estilos[Number(estilo.value)] || estilos[0];
        ejemplos.textContent = "Aprendidos de: " + elegido.ejemplos.slice(0, 12).join(", ") +
            (elegido.ejemplos.length > 12 ? "…" : "") + ".";
        lista.textContent = "";
        inventarNombresMundo(elegido.ejemplos, 10).forEach((nombre) => {
            const li = document.createElement("li");
            li.textContent = nombre;
            lista.appendChild(li);
        });
    };
    form.addEventListener("submit", (evento) => {
        evento.preventDefault();
        pintar();
    });
    estilo.addEventListener("change", pintar);
    pintar();
}

function inventarNombresMundo(ejemplos, cuantos) {
    const limpios = ejemplos.map((e) => e.toString().trim()).filter((e) => e.length >= 2);
    const conocidos = new Set(limpios.map((e) => e.toLowerCase()));
    const orden = 2;
    const cadena = new Map();
    let largoMin = Infinity;
    let largoMax = 0;
    limpios.forEach((nombre) => {
        const palabra = "^".repeat(orden) + nombre.toLowerCase() + "$";
        largoMin = Math.min(largoMin, nombre.length);
        largoMax = Math.max(largoMax, nombre.length);
        for (let i = orden; i < palabra.length; i++) {
            const clave = palabra.slice(i - orden, i);
            if (!cadena.has(clave)) {
                cadena.set(clave, []);
            }
            cadena.get(clave).push(palabra[i]);
        }
    });
    const salida = new Set();
    let intentos = 0;
    while (salida.size < cuantos && intentos < 4000) {
        intentos++;
        let actual = "^".repeat(orden);
        let nombre = "";
        while (nombre.length < largoMax + 3) {
            const opciones = cadena.get(actual.slice(-orden));
            if (!opciones) {
                break;
            }
            const letra = opciones[Math.floor(Math.random() * opciones.length)];
            if (letra === "$") {
                break;
            }
            nombre += letra;
            actual += letra;
        }
        if (nombre.length < Math.max(3, largoMin - 1) || nombre.length > largoMax + 2 ||
            conocidos.has(nombre) || /['\-]$|^['\-]/.test(nombre)) {
            continue;
        }
        // Mayúscula al principio y después de un apóstrofo, como en
        // «Jhel'Zadir».
        const bonito = nombre.charAt(0).toUpperCase() + nombre.slice(1).replace(/'(.)/g, (_, c) => "'" + c.toUpperCase());
        salida.add(bonito);
    }
    return [...salida];
}

// ---- EL DICCIONARIO ----
// La tabla la escribe el generador; esto solo le pone un buscador encima,
// que va escondiendo las filas que no tienen lo escrito.
function prepararDiccionarioMundo() {
    const caja = document.querySelector("[data-mundo-diccionario]");
    const tabla = caja ? caja.querySelector("table") : null;
    if (!tabla) {
        return;
    }
    const filas = Array.from(tabla.querySelectorAll("[data-diccionario-fila]"));
    const campo = document.createElement("input");
    campo.type = "search";
    campo.className = "mundo-pieza-control";
    campo.placeholder = "una palabra, un idioma, un significado…";
    const cuenta = document.createElement("p");
    cuenta.className = "mundo-pieza-linea";
    cuenta.setAttribute("aria-live", "polite");
    const form = document.createElement("form");
    form.className = "mundo-pieza-form";
    form.setAttribute("role", "search");
    form.addEventListener("submit", (evento) => evento.preventDefault());
    form.appendChild(campoDeFormularioMundo("Buscar en el diccionario", campo));
    // Y POR IDIOMA.
    const idiomas = [...new Set(filas.map((f) => f.getAttribute("data-idioma") || "").filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, "es"));
    const idioma = selectMundo([["", "Todos"]].concat(idiomas.map((i) => [i, i])), "");
    if (idiomas.length) {
        form.appendChild(campoDeFormularioMundo("Idioma", idioma));
    }
    // La tabla va dentro de su caja con scroll (.mundo-tabla): el buscador,
    // delante de esa caja.
    const antesDe = tabla.closest(".mundo-tabla") || tabla;
    antesDe.parentNode.insertBefore(cuenta, antesDe);
    antesDe.parentNode.insertBefore(form, cuenta);
    const llanoDic = (t) => (t || "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const filtrar = () => {
        const buscado = llanoDic(campo.value.trim());
        let vistas = 0;
        const suyo = idioma.value;
        filas.forEach((fila) => {
            const pasa = (!buscado || llanoDic(fila.textContent).includes(buscado)) &&
                (!suyo || fila.getAttribute("data-idioma") === suyo);
            fila.hidden = !pasa;
            vistas += pasa ? 1 : 0;
        });
        cuenta.textContent = (vistas === 1 ? "1 palabra" : vistas + " palabras") +
            (suyo ? " en " + suyo : "") + (buscado ? " con «" + campo.value.trim() + "»" : "") + ".";
    };
    campo.addEventListener("input", filtrar);
    idioma.addEventListener("change", filtrar);
    filtrar();
}


// =========================================
// CUÁNTO FALTA
// =========================================
// Dos barras en la portada: cuántas páginas tienen ya texto de verdad y
// cuántos campos de las fichas están decididos. Lo cuenta el generador
// (progreso_de, en generar-mundo.py). Son <progress>, que el lector de
// pantalla ya lee como tales, con su texto al lado por si no.
function pintarProgresoMundo(progreso) {
    const caja = document.querySelector("[data-mundo-progreso]");
    if (!caja || !progreso || !(progreso.paginas > 0)) {
        return;
    }
    const filas = [
        ["páginas con texto", progreso.escritas, progreso.paginas],
        ["campos de las fichas decididos", progreso.decididos, progreso.campos],
    ];
    const lista = document.createElement("ul");
    lista.className = "mundo-progreso-lista";
    filas.forEach(([que, hecho, total], i) => {
        if (!(total > 0)) {
            return;
        }
        const li = document.createElement("li");
        const id = "mundo-progreso-" + i;
        const etiqueta = document.createElement("label");
        etiqueta.className = "mundo-progreso-que";
        etiqueta.htmlFor = id;
        const tanto = Math.round(100 * hecho / total);
        etiqueta.textContent = que + ": " + hecho + " de " + total + " (" + tanto + " %)";
        const barra = document.createElement("progress");
        barra.className = "mundo-progreso-barra";
        barra.id = id;
        barra.max = total;
        barra.value = hecho;
        barra.textContent = tanto + " %";
        li.appendChild(etiqueta);
        li.appendChild(barra);
        lista.appendChild(li);
    });
    const falta = document.createElement("p");
    falta.className = "mundo-progreso-falta";
    falta.textContent = "Faltan " + Math.max(0, progreso.paginas - progreso.escritas) + " páginas por escribir y "
        + Math.max(0, progreso.campos - progreso.decididos) + " campos por decidir.";
    caja.appendChild(lista);
    caja.appendChild(falta);
    caja.hidden = false;
}


// =========================================
// EL GLOBO: LA VISTA PREVIA DE LOS ENLACES Y EL GLOSARIO
// =========================================
// Un solo globo flotante para las dos cosas:
//
//   · al pasar el ratón por un enlace a otra página de la wiki (o al
//     llegar a él con el tabulador), una tarjeta con su bandera o su mapa,
//     su nombre, qué es y su entradilla (de datos/wiki/mundo.json, que se
//     pide la primera vez que hace falta);
//   · en las palabras del glosario (las del diccionario que salen en el
//     texto; las marca el generador), lo que significan.
//
// El globo es solo para la vista: aria-hidden. Quien usa lector de
// pantalla ya tiene el nombre en el enlace y el significado de cada
// palabra como su descripción (aria-describedby). Se cierra con Escape,
// al salir el ratón o al irse el foco. Con position: fixed (sticky y
// <dialog> no van en el navegador de Richi), y se recoloca para no salirse
// de la pantalla.
prepararGloboMundo();

function prepararGloboMundo() {
    const articulo = document.querySelector(".mundo-migas, .mundo-articulo");
    if (!articulo) {
        return;
    }
    const globo = document.createElement("div");
    globo.className = "mundo-globo";
    globo.setAttribute("aria-hidden", "true");
    globo.hidden = true;
    document.body.appendChild(globo);
    let fichasGlobo = null;
    let dueno = null;
    let espera = 0;

    const fichas = async () => {
        if (fichasGlobo) {
            return fichasGlobo;
        }
        fichasGlobo = new Map();
        if (typeof window.pedirDatos !== "function") {
            return fichasGlobo;
        }
        try {
            const respuesta = await window.pedirDatos("/datos/wiki/mundo.json");
            const lista = respuesta.ok ? await respuesta.json() : [];
            (Array.isArray(lista) ? lista : []).forEach((f) => {
                if (f && f.url) {
                    fichasGlobo.set(f.url.toString(), f);
                }
            });
        } catch (error) {
            // Sin vista previa, y ya está.
        }
        return fichasGlobo;
    };

    const colocar = (junto) => {
        const caja = junto.getBoundingClientRect();
        globo.style.left = "0px";
        globo.style.top = "0px";
        const ancho = globo.offsetWidth;
        const alto = globo.offsetHeight;
        const margen = 8;
        let x = Math.min(Math.max(margen, caja.left), window.innerWidth - ancho - margen);
        let y = caja.bottom + margen;
        if (y + alto > window.innerHeight - margen && caja.top - alto - margen > margen) {
            y = caja.top - alto - margen;
        }
        globo.style.left = Math.round(Math.max(margen, x)) + "px";
        globo.style.top = Math.round(y) + "px";
    };

    const cerrar = () => {
        clearTimeout(espera);
        dueno = null;
        globo.hidden = true;
        globo.textContent = "";
        globo.className = "mundo-globo";
    };

    const abrirGlosario = (boton) => {
        const definicion = document.getElementById(boton.getAttribute("aria-describedby") || "");
        const texto = definicion ? definicion.textContent : "";
        if (!texto.trim()) {
            return;
        }
        dueno = boton;
        globo.textContent = "";
        globo.className = "mundo-globo es-glosario";
        const palabra = document.createElement("strong");
        palabra.className = "mundo-globo-titulo";
        palabra.textContent = boton.textContent;
        const que = document.createElement("span");
        que.className = "mundo-globo-resumen";
        que.textContent = texto;
        globo.appendChild(palabra);
        globo.appendChild(que);
        globo.hidden = false;
        colocar(boton);
    };

    const abrirEnlace = async (enlace) => {
        dueno = enlace;
        const url = new URL(enlace.href, location.href);
        const mapa = await fichas();
        if (dueno !== enlace) {
            return;
        }
        const f = mapa.get(url.pathname);
        if (!f) {
            return;
        }
        globo.textContent = "";
        globo.className = "mundo-globo es-enlace";
        const imagen = (f.bandera || f.miniatura || "").toString();
        if (imagen && rutaSeguraMundo(imagen) !== "#") {
            const img = document.createElement("img");
            img.className = "mundo-globo-imagen";
            img.src = rutaSeguraMundo(imagen);
            img.alt = "";
            img.loading = "lazy";
            globo.appendChild(img);
        }
        const texto = document.createElement("div");
        texto.className = "mundo-globo-texto";
        const titulo = document.createElement("strong");
        titulo.className = "mundo-globo-titulo";
        titulo.textContent = (f.titulo || "").toString();
        texto.appendChild(titulo);
        if ((f.que || "").toString().trim()) {
            const que = document.createElement("span");
            que.className = "mundo-globo-que";
            que.textContent = f.que.toString();
            texto.appendChild(que);
        }
        let resumen = (f.resumen || "").toString().trim();
        if (resumen.length > 220) {
            resumen = resumen.slice(0, 220).replace(/\s+\S*$/, "") + "…";
        }
        if (resumen) {
            const r = document.createElement("span");
            r.className = "mundo-globo-resumen";
            r.textContent = resumen;
            texto.appendChild(r);
        }
        globo.appendChild(texto);
        globo.hidden = false;
        colocar(enlace);
        const img = globo.querySelector("img");
        if (img && !img.complete) {
            img.addEventListener("load", () => {
                if (dueno === enlace) {
                    colocar(enlace);
                }
            }, { once: true });
        }
    };

    const deLaWiki = (enlace) => {
        if (!enlace || enlace.closest(".mundo-migas, .mundo-globo")) {
            return false;
        }
        let url = null;
        try {
            url = new URL(enlace.href, location.href);
        } catch (error) {
            return false;
        }
        return url.origin === location.origin && url.pathname.startsWith("/web/wiki/")
            && url.pathname !== location.pathname && !/index_wiki\.html$/.test(url.pathname);
    };

    const entrar = (evento) => {
        const objetivo = evento.target instanceof Element ? evento.target : null;
        const glosario = objetivo ? objetivo.closest(".mundo-glosario") : null;
        const enlace = objetivo ? objetivo.closest("main a[href]") : null;
        if (glosario) {
            clearTimeout(espera);
            abrirGlosario(glosario);
        } else if (enlace && deLaWiki(enlace) && enlace !== dueno) {
            clearTimeout(espera);
            // Un poco de espera con el ratón, para que no salte al cruzar
            // la página; con el teclado, al momento.
            espera = setTimeout(() => abrirEnlace(enlace), evento.type === "focusin" ? 0 : 350);
        }
    };
    const salir = (evento) => {
        const hacia = evento.relatedTarget instanceof Element ? evento.relatedTarget : null;
        if (dueno && hacia && dueno.contains(hacia)) {
            return;
        }
        // Al salir el ratón de lo que tiene el foco (lo pulsado con el
        // dedo, o a lo que se llegó con el tabulador), sigue abierto: se
        // cierra al irse el foco.
        if (evento.type === "mouseout" && dueno && document.activeElement === dueno) {
            return;
        }
        const objetivo = evento.target instanceof Element ? evento.target : null;
        if (objetivo && objetivo.closest(".mundo-glosario, main a[href]")) {
            cerrar();
        }
    };
    document.addEventListener("mouseover", entrar);
    document.addEventListener("focusin", entrar);
    document.addEventListener("mouseout", salir);
    document.addEventListener("focusout", salir);
    // En una pantalla táctil no hay «pasar por encima»: pulsar la palabra
    // abre o cierra su significado.
    document.addEventListener("click", (evento) => {
        const glosario = evento.target instanceof Element ? evento.target.closest(".mundo-glosario") : null;
        if (glosario) {
            // Abre, no alterna: al pulsar ya ha llegado el foco y lo ha
            // abierto. Se cierra pulsando fuera o con Escape.
            abrirGlosario(glosario);
        } else if (!globo.hidden) {
            cerrar();
        }
    });
    document.addEventListener("keydown", (evento) => {
        if (evento.key === "Escape" && !globo.hidden) {
            cerrar();
        }
    });
    const seccion = document.querySelector("main > section");
    if (seccion) {
        seccion.addEventListener("scroll", cerrar, { passive: true });
    }
    window.addEventListener("resize", cerrar);
}
