// =========================================
// LAS NOTAS DE UNA PARTIDA — escenas, hojas y pie
// =========================================
// Esto solo corre en las páginas de notas de rol (las que tienen un
// .cuaderno dentro). Hace cuatro cosas, y ninguna es imprescindible: la
// página ya funciona sin JavaScript, con las escenas plegándose solas
// —eso lo hace el navegador, porque son <details>— y las casillas de las
// cosas pendientes dibujadas según lo que ponga el archivo.
//
//   1. El botón de plegar o desplegar todas las escenas de golpe.
//   2. Pasar de hoja, con su giro de página.
//   3. Abrir todas las escenas antes de imprimir y dejarlas después como
//      estaban.
//   4. El botón del PDF y los saltos a la sesión de al lado, debajo del
//      post-it.
//   5. La gente del texto: su token al pasar el ratón y su ficha al
//      pulsar el nombre.
//
// LAS CASILLAS DE LAS COSAS PENDIENTES NO ESTÁN AQUÍ: las monta
// scripts/componentes/tareas.js. Se sacaron a un componente el día que
// la página de "en lo que ando" quiso el mismo post-it, que es cuando
// una cosa deja de ser "de las notas de rol" y pasa a ser del sitio.

// Lo que mide una hoja como mínimo: lo mismo que el flex-basis de
// .cuaderno-hoja en notas-rol.css. Si se cambia allí, se cambia aquí.
//
// Va aquí arriba, con los demás, y no al lado de la función que lo usa,
// porque initializeCuaderno() se llama unas líneas más abajo y un const
// declarado DESPUÉS de esa llamada no existe todavía cuando se ejecuta:
// el script se caía entero con "Cannot access ... before initialization"
// y la página se quedaba sin plegar escenas, sin marcar tareas y sin
// pasar página. Medido, no supuesto.
const CUADERNO_HOJA_MINIMA_REM = 22;

// Qué sesiones están publicadas de verdad. Lo mismo que lee el índice de
// la campaña: una sesión creada pero todavía en borrador no está aquí, y
// por tanto no se enlaza desde la de al lado.
const CUADERNO_LISTADO_URL = "/datos/notas_rol/notas-rol.json";

initializeCuaderno();

function initializeCuaderno() {
    const cuaderno = document.querySelector(".cuaderno");
    if (!cuaderno) {
        return;
    }
    const sePliega = elNavegadorSabePlegar();
    if (!sePliega) {
        // Sin <details> las escenas se quedan todas abiertas, que es lo
        // que hace el navegador por su cuenta. Esto solo le dice al CSS
        // que quite las flechas, que ahí mentirían.
        document.documentElement.setAttribute("data-sin-plegar", "");
    } else {
        montarPlegarTodo(cuaderno);
        prepararImpresionCuaderno();
    }
    nombrarHojas(cuaderno);
    montarPasarPagina(cuaderno);
    // Esto va a buscar dos JSON, así que no se espera: el cuaderno ya
    // está montado y el pie aparece cuando lleguen. Si no llegan, el
    // hueco se queda vacío y el CSS lo quita de en medio.
    montarPieDeNotas();
    // Lo mismo: va a por el JSON de los NPC y, si no llega, los nombres
    // se quedan como estaban, en negrita y sin más.
    montarTokensDeNpcs(cuaderno);
}

// El nombre de cada hoja para quien no la ve. Se saca del número que hay
// escrito en su esquina, que es lo único que hay que cambiar al copiar
// una hoja: así no se puede quedar la hoja 3 diciendo que es la 1.
// Si no hay número, se usa el sitio que ocupa.
function nombrarHojas(cuaderno) {
    const hojas = [...cuaderno.querySelectorAll(".cuaderno-hoja")];
    hojas.forEach((hoja, i) => {
        const cuerpo = hoja.querySelector(".cuaderno-hoja-cuerpo");
        if (!cuerpo) {
            return;
        }
        const marca = hoja.querySelector(".cuaderno-hoja-numero");
        const numero = (marca && marca.textContent.trim()) || String(i + 1);
        cuerpo.setAttribute("aria-label", "Hoja " + numero + ", con scroll");
    });
}


// =========================================
// PASAR PÁGINA
// =========================================
// Un cuaderno abierto enseña dos hojas y no veinte. Así que en pantalla
// se deja solo la cara que toca —dos hojas enfrentadas si caben, una si
// no— y debajo salen los botones para ir pasando. Sin salir de la
// página: esto no son enlaces, no se recarga nada.
//
// QUIÉN DECIDE CUÁNTAS HOJAS CABEN
// --------------------------------
// Se mide. La cuenta es la misma que hace el CSS (una hoja pide 26rem),
// y se mide en vez de ponerla en una media query porque el ancho que
// tiene el cuaderno no depende solo del tamaño de la ventana: depende
// también del mando de tamaño del texto, que ensancha la barra lateral y
// agranda el propio rem. Una media query en píxeles no se entera de eso.
//
// Lo que sí vive en el CSS es SI se pasa página o no (--paginar), porque
// eso es un corte de pantalla como los demás: en el móvil no se pasa
// página, se baja con el dedo.

