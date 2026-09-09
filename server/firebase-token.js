// ===== VÉRIFICATION D'UN JETON D'IDENTITÉ FIREBASE =====
// Le serveur Versus doit savoir QUI parle pour réserver les parties publiques
// et la file d'attente aux comptes. Un jeton Firebase est un JWT signé en
// RS256 par Google : on vérifie la signature contre les certificats publics de
// Google, puis les revendications (émetteur, audience, expiration).
//
// AUCUNE DÉPENDANCE — le crypto de Node suffit. Le SDK Admin ferait la même
// chose en tirant ~50 Mo de dépendances et une clé de service à protéger, pour
// un serveur qui n'a besoin que de lire un uid. Voir CLAUDE.md : le projet est
// volontairement sans dépendance ajoutée.
//
// ⚠️ Ce module n'accorde RIEN par lui-même : il répond « voici l'uid » ou
// « non ». C'est l'appelant qui décide de ce que l'uid autorise.
'use strict';

const crypto = require('crypto');

// Certificats publics de Google, tournants (~1 par jour, chevauchement large).
// ⚠️ Le chemin est `service_accounts`, PAS `robots` : cette seconde forme, qu'on
// trouve encore dans de vieux exemples, renvoie 404 depuis Google. Vérifié le
// 09/09/2026 — quatre certificats servis, Cache-Control max-age ~6 h.
const CERTS_URL = 'https://www.googleapis.com/service_accounts/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const PROJECT   = process.env.VERSUS_FB_PROJECT || 'logpose-eec08';
const ISSUER    = 'https://securetoken.google.com/' + PROJECT;
const SKEW_S    = 300;          // tolérance d'horloge : 5 min, comme le SDK Admin

let certs = null;               // { kid: pem }
let certsExpire = 0;            // horodatage d'expiration du cache

// Cache piloté par le Cache-Control de Google. En cas d'échec réseau on GARDE
// les anciens certificats : ils restent valables plusieurs heures après leur
// rotation, et refuser tout le monde parce que Google a hoqueté serait pire.
async function loadCerts(force) {
  if (!force && certs && Date.now() < certsExpire) return certs;
  try {
    const res = await fetch(CERTS_URL);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const cc = res.headers.get('cache-control') || '';
    const m = /max-age=(\d+)/.exec(cc);
    certs = data;
    certsExpire = Date.now() + (m ? Number(m[1]) : 3600) * 1000;
  } catch (e) {
    if (!certs) throw e;                       // rien en cache : on ne peut rien faire
    console.warn('[auth] certificats non rafraîchis (' + e.message + ') — on garde les anciens');
    certsExpire = Date.now() + 5 * 60_000;     // on retentera dans 5 min
  }
  return certs;
}

const fromB64Url = s => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

function decodeJson(part) {
  try { return JSON.parse(fromB64Url(part).toString('utf8')); }
  catch (e) { return null; }
}

// Google sert des CERTIFICATS X.509 à cette URL. On accepte aussi une clé
// publique nue : c'est exactement la même clé — extraite du certificat dans un
// cas, fournie telle quelle dans l'autre — et ça rend le module testable hors
// ligne, Node sachant lire un certificat mais pas en fabriquer.
function publicKeyOf(pem) {
  return /BEGIN CERTIFICATE/.test(pem)
    ? new crypto.X509Certificate(pem).publicKey
    : crypto.createPublicKey(pem);
}

/**
 * Vérifie un jeton d'identité Firebase.
 * @returns {Promise<{uid: string, email: string|null}|null>} null si invalide.
 */
async function verifyIdToken(token) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 4096) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const header = decodeJson(parts[0]);
  if (!header || header.alg !== 'RS256' || !header.kid) return null;

  // Un kid inconnu peut simplement signifier que Google a fait tourner ses clés
  // depuis notre dernier chargement : on force UN rafraîchissement avant de
  // refuser, sinon toutes les connexions casseraient à chaque rotation.
  // Et si les certificats sont carrément injoignables (panne, mauvaise URL), on
  // REFUSE proprement : laisser l'exception remonter ferait tomber le
  // traitement du message en SERVER_ERROR, sans rien dire d'utile au joueur.
  let pem = null;
  try {
    let jeu = await loadCerts(false);
    if (!jeu[header.kid]) jeu = await loadCerts(true);
    pem = jeu[header.kid] || null;
  } catch (e) {
    console.warn('[auth] certificats Google injoignables :', e.message);
    return null;
  }
  if (!pem) return null;

  let ok = false;
  try {
    ok = crypto.createVerify('RSA-SHA256')
      .update(parts[0] + '.' + parts[1])
      .verify(publicKeyOf(pem), fromB64Url(parts[2]));
  } catch (e) { return null; }
  if (!ok) return null;

  // Signature valable ne veut pas dire jeton acceptable : il faut encore qu'il
  // ait été émis POUR NOUS et qu'il ne soit pas périmé. Un jeton d'un autre
  // projet Firebase est parfaitement signé par les mêmes clés Google.
  const p = decodeJson(parts[1]);
  if (!p) return null;
  const now = Math.floor(Date.now() / 1000);
  if (p.aud !== PROJECT) return null;
  if (p.iss !== ISSUER) return null;
  if (!(Number(p.exp) > now - SKEW_S)) return null;
  if (!(Number(p.iat) < now + SKEW_S)) return null;
  if (Number(p.auth_time) > now + SKEW_S) return null;
  if (typeof p.sub !== 'string' || !p.sub || p.sub.length > 128) return null;

  return { uid: p.sub, email: typeof p.email === 'string' ? p.email : null };
}

// Pour les tests : injecter un jeu de certificats sans passer par le réseau.
function _setCerts(jeu, ttlMs) {
  certs = jeu;
  certsExpire = Date.now() + (ttlMs || 3600_000);
}

module.exports = { verifyIdToken, _setCerts, PROJECT, ISSUER };
