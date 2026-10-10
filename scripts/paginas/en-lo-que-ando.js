// =========================================
// EN LO QUE ANDO — lo que tengo entre manos
// =========================================
// Cuatro bloques en una página:
//
//   1. AHORA MISMO     lo que estoy leyendo, viendo y jugando.
//   2. LA PARTIDA      la campaña de rol. Éste NO se escribe: sale solo de
//                      datos/notas-rol.json y del JSON de la campaña.
//   3. ESCRIBIENDO     lo que tengo a medias.
//   4. PENDIENTES      un post-it con casillas, el mismo que el de las
//                      notas de una partida (scripts/componentes/tareas.js).
//
// QUIÉN MANDA: datos/en-lo-que-ando.json, que dice la propia página en
// data-ando-datos. Un bloque que no tenga nada escrito NO SALE: una página
// de "en lo que ando" con tres marcos vacíos dice justo lo contrario de lo
// que quiere decir.
//
// CÓMO ES EL ARCHIVO
// ------------------
//   {
//     "intro": "una línea explicando qué es esto",
//     "actualizado": "06-10-2026",      <- cuándo se tocó por última vez
//     "ahora": [
//       { "que": "leyendo",
//         "titulo": "El Conde de Montecristo",
//         "de": "Alexandre Dumas",      <- autor, estudio, quien sea
//         "nota": "por la mitad y enganchadísimo",
//         "porcentaje": 45,             <- por dónde vas, de 0 a 100
//         "enlace": "" }                <- opcional, a donde sea
//     ],
//     "escribiendo": [
//       { "titulo": "Writeober 2026", "tipo": "reto",
//         "estado": "día 2 de 31", "nota": "", "enlace": "/web/..." }
//     ],
//     "pendientes": [
//       { "cosa": "pasar a limpio las notas de la sesión 2",
//         "hecho": false }
//     ]
//   }
//
// Lo único obligatorio de cada cosa es el título (o "cosa", en los
// pendientes). Lo que falte no sale.
//
// OJO CON LOS NOMBRES: todos los scripts comparten el mismo ámbito global,
// así que lo de aquí lleva "Ando" en el nombre. Se comprueba con
// herramientas/4-comprobar/nombres-repetidos.py.

// De dónde sale el bloque de la campaña. Es el mismo listado que usa el
// índice de una campaña para saber qué sesiones están publicadas de
// verdad: una sesión creada pero todavía en borrador no está aquí.
const ANDO_SESIONES_URL = "/datos/notas-rol.json";

initializeEnLoQueAndo();

async function initializeEnLoQueAndo() {
    const pagina = document.querySelector("[data-ando-datos]");
    if (!pagina || typeof window.pedirDatos !== "function") {
        return;
    }
    const fuente = (pagina.getAttribute("data-ando-datos") || "").trim();
    if (!fuente) {
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
        const aviso = document.querySelector("[data-ando-vacio]");
        if (aviso) {
            aviso.textContent = "No se ha podido cargar esto ahora mismo.";
            aviso.hidden = false;
        }
        return;
    }

    cabeceraDeAndo(datos);
    let puestos = 0;
    puestos += pintarAhora(datos) ? 1 : 0;
    // La campaña va después del "ahora mismo" y antes de lo que escribo,
    // que es el orden en que se mira: lo de cada día, lo de cada semana y
    // lo de cada mes.
    puestos += (await pintarLaPartida()) ? 1 : 0;
    puestos += pintarEscribiendo(datos) ? 1 : 0;
    puestos += pintarPendientes(datos) ? 1 : 0;

    // Los −■✕ de las ventanas que acaban de aparecer.
    document.dispatchEvent(new CustomEvent("ventanas:actualizar"));

    const vacio = document.querySelector("[data-ando-vacio]");
    if (vacio && !puestos) {
        vacio.hidden = false;
    }
}

