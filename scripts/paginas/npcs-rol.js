// =========================================
// LOS NPC — la gente de una campaña
// =========================================
// Pinta la rejilla de tokens repartida por grupos y abre la ficha de cada
// uno en una ventana (el componente de scripts/componentes/ventana-modal.js).
//
// QUIÉN MANDA: el JSON que diga la propia página en data-npcs-datos de la
// lista. Hoy es datos/notas_rol/npcs-ragna.json. Ahí se escribe todo a mano: el
// nombre, el grupo, las dos imágenes y lo que se sepa.
//
// PARA UNA CAMPAÑA NUEVA no hay que tocar este archivo: se copia la
// página, se cambia ese atributo y se crea su JSON.
//
// AQUÍ SOLO HAY NPC. Los personajes de los jugadores no están en esta
// página: salen del JSON de la campaña y se ven en «la mesa», una ventana
// del índice de la campaña (ver scripts/paginas/notas-rol.js).
//
// CÓMO ES UN PERSONAJE EN EL JSON
// -------------------------------
//   {
//     "nombre": "Sigil",
//     "categoria": "la Gran Caravana",   <- el grupo; el que quieras
//     "que": "Comerciante",              <- la línea de debajo del nombre
//     "donde": "la Gran Caravana",
//     "relacion": "aliado",              <- aliado / neutral / enemigo…
//     "estado": "vivo",                  <- vivo / muerto / desaparecido…
//     "token": "/imagenes/notas_rol/ragna/sigil-token.webp",
//     "ilustracion": "/imagenes/notas_rol/ragna/sigil.webp",
//     "notas": ["lo que sepamos", "y más"],
//     "primera": 1                       <- sesión en la que apareció
//   }
//
// Lo único obligatorio es el nombre. Lo que falte no sale, y si no hay
// imagen se dibuja la inicial dentro del marco: se ve que falta el
// retrato en vez de quedar un cuadro roto.
//
// UNO PUEDE ESTAR EN VARIOS GRUPOS. "categoria" admite una lista, y
// también vale escribir "categorias" en plural, que es como se lee mejor:
//
//     "categorias": ["la Gran Caravana", "Sirevia"]
//
// Entonces su token SALE EN LOS DOS GRUPOS. No es una copia: es la misma
// ficha, y al pulsar cualquiera de los dos tokens se abre la misma. Es lo
// que quiere decir pertenecer a dos sitios: a la tabernera de Sirevia que
// luego se une a la caravana se la busca en los dos.
//
// LOS GRUPOS NO ESTÁN ESCRITOS EN NINGÚN SITIO: salen de las categorías
// que haya en el JSON, en el orden en que aparecen. Inventarse una
// categoría nueva la crea sola, con su botón de filtro incluido.
//
// EL BUSCADOR es el mismo componente que el archivo del blog, los relatos
// y el portfolio (scripts/componentes/buscador.js), y se cruza con los
// botones de categoría: con "Sirevia" puesto y "taber" escrito sale quien
// sea de Sirevia Y lleve "taber". Quien esconde los tokens es el filtro
// (filtros.js, por su data-categoria), y lo único que se hace aquí es
// esconder el TÍTULO de un grupo que se haya quedado sin nadie.
//
// ABRIR UNA FICHA DESDE FUERA: la página entiende un ?quien= con el
// nombre de cualquiera (npcs_ragna.html?quien=terkus) y abre su ficha al
// llegar. Es lo que usan los nombres de la ficha de la campaña. Lo que
// venga en la dirección NO se pinta en ningún sitio: se compara con los
// nombres que hay y, si no cuadra con ninguno, no pasa nada.
//
// OJO CON LOS NOMBRES: todos los scripts comparten el mismo ámbito
// global, así que lo de aquí lleva "Npc" o "npc" en el nombre. Se
// comprueba con herramientas/4-comprobar/nombres-repetidos.py.

// Lo que significa cada palabra de "relacion" y de "estado" para la
// marquita de color. Lo que NO esté aquí sale igualmente, con su palabra
// y la marca en gris: el JSON lo escribes tú y no tiene por qué pedirle
// permiso a esta lista.
const NPC_TONOS = {
    aliado: "es-bueno",
    aliada: "es-bueno",
    amigo: "es-bueno",
    amiga: "es-bueno",
    vivo: "es-bueno",
    viva: "es-bueno",
    neutral: "es-normal",
    enemigo: "es-malo",
    enemiga: "es-malo",
    muerto: "es-malo",
    muerta: "es-malo",
    desaparecido: "es-raro",
    desaparecida: "es-raro",
};

// Las palabras con las que un personaje sale apagado y tachado en la
// rejilla: ya no está. Va aparte de los tonos de arriba porque son dos
// cosas distintas —un enemigo vivo no está tachado— y porque esto es lo
// único que se ve sin abrir la ficha.
const NPC_FUERA = ["muerto", "muerta", "desaparecido", "desaparecida"];

// Los tokens ya pintados, por nombre de archivo ("terkus"), para poder
// abrir una ficha desde el ?quien= de la dirección.
const npcTokensPorSlug = new Map();

initializeNpcsRol();

