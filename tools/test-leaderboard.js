// ===== TESTS DU CLASSEMENT DU JOUR (js/leaderboard.js) =====
// `node tools/test-leaderboard.js` — aucune dépendance, aucun réseau, aucun DOM.
// Seule la partie PURE est couverte ici : le tri, le plafond, le découpage du
// podium et le repérage de sa propre ligne. Le transport (publication du score,
// lecture publique) est testé dans tools/test-account-sync.js, où vit déjà la
// fausse base.
//
// Ce que ces tests protègent : deux appareils qui lisent la même journée doivent
// afficher EXACTEMENT la même liste, et une ligne abîmée arrivée du réseau ne
// doit jamais faire disparaître le classement.
'use strict';

const { classer, MAX } = require('../js/leaderboard.js');

let passed = 0, failed = 0;
function ok(cond, label) {
  if (cond) { passed++; console.log(`  ✅ ${label}`); }
  else      { failed++; console.log(`  ❌ ${label}`); }
}

// Fabrique une journée : { u1: {n,s,t}, ... }
function jour(lignes) {
  const o = {};
  lignes.forEach(([uid, n, s, t, d]) => {
    o[uid] = { n, s, t: t === undefined ? 0 : t };
    if (d !== undefined) o[uid].d = d;      // série : facultative, comme dans la base
  });
  return o;
}

console.log('\n— 1. Tri et rangs —');
{
  const c = classer(jour([
    ['u1', 'Nami',   12000],
    ['u2', 'Zoro',   45000],
    ['u3', 'Sanji',  30000],
  ]));
  ok(c.total === 3, 'les trois lignes sont comptées');
  ok(c.tete.map(l => l.nom).join(',') === 'Zoro,Sanji,Nami', 'score décroissant');
  ok(c.tete.map(l => l.rang).join(',') === '1,2,3', 'les rangs partent de 1');
  ok(c.moi === null, 'sans uid fourni, aucune ligne n’est « la mienne »');
}

console.log('\n— 2. Podium limité à 5 —');
{
  const c = classer(jour([
    ['u1', 'A', 9000], ['u2', 'B', 8000], ['u3', 'C', 7000],
    ['u4', 'D', 6000], ['u5', 'E', 5000], ['u6', 'F', 4000], ['u7', 'G', 3000],
  ]));
  ok(c.tete.length === 5, 'seules cinq lignes sont retenues');
  ok(c.total === 7, 'mais le total dit bien sept');
  ok(c.tete[4].nom === 'E', 'la cinquième est la bonne');
}

console.log('\n— 3. Sa propre ligne —');
{
  const j = jour([
    ['u1', 'A', 9000], ['u2', 'B', 8000], ['u3', 'C', 7000],
    ['u4', 'D', 6000], ['u5', 'E', 5000], ['u6', 'F', 4000], ['moi', 'Moi', 3000],
  ]);
  const dehors = classer(j, { uid: 'moi' });
  ok(dehors.moi && dehors.moi.rang === 7, 'hors du top 5, le rang réel est connu');
  ok(dehors.moiDansTete === false, 'et signalé comme hors du podium');
  ok(!dehors.tete.some(l => l.uid === 'moi'), 'sans polluer le podium');

  const dedans = classer(j, { uid: 'u2' });
  ok(dedans.moiDansTete === true, 'dans le top 5, c’est dit');
  ok(dedans.moi.rang === 2, 'avec le bon rang');

  const absent = classer(j, { uid: 'inconnu' });
  ok(absent.moi === null, 'un compte qui n’a pas joué n’a pas de ligne');
}

console.log('\n— 4. Égalités : l’ordre doit être STRICTEMENT déterminé —');
{
  // Deux appareils qui lisent la même journée doivent peindre la même liste.
  // Sans départage complet, l’ordre dépendrait de celui des clés reçues.
  const c = classer(jour([
    ['u2', 'Tard',  5000, 200],
    ['u1', 'Tot',   5000, 100],
  ]));
  ok(c.tete[0].nom === 'Tot', 'à score égal, le premier arrivé passe devant');

  const memeInstant = classer(jour([
    ['ub', 'B', 5000, 100],
    ['ua', 'A', 5000, 100],
  ]));
  ok(memeInstant.tete[0].uid === 'ua', 'à instant égal, l’uid tranche');

  // Le même jeu de données présenté dans l’autre sens doit donner la même liste.
  const sens1 = classer(jour([['ua', 'A', 5000, 100], ['ub', 'B', 5000, 100]]));
  ok(JSON.stringify(sens1.tete.map(l => l.uid)) === JSON.stringify(memeInstant.tete.map(l => l.uid)),
     'et l’ordre d’arrivée des clés ne change rien');
}