function montarPasarPagina(cuaderno) {
    const hojas = [...cuaderno.children].filter((h) =>
        h.classList.contains("cuaderno-hoja")
    );
    if (hojas.length < 2) {
        return;
    }
    const columna = cuaderno.closest(".cuaderno-columna");
    if (!columna) {
        return;
    }

    // Un <div role="group"> y NO un <nav>, por dos razones. La de fondo:
    // esto no lleva a ninguna parte, son dos botones que cambian lo que
    // se ve; <nav> es para la navegación del sitio. Y la práctica: en
    // estilos/componentes/barra-lateral.css hay una regla para "nav" a
    // secas —sin clase delante— que pone flex en columna, y esa hoja se
    // carga DESPUÉS que la de estas páginas, así que gana. Los tres
    // botones salían uno debajo de otro. (Esa regla es del menú lateral;
    // atarla a .sidebar arreglaría el despiste de raíz, pero el índice
    // de apartados de las entradas también es un <nav> y se apoya en
    // ella sin saberlo, así que se queda para otro día.)
    const barra = document.createElement("div");
    barra.className = "cuaderno-paginacion";
    barra.setAttribute("role", "group");
    barra.setAttribute("aria-label", "Pasar página del cuaderno");

    const atras = botonDePagina("hoja anterior", "hacia-atras", true);
    const cuenta = document.createElement("p");
    cuenta.className = "cuaderno-paginacion-cuenta";
    cuenta.setAttribute("role", "status");
    const adelante = botonDePagina("hoja siguiente", "hacia-delante", false);

    barra.appendChild(atras);
    barra.appendChild(cuenta);
    barra.appendChild(adelante);
    columna.appendChild(barra);

    let cara = 0;

    function porCara() {
        // El CSS manda sobre si se pasa página; 0 = no se pasa.
        const estilo = getComputedStyle(cuaderno);
        if (estilo.getPropertyValue("--paginar").trim() === "0") {
            return 0;
        }
        const hueco = parseFloat(estilo.columnGap) || 0;
        const rem =
            parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        const minima = CUADERNO_HOJA_MINIMA_REM * rem;
        return cuaderno.clientWidth >= minima * 2 + hueco ? 2 : 1;
    }

    function repartir() {
        const cuantas = porCara();

        if (!cuantas) {
            // Modo móvil: todas a la vista y los botones fuera.
            cuaderno.classList.remove("is-paginado");
            hojas.forEach((h) => {
                h.hidden = false;
            });
            barra.hidden = true;
            return;
        }

        const caras = Math.ceil(hojas.length / cuantas);
        if (caras < 2) {
            // Caben todas de una vez: el cuaderno se queda abierto y los
            // botones no pintan nada.
            cuaderno.classList.add("is-paginado");
            hojas.forEach((h) => {
                h.hidden = false;
            });
            barra.hidden = true;
            return;
        }

        cara = Math.min(cara, caras - 1);
        cuaderno.classList.add("is-paginado");
        barra.hidden = false;

        const desde = cara * cuantas;
        const hasta = Math.min(desde + cuantas, hojas.length);
        hojas.forEach((hoja, i) => {
            // hidden y no una clase: así la hoja que no está en pantalla
            // tampoco está en el tabulador ni para un lector de pantalla.
            hoja.hidden = i < desde || i >= hasta;
        });

        atras.disabled = cara === 0;
        adelante.disabled = cara >= caras - 1;
        cuenta.textContent =
            hasta - desde === 1
                ? `hoja ${desde + 1} de ${hojas.length}`
                : `hojas ${desde + 1} y ${hasta} de ${hojas.length}`;
    }

    // EL PASO DE HOJA, VISTO
    // ----------------------
    // Primero se cambia la hoja y DESPUÉS se anima la que ha quedado en
    // pantalla. En ese orden a propósito: si la animación no llega a
    // ocurrir —porque está puesto "movimiento: quieto", porque el equipo
    // pide menos movimiento, o porque el navegador no quiere— la hoja ya
    // está donde tiene que estar y no se pierde nada. Lo contrario
    // (animar y cambiar al terminar) deja la página colgada el día que la
    // animación no se dispara.
    let reloj = 0;

    function quitarGiro(hoja) {
        hoja.classList.remove("bisagra-izquierda", "bisagra-derecha");
    }

    function animarPaso(visibles, sentido) {
        // Fuera lo de la vez anterior y un respiro para que el navegador
        // se entere de que la animación empieza de cero: sin esto, pasando
        // hojas a toda prisa, la segunda no se movía (para el navegador era
        // la misma animación que ya estaba puesta).
        cuaderno.classList.remove("is-pasando");
        visibles.forEach(quitarGiro);
        void cuaderno.offsetWidth;

        cuaderno.classList.add("is-pasando");
        visibles.forEach((hoja, i) => {
            if (visibles.length > 1) {
                // Cuaderno abierto: cada hoja se abre desde el centro, o
                // sea desde el lomo, como un libro.
                hoja.classList.add(i === 0 ? "bisagra-derecha" : "bisagra-izquierda");
            } else {
                // Una sola: la bisagra va del lado por el que viene.
                hoja.classList.add(sentido > 0 ? "bisagra-izquierda" : "bisagra-derecha");
            }
        });

        // Se limpia con el reloj y no esperando a que la animación avise:
        // con "movimiento: quieto" la animación dura un milisegundo y con
        // prefers-reduced-motion no hay animación ninguna, y en ese caso
        // el aviso no llega nunca. El medio segundo es más de lo que dura
        // (0,34s en el CSS); si se cambia allí, que siga siendo menos que
        // esto.
        clearTimeout(reloj);
        reloj = setTimeout(() => {
            cuaderno.classList.remove("is-pasando");
            visibles.forEach(quitarGiro);
        }, 500);
    }

    function mover(cuanto) {
        cara += cuanto;
        repartir();
        const visibles = hojas.filter((h) => !h.hidden);
        // Lo que se acaba de enseñar, desde arriba: una hoja nueva
        // empieza por el principio, no por donde se quedó la anterior.
        visibles.forEach((h) => {
            const cuerpo = h.querySelector(".cuaderno-hoja-cuerpo");
            if (cuerpo) {
                cuerpo.scrollTop = 0;
            }
        });
        animarPaso(visibles, cuanto);
    }

    atras.addEventListener("click", () => mover(-1));
    adelante.addEventListener("click", () => mover(1));

    repartir();

    // Al cambiar el tamaño de la ventana cambia cuántas hojas caben; y al
    // tocar el tamaño del texto o la letra, también (cambia el rem y el
    // ancho de la barra lateral). Lo segundo lo avisa la ventana de
    // accesibilidad con "ajustes:actualizar".
    let espera = 0;
    const volverAMirar = () => {
        clearTimeout(espera);
        espera = setTimeout(repartir, 120);
    };
    window.addEventListener("resize", volverAMirar);
    document.addEventListener("ajustes:actualizar", volverAMirar);
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(repartir).catch(() => {});
    }

    // Y en papel, todas. Lo demás lo hace el CSS de impresión, pero el
    // atributo hidden no lo puede quitar una hoja de estilo sin pelearse
    // con el navegador, así que se quita aquí.
    window.addEventListener("beforeprint", () => {
        hojas.forEach((h) => {
            h.hidden = false;
        });
    });
    window.addEventListener("afterprint", repartir);
}