async function initializeNpcsRol() {
    const lista = document.querySelector("[data-npcs-lista]");
    if (!lista) {
        return;
    }
    const fuente = (lista.getAttribute("data-npcs-datos") || "").trim();
    if (!fuente || typeof window.pedirDatos !== "function") {
        return;
    }

    let datos = null;
    try {
        const respuesta = await window.pedirDatos(fuente);
        if (!respuesta.ok) {
            throw new Error("La respuesta no fue correcta");
        }
        datos = await respuesta.json();
    } catch (error) {
        lista.innerHTML =
            '<li class="entries-error">No se ha podido cargar el reparto ahora mismo.</li>';
        return;
    }

    // Y el JSON de la campaña, que es opcional: de ahí salen el enlace de
    // "volver a la campaña" y las direcciones de las sesiones, para poder
    // enlazar aquella en la que apareció cada uno. Si no llega, la página
    // funciona igual: el botón de volver se queda con el enlace que trae
    // escrito y las sesiones salen como texto suelto ("Sesión 3").
    const deLaCampana = (lista.getAttribute("data-campana-datos") || "").trim();
    if (deLaCampana) {
        try {
            const respuesta = await window.pedirDatos(deLaCampana);
            if (respuesta.ok) {
                const campana = await respuesta.json();
                datos.sesiones = campana.sesiones;
                datos.misiones = campana.misiones;
                if (!(datos.campana_pagina || "").trim()) {
                    datos.campana_pagina = campana.pagina;
                }
                if (!(datos.nombre || "").trim()) {
                    datos.nombre = campana.nombre;
                }
            }
        } catch (error) {
            // Sin el JSON de la campaña no se pierde nada importante.
        }
    }

    pintarCabeceraNpc(datos);
    pintarGruposNpc(lista, datos);
    abrirElDeLaDireccion();
}

function pintarCabeceraNpc(datos) {
    const nombre = document.querySelector("[data-npcs-nombre]");
    if (nombre && (datos.nombre || "").trim()) {
        nombre.textContent = datos.nombre.trim();
    }
    const intro = document.querySelector("[data-npcs-intro]");
    if (intro && (datos.intro || "").trim()) {
        intro.textContent = datos.intro.trim();
    }
    // El botón de volver apunta al índice de la campaña. Si el JSON no lo
    // dice, se queda el que hubiera escrito en la página.
    const volver = document.querySelector("[data-npcs-volver]");
    const campana = rutaSeguraNpc(datos.campana_pagina);
    if (volver && campana !== "#") {
        volver.setAttribute("href", campana);
    }
}


// =========================================
// LA REJILLA
// =========================================
// Se monta con createElement y no con innerHTML: cada dato es un texto
// suelto y textContent lo pone tal cual, sin que haya que acordarse de
// escapar nada. Es lo mismo que hace la ficha de la campaña.

// Los grupos a los que pertenece alguien, siempre como lista. Admite las
// tres formas con las que uno lo escribiría sin pensar: "categoria" con
// una palabra, "categoria" con una lista y "categorias" en plural. Lo
// que no tenga ninguna cae en "sin clasificar", que es un grupo como
// otro cualquiera y se ve en la página: así se nota que falta.
function gruposDeNpc(quien) {
    const crudo = quien.categorias !== undefined ? quien.categorias : quien.categoria;
    const lista = (Array.isArray(crudo) ? crudo : [crudo])
        .map((c) => (c || "").toString().trim())
        .filter(Boolean);
    // Sin duplicados: escribir dos veces el mismo grupo sacaría el token
    // dos veces dentro de él.
    return [...new Set(lista.length ? lista : ["sin clasificar"])];
}

function pintarGruposNpc(lista, datos) {
    const gente = (Array.isArray(datos.personajes) ? datos.personajes : []).filter(
        (p) => p && (p.nombre || "").toString().trim()
    );

    lista.textContent = "";
    npcTokensPorSlug.clear();
    if (!gente.length) {
        const vacio = document.createElement("li");
        vacio.className = "entries-empty";
        vacio.textContent = "Todavía no hay nadie apuntado en esta campaña.";
        lista.appendChild(vacio);
        return;
    }

    // Los grupos, en el orden en que aparecen en el JSON. A propósito: la
    // lista la ordenas tú escribiéndola, y por orden alfabético "la Gran
    // Caravana" caería entre "dioses" y "los bandidos", que no es como se
    // piensa en una campaña.
    //
    // Quien esté en dos grupos se apunta en los dos. No es una copia de la
    // ficha: es el mismo objeto, y los dos tokens abren lo mismo.
    const orden = [];
    const porGrupo = new Map();
    gente.forEach((quien) => {
        gruposDeNpc(quien).forEach((grupo) => {
            if (!porGrupo.has(grupo)) {
                porGrupo.set(grupo, []);
                orden.push(grupo);
            }
            porGrupo.get(grupo).push(quien);
        });
    });

    // Y ahora, repartidos por APARTADOS: una región grande (Sirevia) con
    // los grupos que la componen dentro (Sirevia, los bandidos, Chitxia).
    // Lo que no esté en ningún apartado sale suelto al final, que es como
    // salía todo antes de que esto existiera.
    repartirPorApartadosNpc(lista, orden, porGrupo, datos);

    // Los botones de filtro los monta el componente de siempre
    // (scripts/componentes/filtros.js) contando los data-categoria que
    // acaban de aparecer, y el buscador vuelve a aplicar lo que hubiera
    // escrito. Como esto llega por fetch, cuando esos scripts se
    // ejecutaron todavía no había ni un token: hay que avisarles.
    document.dispatchEvent(new CustomEvent("filtros:actualizar"));
}

