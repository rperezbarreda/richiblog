// =========================================
// PÁGINA: BUSCAR EN TODA LA WEB
// =========================================
// Lee lo que venga en ?q= de la dirección, pide datos/sitio/buscador.json
// —que escribe herramientas/3-generadores/generar-buscador.py recorriendo la web— y
// pinta los resultados: título, sección y fecha como en el mapa del
// sitio, y debajo el trozo de texto donde aparece lo que buscabas, con
// la palabra resaltada.
//
// POR QUÉ UNA PÁGINA Y NO UN FILTRO
// ---------------------------------
// El filtro que ya hay (scripts/componentes/buscador.js) esconde filas
// de una lista que YA está en la pantalla: sirve para el archivo del
// blog o para el mapa, donde todo está delante. Pero no puede encontrar
// una palabra que esté dentro de un relato, porque ese texto no está en
// esa página. Para eso hace falta un listado aparte con el texto de
// todo, y una página donde enseñarlo.
//
// POR QUÉ EL LISTADO SOLO SE PIDE AQUÍ
// ------------------------------------
// Son unos 57 KB (22 comprimidos) y van a crecer con cada entrada. Si lo
// pidiera la portada para tener la caja de búsqueda, todo el que entrara
// se bajaría los relatos enteros sin buscar nada. Así que la caja de la
// portada y la lupa del menú no cargan nada: solo mandan aquí con la
// palabra en la dirección, y es esta página la que pide el listado.
//
// LOS RESULTADOS SON UNA LISTA Y NO UNA TABLA, aunque el mapa sí lo sea.
// En el mapa cada fila son tres datos cortos y alineados, que es para lo
// que están las tablas. Aquí cada resultado lleva además un párrafo de
// texto de largo variable: metido en una celda, descuadra la rejilla y,
// escuchándolo, obliga a oír "columna 4" antes de cada trozo. Se queda
// el aspecto del mapa —la ventanita, la sección, la fecha— pero por
// dentro es una lista, que es lo que es.
//
// OJO CON LOS NOMBRES: aquí no hay módulos, todos los scripts comparten
// el mismo ámbito global. Por eso lo de aquí lleva "busq" en el nombre.
// Se comprueba con herramientas/4-comprobar/nombres-repetidos.py.

const BUSQ_DATOS = "/datos/sitio/buscador.json";

// Cuánto texto se enseña alrededor de lo encontrado. Lo justo para que
// se entienda la frase sin convertir el resultado en un muro.
const BUSQ_CONTEXTO = 90;

// Cuántos resultados se pintan de una vez. Con 26 fichas no hace falta,
// pero el día que haya 300 entradas, pintarlas todas de golpe congela el
// móvil un segundo largo. El resto sale con el botón de abajo.
const BUSQ_POR_TANDA = 20;

const BUSQ = {
    fichas: null,
    palabras: [],
    encontrados: [],
    pintados: 0,
};

initializeBuscar();

function initializeBuscar() {
    const caja = document.querySelector("[data-buscar-resultados]");
    if (!caja) {
        return;
    }
    const consulta = consultaDeLaDireccion();
    const campo = document.getElementById("q");
    if (campo) {
        campo.value = consulta;
    }
    if (!consulta) {
        // Sin nada que buscar no se pide el listado: quien llega aquí
        // desde el menú todavía no ha escrito nada.
        decirBusq("Escribe algo arriba y dale a buscar.");
        return;
    }
    document.title = `“${consulta}” · Buscar · El Blog de Richi`;
    buscarDeVerdad(consulta, caja);
}

function consultaDeLaDireccion() {
    try {
        return (new URLSearchParams(window.location.search).get("q") || "").trim();
    } catch (error) {
        return "";
    }
}

async function buscarDeVerdad(consulta, caja) {
    decirBusq("Buscando…");
    try {
        // Con cache: "no-cache" como el resto de los JSON de datos/: se
        // reescribe cada vez que publicas algo y no lleva ?v=.
        const respuesta = await window.pedirDatos(BUSQ_DATOS);
        if (!respuesta.ok) {
            throw new Error("no se pudo leer el listado");
        }
        BUSQ.fichas = await respuesta.json();
    } catch (error) {
        decirBusq(
            "No he podido cargar el listado de la búsqueda. Prueba a recargar la página."
        );
        return;
    }

    BUSQ.palabras = partirBusq(consulta);
    BUSQ.encontrados = (BUSQ.fichas || [])
        .map((ficha) => puntuarBusq(ficha, BUSQ.palabras))
        .filter((r) => r)
        .sort((a, b) => b.puntos - a.puntos);
    BUSQ.pintados = 0;

    pintarCuentaBusq(consulta);
    caja.innerHTML = "";
    if (!BUSQ.encontrados.length) {
        caja.appendChild(sinResultadosBusq(consulta));
        return;
    }
    const lista = document.createElement("ol");
    lista.className = "busq-lista";
    caja.appendChild(lista);
    pintarTandaBusq(lista, caja);
}