function botonDePagina(nombre, sentido, flechaDelante) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "cuaderno-paginacion-boton";

    const flecha = document.createElement("span");
    flecha.className = "cuaderno-paginacion-flecha " + sentido;
    flecha.setAttribute("aria-hidden", "true");

    const texto = document.createElement("span");
    texto.textContent = nombre;

    if (flechaDelante) {
        boton.appendChild(flecha);
        boton.appendChild(texto);
    } else {
        boton.appendChild(texto);
        boton.appendChild(flecha);
    }
    return boton;
}


// =========================================
// EL PIE DE LA NOTA: EL PDF Y LA SESIÓN DE AL LADO
// =========================================
// Debajo del post-it van dos cosas, y las dos salen del JSON de la
// campaña (datos/notas_rol/campana-<clave>.json), que es donde ya vive la lista de
// sesiones:
//
//   · el PDF de las notas escaneadas, si esa sesión tiene uno apuntado
//     en su "pdf";
//   · el salto a la sesión anterior y a la siguiente.
//
// POR QUÉ DESDE EL JSON Y NO ESCRITO EN LA PÁGINA
// -----------------------------------------------
// Porque los saltos son lo primero que se queda viejo. Escritos a mano,
// al crear la sesión 3 habría que volver a abrir la 2 para ponerle su
// "siguiente", y eso se olvida a la segunda vez. Leyéndolos de la lista
// de sesiones, la 2 estrena su "siguiente" sola en cuanto la 3 se
// publica, y el día que se borre una sesión no se queda un enlace roto
// apuntando a ella.
//
// Y si esto no corre no se pierde nada que no esté a un enlace de aquí:
// el índice de la campaña está arriba, en "volver a la campaña", con
// todas las sesiones.

