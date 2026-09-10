// ===== TESTS DE LA FUSION DE SAUVEGARDES =====
// `node tools/test-save-merge.js` — aucune dépendance, aucun réseau : le module
// js/save-merge.js est volontairement pur pour être vérifiable ici.
// Ce que ces tests protègent avant tout : la fusion ne doit JAMAIS faire perdre
// une journée, un score ou un personnage capturé.
'use strict';

const path = require('path');
const { mergeSaves, daySlice, daysOf, LOCAL_ONLY } = require(path.join(__dirname, '..', 'js', 'save-merge.js'));

let passed = 0, failed = 0;
function ok(cond, label) {
  if (cond) { passed++; console.log(`  ✅ ${label}`); }
  else      { failed++; console.log(`  ❌ ${label}`); }
}
const J = v => JSON.stringify(v);
const eq = (a, b) => J(a) === J(b);

// Compare deux sauvegardes SUR LE FOND : l'ordre d'insertion des clés n'a pas de
// sens (ni pour le localStorage, ni pour la base), et les listes cumulatives
// (carnet de capture, îles) sont des ensembles — leur ordre non plus.
function sameSave(a, b) {
  const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
  if (!eq(ka, kb)) { console.log('    clés différentes :', J(ka), 'vs', J(kb)); return false; }
  return ka.every(k => {
    if (a[k] === b[k]) return true;
    let pa, pb;
    try { pa = JSON.parse(a[k]); pb = JSON.parse(b[k]); } catch (e) { pa = pb = null; }
    if (Array.isArray(pa) && Array.isArray(pb) && eq([...pa].sort(), [...pb].sort())) return true;
    console.log(`    ${k} : ${a[k]} vs ${b[k]}`);
    return false;
  });
}

// Fabrique une journée jouée : gs + score + result cohérents, comme le jeu les écrit.
function day(d, mode, { guesses = [], won = null, score = 0, target = 'Luffy' } = {}) {
  const o = {};
  o[`op-gs-${mode}-${d}`] = J({ guesses, target });
  if (won !== null) {
    o[`op-result-${d}`] = J({ [mode]: { won, tries: guesses.length } });
    if (won) o[`op-score-${d}`] = J({ [mode]: score });
  }
  return o;
}
// Fusionne plusieurs fragments de journée du MÊME jour (score/result sont des maps).
function combine(...parts) {
  const out = {};
  parts.forEach(p => Object.keys(p).forEach(k => {
    if (/^op-(score|result)-/.test(k) && out[k]) {
      out[k] = J(Object.assign(JSON.parse(out[k]), JSON.parse(p[k])));
    } else out[k] = p[k];
  }));
  return out;
}
const progressOnly = o => {
  const c = {};
  Object.keys(o).forEach(k => { if (!LOCAL_ONLY.has(k)) c[k] = o[k]; });
  return c;
};

console.log('\n— 1. Les deux scénarios d\'entrée —');
{
  // Import initial : le joueur a tout en local, le compte est vide.
  const local = combine(day('2026-9-1', 'classic', { guesses: ['Zoro', 'Luffy'], won: true, score: 900 }),
                        { 'op-cumulative-score': '900', 'op-captured': J(['Luffy']) });
  const r = mergeSaves(local, {});
  ok(r.data['op-gs-classic-2026-9-1'] === local['op-gs-classic-2026-9-1'], 'nuage vide : la grille locale est conservée telle quelle');
  ok(r.data['op-cumulative-score'] === '900', 'nuage vide : le cumul est inchangé');
  ok(r.report.daysAdded === 0 && r.report.scoreDelta === 0, 'nuage vide : rapport vide (rien d\'importé)');

  // Nouveau navigateur : rien en local, tout dans le compte.
  const r2 = mergeSaves({}, local);
  ok(sameSave(progressOnly(r2.data), progressOnly(local)), 'local vide : la progression du compte est reprise intégralement');
  ok(r2.report.daysAdded === 1 && r2.report.scoreDelta === 900, 'local vide : rapport = 1 journée, +900 pts');
}

console.log('\n— 2. Deux appareils, journées disjointes —');
{
  const pc  = combine(day('2026-9-1', 'classic', { guesses: ['Luffy'], won: true, score: 1000 }), { 'op-cumulative-score': '1000' });
  const tel = combine(day('2026-9-2', 'emoji',   { guesses: ['Nami'],  won: true, score: 800  }), { 'op-cumulative-score': '800'  });
  const r = mergeSaves(pc, tel);
  ok(!!r.data['op-gs-classic-2026-9-1'] && !!r.data['op-gs-emoji-2026-9-2'], 'les deux journées survivent');
  ok(r.data['op-cumulative-score'] === '1800', 'cumul recalculé = 1000 + 800 (ni max, ni double compte)');
  ok(r.report.daysAdded === 1, 'rapport : 1 journée ajoutée');
}

