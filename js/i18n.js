// ===== i18n.js — moteur d'internationalisation minimal (FR par défaut, EN via /en/) =====
// Principe (léger, non invasif) :
//   • La langue est déduite du CHEMIN : /en/... => 'en', sinon 'fr'.
//   • Les CLÉS du dictionnaire SONT les chaînes françaises (style gettext).
//   • Sur le site FR, t(s) renvoie s à l'identique (aucun fetch, comportement inchangé).
//   • Sur /en/, t(s) renvoie la traduction si présente, sinon s (fallback français visible = bug à corriger).
//   • Le texte STATIQUE des pages /en/ est déjà traduit à la génération (tools/gen_en.py) — pour le SEO.
//     t() ne sert qu'au texte DYNAMIQUE généré par app.js / versus.js.
// Source unique du dictionnaire : /i18n/en.json (lu ici ET par le générateur Python).
(function () {
  var path = location.pathname;
  var isEN = path === '/en' || path === '/en/' || path.indexOf('/en/') === 0;
  var LANG = isEN ? 'en' : 'fr';
  window.LANG = LANG;

  // Dictionnaire EN : injecté SYNCHRONEMENT par /i18n/en.js (généré depuis i18n/en.json par
  // tools/gen_en.py, inclus uniquement dans les pages /en/). Synchrone = indispensable : les
  // tables const de app.js (MODES, WIN_TITLES, rangs…) appellent t() dès le chargement du script,
  // donc un fetch async arriverait TROP TARD. Lecture paresseuse => insensible à l'ordre des <script>.
  window.__i18nReady = Promise.resolve();   // conservé pour compat (init app.js / versus.js)

  // t(fr) -> chaîne dans la langue courante. Identité en FR ; traduction (ou fallback FR) en EN.
  window.t = function (s) {
    if (LANG === 'fr') return s;
    var D = window.__I18N_EN;
    return (D && Object.prototype.hasOwnProperty.call(D, s)) ? D[s] : s;
  };

  // tc(ctx, fr) -> traduction CONTEXTUELLE : essaie la clé 'ctx:fr' (désambiguïse un homographe),
  //   sinon retombe sur t(fr). Ex. tc('ep', 'Chapeau de Paille') = 'Straw Hat' (épithète) alors que
  //   t('Chapeau de Paille') = 'Straw Hat Pirates' (affiliation). Identité en FR.
  // Avec un 3e argument (nom du perso), essaie D'ABORD 'ctx:<nom>:fr' : deux persos peuvent partager
  //   la même épithète FR et avoir des épithètes anglaises différentes (Pedro/Nekomamushi).
  window.tc = function (ctx, s, who) {
    if (LANG === 'fr') return s;
    var D = window.__I18N_EN;
    if (D) {
      if (who) {
        var kw = ctx + ':' + who + ':' + s;
        if (Object.prototype.hasOwnProperty.call(D, kw)) return D[kw];
      }
      var k = ctx + ':' + s;
      if (Object.prototype.hasOwnProperty.call(D, k)) return D[k];
    }
    return window.t(s);
  };

  // tf(fr, a, b, …) -> t(fr) avec substitution des placeholders {0},{1},… par les arguments.
  //   ex. tf('Trouvé en {0} essais', n)  |  clé FR = 'Trouvé en {0} essais'
  window.tf = function (s) {
    var args = arguments;
    return window.t(s).replace(/\{(\d+)\}/g, function (m, i) {
      var v = args[(+i) + 1];
      return (v === undefined || v === null) ? '' : v;
    });
  };

  // nfmt(n) -> nombre formaté selon la langue (séparateurs de milliers en_US vs fr-FR).
  window.nfmt = function (n) {
    try { return Number(n).toLocaleString(LANG === 'en' ? 'en-US' : 'fr-FR'); }
    catch (e) { return String(n); }
  };

  // dfmt(date, opts) -> date localisée selon la langue.
  window.dfmt = function (date, opts) {
    try { return date.toLocaleDateString(LANG === 'en' ? 'en-US' : 'fr-FR', opts); }
    catch (e) { return String(date); }
  };

  // Chemin miroir de la page courante dans l'autre langue (pour le sélecteur FR/EN).
  // Les pages PAR MODE ont des slugs traduits (/fruit-du-demon/ <-> /en/devil-fruit/) :
  // le miroir n'y est plus déductible du chemin, il est écrit en dur dans
  // data-mirror par tools/gen_modes.py et prime sur le calcul ci-dessous.
  window.i18nMirrorPath = function () {
    var el = document.getElementById('lang-toggle');
    var fixed = el && el.getAttribute('data-mirror');
    if (fixed) return fixed;
    var p = location.pathname;
    if (p === '/en' || p === '/en/') return '/';
    if (p.indexOf('/en/') === 0) return p.slice(3);        // /en/game.html -> /game.html
    if (p === '' || p === '/') return '/en/';
    return '/en' + p;                                       // /game.html -> /en/game.html
  };

  // Bascule de langue (mémorise le choix + navigue vers la page miroir).
  window.i18nToggleLang = function () {
    try { localStorage.setItem('op-lang', LANG === 'en' ? 'fr' : 'en'); } catch (e) {}
    location.href = window.i18nMirrorPath() + location.search + location.hash;
  };

  // Câblage du bouton sélecteur (#lang-toggle) : libellé = AUTRE langue, href = page miroir.
  document.addEventListener('DOMContentLoaded', function () {
    var el = document.getElementById('lang-toggle');
    if (!el) return;
    el.textContent = (LANG === 'en') ? 'FR' : 'EN';
    el.setAttribute('href', window.i18nMirrorPath());
    el.setAttribute('aria-label', (LANG === 'en') ? 'Passer en français' : 'Switch to English');
  });
})();
