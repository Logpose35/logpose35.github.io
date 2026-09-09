// ===== TESTS DE LA VÉRIFICATION DE JETON FIREBASE =====
// `node test-token.js` — hermétique : on fabrique une paire de clés, on signe
// nos propres jetons et on injecte la clé publique via _setCerts(). Aucun appel
// réseau, aucun vrai jeton Firebase (qui expirerait de toute façon en une heure).
//
// Ce que ces tests protègent : un jeton signé par Google mais destiné à un AUTRE
// projet ne doit pas passer, pas plus qu'un jeton périmé ou bricolé. La signature
// seule ne prouve rien — les mêmes clés Google signent tous les projets Firebase.
'use strict';

const crypto = require('crypto');
const path = require('path');
const jetons = require(path.join(__dirname, 'firebase-token.js'));

let passed = 0, failed = 0;
function ok(cond, label) {
  if (cond) { passed++; console.log(`  ✅ ${label}`); }
  else      { failed++; console.log(`  ❌ ${label}`); }
}

// ── Fabrique de jetons ────────────────────────────────────────────────────
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const { privateKey: autreClef } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const KID = 'clef-de-test';

const b64url = obj => Buffer.from(JSON.stringify(obj)).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function signer(payload, opts = {}) {
  // `sansKid` plutôt que `kid: undefined` : le ternaire retombait sur la valeur
  // par défaut, et le test ne retirait donc jamais rien.
  const header = { alg: opts.alg || 'RS256', typ: 'JWT' };
  if (!opts.sansKid) header.kid = opts.kid || KID;
  const corps = b64url(header) + '.' + b64url(payload);
  if (opts.alg === 'none') return corps + '.';
  const sig = crypto.createSign('RSA-SHA256').update(corps)
    .sign(opts.clef || privateKey)
    .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return corps + '.' + sig;
}

const maintenant = () => Math.floor(Date.now() / 1000);
function charge(extra = {}) {
  const t = maintenant();
  return Object.assign({
    iss: jetons.ISSUER, aud: jetons.PROJECT, sub: 'uid-du-joueur',
    iat: t - 60, auth_time: t - 60, exp: t + 3600,
    email: 'pirate@exemple.fr',
  }, extra);
}

