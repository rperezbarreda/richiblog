// =========================================
// NOTAS DE ROL — la página de una campaña
// =========================================
// Pinta las dos cosas que lleva el índice de una campaña: su ficha (qué
// se juega, quién dirige, los personajes y de qué va) y la lista de
// sesiones.
//
// QUIÉN MANDA: el JSON de la campaña, que la propia página dice en el
// atributo data-campana-datos de la lista. Hoy es
// datos/notas_rol/campana-ragna.json. Ahí se escriben a mano la ficha y la intro,
// y las sesiones las va añadiendo herramientas/1-publicar/nuevo.py --sesion al
// crear cada página.
//
// PARA UNA CAMPAÑA NUEVA no hay que tocar este archivo: se copia la
// carpeta de la campaña, se cambia ese atributo y se crea su JSON. Lo
// único que hay que escribir a mano es su enlace en el menú
// (fragmentos/barra-lateral.html).
//
// LOS CAMPOS DE LA FICHA
// ----------------------
// Un campo que NO esté en el JSON no sale. Un campo que esté pero en
// blanco sale marcado como "por rellenar", que es un recordatorio que se
// ve en la propia web en vez de en una lista de tareas que nadie mira.
// Así que para quitar un campo de verdad —una campaña sin director,
// porque la diriges tú— se borra su línea del JSON.

const NOTAS_LISTADO_URL = "/datos/notas_rol/notas-rol.json";

// Los colores que puede llevar un personaje de los jugadores. Son los
// cuatro que están escritos en estilos/paginas/notas-rol.css; si se añade
// uno allí, se añade aquí (y en COLORES_PJ de generar-posts.py, que es
// quien escribe la ficha de la campaña).
const NOTAS_COLORES = ["verde", "azul", "rojo", "morado"];

initializeNotasRol();

async function initializeNotasRol() {
    const lista = document.querySelector("[data-campana-sesiones]");
    if (!lista) {
        return;
    }
    const datos = (lista.getAttribute("data-campana-datos") || "").trim();
    if (!datos) {
        return;
    }

    let campana = null;
    let publicadas = {};
    try {
        const respuesta = await window.pedirDatos(datos);
        if (!respuesta.ok) {
            throw new Error("La respuesta no fue correcta");
        }
        campana = await respuesta.json();
        publicadas = await leerSesionesPublicadas((campana.clave || "").trim());
    } catch (error) {
        lista.innerHTML =
            '<li class="entries-error">No se han podido cargar las sesiones ahora mismo.</li>';
        return;
    }

    pintarCabeceraCampana(campana);
    pintarFichaCampana(campana);
    prepararBotones(campana);
    pintarSesiones(lista, campana, publicadas);
}

// Qué sesiones están PUBLICADAS de verdad. No basta con que el JSON de
// la campaña tenga la dirección: la página se crea antes de pasar las
// notas a limpio y nace como borrador, y un borrador no está en
// datos/notas_rol/notas-rol.json. Así la fila se enciende exactamente cuando se
// publica, con el mismo criterio que el resto del sitio y sin nada que
// sincronizar a mano. Es lo mismo que hace scripts/paginas/reto.js con
// los días del reto de escritura.
async function leerSesionesPublicadas(clave) {
    const respuesta = await window.pedirDatos(NOTAS_LISTADO_URL);
    if (!respuesta.ok) {
        throw new Error("La respuesta no fue correcta");
    }
    const items = await respuesta.json();
    const mapa = {};
    (Array.isArray(items) ? items : []).forEach((item) => {
        if (!clave || (item.campana || "").trim() === clave) {
            mapa[sinExtensionNotas(item.url)] = item;
        }
    });
    return mapa;
}

// El servidor puede entregar la página con o sin ".html", así que las
// direcciones se comparan sin extensión.
function sinExtensionNotas(ruta) {
    return (ruta || "").trim().replace(/\.html$/, "").replace(/\/+$/, "");
}


// =========================================
// LA CABECERA
// =========================================

function pintarCabeceraCampana(campana) {
    const nombre = document.querySelector("[data-campana-nombre]");
    if (nombre && (campana.nombre || "").trim()) {
        nombre.textContent = campana.nombre.trim();
    }
    const intro = document.querySelector("[data-campana-intro]");
    if (intro && (campana.intro || "").trim()) {
        intro.textContent = campana.intro.trim();
    }
}


// =========================================
// LA FICHA
// =========================================
// La ficha de la campaña (campana.nfo: sistema, quién dirige, los
// personajes y de qué va) YA VIENE ESCRITA en la página: la escribe
// herramientas/3-generadores/generar-posts.py con el mismo JSON de la
// campaña (poner_fichas_de_campana), y es el ÚNICO sitio donde se monta.
// Antes se montaba aquí, al cargar, y al aparecer empujaba la lista de
// sesiones media pantalla hacia abajo.
//
// Aquí solo se le da vida: cada personaje es un botón que abre su ficha,
// y su retrato pequeño, si no carga, se cambia por el grande. Si tocas el
// JSON a mano, pasa los generadores (menú → repasar todo) para que la
// ficha se ponga al día.

function pintarFichaCampana(campana) {
    const ficha = document.querySelector("[data-campana-ficha]");
    if (!ficha || ficha.hidden) {
        return;
    }
    const gente = new Map(personajesDe(campana.personajes).map((p) => [p.nombre, p]));
    ficha.querySelectorAll(".campana-personaje-token[data-pj]").forEach((boton) => {
        const quien = gente.get(boton.getAttribute("data-pj"));
        if (!quien) {
            return;
        }
        boton.addEventListener("click", () => abrirLaFichaDeUnPj(quien, boton));
        const img = boton.querySelector("img[data-grande]");
        if (img) {
            const grande = imagenSeguraDeMesa(img.getAttribute("data-grande"));
            if (grande) {
                img.addEventListener("error", () => {
                    img.src = grande;
                }, { once: true });
            }
        }
    });
    // Por si la ventana estrena sus botones −■✕ ahora.
    document.dispatchEvent(new CustomEvent("ventanas:actualizar"));
}

// Los personajes con nombre. Los que estén en blanco se saltan: el JSON
// nace con uno vacío de muestra, para que se vea qué forma tienen, y ése
// no es un personaje.
function personajesDe(crudos) {
    return (Array.isArray(crudos) ? crudos : [])
        .filter((p) => p && (p.nombre || "").toString().trim())
        .map((p) => ({
            nombre: p.nombre.toString().trim(),
            // De qué color sale su nombre, aquí y en las notas. Lo dice el
            // JSON ("color": "verde") y solo valen estos cuatro: así un
            // dedazo en el JSON no deja el nombre con una clase que no
            // existe en ninguna hoja de estilo.
            color: NOTAS_COLORES.indexOf(
                (p.color || "").toString().trim().toLowerCase()
            ) === -1
                ? ""
                : (p.color || "").toString().trim().toLowerCase(),
            // Lo que va detrás del nombre: qué es, de qué nivel y quién lo
            // lleva. "Elfo Druida nivel 3 · lo lleva Richi" si está todo.
            //
            // El nivel va aparte en el JSON y no pegado a la clase ("Elfo
            // Druida Lvl 3") porque sube cada pocas sesiones: así se cambia
            // un número y no hay que volver a escribir la línea. Si alguna
            // campaña lo trae pegado a la clase y sin "nivel", sale igual:
            // esto solo añade lo que haya.
            extra: [
                [
                    (p.clase || "").toString().trim(),
                    Number(p.nivel) ? "nivel " + Number(p.nivel) : "",
                ]
                    .filter(Boolean)
                    .join(" "),
                (p.jugador || "").toString().trim()
                    ? "lo lleva " + p.jugador.toString().trim()
                    : "",
            ]
                .filter(Boolean)
                .join(" · "),
            // Y lo de cada uno por separado, para la ventana de «la mesa»,
            // que lo enseña campo a campo en vez de en una línea. Sale de
            // aquí y no de otra función porque es el mismo personaje: dos
            // formas de leer lo mismo, no dos cosas.
            clase: (p.clase || "").toString().trim(),
            nivel: Number(p.nivel) || 0,
            jugador: (p.jugador || "").toString().trim(),
            token: (p.token || "").toString().trim(),
            // La pequeña, para donde se ve pequeño (la fila de retratos, el
            // globo de las notas). La hace tokens-pequenos.py.
            token_mini: (p.token_mini || "").toString().trim(),
            ilustracion: (p.ilustracion || "").toString().trim(),
            // SU FICHA, EN LOS DOS SITIOS DONDE VIVE: la de D&D Beyond,
            // que es la que se toca en la partida, y un PDF para cuando
            // no hay internet o cuando la campaña se acaba y la página
            // de Beyond deja de importar. Las dos son opcionales y cada
            // una saca su botón solo si está escrita.
            dndbeyond: (p.dndbeyond || "").toString().trim(),
            pdf: (p.pdf || "").toString().trim(),
            equipo: (Array.isArray(p.equipo) ? p.equipo : [])
                .map((c) => (c || "").toString().trim())
                .filter(Boolean),
            notas: (Array.isArray(p.notas) ? p.notas : [])
                .map((c) => (c || "").toString().trim())
                .filter(Boolean),
        }));
}

// UNA VENTANA PARA UNO, no para la mesa entera: se pulsa a alguien y sale
// SU ficha y nada más, igual que la de un NPC. Antes la ventana llevaba
// arriba una fila con los cuatro y había que volver a elegir dentro, que
// era elegir dos veces lo mismo. Para ver a otro se cierra y se pulsa
// otro retrato, que están justo detrás.
function abrirLaFichaDeUnPj(quien, devolverA) {
    window.ventanaModal.abrir({
        titulo: nombreDeArchivoMesa(quien.nombre) + ".nfo",
        clase: "modal-mesa",
        devolverA: devolverA,
        llenar: (cuerpo) => {
            // El envoltorio .mesa-ficha es el que pone la ilustración a un
            // lado y lo suyo al otro; la ficha de dentro es un fragmento
            // suelto y sin él se apilaría.
            const caja = document.createElement("div");
            caja.className = "mesa-ficha";
            const ficha = fichaDeLaMesa(quien);
            const suyo = botinDeUnPj(quien.nombre);
            if (suyo) {
                ficha.appendChild(suyo);
            }
            caja.appendChild(ficha);
            cuerpo.appendChild(caja);
        },
    });
}

