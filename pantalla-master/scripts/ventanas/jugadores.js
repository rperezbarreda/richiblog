// =========================================
// LA VENTANA «jugadores» de la pantalla de máster (sale de
// pantalla-master.js; se carga antes que él). Lo que usa del núcleo,
// por window.ocPM («PM.algo»); lo que el núcleo usa de aquí, a PM al final.
// =========================================
(function () {
    const PM = window.ocPM = window.ocPM || {};

    function abrirJugadores() {
        const w = window.open("jugadores.html", "pantalla-master-jugadores", "popup,width=1100,height=720");
        if (w) {
            w.focus();
            PM.avisar(ocT("Pantalla de jugadores abierta: llévala a la tele o compártela."));
        } else {
            PM.avisar(ocT("El navegador no ha dejado abrir la ventana: permite las ventanas emergentes de esta página."));
        }
    }

    function montarJugadores(dentro, m) {
        const j = PM.datosJug();
        const abrir = PM.botonDe("oc-vida-accion es-principal", ocT("🪟 abrir la pantalla de jugadores"), abrirJugadores,
            ocT("Abrir la pantalla de jugadores (una ventana aparte para la tele, Discord u OBS)"));
        const ahora = PM.crear("p", "master-jug-ahora");
        ahora.setAttribute("aria-live", "polite");
        const MODOS = [["espera", ocT("⏸ espera")], ["imagen", ocT("🖼️ imagen")], ["texto", ocT("📜 texto")], ["iniciativa", ocT("⏱️ iniciativa")]];
        const modos = PM.crear("div", "master-musica-modos");
        modos.setAttribute("role", "group");
        modos.setAttribute("aria-label", ocT("Qué ven los jugadores"));
        const bModos = MODOS.map(([v, t]) => {
            const b = PM.botonDe("master-musica-modo", t, () => PM.mostrarAJugadores({ modo: v }).then(pintar));
            b.dataset.modo = v;
            modos.appendChild(b);
            return b;
        });
        const campoDe = (texto, control, id) => {
            const caja = PM.crear("div", "master-campo");
            const et = PM.crear("label", "oc-dados-etiqueta", texto);
            control.id = id + m.id;
            et.htmlFor = control.id;
            caja.append(et, control);
            return caja;
        };
        const tit = PM.crear("input", "oc-dados-texto");
        tit.maxLength = 120;
        tit.autocomplete = "off";
        tit.placeholder = ocT("La cripta olvidada");
        const txt = PM.crear("textarea", "oc-dados-texto");
        txt.rows = 5;
        txt.placeholder = ocT("Lo que leen (admite **negrita**, *cursiva* y listas «- »). En espera: lo que se ve en grande.");
        const poner = PM.crear("button", "oc-vida-accion es-principal", ocT("📺 enseñar el título y el texto"));
        poner.type = "submit";
        const form = PM.crear("form", "master-jug-form");
        form.append(campoDe(ocT("título (arriba, en grande; opcional)"), tit, "master-jug-titulo-"), campoDe(ocT("texto"), txt, "master-jug-texto-"),
            poner);
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            PM.mostrarAJugadores({ titulo: tit.value.trim(), texto: txt.value, modo: j.modo === "imagen" || j.modo === "iniciativa" ? j.modo
                : txt.value.trim() ? "texto" : "espera" }).then(pintar);
            PM.avisar(ocT("Enseñado."));
        });
        const archivo = PM.crear("input");
        archivo.type = "file";
        archivo.accept = "image/*";
        archivo.hidden = true;
        archivo.addEventListener("change", () => {
            const f = archivo.files && archivo.files[0];
            archivo.value = "";
            if (!f || !/^image\//.test(f.type)) {
                return;
            }
            PM.mostrarAJugadores({ modo: "imagen" }, f).then(pintar);
        });
        const elegirImg = PM.botonDe("oc-vida-accion", ocT("🖼️ enseñar una imagen"), () => archivo.click(),
            ocT("Enseñar una imagen de tu dispositivo a los jugadores"));
        const etPg = PM.crear("label", "master-jug-pg");
        const conPg = PM.crear("input");
        conPg.type = "checkbox";
        conPg.checked = !!j.conPg;
        conPg.addEventListener("change", () => PM.mostrarAJugadores({ conPg: conPg.checked }));
        etPg.append(conPg, document.createTextNode(ocT(" en la iniciativa, los PG de la party (nunca los de los monstruos)")));
        const botones = PM.crear("div", "master-creador-barra");
        botones.append(elegirImg, archivo);
        function pintar() {
            bModos.forEach((b) => b.setAttribute("aria-pressed", b.dataset.modo === j.modo ? "true" : "false"));
            const t = (MODOS.find((x) => x[0] === j.modo) || MODOS[0])[1];
            ahora.textContent = ocT("Ahora ven: {t}{n}{n2}", { t: t, n: j.titulo ? " · «" + j.titulo + "»" : "", n2: j.modo === "imagen" && !j.imagen
                ? ocT(" (todavía no hay imagen: elige una o usa 📺 en un dibujo)") : "" });
            if (document.activeElement !== tit) {
                tit.value = j.titulo || "";
            }
            if (document.activeElement !== txt) {
                txt.value = j.texto || "";
            }
        }
        dentro.replaceChildren(abrir, ahora, modos, botones, form, etPg, PM.crear("p", "oc-hoja-nota", ocT("Lo que elijas aquí es lo único que se ve en esa ventana: cambia de tablero tranquilamente. En un 🎨 dibujo, 📺 lo manda tal cual (sin las capas escondidas).")));
        pintar();
        PM.mientrasEste(dentro, "master:jugadores", pintar);
    }

    Object.assign(PM, { montarJugadores });
})();