async function main() {
  // Clé publique injectée : le module ne touchera pas au réseau.
  jetons._setCerts({ [KID]: publicKey.export({ type: 'spki', format: 'pem' }) });

  console.log('\n— 1. Un jeton valable passe —');
  {
    const r = await jetons.verifyIdToken(signer(charge()));
    ok(!!r, 'un jeton bien formé est accepté');
    ok(r && r.uid === 'uid-du-joueur', 'l\'uid est remonté');
    ok(r && r.email === 'pirate@exemple.fr', 'l\'adresse est remontée quand elle est présente');
    const sansMail = await jetons.verifyIdToken(signer(charge({ email: undefined })));
    ok(sansMail && sansMail.email === null, 'sans adresse, le champ vaut null plutôt qu\'undefined');
  }

  console.log('\n— 2. Ce qui doit être refusé —');
  {
    // LE cas qui compte : les mêmes clés Google signent TOUS les projets Firebase.
    // Un jeton parfaitement signé mais émis pour un autre projet ne doit pas ouvrir
    // nos parties publiques.
    ok(await jetons.verifyIdToken(signer(charge({ aud: 'un-autre-projet' }))) === null,
       'jeton d\'un AUTRE projet Firebase : refusé');
    ok(await jetons.verifyIdToken(signer(charge({ iss: 'https://securetoken.google.com/autre' }))) === null,
       'émetteur inattendu : refusé');

    ok(await jetons.verifyIdToken(signer(charge({ exp: maintenant() - 3600 }))) === null,
       'jeton périmé : refusé');
    ok(await jetons.verifyIdToken(signer(charge({ iat: maintenant() + 3600 }))) === null,
       'émis dans le futur : refusé');
    ok(await jetons.verifyIdToken(signer(charge({ auth_time: maintenant() + 3600 }))) === null,
       'auth_time dans le futur : refusé');

    ok(await jetons.verifyIdToken(signer(charge(), { clef: autreClef })) === null,
       'signé avec une autre clé : refusé');
    ok(await jetons.verifyIdToken(signer(charge(), { alg: 'none' })) === null,
       'algorithme « none » : refusé');
    ok(await jetons.verifyIdToken(signer(charge(), { alg: 'HS256' })) === null,
       'algorithme HS256 annoncé : refusé');
    ok(await jetons.verifyIdToken(signer(charge(), { sansKid: true })) === null,
       'sans identifiant de clé : refusé');

    ok(await jetons.verifyIdToken(signer(charge({ sub: '' }))) === null, 'sub vide : refusé');
    ok(await jetons.verifyIdToken(signer(charge({ sub: 'x'.repeat(200) }))) === null, 'sub démesuré : refusé');
  }

  console.log('\n— 3. Charge utile modifiée après signature —');
  {
    const bon = signer(charge({ sub: 'moi' }));
    const [h, , s] = bon.split('.');
    const truque = h + '.' + b64url(charge({ sub: 'quelquun-dautre' })) + '.' + s;
    ok(await jetons.verifyIdToken(truque) === null, 'uid remplacé après coup : la signature ne colle plus');
  }

  console.log('\n— 4. Entrées malformées —');
  {
    const cas = [null, undefined, '', 'pas.un.jeton', 'a.b', 'a.b.c.d', 42, {}, 'x'.repeat(5000),
                 '....', 'YWJj.YWJj.YWJj'];
    let tous = true;
    for (const c of cas) if (await jetons.verifyIdToken(c) !== null) { tous = false; console.log('    passe à tort :', String(c).slice(0, 20)); }
    ok(tous, `${cas.length} entrées bancales : toutes refusées, aucune exception`);
  }

  console.log('\n— 5. Rotation des clés —');
  {
    // kid inconnu : le module force UN rafraîchissement. On coupe le réseau pour
    // vérifier qu'il refuse proprement au lieu de planter, et qu'il GARDE les
    // certificats en cache (un hoquet de Google ne doit pas déconnecter tout le monde).
    const vraiFetch = global.fetch;
    global.fetch = async () => { throw new Error('réseau coupé (test)'); };
    try {
      ok(await jetons.verifyIdToken(signer(charge(), { kid: 'clef-inconnue' })) === null,
         'clé inconnue et réseau coupé : refusé sans planter');
      ok(await jetons.verifyIdToken(signer(charge())) !== null,
         'les certificats en cache survivent à l\'échec réseau');
    } finally { global.fetch = vraiFetch; }
  }

  console.log('\n— 6. L\'URL des certificats de Google (test RÉSEAU) —');
  {
    // Les cinq sections précédentes injectent les certificats et ne touchent
    // JAMAIS au réseau. C'est exactement par ce trou qu'est passée une URL
    // périmée (« robots/ » au lieu de « service_accounts/ »), qui renvoyait
    // 404 : tous les tests au vert, et aucune connexion possible en vrai.
    const src = require('fs').readFileSync(path.join(__dirname, 'firebase-token.js'), 'utf8');
    const url = (/const CERTS_URL = '([^']+)'/.exec(src) || [])[1];
    ok(!!url, 'URL des certificats trouvée dans le module');
    try {
      const r = await fetch(url);
      ok(r.ok, `Google répond ${r.status} (et non 404)`);
      if (r.ok) {
        const j = await r.json();
        const kids = Object.keys(j);
        ok(kids.length > 0, `${kids.length} certificats servis`);
        ok(kids.every(k => /BEGIN CERTIFICATE/.test(j[k])),
           'tous au format X.509, celui qu\'attend le module');
      }
    } catch (e) {
      console.log('  ⏭  hors ligne, contrôle réseau sauté : ' + e.message);
    }
  }

  console.log(`\n=== RÉSULTAT : ${passed} PASS, ${failed} FAIL ===`);
  // Pas de process.exit() immédiat : depuis l'ajout du contrôle réseau, la
  // socket HTTP se referme encore quand on sort, et Node plante sur une
  // assertion libuv (code 127) — un test « 0 FAIL » qui sort en 127 est
  // inutilisable. On pose le code et on laisse la boucle se vider ; le
  // minuteur, non référencé, ne maintient pas le processus en vie et ne sert
  // que de filet si une connexion traîne.
  process.exitCode = failed ? 1 : 0;
  setTimeout(() => process.exit(process.exitCode), 3000).unref();
}

main().catch(e => { console.error('ÉCHEC DU SCÉNARIO :', e); process.exit(1); });
