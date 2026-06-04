/* ============================================================================
 * Jolly Roger procédural — générateur SVG (source unique de vérité)
 * ----------------------------------------------------------------------------
 * Ce fichier est destiné à être copié TEL QUEL dans le site LogPose (Phase 2).
 * Il ne dépend de rien (vanilla) et n'utilise le DOM que dans renderJollyRoger().
 *
 * API publique (cf. JOLLY_ROGER.md §2) :
 *   buildJollyRoger(fp)           -> { svg, variant }   (pur, déterministe)
 *   computeDeviceFingerprint()    -> uint32             (fingerprint appareil)
 *   renderJollyRoger(targetEl)    -> variant            (inject le SVG)
 *   getJollyRogerVariantName()    -> "Palette · Coiffe · Croix"
 * ==========================================================================*/
(function (global) {
  'use strict';

  /* ---- Fingerprint (FNV-1a 32 bits) -------------------------------------- */
  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }
  function computeDeviceFingerprint() {
    let tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
    const parts = [
      (global.screen && screen.width) || 0,
      (global.screen && screen.height) || 0,
      (global.screen && screen.colorDepth) || 0,
      (global.navigator && navigator.language) || '',
      tz,
      (global.navigator && navigator.hardwareConcurrency) || 0
    ];
    return fnv1a(parts.join('|'));
  }

  /* ---- Données des axes (cf. JOLLY_ROGER.md §3-§4) ----------------------- */
  // Palettes Mugiwara : une couleur par membre d'équipage (bordure = couleur du perso,
  // fond = teinte sombre assortie → le crâne clair ressort toujours).
  const PALETTES = [
    { name: 'Luffy',   bg: '#2a0c0c', bgHi: '#4d1818', border: '#e23b34' }, // rouge
    { name: 'Zoro',    bg: '#0e2614', bgHi: '#194a29', border: '#36a04f' }, // vert
    { name: 'Nami',    bg: '#2a1606', bgHi: '#4a2a0c', border: '#f0902c' }, // orange
    { name: 'Usopp',   bg: '#2a2208', bgHi: '#463a12', border: '#e8c33a' }, // jaune
    { name: 'Sanji',   bg: '#0c1428', bgHi: '#1a2c54', border: '#4a7fd0' }, // bleu
    { name: 'Chopper', bg: '#2a0f1a', bgHi: '#4a1d31', border: '#ec84a6' }, // rose
    { name: 'Robin',   bg: '#1c0f2e', bgHi: '#352251', border: '#9a63d6' }, // violet
    { name: 'Franky',  bg: '#08222a', bgHi: '#114048', border: '#36bccb' }, // cyan
    { name: 'Brook',   bg: '#131316', bgHi: '#28282f', border: '#d8d2c0' }, // os / macabre
    { name: 'Jinbe',   bg: '#0c1024', bgHi: '#1c2450', border: '#445bb0' }  // indigo
  ];
  const SKULLS = [
    { name: 'Ivoire',    fill: '#f3ead3', hi: '#fdf8ea', shade: '#c9bb96' },
    { name: 'Or',        fill: '#e8c66a', hi: '#f6df9b', shade: '#b3923c' },
    { name: 'Bleu pâle', fill: '#cfe0f0', hi: '#ecf4fc', shade: '#94b1cf' },
    { name: 'Vert pâle', fill: '#cfe9d4', hi: '#ecf8f0', shade: '#96bfa1' },
    { name: 'Rose pâle', fill: '#f0d6dd', hi: '#fceef2', shade: '#c39fab' }
  ];
  const HATS   = ['Aucun', 'Bandana', 'Tricorne', 'Bicorne', 'Haut-de-forme', 'Couronne', 'Casque à cornes', 'Chapeau de paille'];
  const EMBLEMS = ['Os croisés', 'Sabres croisés', 'Lances croisées', 'Ancre', 'Tridents croisés', 'Canons croisés'];
  const SHAPES  = ['Rond', 'Allongé', 'Anguleux', 'Large', 'Mâchoire proéminente'];

  const VOID = '#14110c';            // creux (orbites, nez, bouche)
  const STRAW = '#e3b24c';           // paille fixe (jamais teintée par la palette)
  const STRAW_SHADE = '#b07d24';

  // --- Axes stretch (cf. JOLLY_ROGER.md §3) ---
  const EYE_ACC  = ['Aucun', 'Cache-œil', 'Cicatrice', 'Dent d\'or'];
  const BORDERS  = ['Anneau', 'Corde', 'Chaîne', 'Rivets', 'Pointillés', 'Double'];
  const TRINKETS = ['Aucune', 'Boucle d\'oreille', 'Cigarette (Sanji)',
    'Triple boucle (Zoro)', 'Mandarine (Nami)', 'Bois (Chopper)', 'Fleur (Robin)',
    'Note de musique (Brook)'];

  // Domaines exposés (utile pour la galerie du lab)
  const META = { PALETTES, SKULLS, HATS, EMBLEMS, SHAPES, EYE_ACC, BORDERS, TRINKETS };

  /* ---- Décodage du fingerprint en indices d'axes ------------------------- */
  // Allocation des bits (tranches distinctes) :
  //  0-3 pal | 4-7 crâne | 8-11 coiffe | 12-15 emblème | 16-18 forme |
  //  19 fissure | 20-22 œil | 23-25 bordure | 26-29 babiole
  function decode(fp) {
    fp = fp >>> 0;
    return {
      pal:    (fp & 0xF) % PALETTES.length,
      skull:  ((fp >>> 4) & 0xF) % SKULLS.length,
      hat:    ((fp >>> 8) & 0xF) % HATS.length,
      emblem: ((fp >>> 12) & 0xF) % EMBLEMS.length,
      shape:  ((fp >>> 16) & 7) % SHAPES.length,
      fissure:(fp >>> 19) & 1,
      eyeAcc: ((fp >>> 20) & 7) % EYE_ACC.length,
      border: ((fp >>> 23) & 7) % BORDERS.length,
      trinket:((fp >>> 26) & 0xF) % TRINKETS.length
    };
  }

  /* ---- Géométrie par forme de crâne ------------------------------------- */
  const FACE = {
    0: { // Rond
      path: 'M50,18 C66,18 78,30 78,46 C78,56 74,61 69,64 C66,66 64,68 62,72 ' +
            'C60,76 56,80 50,80 C44,80 40,76 38,72 C36,68 34,66 31,64 ' +
            'C26,61 22,56 22,46 C22,30 34,18 50,18 Z',
      eyeY: 45, eyeLX: 38, eyeRX: 62, eyeRx: 10, eyeRy: 11,
      noseY: 55, noseTip: 63, mouthY: 68, topY: 18, earX: 29, earY: 66
    },
    1: { // Allongé / anguleux
      path: 'M50,16 C64,16 75,28 75,45 C75,57 71,63 66,67 C63,70 62,73 60,78 ' +
            'C58,83 55,87 50,87 C45,87 42,83 40,78 C38,73 37,70 34,67 ' +
            'C29,63 25,57 25,45 C25,28 36,16 50,16 Z',
      eyeY: 44, eyeLX: 39, eyeRX: 61, eyeRx: 9.5, eyeRy: 11.5,
      noseY: 56, noseTip: 66, mouthY: 72, topY: 16, earX: 31, earY: 71
    },
    2: { // Anguleux / carré — tempes droites, mâchoire marquée, menton plat
      path: 'M50,16 C61,16 70,20 73,29 L74,42 C74,49 72,54 68,59 L64,65 ' +
            'C61,70 58,74 54,77 L46,77 C42,74 39,70 36,65 L32,59 ' +
            'C28,54 26,49 26,42 L27,29 C30,20 39,16 50,16 Z',
      eyeY: 44, eyeLX: 38, eyeRX: 62, eyeRx: 9.8, eyeRy: 10.5,
      noseY: 54, noseTip: 62, mouthY: 67, topY: 16, earX: 29, earY: 64
    },
    3: { // Large / trapu — massif, court
      path: 'M50,20 C68,20 82,30 82,45 C82,54 78,59 72,63 C68,66 65,69 61,72 ' +
            'C58,75 54,77 50,77 C46,77 42,75 39,72 C35,69 32,66 28,63 ' +
            'C22,59 18,54 18,45 C18,30 32,20 50,20 Z',
      eyeY: 46, eyeLX: 37, eyeRX: 63, eyeRx: 11, eyeRy: 11,
      noseY: 56, noseTip: 64, mouthY: 69, topY: 20, earX: 25, earY: 65
    },
    4: { // Mâchoire proéminente — bas du visage large, ricanement
      path: 'M50,17 C63,17 75,27 76,42 C76,50 73,55 69,59 C67,62 66,65 66,69 ' +
            'C66,76 60,82 50,82 C40,82 34,76 34,69 C34,65 33,62 31,59 ' +
            'C27,55 24,50 24,42 C25,27 37,17 50,17 Z',
      eyeY: 41, eyeLX: 38, eyeRX: 62, eyeRx: 9.5, eyeRy: 10,
      noseY: 51, noseTip: 59, mouthY: 70, topY: 17, earX: 28, earY: 64
    }
  };

  /* ---- Briques de dessin ------------------------------------------------- */
  function skullMass(f, sk, uid) {
    return '<path d="' + f.path + '" fill="url(#' + uid + '-sk)" stroke="rgba(0,0,0,.38)" ' +
           'stroke-width="1.4" stroke-linejoin="round"/>' +
           // modelé : ombre sous les pommettes
           '<path d="' + f.path + '" fill="none" stroke="' + sk.shade + '" stroke-width="0.8" opacity=".4"/>';
  }

  // Orbite « en goutte » : haut arrondi large, effilée vers une pointe basse
  // légèrement tournée vers le nez (dir=+1 œil gauche, dir=-1 œil droit) → menaçant.
  function eyeShape(cx, cy, rx, ry, dir) {
    const px = cx + dir * rx * 0.28, py = cy + ry * 1.08;
    return '<path d="M' + (cx - rx) + ',' + (cy - ry * 0.15) +
      ' C' + (cx - rx) + ',' + (cy - ry) + ' ' + (cx + rx) + ',' + (cy - ry) + ' ' + (cx + rx) + ',' + (cy - ry * 0.15) +
      ' C' + (cx + rx) + ',' + (cy + ry * 0.45) + ' ' + (px + rx * 0.55) + ',' + (py - ry * 0.18) + ' ' + px + ',' + py +
      ' C' + (px - rx * 0.55) + ',' + (py - ry * 0.18) + ' ' + (cx - rx) + ',' + (cy + ry * 0.45) + ' ' + (cx - rx) + ',' + (cy - ry * 0.15) +
      ' Z" fill="' + VOID + '"/>';
  }
  function eyes(f) {
    return eyeShape(f.eyeLX, f.eyeY, f.eyeRx, f.eyeRy, 1) +
           eyeShape(f.eyeRX, f.eyeY, f.eyeRx, f.eyeRy, -1);
  }

  function nose(f) {
    return '<path d="M46,' + f.noseY + ' L54,' + f.noseY + ' L50,' + f.noseTip + ' Z" fill="' + VOID + '"/>';
  }

  function mouth(f, sk, uid, goldTooth) {
    const mY = f.mouthY;
    const lens = 'M37,' + mY + ' Q50,' + (mY - 5) + ' 63,' + mY + ' Q50,' + (mY + 6) + ' 37,' + mY + ' Z';
    let bars = '';
    [42, 46, 50, 54, 58].forEach(function (x) {
      const col = (goldTooth && x === 54) ? '#e3c04f' : sk.fill;   // une dent en or
      bars += '<rect x="' + (x - 0.9) + '" y="' + (mY - 7) + '" width="1.8" height="16" fill="' + col + '"/>';
    });
    return '<defs><clipPath id="' + uid + '"><path d="' + lens + '"/></clipPath></defs>' +
           '<path d="' + lens + '" fill="' + VOID + '"/>' +
           '<g clip-path="url(#' + uid + ')">' + bars + '</g>';
  }

  // Fissure (overlay) : craquelure descendant de la calotte, gravée (ombre + reflet)
  function fissure(f, sk) {
    const y = f.topY;
    const d = 'M52,' + (y + 1) + ' l-3,7 l3.5,4 l-3,6 l2.5,5 l-1.5,4';
    return '<path d="' + d + '" fill="none" stroke="rgba(0,0,0,.42)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>' +
           '<path d="' + d + '" fill="none" stroke="' + sk.hi + '" stroke-width="0.5" opacity=".5"/>' +
           '<path d="M49,' + (y + 8) + ' l-4,3" fill="none" stroke="rgba(0,0,0,.4)" stroke-width="1.2" stroke-linecap="round"/>';  // embranchement
  }

  /* ---- Croix (os / sabres), DERRIÈRE le crâne --------------------------- */
  function bone(sk) {
    // os horizontal centré, à roto ±45 par l'appelant
    return '<g>' +
      '<circle cx="17" cy="46.5" r="4.6" fill="' + sk.fill + '" stroke="' + sk.shade + '" stroke-width="0.8"/>' +
      '<circle cx="17" cy="53.5" r="4.6" fill="' + sk.fill + '" stroke="' + sk.shade + '" stroke-width="0.8"/>' +
      '<circle cx="83" cy="46.5" r="4.6" fill="' + sk.fill + '" stroke="' + sk.shade + '" stroke-width="0.8"/>' +
      '<circle cx="83" cy="53.5" r="4.6" fill="' + sk.fill + '" stroke="' + sk.shade + '" stroke-width="0.8"/>' +
      '<rect x="17" y="46.5" width="66" height="7" rx="3.2" fill="' + sk.fill + '" stroke="' + sk.shade + '" stroke-width="0.8"/>' +
      '<rect x="20" y="47.4" width="60" height="1.5" rx="0.7" fill="' + sk.hi + '" opacity=".55"/>' +   // reflet
    '</g>';
  }
  // Cutlass courbe — repère local : ORIGINE = point de croisement (milieu de la
  // lame). La lame traverse l'origine (pointe vers +X, fort vers -16) ; en dessous
  // viennent la garde puis le manche+pommeau. Ainsi les 2 sabres se croisent
  // vraiment en X (et pas seulement bout à bout aux gardes).
  function cutlass() {
    const BLADE = '#e9edf2', EDGE = '#7c828c', GRIP = '#b9bec6', GUARD = '#d8c587';
    return '<g>' +
      // lame courbe traversant l'origine : du fort (-16) à la pointe (+42)
      '<path d="M-16,-1.7 Q14,-6 37,-3.4 L42,-1.1 Q41.5,0.3 37,1.1 Q14,-0.6 -16,1.8 Z" ' +
        'fill="' + BLADE + '" stroke="' + EDGE + '" stroke-width="0.5" stroke-linejoin="round"/>' +
      // garde (quillon) sous le fort + petit arc de garde
      '<path d="M-16,-5 Q-11.5,0 -16,5" fill="none" stroke="' + GUARD + '" stroke-width="2.2" stroke-linecap="round"/>' +
      '<path d="M-16,4.5 Q-21,4 -22.5,0" fill="none" stroke="' + GUARD + '" stroke-width="1.6" stroke-linecap="round"/>' +
      // manche + pommeau (bras bas du X) — allongé/épaissi pour équilibrer la lame
      '<rect x="-34" y="-1.9" width="18" height="3.8" rx="1.6" fill="' + GRIP + '"/>' +
      '<circle cx="-36" cy="0" r="2.9" fill="' + GUARD + '"/>' +
    '</g>';
  }
  // --- Unités d'armes (repère local, +X = pointe, origine = croisement) ----
  function spear() { // lance / harpon
    const W = '#6e4a2b', WS = '#4a3318', ST = '#cdd3db', STE = '#8c929c';
    return '<g>' +
      '<rect x="-34" y="-1" width="62" height="2" rx="1" fill="' + W + '"/>' +          // hampe
      '<rect x="-37" y="-1.7" width="4.5" height="3.4" rx="1" fill="' + WS + '"/>' +     // talon
      '<polygon points="26,-3.4 40,-2.4 44,0 40,2.4 26,3.4" fill="' + ST + '" stroke="' + STE + '" stroke-width="0.5"/>' + // fer
      '<line x1="28" y1="0" x2="42" y2="0" stroke="' + STE + '" stroke-width="0.4"/>' +
      '<rect x="24" y="-1.6" width="3" height="3.2" fill="' + WS + '"/>' +               // ligature
    '</g>';
  }
  function trident() {
    const W = '#5a4a6a', ST = '#cdd3db', STE = '#8c929c';
    return '<g>' +
      '<rect x="-34" y="-1" width="58" height="2" rx="1" fill="' + W + '"/>' +
      '<circle cx="-35" cy="0" r="2.2" fill="' + W + '"/>' +
      '<rect x="23" y="-6.5" width="2.3" height="13" rx="1" fill="' + ST + '" stroke="' + STE + '" stroke-width="0.4"/>' +   // barre
      '<polygon points="25,-1.3 45,0 25,1.3" fill="' + ST + '" stroke="' + STE + '" stroke-width="0.4"/>' +                 // dent centrale
      '<path d="M25,-5.5 Q40,-7 42,-4 L40,-4 Q34,-5 26,-3.6 Z" fill="' + ST + '" stroke="' + STE + '" stroke-width="0.4"/>' + // dent haute
      '<path d="M25,5.5 Q40,7 42,4 L40,4 Q34,5 26,3.6 Z" fill="' + ST + '" stroke="' + STE + '" stroke-width="0.4"/>' +      // dent basse
    '</g>';
  }
  function cannon() {
    const IRON = '#50555d', HI = '#7b818d', DK = '#262931', BR = '#b9893a';
    return '<g>' +
      '<circle cx="-34" cy="0" r="3.4" fill="' + IRON + '" stroke="' + DK + '" stroke-width="0.5"/>' +   // cascabel
      '<rect x="-33" y="-1.4" width="3" height="2.8" fill="' + IRON + '"/>' +                            // col
      '<polygon points="-30,-4.4 32,-3.4 37,-3.6 37,3.6 32,3.4 -30,4.4" fill="' + IRON + '" stroke="' + DK + '" stroke-width="0.5"/>' + // fût tronconique
      '<rect x="-31" y="-4.3" width="10" height="2" rx="1" fill="' + BR + '" opacity=".9"/>' +           // renfort de culasse (laiton)
      '<rect x="32" y="-4.2" width="6" height="8.4" rx="1.3" fill="' + IRON + '" stroke="' + DK + '" stroke-width="0.5"/>' + // bourrelet de bouche
      '<rect x="33" y="-4" width="4.5" height="1.6" fill="' + BR + '" opacity=".85"/>' +                 // bague laiton
      '<rect x="-28" y="-3.3" width="58" height="1.5" rx="0.7" fill="' + HI + '" opacity=".6"/>' +        // reflet
      '<circle cx="37.5" cy="0" r="1.8" fill="' + DK + '"/>' +                                           // âme
    '</g>';
  }

  // --- Dispatcher emblème (derrière le crâne) ----------------------------
  function crossedX(unit) { // 2 unités en X centré (50,50), comme os/sabres
    return '<g transform="translate(50 50) rotate(-45)">' + unit + '</g>' +
           '<g transform="translate(50 50) scale(-1 1) rotate(-45)">' + unit + '</g>';
  }
  function anchor() {
    const M = '#9aa0a8', MS = '#5f656e';
    return '<g>' +
      '<circle cx="50" cy="9" r="3.6" fill="none" stroke="' + M + '" stroke-width="2.4"/>' +        // anneau
      '<rect x="48.6" y="11" width="2.8" height="72" fill="' + M + '" stroke="' + MS + '" stroke-width="0.4"/>' + // jas vertical
      '<rect x="40" y="16" width="20" height="2.6" rx="1.3" fill="' + M + '" stroke="' + MS + '" stroke-width="0.4"/>' + // traverse
      '<path d="M50,83 C42,83 35,80 31,73 L27,76 C29,84 38,89 50,87 C62,89 71,84 73,76 L69,73 ' +
        'C65,80 58,83 50,83 Z" fill="' + M + '" stroke="' + MS + '" stroke-width="0.5"/>' +           // pattes
    '</g>';
  }
  function emblem(kind, sk) {
    switch (kind) {
      case 1: return crossedX(cutlass());
      case 2: return crossedX(spear());
      case 3: return anchor();
      case 4: return crossedX(trident());
      case 5: return crossedX(cannon());
      default: // 0 — Os croisés
        return '<g transform="rotate(45 50 50)">' + bone(sk) + '</g>' +
               '<g transform="rotate(-45 50 50)">' + bone(sk) + '</g>';
    }
  }

  /* ---- Couvre-chefs (8) — cf. JOLLY_ROGER.md §4 ------------------------- */
  const CLOTH = '#272a31', CLOTH_HI = '#3a3e47';
  function hat(idx) {
    switch (idx) {
      case 0: // Aucun
        return '';
      case 1: // Bandana — noué sur le côté gauche, 2 pans qui tombent
        return '<path d="M19,41 Q8,47 7,61 Q13,58 17,50 Q19,46 22,44 Z" fill="#1b1e24"/>' +        // pan arrière
               '<path d="M22,43 Q15,51 17,62 Q22,57 25,49 Z" fill="' + CLOTH_HI + '"/>' +          // pan avant
               '<path d="M22,42 C22,25 35,17 50,17 C65,17 78,25 78,42 ' +
               'C66,35 58,33 50,33 C42,33 34,35 22,42 Z" fill="' + CLOTH + '" stroke="#0f1117" stroke-width="0.5"/>' +
               '<path d="M30,33 Q50,29 70,33" fill="none" stroke="#9aa1ad" stroke-width="0.9" opacity=".3"/>' +  // pli
               '<path d="M21,42 Q14,38 10,42 Q14,44 14,49 Q19,46 23,47 Q22,44 21,42 Z" ' +
               'fill="' + CLOTH + '" stroke="#0f1117" stroke-width="0.5"/>' +                       // gros nœud
               '<circle cx="16" cy="44" r="1.3" fill="#0f1117" opacity=".45"/>';                   // cinch
      case 2: // Tricorne (3 pointes) + plume + liseré doré marqué
        return '<path d="M15,32 Q14,15 26,14 L34,24 Q42,12 50,10 Q58,12 66,24 ' +
               'L74,14 Q86,15 85,32 Q50,26 15,32 Z" fill="#20242e" stroke="#0f1117" stroke-width="0.6"/>' +
               '<path d="M15,31 Q50,24 85,31" fill="none" stroke="#d8b24e" stroke-width="2" opacity=".9"/>' +
               '<path d="M73,16 Q81,2 88,1 Q86,8 81,12 Q78,16 75,20 Z" fill="#ece6d6" stroke="#b9b09a" stroke-width="0.4"/>' +
               '<path d="M30,21 l3.5,7 l4,-6 z" fill="#b23b3b"/>';            // cocarde
      case 3: // Bicorne (2 cornes, creux central) + plume centrale + liseré doré
        return '<path d="M14,30 Q5,11 16,10 Q35,22 50,24 Q65,22 84,10 ' +
               'Q95,11 86,30 Q50,25 14,30 Z" fill="#1b1f29" stroke="#0d0f16" stroke-width="0.6"/>' +
               '<path d="M16,29 Q50,23 84,29" fill="none" stroke="#d8b24e" stroke-width="1.8" opacity=".85"/>' +
               '<path d="M47,24 Q42,6 50,1 Q58,6 53,24 Z" fill="#ece6d6" stroke="#b9b09a" stroke-width="0.4"/>' +
               '<path d="M19,16 l3.5,7 l4,-6 z" fill="#b23b3b"/>';            // cocarde corne gauche
      case 4: // Haut-de-forme — bord courbé posé sur le crâne, cylindre galbé, ruban + reflet
        return '<path d="M16,30 Q50,23 84,30 Q50,37 16,30 Z" fill="#191920" stroke="#000" stroke-width="0.4"/>' +     // bord
               '<path d="M34,29 C32.4,18 32.4,9 34,4.5 Q50,2 66,4.5 C67.6,9 67.6,18 66,29 Q50,32 34,29 Z" ' +
               'fill="#23232b" stroke="#000" stroke-width="0.4"/>' +                                                  // cylindre galbé
               '<ellipse cx="50" cy="4.7" rx="16" ry="3" fill="#2c2c36"/>' +                                          // dessus
               '<path d="M41,6 Q40,17 41,27" fill="none" stroke="#41414e" stroke-width="3" stroke-linecap="round" opacity=".55"/>' + // reflet
               '<path d="M34,24.5 Q50,28.5 66,24.5 L66,20 Q50,24 34,20 Z" fill="#7a1f25"/>';                          // ruban
      case 5: // Couronne
        return '<path d="M26,23 L31,8 L38,18 L50,5 L62,18 L69,8 L74,23 Z" fill="#e3c04f" stroke="#a87f25" stroke-width="0.8"/>' +
               '<rect x="26" y="22" width="48" height="7" rx="2" fill="#e3c04f" stroke="#a87f25" stroke-width="0.8"/>' +
               '<circle cx="36" cy="25.5" r="1.8" fill="#c0392b"/>' +
               '<circle cx="50" cy="25.5" r="1.8" fill="#2e7fd6"/>' +
               '<circle cx="64" cy="25.5" r="1.8" fill="#2e9e6b"/>';
      case 6: // Casque à cornes (viking/berserker) : calotte métal + bandeau + 2 cornes
        return '<path d="M22,31 C22,8 38,2 50,2 C62,2 78,8 78,31 Q50,37 22,31 Z" ' +
               'fill="#8a9099" stroke="#555b64" stroke-width="0.6"/>' +
               '<path d="M31,10 C39,6 46,6 50,7" fill="none" stroke="#c2c7cd" stroke-width="1.3" opacity=".55"/>' +   // reflet métal
               '<path d="M24,31 C14,30 8,23 11,13 C14,17 20,21 25,25 C28,27 27,29 24,31 Z" ' +
               'fill="#ece0c2" stroke="#b39b6a" stroke-width="0.5"/>' +                                              // corne gauche
               '<path d="M76,31 C86,30 92,23 89,13 C86,17 80,21 75,25 C72,27 73,29 76,31 Z" ' +
               'fill="#ece0c2" stroke="#b39b6a" stroke-width="0.5"/>' +                                              // corne droite
               '<path d="M19,28 Q50,35 81,28 L81,32 Q50,39 19,32 Z" fill="#6c727b" stroke="#454b53" stroke-width="0.5"/>' + // bandeau
               '<circle cx="29" cy="31" r="1.3" fill="#c2c7cd"/>' +
               '<circle cx="50" cy="33.5" r="1.3" fill="#c2c7cd"/>' +
               '<circle cx="71" cy="31" r="1.3" fill="#c2c7cd"/>';                                                   // rivets
      case 7: // Chapeau de paille — dôme arrondi (épaules courbées, sommet en arc)
        return '<ellipse cx="50" cy="27" rx="34" ry="8" fill="' + STRAW + '" stroke="' + STRAW_SHADE + '" stroke-width="0.8"/>' +
               '<path d="M30,27 C30,13 39,6 50,6 C61,6 70,13 70,27 Z" fill="' + STRAW + '" stroke="' + STRAW_SHADE + '" stroke-width="0.8"/>' +
               '<path d="M31,24 Q50,30 69,24 L69,20.5 Q50,26.5 31,20.5 Z" fill="#b1302a"/>';
      default:
        return '';
    }
  }

  /* ---- Bordure (anneau / corde / chaîne) -------------------------------- */
  function borderRing(pal, kind) {
    if (kind === 1) { // Corde : anneau + dashes obliques = torsade
      return '<circle cx="50" cy="50" r="47" fill="none" stroke="' + pal.border + '" stroke-width="4.5"/>' +
             '<circle cx="50" cy="50" r="47" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="4.5" ' +
             'stroke-dasharray="3.2 3.2"/>' +
             '<circle cx="50" cy="50" r="47" fill="none" stroke="' + pal.border + '" stroke-width="1" opacity=".5"/>';
    }
    if (kind === 2) { // Chaîne : maillons (dash épais creusé par le fond)
      return '<circle cx="50" cy="50" r="47" fill="none" stroke="' + pal.border + '" stroke-width="6" ' +
             'stroke-dasharray="6.5 4.5" stroke-linecap="round"/>' +
             '<circle cx="50" cy="50" r="47" fill="none" stroke="' + pal.bg + '" stroke-width="2.4" ' +
             'stroke-dasharray="6.5 4.5" stroke-linecap="round"/>';
    }
    if (kind === 3) { // Rivets / clous
      return '<circle cx="50" cy="50" r="47" fill="none" stroke="' + pal.border + '" stroke-width="2.4"/>' +
             '<circle cx="50" cy="50" r="47" fill="none" stroke="' + pal.border + '" stroke-width="5.2" stroke-dasharray="0.6 8.2" stroke-linecap="round"/>' +
             '<circle cx="50" cy="50" r="47" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="1.8" stroke-dasharray="0.6 8.2" stroke-linecap="round"/>';
    }
    if (kind === 4) { // Pointillés fins
      return '<circle cx="50" cy="50" r="47" fill="none" stroke="' + pal.border + '" stroke-width="2.4" ' +
             'stroke-dasharray="1.4 2.4" stroke-linecap="round"/>';
    }
    if (kind === 5) { // Double anneau
      return '<circle cx="50" cy="50" r="48" fill="none" stroke="' + pal.border + '" stroke-width="1.6"/>' +
             '<circle cx="50" cy="50" r="44" fill="none" stroke="' + pal.border + '" stroke-width="1.6"/>';
    }
    // Anneau simple (défaut)
    return '<circle cx="50" cy="50" r="47" fill="none" stroke="' + pal.border + '" stroke-width="3"/>' +
           '<circle cx="50" cy="50" r="43" fill="none" stroke="' + pal.border + '" stroke-width="1" opacity=".35"/>';
  }
  function starPath(cx, cy, r, col) { // étoile à 5 branches
    let p = '';
    for (let k = 0; k < 10; k++) {
      const rr = (k % 2) ? r * 0.45 : r, a = -Math.PI / 2 + k * Math.PI / 5;
      p += (k ? 'L' : 'M') + (cx + rr * Math.cos(a)).toFixed(2) + ',' + (cy + rr * Math.sin(a)).toFixed(2);
    }
    return '<path d="' + p + ' Z" fill="' + col + '"/>';
  }

  /* ---- Accessoire œil (cache-œil / cicatrice ; la dent d'or est gérée par mouth) */
  function eyeAccessory(f, kind) {
    if (kind === 1) { // Cache-œil sur l'œil droit + sangle
      return '<path d="M28,34 L76,53" fill="none" stroke="#17171b" stroke-width="2.2"/>' +
             '<ellipse cx="' + f.eyeRX + '" cy="' + f.eyeY + '" rx="' + (f.eyeRx + 2.2) + '" ry="' + (f.eyeRy + 1.6) + '" ' +
             'fill="#1a1a1e" stroke="#000" stroke-width="0.5"/>' +
             '<path d="M' + (f.eyeRX - 6) + ',' + (f.eyeY - 2) + ' q6,2 12,0" fill="none" stroke="#2c2c33" stroke-width="0.7" opacity=".7"/>';
    }
    if (kind === 2) { // Cicatrice barrée sur l'œil gauche
      const x = f.eyeLX;
      return '<line x1="' + (x + 1) + '" y1="32" x2="' + (x - 1) + '" y2="59" stroke="#9b6a55" stroke-width="1.3" stroke-linecap="round"/>' +
             '<line x1="' + (x - 3) + '" y1="38" x2="' + (x + 3) + '" y2="37" stroke="#9b6a55" stroke-width="1" stroke-linecap="round"/>' +
             '<line x1="' + (x - 3) + '" y1="46" x2="' + (x + 3) + '" y2="45" stroke="#9b6a55" stroke-width="1" stroke-linecap="round"/>' +
             '<line x1="' + (x - 3) + '" y1="53" x2="' + (x + 3) + '" y2="52" stroke="#9b6a55" stroke-width="1" stroke-linecap="round"/>';
    }
    return '';
  }

  /* ---- Babiole — générique + emblématiques Mugiwara --------------------- */
  // Motifs centrés à l'origine, posés en bas-gauche du crâne et AGRANDIS (charme
  // qui pend à la mâchoire). Cigarette = coin bouche, bois = tempe (cas à part).
  function trinket(f, kind) {
    const charm = function (motif) {
      return '<g transform="translate(' + (f.earX - 2) + ' ' + (f.earY + 3) + ') scale(1.55)">' + motif + '</g>';
    };
    const my = f.mouthY;
    switch (kind) {
      case 1: // Boucle d'oreille
        return charm('<circle cx="0" cy="-2.4" r="0.8" fill="#e3c04f"/>' +
               '<circle cx="0" cy="0.4" r="2.6" fill="none" stroke="#e3c04f" stroke-width="1.2"/>');
      case 2: // Cigarette (Sanji) — plus grosse, coin droit de la bouche
        return '<rect x="60" y="' + (my - 2.2) + '" width="17" height="4.6" rx="1.5" fill="#efe9dc" stroke="#b9b3a4" stroke-width="0.5"/>' +
               '<rect x="75.6" y="' + (my - 2.2) + '" width="2.6" height="4.6" fill="#e8883a"/>' +
               '<path d="M79,' + (my - 1.8) + ' q4.5,-5.5 0,-11 q-4.5,-4.5 0,-9.5" fill="none" stroke="#b8bcc2" stroke-width="1.1" opacity=".5"/>';
      case 3: // Triple boucle (Zoro)
        return charm('<circle cx="0" cy="-3" r="1.7" fill="none" stroke="#e3c04f" stroke-width="1"/>' +
               '<circle cx="0" cy="0" r="1.7" fill="none" stroke="#e3c04f" stroke-width="1"/>' +
               '<circle cx="0" cy="3" r="1.7" fill="none" stroke="#e3c04f" stroke-width="1"/>');
      case 4: // Mandarine (Nami) — CENTRALE, sous le crâne
        return '<g transform="translate(50 87)">' +
               '<circle cx="0" cy="0" r="5.7" fill="#f0902c" stroke="#c06d1c" stroke-width="0.7"/>' +
               '<circle cx="0" cy="0" r="5.7" fill="none" stroke="#d87d22" stroke-width="0.5" opacity=".6"/>' +
               '<path d="M0,-4.7 q4.4,-2.8 7.2,0.3 q-4.4,2.3 -7.2,-0.3 Z" fill="#3a9d4f"/>' +
               '<line x1="0" y1="-4.7" x2="0" y2="-6.2" stroke="#6e4a2b" stroke-width="1"/></g>';
      case 5: // Bois (Chopper) — 2 bois, un de chaque côté (façon renne)
        return antler(f, -1) + antler(f, 1);
      case 6: // Fleur (Robin) — éparpillées sur le pavillon (hana hana)
        return flowerAt(22, 30) + flowerAt(78, 33) + flowerAt(33, 75) + flowerAt(69, 71);
      case 7: // Note de musique (Brook) — halo clair pour ressortir sur fond sombre
        return charm(
          '<g fill="#efe9dc">' +
            '<ellipse cx="-1.4" cy="4.4" rx="3" ry="2.5" transform="rotate(-20 -1.4 4.4)"/>' +
            '<rect x="-0.1" y="-4.5" width="2.2" height="9.8"/>' +
            '<path d="M1.6,-4 q5,1.3 2.2,5.8" fill="none" stroke="#efe9dc" stroke-width="2.8"/></g>' +
          '<g fill="#15151a">' +
            '<ellipse cx="-1.4" cy="4.4" rx="2.3" ry="1.8" transform="rotate(-20 -1.4 4.4)"/>' +
            '<rect x="0.4" y="-4" width="1.2" height="8.8"/>' +
            '<path d="M1.6,-4 q4.5,1.2 2,5.4" fill="none" stroke="#15151a" stroke-width="1.5"/></g>');
      default:
        return '';
    }
  }
  // Bois de cervidé (Chopper) : pointe vers le HAUT et l'EXTÉRIEUR.
  // s=-1 côté gauche (merrain m2 vers la gauche), s=+1 côté droit.
  function antler(f, s) {
    const bx = (s < 0 ? f.eyeLX - 11 : f.eyeRX + 11), by = f.topY + 4, sx = (s < 0 ? -1.35 : 1.35);
    return '<g transform="translate(' + bx + ' ' + by + ') scale(' + sx + ' 1.35)">' +
      '<path d="M0,6 C2,2 3,-2.5 2.2,-7.5" fill="none" stroke="#caa46a" stroke-width="1.5" stroke-linecap="round"/>' +     // merrain (haut-ext)
      '<path d="M1.4,-0.6 l3.2,-1.6 M2.1,-4 l3,-0.6 M0.7,3 l2.8,-1.2" fill="none" stroke="#caa46a" stroke-width="1.3" stroke-linecap="round"/></g>';
  }
  function flowerAt(x, y) {
    return '<g transform="translate(' + x + ' ' + y + ') scale(0.9)">' +
      petals('#c77dd6', 5, 2.4) + '<circle cx="0" cy="0" r="1.2" fill="#f3d65a"/></g>';
  }
  function petals(col, n, r) {
    let out = '';
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + i * 2 * Math.PI / n;
      out += '<circle cx="' + (r * Math.cos(a)).toFixed(2) + '" cy="' + (r * Math.sin(a)).toFixed(2) + '" r="1.6" fill="' + col + '"/>';
    }
    return out;
  }

  /* ---- Assemblage -------------------------------------------------------- */
  let _uid = 0;
  function buildJollyRoger(fp) {
    const d  = decode(fp);
    const pal = PALETTES[d.pal];
    const sk  = SKULLS[d.skull];
    const f   = FACE[d.shape];
    const uid = 'jrm' + (_uid++);

    const defs =
      '<defs>' +
        '<radialGradient id="' + uid + '-bg" cx="50%" cy="42%" r="65%">' +
          '<stop offset="0" stop-color="' + pal.bgHi + '"/>' +
          '<stop offset="1" stop-color="' + pal.bg + '"/>' +
        '</radialGradient>' +
        '<radialGradient id="' + uid + '-sk" cx="42%" cy="30%" r="78%">' +
          '<stop offset="0" stop-color="' + sk.hi + '"/>' +
          '<stop offset="0.55" stop-color="' + sk.fill + '"/>' +
          '<stop offset="1" stop-color="' + sk.shade + '"/>' +
        '</radialGradient>' +
      '</defs>';

    const svg =
      '<svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Jolly Roger">' +
        defs +
        '<circle cx="50" cy="50" r="49" fill="url(#' + uid + '-bg)"/>' +
        borderRing(pal, d.border) +
        emblem(d.emblem, sk) +
        // Crâne + visage + coiffe : réduits (~15 %) et remontés pour se poser au
        // sommet de l'emblème (le crâne dominait trop et masquait les armes).
        '<g transform="translate(0 -6) translate(50 49) scale(0.78) translate(-50 -49)">' +
          skullMass(f, sk, uid) +
          (d.fissure ? fissure(f, sk) : '') +
          eyes(f) + nose(f) +
          mouth(f, sk, uid, d.eyeAcc === 3) +   // dent d'or
          eyeAccessory(f, d.eyeAcc) +           // cache-œil / cicatrice
          trinket(f, d.trinket) +
          hat(d.hat) +
        '</g>' +
      '</svg>';

    const variant = {
      palette: pal.name, skull: sk.name, hat: HATS[d.hat],
      emblem: EMBLEMS[d.emblem], shape: SHAPES[d.shape], fissure: !!d.fissure,
      eyeAcc: EYE_ACC[d.eyeAcc], border: BORDERS[d.border], trinket: TRINKETS[d.trinket],
      idx: d
    };
    return { svg: svg, variant: variant };
  }

  function getJollyRogerVariantName(fp) {
    const v = buildJollyRoger((fp == null ? computeDeviceFingerprint() : fp) >>> 0).variant;
    return v.palette + ' · ' + v.hat + ' · ' + v.emblem;
  }

  function renderJollyRoger(targetEl, fp) {
    if (!targetEl) return null;
    const out = buildJollyRoger((fp == null ? computeDeviceFingerprint() : fp) >>> 0);
    targetEl.innerHTML = out.svg;
    return out.variant;
  }

  /* ---- Export global ----------------------------------------------------- */
  global.JollyRoger = {
    buildJollyRoger: buildJollyRoger,
    computeDeviceFingerprint: computeDeviceFingerprint,
    renderJollyRoger: renderJollyRoger,
    getJollyRogerVariantName: getJollyRogerVariantName,
    META: META
  };
  // Aussi exposé à plat (l'API attendue par le site les veut en global)
  global.buildJollyRoger = buildJollyRoger;
  global.computeDeviceFingerprint = computeDeviceFingerprint;
  global.renderJollyRoger = renderJollyRoger;
  global.getJollyRogerVariantName = getJollyRogerVariantName;

})(typeof window !== 'undefined' ? window : this);