// =========================================
// LOS APARTADOS
// =========================================
// Una categoría es un grupo de gente ("los bandidos de Sirevia"); un
// apartado es el sitio al que pertenecen varias ("Sirevia", que es la
// región). Los apartados se escriben a mano en el JSON de la campaña:
//
//     "apartados": [
//         { "nombre": "la Gran Caravana", "categorias": ["Gran Caravana"] },
//         { "nombre": "Sirevia",
//           "categorias": ["Sirevia", "Bandidos de Sirevia", "Chitxia"] }
//     ]
//
// SI NO HAY APARTADOS NO PASA NADA: cada categoría sale suelta, que es
// como estaba la página antes. Y una categoría que no esté en ninguno
// sale igual, al final: nadie se queda fuera por olvidarse de apuntarlo.
//
// Dentro de un apartado, la categoría que se llama IGUAL que él sale sin
// título propio y la primera: un apartado «Sirevia» con un subtítulo
// «Sirevia» dentro es repetir la misma palabra dos veces seguidas.

function apartadosDeNpc(datos) {
    const crudos = Array.isArray(datos.apartados) ? datos.apartados : [];
    return crudos
        .map((uno) => ({
            nombre: (uno && uno.nombre ? uno.nombre : "").toString().trim(),
            categorias: (Array.isArray(uno && uno.categorias) ? uno.categorias : [])
                .map((c) => (c || "").toString().trim())
                .filter(Boolean),
        }))
        .filter((uno) => uno.nombre && uno.categorias.length);
}

function repartirPorApartadosNpc(lista, orden, porGrupo, datos) {
    const apartados = apartadosDeNpc(datos);
    const colocadas = new Set();

    apartados.forEach((apartado) => {
        // Solo las categorías que de verdad tienen a alguien: un apartado
        // puede nombrar una categoría que todavía no existe.
        const suyas = apartado.categorias.filter((c) => porGrupo.has(c));
        if (!suyas.length) {
            return;
        }
        suyas.forEach((c) => colocadas.add(c));
        lista.appendChild(bloqueDeApartadoNpc(apartado, suyas, porGrupo, datos));
    });

    orden.forEach((grupo) => {
        if (colocadas.has(grupo)) {
            return;
        }
        lista.appendChild(bloqueDeGrupoNpc(grupo, porGrupo.get(grupo), datos, 2));
    });
}

// UN APARTADO SE PLIEGA Y SE DESPLIEGA. Por dentro es un <details>, que
// lo hace solo —con el ratón, con el teclado y diciéndolo un lector de
// pantalla— sin que haya que escribir nada de eso a mano. Es lo mismo que
// hacen los apartados de la wiki (scripts/paginas/mundo.js).
//
// El <details> va DENTRO del <li> y no es el <li>: la lista de apartados
// es un <ul> y lo único que puede colgar de un <ul> es un <li>. El <li>
// sigue siendo quien lleva la clase .npc-apartado y quien se esconde
// cuando el apartado se queda sin nadie (repasarGruposNpc).
//
// Lo que se deje plegado se recuerda en el navegador de quien mira, en la
// misma caja donde el sitio guarda el tema y el tamaño del texto.
function bloqueDeApartadoNpc(apartado, categorias, porGrupo, datos) {
    const bloque = document.createElement("li");
    bloque.className = "npc-apartado";
    bloque.setAttribute("data-npc-apartado", apartado.nombre);

    const caja = document.createElement("details");
    caja.className = "npc-apartado-caja";
    caja.open = !NPC_CERRADOS.has(apartado.nombre);
    caja.addEventListener("toggle", () => recordarApartadoNpc(bloque, caja));

    // El tirador de plegar es el <summary>, y dentro va el <h2> de
    // siempre: así el apartado sigue siendo un encabezado de nivel 2 y
    // los grupos de dentro siguen siendo los <h3> que cuelgan de él, que
    // es lo que recorre quien navega la página por encabezados. Un
    // <summary> solo puede llevar UN encabezado y nada más al lado, así
    // que la flecha va dentro del <h2>.
    const tirador = document.createElement("summary");
    tirador.className = "npc-apartado-tirador";

    const titulo = document.createElement("h2");
    titulo.className = "npc-apartado-titulo";
    const flecha = document.createElement("span");
    flecha.className = "npc-apartado-flecha";
    flecha.setAttribute("aria-hidden", "true");
    flecha.textContent = "▾";
    titulo.appendChild(flecha);
    const nombre = document.createElement("span");
    nombre.textContent = apartado.nombre;
    titulo.appendChild(nombre);
    const cuenta = document.createElement("span");
    cuenta.className = "npc-grupo-cuenta";
    cuenta.setAttribute("data-npc-cuenta-apartado", "");
    titulo.appendChild(cuenta);
    tirador.appendChild(titulo);
    caja.appendChild(tirador);

    const dentro = document.createElement("ul");
    dentro.className = "npc-apartado-grupos";
    // La que se llama como el apartado, primero y sin título.
    const llano = (texto) => (texto || "").toString().trim().toLowerCase();
    const comoElApartado = categorias.filter((c) => llano(c) === llano(apartado.nombre));
    const lasDemas = categorias.filter((c) => llano(c) !== llano(apartado.nombre));
    [...comoElApartado, ...lasDemas].forEach((grupo) => {
        // Sin título propio cuando repetiría lo de arriba: o porque se
        // llama igual que el apartado, o porque es el único que hay
        // dentro («LA GRAN CARAVANA» y debajo «↳ Gran Caravana» es decir
        // dos veces lo mismo con dos tamaños de letra).
        const sinTitulo = llano(grupo) === llano(apartado.nombre) || categorias.length === 1;
        dentro.appendChild(bloqueDeGrupoNpc(grupo, porGrupo.get(grupo), datos, 3, sinTitulo));
    });
    caja.appendChild(dentro);
    bloque.appendChild(caja);
    return bloque;
}

