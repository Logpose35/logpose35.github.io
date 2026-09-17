// ===== TESTS DES RÈGLES DE COMPARAISON (js/versus-rules.js) =====
// `node tools/test-versus-rules.js` — aucune dépendance, aucun réseau, aucun DOM.
// Couvre les colonnes Prime et 1er Arc du Classique, dont les règles sont partagées
// par le jeu et le serveur Versus.
//
// Ce que ces tests protègent : une valeur ABSENTE ne doit jamais produire de flèche,
// et sort en ORANGE (« rien à comparer »), pas en rouge. Deux signalements d'un joueur
// le 17/09/2026 — la prime INCONNUE (`null`, jamais révélée dans l'œuvre) sortait ⬇️,
// comme si Joz ne valait presque rien ; l'arc `0` (« Filler », les persos de films)
// sortait ⬇️ face à tout le monde, ce qui revenait à annoncer « avant Romance Dawn ».
// `0` en prime (aucune prime) et les arcs canoniques gardent, eux, la comparaison
// habituelle, flèche comprise.
'use strict';

const path = require('path');
const { cmpArc, cmpBounty, computeVerdicts } = require('../js/versus-rules.js');

let passed = 0, failed = 0;
function ok(cond, label) {
  if (cond) { passed++; console.log(`  ✅ ${label}`); }
  else      { failed++; console.log(`  ❌ ${label}`); }
}
const verdict = (v, state, arrow) => v.state === state && v.arrow === arrow;

console.log('\n— 1. Primes connues : comportement inchangé —');
ok(verdict(cmpBounty(1374, 1374), 'correct', ''), 'même prime → vert, sans flèche');
ok(verdict(cmpBounty(550, 1374), 'wrong', '⬆️'), 'prime proposée plus basse → ⬆️');
ok(verdict(cmpBounty(5046, 1374), 'wrong', '⬇️'), 'prime proposée plus haute → ⬇️');
ok(verdict(cmpBounty(0, 0), 'correct', ''), 'aucune prime des deux côtés → vert');
ok(verdict(cmpBounty(0, 550), 'wrong', '⬆️'), 'aucune prime contre une prime → ⬆️ (0 se compare)');
ok(verdict(cmpBounty(0.001, 0.0005), 'wrong', '⬇️'), 'les primes sous le million se comparent aussi');

console.log('\n— 2. Prime inconnue : orange face à un montant, faux face à « aucune prime » —');
ok(verdict(cmpBounty(null, null), 'correct', ''), 'inconnue contre inconnue → vert');
ok(verdict(cmpBounty(1374, null), 'partial', ''), 'connue contre inconnue → orange, sans flèche');
ok(verdict(cmpBounty(null, 1374), 'partial', ''), 'inconnue contre connue → orange, sans flèche');
ok(verdict(cmpBounty(0, null), 'wrong', '⬆️'), 'aucune prime contre inconnue → faux, ⬆️ (une prime inconnue reste une prime)');
ok(verdict(cmpBounty(null, 0), 'wrong', '⬇️'), 'inconnue contre aucune prime → faux, ⬇️');
ok(verdict(cmpBounty(undefined, null), 'correct', ''), 'un champ absent compte comme une prime inconnue');

console.log('\n— 3. Primes sur les vraies fiches de data.json —');
{
  const d = require(path.join(__dirname, '..', 'data.json'));
  const C = Object.fromEntries(d.CHARACTERS.map(c => [c.name, c]));
  const INCONNUES = ['Joz', 'Vista', 'Thatch', 'Shiryu', 'Ben Beckman', 'Yasopp', 'Lucky Roux',
                     'Kozuki Oden', 'Crocus', 'Vander Decken IX', 'Douglas Bullet'];
  ok(INCONNUES.every(n => C[n] && C[n].bounty === null),
     `les ${INCONNUES.length} primes jamais révélées valent null`);
  ok(d.CHARACTERS.every(c => c.bounty === null || (typeof c.bounty === 'number' && c.bounty >= 0)),
     'toute prime est un nombre positif ou nul, ou null (jamais -1, jamais une chaîne)');
  ok(verdict(computeVerdicts(C['Marco'], C['Joz']).bounty, 'partial', ''),
     'Marco proposé quand la réponse est Joz → orange, sans flèche');
  ok(verdict(computeVerdicts(C['Vista'], C['Joz']).bounty, 'correct', ''),
     'Vista proposé quand la réponse est Joz → vert');
  ok(verdict(computeVerdicts(C['Garp'], C['Joz']).bounty, 'wrong', '⬆️'),
     'Garp (aucune prime) proposé quand la réponse est Joz → faux, ⬆️');
  ok(verdict(computeVerdicts(C['Joz'], C['Garp']).bounty, 'wrong', '⬇️'),
     'Joz proposé quand la réponse est Garp (aucune prime) → faux, ⬇️');
  ok(verdict(computeVerdicts(C['Marco'], C['Edward Newgate']).bounty, 'wrong', '⬆️'),
     'Marco proposé quand la réponse est Barbe Blanche → ⬆️ (inchangé)');
}

console.log('\n— 4. Premier arc : les persos de films (arc 0) sortent en orange —');
ok(verdict(cmpArc(12, 12), 'correct', ''), 'même arc → vert, sans flèche');
ok(verdict(cmpArc(5, 22), 'wrong', '⬆️'), 'arc proposé plus ancien → ⬆️');
ok(verdict(cmpArc(22, 5), 'wrong', '⬇️'), 'arc proposé plus récent → ⬇️');
ok(verdict(cmpArc(0, 0), 'correct', ''), 'deux persos de films → vert');
ok(verdict(cmpArc(1, 0), 'partial', ''), 'Romance Dawn contre un film → orange, sans flèche');
ok(verdict(cmpArc(0, 1), 'partial', ''), 'un film contre Romance Dawn → orange, sans flèche');
ok(verdict(cmpArc(0, 32), 'partial', ''), 'un film contre le dernier arc → orange, sans flèche');

console.log('\n— 5. Arcs sur les vraies fiches —');
{
  const d = require(path.join(__dirname, '..', 'data.json'));
  const C = Object.fromEntries(d.CHARACTERS.map(c => [c.name, c]));
  const FILMS = ['Uta', 'Douglas Bullet', 'Zephyr', 'Gild Tesoro'];
  ok(d.ARCS[0] === 'Filler', 'ARCS[0] est bien l\'arc hors-série');
  ok(d.CHARACTERS.filter(c => c.arc === 0).map(c => c.name).sort().join(',') === FILMS.slice().sort().join(','),
     `seuls les ${FILMS.length} persos de films sont en arc 0`);
  ok(verdict(computeVerdicts(C['Monkey D. Luffy'], C['Zephyr']).arc, 'partial', ''),
     'Luffy proposé quand la réponse est Zephyr → orange, sans flèche');
  ok(verdict(computeVerdicts(C['Zephyr'], C['Monkey D. Luffy']).arc, 'partial', ''),
     'Zephyr proposé quand la réponse est Luffy → orange, sans flèche');
  ok(verdict(computeVerdicts(C['Uta'], C['Zephyr']).arc, 'correct', ''),
     'deux persos de films → vert');
  ok(verdict(computeVerdicts(C['Marco'], C['Edward Newgate']).arc, 'wrong', '⬇️'),
     'Marco proposé quand la réponse est Barbe Blanche → ⬇️ (inchangé)');
}

console.log(`\n=== RÉSULTAT : ${passed} PASS, ${failed} FAIL ===`);
process.exitCode = failed ? 1 : 0;
