/* answers.js — maintient /reponses/ et /en/answers/ à jour sans régénération.
 *
 * Le HTML est généré par tools/gen_answers.py et fige la date de génération.
 * Sans ce script, la page afficherait « les réponses du jour paraîtront demain »
 * pour une journée déjà archivée, et l'archive cesserait de grandir entre deux
 * déploiements. Ici on rattrape l'écart à l'affichage :
 *
 *   - l'en-tête de la journée en cours est recalculé ;
 *   - les journées écoulées depuis la génération sont ajoutées à l'archive.
 *
 * Le gros de l'archive reste du HTML statique : c'est lui qui porte le
 * référencement. Seuls les derniers jours sont rendus ici.
 *
 * Deux invariants repris du serveur :
 *   1. AUCUNE date future — calendar.json embarque ~90 jours d'avance.
 *   2. La journée EN COURS ne donne ni réponse ni indice.
 *
 * Si quoi que ce soit échoue, on ne touche à rien : la page statique reste
 * affichée telle quelle. Une archive en retard vaut mieux qu'une page cassée.
 */
(function () {
  'use strict';

  var cfgEl = document.getElementById('ans-data');
  if (!cfgEl) return;

  var CFG;
  try { CFG = JSON.parse(cfgEl.textContent); } catch (e) { return; }

  // Repris VERBATIM de js/data.js : la page et le jeu doivent basculer de
  // journée au même instant, sinon ils se contredisent autour de minuit.
  function parisDate() {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
  }
  function isoKey(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
                           + '-' + String(d.getDate()).padStart(2, '0');
  }

  function fmtDate(iso) {
    var p = iso.split('-'), y = +p[0], m = +p[1], d = +p[2];
    return CFG.lang === 'fr'
      ? d + ' ' + CFG.months[m - 1] + ' ' + y
      : CFG.months[m - 1] + ' ' + d + ', ' + y;
  }

  function dayNo(iso) {
    if (!CFG.launch) return null;
    var a = iso.split('-').map(Number), b = CFG.launch.split('-').map(Number);
    var da = Date.UTC(a[0], a[1] - 1, a[2]), db = Date.UTC(b[0], b[1] - 1, b[2]);
    return Math.round((da - db) / 86400000) + 1;
  }

  // Traduit une valeur du calendrier en la réponse attendue du joueur.
  // Miroir exact de Data.answer() dans tools/gen_answers.py.
  function answerOf(mode, v) {
    if (v === undefined || v === null) return null;
    if (mode === 'fruit') return CFG.holders[v] || null;   // le calendrier stocke le FRUIT
    if (mode === 'audio') return CFG.openings[v] || null;
    if (mode === 'tome') return String(v);
    return v;                                              // noms propres
  }

  var today = isoKey(parisDate());

  // ---- 1. En-tête de la journée en cours ----
  var h = document.getElementById('ans-today-h');
  if (h) {
    var n = dayNo(today);
    h.textContent = CFG.dayWord + ' ' + (n ? '#' + n + ' — ' : '') + fmtDate(today);
  }

  // ---- 2. Journées écoulées depuis la génération ----
  // Rien à faire si la page a été générée aujourd'hui : le cas courant.
  if (!CFG.generated || CFG.generated >= today) return;

  var host = document.getElementById('archive');
  if (!host) return;

  fetch('/calendar.json', { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (cal) {
      if (!cal || !cal.days) return;

      // Invariant 1 : jamais le futur, et jamais la journée en cours (elle a sa
      // propre section, sans réponses).
      // Tri CROISSANT alors que l'archive est décroissante : chaque bloc est
      // inséré juste après le titre, donc le dernier inséré finit en tête.
      // Trier décroissant produirait l'ordre inverse.
      var manquantes = Object.keys(cal.days)
        .filter(function (k) { return k >= CFG.generated && k < today; })
        .sort();
      if (!manquantes.length) return;

      var ancre = host.querySelector('h2');
      var ajoutees = 0;

      manquantes.forEach(function (iso) {
        if (document.querySelector('.ans-day[data-jour="' + iso + '"]')) return;
        var bloc = renderJour(iso, cal.days[iso], (cal.uncertain || []).indexOf(iso) !== -1);
        if (!bloc) return;
        // Les plus récentes en tête, dans l'ordre décroissant.
        ancre.insertAdjacentElement('afterend', bloc);
        ajoutees++;
      });

      if (!ajoutees) return;

      var cpt = document.getElementById('ans-count');
      if (cpt) {
        cpt.textContent = CFG.countTpl.replace('%d', document.querySelectorAll('.ans-day').length);
      }
    })
    .catch(function () { /* archive en retard : acceptable, on ne casse rien */ });

  function renderJour(iso, jour, incertaine) {
    var cells = [], premier = null;
    CFG.modes.forEach(function (m) {
      var a = answerOf(m.id, jour[m.id]);
      if (!a) return;
      if (!premier) premier = m.id;
      var c = document.createElement('div');
      c.className = 'ans-cell';
      var k = document.createElement('span'); k.className = 'ans-k'; k.textContent = m.label;
      var v = document.createElement('span'); v.className = 'ans-v'; v.textContent = a;
      c.appendChild(k); c.appendChild(v);
      cells.push(c);
    });
    if (!cells.length) return null;

    var art = document.createElement('article');
    art.className = 'ans-day';
    art.setAttribute('data-jour', iso);

    var head = document.createElement('header');
    head.className = 'ans-day__h';
    var h3 = document.createElement('h3');
    var n = dayNo(iso);
    if (n) {
      var num = document.createElement('span');
      num.className = 'ans-num';
      num.textContent = '#' + n;
      h3.appendChild(num);
      h3.appendChild(document.createTextNode(' '));
    }
    h3.appendChild(document.createTextNode(fmtDate(iso)));

    var lien = document.createElement('a');
    lien.className = 'ans-replay';
    lien.href = '/' + CFG.prefix + CFG.slugs[premier] + '/?jour=' + iso;
    lien.textContent = CFG.replay;

    head.appendChild(h3); head.appendChild(lien);

    var det = document.createElement('details');
    det.className = 'ans-sol';
    var sum = document.createElement('summary');
    sum.textContent = CFG.seeTpl.replace('%d', cells.length);
    var grid = document.createElement('div');
    grid.className = 'ans-grid';
    cells.forEach(function (c) { grid.appendChild(c); });
    det.appendChild(sum); det.appendChild(grid);

    art.appendChild(head); art.appendChild(det);

    if (incertaine) {
      var p = document.createElement('p');
      p.className = 'ans-warn';
      p.textContent = CFG.uncertain;
      art.appendChild(p);
    }
    return art;
  }
})();