console.log('\n— 3. Même journée, modes différents (le cas réel) —');
{
  const pc  = day('2026-9-3', 'classic', { guesses: ['Luffy'], won: true, score: 1000 });
  const tel = day('2026-9-3', 'emoji',   { guesses: ['Nami'],  won: true, score: 800 });
  const r = mergeSaves(pc, tel);
  const scores  = JSON.parse(r.data['op-score-2026-9-3']);
  const results = JSON.parse(r.data['op-result-2026-9-3']);
  ok(scores.classic === 1000 && scores.emoji === 800, 'les scores des deux modes cohabitent dans la même journée');
  ok(!!results.classic && !!results.emoji, 'les deux résultats cohabitent');
  ok(!!r.data['op-gs-classic-2026-9-3'] && !!r.data['op-gs-emoji-2026-9-3'], 'les deux grilles cohabitent');
  ok(r.data['op-cumulative-score'] === '1800', 'cumul = somme des deux modes du jour');
}

console.log('\n— 4. Même journée ET même mode : arbitrage —');
{
  const fini    = day('2026-9-4', 'classic', { guesses: ['Zoro', 'Luffy'], won: true, score: 900 });
  const enCours = day('2026-9-4', 'classic', { guesses: ['Sanji'] });
  const r = mergeSaves(enCours, fini);
  ok(!!JSON.parse(r.data['op-result-2026-9-4'] || '{}').classic, 'terminé bat en cours');
  ok(JSON.parse(r.data['op-gs-classic-2026-9-4']).guesses.length === 2, 'la grille vient du camp qui a terminé');

  // Les trois morceaux doivent venir du MÊME camp, sinon on afficherait une
  // grille de 4 essais sous le score d'une partie gagnée en 2.
  const bon    = day('2026-9-5', 'classic', { guesses: ['Luffy'], won: true, score: 1000 });
  const moyen  = day('2026-9-5', 'classic', { guesses: ['A', 'B', 'C', 'D'], won: true, score: 400 });
  const r2 = mergeSaves(moyen, bon);
  const g = JSON.parse(r2.data['op-gs-classic-2026-9-5']).guesses.length;
  const s = JSON.parse(r2.data['op-score-2026-9-5']).classic;
  const t = JSON.parse(r2.data['op-result-2026-9-5']).classic.tries;
  ok(s === 1000, 'deux parties terminées : le meilleur score gagne');
  ok(g === 1 && t === 1, `grille, score et résultat viennent du même camp (${g} essai(s), ${t} tries, ${s} pts)`);

  const a = day('2026-9-6', 'tome', { guesses: [1, 2, 3] });
  const b = day('2026-9-6', 'tome', { guesses: [1] });
  const r3 = mergeSaves(b, a);
  ok(JSON.parse(r3.data['op-gs-tome-2026-9-6']).guesses.length === 3, 'deux parties en cours : la plus avancée gagne');
}

console.log('\n— 5. Le cumul ne peut pas descendre —');
{
  // Joueur d'avant l'archivage complet des scores : cumul affiché > somme connue.
  const vieux = { 'op-cumulative-score': '250000' };
  const r = mergeSaves(vieux, day('2026-9-7', 'classic', { guesses: ['Luffy'], won: true, score: 1000 }));
  ok(r.data['op-cumulative-score'] === '250000', 'un historique de scores incomplet ne fait pas chuter le cumul');
  const r2 = mergeSaves({}, vieux);
  ok(r2.data['op-cumulative-score'] === '250000', 'le cumul du compte est repris tel quel');
}

console.log('\n— 6. Idempotence et commutativité —');
{
  const A = combine(day('2026-9-8', 'classic', { guesses: ['Luffy'], won: true, score: 1000 }),
                    { 'op-captured': J(['Luffy']), 'op-cumulative-score': '1000', 'op-theme': 'dark' });
  const B = combine(day('2026-9-9', 'emoji', { guesses: ['Nami', 'Robin'], won: true, score: 700 }),
                    { 'op-captured': J(['Nami']), 'op-cumulative-score': '700', 'op-theme': 'light' });
  const once  = mergeSaves(A, B).data;
  const twice = mergeSaves(once, B).data;
  ok(sameSave(once, twice), 'refusionner avec le même compte ne change rien (idempotente)');
  ok(sameSave(progressOnly(mergeSaves(A, B).data), progressOnly(mergeSaves(B, A).data)), 'l\'ordre des camps n\'importe pas sur la progression (commutative)');
  ok(once['op-theme'] === 'dark', 'les préférences ne traversent pas : l\'appareil garde son thème');
  ok(LOCAL_ONLY.has('op-versus-resume'), 'le jeton de reprise d\'un duel reste local');
  ok(LOCAL_ONLY.has('op-lang'), 'la langue reste locale (elle vient de l\'URL, pas du compte)');
  // Replier le classement est un goût d'affichage : la règle par défaut étant
  // de TOUT synchroniser, un oubli ici le replierait sur tous les appareils du
  // joueur dès qu'il le replie sur un seul.
  ok(LOCAL_ONLY.has('op-lb-collapsed'), 'le classement replié reste un réglage de l\'appareil');
  {
    const ici = { 'op-lb-collapsed': '1' }, compte = { 'op-lb-collapsed': '0' };
    ok(mergeSaves(ici, compte).data['op-lb-collapsed'] === '1',
       'fusionner avec le compte ne redéplie pas un classement replié ici');
  }
}

