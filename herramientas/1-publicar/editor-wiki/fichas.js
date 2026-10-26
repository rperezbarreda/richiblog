// =========================================
// EL EDITOR DE LA WEB — las fichas
// =========================================
// Lo que vive en un JSON de datos/ y llevaban las herramientas de
// 1-publicar con preguntas: los recursos de rol, los NPC y el botín, las
// recomendaciones, «en lo que ando», el calendario, la línea de tiempo,
// el diccionario, las palabras del reto y las fotos de los gatos. Cada una
// es una COLECCIÓN (las describe editor_web.colecciones: sus partes, sus
// casillas y de qué tipo es cada una), y aquí se pinta igual para todas:
// la lista de fichas, y al elegir una, sus casillas debajo.
//
// Lo que se cambia se queda aquí hasta «Guardar», que manda la colección
// entera; el servidor la mezcla con lo que había (lo que no tiene casilla
// se respeta), la escribe y pasa lo que toque (el buscador, la línea de
// tiempo…), con su barra de progreso.
//
// También la vista de LAS IMÁGENES Y REPASAR: traer una imagen, repasar el
// sitio y volver a generarlo.

const estadoFichas = { colecciones: [], campanas: [], sitios: [], col: null, id: "", campana: "", elegidas: {},
    cambiado: false, guardando: false, filtros: {}, grupos: {} };

async function cargarColeccionesWeb() {
    const datos = await pedirEditor("/api/web/colecciones");
    if (datos.error) {
        avisarEditor(datos.error, true);
        return;
    }
    estadoFichas.colecciones = datos.colecciones;
    estadoFichas.campanas = datos.campanas;
    estadoFichas.sitios = datos.sitios;
    // Un botón grande por colección, en su apartado (Rol, Mi rincón, la
    // wiki, escribir).
    document.querySelectorAll("[data-fichas-de]").forEach((caja) => {
        const apartado = caja.getAttribute("data-fichas-de");
        caja.textContent = "";
        datos.colecciones.filter((c) => c.apartado === apartado).forEach((c) => {
            const b = crearEditor("button", "grande");
            b.type = "button";
            b.appendChild(crearEditor("span", "grande-titulo", c.titulo));
            b.appendChild(crearEditor("span", "grande-que", c.ayuda));
            b.addEventListener("click", () => abrirFichasWeb(c.id));
            caja.appendChild(b);
        });
    });
    pintarTraerImagenWeb();
}

async function abrirFichasWeb(id, campana) {
    if (estadoFichas.cambiado && estadoFichas.id !== id
        && !window.confirm("Hay cambios sin guardar en " + estadoFichas.col.titulo + ". ¿Salir igualmente?")) {
        return;
    }
    const meta = estadoFichas.colecciones.find((c) => c.id === id);
    let clave = campana || "";
    if (meta && meta.por_campana && !clave) {
        clave = estadoFichas.campana || (estadoFichas.campanas[0] || {}).clave || "";
    }
    const col = await pedirEditor("/api/web/coleccion?id=" + encodeURIComponent(id) + "&campana=" + encodeURIComponent(clave));
    if (col.error) {
        avisarEditor(col.error, true);
        return;
    }
    estadoFichas.cambiado = false;
    ponerFichasWeb(col, true);
    irAEditor("fichas");
}

function ponerFichasWeb(col, deCero) {
    const antes = estadoFichas.id;
    estadoFichas.col = col;
    estadoFichas.id = col.id;
    estadoFichas.campana = col.campana || "";
    if (deCero || antes !== col.id) {
        estadoFichas.elegidas = {};
        estadoFichas.filtros = {};
        estadoFichas.grupos = {};
    }
    $("[data-fichas-titulo]").textContent = col.titulo;
    $("[data-fichas-ayuda]").textContent = col.ayuda + " (En " + col.archivo + ".)";
    const campana = $("#fichas-campana");
    $("[data-fichas-campana-caja]").hidden = !col.por_campana;
    if (col.por_campana) {
        campana.textContent = "";
        estadoFichas.campanas.forEach((c) => {
            const o = document.createElement("option");
            o.value = c.clave;
            o.textContent = c.nombre;
            campana.appendChild(o);
        });
        campana.value = col.campana;
    }
    const gatos = $("[data-fichas-gatos]");
    gatos.hidden = !col.santuarios;
    if (col.santuarios) {
        const elegir = $("#gatos-santuario");
        elegir.textContent = "";
        col.santuarios.forEach((s) => {
            const o = document.createElement("option");
            o.value = s;
            o.textContent = s;
            elegir.appendChild(o);
        });
    }
    pintarPartesWeb();
}

function pintarPartesWeb(enfocar) {
    const col = estadoFichas.col;
    const caja = $("[data-fichas-partes]");
    caja.textContent = "";
    col.partes_def.forEach((parte) => {
        const sec = crearEditor("section", "bloque");
        const idT = "t-parte-" + parte.id;
        sec.setAttribute("aria-labelledby", idT);
        const h2 = crearEditor("h2", "", parte.titulo);
        h2.id = idT;
        sec.appendChild(h2);
        if (parte.ayuda) {
            sec.appendChild(crearEditor("p", "ayuda", parte.ayuda));
        }
        if (parte.tipo === "objeto") {
            const objeto = col.partes[parte.id];
            parte.campos.forEach((c) => casillaDeFichaWeb(sec, objeto, c, "o-" + parte.id, parte, null));
        } else {
            pintarListaDeFichasWeb(sec, parte);
        }
        caja.appendChild(sec);
    });
    if (enfocar && document.getElementById(enfocar)) {
        document.getElementById(enfocar).focus();
    }
}

