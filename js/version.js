// ===== VERSION AFFICHÉE — SOURCE UNIQUE =====
// Le SEUL endroit où changer le numéro de version montré aux joueurs (footer +
// badge « À propos », sur game.html ET index.html). Chargé avant app.js/landing.js.
// À bumper à chaque release, en cohérence avec la dernière entrée du CHANGELOG (app.js).
// NB : distinct du numéro de cache `?v=NN` / `logpose-vNN` (cache-busting technique).
window.APP_VERSION = 'v6.2';

// Injecte la version dans tous les éléments porteurs de la classe `js-version`.
(function () {
  function stamp() {
    document.querySelectorAll('.js-version').forEach(function (el) {
      el.textContent = window.APP_VERSION;
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', stamp);
  } else {
    stamp();
  }
})();