// =========================================
// BUSCAR
// =========================================

// Sin tildes y en minúsculas, por los dos lados: quien busca "cafe"
// tiene que encontrar "café", y quien busca "Crepúsculo" con mayúscula y
// tilde también. La "ñ" se queda como está: en español no es una n con
// un adorno, es otra letra, y buscar "ano" no debería sacar "año".
function normalizarBusq(texto) {
    return (texto || "")
        .toLowerCase()
        .replace(/ñ/g, "\u0001")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/\u0001/g, "ñ");
}

// BUSCA SOLO AL PRINCIPIO DE UNA PALABRA, no en cualquier parte. Al
// principio buscaba el trozo suelto y salían perlas: "tali" encontraba
// "metálico", "ano" encontraba "manos" y "rol" encontraba "desarrollado".
// Medido sobre el texto de la web: de las 14 coincidencias de "tali", 4
// eran "metálico".
//
// Exigiendo que empiece palabra se quedan las que sirven —"panad"
// encuentra "panadería", "sol" encuentra "solo" y "solía", que son la
// misma palabra en otra forma— y se van las que no.
//
// Se mira la letra de delante en vez de usar \b de las expresiones
// regulares: \b en JavaScript no cuenta la "ñ" como letra, así que en
// "año" se creería que empieza una palabra en la "o".
function esLetraBusq(caracter) {
    return caracter >= "a" && caracter <= "z"
        ? true
        : (caracter >= "0" && caracter <= "9") || caracter === "ñ";
}

function indiceBusq(texto, palabra, desde) {
    let i = texto.indexOf(palabra, desde || 0);
    while (i > 0 && esLetraBusq(texto.charAt(i - 1))) {
        i = texto.indexOf(palabra, i + 1);
    }
    return i;
}

function partirBusq(consulta) {
    return normalizarBusq(consulta)
        .split(/\s+/)
        .filter((p) => p.length > 0);
}

// Una ficha vale si TODAS las palabras aparecen en alguna parte de ella.
// Los puntos son para ordenar: lo que coincide en el título va antes que
// lo que coincide en mitad de un relato, porque es más probable que sea
// lo que se buscaba.
function puntuarBusq(ficha, palabras) {
    const titulo = normalizarBusq(ficha.titulo);
    const seccion = normalizarBusq(ficha.seccion);
    const categorias = normalizarBusq((ficha.categorias || []).join(" "));
    const texto = normalizarBusq(ficha.texto);

    let puntos = 0;
    let donde = null;

    for (const palabra of palabras) {
        const enTitulo = indiceBusq(titulo, palabra);
        const enCategoria = indiceBusq(categorias, palabra);
        const enSeccion = indiceBusq(seccion, palabra);
        const enTexto = indiceBusq(texto, palabra);

        if (enTitulo === -1 && enCategoria === -1 && enSeccion === -1 && enTexto === -1) {
            return null;
        }

        if (enTitulo !== -1) {
            // Más puntos todavía si el título EMPIEZA por lo buscado.
            puntos += enTitulo === 0 ? 120 : 80;
        }
        if (enCategoria !== -1) {
            puntos += 40;
        }
        if (enSeccion !== -1) {
            puntos += 15;
        }
        if (enTexto !== -1) {
            puntos += 10;
            if (donde === null) {
                donde = enTexto;
            }
        }
    }

    return {
        ficha,
        puntos,
        // Dónde empieza el trozo que se va a enseñar. Si solo coincidía
        // el título, no hay trozo que enseñar y se usa el principio.
        donde,
    };
}

// =========================================
// PINTAR
// =========================================