// QUÉ APARTADOS ESTÁN PLEGADOS. Se guarda la lista de los CERRADOS y no la
// de los abiertos: así un apartado nuevo —uno que aparezca al añadir una
// región al JSON— nace abierto, que es lo que se espera.
//
// La caja es la misma idea que la de la wiki pero con su propia llave:
// cerrar «Sirevia» en los npcs no tiene por qué cerrar nada en la wiki.
const NPC_CERRADOS = leerCerradosNpc();

function leerCerradosNpc() {
    try {
        const crudo = window.localStorage.getItem("richi-npc-cerrados");
        return new Set(crudo ? JSON.parse(crudo) : []);
    } catch (error) {
        // Sin localStorage (navegación privada, permisos) no pasa nada:
        // todos los apartados salen abiertos.
        return new Set();
    }
}

function recordarApartadoNpc(bloque, caja) {
    const nombre = bloque.getAttribute("data-npc-apartado");
    // Mientras se busca o se filtra, los apartados se abren solos (ver
    // repasarGruposNpc); eso no lo ha decidido quien mira, así que no se
    // guarda. data-npc-forzado es lo que distingue "lo he abierto yo" de
    // "lo ha abierto el buscador".
    if (bloque.hasAttribute("data-npc-forzado")) {
        return;
    }
    if (caja.open) {
        NPC_CERRADOS.delete(nombre);
    } else {
        NPC_CERRADOS.add(nombre);
    }
    try {
        window.localStorage.setItem("richi-npc-cerrados", JSON.stringify([...NPC_CERRADOS]));
    } catch (error) {
        // Si no se puede guardar, se pierde al recargar y ya está.
    }
}

function bloqueDeGrupoNpc(grupo, gente, datos, nivel, sinTitulo) {
    const bloque = document.createElement("li");
    bloque.className = "npc-grupo";
    bloque.setAttribute("data-npc-grupo", grupo);

    const titulo = document.createElement(nivel === 3 ? "h3" : "h2");
    titulo.className = "npc-grupo-titulo";
    if (nivel === 3) {
        titulo.classList.add("es-de-dentro");
    }
    const nombre = document.createElement("span");
    nombre.textContent = grupo;
    titulo.appendChild(nombre);
    const cuenta = document.createElement("span");
    cuenta.className = "npc-grupo-cuenta";
    cuenta.setAttribute("data-npc-cuenta", "");
    titulo.appendChild(cuenta);
    // La categoría que se llama como su apartado no repite el título,
    // pero la cuenta sí hace falta: va escondida para quien ve y la lee
    // igual un lector de pantalla.
    if (sinTitulo) {
        titulo.classList.add("visually-hidden");
    }
    bloque.appendChild(titulo);

    const rejilla = document.createElement("ul");
    rejilla.className = "npc-rejilla";
    gente.forEach((quien) => {
        const celda = document.createElement("li");
        celda.className = "npc-celda";
        // Esto es lo que leen el filtro Y el buscador. Va en la CELDA y no
        // en el grupo: quien está en dos grupos tiene dos celdas, cada una
        // con su categoría, y así filtrar por una de ellas lo deja donde
        // toca sin sacarlo del otro sitio.
        celda.setAttribute("data-categoria", grupo);
        // Para contar personas y no tokens en el apartado de arriba.
        celda.setAttribute("data-npc-quien", (quien.nombre || "").toString().trim());
        celda.appendChild(tokenDeNpc(quien, datos));
        rejilla.appendChild(celda);
    });
    bloque.appendChild(rejilla);
    return bloque;
}

