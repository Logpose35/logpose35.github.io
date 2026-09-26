// ===== TESTS DU TIRAGE DES RÉPONSES (v8.1) =====
// js/tirage.js (le jeu) et tools/tirage.py (la page des réponses) doivent rendre
// EXACTEMENT les mêmes journées, et les règles du propriétaire (26/09/2026) doivent
// tenir. `node tools/test-tirage.js` → PASS/FAIL.
// ⚠️ Ce test n'affiche JAMAIS une réponse : le propriétaire joue chaque jour.
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const T = require('../js/tirage.js');

const ROOT = path.join(__dirname, '..');
const lire = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const DATA = lire('data.json'), FOCUS = lire('silhouettes/focus.json'), CAL = lire('calendar.json');
const JOURS = 500;
const PERSOS = T.ORDRE_PERSOS;

let passed = 0, failed = 0;
function ok(cond, label) {
  if (cond) { passed++; console.log(`  ✅ ${label}`); }
  else      { failed++; console.log(`  ❌ ${label}`); }
}
const clone = o => JSON.parse(JSON.stringify(o));
function suite(data, focus, cal, graine, jours = JOURS) {
  const ctx = T.preparer(data, focus, cal, graine === undefined ? undefined : { graine });
  const out = {};
  for (let i = 0; i < jours; i++) { const iso = T.isoDe(ctx.bascule + i); out[iso] = T.jour(ctx, iso); }
  return out;
}
const porteur = {};
DATA.FRUITS.forEach(f => { porteur[f.name] = f.holder; });
const persoDe = (mode, v) => (mode === 'fruit' ? porteur[v] : v);