function cabeceraDeAndo(datos) {
    const intro = document.querySelector("[data-ando-intro]");
    if (intro && (datos.intro || "").toString().trim()) {
        intro.textContent = datos.intro.toString().trim();
    }
    const fecha = document.querySelector("[data-ando-fecha]");
    const cuando = (datos.actualizado || "").toString().trim();
    if (fecha && cuando) {
        fecha.textContent = "última vez que toqué esto: " + cuando;
        fecha.hidden = false;
    }
}


// =========================================
// AHORA MISMO: LEYENDO, VIENDO, JUGANDO
// =========================================
// Una <dl>: la etiqueta ("leyendo") es el término y lo que sea es la
// definición. Así un lector de pantalla dice "leyendo, El Conde de
// Montecristo" y no dos textos sueltos seguidos.

function pintarAhora(datos) {
    const caja = document.querySelector("[data-ando-ahora]");
    const cuerpo = document.querySelector("[data-ando-ahora-cuerpo]");
    if (!caja || !cuerpo) {
        return false;
    }
    const cosas = (Array.isArray(datos.ahora) ? datos.ahora : []).filter(
        (c) => c && (c.titulo || "").toString().trim()
    );
    if (!cosas.length) {
        return false;
    }

    cuerpo.textContent = "";
    const lista = document.createElement("dl");
    lista.className = "ando-lista";

    cosas.forEach((cosa) => {
        const bloque = document.createElement("div");
        bloque.className = "ando-cosa";

        const que = document.createElement("dt");
        que.className = "ando-cosa-que";
        que.textContent = (cosa.que || "ahora mismo").toString().trim();
        bloque.appendChild(que);

        const valor = document.createElement("dd");
        valor.className = "ando-cosa-valor";
        valor.appendChild(tituloDeAndo(cosa));

        const de = (cosa.de || "").toString().trim();
        if (de) {
            const autor = document.createElement("span");
            autor.className = "ando-cosa-de";
            autor.textContent = de;
            valor.appendChild(autor);
        }
        const barra = barraDeAndo(cosa);
        if (barra) {
            valor.appendChild(barra);
        }
        const nota = (cosa.nota || "").toString().trim();
        if (nota) {
            const linea = document.createElement("p");
            linea.className = "ando-cosa-nota";
            linea.textContent = nota;
            valor.appendChild(linea);
        }
        bloque.appendChild(valor);
        lista.appendChild(bloque);
    });

    cuerpo.appendChild(lista);
    caja.hidden = false;
    return true;
}

// POR DÓNDE VAS, en tanto por ciento. Sale del "porcentaje" del JSON y es
// opcional: un libro sin él se queda como estaba. Vale para los tres
// huecos, no solo para los libros y las series: una partida a medias
// también tiene un "por dónde voy".
//
// LA CIFRA VA ESCRITA ("45% leído") y la barra lleva aria-hidden. Podría
// haber sido un role="progressbar" con su aria-valuenow, pero entonces un
// lector de pantalla diría el número dos veces: una por la barra y otra
// por el texto de al lado. Aquí el dato es la frase y la barra es el
// adorno, que es el mismo criterio que el resto del sitio (pauta 1.4.1).
//
// EL VERBO depende del hueco: "leído", "visto", "jugado". Si el hueco es
// otro —uno se puede inventar "escuchando"— se queda en "45%", que se
// entiende igual.
const ANDO_VERBOS = {
    leyendo: "leído",
    viendo: "visto",
    jugando: "jugado",
    escuchando: "escuchado",
};