function tokenDeNpc(quien, datos) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "npc-token";
    // aria-haspopup="dialog" avisa de que esto abre una ventana, no de
    // que lleva a otra página: es la diferencia entre esperar un cambio
    // de pantalla y esperar que se abra algo encima.
    boton.setAttribute("aria-haspopup", "dialog");

    const estado = (quien.estado || "").toString().trim().toLowerCase();
    if (NPC_FUERA.indexOf(estado) !== -1) {
        boton.classList.add("esta-fuera");
    }

    const marco = document.createElement("span");
    marco.className = "npc-token-marco";
    marco.appendChild(
        // En la rejilla, la pequeña (280 px): aquí se ve a 102-140. La
        // grande se queda para la ficha.
        retratoNpc(quien.token_mini || quien.token, quien.nombre, "npc-token-img",
            "npc-token-mono", quien.token)
    );
    boton.appendChild(marco);

    const nombre = document.createElement("span");
    nombre.className = "npc-token-nombre";
    nombre.textContent = quien.nombre.toString().trim();
    boton.appendChild(nombre);

    // Lo que es, escrito debajo del nombre y en pequeño. Antes solo estaba
    // dentro de la ficha; está aquí porque es lo que hace que el buscador
    // sirva de algo: escribir "tabernera" sin abrir treinta fichas.
    const que = (quien.que || "").toString().trim();
    if (que) {
        const linea = document.createElement("span");
        linea.className = "npc-token-que";
        linea.textContent = que;
        boton.appendChild(linea);
    }

    // El nombre que se lee en voz alta, de una vez: "Terkus, bandido,
    // muerto. Abre su ficha". Sin esto se oía solo el nombre y había que
    // abrir la ficha para saber si ese seguía vivo.
    const trozos = [quien.nombre.toString().trim()];
    if (que) {
        trozos.push(que);
    }
    if (estado) {
        trozos.push(estado);
    }
    boton.setAttribute("aria-label", trozos.join(", ") + ". Abre su ficha");

    boton.addEventListener("click", () => abrirFichaNpc(quien, datos, boton));
    // Para poder abrir esta ficha desde un ?quien=. El primero que se
    // llame así se queda con el nombre: si hay dos Sigil en el archivo, el
    // enlace lleva al de arriba, que es lo esperable. Y quien esté en dos
    // grupos tiene dos tokens: se guarda el primero, que es el que está
    // más arriba en la página.
    const slug = nombreDeArchivoNpc(quien.nombre.toString().trim());
    if (!npcTokensPorSlug.has(slug)) {
        npcTokensPorSlug.set(slug, { boton: boton, quien: quien, datos: datos });
    }
    return boton;
}

// El retrato, o la inicial si no hay foto todavía. aria-hidden en la
// inicial porque el nombre va escrito justo al lado; y el alt de la foto
// se queda vacío por lo mismo: leerlo sería decir el nombre dos veces.
// Las dos clases van enteras y no pegadas con un "+": escritas a trozos
// (clase + "-img") no se encuentran buscándolas, y herramientas/css-sano
// y el repaso de clases sin usar las daban por muertas estando vivas.
function retratoNpc(ruta, nombre, claseImg, claseMono, respaldo) {
    const limpia = imagenSeguraNpc(ruta);
    if (limpia) {
        const img = document.createElement("img");
        img.className = claseImg;
        img.src = limpia;
        // SI LA PEQUEÑA NO CARGA, LA GRANDE. La pequeña ("token_mini") la
        // hace herramientas/2-imagenes/tokens-pequenos.py; si falta o se
        // ha borrado, mejor la grande que un hueco.
        const grande = imagenSeguraNpc(respaldo);
        if (grande && grande !== limpia) {
            img.addEventListener("error", () => {
                img.src = grande;
            }, { once: true });
        }
        img.alt = "";
        // Dos cosas que el navegador hace mejor que nosotros: no bajar lo
        // que no se ve todavía, y saber el hueco antes de pintar para que
        // la rejilla no pegue un salto cuando llegan las fotos.
        img.loading = "lazy";
        img.decoding = "async";
        return img;
    }
    const mono = document.createElement("span");
    mono.className = claseMono;
    mono.setAttribute("aria-hidden", "true");
    mono.textContent = (nombre || "?").toString().trim().charAt(0).toUpperCase();
    return mono;
}


// =========================================
// LOS GRUPOS QUE SE QUEDAN SIN NADIE
// =========================================
// Quien esconde los tokens es el filtro (filtros.js), que mira el
// data-categoria de cada celda y, de paso, si pasa el buscador. Pero el
// TÍTULO del grupo no es una celda, así que al buscar "terkus" quedaban
// ocho títulos flotando encima de ocho huecos vacíos.
//
// Esto lo arregla por el otro lado: cuando el filtro termina de repartir
// (avisa con "filtros:cambiado"), se mira grupo por grupo si le queda
// alguna celda a la vista y se esconde el que no. Y de paso se pone al
// día la cuenta del título, que si no diría "8 fichas" con una sola.
//
// Va DESPUÉS de que el filtro haya escondido, no a la vez: si los dos
// escondieran por su cuenta el último en pasar desharía lo del otro.

document.addEventListener("filtros:cambiado", repasarGruposNpc);
document.addEventListener("filtros:actualizar", repasarGruposNpc);