async function montarPieDeNotas() {
    const pie = document.querySelector("[data-cuaderno-pie]");
    if (!pie) {
        return;
    }
    const fuente = (pie.getAttribute("data-campana-datos") || "").trim();
    if (!fuente || typeof window.pedirDatos !== "function") {
        return;
    }

    let campana = null;
    let publicadas = [];
    try {
        const respuesta = await window.pedirDatos(fuente);
        if (!respuesta.ok) {
            throw new Error("La respuesta no fue correcta");
        }
        campana = await respuesta.json();
        const listado = await window.pedirDatos(CUADERNO_LISTADO_URL);
        if (listado.ok) {
            const items = await listado.json();
            publicadas = Array.isArray(items) ? items : [];
        }
    } catch (error) {
        // Sin datos no se inventa nada: el hueco se queda vacío.
        return;
    }

    const sesiones = (Array.isArray(campana.sesiones) ? campana.sesiones : [])
        .filter((s) => s && s.url)
        .sort((a, b) => (Number(a.numero) || 0) - (Number(b.numero) || 0));

    const aqui = sinExtensionCuaderno(window.location.pathname);
    const donde = sesiones.findIndex(
        (s) => sinExtensionCuaderno(s.url) === aqui
    );
    if (donde === -1) {
        // Estas notas no están en la lista de su campaña (recién creadas a
        // mano, o movidas de sitio). Mejor no enseñar nada que enseñar un
        // "siguiente" que no es el siguiente.
        return;
    }

    // Lo que se lee en el enlace: el título de la página publicada, que es
    // el bueno (si se cambió al pasar las notas a limpio, aquí se ve el
    // cambio sin tocar el JSON). Si no está publicada, no se enlaza.
    const porUrl = {};
    publicadas.forEach((item) => {
        porUrl[sinExtensionCuaderno(item && item.url)] = item;
    });

    const vecina = (paso) => {
        for (let i = donde + paso; i >= 0 && i < sesiones.length; i += paso) {
            const suya = porUrl[sinExtensionCuaderno(sesiones[i].url)];
            if (suya) {
                return { sesion: sesiones[i], publicada: suya };
            }
        }
        return null;
    };

    const anterior = vecina(-1);
    const siguiente = vecina(1);
    const pdf = (sesiones[donde].pdf || "").toString().trim();

    if (pdf && /^https?:\/\//i.test(pdf)) {
        pie.appendChild(botonDePdf(pdf));
    }

    // El reparto de la campaña, si lo tiene. Desde unas notas es
    // justo lo que apetece mirar ("¿quién era Rukkus?"), y así no hay
    // que pasar por el índice de la campaña para llegar.
    const reparto = (campana.npcs || "").toString().trim();
    if (reparto && /^\//.test(reparto)) {
        pie.appendChild(botonDeReparto(reparto));
    }
    if (anterior || siguiente) {
        pie.appendChild(navDeSaltos(anterior, siguiente));
    }
}

// El servidor puede entregar la página con o sin ".html", así que las
// direcciones se comparan sin extensión. (Mismo criterio que en
// scripts/paginas/notas-rol.js; va con otro nombre porque todos los
// scripts comparten el mismo ámbito global —se comprueba con
// herramientas/4-comprobar/nombres-repetidos.py—.)
function sinExtensionCuaderno(ruta) {
    return (ruta || "").toString().trim().replace(/\.html$/, "").replace(/\/+$/, "");
}

function botonDePdf(url) {
    const enlace = document.createElement("a");
    enlace.className = "cuaderno-pdf";
    // Comprobada otra vez aquí, aunque quien llama ya mire que empiece
    // por http: la comprobación tiene que estar donde se USA la
    // dirección, que es lo que sigue siendo verdad el día que a esta
    // función la llame otro sitio.
    enlace.href = rutaSeguraCuaderno(url);
    // En otra pestaña porque es un archivo de fuera (Drive) y volver
    // atrás desde un visor de PDF no siempre devuelve a la página. Que
    // se abre en otra pestaña lo avisa solo
    // scripts/componentes/enlaces-fuera.js, que también le pone la
    // flechita de "esto sale de la web".
    enlace.target = "_blank";
    enlace.rel = "noopener";

    const flecha = document.createElement("span");
    flecha.className = "cuaderno-pdf-flecha";
    flecha.setAttribute("aria-hidden", "true");
    flecha.textContent = "↓";
    enlace.appendChild(flecha);

    const texto = document.createElement("span");
    texto.textContent = "descargar las notas en PDF";
    enlace.appendChild(texto);
    return enlace;
}

function botonDeReparto(url) {
    const enlace = document.createElement("a");
    // Misma pinta que el botón del PDF: son los dos enlaces del pie y
    // uno al lado del otro tienen que verse como lo mismo.
    enlace.className = "cuaderno-pdf";
    enlace.href = url;

    const flecha = document.createElement("span");
    flecha.className = "cuaderno-pdf-flecha";
    flecha.setAttribute("aria-hidden", "true");
    flecha.textContent = "→";
    enlace.appendChild(flecha);

    const texto = document.createElement("span");
    texto.textContent = "npcs";
    enlace.appendChild(texto);
    return enlace;
}

function navDeSaltos(anterior, siguiente) {
    // Un <nav> de verdad: esto lleva a otras páginas. (Al revés que los
    // botones de pasar hoja, que no llevan a ninguna parte y por eso son
    // un div con role="group".) Lleva clase propia para no quedarse a lo
    // que diga la regla de "nav" a secas de barra-lateral.css.
    const nav = document.createElement("nav");
    nav.className = "cuaderno-saltos";
    nav.setAttribute("aria-label", "Otras sesiones de la campaña");

    if (anterior) {
        nav.appendChild(unSalto(anterior, "anterior"));
    }
    if (siguiente) {
        nav.appendChild(unSalto(siguiente, "siguiente"));
    }
    return nav;
}