// El nombre de la barra de la ventana, en plan archivo: "faelar.nfo".
// Sin tildes ni espacios, como el de la ficha de un NPC.
function nombreDeArchivoMesa(nombre) {
    return (nombre || "")
        .toString()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "") || "ficha";
}



// =========================================
// LOS DOS BOTONES QUE ABREN UNA VENTANA
// =========================================
// «La mesa» y «el botín». Los dos salen del JSON de la campaña y los dos
// se abren encima de la página, con el componente de siempre
// (scripts/componentes/ventana-modal.js): el fondo, la barra con la ✕, el
// Escape, el foco y dejar inerte lo de detrás son cosa suya.
//
// Van en una ventana y no en el propio índice porque son dos cosas que se
// miran de vez en cuando, no cada vez: el índice se abre para ver por
// dónde va la campaña y para entrar en una sesión, y con las dos listas
// puestas había que bajar media pantalla para llegar a lo de siempre.
//
// EL BOTÓN NO SALE SI NO HAY NADA QUE ENSEÑAR. Una campaña recién
// empezada no tiene botín y puede no tener la mesa escrita todavía, y un
// botón que abre una ventana vacía es peor que no tenerlo.

function prepararBotones(campana) {
    // Nacen ocupando su sitio sin verse (data-por-ver, ver notas-rol.css):
    // aquí se ve si se quedan o se van.
    document.querySelectorAll(".campana-boton[data-por-ver]").forEach((b) => {
        b.removeAttribute("data-por-ver");
        b.hidden = true;
    });
    const cosas = cosasDelBotin(campana);
    const dinero = movimientosDeDinero(campana);
    ponerBotinDeLaMesa(campana);
    const botonBotin = document.querySelector("[data-campana-botin-abrir]");
    if (botonBotin && cosas.length) {
        botonBotin.hidden = false;
        botonBotin.addEventListener("click", () =>
            window.ventanaModal.abrir({
                titulo: "botin.lst",
                clase: "modal-botin",
                devolverA: botonBotin,
                llenar: (cuerpo) => llenarElBotin(cuerpo, cosas),
            })
        );
    }

    // EL DINERO, con su botón: la bolsa en un post-it, la tabla de
    // entradas y gastos y el conversor de monedas.
    const botonDinero = document.querySelector("[data-campana-dinero-abrir]");
    if (botonDinero && dinero.length) {
        botonDinero.hidden = false;
        botonDinero.addEventListener("click", () =>
            window.ventanaModal.abrir({
                titulo: "bolsa.txt",
                clase: "modal-dinero",
                devolverA: botonDinero,
                llenar: (cuerpo) => llenarElDinero(cuerpo, dinero, nombresDeLaMesa(campana)),
            })
        );
    }

    const misiones = misionesDe(campana);
    const botonMisiones = document.querySelector("[data-campana-misiones-abrir]");
    if (botonMisiones && misiones.length) {
        botonMisiones.hidden = false;
        botonMisiones.addEventListener("click", () =>
            window.ventanaModal.abrir({
                titulo: "pendientes.txt",
                clase: "modal-misiones",
                devolverA: botonMisiones,
                llenar: (cuerpo) => llenarLasMisiones(cuerpo, misiones),
            })
        );
    }
}


// =========================================
// «LA MESA» — LOS PERSONAJES DE LOS JUGADORES
// =========================================
// Los que ya están en "personajes", dentro del JSON de la campaña: los
// mismos que salen en la ficha de aquí al lado y los mismos que llevan
// color en las notas. Escritos UNA VEZ: en dos archivos acabaría habiendo
// dos Faëlar distintos.
//
//   {
//     "nombre": "Faëlar",
//     "jugador": "Richi",            <- quién lo lleva
//     "clase": "Elfo Druida",
//     "nivel": 3,
//     "color": "verde",              <- verde / azul / rojo / morado
//     "token": "/imagenes/notas_rol/ragna/faelar-token.webp",
//     "ilustracion": "/imagenes/notas_rol/ragna/faelar.webp",
//     "equipo": ["lo que lleva encima"],
//     "notas": ["lo que haya que recordar de él"]
//   }
//
// DENTRO DE LA VENTANA va la ficha de UNO, el que se haya pulsado, y nada
// más. Antes llevaba arriba una fila con los cuatro tokens y había que
// volver a elegir ahí dentro: desde que los retratos están en la página,
// eso era elegir dos veces lo mismo. Ahora es como la ficha de un NPC —se
// pulsa a alguien, sale su ficha— y para ver a otro se cierra y se pulsa
// el suyo, que está justo detrás.

function fichaDeLaMesa(quien) {
    const ficha = document.createDocumentFragment();

    const arte = document.createElement("div");
    arte.className = "mesa-arte";
    const foto = (quien.ilustracion || quien.token || "").trim();
    if (!foto) {
        // Sin ninguna de las dos imágenes, un marco de 3x4 vacío al lado
        // del texto parece una foto que no ha cargado. Pequeño y cuadrado
        // se lee como lo que es: el hueco donde irá el retrato.
        arte.classList.add("sin-foto");
    }
    arte.appendChild(retratoDeMesa(foto, quien.nombre, "mesa-arte-img", "mesa-arte-mono"));

    const texto = document.createElement("div");
    texto.className = "mesa-texto";

    const titulo = document.createElement("h3");
    titulo.className = "mesa-nombre" + (quien.color ? " pj-" + quien.color : "");
    titulo.textContent = quien.nombre;
    texto.appendChild(titulo);

    if (quien.clase) {
        const linea = document.createElement("p");
        linea.className = "mesa-clase";
        linea.textContent = quien.clase;
        texto.appendChild(linea);
    }

    const datos = document.createElement("dl");
    datos.className = "mesa-datos";
    let hay = false;
    if (quien.nivel) {
        datos.appendChild(datoDeLaMesa("nivel", String(quien.nivel)));
        hay = true;
    }
    if (quien.jugador) {
        datos.appendChild(datoDeLaMesa("lo lleva", quien.jugador));
        hay = true;
    }
    if (hay) {
        texto.appendChild(datos);
    }

    // EL EQUIPO, con el mismo formato que los objetos que se consiguen en
    // una partida y que el botín: letra de máquina y un rombo delante. Es
    // un inventario, no algo que pasó.
    if (quien.equipo.length) {
        texto.appendChild(tituloDeLaMesa("lo que lleva encima"));
        const lista = document.createElement("ul");
        lista.className = "mesa-equipo";
        quien.equipo.forEach((cosa) => {
            const li = document.createElement("li");
            li.textContent = cosa;
            lista.appendChild(li);
        });
        texto.appendChild(lista);
    }

    if (quien.notas.length) {
        texto.appendChild(tituloDeLaMesa("lo que hay que recordar"));
        const lista = document.createElement("ul");
        lista.className = "mesa-notas";
        quien.notas.forEach((nota) => {
            const li = document.createElement("li");
            li.textContent = nota;
            lista.appendChild(li);
        });
        texto.appendChild(lista);
    }

    // LOS DOS BOTONES DE SU FICHA, al final de todo: la de D&D Beyond y
    // el PDF. Van abajo porque no son para leer aquí, son para irse a
    // otro sitio, y eso es lo último que se hace en una ventana.
    //
    // Los dos son ENLACES y no botones: uno lleva a otra página y el otro
    // descarga un archivo. Ninguna de las dos cosas pasa dentro de esta
    // ventana, y el teclado y un lector de pantalla anuncian distinto un
    // enlace que un botón.
    const fichas = document.createElement("p");
    fichas.className = "mesa-fichas";
    if (quien.dndbeyond) {
        const fuera = document.createElement("a");
        fuera.className = "mesa-ficha-enlace";
        fuera.href = rutaSeguraNotas(quien.dndbeyond);
        // A otra web: en pestaña nueva, para no sacar a nadie de la
        // campaña a medio mirar. rel con noopener, que sin él la página
        // de destino puede tocar ésta.
        fuera.target = "_blank";
        fuera.rel = "noopener noreferrer";
        fuera.textContent = "ficha en D&D Beyond";
        // NI FLECHITA NI AVISO DE "se abre fuera" puestos aquí: de eso se
        // encarga solo scripts/componentes/enlaces-fuera.js, que vigila
        // la página entera —ventanas incluidas— y a cualquier enlace que
        // salga de la web le pone la flecha y un "(enlace externo)"
        // escondido a la vista. Poniéndolos también aquí salían dos
        // flechas seguidas y el aviso se oía dos veces.
        fichas.appendChild(fuera);
    }
    if (quien.pdf) {
        const pdf = document.createElement("a");
        pdf.className = "mesa-ficha-enlace";
        pdf.href = rutaSeguraNotas(quien.pdf);
        // download: que se guarde en vez de abrirse dentro del navegador,
        // que es lo que se viene a hacer con la ficha de un personaje.
        pdf.setAttribute("download", "");
        pdf.appendChild(document.createTextNode("ficha en PDF"));
        const icono = document.createElement("span");
        icono.className = "mesa-ficha-icono";
        icono.setAttribute("aria-hidden", "true");
        icono.textContent = "↓";
        pdf.appendChild(icono);
        fichas.appendChild(pdf);
    }
    if (fichas.childNodes.length) {
        texto.appendChild(fichas);
    }

    if (!hay && !quien.equipo.length && !quien.notas.length && !quien.clase
        && !fichas.childNodes.length) {
        const vacio = document.createElement("p");
        vacio.className = "campana-dato-vacio";
        vacio.textContent = "De éste no hay nada apuntado todavía.";
        texto.appendChild(vacio);
    }

    ficha.appendChild(arte);
    ficha.appendChild(texto);
    return ficha;
}

