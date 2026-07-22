// ===== VERSION AFFICHÉE — SOURCE UNIQUE =====
// Le SEUL endroit où changer le numéro de version montré aux joueurs (footer +
// badge « À propos », sur game.html ET index.html). Chargé avant app.js/landing.js.
// À bumper à chaque release, en cohérence avec la dernière entrée du CHANGELOG (app.js).
// NB : distinct du numéro de cache `?v=NN` / `logpose-vNN` (cache-busting technique).
window.APP_VERSION = 'v6.3';

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
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
