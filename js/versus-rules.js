// ===== RÈGLES PARTAGÉES LOGPOSE (daily + versus) =====
// SOURCE UNIQUE des règles de comparaison du mode Classique et des helpers
// d'autocomplete. Chargé par le site (game.html, futur versus.html) ET requis
// par le serveur Versus Node (server/). Bi-environnement : expose des globals
// navigateur + module.exports pour Node. AUCUNE dépendance (autoporteur).
// ⚠️ Toute retouche de règle se fait ICI et uniquement ici — deux copies
// divergeraient à la première retouche (voir BRIEF_V6 §2.6).
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ── Comparaisons du mode Classique (ex-app.js) ──

  function cmpHaki(g, t) {
    if (!g.length && !t.length) return 'correct';
    if (JSON.stringify([...g].sort()) === JSON.stringify([...t].sort())) return 'correct';
    return g.some(h => t.includes(h)) ? 'partial' : 'wrong';
  }
  function cmpArc(g, t)    { return g === t ? { state:'correct', arrow:'' } : { state:'wrong', arrow: g < t ? '⬆️' : '⬇️' }; }
  function cmpBounty(g, t) { return g === t ? { state:'correct', arrow:'' } : { state:'wrong', arrow: g < t ? '⬆️' : '⬇️' }; }
  function cmpOrigin(g, t) {
    if (g === t) return 'correct';
    if (g.includes('Blue') && t.includes('Blue')) return 'partial';
    return 'wrong';
  }
  function fruitLabel(f) {
    if (!f) return { icon:'❌', val:'Aucun' };
    return { icon: { Paramecia:'🌀', Logia:'🌊', Zoan:'🐾', Mythique:'✨' }[f] || '❓', val: f };
  }

  // Mots trop génériques à ignorer dans la comparaison d'affiliation
  const AFFIL_STOP = new Set(['pirates','pirate','de','du','des','les','la','le','d','l','et','the','of','grand','new']);
  function cmpAffil(a, b) {
    if (a === b) return 'correct';
    const wordsA = a.toLowerCase().split(/[\s\-–]+/).filter(w => w.length > 3 && !AFFIL_STOP.has(w));
    if (!wordsA.length) return 'wrong';
    const lowerB = b.toLowerCase();
    return wordsA.some(w => lowerB.includes(w)) ? 'partial' : 'wrong';
  }

  // ── Verdict complet d'un essai : guess + target → états par colonne ──
  // C'est la fonction qu'utilisent buildGuessRow (daily, en local) et le
  // serveur Versus (qui envoie le résultat aux deux joueurs).
  function computeVerdicts(g, t) {
    return {
      gender: g.gender === t.gender ? 'correct' : 'wrong',
      affil:  cmpAffil(g.affil, t.affil),
      origin: cmpOrigin(g.origin, t.origin),
      fruit:  g.fruit === t.fruit ? 'correct' : (g.fruit && t.fruit ? 'partial' : 'wrong'),
      haki:   cmpHaki(g.haki, t.haki),
      status: g.status === t.status ? 'correct' : 'wrong',
      arc:    cmpArc(g.arc, t.arc),
      bounty: cmpBounty(g.bounty, t.bounty),
      win:    g.name === t.name
    };
  }

  // ── Helpers d'autocomplete (ex-app.js — purs, aliases passé en paramètre) ──

  // Pli des diacritiques : "Señor" → "senor", "Portgas" → "portgas".
  // Rend la recherche ET la soumission insensibles aux accents (é, ñ, ô…),
  // pénibles au clavier français. Source unique (daily + versus + serveur).
  function fold(s) {
    return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  // Retourne le label d'alias/épithète qui a matché, ou null si c'est le nom qui matche
  function getMatchHint(c, q, aliases = {}) {
    q = fold(q);
    if (fold(c.name).includes(q)) return null;
    if (c.captain && fold(c.captain).includes(q)) return c.captain;
    if (c.epithet && fold(c.epithet).includes(q)) return c.epithet;
    for (const [alias, charName] of Object.entries(aliases)) {
      if (charName === c.name && fold(alias).includes(q)) return alias;
    }
    // Mode audio : numéro ou artiste
    if (c.id !== undefined) {
      if (/^(?:op|opening)\s*$/.test(q)) return `Opening ${c.id}`;
      const numMatch = q.match(/^(?:opening\s+|op\s*)?(\d+)$/);
      if (numMatch && parseInt(numMatch[1]) === c.id) return `Opening ${c.id}`;
      if (q.length >= 2 && c.artist && fold(c.artist).includes(q)) return c.artist;
    }
    return null;
  }

  function charMatchesQuery(c, q, aliases = {}) {
    q = fold(q);
    if (fold(c.name).includes(q)) return true;
    if (c.captain && fold(c.captain).includes(q)) return true;
    if (c.epithet && fold(c.epithet).includes(q)) return true;
    if (Object.entries(aliases).some(([alias, charName]) => charName === c.name && fold(alias).includes(q))) return true;
    // Mode audio : recherche par numéro, mot-clé "op"/"opening", ou artiste
    if (c.id !== undefined) {
      if (/^(?:op|opening)\s*$/.test(q)) return true;
      const numMatch = q.match(/^(?:opening\s+|op\s*)?(\d+)$/);
      if (numMatch && parseInt(numMatch[1]) === c.id) return true;
      if (q.length >= 2 && c.artist && fold(c.artist).includes(q)) return true;
    }
    return false;
  }

  // Résout un texte saisi vers le personnage correspondant du pool, en tolérant
  // les accents manquants (nom exact plié). Sert aux soumissions (daily + versus).
  function resolveName(pool, typed) {
    const t = fold(String(typed).trim());
    if (!t) return null;
    return pool.find(c => fold(c.name) === t) || null;
  }

  return { cmpHaki, cmpArc, cmpBounty, cmpOrigin, cmpAffil, AFFIL_STOP,
           fruitLabel, computeVerdicts, getMatchHint, charMatchesQuery, fold, resolveName };
});
