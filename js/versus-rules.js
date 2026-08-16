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
    // 'Aucun' est un libellé AFFICHÉ → traduit côté navigateur. Garde `typeof t` :
    // ce module est aussi requis par le serveur Node (où t() n'existe pas) → comportement inchangé.
    if (!f) return { icon:'❌', val: (typeof t === 'function' ? t('Aucun') : 'Aucun') };
    return { icon: { Paramecia:'🌀', Logia:'🌊', Zoan:'🐾', Mythique:'✨' }[f] || '❓', val: f };
  }

  // Équipages membres de la Grande Flotte de Chapeau de Paille : deux d'entre eux
  // (même différents) comptent comme correspondance PARTIELLE en Classique — un
  // Happou Navy vs un Barto Club sont alliés, donc « presque ». Doit refléter
  // exactement les valeurs `affil` de data.json.
  const GRAND_FLEET = new Set(['Grande Flotte', 'Happou Navy', 'Tontatta',
                               'Nouveaux Géants Guerriers', 'Barto Club']);

  // Affiliations rattachées au Gouvernement Mondial : deux d'entre elles (même
  // différentes) comptent comme correspondance PARTIELLE — les Chevaliers Divins
  // sont une branche du Gouvernement Mondial, donc « presque ». Sans cette règle
  // la comparaison par mots ne trouverait aucun terme commun (→ rouge à tort).
  const WORLD_GOV = new Set(['Gouvernement Mondial', 'Chevaliers Divins']);

  // Mots trop génériques pour rapprocher deux équipages. « barbe » en fait partie :
  // c'est un descriptif, pas une appartenance — sans lui, Barbe Blanche et Barbe Noire,
  // qui se sont fait la guerre, passaient pour alliés.
  const AFFIL_STOP = new Set(['pirates','pirate','de','du','des','les','la','le','d','l','et','the','of',
                              'grand','new','barbe']);

  // Mots significatifs d'une affiliation. Le « s » final tombe pour que Marine et
  // Neo Marines se reconnaissent, sans quoi la comparaison mot à mot les séparerait.
  function affilWords(s) {
    const out = new Set();
    String(s).toLowerCase().split(/[\s\-–]+/).forEach(w => {
      const r = w.replace(/s$/, '');
      if (r.length > 3 && !AFFIL_STOP.has(r)) out.add(r);
    });
    return out;
  }

  function cmpAffil(a, b) {
    if (a === b) return 'correct';
    if (GRAND_FLEET.has(a) && GRAND_FLEET.has(b)) return 'partial';
    if (WORLD_GOV.has(a) && WORLD_GOV.has(b)) return 'partial';
    // Comparaison mot ENTIER, jamais sous-chaîne : `includes` rapprochait « Gran Tesoro »
    // de « Grande Flotte » et « Chat Noir » de « Barbe Noire » sur un fragment commun.
    const mb = affilWords(b);
    for (const w of affilWords(a)) { if (mb.has(w)) return 'partial'; }
    return 'wrong';
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

  // Pertinence d'une suggestion : plus le score est BAS, plus elle remonte.
  // Sans classement, les suggestions sortaient dans l'ordre de data.json : taper
  // « sai » affichait d'abord Gecko Moria (épithète « Corsaire ») et les cinq
  // « Saint … » avant le personnage nommé Sai, pourtant la saisie exacte.
  function matchRank(c, q, aliases = {}) {
    q = fold(q);
    const name = fold(c.name);
    if (name === q) return 0;
    if (name.startsWith(q)) return 1;
    if (name.split(/[\s.'’\-]+/).some(w => w.startsWith(q))) return 2;   // « zoro » → Roronoa Zoro
    const al = Object.entries(aliases).filter(([, n]) => n === c.name).map(([a]) => fold(a));
    if (al.some(a => a === q)) return 3;
    if (al.some(a => a.startsWith(q))) return 4;
    if (name.includes(q)) return 5;                                       // « sai » dans « Saint … »
    return 6;                                                            // épithète, capitaine, artiste
  }

  // Trie une liste de suggestions déjà filtrée. Le tri de JS étant stable, deux
  // suggestions de même rang gardent l'ordre du pool (= l'ordre de data.json).
  function sortSuggestions(list, q, aliases = {}) {
    return list.sort((a, b) => matchRank(a, q, aliases) - matchRank(b, q, aliases));
  }

  // Résout un texte saisi vers le personnage correspondant du pool, en tolérant
  // les accents manquants (nom exact plié). Sert aux soumissions (daily + versus).
  function resolveName(pool, typed) {
    const t = fold(String(typed).trim());
    if (!t) return null;
    return pool.find(c => fold(c.name) === t) || null;
  }

  return { cmpHaki, cmpArc, cmpBounty, cmpOrigin, cmpAffil, AFFIL_STOP, GRAND_FLEET, WORLD_GOV,
           fruitLabel, computeVerdicts, getMatchHint, charMatchesQuery, fold, resolveName,
           matchRank, sortSuggestions };
});
