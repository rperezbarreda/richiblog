// =========================================
// LA PANTALLA DE JUGADORES (jugadores.html)
// =========================================
// Una ventana para la tele o para compartir en Discord u OBS: enseña sólo
// lo que el máster elige en la ventana «📺 jugadores» (una imagen o el
// dibujo, un texto, la iniciativa sin los PG de los monstruos o una
// pantalla de espera). Habla con la pantalla de máster por el canal
// «pantalla-master-jugadores»: {t: "hola"} al abrirse; le llega
// {t: "estado", modo, titulo, texto, imagen, ini, tema}.

(function () {
    "use strict";

    const titulo = document.querySelector("[data-jug-titulo]");
    const dentro = document.querySelector("[data-jug-dentro]");
    const aviso = document.querySelector("[data-jug-aviso]");
    const crear = (tag, clase, texto) => {
        const x = document.createElement(tag);
        if (clase) {
            x.className = clase;
        }
        if (texto !== undefined) {
            x.textContent = texto;
        }
        return x;
    };
    if (!("BroadcastChannel" in window)) {
        aviso.textContent = ocT("Este navegador no puede hablar con la pantalla de máster.");
        return;
    }
    const canal = new BroadcastChannel("pantalla-master-jugadores");
    let ultimo = 0;

    // Un texto con «**negrita**», «*cursiva*», párrafos y listas «- ».
    function texto(t) {
        const caja = crear("div", "jug-texto");
        String(t || "").split(/\n{2,}/).forEach((bloque) => {
            const lineas = bloque.split("\n");
            const pon = (sitio, linea) => {
                linea.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/).forEach((trozo) => {
                    const n = /^\*\*([^*]+)\*\*$/.exec(trozo);
                    const c = /^\*([^*]+)\*$/.exec(trozo);
                    sitio.appendChild(n ? crear("strong", "", n[1]) : c ? crear("em", "", c[1]) : document.createTextNode(trozo));
                });
            };
            if (lineas.every((l) => /^- /.test(l))) {
                const ul = crear("ul");
                lineas.forEach((l) => {
                    const li = crear("li");
                    pon(li, l.slice(2));
                    ul.appendChild(li);
                });
                caja.appendChild(ul);
            } else {
                const p = crear("p");
                lineas.forEach((l, i) => {
                    if (i) {
                        p.appendChild(crear("br"));
                    }
                    pon(p, l);
                });
                caja.appendChild(p);
            }
        });
        return caja;
    }

    function pintar(e) {
        ultimo = Date.now();
        aviso.textContent = "";
        if (e.tema !== undefined) {
            if (e.tema) {
                document.documentElement.setAttribute("data-theme", e.tema);
            } else {
                document.documentElement.removeAttribute("data-theme");
            }
        }
        document.body.dataset.modo = e.modo || "espera";
        titulo.textContent = e.titulo || ocT("Pantalla de jugadores");
        titulo.classList.toggle("visually-hidden", !e.titulo);
        document.title = ocT("{n}Pantalla de jugadores", { n: e.titulo ? e.titulo + " · " : "" });
        if (e.modo === "imagen" && e.imagen) {
            const img = crear("img", "jug-imagen");
            img.alt = e.titulo || "Imagen";
            img.src = e.imagen;
            dentro.replaceChildren(img);
        } else if (e.modo === "texto") {
            dentro.replaceChildren(texto(e.texto));
        } else if (e.modo === "iniciativa") {
            const ini = e.ini || { lista: [] };
            if (!ini.lista.length) {
                dentro.replaceChildren(crear("p", "jug-vacio", ocT("Todavía no hay nadie en la iniciativa.")));
                return;
            }
            const ronda = crear("p", "jug-ronda", ini.combate ? ocT("Ronda {ronda}", { ronda: ini.ronda }) : ocT("Preparando el combate"));
            const ol = crear("ol", "jug-ini");
            ini.lista.forEach((c, i) => {
                const li = crear("li", "jug-ini-fila" + (ini.combate && i === ini.turno ? " es-su-turno" : ""));
                li.style.borderLeftColor = c.color || "";
                if (ini.combate && i === ini.turno) {
                    li.setAttribute("aria-current", "true");
                    li.appendChild(crear("span", "jug-le-toca", ocT("▶ le toca")));
                }
                li.appendChild(crear("span", "jug-ini-nombre", c.nombre));
                if (c.marcas && c.marcas.length) {
                    li.appendChild(crear("span", "jug-ini-marcas", c.marcas.join(" ")));
                }
                if (c.pg !== undefined && c.pg !== "") {
                    li.appendChild(crear("span", "jug-ini-pg", ocT("{n} PG", { n: c.pg + (c.pgmax ? " / " + c.pgmax : "") })));
                }
                ol.appendChild(li);
            });
            dentro.replaceChildren(ronda, ol);
        } else {
            dentro.replaceChildren(crear("p", "jug-espera", e.texto || "🎲"));
        }
    }

    canal.addEventListener("message", (ev) => {
        const e = ev.data || {};
        if (e.t === "estado") {
            pintar(e);
        }
    });
    canal.postMessage({ t: "hola" });
    setInterval(() => {
        if (Date.now() - ultimo > 4000) {
            canal.postMessage({ t: "hola" });
            if (Date.now() - ultimo > 6000) {
                aviso.textContent = ocT("No encuentro la pantalla de máster: ábrela en este mismo navegador.");
            }
        }
    }, 2000);
}());
