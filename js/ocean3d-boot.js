/* ============================================================
   ONEPIECEDLE — AMORCE DU FOND 3D (v6.5)
   ------------------------------------------------------------
   Avant : three.min.js (163 Ko, CDN tiers) + js/ocean3d.js (110 Ko)
   étaient chargés en <script> bloquant sur game.html ET index.html,
   pour TOUT LE MONDE — alors que le fond 3D est désactivé par défaut
   dans le jeu. 273 Ko payés pour rien à chaque partie.

   Maintenant : ce fichier (~2 Ko) décide, puis charge à la demande —
   et depuis la v7.0 il n'est plus chargé QUE par index.html : le fond 3D
   a été retiré des pages de jeu (réglage compris). La landing décide
   seule, sur les capacités de l'appareil : un océan WebGL plein écran
   sur un téléphone coûte de la batterie et de la chaleur pour un décor.

   Rollback : remettre les deux <script> d'origine dans les <head>
   et supprimer ce fichier.
   ============================================================ */
(function () {
  'use strict';

  var THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.min.js';

  /* URL de ocean3d.js déduite de celle de ce script : marche depuis la racine
     (js/…) comme depuis /en/ (/js/…), et conserve le ?v= de cache-busting. */
  var me = document.currentScript ? document.currentScript.src : '';
  var OCEAN_URL = me ? me.replace('ocean3d-boot.js', 'ocean3d.js') : 'js/ocean3d.js';

  function charger(src) {
    return new Promise(function (ok, ko) {
      var s = document.createElement('script');
      s.src = src;
      s.async = false;               // préserve l'ordre three.js -> ocean3d.js
      s.onload = ok;
      s.onerror = function () { ko(new Error('échec du chargement : ' + src)); };
      document.head.appendChild(s);
    });
  }

  /* Effet de bascule des cartes au survol — 100 % souris, donc sans effet au
     doigt. Repris ici pour que ocean3d.js reste entièrement différable. */
  function initCardTilt() {
    if (window.__lpTiltDone) return;
    window.__lpTiltDone = 1;
    document.querySelectorAll('[data-tilt]').forEach(function (card) {
      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        card.style.setProperty('--rx', (-y * 12) + 'deg');
        card.style.setProperty('--ry', (x * 12) + 'deg');
        card.style.setProperty('--sx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--sy', (e.clientY - r.top) + 'px');
      });
      card.addEventListener('mouseleave', function () {
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
      });
    });
  }

  function mq(q) { return window.matchMedia && window.matchMedia(q).matches; }

  /* L'appareil peut-il se permettre un océan WebGL plein écran ?
     Critères volontairement conservateurs : dans le doute, on ne charge pas.
     Le fond classique (vagues SVG de base.css) reste parfaitement à sa place. */
  function appareilCapable() {
    if (mq('(prefers-reduced-motion: reduce)')) return false;
    if (mq('(max-width: 760px)')) return false;      // mobile : le décor ne vaut pas 827 Ko
    if (mq('(pointer: coarse)')) return false;       // tablette tactile
    if ((navigator.hardwareConcurrency || 8) <= 4) return false;
    if ((navigator.deviceMemory || 8) < 4) return false;
    return true;
  }

  var enCours = null;
  function amorcer() {
    if (enCours) return enCours;
    enCours = charger(THREE_URL)
      .then(function () { return charger(OCEAN_URL); })
      .catch(function (e) {
        enCours = null;                 // un échec réseau ne doit pas figer la bascule
        console.warn('Ocean3D :', e.message);
      });
    return enCours;
  }

  function demarrer() {
    initCardTilt();
    if (appareilCapable()) amorcer();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', demarrer);
  } else {
    demarrer();
  }
})();