function barraDeAndo(cosa) {
    // Lo primero, los tres "no hay": null, undefined y la cadena vacía.
    // Hace falta mirarlos aparte porque Number(null) y Number("") valen
    // CERO, no NaN, y la herramienta deja un "porcentaje": null cuando se
    // contesta en blanco. Sin esto, no poner barra pintaba una al 0%, que
    // dice algo muy distinto de no decir nada.
    const puesto = cosa.porcentaje;
    if (puesto === null || puesto === undefined || puesto === "") {
        return null;
    }
    // Y luego Number() y no parseInt: "45abc" tiene que ser un error, no
    // un 45. Lo que venga fuera de 0-100 se recorta en vez de rechazarlo,
    // porque una barra al 150% se sale del riel y se ve raro de verdad.
    const crudo = Number(puesto);
    if (!Number.isFinite(crudo)) {
        return null;
    }
    const cuanto = Math.max(0, Math.min(100, Math.round(crudo)));

    const caja = document.createElement("div");
    caja.className = "ando-barra";

    const riel = document.createElement("span");
    riel.className = "ando-barra-riel";
    riel.setAttribute("aria-hidden", "true");
    const lleno = document.createElement("span");
    lleno.className = "ando-barra-lleno";
    // Por style y no por una clase: son 101 valores posibles y no se
    // pueden escribir todos en una hoja de estilo. El número ya está
    // acotado aquí arriba, así que lo que se pone no viene de fuera.
    lleno.style.width = cuanto + "%";
    riel.appendChild(lleno);
    caja.appendChild(riel);

    const cifra = document.createElement("span");
    cifra.className = "ando-barra-cifra";
    const verbo = ANDO_VERBOS[(cosa.que || "").toString().trim().toLowerCase()] || "";
    cifra.textContent = cuanto + "%" + (verbo ? " " + verbo : "");
    caja.appendChild(cifra);
    return caja;
}

// El título, enlazado si hay a dónde. En <strong> esté enlazado o no: lo
// que lo hace el título es ser el título, no llevar enlace, y así las
// fichas con enlace y sin enlace se leen igual.
function tituloDeAndo(cosa) {
    const titulo = document.createElement("strong");
    titulo.className = "ando-cosa-titulo";
    titulo.textContent = cosa.titulo.toString().trim();

    const url = rutaSeguraAndo(cosa.enlace);
    if (url === "#") {
        return titulo;
    }
    const enlace = document.createElement("a");
    enlace.className = "ando-enlace";
    enlace.href = rutaSeguraAndo(url);
    enlace.appendChild(titulo);
    return enlace;
}


// =========================================
// LA PARTIDA DE ROL — este bloque se escribe solo
// =========================================
// No hay nada que apuntar: las sesiones ya están en datos/notas-rol.json
// (lo escribe herramientas/3-generadores/generar-posts.py al publicar una)
// y de la más reciente se saca su campaña. Publicar unas notas es lo que
// actualiza esto, que es como tiene que ser: si hubiera que venir aquí a
// cambiarlo a mano, el día que se olvidara esta página estaría mintiendo.