console.log('\n— 5. Plafond —');
{
  const c = classer(jour([['u1', 'Triche', 999999], ['u2', 'Sage', 60000]]));
  ok(c.tete[0].score === MAX, `un score délirant est ramené à ${MAX}`);
  ok(MAX === 70000, 'le plafond est bien 70 000');
  const neg = classer(jour([['u1', 'Negatif', -500]]));
  ok(neg.tete[0].score === 0, 'un score négatif devient 0');
  const flottant = classer(jour([['u1', 'Virgule', 1234.7]]));
  ok(flottant.tete[0].score === 1235, 'un score à virgule est arrondi');
}

console.log('\n— 6. Lignes abîmées : on ignore, on ne casse pas —');
{
  const c = classer({
    bon:      { n: 'Valide', s: 100 },
    sansNom:  { s: 500 },
    nomVide:  { n: '   ', s: 500 },
    nomObjet: { n: { toString: () => 'Rusé' }, s: 500 },
    sansScore:{ n: 'Fantome' },
    scoreTxt: { n: 'Texte', s: 'beaucoup' },
    nul:      null,
    pasObjet: 42,
  });
  ok(c.total === 1, 'une seule ligne exploitable est retenue');
  ok(c.tete[0].nom === 'Valide', 'et c’est la bonne');
}
{
  const c = classer(jour([['u1', '  Espaces  ', 100]]));
  ok(c.tete[0].nom === 'Espaces', 'les espaces autour du nom sont retirés');
}
{
  const c = classer(null);
  ok(c.total === 0 && c.tete.length === 0 && c.moi === null, 'une journée vide ne jette pas');
  const d = classer({});
  ok(d.total === 0, 'un objet vide non plus');
}

console.log('\n— 7. Horodatage absent —');
{
  // Les lignes écrites avant l’ajout de `t` (ou par un client plus vieux) ne
  // doivent pas remonter artificiellement en tête.
  const c = classer(jour([['u1', 'SansT', 5000, undefined], ['u2', 'AvecT', 9000, 50]]));
  ok(c.tete[0].nom === 'AvecT', 'le score prime toujours sur l’horodatage');
  ok(c.tete[1].t === 0, 'un horodatage manquant vaut 0');
}

console.log('\n— 8. Série de jours consécutifs —');
{
  // La série est FACULTATIVE : les lignes écrites avant son ajout n'ont pas de
  // `d`, et doivent rester des lignes valables — pas disparaître du classement.
  const c = classer(jour([
    ['u1', 'Fidele',  9000, 10, 42],
    ['u2', 'Ancienne', 8000, 20],           // pas de `d` du tout
    ['u3', 'Premier',  7000, 30, 1],
  ]));
  ok(c.total === 3, 'une ligne sans série reste classée');
  ok(c.tete[0].serie === 42, 'la série est lue depuis `d`');
  ok(c.tete[1].serie === 0, 'une série absente vaut 0, pas NaN');
  ok(c.tete[2].serie === 1, 'une série de 1 est conservée telle quelle (l\'affichage seul la masque)');
}
{
  // Bornage : la série passe par le même garde-fou que le score. La règle de la
  // base borne aussi de son côté — ceci n'est que la deuxième ceinture.
  const c = classer(jour([
    ['u1', 'Enorme',  9000, 10, 999999],
    ['u2', 'Negative', 8000, 20, -5],
    ['u3', 'Texte',    7000, 30, 'beaucoup'],
    ['u4', 'Virgule',  6000, 40, 7.6],
  ]));
  ok(c.tete[0].serie === 10000, 'une série démesurée est ramenée au plafond');
  ok(c.tete[1].serie === 0, 'une série négative est ramenée à 0');
  ok(c.tete[2].serie === 0, 'une série non numérique vaut 0');
  ok(c.tete[3].serie === 8, 'une série décimale est arrondie');
}
{
  // La série ne doit RIEN changer au classement : il se joue au score.
  const c = classer(jour([
    ['u1', 'PetitScoreGrandeSerie', 100,  10, 900],
    ['u2', 'GrosScoreSansSerie',   50000, 20],
  ]));
  ok(c.tete[0].nom === 'GrosScoreSansSerie', 'la série ne fait pas remonter au classement');
}

console.log(`\n=== RÉSULTAT : ${passed} PASS, ${failed} FAIL ===`);
process.exitCode = failed ? 1 : 0;