function unSalto(cual, sentido) {
    const sesion = cual.sesion;
    const publicada = cual.publicada;

    const enlace = document.createElement("a");
    enlace.className = "cuaderno-salto";
    enlace.href = rutaSeguraCuaderno(sesion.url);
    // rel="prev"/"next" para quien lee la página con un navegador o una
    // extensión que sepa saltar de una a otra con el teclado.
    enlace.rel = sentido === "anterior" ? "prev" : "next";

    const flecha = document.createElement("span");
    flecha.className = "cuaderno-salto-flecha";
    flecha.setAttribute("aria-hidden", "true");
    flecha.textContent = sentido === "anterior" ? "←" : "→";
    enlace.appendChild(flecha);

    const texto = document.createElement("span");
    texto.className = "cuaderno-salto-texto";

    const etiqueta = document.createElement("span");
    etiqueta.className = "cuaderno-salto-cual";
    etiqueta.textContent = "sesión " + sentido;
    texto.appendChild(etiqueta);

    const nombre = document.createElement("span");
    nombre.className = "cuaderno-salto-nombre";
    nombre.textContent = nombreDeSesion(sesion, publicada);
    texto.appendChild(nombre);

    enlace.appendChild(texto);
    return enlace;
}

// Las direcciones que salen del JSON de la campaña acaban en un href, y
// una que empezara por "javascript:" sería código que se ejecuta al
// pulsar. Se comprueba cómo empieza. El PDF y el reparto ya se miraban
// cada uno por su lado; esto es lo mismo para los saltos.
function rutaSeguraCuaderno(url) {
    const limpia = (url || "").toString().trim();
    // Una dirección de ESTA web (que empiece por "/" pero no por "//",
    // que sería otra) o una http(s) entera. Lo demás no se pone.
    if (/^\/(?!\/)/.test(limpia) || /^https?:\/\//i.test(limpia)) {
        return limpia;
    }
    return "#";
}

function nombreDeSesion(sesion, publicada) {
    const puesto = ((publicada && publicada.title) || "").toString().trim();
    if (puesto) {
        return puesto;
    }
    const numero = Number(sesion.numero) || 0;
    const corto = (sesion.titulo || "").toString().trim();
    return "Sesión " + numero + (corto ? " — " + corto : "");
}


// =========================================
// ¿SABE EL NAVEGADOR PLEGAR UN <details>?
// =========================================
// Se comprueba de verdad, midiendo, y no preguntando si existe la
// propiedad "open": un navegador que no entiende <details> lo trata como
// un <div> cualquiera, y a un <div> también se le puede poner una
// propiedad llamada "open" sin que eso signifique nada.
//
// Esta comprobación existe por algo que pasó de verdad en esta web: la
// ventana de accesibilidad se hizo con <dialog> dando por hecho que
// estaba, y en el navegador de Richi salía dibujada en medio de la
// página desde que cargaba, detrás del contenido. Tres rondas de
// capturas hasta dar con ello. Medir cuesta diez líneas.
function elNavegadorSabePlegar() {
    try {
        const prueba = document.createElement("details");
        if (!("open" in prueba)) {
            return false;
        }
        prueba.innerHTML = "<summary>a</summary>b";
        prueba.style.cssText =
            "position:absolute;left:-9999px;top:0;visibility:hidden";
        document.body.appendChild(prueba);
        const plegado = prueba.offsetHeight;
        prueba.open = true;
        const abierto = prueba.offsetHeight;
        prueba.remove();
        // Si plegarlo y abrirlo miden lo mismo, es que no lo pliega.
        return abierto > plegado;
    } catch (error) {
        return false;
    }
}


// =========================================
// PLEGARLAS TODAS DE GOLPE
// =========================================

function montarPlegarTodo(cuaderno) {
    const escenas = [...cuaderno.querySelectorAll(".cuaderno-escena")];
    // Con una sola escena el botón sobra: ya está su propio nombre al
    // lado, que hace lo mismo.
    if (escenas.length < 2) {
        return;
    }
    // Va en la barra de arriba, que no se desplaza: así está siempre a
    // mano aunque las notas sean largas. Si esa barra no estuviera (unas
    // notas escritas a mano sin cabecera), no se monta y ya está: las
    // escenas se siguen plegando una a una.
    const barra = document.querySelector(".cuaderno-post-header-meta");
    if (!barra) {
        return;
    }

    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "cuaderno-plegar-todo";
    // aria-pressed y no un texto suelto: así un lector de pantalla dice
    // si está pulsado o no, que es la mitad de lo que hace falta saber.
    boton.setAttribute("aria-pressed", "false");

    const flecha = document.createElement("span");
    flecha.className = "cuaderno-plegar-todo-flecha";
    flecha.setAttribute("aria-hidden", "true");
    boton.appendChild(flecha);

    const nombre = document.createElement("span");
    boton.appendChild(nombre);

    const ponerNombre = () => {
        const plegadas = escenas.every((escena) => !escena.open);
        boton.setAttribute("aria-pressed", plegadas ? "true" : "false");
        nombre.textContent = plegadas
            ? "desplegar las escenas"
            : "plegar las escenas";
    };

    boton.addEventListener("click", () => {
        const plegarlas = escenas.some((escena) => escena.open);
        escenas.forEach((escena) => {
            escena.open = !plegarlas;
        });
        ponerNombre();
    });

    // Si se pliega una a mano, el botón tiene que enterarse: con todas
    // cerradas a mano, el botón seguía diciendo "plegar" y al pulsarlo no
    // pasaba nada aparente.
    escenas.forEach((escena) => {
        escena.addEventListener("toggle", ponerNombre);
    });

    ponerNombre();
    // Delante del botón de volver, que es el que tiene que quedar el
    // último: es la salida, y la salida va al final.
    const volver = barra.querySelector(".cuaderno-post-back");
    barra.insertBefore(boton, volver || null);
}