async function pintarLaPartida() {
    const caja = document.querySelector("[data-ando-rol]");
    const cuerpo = document.querySelector("[data-ando-rol-cuerpo]");
    if (!caja || !cuerpo) {
        return false;
    }

    let sesiones = [];
    try {
        const respuesta = await window.pedirDatos(ANDO_SESIONES_URL);
        if (!respuesta.ok) {
            throw new Error("La respuesta no fue correcta");
        }
        const items = await respuesta.json();
        sesiones = Array.isArray(items) ? items : [];
    } catch (error) {
        return false;
    }
    if (!sesiones.length) {
        return false;
    }

    // La última publicada. El listado viene ordenado de la más nueva a la
    // más vieja, pero se vuelve a ordenar aquí por si acaso: ordenar una
    // lista de una cosa no cuesta nada y así esto no depende de cómo deje
    // el archivo otro script.
    const ultima = sesiones
        .slice()
        .sort((a, b) => fechaDeAndo(b && b.date) - fechaDeAndo(a && a.date))[0];
    if (!ultima) {
        return false;
    }

    let campana = null;
    const clave = (ultima.campana || "").toString().trim();
    if (clave && /^[a-z0-9_-]+$/i.test(clave)) {
        // La clave se comprueba antes de meterla en una dirección: sale de
        // un archivo nuestro, pero es lo único de aquí que acaba formando
        // una URL y no cuesta nada asegurarse.
        try {
            const respuesta = await window.pedirDatos(
                "/datos/campana-" + clave + ".json"
            );
            if (respuesta.ok) {
                campana = await respuesta.json();
            }
        } catch (error) {
            // Sin el JSON de la campaña sale igual, con menos cosas.
        }
    }

    cuerpo.textContent = "";
    const lista = document.createElement("dl");
    lista.className = "ando-lista";

    const nombre = campana ? (campana.nombre || "").toString().trim() : "";
    if (nombre) {
        lista.appendChild(
            datoDeAndo("la campaña", textoAndo(nombre), "ando-cosa-titulo")
        );
    }
    const sistema = campana ? (campana.sistema || "").toString().trim() : "";
    if (sistema) {
        lista.appendChild(datoDeAndo("el sistema", textoAndo(sistema)));
    }

    const titulo = (ultima.title || "").toString().trim();
    const fecha = (ultima.date || "").toString().trim();
    const url = rutaSeguraAndo(ultima.url);
    const ultimoValor = document.createDocumentFragment();
    if (url !== "#" && titulo) {
        const enlace = document.createElement("a");
        enlace.className = "ando-enlace";
        enlace.href = rutaSeguraAndo(url);
        enlace.textContent = titulo;
        ultimoValor.appendChild(enlace);
    } else if (titulo) {
        ultimoValor.appendChild(textoAndo(titulo));
    }
    if (fecha) {
        const cuando = document.createElement("span");
        cuando.className = "ando-cosa-de";
        cuando.textContent = fecha;
        ultimoValor.appendChild(cuando);
    }
    if (ultimoValor.childNodes.length) {
        lista.appendChild(datoDeAndo("la última partida", ultimoValor));
    }

    // Cuántas van. Es el dato que se mira de verdad al volver a una
    // campaña: no "cuál fue la última", sino "por dónde vamos".
    const suyas = sesiones.filter(
        (s) => !clave || (s && (s.campana || "").toString().trim() === clave)
    ).length;
    lista.appendChild(
        datoDeAndo(
            "van",
            textoAndo(suyas === 1 ? "1 partida jugada" : suyas + " partidas jugadas")
        )
    );

    if (lista.childNodes.length) {
        cuerpo.appendChild(lista);
    }

    // Y los dos botones de siempre: la campaña y su página de npcs.
    const botones = document.createElement("p");
    botones.className = "ando-botones";
    if (campana) {
        unBotonDeAndo(botones, campana.pagina, "las notas →");
        unBotonDeAndo(botones, campana.npcs, "npcs →");
    }
    if (botones.childNodes.length) {
        cuerpo.appendChild(botones);
    }

    caja.hidden = false;
    return true;
}

function unBotonDeAndo(donde, url, texto) {
    const limpia = rutaSeguraAndo(url);
    if (limpia === "#") {
        return;
    }
    const enlace = document.createElement("a");
    enlace.className = "ando-boton";
    enlace.href = rutaSeguraAndo(limpia);
    enlace.textContent = texto;
    donde.appendChild(enlace);
}

// "03-10-2026" a un número con el que poder ordenar. Lo que no tenga esa
// forma se va al final, que es donde menos molesta.
function fechaDeAndo(cadena) {
    const trozos = (cadena || "").toString().trim().split("-");
    if (trozos.length !== 3) {
        return 0;
    }
    const dia = Number(trozos[0]);
    const mes = Number(trozos[1]);
    const anyo = Number(trozos[2]);
    if (!dia || !mes || !anyo) {
        return 0;
    }
    return anyo * 10000 + mes * 100 + dia;
}


// =========================================
// EN QUÉ ANDO ESCRIBIENDO
// =========================================

