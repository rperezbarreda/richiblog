// =========================================
// GUESTBOOK — TEXTO CON FORMATO
// =========================================
// Todo lo que tiene que ver con escribir el mensaje con negrita,
// cursiva y tachado, y con volver a pintarlo después. Va en su propio
// archivo porque son dos cosas muy distintas: el cuadro de escribir
// (solo en la página de contacto) y el pintado (lo usa la lista de
// mensajes).
//
// POR QUÉ NO SE GUARDA HTML
// -------------------------
// Lo que se manda a la hoja de cálculo NO es HTML, son marcas de texto
// al estilo de toda la vida:
//
//     *negrita*    _cursiva_    ~tachado~
//
// Dos razones. Una, en la hoja se sigue leyendo el mensaje entero de un
// vistazo, sin etiquetas por en medio. Y dos, la de peso: si se
// guardase HTML habría que volver a meterlo en la página tal cual, y
// cualquiera podría escribir un <script> en el guestbook y hacer que se
// ejecute en el navegador de quien lo lea. Aquí eso no puede pasar ni
// equivocándose: al pintar no se usa innerHTML en ningún momento — se
// crean los elementos uno a uno y el texto va siempre como texto.
//
// La hoja de cálculo y el Apps Script no se tocan: sigue llegando un
// campo "message" con una cadena, solo que ahora esa cadena puede
// llevar asteriscos. Los mensajes antiguos, sin marcas, se pintan igual
// que siempre.
//
// Si alguien escribe un asterisco de verdad, se guarda escapado (\*) y
// al pintarlo vuelve a salir como asterisco.

const GUESTBOOK_MARCAS = [
    { signo: "*", clave: "negrita", etiqueta: "strong" },
    { signo: "_", clave: "cursiva", etiqueta: "em" },
    { signo: "~", clave: "tachado", etiqueta: "s" },
];
const GUESTBOOK_MAXIMO = 300;

// =========================================
// PINTAR UN MENSAJE GUARDADO
// =========================================

// Mete el mensaje dentro de "destino" como nodos de verdad. Nunca
// innerHTML: por ahí es por donde se cuela el HTML de otra persona.
function pintarMensajeGuestbook(destino, crudo) {
    destino.textContent = "";
    const texto = crudo === null || crudo === undefined ? "" : crudo.toString();

    trocearMarcas(texto).forEach((trozo) => {
        // Las marcas se anidan: negrita dentro de cursiva dentro de
        // tachado, según lo que lleve el trozo.
        let caja = destino;
        GUESTBOOK_MARCAS.forEach((marca) => {
            if (trozo.marcas[marca.clave]) {
                const envoltorio = document.createElement(marca.etiqueta);
                caja.appendChild(envoltorio);
                caja = envoltorio;
            }
        });
        // Los saltos de línea del mensaje, como saltos de línea.
        trozo.texto.split("\n").forEach((linea, i) => {
            if (i > 0) {
                caja.appendChild(document.createElement("br"));
            }
            if (linea) {
                caja.appendChild(document.createTextNode(linea));
            }
        });
    });
}

// Parte el texto en trozos, cada uno con las marcas que le tocan.
function trocearMarcas(texto) {
    // Un signo suelto sin pareja no debe volver cursiva media web: si
    // un mensaje tiene un número impar de alguno, ese se trata como un
    // carácter normal. Esto salva sobre todo a los mensajes antiguos,
    // escritos cuando esto no existía.
    const sueltos = {};
    GUESTBOOK_MARCAS.forEach((marca) => {
        sueltos[marca.signo] = contarSignos(texto, marca.signo) % 2 !== 0;
    });

    const trozos = [];
    const activas = { negrita: false, cursiva: false, tachado: false };
    let actual = "";

    const guardar = () => {
        if (actual) {
            trozos.push({ texto: actual, marcas: Object.assign({}, activas) });
            actual = "";
        }
    };

    for (let i = 0; i < texto.length; i += 1) {
        const c = texto[i];

        if (c === "\\" && i + 1 < texto.length && "*_~\\".indexOf(texto[i + 1]) !== -1) {
            actual += texto[i + 1];
            i += 1;
            continue;
        }

        const marca = GUESTBOOK_MARCAS.find((m) => m.signo === c);
        if (marca && !sueltos[c]) {
            guardar();
            activas[marca.clave] = !activas[marca.clave];
            continue;
        }

        actual += c;
    }
    guardar();

    return trozos;
}