function nombreDeFichaWeb(parte, f) {
    const nombre = String(f[parte.nombre_de] === undefined || f[parte.nombre_de] === null ? "" : f[parte.nombre_de]).trim();
    const opciones = estadoFichas.col.opciones || {};
    const detalle = (parte.detalle || []).map((k) => {
        const v = f[k];
        if (v === undefined || v === null || v === "") {
            return "";
        }
        // Lo que se elige de una lista (el mes, la sesión), con su nombre.
        const op = (opciones[k] || []).find((x) => String(x[0]) === String(v));
        return op ? op[1] : String(v);
    }).filter(Boolean);
    if (f._grupo !== undefined && parte.agrupada) {
        const op = (opciones._grupo || []).find((x) => x[0] === f._grupo);
        detalle.unshift(op ? op[1] : f._grupo);
    }
    return { nombre: nombre || "(sin nombre)", detalle: detalle.join(" · ") };
}

function pintarListaDeFichasWeb(sec, parte) {
    const col = estadoFichas.col;
    const fichas = col.partes[parte.id];
    const elegida = estadoFichas.elegidas[parte.id];
    const cuenta = crearEditor("p", "ayuda", fichas.length === 1 ? "1 ficha." : fichas.length + " fichas.");
    sec.appendChild(cuenta);
    let filtro = estadoFichas.filtros[parte.id] || "";
    if (fichas.length > 10) {
        const caja = crearEditor("div", "campo");
        const l = crearEditor("label", "", "Buscar");
        l.htmlFor = "filtro-" + parte.id;
        const i = document.createElement("input");
        i.id = "filtro-" + parte.id;
        i.value = filtro;
        i.autocomplete = "off";
        caja.appendChild(l);
        caja.appendChild(i);
        sec.appendChild(caja);
        i.addEventListener("input", () => {
            estadoFichas.filtros[parte.id] = i.value;
            pintarPartesWeb("filtro-" + parte.id);
            const nuevo = document.getElementById("filtro-" + parte.id);
            if (nuevo) {
                nuevo.setSelectionRange(nuevo.value.length, nuevo.value.length);
            }
        });
        filtro = sinTildesWeb(filtro);
    }
    // Por grupos (los NPC: la caravana, Sirevia…): un desplegable para ver
    // solo los de uno y, con «todos», la lista partida por grupos, como en
    // la página (quien está en dos sale en los dos).
    const porGrupos = parte.por_grupos;
    const gruposDe = (f) => String(f[porGrupos] || "").split(",").map((g) => g.trim()).filter(Boolean);
    let grupo = "";
    let grupos = [];
    if (porGrupos) {
        grupos = ((col.opciones || {})[porGrupos] || []).map((x) => String(x[0]));
        fichas.forEach((f) => gruposDe(f).forEach((g) => {
            if (!grupos.includes(g)) {
                grupos.push(g);
            }
        }));
        grupo = estadoFichas.grupos[parte.id] || "";
        if (grupo && !grupos.includes(grupo)) {
            grupo = "";
        }
        const caja = crearEditor("div", "campo");
        const l = crearEditor("label", "", "Qué grupo");
        l.htmlFor = "grupo-" + parte.id;
        const elegir = document.createElement("select");
        elegir.id = "grupo-" + parte.id;
        [["", "Todos, por grupos"]].concat(grupos.map((g) => {
            const cuantos = fichas.filter((f) => gruposDe(f).includes(g)).length;
            return [g, g + " (" + cuantos + ")"];
        })).concat(fichas.some((f) => !gruposDe(f).length) ? [["-", "Sin grupo"]] : []).forEach(([v, t]) => {
            const o = document.createElement("option");
            o.value = v;
            o.textContent = t;
            elegir.appendChild(o);
        });
        elegir.value = estadoFichas.grupos[parte.id] === "-" ? "-" : grupo;
        grupo = elegir.value;
        caja.appendChild(l);
        caja.appendChild(elegir);
        sec.appendChild(caja);
        elegir.addEventListener("change", () => {
            estadoFichas.grupos[parte.id] = elegir.value;
            pintarPartesWeb("grupo-" + parte.id);
        });
    }
    const vistos = new Set();
    const ul = crearEditor("ul", "fichas-lista");
    const pintarUna = (f, i, lista) => {
        const { nombre, detalle } = nombreDeFichaWeb(parte, f);
        if (filtro && !sinTildesWeb(nombre + " " + detalle).includes(filtro)) {
            return;
        }
        const li = document.createElement("li");
        const b = crearEditor("button", "ficha-boton");
        b.type = "button";
        // La misma ficha en dos grupos: el id, solo la primera vez.
        if (!vistos.has(i)) {
            b.id = "ficha-" + parte.id + "-" + i;
            vistos.add(i);
        }
        b.setAttribute("aria-pressed", elegida === i ? "true" : "false");
        if (f._foto) {
            const img = document.createElement("img");
            img.src = f._foto;
            img.alt = "";
            img.loading = "lazy";
            b.appendChild(img);
        }
        b.appendChild(crearEditor("span", "ficha-nombre", nombre));
        if (detalle) {
            b.appendChild(crearEditor("span", "ficha-detalle", detalle));
        }
        b.addEventListener("click", () => {
            estadoFichas.elegidas[parte.id] = elegida === i ? undefined : i;
            pintarPartesWeb(elegida === i ? "ficha-" + parte.id + "-" + i : "ficha-editor-" + parte.id);
        });
        li.appendChild(b);
        lista.appendChild(li);
    };
    if (porGrupos && !grupo) {
        // Todos, partidos por grupo: un título y su lista cada uno.
        grupos.concat([""]).forEach((g) => {
            const suyas = fichas.map((f, i) => [f, i]).filter(([f]) => (g ? gruposDe(f).includes(g) : !gruposDe(f).length));
            if (!suyas.length) {
                return;
            }
            const h = crearEditor("h3", "fichas-grupo", (g || "Sin grupo") + " (" + suyas.length + ")");
            const lista = crearEditor("ul", "fichas-lista");
            suyas.forEach(([f, i]) => pintarUna(f, i, lista));
            if (lista.children.length) {
                sec.appendChild(h);
                sec.appendChild(lista);
            }
        });
    } else if (parte.por_estado) {
        // Por cómo van (las misiones): arriba lo pendiente (sin estado) y
        // debajo el histórico (completadas y fallidas), cada uno con su
        // título y su lista.
        const clave = parte.por_estado;
        const todas = fichas.map((f, i) => [f, i]);
        [["Pendientes", todas.filter(([f]) => !f[clave])],
            ["El histórico: completadas y fallidas", todas.filter(([f]) => f[clave])]].forEach(([titulo, suyas]) => {
            sec.appendChild(crearEditor("h3", "fichas-grupo", titulo + " (" + suyas.length + ")"));
            if (!suyas.length) {
                sec.appendChild(crearEditor("p", "ayuda", "Nada todavía."));
                return;
            }
            const lista = crearEditor("ul", "fichas-lista");
            suyas.forEach(([f, i]) => pintarUna(f, i, lista));
            sec.appendChild(lista);
        });
    } else {
        fichas.forEach((f, i) => {
            if (porGrupos && (grupo === "-" ? gruposDe(f).length : !gruposDe(f).includes(grupo))) {
                return;
            }
            pintarUna(f, i, ul);
        });
        sec.appendChild(ul);
    }
    if (!parte.fijas) {
        const anadir = crearEditor("button", "", "Añadir");
        anadir.type = "button";
        anadir.setAttribute("aria-label", "Añadir a «" + parte.titulo + "»");
        anadir.addEventListener("click", () => {
            const nueva = {};
            parte.campos.forEach((c) => {
                nueva[c.clave] = c.tipo === "si-no" ? false : (c.hoy ? estadoFichas.hoy || "" : "");
                if (c.tipo === "elegir" && !c.libre && c.obligatorio) {
                    const op = (estadoFichas.col.opciones[c.clave] || c.opciones || [])[0];
                    nueva[c.clave] = op ? op[0] : "";
                }
            });
            if (parte.agrupada) {
                nueva._grupo = ((estadoFichas.col.opciones._grupo || [])[0] || [""])[0];
            }
            if (parte.nuevas_arriba) {
                fichas.unshift(nueva);
                estadoFichas.elegidas[parte.id] = 0;
            } else {
                fichas.push(nueva);
                estadoFichas.elegidas[parte.id] = fichas.length - 1;
            }
            estadoFichas.cambiado = true;
            estadoFichas.filtros[parte.id] = "";
            pintarPartesWeb("ficha-editor-" + parte.id);
        });
        sec.appendChild(anadir);
    }
    if (elegida !== undefined && fichas[elegida]) {
        pintarFichaWeb(sec, parte, fichas, elegida);
        // Partida por grupos (o por cómo van), la ficha se abre debajo de
        // su grupo (el primero en el que sale), no al final de todo.
        const suyo = (porGrupos && !grupo) || parte.por_estado
            ? sec.querySelector("#ficha-" + parte.id + "-" + elegida) : null;
        const editor = sec.querySelector(".ficha-editor");
        if (suyo && editor) {
            suyo.closest("ul").after(editor);
        }
    }
}

