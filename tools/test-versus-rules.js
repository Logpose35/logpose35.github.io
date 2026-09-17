// ===== TESTS DES RÈGLES DE COMPARAISON (js/versus-rules.js) =====
// `node tools/test-versus-rules.js` — aucune dépendance, aucun réseau, aucun DOM.
// Couvre la colonne Prime du Classique, dont la règle est partagée par le jeu et
// le serveur Versus.
//
// Ce que ces tests protègent : une prime INCONNUE (`null`, jamais révélée dans
// l'œuvre) ne doit jamais produire de flèche. Signalé par un joueur le 17/09/2026 :
// la flèche ⬇️ faisait croire que Joz ne valait presque rien. `0` (aucune prime)
// garde, lui, la comparaison habituelle.
'use strict';

const path = require('path');
const { cmpBounty, computeVerdicts } = require('../js/versus-rules.js');

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

console.log('\n— 2. Prime inconnue : jamais de flèche —');
ok(verdict(cmpBounty(null, null), 'correct', ''), 'inconnue contre inconnue → vert');
ok(verdict(cmpBounty(1374, null), 'wrong', ''), 'connue contre inconnue → faux, sans flèche');
ok(verdict(cmpBounty(null, 1374), 'wrong', ''), 'inconnue contre connue → faux, sans flèche');
ok(verdict(cmpBounty(0, null), 'wrong', ''), 'aucune prime contre inconnue → faux, sans flèche');
ok(verdict(cmpBounty(null, 0), 'wrong', ''), 'inconnue contre aucune prime → faux, sans flèche');
ok(verdict(cmpBounty(undefined, null), 'correct', ''), 'un champ absent compte comme une prime inconnue');

console.log('\n— 3. Sur les vraies fiches de data.json —');
{
  const d = require(path.join(__dirname, '..', 'data.json'));
  const C = Object.fromEntries(d.CHARACTERS.map(c => [c.name, c]));
  const INCONNUES = ['Joz', 'Vista', 'Thatch', 'Shiryu', 'Ben Beckman', 'Yasopp', 'Lucky Roux',
                     'Kozuki Oden', 'Crocus', 'Vander Decken IX', 'Douglas Bullet'];
  ok(INCONNUES.every(n => C[n] && C[n].bounty === null),
     `les ${INCONNUES.length} primes jamais révélées valent null`);
  ok(d.CHARACTERS.every(c => c.bounty === null || (typeof c.bounty === 'number' && c.bounty >= 0)),
     'toute prime est un nombre positif ou nul, ou null (jamais -1, jamais une chaîne)');
  ok(verdict(computeVerdicts(C['Marco'], C['Joz']).bounty, 'wrong', ''),
     'Marco proposé quand la réponse est Joz → faux, sans flèche');
  ok(verdict(computeVerdicts(C['Vista'], C['Joz']).bounty, 'correct', ''),
     'Vista proposé quand la réponse est Joz → vert');
  ok(verdict(computeVerdicts(C['Marco'], C['Edward Newgate']).bounty, 'wrong', '⬆️'),
     'Marco proposé quand la réponse est Barbe Blanche → ⬆️ (inchangé)');
}

console.log(`\n=== RÉSULTAT : ${passed} PASS, ${failed} FAIL ===`);
process.exitCode = failed ? 1 : 0;