function contarSignos(texto, signo) {
    let total = 0;
    for (let i = 0; i < texto.length; i += 1) {
        if (texto[i] === "\\") {
            i += 1;
            continue;
        }
        if (texto[i] === signo) {
            total += 1;
        }
    }
    return total;
}

// =========================================
// EL CUADRO DE ESCRIBIR
// =========================================

function montarEditorGuestbook(editor, barra, contador) {
    if (!editor) {
        return;
    }

    // execCommand está oficialmente anticuado, pero es lo único que
    // sabe poner en negrita justo lo que hay seleccionado en todos los
    // navegadores. Con styleWithCSS desactivado mete <b>/<i> en vez de
    // <span style>, que es más fácil de leer al guardar.
    try {
        document.execCommand("styleWithCSS", false, false);
    } catch (error) {
        // Da igual: al guardar se miran las dos cosas, la etiqueta y el
        // estilo suelto.
    }

    if (barra) {
        barra.querySelectorAll("[data-formato]").forEach((boton) => {
            boton.addEventListener("click", () => {
                editor.focus();
                aplicarFormato(boton.getAttribute("data-formato"));
                refrescarBarra(barra);
            });
        });
    }

    editor.addEventListener("keydown", (evento) => {
        if (evento.ctrlKey || evento.metaKey) {
            const atajo = { b: "negrita", i: "cursiva" }[evento.key.toLowerCase()];
            if (atajo) {
                evento.preventDefault();
                aplicarFormato(atajo);
                refrescarBarra(barra);
            }
        }
    });

    // Al pegar, solo el texto: si no, entra el HTML de donde se copió
    // (con sus colores, sus enlaces y lo que haga falta).
    editor.addEventListener("paste", (evento) => {
        evento.preventDefault();
        const texto = (evento.clipboardData || window.clipboardData).getData("text");
        document.execCommand("insertText", false, texto);
    });

    ["input", "keyup", "mouseup", "focus"].forEach((evento) => {
        editor.addEventListener(evento, () => {
            recortarEditor(editor);
            actualizarContador(editor, contador);
            refrescarBarra(barra);
        });
    });

    document.addEventListener("selectionchange", () => {
        if (document.activeElement === editor) {
            refrescarBarra(barra);
        }
    });

    actualizarContador(editor, contador);
}

function aplicarFormato(clave) {
    const comandos = { negrita: "bold", cursiva: "italic", tachado: "strikeThrough" };
    const comando = comandos[clave];
    if (!comando) {
        return;
    }
    try {
        document.execCommand(comando, false, null);
    } catch (error) {
        // Si el navegador no deja, el mensaje se manda sin formato y
        // ya está: no se rompe nada.
    }
}

// Los botones se quedan marcados según lo que haya donde está el
// cursor, para que se vea en qué estás escribiendo.
function refrescarBarra(barra) {
    if (!barra) {
        return;
    }
    const estados = { negrita: "bold", cursiva: "italic", tachado: "strikeThrough" };
    barra.querySelectorAll("[data-formato]").forEach((boton) => {
        let puesto = false;
        try {
            puesto = document.queryCommandState(estados[boton.getAttribute("data-formato")]);
        } catch (error) {
            puesto = false;
        }
        boton.setAttribute("aria-pressed", puesto ? "true" : "false");
    });
}

function textoPlanoGuestbook(editor) {
    return leerEditor(editor, false);
}

function marcasGuestbook(editor) {
    // El navegador mete espacios duros (U+00A0) al escribir junto a un
    // trozo en negrita. En la hoja de cálculo eso se ve como un espacio
    // raro que no se puede buscar, así que se pasan a espacios
    // normales antes de guardar.
    return leerEditor(editor, true).replace(/ /g, " ").trim();
}