function pintarFichaWeb(sec, parte, fichas, i) {
    const f = fichas[i];
    const caja = crearEditor("fieldset", "ficha-editor");
    const leyenda = crearEditor("legend", "", nombreDeFichaWeb(parte, f).nombre);
    leyenda.id = "ficha-editor-" + parte.id;
    leyenda.tabIndex = -1;
    caja.appendChild(leyenda);
    if (f._foto) {
        const img = document.createElement("img");
        img.src = f._foto;
        img.alt = "";
        img.className = "ficha-foto";
        caja.appendChild(img);
    }
    // Las casillas que solo valen para unas fichas (c.si: {"tipo":
    // ["pergaminos"]}, lo de un pergamino en el botín) salen y se esconden
    // según lo elegido; lo escrito en ellas se queda.
    const condicionadas = [];
    const mirarCondiciones = () => condicionadas.forEach(([sitio, c]) => {
        sitio.hidden = !Object.entries(c.si).every(([k, valores]) => valores.includes(String(f[k] || "")));
    });
    parte.campos.forEach((c) => {
        let dentro = caja;
        if (c.si) {
            dentro = crearEditor("div", "");
            condicionadas.push([dentro, c]);
            caja.appendChild(dentro);
        }
        casillaDeFichaWeb(dentro, f, c, "f-" + parte.id + "-" + i, parte, () => {
        mirarCondiciones();
        leyenda.textContent = nombreDeFichaWeb(parte, f).nombre;
        const boton = document.getElementById("ficha-" + parte.id + "-" + i);
        if (boton) {
            const { nombre, detalle } = nombreDeFichaWeb(parte, f);
            boton.querySelector(".ficha-nombre").textContent = nombre;
            const d = boton.querySelector(".ficha-detalle");
            if (d) {
                d.textContent = detalle;
            }
        }
    });
    });
    mirarCondiciones();
    const fila = crearEditor("div", "fila");
    const boton = (texto, ayuda, alPulsar) => {
        const b = crearEditor("button", "", texto);
        b.type = "button";
        b.setAttribute("aria-label", ayuda);
        b.addEventListener("click", alPulsar);
        fila.appendChild(b);
    };
    const nombre = nombreDeFichaWeb(parte, f).nombre;
    boton("↑ Subir", "Subir «" + nombre + "» en la lista", () => {
        if (i > 0) {
            [fichas[i - 1], fichas[i]] = [fichas[i], fichas[i - 1]];
            estadoFichas.elegidas[parte.id] = i - 1;
            estadoFichas.cambiado = true;
            pintarPartesWeb("ficha-editor-" + parte.id);
        }
    });
    boton("↓ Bajar", "Bajar «" + nombre + "» en la lista", () => {
        if (i < fichas.length - 1) {
            [fichas[i + 1], fichas[i]] = [fichas[i], fichas[i + 1]];
            estadoFichas.elegidas[parte.id] = i + 1;
            estadoFichas.cambiado = true;
            pintarPartesWeb("ficha-editor-" + parte.id);
        }
    });
    if (!parte.fijas) {
        boton("Quitar", "Quitar «" + nombre + "»", () => {
            if (!window.confirm("¿Quitar «" + nombre + "»? (No se borra de verdad hasta que guardes.)")) {
                return;
            }
            fichas.splice(i, 1);
            estadoFichas.elegidas[parte.id] = undefined;
            estadoFichas.cambiado = true;
            pintarPartesWeb("t-parte-" + parte.id);
        });
    }
    boton("Cerrar", "Cerrar la ficha de «" + nombre + "»", () => {
        estadoFichas.elegidas[parte.id] = undefined;
        pintarPartesWeb("ficha-" + parte.id + "-" + i);
    });
    caja.appendChild(fila);
    sec.appendChild(caja);
}

