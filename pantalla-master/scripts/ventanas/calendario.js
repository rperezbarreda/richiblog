// =========================================
// LA VENTANA «calendario» de la pantalla de máster (sale de
// pantalla-master.js; se carga antes que él). Lo que usa del núcleo,
// por window.ocPM («PM.algo»); lo que el núcleo usa de aquí, a PM al final.
// =========================================
(function () {
    const PM = window.ocPM = window.ocPM || {};

    // ---- EL CALENDARIO de la partida: gregoriano, el de Harptos (el de
    // los Reinos Olvidados: meses de 30 días, decanarios y fiestas; los
    // nombres, en master-tablas.json) o uno propio (meses y días de la
    // semana a mano: el de Cralëa, por ejemplo). Con la fecha y la hora de
    // la partida (y botones para que pase el tiempo) y apuntes por día. ----
    const MESES_GREGORIANO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre",
        "noviembre", "diciembre"];
    const SEMANA_GREGORIANO = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

    function montarCalendario(dentro, m) {
        m.datos = m.datos || {};
        dentro.appendChild(PM.crear("p", "oc-hoja-nota", ocT("Cargando…")));
        PM.pedir(PM.TABLAS).then((tablas) => {
            const d = m.datos;
            const hoyReal = new Date();
            d.tipo = d.tipo || "gregoriano";
            d.propio = Object.assign({ nombre: "propio", anio: "", meses: ocT("Primero: 30\nSegundo: 30\nTercero: 30\nCuarto: 30"),
                semana: ocT("uno, dos, tres, cuatro, cinco, seis, siete") }, d.propio || {});
            d.apuntes = d.apuntes || {};
            const harptos = tablas.calendarios.harptos;
            // Los meses de un año (con sus días; las fiestas, de 1 día).
            const mesesDe = (anio) => {
                if (d.tipo === "gregoriano") {
                    return MESES_GREGORIANO.map((nombre, i) => ({ nombre, dias: new Date(anio, i + 1, 0).getDate() }));
                }
                if (d.tipo === "harptos") {
                    return harptos.meses.filter((x) => !x.cada || anio % x.cada === 0);
                }
                return d.propio.meses.split("\n").map((l) => l.split(":")).filter((x) => x[0].trim())
                    .map(([nombre, dias]) => ({ nombre: nombre.trim(), dias: Math.max(1, Math.min(100, parseInt(dias, 10) || 30)) }));
            };
            const semana = () => (d.tipo === "gregoriano" ? SEMANA_GREGORIANO : d.tipo === "harptos" ? harptos.dias
                : d.propio.semana.split(",").map((x) => x.trim()).filter(Boolean));
            const sufijo = () => (d.tipo === "harptos" ? " " + harptos.anio : d.tipo === "propio" && d.propio.anio ? " " + d.propio.anio : "");
            // Qué día de la semana es (0…): el gregoriano, por el de verdad;
            // el de Harptos, el decanario empieza cada mes; el propio, seguido.
            const diaSemana = (f) => {
                if (d.tipo === "gregoriano") {
                    return (new Date(f.anio, f.mes, f.dia).getDay() + 6) % 7;
                }
                if (d.tipo === "harptos") {
                    return (f.dia - 1) % 10;
                }
                const meses = mesesDe(f.anio);
                const largo = meses.reduce((t, x) => t + x.dias, 0);
                let n = (f.anio - 1) * largo;
                for (let i = 0; i < f.mes; i++) {
                    n += meses[i].dias;
                }
                n += f.dia - 1;
                const s = semana().length || 7;
                return ((n % s) + s) % s;
            };
            const arreglar = (f) => {
                const meses = mesesDe(f.anio);
                f.mes = Math.min(Math.max(0, f.mes), meses.length - 1);
                f.dia = Math.min(Math.max(1, f.dia), meses[f.mes].dias);
                return f;
            };
            if (!d.fecha) {
                d.fecha = d.tipo === "gregoriano" ? { anio: hoyReal.getFullYear(), mes: hoyReal.getMonth(), dia: hoyReal.getDate() }
                    : { anio: 1492, mes: 0, dia: 1 };
                d.hora = 8;
            }
            arreglar(d.fecha);
            d.viendo = d.viendo || { anio: d.fecha.anio, mes: d.fecha.mes };
            const clave = (f) => d.tipo + ":" + f.anio + "-" + f.mes + "-" + f.dia;
            const nombreFecha = (f) => {
                const mes = mesesDe(f.anio)[f.mes];
                if (mes.fiesta) {
                    return ocT("{nombre} de {anio}{sufijo}", { nombre: mes.nombre, anio: f.anio, sufijo: sufijo() });
                }
                const dia = d.tipo === "gregoriano" ? ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"][diaSemana(f)]
                    + " " + f.dia : d.tipo === "harptos" ? ocT("día {dia}", { dia: f.dia }) : f.dia + " (" + semana()[diaSemana(f)] + ")";
                return ocT("{dia} de {nombre} de {anio}{sufijo}", { dia: dia, nombre: mes.nombre, anio: f.anio, sufijo: sufijo() });
            };
            const momento = (h) => (h < 6 ? ocT("de madrugada") : h < 12 ? ocT("por la mañana") : h < 14 ? ocT("a mediodía") : h < 20 ? ocT("por la tarde")
                : ocT("por la noche"));
            // Que pase el tiempo (en horas; con días si se pasa de 24).
            const pasar = (horas) => {
                let h = (d.hora || 0) + horas;
                let dias = Math.floor(h / 24);
                h = ((h % 24) + 24) % 24;
                d.hora = h;
                const f = d.fecha;
                while (dias > 0) {
                    f.dia++;
                    if (f.dia > mesesDe(f.anio)[f.mes].dias) {
                        f.dia = 1;
                        f.mes++;
                        if (f.mes >= mesesDe(f.anio).length) {
                            f.mes = 0;
                            f.anio++;
                        }
                    }
                    dias--;
                }
                while (dias < 0) {
                    f.dia--;
                    if (f.dia < 1) {
                        f.mes--;
                        if (f.mes < 0) {
                            f.anio--;
                            f.mes = mesesDe(f.anio).length - 1;
                        }
                        f.dia = mesesDe(f.anio)[f.mes].dias;
                    }
                    dias++;
                }
                d.viendo = { anio: f.anio, mes: f.mes };
                PM.guardar();
                pintar();
                PM.avisar(ocT("Ahora: {nombreFecha}, a las {hora}:00 ({momento}).", { nombreFecha: nombreFecha(f), hora: d.hora, momento: momento(d.hora) }));
                // Para los efectos con duración (que cuentan las horas).
                document.dispatchEvent(new CustomEvent("master:tiempo", { detail: { horas } }));
            };
            // ARRIBA: qué calendario, la fecha de la partida y el tiempo.
            const tipo = PM.elegirDe("master-cal-tipo-" + m.id, ocT("calendario"), [["gregoriano", ocT("gregoriano")], ["harptos", harptos.nombre],
                ["propio", ocT("propio")]], d.tipo);
            tipo.elegir.addEventListener("change", () => {
                d.tipo = tipo.elegir.value;
                d.fecha = d.tipo === "gregoriano" ? { anio: hoyReal.getFullYear(), mes: hoyReal.getMonth(), dia: hoyReal.getDate() }
                    : { anio: d.tipo === "harptos" ? 1492 : 1, mes: 0, dia: 1 };
                d.viendo = { anio: d.fecha.anio, mes: d.fecha.mes };
                PM.guardar();
                pintar();
                PM.avisar(ocT("Calendario {textContent}.", { textContent: tipo.elegir.selectedOptions[0].textContent }));
            });
            const ahora = PM.crear("p", "master-cal-ahora");
            ahora.setAttribute("aria-live", "polite");
            const tiempo = PM.crear("div", "master-cal-tiempo");
            tiempo.setAttribute("role", "group");
            tiempo.setAttribute("aria-label", ocT("Que pase el tiempo"));
            [[ocT("−1 día"), -24], [ocT("+1 h"), 1], [ocT("+8 h (descanso largo)"), 8], [ocT("+1 día"), 24], [ocT("+1 semana"), 0]].forEach(([texto, h]) => {
                tiempo.appendChild(PM.botonDe("oc-vida-accion", texto, () => pasar(h || 24 * (semana().length || 7))));
            });
            // EL PROPIO: meses (uno por línea, «nombre: días»), días de la
            // semana y lo que va detrás del año.
            const propio = PM.crear("div", "master-cal-propio");
            const etMeses = PM.crear("label", "oc-dados-etiqueta", ocT("meses (uno por línea: «nombre: días»)"));
            const meses = PM.crear("textarea", "oc-notas-texto es-corta");
            meses.id = "master-cal-meses-" + m.id;
            etMeses.htmlFor = meses.id;
            meses.value = d.propio.meses;
            const etSemana = PM.crear("label", "oc-dados-etiqueta", ocT("días de la semana (separados por comas)"));
            const sem = PM.crear("input", "master-elegir");
            sem.id = "master-cal-semana-" + m.id;
            etSemana.htmlFor = sem.id;
            sem.value = d.propio.semana;
            const etAnio = PM.crear("label", "oc-dados-etiqueta", ocT("detrás del año (DEM, AEM…)"));
            const anio = PM.crear("input", "master-elegir");
            anio.id = "master-cal-anio-" + m.id;
            etAnio.htmlFor = anio.id;
            anio.value = d.propio.anio;
            const etNum = PM.crear("label", "oc-dados-etiqueta", ocT("año de la partida"));
            const numAnio = PM.crear("input", "master-elegir");
            numAnio.type = "number";
            numAnio.id = "master-cal-num-" + m.id;
            etNum.htmlFor = numAnio.id;
            const usar = PM.botonDe("oc-vida-accion", ocT("✔ usar"), () => {
                Object.assign(d.propio, { meses: meses.value, semana: sem.value, anio: anio.value.trim() });
                d.fecha.anio = parseInt(numAnio.value, 10) || d.fecha.anio;
                arreglar(d.fecha);
                d.viendo = { anio: d.fecha.anio, mes: d.fecha.mes };
                PM.guardar();
                pintar();
                PM.avisar(ocT("Calendario propio puesto."));
            });
            propio.append(etMeses, meses, etSemana, sem, etAnio, anio, etNum, numAnio, usar);
            // EL MES: en rejilla, con ‹ › para cambiar de mes.
            const cabeza = PM.crear("div", "master-cal-cabeza");
            const titulo = PM.crear("h3", "master-cal-mes");
            titulo.setAttribute("aria-live", "polite");
            const verMes = (paso) => {
                let { anio: a, mes: me } = d.viendo;
                me += paso;
                if (me < 0) {
                    a--;
                    me = mesesDe(a).length - 1;
                } else if (me >= mesesDe(a).length) {
                    a++;
                    me = 0;
                }
                d.viendo = { anio: a, mes: me };
                PM.guardar();
                pintarMes();
            };
            const antes = PM.botonDe("master-pestana-mando", "‹", () => verMes(-1), ocT("Mes anterior"));
            const despues = PM.botonDe("master-pestana-mando", "›", () => verMes(1), ocT("Mes siguiente"));
            const volver = PM.botonDe("oc-vida-accion", ocT("hoy"), () => {
                d.viendo = { anio: d.fecha.anio, mes: d.fecha.mes };
                PM.guardar();
                pintarMes();
            }, ocT("Volver al mes de la partida"));
            cabeza.append(antes, titulo, despues, volver);
            const rejilla = PM.crear("table", "master-cal-rejilla");
            // El día elegido y sus apuntes.
            let elegido = Object.assign({}, d.fecha);
            const etDia = PM.crear("label", "oc-dados-etiqueta");
            const apunte = PM.crear("textarea", "oc-notas-texto es-corta");
            apunte.id = "master-cal-apunte-" + m.id;
            etDia.htmlFor = apunte.id;
            apunte.rows = 3;
            const esHoy = PM.botonDe("oc-vida-accion", ocT("📍 que la partida esté en este día"), () => {
                d.fecha = Object.assign({}, elegido);
                PM.guardar();
                pintar();
                PM.avisar(ocT("La partida está en {nombreFecha}.", { nombreFecha: nombreFecha(d.fecha) }));
            });
            let espera = 0;
            apunte.addEventListener("input", () => {
                clearTimeout(espera);
                espera = setTimeout(() => {
                    if (apunte.value.trim()) {
                        d.apuntes[clave(elegido)] = apunte.value;
                    } else {
                        delete d.apuntes[clave(elegido)];
                    }
                    PM.guardar();
                    pintarMes();
                }, 400);
            });
            const pintarDia = () => {
                etDia.textContent = ocT("apuntes del {nombreFecha}", { nombreFecha: nombreFecha(elegido) });
                apunte.value = d.apuntes[clave(elegido)] || "";
            };
            function pintarMes() {
                const { anio: a, mes: me } = d.viendo;
                const lista = mesesDe(a);
                const mes = lista[Math.min(me, lista.length - 1)];
                titulo.textContent = ocT("{nombre} de {a}{sufijo}", { nombre: mes.nombre, a: a, sufijo: sufijo() });
                const dias = semana();
                const cols = Math.max(1, dias.length);
                const cab = PM.crear("tr");
                dias.forEach((x) => cab.appendChild(PM.crear("th", "", x)));
                const filas = [cab];
                let fila = PM.crear("tr");
                const hueco = mes.fiesta ? 0 : diaSemana({ anio: a, mes: me, dia: 1 });
                for (let i = 0; i < hueco; i++) {
                    fila.appendChild(PM.crear("td"));
                }
                for (let dia = 1; dia <= mes.dias; dia++) {
                    const f = { anio: a, mes: me, dia };
                    const td = PM.crear("td");
                    const b = PM.botonDe("master-cal-dia", String(dia), () => {
                        elegido = f;
                        pintarMes();
                        pintarDia();
                        apunte.focus();
                    }, nombreFecha(f) + (d.apuntes[clave(f)] ? ocT(" (con apuntes)") : ""));
                    if (a === d.fecha.anio && me === d.fecha.mes && dia === d.fecha.dia) {
                        b.classList.add("es-hoy");
                        b.setAttribute("aria-current", "date");
                    }
                    if (a === elegido.anio && me === elegido.mes && dia === elegido.dia) {
                        b.classList.add("es-elegido");
                    }
                    if (d.apuntes[clave(f)]) {
                        b.classList.add("con-apunte");
                    }
                    td.appendChild(b);
                    fila.appendChild(td);
                    if (fila.children.length === cols || mes.fiesta) {
                        filas.push(fila);
                        fila = PM.crear("tr");
                    }
                }
                if (fila.children.length) {
                    filas.push(fila);
                }
                rejilla.replaceChildren(...filas);
                rejilla.setAttribute("aria-label", titulo.textContent);
            }
            function pintar() {
                // La fecha, en texto, para quien la quiera (la línea temporal).
                d.textoHoy = nombreFecha(d.fecha);
                ahora.replaceChildren(PM.crear("strong", "", ocT("En la partida: ")), document.createTextNode(ocT("{nombreFecha}, a las {n}:00 ({momento})", { nombreFecha: nombreFecha(d.fecha), n: d.hora || 0, momento: momento(d.hora || 0) })));
                propio.hidden = d.tipo !== "propio";
                numAnio.value = d.fecha.anio;
                elegido = Object.assign({}, d.fecha);
                pintarMes();
                pintarDia();
            }
            const arriba = PM.crear("div", "master-nombres-form");
            arriba.append(tipo, propio, ahora, tiempo);
            dentro.replaceChildren(arriba, cabeza, rejilla, etDia, apunte, esHoy);
            pintar();
        }).catch(() => {
            dentro.replaceChildren(PM.crear("p", "oc-vacio", ocT("No he podido cargar los calendarios.")));
        });
    }

    Object.assign(PM, { montarCalendario });
})();