// =========================================
// EN PAPEL, TODAS ABIERTAS
// =========================================
// Una escena plegada en pantalla no se imprime, y en papel no hay forma
// de desplegarla. Así que antes de imprimir se abren todas y después se
// dejan como estaban, sin que se note.
function prepararImpresionCuaderno() {
    let cerradas = [];

    const antes = () => {
        cerradas = [...document.querySelectorAll(".cuaderno-escena")].filter(
            (escena) => !escena.open
        );
        cerradas.forEach((escena) => {
            escena.open = true;
        });
    };
    const despues = () => {
        cerradas.forEach((escena) => {
            escena.open = false;
        });
        cerradas = [];
    };

    window.addEventListener("beforeprint", antes);
    window.addEventListener("afterprint", despues);

    // Y por si el navegador no avisa con beforeprint: unos cuantos usan
    // esto otro, que es lo mismo contado de otra manera.
    if (typeof window.matchMedia === "function") {
        const papel = window.matchMedia("print");
        const cambio = (evento) => (evento.matches ? antes() : despues());
        if (typeof papel.addEventListener === "function") {
            papel.addEventListener("change", cambio);
        }
    }
}


// =========================================
// LA GENTE DE LAS NOTAS: SU CARA Y SU FICHA
// =========================================
// En las notas, la gente va en <strong>: los de la mesa con su pj-color y
// los NPC a secas. Cada nombre que sea alguien de verdad hace dos cosas:
//
//   · Al pasar el ratón (o llegar con el tabulador) sale un globo con su
//     token —el redondel con marco amarillo de la página de npcs—, su
//     nombre y lo que es. Para ponerle cara a alguien que salió hace tres
//     partidas.
//   · Al pulsarlo se abre SU FICHA en una ventana, la misma que en la
//     página de npcs (un NPC) o en el índice de la campaña (uno de la
//     mesa). Las fichas no se dibujan aquí: las dibujan abrirFichaNpc()
//     de npcs-rol.js y abrirLaFichaDeUnPj() de notas-rol.js, que esta
//     página carga para eso (ver actualizar-cabeceras.py).
//
// QUIÉN ES QUIÉN lo dicen los JSON: datos/notas_rol/npcs-<clave>.json para
// los NPC y "personajes" del de la campaña para la mesa. Un <strong> que
// no sea nadie de esas listas (un caballo, algo que se quiso resaltar) se
// queda como estaba: no se adivina nada. Se compara sin tildes ni
// mayúsculas, y también vale el nombre de pila suelto («Brandr» por
// «Brandr Vindahl») si nadie más empieza igual. Si en las notas está
// escrito distinto que en el JSON, no casa: se arregla escribiéndolo igual.
//
// EL NOMBRE PASA A SER UN BOTÓN, metido dentro del <strong> (que conserva
// su color y su negrita). Es un botón y no un enlace porque no se cambia
// de página: se abre una ventana encima, y aria-haspopup="dialog" lo
// dice. Como hace algo, tiene que poder hacerse con el teclado: por eso
// entra en el tabulador, y el globo sale también al llegar con él.
//
// El globo va con aria-hidden: la cara es un añadido, y lo que dice
// (nombre y qué es) se oye entero en el nombre del botón. Cumple lo de un
// contenido que sale al pasar el ratón (WCAG 1.4.13): se puede pasar el
// ratón por encima del globo sin que se vaya, y Escape lo cierra.
//
// position: fixed y no absolute: en esta web el que hace scroll no
// siempre es la ventana (base.css le da overflow a las <section>), así que
// unas coordenadas de página se descolocaban. Fijo a la pantalla, y en
// cuanto algo se desplaza el globo se va.