// UNA CASILLA, según su tipo. Lo que se escribe va derecho a la ficha.
function casillaDeFichaWeb(dentro, f, c, base, parte, alCambiar) {
    const id = base + "-" + c.clave.replace(/\W/g, "");
    const opciones = (estadoFichas.col.opciones || {})[c.clave] || c.opciones || [];
    const cambiar = (valor) => {
        f[c.clave] = valor;
        estadoFichas.cambiado = true;
        if (alCambiar) {
            alCambiar();
        }
    };
    const valor = f[c.clave] === undefined || f[c.clave] === null ? "" : f[c.clave];
    const ayuda = c.ayuda || "";
    if (c.tipo === "ver") {
        if (c.foto) {
            return;
        }
        const p = crearEditor("p", "ficha-ver");
        p.appendChild(crearEditor("strong", "", c.nombre + ": "));
        p.appendChild(document.createTextNode(String(valor || "—")));
        dentro.appendChild(p);
        return;
    }
    if (c.tipo === "si-no") {
        const l = crearEditor("label", "opcion campo-si-no");
        const casilla = document.createElement("input");
        casilla.type = "checkbox";
        casilla.id = id;
        casilla.checked = !!valor;
        casilla.addEventListener("change", () => cambiar(casilla.checked));
        l.appendChild(casilla);
        l.appendChild(document.createTextNode(" " + c.nombre));
        dentro.appendChild(l);
        return;
    }
    const nombre = c.nombre;
    if (c.tipo === "accion") {
        // Un botón que hace algo con la ficha (ACCIONES_DE_FICHA), no una
        // casilla: no guarda nada en ella.
        const caja = crearEditor("div", "campo");
        const b = crearEditor("button", "", c.nombre);
        b.type = "button";
        b.id = id;
        b.addEventListener("click", () => (ACCIONES_DE_FICHA[c.accion] || (() => {}))(f, b));
        caja.appendChild(b);
        dentro.appendChild(caja);
        return;
    }
    if (c.tipo === "elegir" && !c.libre) {
        const lista = (c.obligatorio ? [] : [["", "— ninguno —"]]).concat(opciones);
        const el = campoWeb(dentro, id, nombre, { tipo: "elegir", opciones: lista, ayuda, opcional: !c.obligatorio });
        el.value = String(valor);
        if (el.value !== String(valor) && valor !== "") {
            // Un valor que no está en la lista (escrito a mano): se enseña igual.
            const o = document.createElement("option");
            o.value = String(valor);
            o.textContent = String(valor);
            el.appendChild(o);
            el.value = String(valor);
        }
        el.addEventListener("change", () => cambiar(el.value));
        return;
    }
    if (c.tipo === "elegir") {
        const idLista = "lista-" + id;
        datalistWeb(idLista, opciones.map((x) => String(x[0])));
        const el = campoWeb(dentro, id, nombre, { lista: idLista, valor, ayuda, opcional: !c.obligatorio });
        el.addEventListener("input", () => cambiar(el.value));
        return;
    }
    if (c.tipo === "imagen") {
        const caja = crearEditor("div", "campo");
        const l = crearEditor("label", "", c.nombre);
        l.htmlFor = id;
        caja.appendChild(l);
        if (ayuda) {
            caja.appendChild(crearEditor("p", "ayuda", ayuda));
        }
        const vista = crearEditor("div", "dato-imagen");
        const img = document.createElement("img");
        img.alt = "";
        const pintarVista = () => {
            img.hidden = !f[c.clave];
            if (f[c.clave]) {
                img.src = f[c.clave];
            }
        };
        pintarVista();
        vista.appendChild(img);
        const texto = document.createElement("input");
        texto.id = id;
        texto.value = valor;
        texto.autocomplete = "off";
        texto.spellcheck = false;
        texto.placeholder = "/imagenes/…";
        texto.addEventListener("input", () => {
            cambiar(texto.value.trim());
            pintarVista();
        });
        vista.appendChild(texto);
        const subir = crearEditor("div", "subir");
        const archivo = document.createElement("input");
        archivo.type = "file";
        archivo.accept = "image/*";
        archivo.id = id + "-subir";
        const ls = crearEditor("label", "boton", "Subir una");
        ls.htmlFor = archivo.id;
        subir.appendChild(archivo);
        subir.appendChild(ls);
        vista.appendChild(subir);
        archivo.addEventListener("change", async () => {
            avisarEditor("Trayendo la imagen…");
            const hecha = await subirImagenWeb(archivo, c.sitio, { campana: estadoFichas.campana },
                String(f[parte.nombre_de] || c.nombre));
            archivo.value = "";
            if (!hecha) {
                return;
            }
            if (hecha.error) {
                avisarEditor(hecha.error, true);
                return;
            }
            texto.value = hecha.ruta;
            cambiar(hecha.ruta);
            pintarVista();
            avisarEditor("Imagen lista: " + hecha.ruta + " (" + hecha.aviso + "). Se apunta al guardar.");
        });
        caja.appendChild(vista);
        dentro.appendChild(caja);
        return;
    }
    const tipos = { largo: "largo", lineas: "largo", numero: "number", color: "color", texto: "text", enlace: "url",
        fecha: "text" };
    const el = campoWeb(dentro, id, nombre, { tipo: tipos[c.tipo] || "text", valor, ayuda: c.tipo === "fecha"
        ? (ayuda ? ayuda + " " : "") + "dd-mm-aaaa." : ayuda, opcional: !c.obligatorio,
    filas: c.grande ? 12 : (c.tipo === "lineas" ? 5 : 3) });
    if (c.tipo === "enlace") {
        el.type = "text";
        el.inputMode = "url";
        el.spellcheck = false;
    }
    if (c.tipo === "color" && !valor) {
        el.value = "#808080";
    }
    if (c.tipo === "numero") {
        el.inputMode = "decimal";
        if (c.minimo !== undefined) {
            el.min = c.minimo;
        }
        if (c.maximo !== undefined) {
            el.max = c.maximo;
        }
    }
    el.addEventListener("input", () => cambiar(el.value));
    if (c.tipo === "numero" && c.pasos) {
        // − y + al lado (contar flechas en plena partida). Con c.agota
        // («gastado»), al llegar a 0 se marca solo; con c.inicial
        // («inicial»), la primera vez que baja se apunta cuántas había.
        const fila = crearEditor("div", "fila ficha-pasos");
        const paso = (hacia) => {
            const b = crearEditor("button", "", hacia < 0 ? "−" : "+");
            b.type = "button";
            b.id = id + (hacia < 0 ? "-menos" : "-mas");
            b.setAttribute("aria-label", (hacia < 0 ? "Una menos" : "Una más") + " (" + nombre + ")");
            b.addEventListener("click", () => {
                const ahora = Number(String(f[c.clave] === undefined ? "" : f[c.clave]).replace(",", ".")) || 0;
                const nuevo = Math.max(0, ahora + hacia);
                if (nuevo === ahora) {
                    return;
                }
                if (hacia < 0 && c.inicial && !f[c.inicial]) {
                    f[c.inicial] = String(ahora);
                }
                if (c.agota) {
                    f[c.agota] = nuevo === 0;
                }
                cambiar(String(nuevo));
                avisarEditor(nombre + ": " + nuevo + (nuevo === 0 && c.agota ? " (ya no queda: gastado)" : "") + ".");
                pintarPartesWeb(b.id);
            });
            fila.appendChild(b);
        };
        paso(-1);
        paso(1);
        el.after(fila);
    }
    if (c.markdown) {
        // Texto con formato (el Markdown de la wiki): los botones encima.
        // Con c.imagenes (a dónde van: «evento»…), también el botón de
        // meter una imagen.
        el.before(crearBarraMarkdown(el, nombre, null,
            c.imagenes ? { imagenes: () => ({ sitio: c.imagenes, campos: { campana: estadoFichas.campana } }) } : null));
    }
}