function datoDeLaMesa(nombre, valor) {
    const bloque = document.createElement("div");
    bloque.className = "mesa-dato";
    const dt = document.createElement("dt");
    dt.className = "mesa-dato-nombre";
    dt.textContent = nombre;
    bloque.appendChild(dt);
    const dd = document.createElement("dd");
    dd.className = "mesa-dato-valor";
    dd.textContent = valor;
    bloque.appendChild(dd);
    return bloque;
}

function tituloDeLaMesa(texto) {
    const titulo = document.createElement("h4");
    titulo.className = "mesa-apartado";
    titulo.textContent = texto;
    return titulo;
}

// El retrato, o la inicial si no hay foto. aria-hidden en la inicial
// porque el nombre va escrito al lado, y el alt de la foto vacío por lo
// mismo: leerlo sería decir el nombre dos veces. Las clases van enteras y
// no pegadas con un "+": escritas a trozos no se encuentran buscándolas y
// el repaso de clases sin usar las daría por muertas estando vivas.
function retratoDeMesa(ruta, nombre, claseImg, claseMono, respaldo) {
    const limpia = imagenSeguraDeMesa(ruta);
    if (limpia) {
        const img = document.createElement("img");
        img.className = claseImg;
        img.src = limpia;
        // SI LA PEQUEÑA NO CARGA, LA GRANDE. La pequeña ("token_mini") la
        // hace herramientas/2-imagenes/tokens-pequenos.py; si falta o se
        // ha borrado, mejor la grande que un hueco.
        const grande = imagenSeguraDeMesa(respaldo);
        if (grande && grande !== limpia) {
            img.addEventListener("error", () => {
                img.src = grande;
            }, { once: true });
        }
        img.alt = "";
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


// Para las fotos, más estrecho que para un enlace: aquí solo valen una
// dirección de esta web o una http(s). Un data: en un src no ejecuta nada,
// pero sirve para meter una imagen de otro sitio sin que se vea de dónde
// sale. Es la misma que imagenSeguraNpc() en scripts/paginas/npcs-rol.js;
// están escritas dos veces porque son dos páginas y ninguna carga el
// script de la otra.
function imagenSeguraDeMesa(url) {
    const limpia = (url || "").toString().trim();
    if (/^\/(?!\/)/.test(limpia) || /^https?:\/\//i.test(limpia)) {
        return limpia;
    }
    return "";
}


// =========================================
// EL BOTÍN ACUMULADO
// =========================================
// Lo que el grupo va juntando partida a partida: lo que se encuentra, lo
// que compra y lo que le regalan. Se escribe A MANO en el JSON de la
// campaña, en "botin", porque no hay forma de sacarlo de las notas: en una
// sesión se consiguen tres cosas y se gastan dos, y eso lo sabe quien
// estuvo allí, no un script leyendo la página.
//
//   "botin": [
//       { "que": "4 kits curativos", "de": 1, "tipo": "pociones" },
//       { "que": "Hierbas misteriosas (velocidad)", "de": 1,
//         "quien": "Mellissa", "tipo": "pociones" },
//       { "que": "6 provisiones para el viaje", "de": 1,
//         "tipo": "equipo", "gastado": true }
//   ]
//
//   que      lo que es. Lo único que hace falta.
//   de       el número de la sesión en que se consiguió.
//   quien    quién lo lleva. Puede ser uno de la mesa o "el carro".
//   tipo     en qué apartado va. Uno de los de TIPOS_DE_BOTIN, de aquí
//            abajo; lo que no se reconozca (o lo que no lo lleve) cae en
//            "otras cosas", que es el último apartado.
//   gastado  true para lo que ya se ha usado: se queda tachado y puesto
//            en gris, en vez de borrarlo. Así se ve lo que hubo y lo que
//            queda, que es media discusión de cada partida.
//   efecto   lo que hace en el juego («+1d4 de daño de ácido»): sale
//            debajo del nombre, de máquina y en su recuadro.
//   cantidad cuántas quedan (sale «×4», o «quedan 4 de 5» con inicial).
//   inicial  cuántas había.
//   valor    lo que vale cada una, en po (se suma el total al pie).
//
// LOS OBJETOS MÁGICOS pueden llevar rareza, sintonizacion (true), cargas
// y descripcion: salen en el mismo desplegable «Qué hace».
//
// EL DINERO va aparte, en "dinero": {"movimientos": [...]}, cada uno
// {que, sentido: "entra" | "sale", cantidad, moneda: pc|pp|pe|po|ppt, de,
// quien, reparto}. Tiene su propio botón en el índice («el dinero»): la
// bolsa en un post-it (en po, pp y pc), la tabla de entradas y gastos con
// lo que quedaba después de cada uno, y un conversor de monedas.
// EL REPARTO es una lista de líneas «Mellissa: 20» (en la moneda del
// movimiento; «Cada uno: 5» vale para toda la mesa): lo que le toca o lo
// que pone cada personaje. Lo que no se reparte es del grupo.
//
// LOS PERGAMINOS (tipo "pergaminos") llevan además su hechizo, que sale
// en un desplegable «Qué hace» debajo del nombre:
//   hechizo, nivel (0 = truco), escuela, lanzamiento, alcance, duracion,
//   tirada (la CD o el ataque) y descripcion (un párrafo por línea).
//
// SIN "botin" EN EL JSON el botón no sale: una campaña que no lleva la
// cuenta no tiene por qué enseñar una ventana vacía.

// LOS APARTADOS, EN ESTE ORDEN. El orden NO es alfabético a propósito:
// va de lo que se usa en una pelea a lo que se usa fuera, y el dinero al
// final porque es lo que se mira aparte. Un apartado sin nada no sale.
//
// "nombre" es lo que se escribe en el título; "alias" son las otras
// formas de escribirlo que se aceptan en el JSON, para no tener que
// acordarse de si era "arma" o "armas". La comparación no mira
// mayúsculas ni tildes (lo hace comoSeEscribeElTipo).
const TIPOS_DE_BOTIN = [
    { nombre: "armas", alias: ["arma"] },
    { nombre: "armaduras", alias: ["armadura", "escudos", "escudo"] },
    { nombre: "pociones", alias: ["pocion", "pociones y hierbas", "curacion"] },
    { nombre: "pergaminos", alias: ["pergamino", "conjuros", "hechizos", "pergaminos de conjuro"] },
    { nombre: "equipo", alias: ["utiles", "util", "herramientas", "provisiones"] },
    {
        nombre: "objetos mágicos",
        alias: ["objeto magico", "objetos magicos", "magia", "magicos"],
    },
    { nombre: "dinero", alias: ["monedas", "oro", "tesoro"] },
    { nombre: "otras cosas", alias: ["otros", "otras", "varios", "sin clasificar"] },
];

// El apartado al que va lo que no lleva "tipo" o lo lleva mal escrito.
// Es el último de la lista de arriba, y tiene que existir: si alguien lo
// quita de ahí, esto lo vuelve a poner.
const BOTIN_SIN_TIPO = "otras cosas";

// Sin tildes, sin mayúscula y sin espacios de sobra, que es como se
// comparan los tipos. Lo mismo que hace el buscador con las etiquetas.
function comoSeEscribeElTipo(texto) {
    return (texto || "")
        .toString()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .trim();
}

function cosasDelBotin(campana) {
    return (Array.isArray(campana.botin) ? campana.botin : []).filter(
        (c) => c && (c.que || "").toString().trim()
    );
}

// A qué apartado va una cosa: se mira su "tipo" contra el nombre y los
// alias de cada apartado. Lo que no cuadre va a "otras cosas".
function apartadoDeCosa(cosa) {
    const tipo = comoSeEscribeElTipo(cosa && cosa.tipo);
    if (!tipo) {
        return BOTIN_SIN_TIPO;
    }
    const encontrado = TIPOS_DE_BOTIN.find(
        (apartado) =>
            comoSeEscribeElTipo(apartado.nombre) === tipo ||
            (apartado.alias || []).some((otro) => comoSeEscribeElTipo(otro) === tipo)
    );
    return encontrado ? encontrado.nombre : BOTIN_SIN_TIPO;
}

// Las cosas repartidas por apartados, en el orden de TIPOS_DE_BOTIN y sin
// los apartados que se queden vacíos. Dentro de cada uno, el orden es el
// del JSON: lo escribe a mano quien lleva la campaña y ese orden es suyo.
function repartirElBotin(cosas) {
    const porApartado = new Map();
    cosas.forEach((cosa) => {
        const donde = apartadoDeCosa(cosa);
        if (!porApartado.has(donde)) {
            porApartado.set(donde, []);
        }
        porApartado.get(donde).push(cosa);
    });

    const apartados = TIPOS_DE_BOTIN.map((apartado) => ({
        nombre: apartado.nombre,
        cosas: porApartado.get(apartado.nombre) || [],
    })).filter((apartado) => apartado.cosas.length);

    // Por si alguien escribe un apartado que no está en TIPOS_DE_BOTIN:
    // no puede pasar (apartadoDeCosa solo devuelve nombres de la lista),
    // pero si la lista cambia y se queda algo fuera, mejor que salga al
    // final que que desaparezca de la ventana.
    porApartado.forEach((suyas, nombre) => {
        if (!TIPOS_DE_BOTIN.some((apartado) => apartado.nombre === nombre)) {
            apartados.push({ nombre: nombre, cosas: suyas });
        }
    });

    return apartados;
}

// POR QUIÉN LO LLEVA: un apartado por persona (en el orden en que salen),
// y al final lo que no lleva nadie en concreto.
const BOTIN_DE_NADIE = "nadie en concreto";

function repartirPorQuien(cosas) {
    const porQuien = new Map();
    cosas.forEach((cosa) => {
        const quien = (cosa.quien || "").toString().trim() || BOTIN_DE_NADIE;
        if (!porQuien.has(quien)) {
            porQuien.set(quien, []);
        }
        porQuien.get(quien).push(cosa);
    });
    const nombres = [...porQuien.keys()].filter((q) => q !== BOTIN_DE_NADIE);
    if (porQuien.has(BOTIN_DE_NADIE)) {
        nombres.push(BOTIN_DE_NADIE);
    }
    return nombres.map((nombre) => ({ nombre: nombre, cosas: porQuien.get(nombre) }));
}

// LOS APARTADOS SON PESTAÑAS, una por cosa que haya en la bolsa y una
// primera que las enseña todas. Tienen la pinta de los botones de filtrar
// del resto del sitio (son la misma idea: enseñar solo un montón), pero
// por dentro son una botonera de pestañas de verdad —role="tablist"— así
// que las flechas del teclado pasan de una a otra, Inicio y Fin van a los
// extremos y un lector de pantalla dice "pestaña 3 de 5".
//
// Con un apartado solo no se ponen pestañas: una pestaña única no elige
// nada. Ahí sale la lista a secas, como antes de que esto existiera.
const BOTIN_TODAS = "todas";

function llenarElBotin(cuerpo, cosas) {
    const gastadas = cosas.filter((cosa) => cosa && cosa.gastado).length;

    // CÓMO SE REPARTE: por apartado (armas, pociones…) o por quién lo
    // lleva. Dos botones que se quedan apretados (aria-pressed).
    const vista = document.createElement("div");
    const pintar = (modo) => {
        vista.textContent = "";
        const apartados = modo === "quien" ? repartirPorQuien(cosas) : repartirElBotin(cosas);
        if (apartados.length > 1) {
            pestanasDelBotin(apartados, vista);
        } else {
            const panel = document.createElement("div");
            panel.className = "campana-botin-panel";
            listaDeBotin((apartados[0] || { cosas: cosas }).cosas, panel);
            vista.appendChild(panel);
        }
    };
    if (cosas.length > 1) {
        const modos = document.createElement("div");
        modos.className = "campana-botin-modos";
        modos.setAttribute("role", "group");
        modos.setAttribute("aria-label", "Cómo se reparte el botín");
        const botones = [["apartado", "por apartado"], ["quien", "por quién lo lleva"]].map(([modo, texto]) => {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "campana-botin-modo";
            b.textContent = texto;
            b.setAttribute("aria-pressed", modo === "apartado" ? "true" : "false");
            b.addEventListener("click", () => {
                botones.forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
                pintar(modo);
            });
            modos.appendChild(b);
            return b;
        });
        cuerpo.appendChild(modos);
    }
    cuerpo.appendChild(vista);
    pintar("apartado");

    // La cuenta al pie: "9 cosas · 2 gastadas · quedan 7". Es de TODO el
    // botín y no de la pestaña que esté puesta, a propósito: es lo que se
    // mira al abrir, y cambiar de pestaña no cambia lo que se tiene.
    const pie = document.createElement("p");
    pie.className = "campana-botin-cuenta";
    // Lo que vale lo que queda (lo que lleva «valor»), en oro.
    const vale = cosas.filter((cosa) => !cosa.gastado && Number(cosa.valor) > 0)
        .reduce((suma, cosa) => suma + Number(cosa.valor) * (Number(cosa.cantidad) || 1), 0);
    pie.textContent =
        (cosas.length === 1 ? "1 cosa" : cosas.length + " cosas") +
        (gastadas
            ? " · " + gastadas + " gastada" + (gastadas === 1 ? "" : "s") +
              " · quedan " + (cosas.length - gastadas)
            : "") +
        (vale ? " · lo que queda vale " + numeroDeDinero(vale) + " po" : "");
    cuerpo.appendChild(pie);
}

// La botonera y, debajo, el panel que llena. Las cuelga las dos de
// "donde", en ese orden.
function pestanasDelBotin(apartados, donde) {
    let juntas = [];
    apartados.forEach((apartado) => {
        juntas = juntas.concat(apartado.cosas);
    });
    const todas = [{ nombre: BOTIN_TODAS, cosas: juntas }].concat(apartados);

    const tira = document.createElement("div");
    tira.className = "campana-botin-pestanas";
    tira.setAttribute("role", "tablist");
    tira.setAttribute("aria-label", "Qué parte del botín se ve");

    const panel = document.createElement("div");
    panel.className = "campana-botin-panel";
    panel.id = "botin-panel";
    panel.setAttribute("role", "tabpanel");
    // Con tabindex, porque el panel se desplaza: un panel con barra de
    // desplazamiento al que no se puede llegar con el tabulador no se
    // puede leer con el teclado.
    panel.setAttribute("tabindex", "0");

    const botones = todas.map((apartado, i) => {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "campana-botin-pestana";
        boton.setAttribute("role", "tab");
        boton.id = "botin-tab-" + i;
        boton.setAttribute("aria-controls", "botin-panel");
        boton.textContent = apartado.nombre;

        // Cuántas hay en esa pestaña, al lado del nombre. Así se ve dónde
        // hay algo sin ir abriéndolas una por una.
        const cuantas = document.createElement("span");
        cuantas.className = "campana-botin-pestana-cuenta";
        cuantas.textContent = apartado.cosas.length;
        boton.appendChild(cuantas);
        return boton;
    });

    const elegir = (i, mover) => {
        botones.forEach((b, n) => {
            const suyo = n === i;
            b.setAttribute("aria-selected", suyo ? "true" : "false");
            // Un solo tabulador para toda la tira: dentro se pasa con las
            // flechas, que es como se maneja una botonera de pestañas.
            b.tabIndex = suyo ? 0 : -1;
        });
        panel.setAttribute("aria-labelledby", "botin-tab-" + i);
        panel.textContent = "";
        if (i === 0) {
            // EN "TODAS" van los apartados con su título, que es lo que
            // había antes de las pestañas y sigue siendo la vista de
            // leerlo todo de arriba abajo.
            apartados.forEach((apartado) => {
                const grupo = document.createElement("section");
                grupo.className = "campana-botin-grupo";

                const titulo = document.createElement("h3");
                titulo.className = "campana-botin-grupo-titulo";
                titulo.textContent = apartado.nombre;
                const cuantas = document.createElement("span");
                cuantas.className = "campana-botin-grupo-cuenta";
                cuantas.textContent =
                    apartado.cosas.length === 1 ? "1 cosa" : apartado.cosas.length + " cosas";
                titulo.appendChild(cuantas);

                grupo.appendChild(titulo);
                listaDeBotin(apartado.cosas, grupo);
                panel.appendChild(grupo);
            });
        } else {
            // EN UNA PESTAÑA SUELTA no se repite el título: lo dice la
            // propia pestaña, que además es quien nombra el panel
            // (aria-labelledby), así que tampoco se pierde para quien lo
            // escucha.
            listaDeBotin(todas[i].cosas, panel);
        }
        panel.scrollTop = 0;
        if (mover) {
            botones[i].focus();
        }
    };

    botones.forEach((boton, i) => {
        boton.addEventListener("click", () => elegir(i, false));
        boton.addEventListener("keydown", (evento) => {
            const salto = { ArrowRight: 1, ArrowLeft: -1, Home: -99, End: 99 }[evento.key];
            if (salto === undefined) {
                return;
            }
            evento.preventDefault();
            const cuantos = botones.length;
            const siguiente =
                salto === -99 ? 0
                : salto === 99 ? cuantos - 1
                : (i + salto + cuantos) % cuantos;
            elegir(siguiente, true);
        });
        tira.appendChild(boton);
    });

    donde.appendChild(tira);
    donde.appendChild(panel);
    elegir(0, false);
}

// Una lista de cosas, colgada de donde se le diga. Devuelve cuántas de
// ellas están gastadas, que es lo que hace falta para la cuenta del pie.
function listaDeBotin(cosas, donde) {
    // Con createElement, como la ficha: cada trozo es un texto suelto y
    // textContent lo pone tal cual, sin tener que acordarse de escapar.
    const lista = document.createElement("ul");
    lista.className = "campana-botin-lista";
    let gastadas = 0;

    cosas.forEach((cosa) => {
        const fila = document.createElement("li");
        fila.className = "campana-botin-cosa";

        const que = document.createElement("span");
        que.className = "campana-botin-que";
        que.textContent = cosa.que.toString().trim();
        // Cuántas quedan, detrás del nombre: «×4», o «quedan 4 de 5».
        const cantidad = Number(cosa.cantidad);
        const inicial = Number(cosa.inicial);
        if (cosa.cantidad !== undefined && cosa.cantidad !== "" && !Number.isNaN(cantidad)) {
            const cuantas = document.createElement("span");
            cuantas.className = "campana-botin-cantidad";
            cuantas.textContent = inicial && inicial !== cantidad ? "quedan " + cantidad + " de " + inicial : "×" + cantidad;
            que.appendChild(document.createTextNode(" "));
            que.appendChild(cuantas);
        }
        fila.appendChild(que);

        // La línea de debajo: si está gastado, de qué sesión salió y quién
        // lo lleva. Lo de "gastado" va ESCRITO y no solo tachado: el
        // tachado no lo dice un lector de pantalla (pauta 1.4.1 otra vez).
        const pie = document.createElement("span");
        pie.className = "campana-botin-donde";
        if (cosa.gastado) {
            fila.classList.add("esta-gastado");
            gastadas += 1;
            const marca = document.createElement("span");
            marca.className = "campana-botin-gastado";
            marca.textContent = "gastado";
            pie.appendChild(marca);
        }
        const numero = Number(cosa.de);
        if (numero) {
            pie.appendChild(trozoDeBotin("sesión " + numero));
        }
        const quien = (cosa.quien || "").toString().trim();
        if (quien) {
            // En el amarillo del tema y NO del color del personaje, que
            // sería lo bonito: medido, los cuatro colores sobre el morado
            // de esta ventana se quedan en Lc 67 en el tema claro, por
            // debajo del 75 que pide una letra de este tamaño. El amarillo
            // pasa en los diez temas. Quién lo lleva está escrito, que es
            // lo que importa.
            const suyo = trozoDeBotin("lo lleva " + quien);
            suyo.classList.add("campana-botin-quien");
            pie.appendChild(suyo);
        }
        const valor = Number(cosa.valor);
        if (valor > 0) {
            pie.appendChild(trozoDeBotin("vale " + numeroDeDinero(valor) + " po"
                + (Number(cosa.cantidad) > 1 ? " cada una" : "")));
        }
        if (pie.childNodes.length) {
            fila.appendChild(pie);
        }

        // Lo que hace en el juego, de máquina y en su recuadro (como la
        // regla de las notas).
        const efecto = (cosa.efecto || "").toString().trim();
        if (efecto) {
            const caja = document.createElement("span");
            caja.className = "campana-botin-efecto";
            caja.textContent = efecto;
            fila.appendChild(caja);
        }

        // EL HECHIZO DE UN PERGAMINO, plegado: un <details> que se abre
        // solo, con el teclado y diciéndolo un lector de pantalla.
        const hechizo = hechizoDeCosa(cosa);
        if (hechizo) {
            fila.appendChild(hechizo);
        }

        // LA FOTO DEL OBJETO, un cuadradito con reborde DELANTE del
        // nombre, en el sitio del rombo: lo que tiene foto la usa de
        // viñeta. Se mete la primera de la fila (insertBefore), para que
        // el orden del HTML sea el mismo que el que se ve y el tabulador
        // no salte hacia atrás.
        //
        // Pulsándola se ve en grande (la lupa, el mismo componente que
        // los retratos de los NPC), así que es un <button> de verdad y
        // no una imagen con un click encima.
        const retrato = imagenSeguraDeMesa(cosa.imagen);
        if (retrato) {
            fila.classList.add("tiene-foto");
            const boton = document.createElement("button");
            boton.type = "button";
            boton.className = "campana-botin-foto";
            boton.setAttribute("aria-haspopup", "dialog");
            boton.setAttribute(
                "aria-label", "Ver " + cosa.que.toString().trim() + " en grande");
            const img = document.createElement("img");
            img.className = "campana-botin-foto-img";
            // Comprobada otra vez aunque "retrato" ya salga de
            // imagenSeguraDeMesa: lo que acaba en un src se comprueba en
            // la línea en la que acaba en un src, y así no hay que subir
            // a mirar de dónde venía.
            img.src = imagenSeguraDeMesa(retrato);
            // alt vacío a propósito: lo que es ya lo dice el nombre del
            // botón, y repetirlo es oírlo dos veces seguidas.
            img.alt = "";
            img.loading = "lazy";
            img.decoding = "async";
            boton.appendChild(img);
            boton.addEventListener("click", () => window.lupa.abrir({
                ruta: retrato,
                texto: cosa.que.toString().trim(),
                que: "Imagen de",
                devolverA: boton,
            }));
            fila.insertBefore(boton, fila.firstChild);
        }

        lista.appendChild(fila);
    });

    donde.appendChild(lista);
    return gastadas;
}

// Lo de un pergamino: el desplegable «Qué hace» con sus datos (los que
// haya) y la descripción. Nada si no lleva ninguno.
const DATOS_DE_HECHIZO = [
    ["cargas", "Cargas"],
    ["lanzamiento", "Lanzamiento"],
    ["alcance", "Alcance"],
    ["duracion", "Duración"],
    ["tirada", "Tirada"],
];

function hechizoDeCosa(cosa) {
    const texto = (clave) => (cosa[clave] === undefined || cosa[clave] === null ? "" : cosa[clave]).toString().trim();
    const descripcion = texto("descripcion");
    const datos = DATOS_DE_HECHIZO.filter(([clave]) => texto(clave));
    const nombre = texto("hechizo");
    const magico = texto("rareza") || cosa.sintonizacion;
    if (!descripcion && !datos.length && !nombre && !magico) {
        return null;
    }
    const caja = document.createElement("details");
    caja.className = "campana-botin-hechizo";
    const tirador = document.createElement("summary");
    tirador.className = "campana-botin-hechizo-tirador";
    tirador.textContent = "Qué hace" + (nombre ? " «" + nombre + "»" : "");
    caja.appendChild(tirador);

    // Nivel y escuela, en una línea: «Nivel 1 · abjuración» o «Truco»; en
    // un objeto mágico, su rareza y si pide sintonización.
    const nivel = texto("nivel");
    const linea = [
        nivel === "" ? "" : (Number(nivel) === 0 ? "Truco" : "Nivel " + nivel),
        texto("escuela"),
        texto("rareza"),
        cosa.sintonizacion ? "requiere sintonización" : "",
    ].filter(Boolean).join(" · ");
    if (linea) {
        const p = document.createElement("p");
        p.className = "campana-botin-hechizo-nivel";
        p.textContent = linea;
        caja.appendChild(p);
    }
    if (datos.length) {
        const lista = document.createElement("dl");
        lista.className = "campana-botin-hechizo-datos";
        datos.forEach(([clave, rotulo]) => {
            const fila = document.createElement("div");
            const dt = document.createElement("dt");
            dt.textContent = rotulo;
            const dd = document.createElement("dd");
            dd.textContent = texto(clave);
            fila.appendChild(dt);
            fila.appendChild(dd);
            lista.appendChild(fila);
        });
        caja.appendChild(lista);
    }
    descripcion.split(/\n+/).map((s) => s.trim()).filter(Boolean).forEach((parrafo) => {
        const p = document.createElement("p");
        p.className = "campana-botin-hechizo-texto";
        p.textContent = parrafo;
        caja.appendChild(p);
    });
    return caja;
}

// =========================================
// EL DINERO
// =========================================
// Las monedas de D&D, en piezas de cobre: 1 po = 10 pp = 100 pc; 1 pe
// (electro) = 5 pp; 1 ppt (platino) = 10 po.
const MONEDAS_DE_DND = [
    ["ppt", "platino", 1000],
    ["po", "oro", 100],
    ["pe", "electro", 50],
    ["pp", "plata", 10],
    ["pc", "cobre", 1],
];

function enCobre(cantidad, moneda) {
    const suya = MONEDAS_DE_DND.find(([clave]) => clave === (moneda || "po").toString().toLowerCase());
    return (Number(cantidad) || 0) * (suya ? suya[2] : 100);
}

// 27.35 -> "27,35"; 25 -> "25". Con coma, como se escribe aquí.
function numeroDeDinero(n) {
    return (Math.round(n * 100) / 100).toString().replace(".", ",");
}

// En monedas de las de siempre: «27 po, 3 pp y 5 pc».
function bolsaEnMonedas(cobre) {
    const signo = cobre < 0 ? "−" : "";
    let resto = Math.abs(Math.round(cobre));
    const trozos = [];
    [["po", 100], ["pp", 10], ["pc", 1]].forEach(([clave, vale]) => {
        const cuantas = Math.floor(resto / vale);
        resto -= cuantas * vale;
        if (cuantas) {
            trozos.push(cuantas + " " + clave);
        }
    });
    if (!trozos.length) {
        return "nada";
    }
    return signo + (trozos.length === 1 ? trozos[0] : trozos.slice(0, -1).join(", ") + " y " + trozos[trozos.length - 1]);
}

// Los nombres de la mesa, en el orden de la campaña.
function nombresDeLaMesa(campana) {
    return (campana && Array.isArray(campana.personajes) ? campana.personajes : [])
        .map((p) => (p && p.nombre ? p.nombre.toString().trim() : ""))
        .filter(Boolean);
}

// El reparto de un movimiento: [[nombre, cobre], ...], con el signo del
// movimiento (lo que paga alguien, en negativo). Los nombres se igualan
// sin mayúsculas ni tildes con los de la mesa, para que «melissa» o
// «faelar» caigan en su sitio.
function repartoDeMovimiento(m, mesa) {
    const llano = (s) => s.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const signo = m.sentido === "sale" ? -1 : 1;
    const salida = [];
    (Array.isArray(m.reparto) ? m.reparto : []).forEach((linea) => {
        const trozos = /^(.+?)\s*[:=]\s*(\d+(?:[.,]\d+)?)\s*$/.exec((linea || "").toString());
        if (!trozos) {
            return;
        }
        const cobre = enCobre(Number(trozos[2].replace(",", ".")), m.moneda) * signo;
        const quien = llano(trozos[1]);
        if (quien === "cada uno" || quien === "todos") {
            mesa.forEach((nombre) => salida.push([nombre, cobre]));
            return;
        }
        const suyo = mesa.find((nombre) => llano(nombre) === quien);
        salida.push([suyo || trozos[1].trim(), cobre]);
    });
    return salida;
}

function movimientosDeDinero(campana) {
    const crudos = campana && campana.dinero && Array.isArray(campana.dinero.movimientos)
        ? campana.dinero.movimientos : [];
    return crudos.filter((m) => m && Number(m.cantidad) > 0 && (m.que || "").toString().trim());
}

// LA VENTANA DEL DINERO, en dos columnas: a la izquierda la tabla de
// entradas y gastos (con lo que quedaba después de cada uno) y encima dos
// botones para ver solo las ganancias o solo las pérdidas; a la derecha,
// en un post-it, lo que hay en la bolsa (en po, pp y pc, y todo en oro),
// y debajo el conversor. En una pantalla estrecha, una debajo de otra, en
// el mismo orden en que se leen.
function llenarElDinero(cuerpo, movimientos, mesa) {
    let saldo = 0;
    // Lo de cada uno, con la mesa primero y en su orden (aunque no tenga
    // nada) y detrás quien salga en un reparto sin ser de la mesa.
    const deCadaUno = new Map((mesa || []).map((nombre) => [nombre, 0]));
    let delGrupo = 0;
    const filas = movimientos.map((m) => {
        const cobre = enCobre(m.cantidad, m.moneda) * (m.sentido === "sale" ? -1 : 1);
        saldo += cobre;
        const reparto = repartoDeMovimiento(m, mesa || []);
        let repartido = 0;
        reparto.forEach(([nombre, suyo]) => {
            deCadaUno.set(nombre, (deCadaUno.get(nombre) || 0) + suyo);
            repartido += suyo;
        });
        delGrupo += cobre - repartido;
        return { m, cobre, despues: saldo, reparto };
    });
    const hayReparto = filas.some((f) => f.reparto.length);

    const columnas = document.createElement("div");
    columnas.className = "dinero-columnas";
    const izquierda = document.createElement("div");
    izquierda.className = "dinero-izquierda";
    const derecha = document.createElement("div");
    derecha.className = "dinero-derecha";
    columnas.appendChild(izquierda);
    columnas.appendChild(derecha);
    cuerpo.appendChild(columnas);

    const nota = document.createElement("div");
    nota.className = "cuaderno-postit misiones-nota dinero-nota";
    const titulo = document.createElement("h3");
    titulo.className = "dinero-nota-titulo";
    titulo.textContent = "Lo que tenemos";
    nota.appendChild(titulo);
    const cuanto = document.createElement("p");
    cuanto.className = "dinero-nota-cuanto";
    cuanto.textContent = bolsaEnMonedas(saldo);
    nota.appendChild(cuanto);
    if (saldo % 100) {
        const enOro = document.createElement("p");
        enOro.className = "dinero-nota-oro";
        enOro.textContent = "(" + numeroDeDinero(saldo / 100) + " po en oro)";
        nota.appendChild(enOro);
    }
    // CADA UNO: lo que lleva cada personaje, y lo que es de todos.
    if (hayReparto) {
        const subtitulo = document.createElement("h4");
        subtitulo.className = "dinero-nota-sub";
        subtitulo.textContent = "Lo que lleva cada uno";
        nota.appendChild(subtitulo);
        const lista = document.createElement("ul");
        lista.className = "dinero-nota-cada-uno";
        const linea = (nombre, cobre, clase) => {
            const li = document.createElement("li");
            if (clase) {
                li.className = clase;
            }
            const quien = document.createElement("span");
            quien.className = "dinero-nota-quien";
            quien.textContent = nombre;
            li.appendChild(quien);
            li.appendChild(document.createTextNode(" " + bolsaEnMonedas(cobre)));
            lista.appendChild(li);
        };
        deCadaUno.forEach((cobre, nombre) => linea(nombre, cobre));
        if (Math.round(delGrupo)) {
            linea("Del grupo", delGrupo, "es-del-grupo");
        }
        nota.appendChild(lista);
    }
    derecha.appendChild(nota);

    const tabla = document.createElement("table");
    tabla.className = "campana-dinero-tabla";
    const leyenda = document.createElement("caption");
    leyenda.textContent = "Entradas y gastos";
    tabla.appendChild(leyenda);
    const cabeza = document.createElement("thead");
    const filaCabeza = document.createElement("tr");
    ["Sesión", "Concepto", "Entra", "Sale", "Queda"].forEach((texto) => {
        const th = document.createElement("th");
        th.scope = "col";
        th.textContent = texto;
        filaCabeza.appendChild(th);
    });
    cabeza.appendChild(filaCabeza);
    tabla.appendChild(cabeza);
    const cuerpoTabla = document.createElement("tbody");
    filas.forEach(({ m, cobre, despues, reparto }) => {
        const tr = document.createElement("tr");
        const celda = (texto, clase) => {
            const td = document.createElement("td");
            if (clase) {
                td.className = clase;
            }
            td.textContent = texto;
            tr.appendChild(td);
            return td;
        };
        const moneda = (m.moneda || "po").toString().toLowerCase();
        celda(Number(m.de) ? String(Number(m.de)) : "—");
        const concepto = celda(m.que.toString().trim());
        if ((m.quien || "").toString().trim()) {
            const quien = document.createElement("span");
            quien.className = "campana-dinero-quien";
            quien.textContent = m.quien.toString().trim();
            concepto.appendChild(quien);
        }
        if (reparto.length) {
            const partes = document.createElement("span");
            partes.className = "campana-dinero-reparto";
            // Cada parte entera en su línea si no cabe (que no se parta
            // «Mellissa 20» de «po»).
            reparto.forEach(([nombre, suyo], i) => {
                const parte = document.createElement("span");
                parte.className = "campana-dinero-parte";
                parte.textContent = nombre + " " + numeroDeDinero(Math.abs(suyo) / enCobre(1, moneda)) + " " + moneda;
                partes.appendChild(parte);
                if (i < reparto.length - 1) {
                    partes.appendChild(document.createTextNode(" · "));
                }
            });
            concepto.appendChild(partes);
        }
        celda(cobre > 0 ? "+" + numeroDeDinero(Number(m.cantidad)) + " " + moneda : "", "es-numero");
        celda(cobre < 0 ? "−" + numeroDeDinero(Number(m.cantidad)) + " " + moneda : "", "es-numero");
        celda(numeroDeDinero(despues / 100) + " po", "es-numero");
        tr.setAttribute("data-sentido", cobre < 0 ? "sale" : "entra");
        cuerpoTabla.appendChild(tr);
    });
    tabla.appendChild(cuerpoTabla);

    // GANANCIA Y PÉRDIDA: dos botones que se quedan apretados
    // (aria-pressed). Uno apretado deja solo lo suyo; otra vez, todo.
    const filtros = document.createElement("div");
    filtros.className = "dinero-filtros";
    filtros.setAttribute("role", "group");
    filtros.setAttribute("aria-label", "Qué movimientos se ven");
    const cuantasSeVen = document.createElement("p");
    cuantasSeVen.className = "visually-hidden";
    cuantasSeVen.setAttribute("aria-live", "polite");
    const botonesFiltro = [["entra", "ganancia"], ["sale", "pérdida"]].map(([sentido, texto]) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "dinero-filtro";
        b.textContent = texto;
        b.setAttribute("aria-pressed", "false");
        b.addEventListener("click", () => {
            const poner = b.getAttribute("aria-pressed") !== "true";
            botonesFiltro.forEach((x) => x.setAttribute("aria-pressed", x === b && poner ? "true" : "false"));
            let vistas = 0;
            cuerpoTabla.querySelectorAll("tr").forEach((tr) => {
                tr.hidden = poner && tr.getAttribute("data-sentido") !== sentido;
                vistas += tr.hidden ? 0 : 1;
            });
            cuantasSeVen.textContent = poner
                ? (vistas === 1 ? "1 movimiento" : vistas + " movimientos") + " de " + texto + "."
                : "Todos los movimientos.";
            vacio.hidden = vistas > 0;
            vacio.textContent = "Todavía no hay ninguna " + texto + " apuntada.";
        });
        filtros.appendChild(b);
        return b;
    });
    izquierda.appendChild(filtros);
    izquierda.appendChild(cuantasSeVen);
    // La tabla se desplaza de lado ella sola en una pantalla estrecha.
    const caja = document.createElement("div");
    caja.className = "campana-dinero-caja";
    caja.setAttribute("tabindex", "0");
    caja.setAttribute("role", "region");
    caja.setAttribute("aria-label", "Entradas y gastos, con scroll");
    caja.appendChild(tabla);
    izquierda.appendChild(caja);
    // Lo que se dice si un filtro deja la tabla sin nada.
    const vacio = document.createElement("p");
    vacio.className = "campana-conversor-nota";
    vacio.hidden = true;
    izquierda.appendChild(vacio);
    derecha.appendChild(conversorDeMonedas());
}

// EL CONVERSOR: una cantidad y una moneda, y lo que es en las demás.
let cuentaDeConversores = 0;

function conversorDeMonedas() {
    cuentaDeConversores += 1;
    const id = "conversor-" + cuentaDeConversores;
    const caja = document.createElement("div");
    caja.className = "campana-conversor";
    const titulo = document.createElement("h3");
    titulo.className = "campana-dinero-titulo";
    titulo.id = id + "-titulo";
    titulo.textContent = "Conversor de monedas";
    caja.appendChild(titulo);
    caja.setAttribute("role", "group");
    caja.setAttribute("aria-labelledby", titulo.id);
    const fila = document.createElement("div");
    fila.className = "campana-conversor-fila";
    const lCuanto = document.createElement("label");
    lCuanto.htmlFor = id + "-cuanto";
    lCuanto.textContent = "Cuánto";
    const cuanto = document.createElement("input");
    cuanto.id = id + "-cuanto";
    cuanto.type = "number";
    cuanto.min = "0";
    cuanto.step = "any";
    cuanto.inputMode = "decimal";
    cuanto.value = "1";
    const lDe = document.createElement("label");
    lDe.htmlFor = id + "-de";
    lDe.textContent = "De";
    const de = document.createElement("select");
    de.id = id + "-de";
    MONEDAS_DE_DND.forEach(([clave, nombre]) => de.appendChild(new Option(clave + " (" + nombre + ")", clave)));
    de.value = "po";
    [lCuanto, cuanto, lDe, de].forEach((x) => fila.appendChild(x));
    caja.appendChild(fila);
    const salida = document.createElement("ul");
    salida.className = "campana-conversor-salida";
    salida.setAttribute("aria-live", "polite");
    const pintar = () => {
        const cobre = enCobre(Number(String(cuanto.value).replace(",", ".")) || 0, de.value);
        salida.textContent = "";
        MONEDAS_DE_DND.filter(([clave]) => clave !== de.value).forEach(([clave, nombre, vale]) => {
            const li = document.createElement("li");
            li.textContent = "= " + numeroDeDinero(cobre / vale) + " " + clave + " (" + nombre + ")";
            salida.appendChild(li);
        });
    };
    cuanto.addEventListener("input", pintar);
    de.addEventListener("change", pintar);
    caja.appendChild(salida);
    const nota = document.createElement("p");
    nota.className = "campana-conversor-nota";
    nota.textContent = "1 po = 10 pp = 100 pc · 1 pe = 5 pp · 1 ppt = 10 po";
    caja.appendChild(nota);
    pintar();
    return caja;
}

// LO QUE LLEVA CADA UNO DE LA MESA, en su ficha: lo del botín que lleva su
// nombre en «quien» y no está gastado. Lo pone la página de la campaña y
// la de unas notas (cuaderno.js), que son las que abren estas fichas.
let botinDeLaMesa = [];

function ponerBotinDeLaMesa(campana) {
    botinDeLaMesa = cosasDelBotin(campana || {});
}

function botinDeUnPj(nombre) {
    const llano = (s) => comoSeEscribeElTipo(s);
    const suyas = botinDeLaMesa.filter((c) => !c.gastado && llano(c.quien) === llano(nombre));
    if (!suyas.length) {
        return null;
    }
    const caja = document.createElement("section");
    caja.className = "mesa-botin";
    const titulo = document.createElement("h3");
    titulo.className = "mesa-botin-titulo";
    titulo.textContent = "Lo que lleva del botín";
    caja.appendChild(titulo);
    const lista = document.createElement("ul");
    lista.className = "mesa-botin-lista";
    suyas.forEach((c) => {
        const li = document.createElement("li");
        li.textContent = c.que.toString().trim()
            + (c.cantidad !== undefined && c.cantidad !== "" ? " ×" + c.cantidad : "");
        lista.appendChild(li);
    });
    caja.appendChild(lista);
    return caja;
}

function trozoDeBotin(texto) {
    const trozo = document.createElement("span");
    trozo.className = "campana-botin-trozo";
    trozo.textContent = texto;
    return trozo;
}


// =========================================
// LAS MISIONES PENDIENTES
// =========================================
// Lo que el grupo tiene a medias: a quién hay que ir a ver, qué hay que
// llevar a dónde y qué prometió alguien. Va en "misiones", en el JSON de
// la campaña, repartido por apartados —que normalmente son quién te lo
// encargó o dónde pasa— y se escribe a mano, como el botín.
//
//   "misiones": [
//       {
//           "nombre": "la Gran Caravana",
//           "cosas": [
//               { "que": "Llevar la mercancía a Prunia", "de": 1 },
//               { "que": "Hablar con Sigil", "hecha": true }
//           ]
//       }
//   ]
//
//   nombre      el apartado. Sale como título, y se puede plegar.
//   que         la misión. Lo único que hace falta.
//   de          en qué sesión empezó, si se sabe.
//   hasta       en qué sesión se cerró (completada o fallada).
//   estado      "completada" o "fallada"; sin él, pendiente ("hecha":
//               true, lo de antes, vale como completada).
//   quien       el NPC que nos la pidió (opcional).
//   recompensa  la prometida (sale mientras está pendiente).
//   obtenida    la que hubo de verdad al cerrarla (vacío: ninguna).
//   urgente     true: sale la primera de su misión, con «urgente».
//   plazo       hasta cuándo («antes de que la caravana se vaya»).
//   pistas      lo que sabemos de ella, una por cosa: plegadas debajo.
//
// DE PRIMERAS SOLO SE VE LO PENDIENTE. Lo cerrado no se borra: va al
// HISTÓRICO, un <details> plegado al final de la nota («completadas y
// fallidas»), de la última cerrada a la primera, con sus sesiones, quién
// la pidió y qué recompensa hubo. (El post-it de cada sesión es otra cosa:
// se escribe en esa sesión y no sale de aquí.)
//
// SE VE COMO UN POST-IT, el mismo papel amarillo que la nota de cosas
// pendientes de una partida (estilos/componentes/postit.css). No es un
// adorno: estas dos listas son la misma cosa —lo que queda por hacer— y
// se reconocen por el papel antes de leer una palabra.
//
// LAS CASILLAS NO SE PUEDEN MARCAR AQUÍ, a diferencia de las del post-it
// de una partida. Lo que ponga el JSON es lo que hay: estas misiones las
// lleva quien dirige, y una marca que solo existe en el navegador de uno
// haría pensar que está apuntado cuando no lo está. Las casillas se ven
// porque dicen de un vistazo qué está hecho y qué no.

function estadoDeMision(cosa) {
    const estado = (cosa.estado || "").toString().trim().toLowerCase();
    if (estado === "completada" || estado === "fallada") {
        return estado;
    }
    return cosa.hecha ? "completada" : "pendiente";
}

// Lo de debajo de una misión, pequeño: «lo pide Sigil · recompensa: 50
// po». Vacío si no hay nada.
function extrasDeMision(trozos) {
    const hay = trozos.filter(Boolean);
    if (!hay.length) {
        return null;
    }
    const extra = document.createElement("span");
    extra.className = "misiones-extra";
    extra.textContent = hay.join(" · ");
    return extra;
}

// Las pistas de una misión (lo que sabemos de ella), plegadas.
function pistasDeMision(cosa) {
    const pistas = (Array.isArray(cosa.pistas) ? cosa.pistas : [])
        .map((p) => (p || "").toString().trim()).filter(Boolean);
    if (!pistas.length) {
        return null;
    }
    const caja = document.createElement("details");
    caja.className = "misiones-pistas";
    const tirador = document.createElement("summary");
    tirador.textContent = pistas.length === 1 ? "1 pista" : pistas.length + " pistas";
    caja.appendChild(tirador);
    const lista = document.createElement("ul");
    pistas.forEach((p) => {
        const li = document.createElement("li");
        li.textContent = p;
        lista.appendChild(li);
    });
    caja.appendChild(lista);
    return caja;
}

function sesionesDeMision(cosa) {
    const de = Number(cosa.de);
    const hasta = Number(cosa.hasta);
    if (de && hasta && de !== hasta) {
        return "sesiones " + de + " a " + hasta;
    }
    if (hasta) {
        return "sesión " + hasta;
    }
    return de ? "desde la sesión " + de : "";
}

function misionesDe(campana) {
    return (Array.isArray(campana.misiones) ? campana.misiones : [])
        .map((apartado) => ({
            nombre: (apartado && apartado.nombre ? apartado.nombre : "")
                .toString().trim(),
            cosas: (Array.isArray(apartado && apartado.cosas) ? apartado.cosas : [])
                .filter((c) => c && (c.que || "").toString().trim())
                .map((c) => Object.assign({}, c, { estado: estadoDeMision(c) })),
        }))
        .filter((apartado) => apartado.cosas.length);
}

function llenarLasMisiones(cuerpo, misiones) {
    const nota = document.createElement("div");
    nota.className = "cuaderno-postit misiones-nota";

    let pendientes = 0;
    const cerradas = [];
    misiones.forEach((apartado) => {
        apartado.cosas.filter((c) => c.estado !== "pendiente")
            .forEach((c) => cerradas.push(Object.assign({ apartado: apartado.nombre }, c)));
        const abiertas = apartado.cosas.filter((c) => c.estado === "pendiente");
        if (!abiertas.length) {
            return;
        }
        // Cada apartado es un <details>, que se pliega y se despliega
        // solo, con el teclado y diciéndolo un lector de pantalla. Lo
        // mismo que las regiones de los npcs y los apartados de la wiki.
        //
        // NACEN ABIERTOS y no se recuerda lo que se pliegue: aquí no hay
        // cincuenta apartados, hay tres o cuatro, y lo que se viene a ver
        // es justo lo que hay dentro.
        const caja = document.createElement("details");
        caja.className = "misiones-apartado";
        caja.open = true;

        const tirador = document.createElement("summary");
        tirador.className = "misiones-tirador";

        const titulo = document.createElement("h3");
        titulo.className = "misiones-titulo";
        const flecha = document.createElement("span");
        flecha.className = "misiones-flecha";
        flecha.setAttribute("aria-hidden", "true");
        flecha.textContent = "▾";
        titulo.appendChild(flecha);
        const nombre = document.createElement("span");
        nombre.textContent = apartado.nombre || "sin apartado";
        titulo.appendChild(nombre);

        const quedan = abiertas.length;
        pendientes += quedan;
        const cuenta = document.createElement("span");
        cuenta.className = "misiones-cuenta";
        cuenta.textContent = quedan === 1 ? "queda 1" : "quedan " + quedan;
        titulo.appendChild(cuenta);

        tirador.appendChild(titulo);
        caja.appendChild(tirador);

        const lista = document.createElement("ul");
        // cuaderno-tareas es la lista de cosas pendientes de todo el
        // sitio: dibuja la casilla y el tachado sin JavaScript ninguno
        // (estilos/componentes/postit.css).
        lista.className = "cuaderno-tareas";
        // Lo urgente, lo primero de su misión.
        abiertas.sort((a, b) => (b.urgente ? 1 : 0) - (a.urgente ? 1 : 0));
        abiertas.forEach((cosa) => {
            const fila = document.createElement("li");
            if (cosa.urgente) {
                const marca = document.createElement("span");
                marca.className = "misiones-urgente";
                marca.textContent = "urgente";
                fila.appendChild(marca);
                fila.appendChild(document.createTextNode(" "));
            }
            fila.appendChild(document.createTextNode(cosa.que.toString().trim()));
            const numero = Number(cosa.de);
            if (numero) {
                // UN ESPACIO DE VERDAD antes del "· sesión 1". Sin él,
                // pegado a la última palabra, no hay por dónde partir la
                // línea: el trozo va en nowrap (para que "sesión" y el
                // número no se separen) y en una pantalla estrecha con la
                // letra grande se salía de la ventana. Medido a 320 y a
                // 390 con el texto al 200%.
                fila.appendChild(document.createTextNode(" "));
                const de = document.createElement("span");
                de.className = "misiones-de";
                de.textContent = "sesión " + numero;
                fila.appendChild(de);
            }
            const extra = extrasDeMision([
                cosa.plazo ? "plazo: " + cosa.plazo.toString().trim() : "",
                cosa.quien ? "lo pide " + cosa.quien.toString().trim() : "",
                cosa.recompensa ? "recompensa: " + cosa.recompensa.toString().trim() : "",
            ]);
            if (extra) {
                fila.appendChild(extra);
            }
            const pistas = pistasDeMision(cosa);
            if (pistas) {
                fila.appendChild(pistas);
            }
            lista.appendChild(fila);
        });
        caja.appendChild(lista);
        nota.appendChild(caja);
    });

    const pie = document.createElement("p");
    pie.className = "misiones-pie";
    pie.textContent = pendientes === 0
        ? "No queda nada pendiente."
        : (pendientes === 1 ? "Queda 1 cosa por hacer."
            : "Quedan " + pendientes + " cosas por hacer.");
    nota.appendChild(pie);

    if (cerradas.length) {
        nota.appendChild(historicoDeMisiones(cerradas));
    }

    cuerpo.appendChild(nota);
}


// EL HISTÓRICO: lo completado y lo fallado, plegado al final de la nota.
// Cada una con su marca (✓ o ✗, y dicho en palabras para quien no la ve),
// sus sesiones, de qué apartado era, quién la pidió y qué recompensa
// hubo. De la última cerrada a la primera.
function historicoDeMisiones(cerradas) {
    const hechas = cerradas.filter((c) => c.estado === "completada").length;
    const falladas = cerradas.length - hechas;
    const caja = document.createElement("details");
    caja.className = "misiones-historico";
    const tirador = document.createElement("summary");
    tirador.className = "misiones-tirador";
    const titulo = document.createElement("h3");
    titulo.className = "misiones-titulo";
    const flecha = document.createElement("span");
    flecha.className = "misiones-flecha";
    flecha.setAttribute("aria-hidden", "true");
    flecha.textContent = "▾";
    titulo.appendChild(flecha);
    const nombre = document.createElement("span");
    nombre.textContent = "el histórico";
    titulo.appendChild(nombre);
    const cuenta = document.createElement("span");
    cuenta.className = "misiones-cuenta";
    cuenta.textContent = [
        hechas ? hechas + (hechas === 1 ? " completada" : " completadas") : "",
        falladas ? falladas + (falladas === 1 ? " fallida" : " fallidas") : "",
    ].filter(Boolean).join(" · ");
    titulo.appendChild(cuenta);
    tirador.appendChild(titulo);
    caja.appendChild(tirador);

    const lista = document.createElement("ul");
    lista.className = "misiones-hechas";
    cerradas
        .map((c, i) => ({ c, i }))
        .sort((a, b) => (Number(b.c.hasta) || 0) - (Number(a.c.hasta) || 0) || a.i - b.i)
        .forEach(({ c }) => {
            const fallada = c.estado === "fallada";
            const fila = document.createElement("li");
            fila.className = "misiones-hecha" + (fallada ? " es-fallada" : "");
            const marca = document.createElement("span");
            marca.className = "misiones-marca";
            marca.setAttribute("aria-hidden", "true");
            marca.textContent = fallada ? "✗" : "✓";
            fila.appendChild(marca);
            const que = document.createElement("span");
            que.className = "misiones-que";
            que.textContent = c.que.toString().trim();
            fila.appendChild(que);
            const obtenida = (c.obtenida || "").toString().trim();
            const prometida = (c.recompensa || "").toString().trim();
            let premio = "";
            if (obtenida) {
                premio = "recompensa: " + obtenida;
            } else if (fallada && prometida) {
                premio = "se perdió: " + prometida;
            } else if (!fallada) {
                premio = "sin recompensa";
            }
            const extra = extrasDeMision([
                fallada ? "fallida" : "completada",
                sesionesDeMision(c),
                c.apartado,
                c.quien ? "la pidió " + c.quien.toString().trim() : "",
                premio,
            ]);
            fila.appendChild(extra);
            lista.appendChild(fila);
        });
    caja.appendChild(lista);
    return caja;
}


// =========================================
// LA LISTA DE SESIONES
// =========================================

function pintarSesiones(lista, campana, publicadas) {
    const sesiones = (Array.isArray(campana.sesiones) ? campana.sesiones : [])
        .map((sesion) => {
            const publicada = publicadas[sinExtensionNotas(sesion && sesion.url)];
            if (!publicada) {
                return Object.assign({}, sesion, { hecha: false });
            }
            // El título bueno es el de la página (su <h1>), no el que se
            // apuntó al crearla: si lo cambias al pasar las notas a
            // limpio, aquí se ve el cambio sin tocar el JSON.
            return Object.assign({}, sesion, {
                titulo: publicada.title || sesion.titulo,
                fecha: publicada.date || sesion.fecha,
                hecha: true,
            });
        })
        // De la más reciente a la más vieja: lo que se viene a buscar es
        // la última partida.
        .sort((a, b) => (Number(b.numero) || 0) - (Number(a.numero) || 0));

    if (!sesiones.length) {
        lista.innerHTML =
            '<li class="entries-empty">Todavía no hay notas de esta campaña.</li>';
        return;
    }
    lista.innerHTML = sesiones.map(filaDeSesion).join("");

    // EL RESUMEN de cada una, en una ventana (el botón de al lado).
    lista.querySelectorAll("[data-sesion-resumen]").forEach((boton) => {
        const sesion = sesiones.find((s) => String(Number(s.numero)) === boton.getAttribute("data-sesion-resumen"));
        if (!sesion) {
            return;
        }
        boton.addEventListener("click", () =>
            window.ventanaModal.abrir({
                titulo: "resumen_sesion_" + String(Number(sesion.numero)).padStart(2, "0") + ".txt",
                clase: "modal-resumen",
                devolverA: boton,
                llenar: (cuerpo) => llenarElResumen(cuerpo, sesion),
            })
        );
    });
}

// Una línea por cosa; «Escena: lo que pasó» con la escena en negrita. Y
// debajo, el enlace para leer las notas enteras.
function llenarElResumen(cuerpo, sesion) {
    const corto = (sesion.titulo || "").toString().replace(/^\s*sesi[oó]n\s*\d+\s*(?:[·.:\-–—]\s*)?/i, "").trim();
    const titulo = document.createElement("h3");
    titulo.className = "campana-resumen-titulo";
    titulo.textContent = "Sesión " + Number(sesion.numero) + (corto ? " — " + corto : "");
    cuerpo.appendChild(titulo);
    const lista = document.createElement("ul");
    lista.className = "campana-resumen-lista";
    (sesion.resumen || "").toString().split(/\n+/).map((l) => l.trim()).filter(Boolean).forEach((linea) => {
        const li = document.createElement("li");
        const dos = linea.indexOf(": ");
        if (dos > 0 && dos < 70) {
            const quien = document.createElement("strong");
            quien.textContent = linea.slice(0, dos) + ":";
            li.appendChild(quien);
            li.appendChild(document.createTextNode(" " + linea.slice(dos + 2)));
        } else {
            li.textContent = linea;
        }
        lista.appendChild(li);
    });
    cuerpo.appendChild(lista);
    const leer = document.createElement("a");
    leer.className = "campana-resumen-leer";
    leer.href = rutaSeguraNotas(sesion.url);
    leer.textContent = "leer las notas enteras →";
    cuerpo.appendChild(leer);
}

function filaDeSesion(sesion) {
    const numero = Number(sesion.numero) || 0;
    const titulo = (sesion.titulo || "").trim();
    const fecha = (sesion.fecha || "").trim();
    const hecha = !!sesion.hecha;

    // El título de la página es "Sesión 4" o "Sesión 4 · El mercado", y
    // aquí al lado ya va escrito "sesión 4": sin quitarle esa parte, las
    // filas salían como "sesión 4   Sesión 4   03-10-2026". Una sesión sin
    // nombre se queda solo con su número y su fecha, que es suficiente.
    const corto = titulo
        .replace(/^\s*sesi[oó]n\s*\d+\s*(?:[·.:\-–—]\s*)?/i, "")
        .trim();

    // Dos líneas: arriba el número a la izquierda y la fecha a la
    // derecha, abajo el nombre de la sesión. En una sola línea, en cuanto
    // la sesión tenía nombre la fecha se caía debajo y acababa pegada al
    // número, que parecía otra fila. Y una sesión sin nombre se queda en
    // una línea sola, porque el trozo de abajo se va si está vacío.
    const dentro =
        '<span class="campana-sesion-meta">' +
        `<span class="campana-sesion-num">sesión ${escaparHtmlNotas(numero)}</span>` +
        (fecha
            ? `<span class="campana-sesion-fecha">${escaparHtmlNotas(fecha)}</span>`
            : "") +
        (hecha
            ? ""
            : '<span class="campana-sesion-aviso">sin publicar</span>') +
        "</span>" +
        `<span class="campana-sesion-titulo">${escaparHtmlNotas(corto)}</span>`;

    // El nombre que se lee en voz alta, de una vez y entero, en vez de
    // trozo a trozo: "sesión 1, El mercado, 03-10-2026".
    const nombre =
        `Sesión ${numero}` +
        (corto ? ", " + corto : "") +
        (fecha ? ", " + fecha : "") +
        (hecha ? "" : ". Todavía sin publicar");

    if (!hecha) {
        return (
            "<li>" +
            `<span class="campana-sesion is-pendiente" aria-label="${escaparHtmlNotas(nombre)}">` +
            dentro +
            "</span></li>"
        );
    }
    // Con resumen, su botón al lado (no dentro: un botón dentro de un
    // enlace no se puede pulsar bien ni se lee bien).
    const resumen = (sesion.resumen || "").toString().trim()
        ? `<button class="campana-sesion-resumen" type="button" aria-haspopup="dialog"` +
          ` data-sesion-resumen="${escaparHtmlNotas(numero)}"` +
          ` aria-label="Resumen de la sesión ${escaparHtmlNotas(numero)}">resumen</button>`
        : "";
    return (
        `<li class="campana-sesion-fila">` +
        `<a class="campana-sesion" href="${escaparHtmlNotas(rutaSeguraNotas(sesion.url))}"` +
        ` aria-label="${escaparHtmlNotas(nombre)}">` +
        dentro +
        "</a>" + resumen + "</li>"
    );
}


// =========================================
// SEGURIDAD AL PINTAR
// =========================================
// Mismo criterio que en reto.js, relatos.js y rol.js: el JSON lo
// escribes tú, pero esto se pinta con innerHTML, así que todo va
// escapado y las direcciones se comprueban.

function escaparHtmlNotas(texto) {
    return (texto === null || texto === undefined ? "" : texto.toString())
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function rutaSeguraNotas(url) {
    const limpia = (url || "").trim();
    // Una dirección de ESTA web (que empiece por "/" pero no por "//",
    // que sería otra web), una http(s) entera, un correo o un ancla. Lo
    // demás —"javascript:", "data:", "//otrositio.com"— no es una
    // dirección: es código o es irse de aquí sin que se note.
    if (/^\/(?!\/)/.test(limpia) || /^(https?:\/\/|mailto:|#)/i.test(limpia)) {
        return limpia;
    }
    return "#";
}