function repasarGruposNpc() {
    document.querySelectorAll(".npc-grupo").forEach((grupo) => {
        const celdas = [...grupo.querySelectorAll(".npc-celda")];
        const vivas = celdas.filter((celda) => !celda.hidden).length;
        grupo.hidden = vivas === 0;
        const cuenta = grupo.querySelector("[data-npc-cuenta]");
        if (cuenta) {
            cuenta.textContent = vivas === 1 ? "1 ficha" : vivas + " fichas";
        }
    });

    // Y los apartados, que se quedan vacíos cuando se vacían todos sus
    // grupos. La cuenta de un apartado cuenta PERSONAS y no fichas:
    // quien está en dos grupos del mismo sitio —Terkus, que es de Sirevia
    // y de sus bandidos— tiene dos tokens pero es una sola persona.
    // ¿Se está buscando o filtrando algo? Entonces los apartados plegados
    // se abren solos: encontrar a alguien y que no se vea porque su región
    // estaba cerrada es peor que no encontrarlo. Al terminar la búsqueda
    // vuelven a como estaban. Lo mismo que hace la wiki.
    const rebuscando = !!(window.buscador && window.buscador.texto)
        || [...document.querySelectorAll(".filtro-btn")]
            .some((b) => b.getAttribute("aria-pressed") === "true"
                && b.getAttribute("data-categoria") !== "todas");

    document.querySelectorAll(".npc-apartado").forEach((apartado) => {
        const celdas = [...apartado.querySelectorAll(".npc-celda")]
            .filter((celda) => !celda.hidden);
        const cuantos = new Set(celdas.map((celda) => celda.getAttribute("data-npc-quien"))).size;
        apartado.hidden = cuantos === 0;
        const cuenta = apartado.querySelector("[data-npc-cuenta-apartado]");
        if (cuenta) {
            cuenta.textContent = cuantos === 1 ? "1 ficha" : cuantos + " fichas";
        }

        const caja = apartado.querySelector(".npc-apartado-caja");
        if (!caja) {
            return;
        }
        if (rebuscando && cuantos && !caja.open) {
            apartado.setAttribute("data-npc-forzado", "");
            caja.open = true;
        } else if (!rebuscando && apartado.hasAttribute("data-npc-forzado")) {
            caja.open = false;
            apartado.removeAttribute("data-npc-forzado");
        }
    });
}


// =========================================
// SEGURIDAD AL PINTAR
// =========================================
// Mismo criterio que en reto.js, relatos.js, rol.js y notas-rol.js: el
// JSON lo escribes tú, pero de ahí salen direcciones que acaban en un
// href y en un src, y una dirección que empiece por "javascript:" es
// código que se ejecuta al pulsar. Así que no se copia lo que ponga: se
// comprueba que sea una dirección de las que valen, y si no, no se pone.
//
// Esto no es paranoia de manual: al dispararle cargas a la web se
// descubrió que el botón de "volver a la campaña" sí se tragaba un
// javascript: del JSON. Era el único href de esta página sin comprobar.

function rutaSeguraNpc(url) {
    const limpia = (url || "").toString().trim();
    // Se mira cómo EMPIEZA, no si contiene algo: lo que no empiece por
    // una de estas cuatro cosas no es una dirección que queramos poner.
    // Una dirección de ESTA web (que empiece por "/" pero no por "//",
    // que sería otra web), una http(s) entera, un correo o un ancla. Lo
    // demás —"javascript:", "data:", "//otrositio.com"— no es una
    // dirección: es código o es irse de aquí sin que se note.
    if (/^\/(?!\/)/.test(limpia) || /^(https?:\/\/|mailto:|#)/i.test(limpia)) {
        return limpia;
    }
    return "#";
}

// Para las fotos, más estrecho todavía: aquí solo valen una dirección de
// esta web o una http(s). Un data: en un src no ejecuta nada, pero sirve
// para meter una imagen de otro sitio sin que se vea de dónde sale.
function imagenSeguraNpc(url) {
    const limpia = (url || "").toString().trim();
    if (/^\/(?!\/)/.test(limpia) || /^https?:\/\//i.test(limpia)) {
        return limpia;
    }
    return "";
}


// =========================================
// LA FICHA, EN SU VENTANA
// =========================================
// La ventana la pone el componente (scripts/componentes/ventana-modal.js):
// el fondo, la barra con la ✕, el Escape, el foco y dejar inerte lo de
// detrás. Aquí solo se dice qué va dentro.

function abrirFichaNpc(quien, datos, boton) {
    const nombre = quien.nombre.toString().trim();
    window.ventanaModal.abrir({
        titulo: nombreDeArchivoNpc(nombre) + ".nfo",
        clase: "modal-npc",
        devolverA: boton,
        llenar: (cuerpo) => {
            const dos = document.createElement("div");
            dos.className = "npc-ficha-dos";

            const foto = (quien.ilustracion || quien.token || "").toString().trim();
            const limpia = imagenSeguraNpc(foto);
            // CON RETRATO, EL MARCO ES UN BOTÓN: al pulsarlo se ve la
            // ilustración entera y en grande, que es para lo que está
            // pintada. Sin retrato es un div y no se puede pulsar: un
            // botón que no hace nada es peor que ninguno.
            const arte = document.createElement(limpia ? "button" : "div");
            arte.className = "npc-visor-arte";
            if (limpia) {
                arte.type = "button";
                arte.classList.add("es-pulsable");
                arte.setAttribute("aria-label", "Ver el retrato de " + nombre + " en grande");
                // La lupa es un componente (scripts/componentes/lupa.js):
                // la misma que usan las fotos de los objetos del botín.
                arte.addEventListener("click", () => window.lupa.abrir({
                    ruta: limpia,
                    texto: nombre,
                    que: "Retrato de",
                    devolverA: arte,
                }));
            } else {
                // Sin ninguna de las dos imágenes, el marco de 3x4 se queda
                // como un rectángulo enorme y vacío al lado del texto, que
                // parece que la foto no ha cargado. Pequeño y cuadrado se
                // lee como lo que es: el sitio donde irá el retrato.
                arte.classList.add("sin-foto");
            }
            arte.appendChild(
                retratoNpc(foto, nombre, "npc-visor-arte-img", "npc-visor-arte-mono")
            );
            dos.appendChild(arte);
            dos.appendChild(fichaDeNpc(quien, nombre, datos));
            cuerpo.appendChild(dos);
        },
    });
}

// "El cazador ermitaño" -> "el_cazador_ermitano", para la barra de
// título. Es un guiño a las demás ventanas del sitio (campana.nfo,
// sesiones.lst), así que se le quitan tildes y espacios como a un nombre
// de archivo de verdad.
function nombreDeArchivoNpc(nombre) {
    return nombre
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "") || "ficha";
}

