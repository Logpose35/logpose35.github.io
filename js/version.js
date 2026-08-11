// ===== VERSION AFFICHÉE — SOURCE UNIQUE =====
// Le SEUL endroit où changer le numéro de version montré aux joueurs (footer +
// badge « À propos », sur game.html ET index.html). Chargé avant app.js/landing.js.
// À bumper à chaque release, en cohérence avec la dernière entrée du CHANGELOG (app.js).
// NB : distinct du numéro de cache `?v=NN` / `logpose-vNN` (cache-busting technique).
window.APP_VERSION = 'v7.0';

// Adresse de contact du site — assemblée au runtime (jamais en clair dans le HTML
// source) pour limiter l'aspiration par les robots à spam. Changer ici uniquement.
window.SITE_CONTACT = { user: 'contact', domain: 'onepiecedle.fr' };

// Boot commun aux 2 pages : injecte la version (.js-version) et le lien de
// contact (.js-contact). Un seul passage au chargement du DOM.
(function () {
  function boot() {
    document.querySelectorAll('.js-version').forEach(function (el) {
      el.textContent = window.APP_VERSION;
    });
    var c = window.SITE_CONTACT, addr = c.user + '@' + c.domain;
    document.querySelectorAll('.js-contact').forEach(function (el) {
      var a = document.createElement('a');
      a.href = 'mailto:' + addr;
      a.textContent = addr;
      a.className = 'contact-link';
      el.textContent = '';
      el.appendChild(a);
    });

    // ── Signalement d'erreur (sous le compte à rebours) ──────────────────
    // Un site statique n'a pas de serveur pour recevoir un POST : le lien
    // ouvre donc le client mail avec le contexte DÉJÀ rempli. C'est ce qui
    // manque le plus dans un signalement spontané — quel mode, quel jour,
    // quelle version. Construit ici, comme l'adresse, pour ne pas l'exposer.
    // La réponse du jour n'y figure PAS : le lien est visible avant d'avoir
    // joué, elle serait un spoiler offert.
    var t = window.t || function (s) { return s; };
    document.querySelectorAll('.js-report').forEach(function (el) {
      var contexte = [
        'page: ' + location.pathname,
        'mode: ' + (window.LP_MODE || '—'),
        'date: ' + new Date().toISOString().slice(0, 10),
        'version: ' + window.APP_VERSION,
        'langue: ' + (window.LANG || 'fr'),
        'UA: ' + navigator.userAgent
      ].join('\n');
      var corps = t('Décrivez le problème ici :') + '\n\n\n---\n' + contexte;
      var a = document.createElement('a');
      a.className = 'report-link';
      a.href = 'mailto:' + addr
             + '?subject=' + encodeURIComponent(t('LogPose — signalement'))
             + '&body='    + encodeURIComponent(corps);
      a.textContent = t('Signaler une erreur');
      // Sur une page de jeu, app.js expose openReport() : on ouvre le
      // formulaire. Le mailto reste le href réel, donc il prend le relais si
      // app.js n'a pas chargé, sur la landing, ou en ouverture dans un onglet.
      a.addEventListener('click', function (e) {
        if (typeof window.openReport === 'function' && window.openReport()) e.preventDefault();
      });
      el.textContent = '';
      el.appendChild(a);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
