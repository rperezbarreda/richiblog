// =========================================
// LAS DIRECCIONES QUE CAMBIARON DE SITIO
// =========================================
// Solo corre en la página de "esto no existe" (not_found.html), que es la
// que sirve Neocities para cualquier dirección que no encuentra. Neocities
// no deja hacer redirecciones de las de verdad, así que se hacen aquí: si
// lo que se pidió es una dirección vieja de algo que sigue existiendo con
// otro nombre, se va a la nueva sin pasar por el 404.
//
// Cada línea: [cómo empezaba, cómo empieza ahora]. Va la primera que
// cuadre, así que las concretas arriba y las generales abajo.
//
//   - La wiki se llamaba mundo/ hasta el 10-10-2026 (web/mundo/ y su
//     portada index_mundo.html).
//   - El 18-10-2026 cada país de la wiki pasó a tener su propia carpeta
//     (wiki/Mapamundi/Azarasia/Reino de Prunia/Reino de Prunia.md), así
//     que sus páginas también: …/azarasia/reino_de_prunia.html está ahora
//     en …/azarasia/reino_de_prunia/reino_de_prunia.html (y su mapa,
//     mapa_reino_de_prunia.html, a su lado).
//
// SI MUEVES OTRA COSA DE SITIO, apúntala aquí y las direcciones viejas que
// haya por ahí fuera seguirán llevando a algún sitio.
//
// La dirección nueva se arma cambiando el principio de la que se pidió y
// nada más, y solo si queda dentro de esta web: no hay forma de que un
// enlace mal intencionado mande a otra parte desde aquí.