function fichaDeNpc(quien, nombre, datos) {
    const ficha = document.createElement("div");
    ficha.className = "npc-visor-ficha";

    const titulo = document.createElement("h3");
    titulo.className = "npc-visor-nombre";
    titulo.textContent = nombre;
    ficha.appendChild(titulo);

    const que = (quien.que || "").toString().trim();
    if (que) {
        const linea = document.createElement("p");
        linea.className = "npc-visor-que";
        linea.textContent = que;
        ficha.appendChild(linea);
    }

    const datosLista = document.createElement("dl");
    datosLista.className = "npc-datos";
    let hayDatos = false;

    // Los rótulos dicen de qué va cada línea sin tener que adivinarlo:
    // «residencia» y no «dónde» (que podía ser dónde se le conoció), y
    // «actitud con el grupo» y no «con el grupo» (que no decía si era lo
    // que piensa de ellos o qué pintan juntos). Las CLAVES del JSON no
    // cambian —"donde" y "relacion"—, solo lo que se lee en la ficha.
    const donde = (quien.donde || "").toString().trim();
    if (donde) {
        datosLista.appendChild(datoDeNpc("residencia", textoNpc(donde)));
        hayDatos = true;
    }
    const relacion = (quien.relacion || "").toString().trim();
    if (relacion) {
        datosLista.appendChild(datoDeNpc("actitud con el grupo", marcaDeNpc(relacion)));
        hayDatos = true;
    }
    const estado = (quien.estado || "").toString().trim();
    if (estado) {
        datosLista.appendChild(datoDeNpc("estado", marcaDeNpc(estado)));
        hayDatos = true;
    }
    // Los grupos, todos los que tenga. En plural si son varios: "grupos,
    // la Gran Caravana y Sirevia" se lee solo.
    const grupos = gruposDeNpc(quien);
    if (grupos.length) {
        datosLista.appendChild(
            datoDeNpc(grupos.length === 1 ? "grupo" : "grupos", textoNpc(enListaNpc(grupos)))
        );
        hayDatos = true;
    }
    const primera = enlaceDePrimeraNpc(quien, datos);
    if (primera) {
        datosLista.appendChild(datoDeNpc("se le conoció en", primera));
        hayDatos = true;
    }
    if (hayDatos) {
        ficha.appendChild(datosLista);
    }

    const notas = (Array.isArray(quien.notas) ? quien.notas : [])
        .map((n) => (n || "").toString().trim())
        .filter(Boolean);
    if (notas.length) {
        const lista = document.createElement("ul");
        lista.className = "npc-visor-notas";
        notas.forEach((n) => {
            const li = document.createElement("li");
            li.textContent = n;
            lista.appendChild(li);
        });
        ficha.appendChild(lista);
    } else if (!hayDatos) {
        // Ni datos ni notas: se dice, en vez de dejar la ventana con el
        // nombre y un hueco blanco que parece que no ha cargado.
        const vacio = document.createElement("p");
        vacio.className = "npc-vacio";
        vacio.textContent = "Todavía no hemos apuntado nada de esta persona.";
        ficha.appendChild(vacio);
    }

    const misiones = misionesDeNpc(nombre, datos);
    if (misiones) {
        ficha.appendChild(misiones);
    }

    return ficha;
}

