// =========================================
// EL MUNDO — la portada de la wiki
// =========================================
// Pinta el índice de la wiki: todas las páginas repartidas por la carpeta
// en la que están escritas, con su buscador y sus botones de etiqueta.
//
// AQUÍ NO HAY NINGÚN TEXTO DEL MUNDO. Cada página de la wiki es un HTML de
// verdad (web/mundo/<loquesea>.html), escrito por
// herramientas/3-generadores/generar-mundo.py a partir de la bóveda de
// Chronicler que hay en mundo/. Esto solo pinta la LISTA, y la lista sale
// de datos/mundo.json, que escribe esa misma herramienta.
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
// Quién va en qué apartado lo decide datos/mundo-categorias.json y lo
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
    // como diga datos/mundo-categorias.json, y reordenar aquí sería
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
    [...porEtiqueta.keys()].sort((a, b) => a.localeCompare(b, "es")).forEach((e) => {
        const sub = document.createElement("div");
        sub.className = "mundo-sub";
        sub.setAttribute("data-mundo-sub", e);
        const suyo = document.createElement("h3");
        suyo.className = "mundo-sub-titulo";
        suyo.textContent = e;
        sub.appendChild(suyo);
        sub.appendChild(listaDeFichasMundo(porEtiqueta.get(e)));
        bloque.appendChild(sub);
    });
    return bloque;
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
    const grupo = bloque.getAttribute("data-mundo-grupo");
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
    const mapas = fichas.filter((f) => (f.vista || "").toString().trim());
    // Sin mapas no hay columna: un título suelto encima de un hueco no
    // dice nada.
    caja.hidden = !mapas.length;
    if (!mapas.length) {
        return;
    }
    caja.querySelectorAll(".mundo-vista").forEach((vieja) => vieja.remove());
    mapas.forEach((ficha) => caja.appendChild(tarjetaDeMapaMundo(ficha)));
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

function listaDeFichasMundo(fichas) {
    const lista = document.createElement("ul");
    lista.className = "mundo-items";
    fichas.forEach((ficha) => lista.appendChild(itemDelMundo(ficha)));
    return lista;
}

// Se monta con createElement y no con innerHTML: cada dato es un texto
// suelto y textContent lo pone tal cual, sin que haya que acordarse de
// escapar nada.
function itemDelMundo(ficha) {
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

    const titulo = document.createElement("strong");
    titulo.className = "mundo-item-titulo";
    titulo.textContent = ficha.titulo.toString().trim();
    enlace.appendChild(titulo);

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

function repasarGruposMundo() {
    // Primero los subapartados: un título de etiqueta encima de un hueco
    // vacío es lo mismo que un apartado vacío, pero más pequeño.
    document.querySelectorAll(".mundo-sub").forEach((sub) => {
        const vivos = [...sub.querySelectorAll(".mundo-ficha-item")]
            .filter((item) => !item.hidden).length;
        sub.hidden = vivos === 0;
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