async function montarTokensDeNpcs(cuaderno) {
    const articulo = cuaderno.closest("[data-campana]") || document.querySelector("[data-campana]");
    const clave = ((articulo && articulo.getAttribute("data-campana")) || "").trim();
    // Solo letras, números, guion y guion bajo: esto acaba en una
    // dirección y no tiene por qué llevar otra cosa.
    if (!/^[a-z0-9_-]+$/i.test(clave) || typeof window.pedirDatos !== "function") {
        return;
    }
    const pedir = async (url) => {
        try {
            const respuesta = await window.pedirDatos(url);
            return respuesta.ok ? await respuesta.json() : null;
        } catch (error) {
            return null;
        }
    };
    const [reparto, campana] = await Promise.all([
        pedir("/datos/notas_rol/npcs-" + clave + ".json"),
        pedir("/datos/notas_rol/campana-" + clave + ".json"),
    ]);

    // Los NPC, con las sesiones de la campaña pegadas: así su ficha puede
    // enlazar la sesión en la que apareció, igual que en la página de npcs.
    const datosNpc = reparto && typeof reparto === "object" ? reparto : {};
    if (campana && Array.isArray(campana.sesiones)) {
        datosNpc.sesiones = campana.sesiones;
    }
    const npcs = Array.isArray(datosNpc.personajes) ? datosNpc.personajes : [];
    // La mesa, ya repasada por personajesDe() de notas-rol.js: la misma
    // lectura que usa el índice de la campaña para sus fichas.
    const mesa = campana && typeof personajesDe === "function"
        ? personajesDe(campana.personajes) : [];

    const npcQueSea = buscadorDeNpcs(npcs);
    const pjQueSea = buscadorDeNpcs(mesa);
    const puedeAbrir = window.ventanaModal && typeof window.ventanaModal.abrir === "function";

    let globo = null;
    let esconderLuego = null;
    // El botón cuya ficha se acaba de abrir. Al cerrarla, la ventana le
    // devuelve el foco y el ratón sigue encima (el navegador vuelve a avisar
    // de que ha entrado); ninguna de las dos cosas es alguien pidiendo el
    // globo. Medido: salía otra vez y tapaba el nombre de la línea de abajo.
    // Se queda callado hasta que el ratón sale del nombre o el foco se va.
    let vueltaDeFicha = null;
    const hayFichaAbierta = () => !!document.querySelector('[role="dialog"]:not([hidden])');

    const esconder = () => {
        clearTimeout(esconderLuego);
        if (globo) {
            globo.hidden = true;
        }
        document.querySelectorAll(".cuaderno-npc.esta-mirandose").forEach((uno) =>
            uno.classList.remove("esta-mirandose"));
    };
    const esconderEnUnRato = () => {
        clearTimeout(esconderLuego);
        // Un poco de margen para poder llevar el ratón del nombre al globo
        // sin que se cierre por el camino.
        esconderLuego = setTimeout(esconder, 180);
    };
    const ensenar = (nombre, cara) => {
        if (!globo) {
            globo = globoDeNpc();
            globo.addEventListener("mouseenter", () => clearTimeout(esconderLuego));
            globo.addEventListener("mouseleave", esconderEnUnRato);
        }
        esconder();
        rellenarGloboDeNpc(globo, cara);
        nombre.classList.add("esta-mirandose");
        globo.hidden = false;
        colocarGloboDeNpc(globo, nombre);
    };

    cuaderno.querySelectorAll("strong").forEach((nombre) => {
        const deLaMesa = [...nombre.classList].some((clase) => clase.indexOf("pj-") === 0);
        const quien = deLaMesa ? pjQueSea(nombre.textContent) : npcQueSea(nombre.textContent);
        if (!quien) {
            return;
        }
        // Lo que sale en el globo: la mesa trae su línea de qué es ya
        // montada ("Elfo Druida nivel 3 · lo lleva Richi").
        const cara = {
            nombre: quien.nombre,
            token: quien.token,
            que: deLaMesa ? quien.extra : quien.que,
        };
        nombre.classList.add("cuaderno-npc");

        let objetivo = nombre;
        if (puedeAbrir) {
            const boton = document.createElement("button");
            boton.type = "button";
            boton.className = "cuaderno-npc-boton";
            boton.setAttribute("aria-haspopup", "dialog");
            const que = (cara.que || "").toString().trim();
            boton.setAttribute("aria-label",
                (quien.nombre || "").toString().trim() + (que ? ", " + que : "") + ". Abre su ficha");
            // El texto se MUEVE dentro del botón, no se copia: así lo que
            // se lee y se busca en la página sigue siendo lo mismo.
            while (nombre.firstChild) {
                boton.appendChild(nombre.firstChild);
            }
            nombre.appendChild(boton);
            boton.addEventListener("click", () => {
                esconder();
                vueltaDeFicha = boton;
                if (deLaMesa && typeof abrirLaFichaDeUnPj === "function") {
                    abrirLaFichaDeUnPj(quien, boton);
                } else if (!deLaMesa && typeof abrirFichaNpc === "function") {
                    abrirFichaNpc(quien, datosNpc, boton);
                }
            });
            // Solo al llegar con el teclado, y no cuando el foco vuelve de
            // cerrar su ficha: medido, el navegador cuenta esa vuelta como
            // foco de teclado (se cierra con Escape), y el globo salía otra
            // vez encima del texto y tapaba el nombre de al lado.
            boton.addEventListener("focus", () => {
                if (vueltaDeFicha !== boton && boton.matches(":focus-visible")) {
                    ensenar(nombre, cara);
                }
            });
            boton.addEventListener("blur", () => {
                // Al abrir la ficha el foco se va a la ventana: eso no
                // cuenta como irse.
                if (vueltaDeFicha === boton && !hayFichaAbierta()) {
                    vueltaDeFicha = null;
                }
                esconderEnUnRato();
            });
            objetivo = boton;
        }
        objetivo.addEventListener("mouseenter", () => {
            if (vueltaDeFicha !== objetivo) {
                ensenar(nombre, cara);
            }
        });
        objetivo.addEventListener("mouseleave", () => {
            if (vueltaDeFicha === objetivo && !hayFichaAbierta()) {
                vueltaDeFicha = null;
            }
            esconderEnUnRato();
        });
    });

    document.addEventListener("keydown", (evento) => {
        if (evento.key === "Escape" && globo && !globo.hidden) {
            esconder();
        }
    });
    // Cualquier scroll, el de la ventana o el de una <section> (por eso
    // en captura): el globo está fijo a la pantalla y se quedaría flotando
    // lejos de su nombre.
    window.addEventListener("scroll", esconder, true);
    window.addEventListener("resize", esconder);
}