// LO QUE HACEN LOS BOTONES DE LAS FICHAS (casillas de tipo «accion»).
const ACCIONES_DE_FICHA = {
    // Una misión completada: «Lo que nos llevamos» al botín (o al dinero,
    // si son monedas: «50 po»). Varias cosas se separan con comas o «y».
    "mision-al-botin": async (f, boton) => {
        const lo = String(f.obtenida || "").trim();
        if (!lo) {
            avisarEditor("Primero escribe en «Lo que nos llevamos» qué fue.", true);
            return;
        }
        const cosas = lo.split(/\s*[,;]\s*|\s+y\s+/).map((x) => x.replace(/[.]$/, "").trim()).filter(Boolean)
            .map((que) => ({ que, de: f.hasta || "", concepto: "Recompensa: " + String(f.que || "").trim() }));
        boton.disabled = true;
        const hecho = await pedirEditor("/api/web/botin/anadir", { campana: estadoFichas.campana, cosas });
        boton.disabled = false;
        if (hecho.error) {
            avisarEditor(hecho.error, true);
            return;
        }
        const partes = [];
        if (hecho.botin.length) {
            partes.push("al botín: " + hecho.botin.join(", "));
        }
        if (hecho.dinero.length) {
            partes.push("al dinero: " + hecho.dinero.join(", "));
        }
        if (hecho.ya.length) {
            partes.push("ya estaba: " + hecho.ya.join(", "));
        }
        avisarEditor((partes.join("; ") || "Nada que pasar") + ". (Ya está guardado; ponle su apartado y quién"
            + " lo lleva en «El botín de una campaña».)");
    },
};