function pintarTandaBusq(lista, caja) {
    const hasta = Math.min(BUSQ.pintados + BUSQ_POR_TANDA, BUSQ.encontrados.length);
    for (let i = BUSQ.pintados; i < hasta; i += 1) {
        lista.appendChild(fichaBusq(BUSQ.encontrados[i]));
    }
    BUSQ.pintados = hasta;

    const viejo = caja.querySelector("[data-busq-mas]");
    if (viejo) {
        viejo.remove();
    }
    if (BUSQ.pintados < BUSQ.encontrados.length) {
        const quedan = BUSQ.encontrados.length - BUSQ.pintados;
        const mas = document.createElement("button");
        mas.type = "button";
        mas.className = "busq-mas";
        mas.setAttribute("data-busq-mas", "");
        mas.textContent = `ver ${Math.min(quedan, BUSQ_POR_TANDA)} más (quedan ${quedan})`;
        mas.addEventListener("click", () => {
            const desde = BUSQ.pintados;
            pintarTandaBusq(lista, caja);
            // El foco al primero de los nuevos: si no, al pulsar el
            // botón el foco se queda en un botón que acaba de cambiar
            // de sitio, y con lector de pantalla no te enteras de que
            // ha salido nada.
            const nuevo = lista.children[desde];
            if (nuevo) {
                const enlace = nuevo.querySelector("a");
                if (enlace) {
                    enlace.focus();
                }
            }
        });
        caja.appendChild(mas);
    }
}

function fichaBusq(resultado) {
    const ficha = resultado.ficha;
    const li = document.createElement("li");
    li.className = "busq-item";

    const cabeza = document.createElement("p");
    cabeza.className = "busq-titulo";
    const enlace = document.createElement("a");
    enlace.href = rutaSeguraBusq(ficha.url);
    enlace.appendChild(resaltarBusq(ficha.titulo));
    cabeza.appendChild(enlace);
    li.appendChild(cabeza);

    const meta = document.createElement("p");
    meta.className = "busq-meta";
    meta.appendChild(trozoBusq("busq-seccion", ficha.seccion));
    if (ficha.fecha) {
        meta.appendChild(trozoBusq("busq-fecha", fechaBusq(ficha.fecha)));
    }
    (ficha.categorias || []).forEach((categoria) => {
        meta.appendChild(trozoBusq("busq-categoria", categoria));
    });
    li.appendChild(meta);

    const trozo = trozoDelTextoBusq(ficha.texto, resultado.donde);
    if (trozo) {
        const parrafo = document.createElement("p");
        parrafo.className = "busq-trozo";
        parrafo.appendChild(resaltarBusq(trozo));
        li.appendChild(parrafo);
    }
    return li;
}