(function () {
    const REDIRECCIONES = [
        // Los países, cada uno a su carpeta (18-10-2026).
        ["/web/wiki/mapamundi/archipielagos/archipielago_de_las_costras/ac_atapec.html", "/web/wiki/mapamundi/archipielagos/archipielago_de_las_costras/ac_atapec/ac_atapec.html"],
        ["/web/wiki/mapamundi/archipielagos/archipielago_de_las_costras/amequeleke.html", "/web/wiki/mapamundi/archipielagos/archipielago_de_las_costras/amequeleke/amequeleke.html"],
        ["/web/wiki/mapamundi/archipielagos/archipielago_de_las_costras/itzalcal.html", "/web/wiki/mapamundi/archipielagos/archipielago_de_las_costras/itzalcal/itzalcal.html"],
        ["/web/wiki/mapamundi/archipielagos/archipielago_de_las_costras/kukulna.html", "/web/wiki/mapamundi/archipielagos/archipielago_de_las_costras/kukulna/kukulna.html"],
        ["/web/wiki/mapamundi/archipielagos/archipielago_de_las_costras/mulz_aka.html", "/web/wiki/mapamundi/archipielagos/archipielago_de_las_costras/mulz_aka/mulz_aka.html"],
        ["/web/wiki/mapamundi/archipielagos/archipielago_de_las_costras/nahuatzal.html", "/web/wiki/mapamundi/archipielagos/archipielago_de_las_costras/nahuatzal/nahuatzal.html"],
        ["/web/wiki/mapamundi/archipielagos/archipielago_de_las_costras/nalchalcoatl.html", "/web/wiki/mapamundi/archipielagos/archipielago_de_las_costras/nalchalcoatl/nalchalcoatl.html"],
        ["/web/wiki/mapamundi/archipielagos/archipielago_de_las_costras/nictebrakka.html", "/web/wiki/mapamundi/archipielagos/archipielago_de_las_costras/nictebrakka/nictebrakka.html"],
        ["/web/wiki/mapamundi/archipielagos/archipielago_de_las_costras/tzeibalba.html", "/web/wiki/mapamundi/archipielagos/archipielago_de_las_costras/tzeibalba/tzeibalba.html"],
        ["/web/wiki/mapamundi/archipielagos/archipielago_de_las_costras/tzintara.html", "/web/wiki/mapamundi/archipielagos/archipielago_de_las_costras/tzintara/tzintara.html"],
        ["/web/wiki/mapamundi/archipielagos/archipielago_de_las_costras/tzompoc.html", "/web/wiki/mapamundi/archipielagos/archipielago_de_las_costras/tzompoc/tzompoc.html"],
        ["/web/wiki/mapamundi/archipielagos/archipielago_de_las_costras/yaxch_umekte.html", "/web/wiki/mapamundi/archipielagos/archipielago_de_las_costras/yaxch_umekte/yaxch_umekte.html"],
        ["/web/wiki/mapamundi/archipielagos/archipielago_de_lunas/baronia_de_ronco.html", "/web/wiki/mapamundi/archipielagos/archipielago_de_lunas/baronia_de_ronco/baronia_de_ronco.html"],
        ["/web/wiki/mapamundi/archipielagos/archipielago_de_lunas/corona_de_mogla.html", "/web/wiki/mapamundi/archipielagos/archipielago_de_lunas/corona_de_mogla/corona_de_mogla.html"],
        ["/web/wiki/mapamundi/archipielagos/archipielago_de_lunas/marquesado_de_al_daris.html", "/web/wiki/mapamundi/archipielagos/archipielago_de_lunas/marquesado_de_al_daris/marquesado_de_al_daris.html"],
        ["/web/wiki/mapamundi/archipielagos/archipielago_de_lunas/reino_de_yor.html", "/web/wiki/mapamundi/archipielagos/archipielago_de_lunas/reino_de_yor/reino_de_yor.html"],
        ["/web/wiki/mapamundi/archipielagos/cuna_de_quimeras.html", "/web/wiki/mapamundi/archipielagos/cuna_de_quimeras/cuna_de_quimeras.html"],
        ["/web/wiki/mapamundi/archipielagos/faros_del_mar_ciego/ahiu.html", "/web/wiki/mapamundi/archipielagos/faros_del_mar_ciego/ahiu/ahiu.html"],
        ["/web/wiki/mapamundi/archipielagos/faros_del_mar_ciego/aruta.html", "/web/wiki/mapamundi/archipielagos/faros_del_mar_ciego/aruta/aruta.html"],
        ["/web/wiki/mapamundi/archipielagos/faros_del_mar_ciego/haluka.html", "/web/wiki/mapamundi/archipielagos/faros_del_mar_ciego/haluka/haluka.html"],
        ["/web/wiki/mapamundi/archipielagos/faros_del_mar_ciego/hokupuko.html", "/web/wiki/mapamundi/archipielagos/faros_del_mar_ciego/hokupuko/hokupuko.html"],
        ["/web/wiki/mapamundi/archipielagos/faros_del_mar_ciego/kaelova.html", "/web/wiki/mapamundi/archipielagos/faros_del_mar_ciego/kaelova/kaelova.html"],
        ["/web/wiki/mapamundi/archipielagos/faros_del_mar_ciego/nalu_ele.html", "/web/wiki/mapamundi/archipielagos/faros_del_mar_ciego/nalu_ele/nalu_ele.html"],
        ["/web/wiki/mapamundi/archipielagos/faros_del_mar_ciego/nara_mana.html", "/web/wiki/mapamundi/archipielagos/faros_del_mar_ciego/nara_mana/nara_mana.html"],
        ["/web/wiki/mapamundi/archipielagos/faros_del_mar_ciego/popalola.html", "/web/wiki/mapamundi/archipielagos/faros_del_mar_ciego/popalola/popalola.html"],
        ["/web/wiki/mapamundi/archipielagos/faros_del_mar_ciego/talaiva.html", "/web/wiki/mapamundi/archipielagos/faros_del_mar_ciego/talaiva/talaiva.html"],
        ["/web/wiki/mapamundi/archipielagos/faros_del_mar_ciego/uluka.html", "/web/wiki/mapamundi/archipielagos/faros_del_mar_ciego/uluka/uluka.html"],
        ["/web/wiki/mapamundi/archipielagos/faros_del_mar_ciego/vanu_reki.html", "/web/wiki/mapamundi/archipielagos/faros_del_mar_ciego/vanu_reki/vanu_reki.html"],
        ["/web/wiki/mapamundi/archipielagos/faros_del_mar_ciego/varamo_a.html", "/web/wiki/mapamundi/archipielagos/faros_del_mar_ciego/varamo_a/varamo_a.html"],
        ["/web/wiki/mapamundi/archipielagos/isla_de_arbenia/reino_de_donotebra.html", "/web/wiki/mapamundi/archipielagos/isla_de_arbenia/reino_de_donotebra/reino_de_donotebra.html"],
        ["/web/wiki/mapamundi/archipielagos/isla_de_arbenia/senorio_de_pizaria.html", "/web/wiki/mapamundi/archipielagos/isla_de_arbenia/senorio_de_pizaria/senorio_de_pizaria.html"],
        ["/web/wiki/mapamundi/archipielagos/isla_de_arbenia/territorios_unidos_de_arbenia.html", "/web/wiki/mapamundi/archipielagos/isla_de_arbenia/territorios_unidos_de_arbenia/territorios_unidos_de_arbenia.html"],
        ["/web/wiki/mapamundi/archipielagos/isla_de_telvetia.html", "/web/wiki/mapamundi/archipielagos/isla_de_telvetia/isla_de_telvetia.html"],
        ["/web/wiki/mapamundi/archipielagos/islas_de_labros/corte_de_labros.html", "/web/wiki/mapamundi/archipielagos/islas_de_labros/corte_de_labros/corte_de_labros.html"],
        ["/web/wiki/mapamundi/archipielagos/islas_de_labros/paraje_de_agrimar.html", "/web/wiki/mapamundi/archipielagos/islas_de_labros/paraje_de_agrimar/paraje_de_agrimar.html"],
        ["/web/wiki/mapamundi/archipielagos/reino_de_zaustilla.html", "/web/wiki/mapamundi/archipielagos/reino_de_zaustilla/reino_de_zaustilla.html"],
        ["/web/wiki/mapamundi/archipielagos/tierras_encantadas/archipielago_fragmentado/costa_de_vlasquie.html", "/web/wiki/mapamundi/archipielagos/tierras_encantadas/archipielago_fragmentado/costa_de_vlasquie/costa_de_vlasquie.html"],
        ["/web/wiki/mapamundi/archipielagos/tierras_encantadas/archipielago_fragmentado/dominio_de_lyca.html", "/web/wiki/mapamundi/archipielagos/tierras_encantadas/archipielago_fragmentado/dominio_de_lyca/dominio_de_lyca.html"],
        ["/web/wiki/mapamundi/archipielagos/tierras_encantadas/archipielago_fragmentado/forja_de_aureb.html", "/web/wiki/mapamundi/archipielagos/tierras_encantadas/archipielago_fragmentado/forja_de_aureb/forja_de_aureb.html"],
        ["/web/wiki/mapamundi/archipielagos/tierras_encantadas/archipielago_fragmentado/horda_quebrada.html", "/web/wiki/mapamundi/archipielagos/tierras_encantadas/archipielago_fragmentado/horda_quebrada/horda_quebrada.html"],
        ["/web/wiki/mapamundi/archipielagos/tierras_encantadas/archipielago_fragmentado/morada_de_eeli.html", "/web/wiki/mapamundi/archipielagos/tierras_encantadas/archipielago_fragmentado/morada_de_eeli/morada_de_eeli.html"],
        ["/web/wiki/mapamundi/archipielagos/tierras_encantadas/archipielago_fragmentado/paraje_de_cereno.html", "/web/wiki/mapamundi/archipielagos/tierras_encantadas/archipielago_fragmentado/paraje_de_cereno/paraje_de_cereno.html"],
        ["/web/wiki/mapamundi/archipielagos/tierras_encantadas/archipielago_fragmentado/paramo_de_esnirma.html", "/web/wiki/mapamundi/archipielagos/tierras_encantadas/archipielago_fragmentado/paramo_de_esnirma/paramo_de_esnirma.html"],
        ["/web/wiki/mapamundi/archipielagos/tierras_encantadas/archipielago_fragmentado/ruinas_de_thalvyr.html", "/web/wiki/mapamundi/archipielagos/tierras_encantadas/archipielago_fragmentado/ruinas_de_thalvyr/ruinas_de_thalvyr.html"],
        ["/web/wiki/mapamundi/archipielagos/tierras_encantadas/archipielago_fragmentado/techo_de_az_nu.html", "/web/wiki/mapamundi/archipielagos/tierras_encantadas/archipielago_fragmentado/techo_de_az_nu/techo_de_az_nu.html"],
        ["/web/wiki/mapamundi/archipielagos/tierras_encantadas/franja_de_turia.html", "/web/wiki/mapamundi/archipielagos/tierras_encantadas/franja_de_turia/franja_de_turia.html"],
        ["/web/wiki/mapamundi/archipielagos/tierras_encantadas/horda_de_uspan.html", "/web/wiki/mapamundi/archipielagos/tierras_encantadas/horda_de_uspan/horda_de_uspan.html"],
        ["/web/wiki/mapamundi/archipielagos/tierras_encantadas/imperio_de_lezeris.html", "/web/wiki/mapamundi/archipielagos/tierras_encantadas/imperio_de_lezeris/imperio_de_lezeris.html"],
        ["/web/wiki/mapamundi/archipielagos/tierras_encantadas/infierno_frondoso.html", "/web/wiki/mapamundi/archipielagos/tierras_encantadas/infierno_frondoso/infierno_frondoso.html"],
        ["/web/wiki/mapamundi/archipielagos/tierras_encantadas/liga_de_golota.html", "/web/wiki/mapamundi/archipielagos/tierras_encantadas/liga_de_golota/liga_de_golota.html"],
        ["/web/wiki/mapamundi/archipielagos/tierras_encantadas/ojo_de_aglas.html", "/web/wiki/mapamundi/archipielagos/tierras_encantadas/ojo_de_aglas/ojo_de_aglas.html"],
        ["/web/wiki/mapamundi/archipielagos/tierras_encantadas/palacio_de_jan.html", "/web/wiki/mapamundi/archipielagos/tierras_encantadas/palacio_de_jan/palacio_de_jan.html"],
        ["/web/wiki/mapamundi/archipielagos/tierras_encantadas/reino_de_opalis.html", "/web/wiki/mapamundi/archipielagos/tierras_encantadas/reino_de_opalis/reino_de_opalis.html"],
        ["/web/wiki/mapamundi/archipielagos/tierras_encantadas/ruinas_de_nereth.html", "/web/wiki/mapamundi/archipielagos/tierras_encantadas/ruinas_de_nereth/ruinas_de_nereth.html"],
        ["/web/wiki/mapamundi/archipielagos/tierras_encantadas/santo_camino_de_kada.html", "/web/wiki/mapamundi/archipielagos/tierras_encantadas/santo_camino_de_kada/santo_camino_de_kada.html"],
        ["/web/wiki/mapamundi/azarasia/califato_de_jhel_zadir.html", "/web/wiki/mapamundi/azarasia/califato_de_jhel_zadir/califato_de_jhel_zadir.html"],
        ["/web/wiki/mapamundi/azarasia/canton_de_piedraspuras.html", "/web/wiki/mapamundi/azarasia/canton_de_piedraspuras/canton_de_piedraspuras.html"],
        ["/web/wiki/mapamundi/azarasia/condado_de_burcrecia.html", "/web/wiki/mapamundi/azarasia/condado_de_burcrecia/condado_de_burcrecia.html"],
        ["/web/wiki/mapamundi/azarasia/dominios_de_bor_korr_el_sanguinario.html", "/web/wiki/mapamundi/azarasia/dominios_de_bor_korr_el_sanguinario/dominios_de_bor_korr_el_sanguinario.html"],
        ["/web/wiki/mapamundi/azarasia/emirato_de_adrash.html", "/web/wiki/mapamundi/azarasia/emirato_de_adrash/emirato_de_adrash.html"],
        ["/web/wiki/mapamundi/azarasia/gran_condado_de_marturia.html", "/web/wiki/mapamundi/azarasia/gran_condado_de_marturia/gran_condado_de_marturia.html"],
        ["/web/wiki/mapamundi/azarasia/horda_de_yerzhal.html", "/web/wiki/mapamundi/azarasia/horda_de_yerzhal/horda_de_yerzhal.html"],
        ["/web/wiki/mapamundi/azarasia/imperio_de_nueva_valindra.html", "/web/wiki/mapamundi/azarasia/imperio_de_nueva_valindra/imperio_de_nueva_valindra.html"],
        ["/web/wiki/mapamundi/azarasia/mapa_reino_de_prunia.html", "/web/wiki/mapamundi/azarasia/reino_de_prunia/mapa_reino_de_prunia.html"],
        ["/web/wiki/mapamundi/azarasia/marca_de_elyarath.html", "/web/wiki/mapamundi/azarasia/marca_de_elyarath/marca_de_elyarath.html"],
        ["/web/wiki/mapamundi/azarasia/marquesado_de_setra.html", "/web/wiki/mapamundi/azarasia/marquesado_de_setra/marquesado_de_setra.html"],
        ["/web/wiki/mapamundi/azarasia/obispado_de_habaza.html", "/web/wiki/mapamundi/azarasia/obispado_de_habaza/obispado_de_habaza.html"],
        ["/web/wiki/mapamundi/azarasia/orden_de_clodia.html", "/web/wiki/mapamundi/azarasia/orden_de_clodia/orden_de_clodia.html"],
        ["/web/wiki/mapamundi/azarasia/principado_de_lunica.html", "/web/wiki/mapamundi/azarasia/principado_de_lunica/principado_de_lunica.html"],
        ["/web/wiki/mapamundi/azarasia/reino_de_dreustan.html", "/web/wiki/mapamundi/azarasia/reino_de_dreustan/reino_de_dreustan.html"],
        ["/web/wiki/mapamundi/azarasia/reino_de_nocravel.html", "/web/wiki/mapamundi/azarasia/reino_de_nocravel/reino_de_nocravel.html"],
        ["/web/wiki/mapamundi/azarasia/reino_de_oritania.html", "/web/wiki/mapamundi/azarasia/reino_de_oritania/reino_de_oritania.html"],
        ["/web/wiki/mapamundi/azarasia/reino_de_prunia.html", "/web/wiki/mapamundi/azarasia/reino_de_prunia/reino_de_prunia.html"],
        ["/web/wiki/mapamundi/azarasia/reino_de_solazada.html", "/web/wiki/mapamundi/azarasia/reino_de_solazada/reino_de_solazada.html"],
        ["/web/wiki/mapamundi/azarasia/reino_de_terredia.html", "/web/wiki/mapamundi/azarasia/reino_de_terredia/reino_de_terredia.html"],
        ["/web/wiki/mapamundi/azarasia/republica_mercantil_de_denatria.html", "/web/wiki/mapamundi/azarasia/republica_mercantil_de_denatria/republica_mercantil_de_denatria.html"],
        ["/web/wiki/mapamundi/azarasia/sultanato_de_doresia.html", "/web/wiki/mapamundi/azarasia/sultanato_de_doresia/sultanato_de_doresia.html"],
        ["/web/wiki/mapamundi/azarasia/tierras_de_traena.html", "/web/wiki/mapamundi/azarasia/tierras_de_traena/tierras_de_traena.html"],
        ["/web/wiki/mapamundi/azarasia/union_de_cuerza.html", "/web/wiki/mapamundi/azarasia/union_de_cuerza/union_de_cuerza.html"],
        ["/web/wiki/mapamundi/azarasia/union_de_las_cumbres_calcinadas.html", "/web/wiki/mapamundi/azarasia/union_de_las_cumbres_calcinadas/union_de_las_cumbres_calcinadas.html"],
        ["/web/wiki/mapamundi/partaria/academia_de_rosamica.html", "/web/wiki/mapamundi/partaria/academia_de_rosamica/academia_de_rosamica.html"],
        ["/web/wiki/mapamundi/partaria/alianza_de_sepon.html", "/web/wiki/mapamundi/partaria/alianza_de_sepon/alianza_de_sepon.html"],
        ["/web/wiki/mapamundi/partaria/bosque_de_utalis.html", "/web/wiki/mapamundi/partaria/bosque_de_utalis/bosque_de_utalis.html"],
        ["/web/wiki/mapamundi/partaria/ciudad_santa_de_ablanamaz.html", "/web/wiki/mapamundi/partaria/ciudad_santa_de_ablanamaz/ciudad_santa_de_ablanamaz.html"],
        ["/web/wiki/mapamundi/partaria/coronas_del_viento.html", "/web/wiki/mapamundi/partaria/coronas_del_viento/coronas_del_viento.html"],
        ["/web/wiki/mapamundi/partaria/cumbres_de_ath.html", "/web/wiki/mapamundi/partaria/cumbres_de_ath/cumbres_de_ath.html"],
        ["/web/wiki/mapamundi/partaria/custodios_de_parta.html", "/web/wiki/mapamundi/partaria/custodios_de_parta/custodios_de_parta.html"],
        ["/web/wiki/mapamundi/partaria/imperio_friscadio.html", "/web/wiki/mapamundi/partaria/imperio_friscadio/imperio_friscadio.html"],
        ["/web/wiki/mapamundi/partaria/maharato_de_sulkaladesh.html", "/web/wiki/mapamundi/partaria/maharato_de_sulkaladesh/maharato_de_sulkaladesh.html"],
        ["/web/wiki/mapamundi/partaria/mandato_de_acratang.html", "/web/wiki/mapamundi/partaria/mandato_de_acratang/mandato_de_acratang.html"],
        ["/web/wiki/mapamundi/partaria/mandato_de_nisi.html", "/web/wiki/mapamundi/partaria/mandato_de_nisi/mandato_de_nisi.html"],
        ["/web/wiki/mapamundi/partaria/mandato_de_panchan.html", "/web/wiki/mapamundi/partaria/mandato_de_panchan/mandato_de_panchan.html"],
        ["/web/wiki/mapamundi/partaria/mandato_de_taz_ju.html", "/web/wiki/mapamundi/partaria/mandato_de_taz_ju/mandato_de_taz_ju.html"],
        ["/web/wiki/mapamundi/partaria/mandato_de_zo.html", "/web/wiki/mapamundi/partaria/mandato_de_zo/mandato_de_zo.html"],
        ["/web/wiki/mapamundi/partaria/mercado_de_dao_yeni.html", "/web/wiki/mapamundi/partaria/mercado_de_dao_yeni/mercado_de_dao_yeni.html"],
        ["/web/wiki/mapamundi/partaria/paramo_de_parta.html", "/web/wiki/mapamundi/partaria/paramo_de_parta/paramo_de_parta.html"],
        ["/web/wiki/mapamundi/partaria/reino_de_kasa.html", "/web/wiki/mapamundi/partaria/reino_de_kasa/reino_de_kasa.html"],
        ["/web/wiki/mapamundi/partaria/ruinas_de_goa.html", "/web/wiki/mapamundi/partaria/ruinas_de_goa/ruinas_de_goa.html"],
        ["/web/wiki/mapamundi/partaria/tierras_reflejadas.html", "/web/wiki/mapamundi/partaria/tierras_reflejadas/tierras_reflejadas.html"],
        ["/web/wiki/mapamundi/partaria/tribu_boscalise.html", "/web/wiki/mapamundi/partaria/tribu_boscalise/tribu_boscalise.html"],
        ["/web/wiki/mapamundi/partaria/tribu_gogango.html", "/web/wiki/mapamundi/partaria/tribu_gogango/tribu_gogango.html"],
        ["/web/wiki/mapamundi/partaria/tribu_kranimos.html", "/web/wiki/mapamundi/partaria/tribu_kranimos/tribu_kranimos.html"],
        ["/web/wiki/mapamundi/partaria/tribu_molosgo.html", "/web/wiki/mapamundi/partaria/tribu_molosgo/tribu_molosgo.html"],
        ["/web/wiki/mapamundi/partaria/tribu_ordasco.html", "/web/wiki/mapamundi/partaria/tribu_ordasco/tribu_ordasco.html"],
        ["/web/wiki/mapamundi/partaria/tribu_tuzno.html", "/web/wiki/mapamundi/partaria/tribu_tuzno/tribu_tuzno.html"],
        ["/web/wiki/mapamundi/partaria/tribu_utna.html", "/web/wiki/mapamundi/partaria/tribu_utna/tribu_utna.html"],
        ["/web/wiki/mapamundi/partaria/tribu_vadalacra.html", "/web/wiki/mapamundi/partaria/tribu_vadalacra/tribu_vadalacra.html"],
        ["/web/wiki/mapamundi/partaria/valle_de_utan.html", "/web/wiki/mapamundi/partaria/valle_de_utan/valle_de_utan.html"],
        ["/web/mundo/index_mundo.html", "/web/wiki/index_wiki.html"],
        ["/web/mundo/", "/web/wiki/"],
    ];

    const pedida = window.location.pathname;
    for (const [vieja, nueva] of REDIRECCIONES) {
        if (pedida === vieja || pedida.indexOf(vieja) === 0) {
            let destino = nueva + pedida.slice(vieja.length);
            // La portada de una carpeta, con o sin barra al final.
            if (destino === "/web/wiki/" || destino === "/web/wiki") {
                destino = "/web/wiki/index_wiki.html";
            }
            if (destino.indexOf("/") !== 0 || destino.indexOf("//") === 0 || destino === pedida) {
                return;
            }
            // replace y no assign: así el botón de atrás no vuelve a la
            // dirección vieja, que solo devolvería aquí otra vez.
            window.location.replace(destino + window.location.search + window.location.hash);
            return;
        }
    }
})();