async function guardarFichasWeb() {
    const col = estadoFichas.col;
    if (!col || estadoFichas.guardando) {
        return;
    }
    estadoFichas.guardando = true;
    const botones = document.querySelectorAll("[data-barra-fichas] button");
    ocuparWeb(botones, true);
    avisarEditor("Guardando…");
    const hecho = await seguirTareaWeb(await pedirEditor("/api/web/coleccion/guardar",
        { id: col.id, campana: col.campana, partes: col.partes }), "Guardado. Pasándolo a la web…");
    ocuparWeb(botones, false);
    estadoFichas.guardando = false;
    if (hecho.error) {
        avisarEditor(hecho.error, true, hecho.salida);
        return;
    }
    estadoFichas.cambiado = false;
    if (hecho.coleccion && !hecho.coleccion.error) {
        ponerFichasWeb(hecho.coleccion, false);
    }
    avisarEditor("Guardado en " + col.archivo + (col.despues ? " y pasado a la web." : ". La página lo lee tal cual: ya"
        + " está."), false, hecho.salida);
}

async function subirFotosDeGatoWeb() {
    const archivos = [...($("#gatos-fotos").files || [])];
    if (!archivos.length) {
        avisarEditor("Elige primero las fotos.", true);
        return;
    }
    if (estadoFichas.cambiado && !window.confirm("Hay descripciones sin guardar; se perderán al subir. ¿Seguir?")) {
        return;
    }
    const boton = $("[data-gatos-subir]");
    ocuparWeb([boton], true);
    avisarEditor("Leyendo " + archivos.length + (archivos.length === 1 ? " foto…" : " fotos…"));
    const fotos = await Promise.all(archivos.map((a) => new Promise((r) => {
        const lector = new FileReader();
        lector.onload = () => r({ archivo: a.name, datos: lector.result });
        lector.onerror = () => r({ archivo: a.name, datos: "" });
        lector.readAsDataURL(a);
    })));
    const hecho = await seguirTareaWeb(await pedirEditor("/api/web/gatos/subir", { santuario: $("#gatos-santuario").value,
        fotos }), "Trayendo las fotos y haciendo las miniaturas…");
    ocuparWeb([boton], false);
    $("#gatos-fotos").value = "";
    $("[data-gatos-elegidas]").textContent = "";
    if (hecho.error) {
        avisarEditor(hecho.error, true, hecho.salida);
        return;
    }
    estadoFichas.cambiado = false;
    if (hecho.coleccion) {
        ponerFichasWeb(hecho.coleccion, true);
    }
    avisarEditor("Subidas " + hecho.traidas + "." + (hecho.fallos && hecho.fallos.length ? " No he podido con: "
        + hecho.fallos.join("; ") : "") + " Ahora escríbeles su descripción y guarda.", false, hecho.salida);
}

// ---- LAS IMÁGENES Y REPASAR ----
function pintarTraerImagenWeb() {
    const sitio = $("#traer-sitio");
    if (!sitio || sitio.options.length) {
        return;
    }
    estadoFichas.sitios.forEach((s) => {
        const o = document.createElement("option");
        o.value = s.clave;
        o.textContent = s.que + " (" + s.lado + " px)";
        sitio.appendChild(o);
    });
    const campana = $("#traer-campana");
    estadoFichas.campanas.forEach((c) => {
        const o = document.createElement("option");
        o.value = c.clave;
        o.textContent = c.nombre;
        campana.appendChild(o);
    });
    $("#traer-anyo").value = String(new Date().getFullYear());
    const ajustar = () => {
        const s = estadoFichas.sitios.find((x) => x.clave === sitio.value) || {};
        const carpeta = s.carpeta || "";
        $("[data-traer-campana]").hidden = !carpeta.includes("{campana}");
        $("[data-traer-anyo]").hidden = !carpeta.includes("{anyo}");
        $("[data-traer-santuario]").hidden = !carpeta.includes("{santuario}");
        $("[data-traer-carpeta]").hidden = sitio.value !== "otra";
    };
    sitio.addEventListener("change", ajustar);
    ajustar();
}

async function traerImagenWeb() {
    const archivo = $("#traer-archivo");
    if (!archivo.files || !archivo.files[0]) {
        avisarEditor("Elige primero la imagen.", true);
        return;
    }
    const boton = $("[data-traer] button[type=\"submit\"]");
    ocuparWeb([boton], true);
    avisarEditor("Trayendo la imagen…");
    const hecha = await subirImagenWeb(archivo, $("#traer-sitio").value, { campana: $("#traer-campana").value,
        anyo: $("#traer-anyo").value.trim(), santuario: $("#traer-santuario").value.trim() },
    $("#traer-nombre").value.trim() || archivo.files[0].name.replace(/\.[^.]+$/, ""),
    { carpeta: $("#traer-carpeta").value.trim() });
    ocuparWeb([boton], false);
    const salida = $("[data-traer-salida]");
    salida.textContent = "";
    if (!hecha || hecha.error) {
        avisarEditor((hecha && hecha.error) || "No ha llegado ninguna imagen.", true);
        return;
    }
    archivo.value = "";
    $("[data-traer-elegida]").textContent = "";
    avisarEditor("Traída: " + hecha.ruta + " (" + hecha.aviso + ").");
    salida.appendChild(crearEditor("p", "", "Ruta, tal y como va en un JSON o en una página:"));
    const ruta = document.createElement("input");
    ruta.readOnly = true;
    ruta.value = hecha.ruta;
    ruta.setAttribute("aria-label", "Ruta de la imagen traída");
    salida.appendChild(ruta);
    const copiar = crearEditor("button", "", "Copiarla");
    copiar.type = "button";
    copiar.addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(hecha.ruta);
            avisarEditor("Copiada: " + hecha.ruta);
        } catch (error) {
            ruta.select();
        }
    });
    salida.appendChild(copiar);
    ruta.focus();
    ruta.select();
}