// El listado lo escribe generar-buscador.py, pero de ahí sale la
// dirección de cada resultado y acaba en un href: una que empezara por
// "javascript:" sería código que se ejecuta al pulsar. Se comprueba cómo
// empieza y, si no es una dirección de las que valen, no se pone.
// Mismo criterio que en reto.js, relatos.js, rol.js y notas-rol.js.
function rutaSeguraBusq(url) {
    const limpia = (url || "").toString().trim();
    // Una dirección de ESTA web (que empiece por "/" pero no por "//",
    // que sería otra web), una http(s) entera, un correo o un ancla. Lo
    // demás —"javascript:", "data:", "//otrositio.com"— no es una
    // dirección: es código o es irse de aquí sin que se note.
    if (/^\/(?!\/)/.test(limpia) || /^(https?:\/\/|mailto:|#)/i.test(limpia)) {
        return limpia;
    }
    return "#";
}

function trozoBusq(clase, texto) {
    const span = document.createElement("span");
    span.className = clase;
    span.appendChild(resaltarBusq(texto));
    return span;
}

// "28-09-2026" -> "28 sept 2026", como en el resto del sitio.
const BUSQ_MESES = [
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sept", "oct", "nov", "dic",
];

function fechaBusq(cruda) {
    const partes = (cruda || "").split("-");
    if (partes.length !== 3) {
        return cruda || "";
    }
    const mes = BUSQ_MESES[parseInt(partes[1], 10) - 1];
    return mes ? `${partes[0]} ${mes} ${partes[2]}` : cruda;
}

// El trozo de texto alrededor de lo encontrado, cortado por palabras
// enteras: partir una palabra por la mitad hace que se lea peor y
// encima parece un error.
function trozoDelTextoBusq(texto, donde) {
    if (!texto || donde === null || donde === undefined) {
        return "";
    }
    let desde = Math.max(0, donde - BUSQ_CONTEXTO);
    let hasta = Math.min(texto.length, donde + BUSQ_CONTEXTO);
    if (desde > 0) {
        const espacio = texto.indexOf(" ", desde);
        desde = espacio === -1 ? desde : espacio + 1;
    }
    if (hasta < texto.length) {
        const espacio = texto.lastIndexOf(" ", hasta);
        hasta = espacio === -1 ? hasta : espacio;
    }
    const trozo = texto.slice(desde, hasta).trim();
    return (desde > 0 ? "…" : "") + trozo + (hasta < texto.length ? "…" : "");
}

// Devuelve un trozo de documento con lo buscado dentro de un <mark>.
// Se monta con nodos y no pegando HTML en un innerHTML: el texto sale de
// las entradas, y pegándolo a mano cualquier cosa que alguien escriba en
// una entrada acabaría interpretándose como etiquetas.
//
// <mark> y no un <span> con otro color: <mark> significa "esto está
// resaltado porque viene a cuento", y los lectores de pantalla pueden
// anunciarlo. Y además del fondo lleva un subrayado, que un resalte que
// solo se distinga por el color se lo pierde quien no distinga ese
// color (pauta 1.4.1).
function resaltarBusq(texto) {
    const salida = document.createDocumentFragment();
    const original = texto || "";
    if (!BUSQ.palabras.length || !original) {
        salida.appendChild(document.createTextNode(original));
        return salida;
    }

    // Se busca sobre la versión sin tildes, pero se recorta la ORIGINAL:
    // así "cafe" resalta "café" con su tilde puesta. Las dos versiones
    // miden lo mismo porque normalizarBusq() solo quita los acentos, no
    // junta ni parte letras.
    const plano = normalizarBusq(original);
    const marcas = [];
    BUSQ.palabras.forEach((palabra) => {
        let desde = 0;
        for (;;) {
            const i = indiceBusq(plano, palabra, desde);
            if (i === -1) {
                break;
            }
            marcas.push([i, i + palabra.length]);
            desde = i + palabra.length;
        }
    });
    if (!marcas.length) {
        salida.appendChild(document.createTextNode(original));
        return salida;
    }

    // Se juntan las que se pisan: buscando "rol roja" en "rolroja" no
    // pueden salir dos <mark> montados uno encima del otro.
    marcas.sort((a, b) => a[0] - b[0]);
    const juntas = [marcas[0]];
    for (let i = 1; i < marcas.length; i += 1) {
        const ultima = juntas[juntas.length - 1];
        if (marcas[i][0] <= ultima[1]) {
            ultima[1] = Math.max(ultima[1], marcas[i][1]);
        } else {
            juntas.push(marcas[i]);
        }
    }

    let cursor = 0;
    juntas.forEach(([ini, fin]) => {
        if (ini > cursor) {
            salida.appendChild(document.createTextNode(original.slice(cursor, ini)));
        }
        const marca = document.createElement("mark");
        marca.textContent = original.slice(ini, fin);
        salida.appendChild(marca);
        cursor = fin;
    });
    if (cursor < original.length) {
        salida.appendChild(document.createTextNode(original.slice(cursor)));
    }
    return salida;
}

function pintarCuentaBusq(consulta) {
    const cuantos = BUSQ.encontrados.length;
    if (!cuantos) {
        decirBusq(`Ningún resultado para “${consulta}”.`);
        return;
    }
    decirBusq(
        cuantos === 1
            ? `1 resultado para “${consulta}”.`
            : `${cuantos} resultados para “${consulta}”.`
    );
}

function decirBusq(texto) {
    const sitio = document.querySelector("[data-buscar-resumen]");
    if (sitio) {
        sitio.textContent = texto;
    }
}

// Cuando no hay nada, no se deja la página en blanco: se dice qué se
// puede probar. Un "0 resultados" a secas deja a cualquiera sin saber si
// ha escrito mal o si es que no existe.
function sinResultadosBusq(consulta) {
    const caja = document.createElement("div");
    caja.className = "busq-nada";

    const uno = document.createElement("p");
    uno.textContent = `No he encontrado nada con “${consulta}”.`;
    caja.appendChild(uno);

    const dos = document.createElement("p");
    dos.textContent =
        "Prueba con una palabra sola, o con parte de ella: la búsqueda " +
        "mira trozos, así que “panad” encuentra “panadería”.";
    caja.appendChild(dos);

    const tres = document.createElement("p");
    const enlace = document.createElement("a");
    enlace.href = "/web/mapa/mapa.html";
    enlace.textContent = "el mapa del sitio";
    tres.appendChild(document.createTextNode("También puedes mirar "));
    tres.appendChild(enlace);
    tres.appendChild(document.createTextNode(", que lo lista todo."));
    caja.appendChild(tres);

    return caja;
}