// De un texto a la ficha del NPC que se llama así, o null.
function buscadorDeNpcs(gente) {
    const plano = (texto) => (texto || "").toString()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase().replace(/\s+/g, " ").trim();
    const enteros = new Map();
    const dePila = new Map();
    gente.forEach((npc) => {
        if (!npc || !(npc.nombre || "").toString().trim()) {
            return;
        }
        const entero = plano(npc.nombre);
        if (!enteros.has(entero)) {
            enteros.set(entero, npc);
        }
        const primero = entero.split(" ")[0];
        if (primero !== entero) {
            // Si dos empiezan igual, el nombre de pila no dice quién es.
            dePila.set(primero, dePila.has(primero) ? null : npc);
        }
    });
    return (texto) => {
        const buscado = plano(texto);
        if (enteros.has(buscado)) {
            return enteros.get(buscado);
        }
        return dePila.get(buscado) || null;
    };
}

function globoDeNpc() {
    const globo = document.createElement("div");
    globo.className = "cuaderno-npc-globo";
    globo.setAttribute("aria-hidden", "true");
    globo.hidden = true;

    const marco = document.createElement("span");
    marco.className = "cuaderno-npc-marco";
    globo.appendChild(marco);

    const nombre = document.createElement("span");
    nombre.className = "cuaderno-npc-nombre";
    globo.appendChild(nombre);

    const que = document.createElement("span");
    que.className = "cuaderno-npc-que";
    globo.appendChild(que);

    document.body.appendChild(globo);
    return globo;
}

function rellenarGloboDeNpc(globo, npc) {
    const marco = globo.querySelector(".cuaderno-npc-marco");
    marco.textContent = "";
    const ruta = imagenSeguraCuaderno(npc.token);
    if (ruta) {
        const img = document.createElement("img");
        img.className = "cuaderno-npc-img";
        img.src = imagenSeguraCuaderno(ruta);
        img.alt = "";
        img.decoding = "async";
        marco.appendChild(img);
    } else {
        // Sin token, su inicial, como en la página de npcs.
        const inicial = document.createElement("span");
        inicial.className = "cuaderno-npc-inicial";
        inicial.textContent = (npc.nombre || "?").toString().trim().charAt(0).toUpperCase();
        marco.appendChild(inicial);
    }
    globo.querySelector(".cuaderno-npc-nombre").textContent = (npc.nombre || "").toString().trim();
    const que = (npc.que || "").toString().trim();
    const linea = globo.querySelector(".cuaderno-npc-que");
    linea.textContent = que;
    linea.hidden = !que;
}

// Debajo del nombre y centrado con él; si no cabe debajo, encima. Y sin
// salirse de la pantalla por los lados.
function colocarGloboDeNpc(globo, nombre) {
    const sitio = nombre.getBoundingClientRect();
    const ancho = globo.offsetWidth;
    const alto = globo.offsetHeight;
    const margen = 8;
    let izquierda = sitio.left + sitio.width / 2 - ancho / 2;
    izquierda = Math.max(margen, Math.min(izquierda, window.innerWidth - ancho - margen));
    let arriba = sitio.bottom + margen;
    if (arriba + alto > window.innerHeight - margen) {
        arriba = Math.max(margen, sitio.top - alto - margen);
    }
    globo.style.left = Math.round(izquierda) + "px";
    globo.style.top = Math.round(arriba) + "px";
}

// Para el src del token: una dirección de esta web o una http(s). Un
// data: o un javascript: no se pone.
function imagenSeguraCuaderno(url) {
    const limpia = (url || "").toString().trim();
    if (/^\/(?!\/)/.test(limpia) || /^https?:\/\//i.test(limpia)) {
        return limpia;
    }
    return "";
}