async function correrHerramientaWeb(ruta, texto) {
    const botones = document.querySelectorAll("[data-repasar], [data-regenerar]");
    ocuparWeb(botones, true);
    const hecho = await seguirTareaWeb(await pedirEditor(ruta, {}), texto);
    ocuparWeb(botones, false);
    if (hecho.error) {
        avisarEditor(hecho.error, true, hecho.salida);
        return;
    }
    avisarEditor("Hecho, todo bien.", false, hecho.salida);
}

// ---- LOS COMANDOS ----
async function pintarComandosWeb() {
    const caja = $("[data-comandos]");
    if (caja.childElementCount) {
        return;
    }
    const datos = await pedirEditor("/api/web/comandos");
    if (datos.error) {
        avisarEditor(datos.error, true);
        return;
    }
    datos.apartados.forEach((a, n) => {
        if (!a.opciones.length) {
            return;
        }
        const sec = crearEditor("section", "bloque");
        sec.setAttribute("aria-labelledby", "t-comandos-" + n);
        const h = crearEditor("h2", "", (n + 1) + ". " + a.nombre);
        h.id = "t-comandos-" + n;
        sec.appendChild(h);
        sec.appendChild(crearEditor("p", "ayuda", a.de_que));
        const ul = crearEditor("ul", "faltan");
        a.opciones.forEach((o) => {
            const li = document.createElement("li");
            const texto = crearEditor("span");
            texto.appendChild(crearEditor("span", "faltan-veces", o.cual + " "));
            texto.appendChild(crearEditor("span", "faltan-nombre", o.titulo));
            texto.appendChild(crearEditor("span", "comando-pista", o.pista));
            const b = crearEditor("button", "", "Abrir");
            b.type = "button";
            b.setAttribute("aria-label", "Abrir " + o.titulo);
            b.addEventListener("click", () => abrirComandoWeb(o.cual));
            li.appendChild(texto);
            li.appendChild(b);
            ul.appendChild(li);
        });
        sec.appendChild(ul);
        caja.appendChild(sec);
    });
}

// ---- GUARDAR EN GITHUB: LA GUÍA ----
// Lo cambiado (si git está y esto es un repositorio) y los comandos, ya
// con la carpeta, la rama y el mensaje, cada uno con «Copiar».
const ESTADO_GIT_WEB = { datos: null };

async function pintarGitWeb() {
    const hecho = await pedirEditor("/api/web/git");
    if (hecho.error) {
        $("[data-git-estado]").textContent = hecho.error;
        return;
    }
    ESTADO_GIT_WEB.datos = hecho;
    const lista = $("[data-git-cambios]");
    lista.textContent = "";
    $("[data-git-estado]").textContent = hecho.aviso || ("Estás en la rama «" + hecho.rama + "»"
        + (/^(main|master)$/.test(hecho.rama) ? " (la principal: lo que subas ahí sale en la web)" : "") + ". "
        + (hecho.cuantos ? (hecho.cuantos === 1 ? "1 archivo cambiado." : hecho.cuantos + " archivos cambiados.")
            : "No hay nada cambiado."));
    hecho.cambios.forEach((c) => lista.appendChild(crearEditor("li", "", c.que + ": " + c.archivo)));
    $("[data-git-cambios-caja]").hidden = !hecho.cambios.length;
    const mensaje = $("#git-mensaje");
    if (!mensaje.value) {
        mensaje.value = "Cambios del " + estadoFichas.hoy;
    }
    pintarPasosDeGitWeb();
}

function pasoDeGitWeb(lista, texto, comando) {
    const li = document.createElement("li");
    li.appendChild(crearEditor("p", "", texto));
    if (comando) {
        const fila = crearEditor("div", "git-comando");
        fila.appendChild(crearEditor("code", "", comando));
        const b = crearEditor("button", "", "Copiar");
        b.type = "button";
        b.setAttribute("aria-label", "Copiar: " + comando);
        b.addEventListener("click", async () => {
            try {
                await navigator.clipboard.writeText(comando);
                avisarEditor("Copiado: " + comando);
            } catch (e) {
                // Sin portapapeles: se deja elegido para copiarlo a mano.
                const r = document.createRange();
                r.selectNodeContents(fila.querySelector("code"));
                window.getSelection().removeAllRanges();
                window.getSelection().addRange(r);
                avisarEditor("No he podido copiarlo yo: está elegido, pulsa Ctrl+C.", true);
            }
        });
        fila.appendChild(b);
        li.appendChild(fila);
    }
    lista.appendChild(li);
}

