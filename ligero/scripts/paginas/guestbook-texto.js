/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/paginas/guestbook-texto.js
*/
const GUESTBOOK_MARCAS = [
    { signo: "*", clave: "negrita", etiqueta: "strong" },
    { signo: "_", clave: "cursiva", etiqueta: "em" },
    { signo: "~", clave: "tachado", etiqueta: "s" },
];
const GUESTBOOK_MAXIMO = 300;
function pintarMensajeGuestbook(destino, crudo) {
    destino.textContent = "";
    const texto = crudo === null || crudo === undefined ? "" : crudo.toString();
    trocearMarcas(texto).forEach((trozo) => {
        let caja = destino;
        GUESTBOOK_MARCAS.forEach((marca) => {
            if (trozo.marcas[marca.clave]) {
                const envoltorio = document.createElement(marca.etiqueta);
                caja.appendChild(envoltorio);
                caja = envoltorio;
            }
        });
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
function trocearMarcas(texto) {
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
function montarEditorGuestbook(editor, barra, contador) {
    if (!editor) {
        return;
    }
    try {
        document.execCommand("styleWithCSS", false, false);
    } catch (error) {
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
    }
}
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
    return leerEditor(editor, true).replace(/ /g, " ").trim();
}
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
function escaparMarcas(texto) {
    return texto.replace(/[\\*_~]/g, "\\$&");
}
function recortarEditor(editor) {
    const plano = textoPlanoGuestbook(editor);
    if (plano.length <= GUESTBOOK_MAXIMO) {
        return;
    }
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
    editor.classList.toggle("is-vacio", textoPlanoGuestbook(editor).trim() === "");
}