// Recorre el contenido del cuadro y lo devuelve como texto: con marcas
// (para guardar) o pelado (para contar caracteres).
function leerEditor(editor, conMarcas) {
    const activas = { negrita: false, cursiva: false, tachado: false };

    function recorrer(nodo) {
        if (nodo.nodeType === 3) {
            const texto = nodo.nodeValue || "";
            return conMarcas ? escaparMarcas(texto) : texto;
        }
        if (nodo.nodeType !== 1) {
            return "";
        }
        if (nodo.tagName === "BR") {
            return "\n";
        }

        const pone = [];
        if (conMarcas) {
            GUESTBOOK_MARCAS.forEach((marca) => {
                // Si esa marca ya venía puesta por un elemento de más
                // arriba no se repite, o saldría **doble**.
                if (tieneMarca(nodo, marca.clave) && !activas[marca.clave]) {
                    pone.push(marca);
                    activas[marca.clave] = true;
                }
            });
        }

        let dentro = "";
        nodo.childNodes.forEach((hijo) => {
            dentro += recorrer(hijo);
        });

        // Un <div> o un <p> sueltos (los mete el navegador al pulsar
        // Intro) valen como salto de línea.
        const bloque = nodo.tagName === "DIV" || nodo.tagName === "P";

        pone.forEach((marca) => {
            activas[marca.clave] = false;
        });

        const signos = pone.map((m) => m.signo).join("");
        const alReves = signos.split("").reverse().join("");
        const conSignos = dentro ? signos + dentro + alReves : "";

        return bloque ? "\n" + conSignos : conSignos;
    }

    let salida = "";
    editor.childNodes.forEach((hijo) => {
        salida += recorrer(hijo);
    });
    // El primer <div> del navegador no es un salto de línea de verdad.
    return salida.replace(/^\n/, "");
}

function tieneMarca(elemento, clave) {
    const etiqueta = elemento.tagName;
    const estilo = elemento.style || {};

    if (clave === "negrita") {
        return (
            etiqueta === "B" ||
            etiqueta === "STRONG" ||
            /^(bold|bolder|[6-9]00)$/.test(estilo.fontWeight || "")
        );
    }
    if (clave === "cursiva") {
        return etiqueta === "I" || etiqueta === "EM" || estilo.fontStyle === "italic";
    }
    return (
        etiqueta === "S" ||
        etiqueta === "STRIKE" ||
        etiqueta === "DEL" ||
        (estilo.textDecoration || "").indexOf("line-through") !== -1 ||
        (estilo.textDecorationLine || "").indexOf("line-through") !== -1
    );
}

// Un asterisco escrito a propósito se guarda escapado, para que al
// volver a pintarlo salga como asterisco y no ponga nada en negrita.
function escaparMarcas(texto) {
    return texto.replace(/[\\*_~]/g, "\\$&");
}

// El cuadro editable no tiene maxlength, así que se recorta a mano.
function recortarEditor(editor) {
    const plano = textoPlanoGuestbook(editor);
    if (plano.length <= GUESTBOOK_MAXIMO) {
        return;
    }
    // Se quita por el final hasta que quepa, sin tocar lo que ya estaba
    // escrito antes.
    let sobra = plano.length - GUESTBOOK_MAXIMO;
    const textos = [];
    recogerTextos(editor, textos);
    for (let i = textos.length - 1; i >= 0 && sobra > 0; i -= 1) {
        const nodo = textos[i];
        const largo = (nodo.nodeValue || "").length;
        const quitar = Math.min(largo, sobra);
        nodo.nodeValue = nodo.nodeValue.slice(0, largo - quitar);
        sobra -= quitar;
    }
    colocarCursorAlFinal(editor);
}

function recogerTextos(nodo, acumulado) {
    nodo.childNodes.forEach((hijo) => {
        if (hijo.nodeType === 3) {
            acumulado.push(hijo);
        } else if (hijo.nodeType === 1) {
            recogerTextos(hijo, acumulado);
        }
    });
}

function colocarCursorAlFinal(editor) {
    const rango = document.createRange();
    rango.selectNodeContents(editor);
    rango.collapse(false);
    const seleccion = window.getSelection();
    seleccion.removeAllRanges();
    seleccion.addRange(rango);
}

function actualizarContador(editor, contador) {
    if (!contador) {
        return;
    }
    const quedan = GUESTBOOK_MAXIMO - textoPlanoGuestbook(editor).length;
    contador.textContent =
        quedan === 1 ? "queda 1 carácter" : "quedan " + quedan + " caracteres";
    contador.classList.toggle("is-poco", quedan <= 30);
    // El cuadro enseña su texto de ayuda solo mientras está vacío.
    editor.classList.toggle("is-vacio", textoPlanoGuestbook(editor).trim() === "");
}