function pintarEscribiendo(datos) {
    const caja = document.querySelector("[data-ando-escribiendo]");
    const cuerpo = document.querySelector("[data-ando-escribiendo-cuerpo]");
    if (!caja || !cuerpo) {
        return false;
    }
    const cosas = (Array.isArray(datos.escribiendo) ? datos.escribiendo : []).filter(
        (c) => c && (c.titulo || "").toString().trim()
    );
    if (!cosas.length) {
        return false;
    }

    cuerpo.textContent = "";
    const lista = document.createElement("ul");
    lista.className = "ando-escritos";

    cosas.forEach((cosa) => {
        const fila = document.createElement("li");
        fila.className = "ando-escrito";
        fila.appendChild(tituloDeAndo(cosa));

        // El tipo y por dónde va, en la misma línea de debajo. Los
        // separadores los pone el CSS, así que aquí solo se pegan trozos.
        const pie = document.createElement("span");
        pie.className = "ando-escrito-pie";
        [(cosa.tipo || "").toString().trim(), (cosa.estado || "").toString().trim()]
            .filter(Boolean)
            .forEach((texto) => {
                const trozo = document.createElement("span");
                trozo.className = "ando-trozo";
                trozo.textContent = texto;
                pie.appendChild(trozo);
            });
        if (pie.childNodes.length) {
            fila.appendChild(pie);
        }

        const nota = (cosa.nota || "").toString().trim();
        if (nota) {
            const linea = document.createElement("p");
            linea.className = "ando-cosa-nota";
            linea.textContent = nota;
            fila.appendChild(linea);
        }
        lista.appendChild(fila);
    });

    cuerpo.appendChild(lista);
    caja.hidden = false;
    return true;
}


// =========================================
// LOS PENDIENTES, EN UN POST-IT
// =========================================
// El mismo post-it que el de las notas de una partida: los estilos están
// en estilos/componentes/postit.css y las casillas las monta
// scripts/componentes/tareas.js. Aquí solo se escribe la lista y se avisa
// de que ya está puesta, porque ese script se ejecutó mucho antes de que
// llegara este JSON.
//
// Lo que se marque se guarda en el navegador de quien lo marque y no
// cambia el archivo: el porqué está explicado en tareas.js.

function pintarPendientes(datos) {
    const caja = document.querySelector("[data-ando-pendientes]");
    const cuerpo = document.querySelector("[data-ando-pendientes-cuerpo]");
    if (!caja || !cuerpo) {
        return false;
    }
    const cosas = (Array.isArray(datos.pendientes) ? datos.pendientes : []).filter(
        (c) => c && (c.cosa || "").toString().trim()
    );
    if (!cosas.length) {
        return false;
    }

    cuerpo.textContent = "";
    const lista = document.createElement("ul");
    lista.className = "cuaderno-tareas";
    cosas.forEach((cosa) => {
        const li = document.createElement("li");
        if (cosa.hecho) {
            li.className = "hecho";
        }
        li.textContent = cosa.cosa.toString().trim();
        lista.appendChild(li);
    });
    cuerpo.appendChild(lista);
    caja.hidden = false;

    // Y que tareas.js le ponga las casillas y la cuenta de "x de y
    // hechas": cuando se ejecutó, esta lista todavía no existía.
    document.dispatchEvent(new CustomEvent("tareas:actualizar"));
    return true;
}


// =========================================
// PIEZAS SUELTAS
// =========================================

function datoDeAndo(nombre, valor, claseExtra) {
    const bloque = document.createElement("div");
    bloque.className = "ando-cosa";
    const dt = document.createElement("dt");
    dt.className = "ando-cosa-que";
    dt.textContent = nombre;
    bloque.appendChild(dt);
    const dd = document.createElement("dd");
    dd.className = "ando-cosa-valor" + (claseExtra ? " " + claseExtra : "");
    dd.appendChild(valor);
    bloque.appendChild(dd);
    return bloque;
}

function textoAndo(cadena) {
    return document.createTextNode(cadena);
}

// Mismo criterio que en el resto del sitio: el JSON lo escribes tú, pero
// de ahí salen direcciones que acaban en un href, y una que empiece por
// "javascript:" es código que se ejecuta al pulsar. Así que no se copia lo
// que ponga: se comprueba que sea una dirección de las que valen, y si no,
// no se pone. Una dirección de ESTA web (que empiece por "/" pero no por
// "//", que sería otra web), una http(s) entera, un correo o un ancla.
function rutaSeguraAndo(url) {
    const limpia = (url || "").toString().trim();
    if (/^\/(?!\/)/.test(limpia) || /^(https?:\/\/|mailto:|#)/i.test(limpia)) {
        return limpia;
    }
    return "#";
}