// ── 1. Parité JavaScript ⇄ Python ─────────────────────────────────────────────
console.log('\n— 1. Le jeu et la page des réponses tirent la même chose —');
const python = process.env.PYTHON || 'python';
const dumpPy = args => JSON.parse(execFileSync(python, [path.join(ROOT, 'tools', 'tirage.py'), '--dump', String(JOURS), ...args],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8' }) }));
const JS = suite(DATA, FOCUS, CAL);
for (const [nom, args, js] of [['graine de production', [], JS], ['graine de démonstration', ['--graine', '12345'], suite(DATA, FOCUS, CAL, 12345)]]) {
  const py = dumpPy(args);
  const ecarts = Object.keys(js).filter(iso => JSON.stringify(sortKeys(js[iso])) !== JSON.stringify(sortKeys(py[iso])));
  ok(Object.keys(py).length === JOURS && ecarts.length === 0, `${nom} : ${JOURS} journées identiques en JS et en Python (${ecarts.length} écart(s))`);
}
function sortKeys(o) { const r = {}; Object.keys(o || {}).sort().forEach(k => { r[k] = o[k]; }); return r; }

// ── 2. Règles, sur la vraie suite (vérifiées sans rien afficher) ─────────────
console.log('\n— 2. Les règles tiennent sur 500 jours —');
const jours = Object.keys(JS).sort();
const anniv = iso => (T.ANNIVERSAIRES[iso.slice(5)] || []);
{
  let repetitions = 0, verifiees = 0;
  ['classic', 'wanted', 'silhouette', 'emoji', 'fruit', 'tome'].forEach(mode => {
    const dernier = {};
    // l'archive compte aussi : la règle traverse la bascule
    Object.keys(CAL.days).sort().forEach(iso => { const v = CAL.days[iso][mode]; if (v != null) dernier[String(v)] = T.numJour(iso); });
    jours.forEach(iso => {
      const v = JS[iso][mode], n = T.numJour(iso);
      if (v == null) return;
      const force = anniv(iso).includes(persoDe(mode, v));   // l'anniversaire passe avant la règle des 90 jours
      // 90 en dur, pas T.EXCLUSION : c'est la règle du propriétaire qu'on vérifie,
      // pas la constante du module (un module saboté s'y adapterait).
      if (!force && dernier[String(v)] !== undefined) { verifiees++; if (n - dernier[String(v)] <= 90) repetitions++; }
      dernier[String(v)] = n;
    });
  });
  ok(repetitions === 0, `règle 1 : aucune réponse ne revient dans le même mode avant 90 jours (${verifiees} retours vérifiés)`);
}
{
  let doublons = 0;
  jours.forEach(iso => {
    const noms = PERSOS.map(m => persoDe(m, JS[iso][m])).filter(Boolean);
    if (new Set(noms).size !== noms.length) doublons++;
  });
  ok(doublons === 0, 'règle 4 : jamais le même personnage dans deux modes le même jour');
}
{
  let fetes = 0, manques = 0;
  jours.forEach(iso => anniv(iso).forEach(nom => {
    if (!DATA.CHARACTERS.some(c => c.name === nom)) return;
    fetes++;
    if (!PERSOS.some(m => persoDe(m, JS[iso][m]) === nom)) manques++;
  }));
  ok(fetes > 10 && manques === 0, `règle 5 : chaque anniversaire sort dans un des modes (${fetes} anniversaires)`);
  const modes = new Set();
  jours.forEach(iso => anniv(iso).forEach(nom => PERSOS.forEach(m => { if (persoDe(m, JS[iso][m]) === nom) modes.add(m); })));
  ok(modes.size >= 3, `règle 5 : l'anniversaire ne tombe pas toujours dans le même mode (${modes.size} modes différents)`);
}
{
  const b = CAL.bascule;
  const neufs = new Set(CAL.entrees.personnages[b] || []);
  const sortis = new Set();
  jours.slice(0, 60).forEach(iso => PERSOS.forEach(m => { const p = persoDe(m, JS[iso][m]); if (neufs.has(p)) sortis.add(p); }));
  ok(neufs.size === 0 || sortis.size === neufs.size, `règle 3 : les ${neufs.size} nouveaux personnages sortent tous dans les 60 premiers jours`);
  // Précision du propriétaire : le bonus sert à ce qu'un nouveau arrive au moins une fois
  // dans UN des modes — il s'éteint partout dès sa première sortie.
  {
    const ctx = T.preparer(DATA, FOCUS, CAL);
    const entree = T.numJour(b);
    const premiere = {};   // nouveau -> jour de sa 1re sortie, suivi indépendamment du module
    let controles = 0, erreurs = 0;
    for (let i = 0; i < 70; i++) {
      const n = entree + i, iso = T.isoDe(n);
      neufs.forEach(nom => {
        const attendu = (n - entree < T.BOOST_JOURS) && premiere[nom] === undefined;
        ['classic', 'wanted', 'silhouette', 'emoji'].forEach(m => {
          const el = ctx.pools[m].find(e => e.perso === nom);
          if (!el) return;
          controles++;
          if (T.booste(ctx, m, el, n) !== attendu) erreurs++;
        });
      });
      const r = T.jour(ctx, iso);
      PERSOS.forEach(m => { const p = persoDe(m, r[m]); if (neufs.has(p) && premiere[p] === undefined) premiere[p] = n; });
    }
    ok(controles > 500 && erreurs === 0,
       `règle 3 : un nouveau est favorisé jusqu'à sa 1re sortie dans n'importe quel mode, plus du tout ensuite (${controles} contrôles)`);
  }
  const tome = (CAL.entrees.tomes[b] || []).map(Number);
  ok(!tome.length || tome.every(t => jours.slice(0, 60).some(iso => JS[iso].tome === t)), 'règle 3 : le nouveau tome sort dans les 60 premiers jours');
}

// ── 3. Stabilité : le passé et la journée en cours ne bougent jamais ─────────
console.log('\n— 3. Stabilité —');
{
  const ctx = T.preparer(DATA, FOCUS, CAL);
  const archive = Object.keys(CAL.days);
  ok(archive.every(iso => JSON.stringify(T.jour(ctx, iso)) === JSON.stringify(CAL.days[iso])), `les ${archive.length} journées de l'archive sont rendues telles quelles`);
  ok(JSON.stringify(suite(DATA, FOCUS, CAL, undefined, 120)) === JSON.stringify(Object.fromEntries(jours.slice(0, 120).map(i => [i, JS[i]]))),
     'déterministe : deux calculs indépendants donnent les mêmes journées');
}
{
  // Ajout d'un personnage qui entre au jour 200 : rien ne change avant, et il sort ensuite.
  const data = clone(DATA), cal = clone(CAL);
  const nouveau = Object.assign(clone(DATA.CHARACTERS[0]), { name: 'Perso Test' });
  data.CHARACTERS.push(nouveau);
  const entree = T.isoDe(T.numJour(CAL.bascule) + 200);
  cal.entrees.personnages[entree] = ['Perso Test'];
  const apres = suite(data, FOCUS, cal);
  const avant200 = jours.slice(0, 200);
  ok(avant200.every(iso => JSON.stringify(apres[iso]) === JSON.stringify(JS[iso])), 'un ajout daté du jour 200 ne change AUCUNE des 200 journées d\'avant');
  ok(jours.slice(0, 200).every(iso => !PERSOS.some(m => apres[iso][m] === 'Perso Test')), 'un ajout ne sort jamais avant sa date d\'entrée');
  ok(jours.slice(200, 260).some(iso => PERSOS.some(m => apres[iso][m] === 'Perso Test')), 'le nouveau sort dans les 60 jours qui suivent son entrée');
}
{
  // Élément sans date d'entrée : jamais tiré (l'oubli retarde, il ne casse rien).
  const data = clone(DATA);
  data.CHARACTERS.push(Object.assign(clone(DATA.CHARACTERS[0]), { name: 'Sans Date' }));
  const res = suite(data, FOCUS, CAL);
  ok(jours.every(iso => !PERSOS.some(m => res[iso][m] === 'Sans Date')), 'un élément sans date d\'entrée n\'est jamais tiré');
  ok(jours.every(iso => JSON.stringify(res[iso]) === JSON.stringify(JS[iso])), 'sa présence ne change aucune des 500 journées des autres');
}
{
  // Opening : même tirage qu'avant la v8.1 (sac sans remise, sel 53).
  const ops = DATA.OPENINGS;
  ok(jours.every(iso => JS[iso].audio === ops[T.bagPick(T.numJour(iso), 53, ops.length)].id), 'Opening : tirage d\'avant inchangé, sans règle');
}
{
  // Aucune journée au-delà de la bascule dans le fichier public : plus rien d'avance.
  ok(!Object.keys(CAL.days).some(iso => iso >= CAL.bascule), 'calendar.json ne contient aucune journée à venir');
  const ctx = T.preparer(DATA, FOCUS, CAL);
  const sansDate = Object.keys(ctx.pools).reduce((s, m) => s + ctx.pools[m].filter(e => !isFinite(e.entree)).length, 0);
  ok(sansDate === 0, `tous les éléments des pools ont une date d'entrée (${sansDate} sans date)`);
}

console.log(`\n=== RÉSULTAT : ${passed} PASS, ${failed} FAIL ===`);
process.exit(failed ? 1 : 0);