console.log('\n— 7. Compteurs et listes —');
{
  const A = { 'op-day-counted-2026-9-8': '1', 'op-captured': J(['Luffy', 'Zoro']),
              'op-islands-reached': J(['Alabasta']), 'op-inf-record': '12',
              'op-versus-stats': J({ w: 5, l: 2 }) };
  const B = { 'op-captured': J(['Zoro', 'Nami']), 'op-islands-reached': J(['Skypiea']),
              'op-inf-record': '30', 'op-versus-stats': J({ w: 3, l: 9 }),
              'op-perfect-2026-9-8': '1' };
  const r = mergeSaves(A, B).data;
  ok(r['op-day-counted-2026-9-8'] === '1', 'journée déjà comptée d\'un côté : reste comptée (le compteur public ne gonfle pas)');
  ok(r['op-perfect-2026-9-8'] === '1', 'sans-faute fêté d\'un côté : conservé');
  ok(eq(JSON.parse(r['op-captured']), ['Luffy', 'Zoro', 'Nami']), 'carnet de capture : union sans doublon, ordre local d\'abord');
  ok(eq(JSON.parse(r['op-islands-reached']), ['Alabasta', 'Skypiea']), 'îles atteintes : union');
  ok(r['op-inf-record'] === '30', 'record du mode Infini : max');
  ok(eq(JSON.parse(r['op-versus-stats']), { w: 5, l: 9 }), 'stats de duel : max champ par champ');
  ok(mergeSaves(A, B).report.capturedAdded === 1, 'rapport : 1 personnage gagné au carnet');
}

console.log('\n— 8. Statistiques par mode (bloc cohérent) —');
{
  const A = { 'op-stats-classic': J({ played: 10, won: 8, currentStreak: 3, maxStreak: 9, lastDate: '2026-9-1', distribution: { 1: 2, 2: 6 } }) };
  const B = { 'op-stats-classic': J({ played: 40, won: 30, currentStreak: 5, maxStreak: 6, lastDate: '2026-9-9', distribution: { 1: 10, 2: 20 } }) };
  const s = JSON.parse(mergeSaves(A, B).data['op-stats-classic']);
  ok(s.played === 40 && s.won === 30, 'le bloc le plus avancé est pris en entier');
  ok(eq(s.distribution, { 1: 10, 2: 20 }), 'la distribution reste cohérente avec played (pas de bricolage champ par champ)');
  ok(s.maxStreak === 9, 'le meilleur maxStreak est relevé sur l\'autre camp');
  ok(s.currentStreak === 5 && s.lastDate === '2026-9-9', 'la série en cours vient du camp qui a joué le plus récemment');
}

console.log('\n— 9. Robustesse —');
{
  const r = mergeSaves({ 'op-score-2026-9-8': '{cassé', 'op-captured': 'pas du json', 'op-futur-2027': 'x' },
                        { 'op-score-2026-9-8': J({ classic: 500 }) });
  ok(r.data['op-cumulative-score'] === '500', 'une valeur JSON corrompue n\'empêche pas la fusion');
  ok(r.data['op-futur-2027'] === 'x', 'une clé op- inconnue est conservée, pas effacée');
  ok(mergeSaves(null, undefined).data['op-cumulative-score'] === '0', 'entrées nulles : pas de plantage');
  const rank = mergeSaves({ 'op-cumulative-score': '900000' }, {}, { rankOf: s => (s >= 700000 ? 'Capitaine' : 'Moussaillon') });
  ok(rank.data['op-pirate-rank'] === 'Capitaine', 'le rang est recalculé depuis le cumul fusionné');
}

console.log('\n— 10. Découpage par journée (transport) —');
{
  const save = combine(day('2026-9-1', 'classic', { guesses: ['Luffy'], won: true, score: 1000 }),
                       day('2026-9-10', 'emoji', { guesses: ['Nami'], won: true, score: 800 }),
                       { 'op-cumulative-score': '1800', 'op-theme': 'dark' });
  const slice = daySlice(save, '2026-9-1');
  ok(Object.keys(slice).every(k => k.includes('2026-9-1') && !k.includes('2026-9-10')), 'daySlice ne prend que la journée demandée');
  ok(!slice['op-cumulative-score'] && !slice['op-theme'], 'daySlice ne remonte ni agrégat ni préférence');
  ok(eq(daysOf(save), ['2026-9-1', '2026-9-10']), 'daysOf trie chronologiquement malgré l\'absence de zéros (9 avant 10)');
  ok(eq(daysOf({ 'op-score-2026-10-1': '{}', 'op-score-2026-9-8': '{}' }), ['2026-9-8', '2026-10-1']), 'daysOf : septembre avant octobre');
}

console.log(`\n=== RÉSULTAT : ${passed} PASS, ${failed} FAIL ===`);
process.exit(failed ? 1 : 0);