function pintarPasosDeGitWeb() {
    const d = ESTADO_GIT_WEB.datos;
    if (!d) {
        return;
    }
    const rama = d.rama || "desarrollo";
    const mensaje = ($("#git-mensaje").value.trim() || "Cambios").replace(/"/g, "'");
    const pasos = $("[data-git-pasos]");
    pasos.textContent = "";
    pasoDeGitWeb(pasos, d.windows
        ? "Abre una ventana de comandos (tecla Windows, escribe cmd y Enter) y ve a la carpeta del proyecto:"
        : "Abre una terminal y ve a la carpeta del proyecto:",
    (d.windows ? "cd /d \"" : "cd \"") + d.carpeta + "\"");
    pasoDeGitWeb(pasos, "Mira qué ha cambiado (en rojo, lo que aún no está preparado):", "git status");
    pasoDeGitWeb(pasos, "Trae lo último de GitHub, por si hay algo subido desde otro sitio:", "git pull");
    pasoDeGitWeb(pasos, "Prepara todo lo cambiado:", "git add -A");
    pasoDeGitWeb(pasos, "Guárdalo con su mensaje (un commit):", "git commit -m \"" + mensaje + "\"");
    pasoDeGitWeb(pasos, "Súbelo a GitHub, a tu rama (la primera vez puede pedirte entrar en GitHub):",
        "git push origin " + rama);
    const deshacer = $("[data-git-deshacer]");
    deshacer.textContent = "";
    pasoDeGitWeb(deshacer, "Ver los últimos commits (los cambios guardados), del más nuevo al más viejo:",
        "git log --oneline -5");
    pasoDeGitWeb(deshacer, "Quitar el último commit que AÚN NO has subido, pero quedándote con los cambios (como"
        + " si no lo hubieras guardado; luego puedes volver a hacerlo con otro mensaje):", "git reset --soft HEAD~1");
    pasoDeGitWeb(deshacer, "Quitar el último commit que AÚN NO has subido y tirar sus cambios (se pierde):",
        "git reset --hard HEAD~1");
    pasoDeGitWeb(deshacer, "Deshacer un commit que YA está subido: crea otro commit que lo deshace (no se pierde"
        + " nada, queda en la historia). Después, súbelo con git push origin " + rama + ":", "git revert HEAD");
    pasoDeGitWeb(deshacer, "Tirar todo lo cambiado que aún no has guardado con commit, en archivos que ya existían"
        + " (se pierde):", "git restore .");
    pasoDeGitWeb(deshacer, "Y borrar los archivos nuevos que aún no has guardado (se pierden; para ver antes cuáles"
        + " serían: git clean -n):", "git clean -fd");
    pasoDeGitWeb(deshacer, "Dejarlo todo exactamente como está en GitHub, en tu rama, tirando lo tuyo que no esté"
        + " subido (se pierde):", "git fetch origin && git reset --hard origin/" + rama);
    const otros = $("[data-git-otros]");
    otros.textContent = "";
    pasoDeGitWeb(otros, "Pasar lo de la rama desarrollo a main (lo que sale en la web), y volver a desarrollo."
        + " Coge el desarrollo de GitHub (no el que tengas aquí, que puede estar viejo) y solo avanza: si main y"
        + " desarrollo se han separado, se para y no mezcla nada:",
    "git fetch origin && git switch main && git merge --ff-only origin/main && git merge --ff-only origin/desarrollo"
        + " && git push origin main && git switch desarrollo && git merge --ff-only origin/desarrollo");
    pasoDeGitWeb(otros, "Si al juntar ramas salen conflictos (archivos con <<<<<<< dentro), echarse atrás y dejarlo"
        + " como estaba antes de juntar:", "git merge --abort");
    pasoDeGitWeb(otros, "Cambiar a la rama desarrollo (o a main, cambiando el nombre):", "git switch desarrollo");
    pasoDeGitWeb(otros, "Tirar lo cambiado en un solo archivo que aún no has guardado con commit (se pierde):",
        "git restore \"ruta/del/archivo\"");
    pasoDeGitWeb(otros, "Si la carpeta no es un repositorio (git dice «not a git repository»), bájalo de GitHub"
        + " en una carpeta nueva:", "git clone " + d.repositorio);
    pasoDeGitWeb(otros, "Si no tienes git, se instala desde git-scm.com/downloads (en Windows, con lo que trae por"
        + " defecto). Después, una vez, dile quién eres:", "git config --global user.name \"Richi\"");
    pasoDeGitWeb(otros, "Y tu correo (el de GitHub):", "git config --global user.email \"tu@correo\"");
}

async function abrirComandoWeb(cual) {
    const hecho = await pedirEditor("/api/web/comando", { cual });
    if (hecho.error) {
        avisarEditor(hecho.error, true);
        return;
    }
    avisarEditor("Abierto en su ventana de comandos: " + hecho.titulo + ". Contesta allí lo que pregunte.");
}

function empezarFichasWeb() {
    document.querySelectorAll('[data-ir="comandos"]').forEach((b) => {
        b.addEventListener("click", pintarComandosWeb);
        b.addEventListener("click", pintarGitWeb);
    });
    $("[data-git-mirar]").addEventListener("click", pintarGitWeb);
    $("#git-mensaje").addEventListener("input", pintarPasosDeGitWeb);
    $("[data-comando-menu]").addEventListener("click", () => abrirComandoWeb(""));
    cargarColeccionesWeb();
    $("[data-fichas-guardar]").addEventListener("click", guardarFichasWeb);
    $("#fichas-campana").addEventListener("change", (e) => {
        const nueva = e.target.value;
        if (estadoFichas.cambiado && !window.confirm("Hay cambios sin guardar. ¿Cambiar de campaña igualmente?")) {
            e.target.value = estadoFichas.campana;
            return;
        }
        estadoFichas.cambiado = false;
        abrirFichasWeb(estadoFichas.id, nueva);
    });
    $("[data-gatos-subir]").addEventListener("click", subirFotosDeGatoWeb);
    $("#gatos-fotos").addEventListener("change", (e) => {
        const n = (e.target.files || []).length;
        $("[data-gatos-elegidas]").textContent = n ? (n === 1 ? "1 foto elegida." : n + " fotos elegidas.") : "";
    });
    $("[data-traer]").addEventListener("submit", (e) => {
        e.preventDefault();
        traerImagenWeb();
    });
    $("#traer-archivo").addEventListener("change", (e) => {
        const f = e.target.files && e.target.files[0];
        $("[data-traer-elegida]").textContent = f ? "Elegida: " + f.name : "";
    });
    $("[data-repasar]").addEventListener("click", () => correrHerramientaWeb("/api/web/repasar", "Repasando el sitio…"));
    $("[data-regenerar]").addEventListener("click", () => correrHerramientaWeb("/api/web/regenerar", "Generando…"));
    document.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && !$('[data-vista="fichas"]').hidden) {
            e.preventDefault();
            guardarFichasWeb();
        }
    });
    estadoFichas.hoy = (() => {
        const d = new Date();
        return String(d.getDate()).padStart(2, "0") + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + d.getFullYear();
    })();
}

empezarFichasWeb();