// LAS MISIONES QUE NOS HA PEDIDO: las de la campaña con su nombre en
// «quien», con cómo van (escrito, no solo con un color).
function misionesDeNpc(nombre, datos) {
    const llano = (s) => (s || "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const suyas = [];
    (Array.isArray(datos && datos.misiones) ? datos.misiones : []).forEach((apartado) => {
        (Array.isArray(apartado && apartado.cosas) ? apartado.cosas : []).forEach((cosa) => {
            if (cosa && cosa.que && llano(cosa.quien) === llano(nombre)) {
                suyas.push(cosa);
            }
        });
    });
    if (!suyas.length) {
        return null;
    }
    const caja = document.createElement("section");
    caja.className = "npc-misiones";
    const titulo = document.createElement("h4");
    titulo.className = "npc-misiones-titulo";
    titulo.textContent = "Lo que nos ha pedido";
    caja.appendChild(titulo);
    const lista = document.createElement("ul");
    lista.className = "npc-misiones-lista";
    suyas.forEach((cosa) => {
        const estado = (cosa.estado || (cosa.hecha ? "completada" : "pendiente")).toString().toLowerCase();
        const li = document.createElement("li");
        li.textContent = cosa.que.toString().trim();
        const marca = document.createElement("span");
        marca.className = "npc-misiones-estado";
        marca.textContent = estado === "fallada" ? "fallida" : estado;
        li.appendChild(document.createTextNode(" "));
        li.appendChild(marca);
        lista.appendChild(li);
    });
    caja.appendChild(lista);
    return caja;
}

// ["a", "b", "c"] -> "a, b y c". Con la "y" y no con una coma final,
// porque esto se lee en voz alta tal cual.
function enListaNpc(cosas) {
    if (cosas.length <= 1) {
        return cosas[0] || "";
    }
    return cosas.slice(0, -1).join(", ") + " y " + cosas[cosas.length - 1];
}

function datoDeNpc(nombre, valor) {
    const bloque = document.createElement("div");
    bloque.className = "npc-dato";
    const dt = document.createElement("dt");
    dt.className = "npc-dato-nombre";
    dt.textContent = nombre;
    bloque.appendChild(dt);
    const dd = document.createElement("dd");
    dd.className = "npc-dato-valor";
    dd.appendChild(valor);
    bloque.appendChild(dd);
    return bloque;
}

function textoNpc(cadena) {
    return document.createTextNode(cadena);
}

// La palabra con su marquita de color delante. La palabra va siempre: el
// color es el adorno, no el dato.
function marcaDeNpc(palabra) {
    const caja = document.createElement("span");
    caja.className = "npc-marca " + (NPC_TONOS[palabra.toLowerCase()] || "");
    const punto = document.createElement("span");
    punto.className = "npc-marca-punto";
    punto.setAttribute("aria-hidden", "true");
    caja.appendChild(punto);
    caja.appendChild(document.createTextNode(palabra));
    return caja;
}

// "Sesión 3", enlazada si se sabe a dónde. La dirección sale de las
// sesiones que el JSON del reparto puede traer en "sesiones"; si no las
// trae, se queda el texto suelto, que ya dice lo que hace falta.
function enlaceDePrimeraNpc(quien, datos) {
    const numero = Number(quien.primera);
    if (!numero) {
        return null;
    }
    const sesiones = Array.isArray(datos.sesiones) ? datos.sesiones : [];
    const suya = sesiones.filter((s) => Number(s && s.numero) === numero)[0];
    const url = suya ? (suya.url || "").toString().trim() : "";
    if (!url || !/^\//.test(url)) {
        return textoNpc("Sesión " + numero);
    }
    const enlace = document.createElement("a");
    enlace.className = "npc-visor-primera";
    enlace.href = rutaSeguraNpc(url);
    enlace.textContent = "Sesión " + numero;
    return enlace;
}


// =========================================
// ABRIR UNA FICHA DESDE LA DIRECCIÓN
// =========================================
// npcs_ragna.html?quien=terkus abre su ficha al llegar. Lo usan los
// nombres de la ficha de la campaña, que así llevan a la persona y no solo
// a la página.
//
// LO QUE VIENE EN LA DIRECCIÓN NO SE PINTA NI SE BUSCA CON ÉL: se pasa por
// el mismo filtro que los nombres de aquí y se compara con los que hay. Un
// ?quien=<img onerror=...> no cuadra con nadie y no pasa nada; es la única
// forma de que esto no sea un agujero (ver
// herramientas/4-comprobar/inyecciones.py).
function abrirElDeLaDireccion() {
    let pedido = "";
    try {
        pedido = new URLSearchParams(window.location.search).get("quien") || "";
    } catch (error) {
        return;
    }
    if (!pedido.trim()) {
        return;
    }
    // Sin nombre, nombreDeArchivoNpc devuelve "ficha" para que la barra de
    // título de la ventana no salga vacía; aquí eso sería buscar a alguien
    // llamado "ficha", así que se mira antes si venía algo.
    const suyo = npcTokensPorSlug.get(nombreDeArchivoNpc(pedido));
    if (!suyo) {
        return;
    }

    // Si el filtro o el buscador tienen escondido a ese personaje (se puede
    // llegar con las dos cosas puestas: ?quien=terkus&cat=Sirevia), se
    // quita el filtro antes de abrir. Pedir a alguien por su nombre es más
    // concreto que pedir una categoría, así que manda el nombre; y además,
    // al cerrar la ficha el foco tiene que volver a su token, que estando
    // escondido no puede recibirlo.
    const celda = suyo.boton.closest(".npc-celda");
    if (celda && celda.hidden) {
        const todas = document.querySelector('[data-filtros] [data-categoria="todas"]');
        if (todas) {
            todas.click();
        }
    }

    // Y si AÚN sigue escondido (se puede llegar también con un ?buscar=
    // que no case con él), no se le dice a la ventana que devuelva el foco
    // a su token: un botón escondido no puede recibirlo y el foco se
    // quedaría en el aire. Así vuelve al principio de la página, que es
    // feo pero se puede seguir usando con el teclado.
    const escondido = !!(celda && celda.hidden);
    if (!escondido) {
        // El token, a la vista: si no, al cerrar la ficha el foco vuelve a
        // un botón que está a tres pantallas de scroll.
        try {
            suyo.boton.scrollIntoView({ block: "center", behavior: "auto" });
        } catch (error) {
            suyo.boton.scrollIntoView();
        }
    }
    abrirFichaNpc(suyo.quien, suyo.datos, escondido ? null : suyo.boton);
}
