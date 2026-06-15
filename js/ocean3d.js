/* ============================================================
   LOGPOSE — Ocean 3D (prototype refonte)
   Landing : voyage en mer scrollé (la caméra suit la houle).
   Jeu     : on EST sur l'île — vues à hauteur d'homme depuis
             la plage, palmiers, lagon turquoise, volcan.
             La caméra marche vers un point de vue par mode.
   Jour/nuit : suit data-theme (light = jour, dark = nuit).
   Chargé après three.min.js (UMD → window.THREE).
   Purement visuel : aucune dépendance au gameplay.
   ============================================================ */
(function () {
  'use strict';

  /* Bisection de debug : ?skip=island,foliage,palms,shore,far,drift,foam */
  var SKIP = (function () {
    try { return (new URLSearchParams(window.location.search).get('skip') || '').split(','); }
    catch (e) { return []; }
  })();
  function skipped(name) { return SKIP.indexOf(name) >= 0; }
  var T0 = performance.now();
  function olog(msg) { console.log('[ocean +' + Math.round(performance.now() - T0) + 'ms] ' + msg); }

  /* Fond 3D — défaut par page :
       • Landing : toujours actif (c'est sa vitrine).
       • Jeu     : OPT-IN, classique statique par défaut (jugé plus confortable).
         Le toggle des paramètres écrit 'op-ocean3d' ('1' = 3D, sinon classique).
     La classe body.ocean3d-active (posée ci-dessous) déclenche le re-skin verre
     dans ocean3d.css ; sans elle, game.html garde son fond classique d'avant. */
  var OCEAN_CTL = { built: false, pause: null, resume: null };
  function pageMode() {
    return (document.body && document.body.dataset) ? document.body.dataset.ocean : '';
  }
  function ocean3dEnabled() {
    if (pageMode() === 'game') {
      try { return localStorage.getItem('op-ocean3d') === '1'; } catch (e) { return false; }
    }
    return true;   /* landing (et tout autre cas) : 3D par défaut */
  }
  function syncOceanClass() {
    if (document.body) document.body.classList.toggle('ocean3d-active', ocean3dEnabled());
  }

  /* ---------- Palettes nuit / jour (lerpées côté JS) ---------- */
  var PAL_NIGHT = {
    deep:    [0.008, 0.043, 0.094],   /* #020b18  eau profonde   */
    surface: [0.051, 0.227, 0.416],   /* #0d3a6a  eau de surface */
    foam:    [0.784, 0.894, 0.973],   /* #c8e4f8  crêtes/écume   */
    sun:     [0.941, 0.847, 0.502],   /* #f0d880  or lunaire     */
    spec:    [0.957, 0.816, 0.565],   /* #f4d090  reflets        */
    zenith:  [0.008, 0.031, 0.063],   /* #020810  ciel zénith    */
    horizon: [0.039, 0.118, 0.220],   /* #0a1e38  ciel horizon   */
    fog:     [0.008, 0.051, 0.118],   /* #020d1e  brume          */
    fogD:    0.012
  };
  var PAL_DAY = {
    deep:    [0.043, 0.275, 0.443],   /* #0b4671  bleu profond   */
    surface: [0.110, 0.545, 0.737],   /* #1c8bbc  bleu lagon     */
    foam:    [0.937, 0.973, 1.000],   /* #eff8ff  écume blanche  */
    sun:     [1.000, 0.957, 0.820],   /* #fff4d1  soleil         */
    spec:    [1.000, 0.929, 0.760],   /* #ffedc2  glitter        */
    zenith:  [0.157, 0.443, 0.733],   /* #2871bb  bleu franc     */
    horizon: [0.788, 0.890, 0.965],   /* #c9e3f6  horizon pâle   */
    fog:     [0.741, 0.851, 0.937],   /* #bdd9ef  brume de jour  */
    fogD:    0.0085
  };

  /* Astres : lune basse à droite (nuit) · soleil plus haut (jour) */
  var DIR_MOON = normalize3(0.22, 0.13, -0.95);
  var DIR_SUN  = normalize3(0.30, 0.46, -0.84);

  /* ---------- Trains de vagues Gerstner (partagés shader <-> JS) ---- */
  var WAVE_DEFS = [
    { dx:  0.75, dz:  0.60, amp: 0.500, len: 60.0 },
    { dx: -0.55, dz:  0.84, amp: 0.270, len: 31.0 },
    { dx:  0.93, dz: -0.37, amp: 0.160, len: 17.0 },
    { dx: -0.30, dz: -0.95, amp: 0.085, len:  8.5 },
    { dx:  0.62, dz: -0.78, amp: 0.045, len:  4.6 }
  ];

  /* ---------- Réglages par page ---------- */
  var CONFIGS = {
    landing: {
      segments: 128, waterSize: 300, waveScale: 1.0, particles: 800,
      fov: 55, mouseAmp: { x: 0.6, y: 0.2 },
      ship: { w: 8.4, h: 5.6, lift: 0.95, mouseAmp: 0.8 },
      field: { w: 190, zNear: 22, zFar: -150 }
    },
    game: {
      segments: 110, waterSize: 320, waveScale: 0.42, particles: 180,
      fov: 58, mouseAmp: { x: 0.22, y: 0.07 },
      ship: { w: 6.2, h: 4.2, lift: 0.7, mouseAmp: 0 },
      field: { w: 170, zNear: 16, zFar: -120 },
      island: true
    }
  };

  /* ---------- Voyage scrollé (landing) ---------- */
  var LAND_CAM_PATH = [
    { p: 0.00, pos: [ 0.0, 4.5,  12], look: [ 0.0, 1.5, -14] },
    { p: 0.45, pos: [ 3.0, 2.7,  -5], look: [ 1.5, 1.0, -34] },
    { p: 1.00, pos: [-1.2, 1.8, -23], look: [ 3.5, 1.4, -62] }
  ];
  var LAND_SHIP_PATH = [
    { p: 0.00, x: 9.5, z: -30 },
    { p: 0.45, x: 6.0, z: -44 },
    { p: 1.00, x: 8.5, z: -61 }
  ];

  /* ---------- L'île (jeu) ----------
     Coordonnées LOCALES île (0,0 = centre), converties en monde
     via (cx, cz). Côte irrégulière (rayon modulé par bruit).     */
  var ISLAND = {
    cx: 0, cz: -34, R: 34,
    volcano: { x: -10, z: -12, r: 12.0, h: 17.5, craterR: 3.0, craterD: 9.0 },
    hill:    { x: 14,  z: -2, r: 10.0, h: 5.0 },   /* colline est : profil en selle  */
    head:    { x: 28,  z: 20, r: 7.0,  h: 5.2 },   /* promontoire rocheux du phare   */
    ship:    { x: -26, z: 34 },          /* Merry mouillée au large ouest  */
    dockShip:{ x: 23.5, z: 36.5 },       /* Merry à quai (bout du ponton)  */
    flag:    { x: 10,  z: 26 },          /* pavillon planté plage sud      */
    fire:    { x: -11, z: 25 },          /* feu de camp devant la scène    */
    props: {                             /* décors par mode (coords locales) */
      dock:   { x: 18,  z: 28 },         /* classic : ponton de bois        */
      wanted: { x: 22,  z: 10 },         /* wanted : avis de recherche      */
      light:  { x: 28,  z: 20 },         /* flag/silhouette : le phare      */
      fruit:  { x: -10, z: 17.6 },       /* fruit : l'arbre au fruit spiral */
      totem:  { x: 0,   z: 32 },         /* emoji : totem sculpté           */
      stage:  { x: -15, z: 26.5 },       /* audio : scène de concert        */
      kiosk:  { x: 12,  z: 18 }          /* tome : kiosque de livres        */
    }
  };

  function normalize3(x, y, z) {
    var l = Math.sqrt(x * x + y * y + z * z) || 1;
    return { x: x / l, y: y / l, z: z / l };
  }
  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
  function smoothstep01(t) { return t * t * (3 - 2 * t); }

  /* RNG déterministe (placement de la végétation stable) */
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Bruit de valeur 2D — IDENTIQUE au GLSL (le rivage du shader eau
     doit coïncider avec le relief du terrain). */
  function hash2(x, z) {
    var h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
    return h - Math.floor(h);
  }
  function vnoise2(x, z) {
    var ix = Math.floor(x), iz = Math.floor(z);
    var fx = x - ix, fz = z - iz;
    var ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
    var a = hash2(ix, iz), b = hash2(ix + 1, iz);
    var c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
    return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
  }
  function fbm2(x, z) {
    var v = 0, a = 0.5;
    for (var i = 0; i < 3; i++) { v += a * vnoise2(x, z); x = x * 2.13 + 7.7; z = z * 2.13 + 7.7; a *= 0.5; }
    return v;
  }

  /* ---------- Relief de l'île (local) ---------- */
  function coastRadius(x, z) {
    var a = fbm2(x * 0.045 + 9.1, z * 0.045 + 2.3) - 0.5;
    var b = fbm2(x * 0.110 - 4.2, z * 0.110 + 7.9) - 0.5;
    return ISLAND.R * (1 + a * 0.40 + b * 0.14);
  }
  function terrainH(x, z) {
    var I = ISLAND, V = I.volcano, H = I.hill, P = I.head;
    var r = Math.sqrt(x * x + z * z);
    var Rw = coastRadius(x, z);
    var t = clamp01(1 - r / Rw);
    var h = Math.pow(t, 1.40) * 7.4;
    h += (fbm2(x * 0.10 + 3.7, z * 0.10 - 1.3) - 0.5) * 3.4 * Math.min(1, Math.max(h - 0.4, 0) * 0.9);
    /* micro-relief : casse les pentes lisses (au-dessus de la plage) */
    h += (fbm2(x * 0.34 + 8.2, z * 0.34 + 4.4) - 0.5) * 0.9 * clamp01((h - 0.6) * 0.8);
    /* colline est : l'île a deux épaules, pas juste le volcan */
    var dh = Math.sqrt((x - H.x) * (x - H.x) + (z - H.z) * (z - H.z));
    h += Math.pow(clamp01(1 - dh / H.r), 1.6) * H.h;
    var dv = Math.sqrt((x - V.x) * (x - V.x) + (z - V.z) * (z - V.z));
    var tv = clamp01(1 - dv / V.r);
    h += Math.pow(tv, 1.5) * V.h;
    /* lèvre de cratère déchiquetée */
    var rim = Math.exp(-Math.pow((dv - V.craterR * 1.1) / 1.0, 2));
    h += rim * (0.45 + (fbm2(x * 0.9 + 2.0, z * 0.9 - 6.0) - 0.5) * 1.5) * clamp01(tv * 2.2 - 0.8);
    var tc = clamp01(1 - dv / V.craterR);
    h -= Math.pow(tc, 1.7) * V.craterD;
    if (r > Rw) h = Math.max(h - (r - Rw) * 0.55, -5.0);
    /* promontoire du phare : éperon rocheux qui s'avance sur la mer */
    var dp = Math.sqrt((x - P.x) * (x - P.x) + (z - P.z) * (z - P.z));
    var tp = clamp01(1 - dp / P.r);
    if (tp > 0) {
      h = Math.max(h, Math.pow(tp, 1.3) * P.h - 0.35 + (fbm2(x * 0.5 + 1.0, z * 0.5) - 0.5) * 0.6 * tp);
    }
    return h;
  }

  /* Texture de profondeur côtière : terrainH échantillonné une fois
     au démarrage (384², ~150 ms) — le shader eau lit au lieu de
     recalculer le bruit fractal à chaque pixel. */
  function buildCoastTexture(T, islandOn) {
    var N = 384, AREA = 220, HSCALE = 6.0;
    var data = new Uint8Array(N * N);
    if (islandOn) {
      for (var j = 0; j < N; j++) {
        for (var i = 0; i < N; i++) {
          var lx = (i / (N - 1) - 0.5) * AREA;
          var lz = (j / (N - 1) - 0.5) * AREA;
          var h = Math.max(-HSCALE, Math.min(HSCALE, terrainH(lx, lz)));
          data[j * N + i] = Math.round((h / HSCALE * 0.5 + 0.5) * 255);
        }
      }
    }
    var tex = new T.DataTexture(data, N, N, T.RedFormat, T.UnsignedByteType);
    tex.magFilter = T.LinearFilter;
    tex.minFilter = T.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }

  /* Points de vue par mode — À HAUTEUR D'HOMME sur la plage.
     V(camLx, camLz, hauteurOeil, cibleLx, cibleLz, hauteurCible) */
  function eyeView(lx, lz, eh, tx, tz, th) {
    var I = ISLAND;
    return {
      pos:  [lx + I.cx, Math.max(terrainH(lx, lz), 0) + eh, lz + I.cz],
      look: [tx + I.cx, Math.max(terrainH(tx, tz), 0) + th, tz + I.cz]
    };
  }
  function buildGameViews() {
    return {
      classic: eyeView(  6.5, 33.0, 1.8,  19.5, 30.5, 1.4),   /* le ponton, la Merry à quai      */
      wanted:  eyeView( 16.0, 16.0, 1.8,  22.3, 10.0, 1.8),   /* l'avis de recherche, cap est    */
      flag:    eyeView( 23.0, 41.0, 2.2,  28.0, 20.0, 5.8),   /* le phare depuis le lagon        */
      fruit:   eyeView( -6.6, 25.0, 1.7, -10.3, 17.6, 2.9),   /* l'arbre au fruit, lisière       */
      emoji:   eyeView(  1.3, 38.6, 2.0,   0.0, 31.4, 2.1),   /* le totem depuis le lagon        */
      audio:   eyeView( -8.0, 31.0, 1.8, -15.0, 26.4, 1.7),   /* la scène, le feu devant         */
      tome:    eyeView( 16.5, 23.5, 1.9,  11.6, 17.4, 1.6),   /* le kiosque, volcan en fond      */
      inf:     { pos: [0, 9.5, 20], look: [0, 2.6, -34] }     /* au large, l'île entière         */
    };
  }

  /* ---------- Clairières ----------
     La végétation aléatoire évite les props, le feu, le pavillon,
     les positions caméra et les lignes de vue caméra -> sujet. */
  var CLEARINGS = null;
  function distToSeg2(px, pz, ax, az, bx, bz) {
    var dx = bx - ax, dz = bz - az;
    var L2 = dx * dx + dz * dz || 1;
    var t = clamp01(((px - ax) * dx + (pz - az) * dz) / L2);
    var qx = ax + dx * t, qz = az + dz * t;
    return Math.sqrt((px - qx) * (px - qx) + (pz - qz) * (pz - qz));
  }
  function buildClearings() {
    var I = ISLAND, P = I.props;
    var pts = [
      [P.dock.x, P.dock.z, 5.0], [P.wanted.x, P.wanted.z, 4.0], [P.light.x, P.light.z, 5.5],
      [P.fruit.x, P.fruit.z + 3.4, 4.0], [P.totem.x, P.totem.z, 4.0],
      [P.stage.x, P.stage.z, 5.5], [P.kiosk.x, P.kiosk.z, 4.5],
      [I.flag.x, I.flag.z, 2.5], [I.fire.x, I.fire.z, 3.0]
    ];
    var segs = [];
    var views = buildGameViews();
    for (var k in views) {
      if (k === 'inf') continue;
      var v = views[k];
      var ax = v.pos[0] - I.cx, az = v.pos[2] - I.cz;
      var bx = v.look[0] - I.cx, bz = v.look[2] - I.cz;
      pts.push([ax, az, 3.2]);
      segs.push([ax, az, bx, bz]);
    }
    return { pts: pts, segs: segs };
  }
  function isCleared(x, z, margin) {
    if (!CLEARINGS) CLEARINGS = buildClearings();
    var m = margin || 0, i;
    for (i = 0; i < CLEARINGS.pts.length; i++) {
      var p = CLEARINGS.pts[i];
      var dx = x - p[0], dz = z - p[1];
      if (dx * dx + dz * dz < (p[2] + m) * (p[2] + m)) return true;
    }
    for (i = 0; i < CLEARINGS.segs.length; i++) {
      var s = CLEARINGS.segs[i];
      if (distToSeg2(x, z, s[0], s[1], s[2], s[3]) < 2.0 + m) return true;
    }
    return false;
  }

  /* ============================================================
     SHADERS
     ============================================================ */

  var WATER_VERT = [
    'uniform float uTime;',
    'uniform vec4  uWaves[5];',     // dir.x, dir.y, amplitude, longueur d'onde
    'uniform vec2  uMouse;',        // position curseur projetée sur l'eau (xz monde)
    'uniform float uMouseForce;',   // 0..1 — activité souris
    'uniform float uSteep;',
    '',
    'varying vec3  vWorldPos;',
    'varying vec3  vNormal;',
    'varying float vCrest;',
    '',
    'const float PI = 3.14159265359;',
    'const float G  = 9.81;',
    '',
    'vec3 gerstner(vec2 p) {',
    '  vec3 off = vec3(0.0);',
    '  for (int i = 0; i < 5; i++) {',
    '    vec2  dir = uWaves[i].xy;',
    '    float amp = uWaves[i].z;',
    '    float wl  = uWaves[i].w;',
    '    float k   = 2.0 * PI / wl;',
    '    float c   = sqrt(G / k);',
    '    if (i >= 3) {',
    '      float dm = length(p - uMouse);',
    '      amp *= 1.0 + 1.1 * uMouseForce * exp(-dm * dm * 0.02);',
    '    }',
    '    float f = k * (dot(dir, p) - c * uTime);',
    '    float q = uSteep / (k * amp * 5.0);',
    '    off.x += q * amp * dir.x * cos(f);',
    '    off.z += q * amp * dir.y * cos(f);',
    '    off.y += amp * sin(f);',
    '  }',
    '  float dm = length(p - uMouse);',
    '  off.y += 0.05 * uMouseForce * sin(dm * 2.4 - uTime * 5.0) * exp(-dm * 0.38);',
    '  return off;',
    '}',
    '',
    'void main() {',
    '  vec2 p = position.xz;',
    '  vec3 off = gerstner(p);',
    '  vec3 disp = vec3(p.x, 0.0, p.y) + off;',
    '',
    '  float e = 0.55;',
    '  vec3 px = vec3(p.x + e, 0.0, p.y) + gerstner(p + vec2(e, 0.0)) - disp;',
    '  vec3 pz = vec3(p.x, 0.0, p.y + e) + gerstner(p + vec2(0.0, e)) - disp;',
    '  vNormal = normalize(cross(pz, px));',
    '',
    '  vCrest = off.y;',
    '  vec4 wp = modelMatrix * vec4(disp, 1.0);',
    '  vWorldPos = wp.xyz;',
    '  gl_Position = projectionMatrix * viewMatrix * wp;',
    '}'
  ].join('\n');

  var WATER_FRAG = [
    'uniform float uTime;',
    'uniform float uDay;',
    'uniform vec3  uMoonDir;',
    'uniform vec3  uDeep, uSurface, uFoam, uMoonCol, uHorizon, uFogColor;',
    'uniform float uFogDensity;',
    'uniform float uMaxAmp;',
    'uniform float uIslandOn;',     // 1 = île présente (jeu)
    'uniform sampler2D uCoastTex;', // profondeur du terrain précalculée (JS)
    'uniform vec4  uCoastArea;',    // cx, cz, 1/taille, échelle hauteur
    '',
    'varying vec3  vWorldPos;',
    'varying vec3  vNormal;',
    'varying float vCrest;',
    '',
    'float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }',
    'float vnoise(vec2 p) {',
    '  vec2 i = floor(p), f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash21(i),                 hash21(i + vec2(1.0, 0.0)), u.x),',
    '             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);',
    '}',
    'float fbm(vec2 p) {',
    '  float v = 0.0, a = 0.5;',
    '  for (int i = 0; i < 3; i++) { v += a * vnoise(p); p = p * 2.13 + 7.7; a *= 0.5; }',
    '  return v;',
    '}',
    '',
    '/* Relief côtier : une simple lecture de la texture précalculée */',
    'float coastH(vec2 wp) {',
    '  vec2 uv = (wp - uCoastArea.xy) * uCoastArea.z + 0.5;',
    '  return (texture2D(uCoastTex, uv).r * 2.0 - 1.0) * uCoastArea.w;',
    '}',
    '',
    'void main() {',
    '  vec3 N = normalize(vNormal);',
    '  vec3 V = normalize(cameraPosition - vWorldPos);',
    '',
    '  vec2 np = vWorldPos.xz * 0.55 + vec2(uTime * 0.07, -uTime * 0.05);',
    '  float n1 = fbm(np);',
    '  float n2 = fbm(np.yx * 1.7 - uTime * 0.06);',
    '  N = normalize(N + vec3(n1 - 0.5, 0.0, n2 - 0.5) * 0.22);',
    '',
    '  float hN   = clamp(vCrest / uMaxAmp * 0.5 + 0.5, 0.0, 1.0);',
    '  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);',
    '',
    '  vec3 col = mix(uDeep, uSurface, hN * 0.45 + 0.06);',
    '  col = mix(col, uHorizon, fres * 0.45);',
    '',
    '  /* Lagon : eau turquoise translucide sur les hauts-fonds,',
    '     sable visible sous la surface, écume qui lèche la plage */',
    '  if (uIslandOn > 0.5) {',
    '    float th = coastH(vWorldPos.xz);',
    '    float shallow = smoothstep(-3.2, -0.08, th);',
    '    vec3 turq = mix(vec3(0.08, 0.30, 0.33), vec3(0.42, 0.78, 0.72), uDay);',
    '    col = mix(col, turq, shallow * 0.78);',
    '    float sandSee = smoothstep(-0.6, -0.04, th);',
    '    col = mix(col, vec3(0.74, 0.70, 0.57) * mix(0.30, 1.0, uDay), sandSee * 0.55);',
    '    float lap = vnoise(vWorldPos.xz * 1.25 + vec2(uTime * 0.45, 0.0));',
    '    float shoreFoam = smoothstep(0.34, 0.05, abs(th + 0.05 - vCrest * 0.3));',
    '    col = mix(col, uFoam, shoreFoam * (0.45 + 0.45 * lap) * shallow);',
    '  }',
    '',
    '  vec3  L   = uMoonDir;',
    '  vec3  H   = normalize(V + L);',
    '  float ndh = max(dot(N, H), 0.0);',
    '  float specSharp = pow(ndh, 240.0) * 2.2;',
    '  float specSoft  = pow(ndh, 28.0)  * 0.07;',
    '',
    '  vec2  az    = normalize(uMoonDir.xz);',
    '  vec2  rel   = vWorldPos.xz - cameraPosition.xz;',
    '  float along = dot(rel, az);',
    '  float side  = dot(rel, vec2(-az.y, az.x));',
    '  float strip = exp(-side * side / (6.0 + max(along, 0.0) * 0.16));',
    '  strip *= smoothstep(0.0, 40.0, along);',
    '  float shimmer = vnoise(vec2(side * 1.7, along * 0.23 - uTime * 0.9));',
    '  shimmer = smoothstep(0.55, 0.95, shimmer);',
    '',
    '  float foamN = fbm(vWorldPos.xz * 0.9 + vec2(0.0, uTime * 0.15));',
    '  float crest = smoothstep(0.80, 1.06, hN + (foamN - 0.5) * 0.22);',
    '  col = mix(col, uFoam, crest * 0.40);',
    '',
    '  float dist = distance(cameraPosition, vWorldPos);',
    '  float fogF = clamp(1.0 - exp(-uFogDensity * uFogDensity * dist * dist), 0.0, 1.0);',
    '  col = mix(col, uFogColor, fogF);',
    '  col += uMoonCol * (specSharp + specSoft + strip * shimmer * 0.20) * mix(1.0, 0.35, fogF);',
    '',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  var SKY_VERT = [
    'varying vec3 vDir;',
    'void main() {',
    '  vDir = position;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}'
  ].join('\n');

  var SKY_FRAG = [
    'uniform float uTime;',
    'uniform float uDay;',
    'uniform vec3  uMoonDir;',
    'uniform vec3  uZenith, uHorizonC, uMoonCol, uFogColor;',
    '',
    'varying vec3 vDir;',
    '',
    'float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }',
    'float vnoise(vec2 p) {',
    '  vec2 i = floor(p), f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash21(i),                 hash21(i + vec2(1.0, 0.0)), u.x),',
    '             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);',
    '}',
    'float fbm(vec2 p) {',
    '  float v = 0.0, a = 0.5;',
    '  for (int i = 0; i < 3; i++) { v += a * vnoise(p); p = p * 2.13 + 7.7; a *= 0.5; }',
    '  return v;',
    '}',
    '',
    'void main() {',
    '  vec3 d = normalize(vDir);',
    '  float h = d.y;',
    '',
    '  vec3 col = mix(uHorizonC, uZenith, pow(clamp(h, 0.0, 1.0), 0.55));',
    '  col = mix(col, uFogColor, smoothstep(0.0, -0.12, h));',
    '  col += uHorizonC * exp(-abs(h) * 9.0) * 0.5;',
    '',
    '  /* Étoiles procédurales (nuit seulement) */',
    '  if (h > 0.015 && uDay < 0.98) {',
    '    vec2 sp = vec2(atan(d.x, d.z), asin(clamp(h, -1.0, 1.0)));',
    '    for (int i = 0; i < 2; i++) {',
    '      float scale  = (i == 0) ? 90.0 : 42.0;',
    '      float thresh = (i == 0) ? 0.91 : 0.972;',
    '      float size   = (i == 0) ? 0.11 : 0.17;',
    '      float gain   = (i == 0) ? 0.85 : 1.5;',
    '      vec2 cell = floor(sp * scale);',
    '      vec2 fr   = fract(sp * scale);',
    '      float rnd = hash21(cell + float(i) * 17.31);',
    '      vec2 starPos = vec2(fract(rnd * 73.1), fract(rnd * 119.3)) * 0.7 + 0.15;',
    '      float b  = smoothstep(size, 0.0, length(fr - starPos));',
    '      float on = step(thresh, rnd);',
    '      float tw = 0.55 + 0.45 * sin(uTime * (0.8 + rnd * 2.4) + rnd * 50.0);',
    '      vec3 starCol = mix(vec3(0.75, 0.85, 1.0), vec3(0.96, 0.86, 0.55), step(0.72, fract(rnd * 7.0)));',
    '      col += starCol * b * on * tw * gain * smoothstep(0.02, 0.18, h) * (1.0 - uDay);',
    '    }',
    '  }',
    '',
    '  /* Nuages cumulus (jour) : bande fbm près de l\'horizon */',
    '  if (uDay > 0.02 && h > 0.01) {',
    '    vec2 cp = vec2(d.x, d.z) / (h + 0.22);',
    '    float cl = fbm(cp * 1.45 + vec2(uTime * 0.006, 0.0));',
    '    float band = smoothstep(0.02, 0.18, h) * smoothstep(0.85, 0.30, h);',
    '    cl = smoothstep(0.52, 0.80, cl) * band * uDay;',
    '    col = mix(col, vec3(0.78, 0.84, 0.91), cl * 0.30);',
    '    col = mix(col, vec3(1.00, 0.99, 0.97), cl * 0.75);',
    '  }',
    '',
    '  /* Astre : lune avec mers la nuit, disque solaire net le jour */',
    '  float ang  = acos(clamp(dot(d, uMoonDir), -1.0, 1.0));',
    '  float discO = mix(0.046, 0.040, uDay);',
    '  float discI = mix(0.038, 0.031, uDay);',
    '  float disc = smoothstep(discO, discI, ang);',
    '  float maria = vnoise(d.xy * 64.0 + 13.0) * 0.5 + vnoise(d.xy * 21.0) * 0.5;',
    '  vec3 moonSurf = uMoonCol * (1.45 - maria * 0.4 * (1.0 - uDay) + uDay * 0.8);',
    '  col = mix(col, moonSurf, disc);',
    '  col += uMoonCol * 0.50 * exp(-ang * 26.0);',
    '  col += uMoonCol * 0.18 * exp(-ang * 9.0);',
    '  col += uMoonCol * 0.07 * exp(-ang * 3.4);',
    '  col += uMoonCol * uDay * 0.22 * exp(-ang * 2.2);',
    '',
    '  vec2 azd = normalize(d.xz + vec2(0.0001));',
    '  vec2 azm = normalize(uMoonDir.xz);',
    '  float azAlign = max(dot(azd, azm), 0.0);',
    '  col += uMoonCol * pow(azAlign, 24.0) * exp(-abs(h) * 16.0) * 0.30;',
    '',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  var FOAM_VERT = [
    'attribute vec4 aRand;',
    'uniform float uTime;',
    'uniform vec4  uWaves[5];',
    'uniform float uField;',
    'uniform float uPixelRatio;',
    '',
    'varying float vAlpha;',
    '',
    'const float PI = 3.14159265359;',
    'const float G  = 9.81;',
    '',
    'void main() {',
    '  vec3 p = position;',
    '  float drift = uTime * (0.25 + aRand.w * 0.55);',
    '  p.x = mod(p.x + drift + uField * 0.5, uField) - uField * 0.5;',
    '',
    '  float y = 0.0;',
    '  for (int i = 0; i < 3; i++) {',
    '    float k = 2.0 * PI / uWaves[i].w;',
    '    float c = sqrt(G / k);',
    '    y += uWaves[i].z * sin(k * (dot(uWaves[i].xy, p.xz) - c * uTime));',
    '  }',
    '  p.y = y + 0.12 + 0.18 * sin(uTime * (0.6 + aRand.y * 1.5) + aRand.x * 40.0);',
    '',
    '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
    '  float dist = max(-mv.z, 1.0);',
    '  gl_PointSize = aRand.z * uPixelRatio * (130.0 / dist);',
    '  vAlpha = smoothstep(140.0, 60.0, dist) * smoothstep(4.0, 14.0, dist) * (0.30 + 0.35 * aRand.y);',
    '  gl_Position = projectionMatrix * mv;',
    '}'
  ].join('\n');

  var FOAM_FRAG = [
    'varying float vAlpha;',
    'void main() {',
    '  float a = smoothstep(0.5, 0.08, length(gl_PointCoord - 0.5));',
    '  gl_FragColor = vec4(0.784, 0.894, 0.973, a * vAlpha);',
    '}'
  ].join('\n');

  var SMOKE_VERT = [
    'attribute float aSeed;',
    'uniform float uTime;',
    'uniform float uPixelRatio;',
    'varying float vA;',
    '',
    'void main() {',
    '  float fr = fract(uTime * (0.030 + aSeed * 0.018) + aSeed * 7.31);',
    '  vec3 p = position;',
    '  float ang = aSeed * 6.2831 + fr * (1.5 + aSeed);',
    '  float spread = 0.5 + fr * fr * 3.8;',
    '  p.x += cos(ang) * spread;',
    '  p.z += sin(ang) * spread;',
    '  p.y += fr * 13.0;',
    '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
    '  float dist = max(-mv.z, 1.0);',
    '  gl_PointSize = (24.0 + fr * 110.0) * uPixelRatio * (38.0 / dist);',
    '  vA = sin(fr * 3.14159) * 0.13;',
    '  gl_Position = projectionMatrix * mv;',
    '}'
  ].join('\n');

  var SMOKE_FRAG = [
    'uniform float uDay;',
    'varying float vA;',
    'void main() {',
    '  float a = smoothstep(0.5, 0.12, length(gl_PointCoord - 0.5));',
    '  vec3 col = mix(vec3(0.62, 0.63, 0.70), vec3(0.46, 0.46, 0.50), uDay);',
    '  gl_FragColor = vec4(col, a * vA);',
    '}'
  ].join('\n');

  var EMBER_VERT = [
    'attribute float aSeed;',
    'uniform float uTime;',
    'uniform float uPixelRatio;',
    'varying float vA;',
    '',
    'void main() {',
    '  float fr = fract(uTime * (0.25 + aSeed * 0.35) + aSeed * 11.7);',
    '  vec3 p = position;',
    '  p.x += sin(uTime * 2.0 + aSeed * 40.0) * 0.12 * fr;',
    '  p.z += cos(uTime * 1.7 + aSeed * 31.0) * 0.12 * fr;',
    '  p.y += fr * 1.5;',
    '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
    '  float dist = max(-mv.z, 1.0);',
    '  gl_PointSize = (1.5 + aSeed * 2.0) * uPixelRatio * (26.0 / dist);',
    '  vA = (1.0 - fr) * 0.9;',
    '  gl_Position = projectionMatrix * mv;',
    '}'
  ].join('\n');

  var EMBER_FRAG = [
    'varying float vA;',
    'void main() {',
    '  float a = smoothstep(0.5, 0.1, length(gl_PointCoord - 0.5));',
    '  gl_FragColor = vec4(1.0, 0.52, 0.18, a * vA);',
    '}'
  ].join('\n');

  var FLAG_VERT = [
    'uniform float uTime;',
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = uv;',
    '  vec3 p = position;',
    '  float w = uv.x;',
    '  p.z += sin(uv.x * 7.0 - uTime * 5.0) * 0.07 * w;',
    '  p.y += sin(uv.x * 5.0 - uTime * 4.2) * 0.035 * w;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);',
    '}'
  ].join('\n');

  var FLAG_FRAG = [
    'uniform sampler2D uMap;',
    'uniform float uDay;',
    'varying vec2 vUv;',
    'void main() {',
    '  vec4 tex = texture2D(uMap, vUv);',
    '  float shade = mix(0.55, 1.0, uDay);',
    '  shade *= 0.85 + 0.15 * sin(vUv.x * 7.0);',
    '  gl_FragColor = vec4(tex.rgb * shade, tex.a);',
    '}'
  ].join('\n');

  var FLAME_VERT = [
    'uniform float uTime;',
    'uniform float uSeed;',
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = uv;',
    '  vec3 p = position;',
    '  p.x += sin(uTime * 7.0 + uSeed * 17.0 + uv.y * 3.0) * 0.06 * uv.y;',
    '  p.z += cos(uTime * 5.3 + uSeed * 9.0 + uv.y * 2.0) * 0.04 * uv.y;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);',
    '}'
  ].join('\n');

  var FLAME_FRAG = [
    'uniform float uTime;',
    'uniform float uSeed;',
    'uniform float uDay;',
    'varying vec2 vUv;',
    'float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }',
    'float vnoise(vec2 p) {',
    '  vec2 i = floor(p), f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),',
    '             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);',
    '}',
    'void main() {',
    '  vec2 uv = vUv;',
    '  float n = vnoise(vec2(uv.x * 5.0 + uSeed, uv.y * 7.0 - uTime * 3.2));',
    '  /* gabarit : large en bas, pointe en haut, bord rongé par le bruit */',
    '  float cx = abs(uv.x - 0.5) * (1.3 + uv.y * 2.2);',
    '  float body = smoothstep(0.5, 0.18, cx + n * 0.22) * smoothstep(1.05, 0.78, uv.y + n * 0.18);',
    '  body *= smoothstep(0.0, 0.06, uv.y);',
    '  vec3 col = mix(vec3(1.0, 0.85, 0.35), vec3(1.0, 0.42, 0.10), clamp(uv.y * 1.5 + n * 0.3 - 0.2, 0.0, 1.0));',
    '  col = mix(col, vec3(0.95, 0.20, 0.05), smoothstep(0.55, 1.0, uv.y));',
    '  gl_FragColor = vec4(col, body * (0.85 - uDay * 0.25));',
    '}'
  ].join('\n');

  /* ============================================================
     TILT DES CARTES (souris -> rotation 3D + reflet)
     ============================================================ */
  function initCardTilt() {
    document.querySelectorAll('[data-tilt]').forEach(function (card) {
      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        card.style.setProperty('--rx', (-y * 12) + 'deg');
        card.style.setProperty('--ry', (x * 12) + 'deg');
        card.style.setProperty('--sx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--sy', (e.clientY - r.top) + 'px');
      });
      card.addEventListener('mouseleave', function () {
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
      });
    });
  }

  /* ============================================================
     TEXTURES PROCÉDURALES DE VÉGÉTATION (canvas 2D)
     ============================================================ */

  /* Masse feuillue : feuillage dense, haut éclairci, bas ombré.
     deep = essence de jungle plus sombre. */
  function makeLeafTexture(T, deep) {
    var cv = document.createElement('canvas');
    cv.width = 256; cv.height = 256;
    var g = cv.getContext('2d');
    var rng = mulberry32(deep ? 5521 : 7741);
    var GREENS = deep
      ? ['#15331a', '#1d4022', '#27502a', '#1a3a1e', '#234a26', '#2e5c30']
      : ['#2e5d24', '#3a7030', '#48823a', '#578f42', '#65a04b', '#3f7a33'];
    var HILITES = deep ? ['#3a6b38', '#447a40'] : ['#76b055', '#86c062'];
    for (var i = 0; i < 240; i++) {
      var cx = 28 + rng() * 200, cy = 24 + rng() * 200;
      var d = Math.sqrt((cx - 128) * (cx - 128) + (cy - 120) * (cy - 120));
      if (d > 108) continue;
      var rad = 7 + rng() * 15;
      var shade = clamp01(1 - cy / 256);
      g.save();
      g.translate(cx, cy);
      g.rotate(rng() * Math.PI);
      g.scale(1, 0.6 + rng() * 0.45);
      g.globalAlpha = 0.8 + rng() * 0.2;
      var pool = (rng() < 0.16 + shade * 0.28) ? HILITES : GREENS;
      g.fillStyle = pool[Math.floor(rng() * pool.length)];
      g.beginPath();
      g.arc(0, 0, rad, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    var tex = new T.CanvasTexture(cv);
    tex.colorSpace = T.SRGBColorSpace;
    return tex;
  }

  /* Palme : folioles pleines et denses (triangles effilés) qui
     retombent le long d'une nervure courbée. */
  function makeFrondTexture(T) {
    var cv = document.createElement('canvas');
    cv.width = 256; cv.height = 128;
    var g = cv.getContext('2d');
    var rng = mulberry32(3313);
    var GREENS = ['#2c6128', '#357231', '#3f823a', '#4a9044', '#356a2e'];
    function ribX(t) { return 8 + t * 240; }
    function ribY(t) { return 44 + t * t * 30; }
    for (var i = 0; i < 34; i++) {
      var t = i / 33;
      var x = ribX(t), y = ribY(t);
      var len = 40 * (1 - t * 0.5) + 8;
      var w = 5.0 * (1 - t * 0.35) + 1.5;
      for (var s = -1; s <= 1; s += 2) {
        var ang = s * (1.18 - t * 0.40) + 0.42 + (rng() - 0.5) * 0.16;
        g.save();
        g.translate(x, y);
        g.rotate(ang);
        g.fillStyle = GREENS[Math.floor(rng() * GREENS.length)];
        g.globalAlpha = 0.92;
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(len * 0.96, -w);
        g.lineTo(len, 0);
        g.lineTo(len * 0.96, w * 0.6);
        g.closePath();
        g.fill();
        g.restore();
      }
    }
    g.strokeStyle = '#4a6a2c';
    g.lineWidth = 3.4;
    g.beginPath();
    g.moveTo(ribX(0), ribY(0));
    g.quadraticCurveTo(ribX(0.5), ribY(0.5) - 6, ribX(1), ribY(1));
    g.stroke();
    var tex = new T.CanvasTexture(cv);
    tex.colorSpace = T.SRGBColorSpace;
    return tex;
  }

  /* Touffe d'herbe : brins effilés sur alpha */
  function makeGrassTexture(T) {
    var cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    var g = cv.getContext('2d');
    var rng = mulberry32(9913);
    var COLS = ['#4a7a30', '#5a8a38', '#6a9a40', '#7aa64a', '#558034'];
    for (var i = 0; i < 26; i++) {
      var bx = 26 + rng() * 76;
      var lean = (rng() - 0.5) * 50;
      var hgt = 52 + rng() * 56;
      var w = 2.5 + rng() * 3.2;
      g.fillStyle = COLS[Math.floor(rng() * COLS.length)];
      g.beginPath();
      g.moveTo(bx - w, 126);
      g.quadraticCurveTo(bx - w * 0.4 + lean * 0.4, 126 - hgt * 0.6, bx + lean, 126 - hgt);
      g.quadraticCurveTo(bx + w * 0.4 + lean * 0.4, 126 - hgt * 0.6, bx + w, 126);
      g.closePath();
      g.fill();
    }
    var tex = new T.CanvasTexture(cv);
    tex.colorSpace = T.SRGBColorSpace;
    return tex;
  }

  /* Toile rayée (auvents de la scène et du kiosque) */
  function makeStripesTexture(T, colA, colB) {
    var cv = document.createElement('canvas');
    cv.width = 128; cv.height = 64;
    var g = cv.getContext('2d');
    for (var i = 0; i < 8; i++) {
      g.fillStyle = (i % 2 === 0) ? colA : colB;
      g.fillRect(i * 16, 0, 16, 64);
    }
    var tex = new T.CanvasTexture(cv);
    tex.colorSpace = T.SRGBColorSpace;
    return tex;
  }

  /* ============================================================
     DÉCORS PAR MODE — un élément distinctif par point de vue
     (tout procédural : primitives + textures canvas)
     ============================================================ */
  function buildModeProps(T, group, rng, planeGeo, leafMatB, rockGeos, uDay) {
    var I = ISLAND;
    var refs = { flameMats: [] };
    /* petite flamme réutilisable (torches) — chaque matériau a son uSeed */
    var torchFlameGeo = new T.PlaneGeometry(0.34, 0.52, 1, 4);
    torchFlameGeo.translate(0, 0.26, 0);
    function makeFlame(seed, x, y, z, parent) {
      var fm = new T.ShaderMaterial({
        vertexShader: FLAME_VERT, fragmentShader: FLAME_FRAG,
        uniforms: { uTime: { value: 0 }, uSeed: { value: seed }, uDay: uDay },
        transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide
      });
      for (var fp = 0; fp < 2; fp++) {
        var fpl = new T.Mesh(torchFlameGeo, fm);
        fpl.position.set(x, y, z);
        fpl.rotation.y = fp * Math.PI / 2;
        fpl.renderOrder = 3;
        parent.add(fpl);
      }
      refs.flameMats.push(fm);
    }
    var m4 = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3(), pv = new T.Vector3();
    var zAxis = new T.Vector3(0, 0, 1);
    var woodMat = new T.MeshStandardMaterial({ color: 0x7a5a38, roughness: 0.95 });
    var woodDarkMat = new T.MeshStandardMaterial({ color: 0x53402c, roughness: 1 });
    var woodLightMat = new T.MeshStandardMaterial({ color: 0x96754c, roughness: 0.9 });
    var stripesRed = makeStripesTexture(T, '#c23a2a', '#f0e6d0');
    var stripesTeal = makeStripesTexture(T, '#2a8a8a', '#f0ead8');

    /* ---- Classic : ponton de bois, pilotis dans l'eau ---- */
    (function buildDock() {
      var g2 = new T.Group();
      var ax = 15.5, az = 25.5, bx = 22.2, bz = 34.8;
      var dirX = bx - ax, dirZ = bz - az;
      var L = Math.sqrt(dirX * dirX + dirZ * dirZ);
      dirX /= L; dirZ /= L;
      var nx = -dirZ, nz = dirX;
      var deckY = 0.62, W = 0.85;
      var rotY = Math.atan2(dirX, dirZ);
      var pileGeo = new T.CylinderGeometry(0.085, 0.10, 1, 7);
      for (var i2 = 0; i2 <= 7; i2++) {
        var t2 = i2 / 7;
        var cx2 = ax + dirX * L * t2, cz2 = az + dirZ * L * t2;
        for (var s2 = -1; s2 <= 1; s2 += 2) {
          var px2 = cx2 + nx * W * s2 * 0.92, pz2 = cz2 + nz * W * s2 * 0.92;
          var bot = Math.min(terrainH(px2, pz2), 0.1) - 0.5;
          var topY = deckY + 0.16 + hash2(i2, s2) * 0.10;
          var pile = new T.Mesh(pileGeo, woodDarkMat);
          pile.scale.y = topY - bot;
          pile.position.set(px2, (topY + bot) / 2, pz2);
          g2.add(pile);
        }
      }
      var plankGeo = new T.BoxGeometry(W * 2, 0.065, 0.46);
      var plankN = Math.floor(L / 0.52);
      for (var p2 = 0; p2 < plankN; p2++) {
        var tt = (p2 + 0.5) / plankN;
        var plank = new T.Mesh(plankGeo, (p2 % 3 === 1) ? woodLightMat : woodMat);
        plank.position.set(ax + dirX * L * tt, deckY + (hash2(p2, 7.7) - 0.5) * 0.012, az + dirZ * L * tt);
        plank.rotation.y = rotY + (hash2(p2, 1.1) - 0.5) * 0.05;
        g2.add(plank);
      }
      var bollGeo = new T.CylinderGeometry(0.09, 0.11, 0.5, 7);
      var boll1 = new T.Mesh(bollGeo, woodDarkMat);
      boll1.position.set(bx + nx * 0.7, deckY + 0.25, bz + nz * 0.7);
      g2.add(boll1);
      var boll2 = new T.Mesh(bollGeo, woodDarkMat);
      boll2.position.set(bx - nx * 0.7, deckY + 0.25, bz - nz * 0.7);
      g2.add(boll2);
      /* poteau-lanterne au bout du quai */
      var lx = bx - dirX * 0.5, lz = bz - dirZ * 0.5;
      var lpole = new T.Mesh(new T.CylinderGeometry(0.05, 0.06, 1.7, 6), woodDarkMat);
      lpole.position.set(lx, deckY + 0.85, lz);
      g2.add(lpole);
      var lampGlass = new T.Mesh(new T.BoxGeometry(0.20, 0.26, 0.20), new T.MeshBasicMaterial({ color: 0xffc97a }));
      lampGlass.position.set(lx, deckY + 1.74, lz);
      g2.add(lampGlass);
      var lampTop = new T.Mesh(new T.ConeGeometry(0.17, 0.14, 4), woodDarkMat);
      lampTop.position.set(lx, deckY + 1.93, lz);
      g2.add(lampTop);
      refs.dockLight = new T.PointLight(0xffb568, 1.1, 15, 2);
      refs.dockLight.position.set(lx, deckY + 1.5, lz);
      g2.add(refs.dockLight);
      /* tonneau près de la base + corde lovée */
      var barrel = new T.Mesh(new T.CylinderGeometry(0.22, 0.26, 0.55, 9), woodMat);
      barrel.position.set(ax + dirX * 1.6 + nx * 0.45, deckY + 0.30, az + dirZ * 1.6 + nz * 0.45);
      g2.add(barrel);
      var rope = new T.Mesh(new T.TorusGeometry(0.16, 0.05, 5, 10),
        new T.MeshStandardMaterial({ color: 0xc9b083, roughness: 1 }));
      rope.rotation.x = -Math.PI / 2;
      rope.position.set(bx - nx * 0.5, deckY + 0.06, bz - nz * 0.5);
      g2.add(rope);
      group.add(g2);
    })();

    /* ---- Wanted : avis de recherche encadré d'or, portrait flouté ---- */
    (function buildWanted() {
      var P = I.props.wanted;
      var g2 = new T.Group();
      g2.position.set(P.x, terrainH(P.x, P.z), P.z);
      g2.rotation.y = Math.atan2(16.0 - P.x, 16.0 - P.z);
      var postGeo = new T.CylinderGeometry(0.06, 0.075, 2.3, 6);
      var post = new T.Mesh(postGeo, woodDarkMat);
      post.position.set(-0.75, 1.15, 0);
      g2.add(post);
      var post2 = new T.Mesh(postGeo, woodDarkMat);
      post2.position.set(0.75, 1.15, 0);
      g2.add(post2);
      var beam = new T.Mesh(new T.BoxGeometry(1.9, 0.12, 0.10), woodMat);
      beam.position.set(0, 2.18, 0);
      g2.add(beam);
      var board = new T.Mesh(new T.BoxGeometry(1.55, 1.05, 0.07), woodMat);
      board.position.set(0, 1.45, 0.05);
      g2.add(board);
      var frameMat = new T.MeshStandardMaterial({ color: 0xc9a035, roughness: 0.5, metalness: 0.6 });
      [[0, 0.56, 1.62, 0.07], [0, -0.56, 1.62, 0.07], [-0.78, 0, 0.07, 1.18], [0.78, 0, 0.07, 1.18]].forEach(function (f3) {
        var bar = new T.Mesh(new T.BoxGeometry(f3[2], f3[3], 0.05), frameMat);
        bar.position.set(f3[0], 1.45 + f3[1], 0.10);
        g2.add(bar);
      });
      var wcv = document.createElement('canvas');
      wcv.width = 256; wcv.height = 192;
      var wg = wcv.getContext('2d');
      wg.fillStyle = '#d9c595'; wg.fillRect(0, 0, 256, 192);
      wg.fillStyle = '#bfa878';
      for (var sp = 0; sp < 60; sp++) { wg.fillRect((sp * 53) % 256, (sp * 91) % 192, 2, 2); }
      wg.strokeStyle = '#5a4a30'; wg.lineWidth = 5; wg.strokeRect(7, 7, 242, 178);
      wg.fillStyle = '#2a2018';
      wg.font = 'bold 38px Georgia, serif'; wg.textAlign = 'center';
      wg.fillText('WANTED', 128, 44);
      /* portrait flouté : on ne sait pas qui c'est… c'est le jeu */
      wg.save();
      try { wg.filter = 'blur(4px)'; } catch (e2) {}
      wg.fillStyle = '#6a5a44';
      wg.beginPath(); wg.arc(128, 92, 26, 0, Math.PI * 2); wg.fill();
      wg.fillRect(102, 112, 52, 22);
      wg.restore();
      wg.font = 'bold 17px Georgia, serif';
      wg.fillText('DEAD OR ALIVE', 128, 152);
      wg.font = 'bold 19px Georgia, serif';
      wg.fillText('฿ ???.???.???', 128, 176);
      var wantedTex = new T.CanvasTexture(wcv);
      wantedTex.colorSpace = T.SRGBColorSpace;
      var poster = new T.Mesh(new T.PlaneGeometry(1.34, 0.92), new T.MeshLambertMaterial({ map: wantedTex }));
      poster.position.set(0, 1.45, 0.092);
      g2.add(poster);
      var poster2 = new T.Mesh(new T.PlaneGeometry(0.5, 0.36), new T.MeshLambertMaterial({ map: wantedTex }));
      poster2.position.set(0.42, 0.62, 0.03);
      poster2.rotation.z = -0.12;
      g2.add(poster2);
      /* lanterne pendue à la traverse : l'avis reste lisible de nuit */
      var wGlass = new T.Mesh(new T.BoxGeometry(0.16, 0.20, 0.16), new T.MeshBasicMaterial({ color: 0xffd9a0 }));
      wGlass.position.set(0, 1.96, 0.26);
      g2.add(wGlass);
      var wCap = new T.Mesh(new T.ConeGeometry(0.14, 0.12, 4), woodDarkMat);
      wCap.position.set(0, 2.10, 0.26);
      g2.add(wCap);
      refs.wantedLight = new T.PointLight(0xffc070, 0, 9, 2);
      refs.wantedLight.position.set(0, 1.92, 0.55);
      g2.add(refs.wantedLight);
      group.add(g2);
    })();

    /* ---- Flag/Silhouette : le phare, faisceau tournant ---- */
    (function buildLighthouse() {
      var P = I.props.light;
      var g2 = new T.Group();
      /* enfoncé dans le promontoire : la fondation épouse le rocher */
      g2.position.set(P.x, terrainH(P.x, P.z) - 0.55, P.z);
      var stoneMat2 = new T.MeshStandardMaterial({ color: 0x8a8378, roughness: 1 });
      var base = new T.Mesh(new T.CylinderGeometry(1.55, 2.35, 1.5, 12), stoneMat2);
      base.position.y = 0.75;
      g2.add(base);
      /* collier de rochers contre la fondation */
      for (var rc = 0; rc < 5; rc++) {
        var rca = rc * 1.26 + 0.4;
        var rcd = 2.0 + hash2(rc, 8.1) * 0.7;
        var rcs = 0.8 + hash2(rc, 2.7) * 0.7;
        var collarRock = new T.Mesh(rockGeos[rc % 3], stoneMat2);
        collarRock.scale.setScalar(rcs);
        collarRock.position.set(Math.cos(rca) * rcd, 0.25 - rcs * 0.35, Math.sin(rca) * rcd);
        collarRock.rotation.y = rca * 1.7;
        g2.add(collarRock);
      }
      var whiteMat = new T.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 0.8 });
      var redMat = new T.MeshStandardMaterial({ color: 0xb33327, roughness: 0.8 });
      var yCur = 1.5, rBot = 1.05, rTop = 0.55, totalH = 5.1, hAcc = 0;
      [{ h: 1.5, mat: redMat }, { h: 1.3, mat: whiteMat }, { h: 1.2, mat: redMat }, { h: 1.1, mat: whiteMat }]
        .forEach(function (sg) {
          var r1 = rBot + (rTop - rBot) * (hAcc / totalH);
          var r2 = rBot + (rTop - rBot) * ((hAcc + sg.h) / totalH);
          var cyl = new T.Mesh(new T.CylinderGeometry(r2, r1, sg.h, 14), sg.mat);
          cyl.position.y = yCur + sg.h / 2;
          g2.add(cyl);
          yCur += sg.h; hAcc += sg.h;
        });
      var gal = new T.Mesh(new T.CylinderGeometry(0.85, 0.85, 0.16, 14),
        new T.MeshStandardMaterial({ color: 0x3a3632, roughness: 0.9 }));
      gal.position.y = yCur + 0.08;
      g2.add(gal);
      var lantGlass = new T.Mesh(new T.CylinderGeometry(0.46, 0.46, 0.72, 10), new T.MeshBasicMaterial({ color: 0xfff0b8 }));
      lantGlass.position.y = yCur + 0.55;
      g2.add(lantGlass);
      var roof = new T.Mesh(new T.ConeGeometry(0.62, 0.62, 12), redMat);
      roof.position.y = yCur + 1.22;
      g2.add(roof);
      var finial = new T.Mesh(new T.SphereGeometry(0.09, 6, 5), new T.MeshStandardMaterial({ color: 0x3a3632 }));
      finial.position.y = yCur + 1.58;
      g2.add(finial);
      refs.beaconLight = new T.PointLight(0xfff0b0, 1.7, 42, 1.6);
      refs.beaconLight.position.y = yCur + 0.55;
      g2.add(refs.beaconLight);
      refs.beamPivot = new T.Group();
      refs.beamPivot.position.y = yCur + 0.55;
      refs.beamMat = new T.MeshBasicMaterial({
        color: 0xfff3c8, transparent: true, opacity: 0.11,
        blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide
      });
      var beamGeo = new T.ConeGeometry(1.9, 15, 14, 1, true);
      beamGeo.rotateZ(Math.PI / 2);
      beamGeo.translate(7.9, 0, 0);
      var beamMesh = new T.Mesh(beamGeo, refs.beamMat);
      beamMesh.renderOrder = 3;
      refs.beamPivot.add(beamMesh);
      g2.add(refs.beamPivot);
      /* projecteur au pied : baigne la tour et les rochers la nuit
         (placé côté lagon, là d'où regarde la caméra du mode) */
      refs.floodLight = new T.PointLight(0xffeecb, 0, 14, 2);
      refs.floodLight.position.set(-0.8, 1.7, 3.4);
      g2.add(refs.floodLight);
      group.add(g2);
    })();

    /* ---- Fruit : arbre noueux, fruit du démon luisant ---- */
    (function buildFruitTree() {
      var P = I.props.fruit;
      var g2 = new T.Group();
      g2.position.set(P.x, terrainH(P.x, P.z) - 0.05, P.z);
      var barkMat = new T.MeshStandardMaterial({ color: 0x4a3a2e, roughness: 1 });
      var trng = mulberry32(515);
      var tpts = [new T.Vector3(0, 0, 0)];
      for (var i2 = 1; i2 <= 4; i2++) {
        tpts.push(new T.Vector3(
          (trng() - 0.5) * 0.8 + (i2 > 2 ? 0.3 : 0),
          i2 * 0.78,
          (trng() - 0.5) * 0.8
        ));
      }
      var trunk = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(tpts), 10, 0.24, 7), barkMat);
      g2.add(trunk);
      var topP = tpts[4];
      for (var b2 = 0; b2 < 3; b2++) {
        var ba3 = b2 * 2.09 + 0.5;
        var bend = new T.Vector3(topP.x + Math.cos(ba3) * 1.1, topP.y + 0.55, topP.z + Math.sin(ba3) * 1.1);
        var mid = topP.clone().lerp(bend, 0.5).add(new T.Vector3(0, 0.25, 0));
        var branch = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([topP.clone(), mid, bend]), 6, 0.09, 5), barkMat);
        g2.add(branch);
      }
      for (var k2 = 0; k2 < 3; k2++) {
        var cano = new T.Mesh(planeGeo, leafMatB);
        cano.position.set(topP.x, topP.y + 0.45, topP.z);
        cano.rotation.y = k2 * Math.PI / 3 + 0.4;
        cano.scale.set(3.4, 3.0, 3.4);
        g2.add(cano);
      }
      /* le fruit, façon Gomu Gomu no Mi : sphère lavande couverte de
         spirales, tige dorée en T terminée par une volute */
      var fcv = document.createElement('canvas');
      fcv.width = 512; fcv.height = 256;
      var fg2 = fcv.getContext('2d');
      fg2.fillStyle = '#a393dd';
      fg2.fillRect(0, 0, 512, 256);
      fg2.strokeStyle = '#43306e';
      fg2.lineCap = 'round';
      function gomuSpiral(cx2, cy2, R0, rot) {
        fg2.lineWidth = 4;
        fg2.beginPath();
        for (var si = 0; si <= 36; si++) {
          var st = si / 36;
          var ang2 = rot + st * 2.2 * Math.PI * 2;
          var rr2 = 2.5 + st * R0;
          var px4 = cx2 + Math.cos(ang2) * rr2;
          var py4 = cy2 + Math.sin(ang2) * rr2 * 0.95;
          if (si === 0) fg2.moveTo(px4, py4); else fg2.lineTo(px4, py4);
        }
        fg2.stroke();
        /* petits cils sur le lobe */
        fg2.lineWidth = 2;
        for (var ey = 0; ey < 3; ey++) {
          var ea = rot + 1.1 + ey * 0.28;
          fg2.beginPath();
          fg2.moveTo(cx2 + Math.cos(ea) * (R0 + 2), cy2 + Math.sin(ea) * (R0 + 2));
          fg2.lineTo(cx2 + Math.cos(ea) * (R0 + 9), cy2 + Math.sin(ea) * (R0 + 9));
          fg2.stroke();
        }
      }
      for (var row = 0; row < 3; row++) {
        for (var col = 0; col < 6; col++) {
          var scx = 42 + col * 85 + (row % 2 ? 42 : 0) + (hash2(row, col) - 0.5) * 14;
          var scy = 42 + row * 86 + (hash2(col, row + 9) - 0.5) * 14;
          gomuSpiral(scx % 512, scy, 26 + hash2(row * 7, col * 3) * 8, hash2(col, row) * 6.28);
        }
      }
      var fruitTex = new T.CanvasTexture(fcv);
      fruitTex.colorSpace = T.SRGBColorSpace;
      refs.fruitMat = new T.MeshStandardMaterial({
        map: fruitTex, roughness: 0.5,
        emissive: new T.Color(0x9070e0), emissiveIntensity: 0.55, emissiveMap: fruitTex
      });
      var R3 = 0.34;
      var fpos = new T.Vector3(topP.x + 0.35, topP.y - 0.25, topP.z + 1.15);
      var fruit = new T.Mesh(new T.SphereGeometry(R3, 16, 12), refs.fruitMat);
      fruit.position.copy(fpos);
      g2.add(fruit);
      /* tige dorée : monte, coude à droite, et s'enroule en volute
         (un seul tube continu, la volute face à la caméra) */
      var goldMat = new T.MeshStandardMaterial({ color: 0xd9b945, roughness: 0.55, metalness: 0.15 });
      var sp2 = [
        new T.Vector3(fpos.x, fpos.y + R3 - 0.05, fpos.z),
        new T.Vector3(fpos.x + 0.01, fpos.y + R3 + 0.14, fpos.z),
        new T.Vector3(fpos.x + 0.12, fpos.y + R3 + 0.20, fpos.z),
        new T.Vector3(fpos.x + 0.26, fpos.y + R3 + 0.22, fpos.z)
      ];
      var volX = fpos.x + 0.40, volY = fpos.y + R3 + 0.20;
      for (var ci = 0; ci <= 20; ci++) {
        var ct = ci / 20;
        var ca = Math.PI * 0.5 + ct * Math.PI * 2.6;
        var cr = 0.085 * (1 - ct * 0.75);
        sp2.push(new T.Vector3(volX + Math.cos(ca) * cr, volY + Math.sin(ca) * cr, fpos.z));
      }
      var stem = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(sp2), 48, 0.021, 6), goldMat);
      g2.add(stem);
      /* moignon court de l'autre côté du T */
      var stub = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([
        new T.Vector3(fpos.x + 0.02, fpos.y + R3 + 0.15, fpos.z),
        new T.Vector3(fpos.x - 0.10, fpos.y + R3 + 0.19, fpos.z),
        new T.Vector3(fpos.x - 0.16, fpos.y + R3 + 0.17, fpos.z)
      ]), 8, 0.024, 6), goldMat);
      g2.add(stub);
      /* halo doux qui pulse */
      var hcv = document.createElement('canvas');
      hcv.width = 64; hcv.height = 64;
      var hg = hcv.getContext('2d');
      var grad = hg.createRadialGradient(32, 32, 2, 32, 32, 30);
      grad.addColorStop(0, 'rgba(190,110,255,0.55)');
      grad.addColorStop(1, 'rgba(190,110,255,0)');
      hg.fillStyle = grad; hg.fillRect(0, 0, 64, 64);
      refs.fruitHalo = new T.Sprite(new T.SpriteMaterial({
        map: new T.CanvasTexture(hcv), transparent: true,
        blending: T.AdditiveBlending, depthWrite: false
      }));
      refs.fruitHalo.position.copy(fpos);
      refs.fruitHalo.scale.setScalar(1.6);
      g2.add(refs.fruitHalo);
      /* le fruit éclaire vraiment son arbre la nuit (pulse en boucle) */
      refs.fruitLight = new T.PointLight(0xa45cff, 0, 9, 2);
      refs.fruitLight.position.set(fpos.x, fpos.y + 0.15, fpos.z + 0.35);
      g2.add(refs.fruitLight);
      group.add(g2);
    })();

    /* ---- Émoji : totem sculpté, chapeau de paille au sommet ---- */
    (function buildTotem() {
      var P = I.props.totem;
      var g2 = new T.Group();
      g2.position.set(P.x, Math.max(terrainH(P.x, P.z), 0.12), P.z);
      g2.rotation.y = Math.atan2(1.5 - P.x, 40.0 - P.z);
      function carvedTex(seed, accent, glyph) {
        var cv2 = document.createElement('canvas');
        cv2.width = 128; cv2.height = 128;
        var cg = cv2.getContext('2d');
        cg.fillStyle = '#8a6a42'; cg.fillRect(0, 0, 128, 128);
        var crng = mulberry32(seed);
        cg.strokeStyle = 'rgba(60,42,24,0.55)';
        cg.lineWidth = 2;
        for (var v2 = 0; v2 < 7; v2++) {
          var vy3 = 8 + v2 * 18 + crng() * 8;
          cg.beginPath();
          cg.moveTo(0, vy3);
          cg.quadraticCurveTo(64, vy3 + (crng() - 0.5) * 14, 128, vy3);
          cg.stroke();
        }
        cg.strokeStyle = '#3a2a18';
        cg.lineWidth = 5;
        cg.fillStyle = accent;
        if (glyph === 'skull') {
          cg.beginPath(); cg.arc(64, 56, 24, 0, Math.PI * 2); cg.stroke();
          cg.beginPath(); cg.arc(55, 50, 5, 0, Math.PI * 2); cg.fill();
          cg.beginPath(); cg.arc(73, 50, 5, 0, Math.PI * 2); cg.fill();
          cg.beginPath(); cg.moveTo(48, 86); cg.lineTo(80, 96); cg.moveTo(48, 96); cg.lineTo(80, 86); cg.stroke();
        } else if (glyph === 'sun') {
          cg.beginPath(); cg.arc(64, 64, 18, 0, Math.PI * 2); cg.stroke();
          for (var r3 = 0; r3 < 8; r3++) {
            var ra3 = r3 / 8 * Math.PI * 2;
            cg.beginPath();
            cg.moveTo(64 + Math.cos(ra3) * 24, 64 + Math.sin(ra3) * 24);
            cg.lineTo(64 + Math.cos(ra3) * 36, 64 + Math.sin(ra3) * 36);
            cg.stroke();
          }
          cg.beginPath(); cg.arc(64, 64, 9, 0, Math.PI * 2); cg.fill();
        } else {
          cg.beginPath();
          for (var t3 = 0; t3 <= 40; t3++) {
            var th3 = t3 / 40 * Math.PI * 3.4;
            var rr3 = 4 + th3 * 8;
            var px3 = 64 + Math.cos(th3) * rr3, py3 = 64 + Math.sin(th3) * rr3 * 0.8;
            if (t3 === 0) cg.moveTo(px3, py3); else cg.lineTo(px3, py3);
          }
          cg.stroke();
        }
        var tex2 = new T.CanvasTexture(cv2);
        tex2.colorSpace = T.SRGBColorSpace;
        return tex2;
      }
      var yAcc = 0;
      [
        { s: 0.92, h: 0.78, glyph: 'spiral', accent: '#2a6a7a', rot: 0.06 },
        { s: 0.78, h: 0.70, glyph: 'sun', accent: '#b3622a', rot: -0.09 },
        { s: 0.66, h: 0.62, glyph: 'skull', accent: '#8a2a2a', rot: 0.12 }
      ].forEach(function (bk, bi2) {
        var blk = new T.Mesh(new T.BoxGeometry(bk.s, bk.h, bk.s),
          new T.MeshStandardMaterial({ map: carvedTex(900 + bi2 * 31, bk.accent, bk.glyph), roughness: 0.95 }));
        blk.position.y = yAcc + bk.h / 2;
        blk.rotation.y = bk.rot;
        g2.add(blk);
        yAcc += bk.h;
      });
      /* chapeau de paille au sommet */
      var straw = new T.MeshStandardMaterial({ color: 0xe8c860, roughness: 1 });
      var brim = new T.Mesh(new T.CylinderGeometry(0.46, 0.50, 0.07, 12), straw);
      brim.position.y = yAcc + 0.035;
      g2.add(brim);
      var crown = new T.Mesh(new T.CylinderGeometry(0.24, 0.27, 0.20, 10), straw);
      crown.position.y = yAcc + 0.14;
      g2.add(crown);
      var band = new T.Mesh(new T.CylinderGeometry(0.265, 0.272, 0.07, 10),
        new T.MeshStandardMaterial({ color: 0xb32020, roughness: 0.9 }));
      band.position.y = yAcc + 0.085;
      g2.add(band);
      /* deux torches tiki encadrent le totem (lisible de nuit) */
      [-1.25, 1.25].forEach(function (tx2, ti) {
        var pole = new T.Mesh(new T.CylinderGeometry(0.035, 0.05, 1.45, 6), woodDarkMat);
        pole.position.set(tx2, 0.72, 0.55);
        g2.add(pole);
        var cup = new T.Mesh(new T.CylinderGeometry(0.10, 0.06, 0.16, 6), woodMat);
        cup.position.set(tx2, 1.50, 0.55);
        g2.add(cup);
        makeFlame(2.3 + ti * 4.1, tx2, 1.56, 0.55, g2);
      });
      refs.totemLight = new T.PointLight(0xff9540, 0, 10, 2);
      refs.totemLight.position.set(0, 1.8, 0.6);
      g2.add(refs.totemLight);
      group.add(g2);
    })();

    /* ---- Opening : scène de concert (estrade, toile, instruments) ---- */
    (function buildStage() {
      var P = I.props.stage;
      var g2 = new T.Group();
      g2.position.set(P.x, Math.max(terrainH(P.x, P.z), 0.12), P.z);
      g2.rotation.y = Math.atan2(-8.0 - P.x, 31.0 - P.z);
      var deck = new T.Mesh(new T.BoxGeometry(3.6, 0.34, 2.4), woodMat);
      deck.position.y = 0.42;
      g2.add(deck);
      for (var l2 = 0; l2 < 4; l2++) {
        var leg = new T.Mesh(new T.BoxGeometry(0.16, 0.5, 0.16), woodDarkMat);
        leg.position.set((l2 % 2 ? 1 : -1) * 1.55, 0.25, (l2 < 2 ? 1 : -1) * 1.0);
        g2.add(leg);
      }
      var postGeo2 = new T.CylinderGeometry(0.07, 0.085, 2.6, 7);
      var postL = new T.Mesh(postGeo2, woodDarkMat);
      postL.position.set(-1.65, 1.45, -1.0);
      g2.add(postL);
      var postR = new T.Mesh(postGeo2, woodDarkMat);
      postR.position.set(1.65, 1.45, -1.0);
      g2.add(postR);
      var beam2 = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 3.5, 6), woodDarkMat);
      beam2.rotation.z = Math.PI / 2;
      beam2.position.set(0, 2.72, -1.0);
      g2.add(beam2);
      var awning = new T.Mesh(new T.PlaneGeometry(3.7, 2.0, 6, 1),
        new T.MeshLambertMaterial({ map: stripesRed, side: T.DoubleSide }));
      var ap = awning.geometry.attributes.position;
      for (var ai = 0; ai < ap.count; ai++) {
        ap.setZ(ai, -Math.cos(ap.getX(ai) / 1.85 * Math.PI * 0.5) * 0.18);
      }
      awning.geometry.computeVertexNormals();
      awning.rotation.x = -Math.PI / 2 + 0.45;
      awning.position.set(0, 2.55, -0.15);
      g2.add(awning);
      /* tambour à laçage zigzag */
      var dcv = document.createElement('canvas');
      dcv.width = 128; dcv.height = 64;
      var dg = dcv.getContext('2d');
      dg.fillStyle = '#c9803a'; dg.fillRect(0, 0, 128, 64);
      dg.fillStyle = '#8a4a20'; dg.fillRect(0, 0, 128, 8); dg.fillRect(0, 56, 128, 8);
      dg.strokeStyle = '#f0e0c0'; dg.lineWidth = 3;
      dg.beginPath();
      for (var zz = 0; zz < 8; zz++) {
        var zx = zz * 16;
        if (zz % 2 === 0) { dg.moveTo(zx, 10); dg.lineTo(zx + 16, 54); }
        else { dg.moveTo(zx, 54); dg.lineTo(zx + 16, 10); }
      }
      dg.stroke();
      var drumTex = new T.CanvasTexture(dcv);
      drumTex.colorSpace = T.SRGBColorSpace;
      var skinMat = new T.MeshLambertMaterial({ color: 0xf0e6d0 });
      var drum = new T.Mesh(new T.CylinderGeometry(0.42, 0.42, 0.62, 14),
        [new T.MeshLambertMaterial({ map: drumTex }), skinMat, skinMat]);
      drum.position.set(0.85, 0.92, -0.35);
      g2.add(drum);
      var micPole = new T.Mesh(new T.CylinderGeometry(0.025, 0.03, 1.25, 5),
        new T.MeshStandardMaterial({ color: 0x4a4a52, roughness: 0.6 }));
      micPole.position.set(-0.55, 1.21, 0.45);
      g2.add(micPole);
      var micHead = new T.Mesh(new T.SphereGeometry(0.075, 7, 6),
        new T.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.5 }));
      micHead.position.set(-0.55, 1.86, 0.45);
      g2.add(micHead);
      var amp = new T.Mesh(new T.BoxGeometry(0.55, 0.70, 0.40), woodDarkMat);
      amp.position.set(-1.35, 0.94, -0.55);
      g2.add(amp);
      /* guirlande de lampions sous la traverse */
      var lampCols = [0xffb050, 0xff6a50, 0x6ad0c0, 0xffd060, 0xc080ff];
      for (var lp = 0; lp < 5; lp++) {
        var lt = lp / 4;
        var lamp = new T.Mesh(new T.SphereGeometry(0.085, 7, 6), new T.MeshBasicMaterial({ color: lampCols[lp] }));
        lamp.position.set(-1.5 + lt * 3.0, 2.26 - Math.sin(lt * Math.PI) * 0.18, 0.86);
        g2.add(lamp);
      }
      refs.stageLight = new T.PointLight(0xffa860, 1.0, 12, 2);
      refs.stageLight.position.set(0, 2.3, 0.2);
      g2.add(refs.stageLight);
      group.add(g2);
    })();

    /* ---- Tome : kiosque de livres sous auvent ---- */
    (function buildKiosk() {
      var P = I.props.kiosk;
      var g2 = new T.Group();
      g2.position.set(P.x, terrainH(P.x, P.z), P.z);
      g2.rotation.y = Math.atan2(16.5 - P.x, 23.5 - P.z);
      var postGeo3 = new T.CylinderGeometry(0.055, 0.07, 2.05, 6);
      [[-0.95, -0.45], [0.95, -0.45], [-0.95, 0.5], [0.95, 0.5]].forEach(function (pp) {
        var pst = new T.Mesh(postGeo3, woodDarkMat);
        pst.position.set(pp[0], 1.02, pp[1]);
        g2.add(pst);
      });
      var awn = new T.Mesh(new T.PlaneGeometry(2.5, 1.5, 6, 1),
        new T.MeshLambertMaterial({ map: stripesTeal, side: T.DoubleSide }));
      var awp = awn.geometry.attributes.position;
      for (var ai2 = 0; ai2 < awp.count; ai2++) {
        awp.setZ(ai2, -Math.cos(awp.getX(ai2) / 1.25 * Math.PI * 0.5) * 0.12);
      }
      awn.geometry.computeVertexNormals();
      awn.rotation.x = -Math.PI / 2 + 0.38;
      awn.position.set(0, 2.18, 0.12);
      g2.add(awn);
      var back = new T.Mesh(new T.BoxGeometry(2.0, 1.5, 0.06), woodMat);
      back.position.set(0, 0.95, -0.42);
      g2.add(back);
      var sideGeo = new T.BoxGeometry(0.06, 1.5, 0.85);
      var sideL = new T.Mesh(sideGeo, woodMat);
      sideL.position.set(-1.0, 0.95, -0.02);
      g2.add(sideL);
      var sideR = new T.Mesh(sideGeo, woodMat);
      sideR.position.set(1.0, 0.95, -0.02);
      g2.add(sideR);
      var shelfGeo = new T.BoxGeometry(1.95, 0.06, 0.8);
      [0.62, 1.22].forEach(function (sy) {
        var sh = new T.Mesh(shelfGeo, woodLightMat);
        sh.position.set(0, sy, -0.02);
        g2.add(sh);
      });
      /* livres : rangées colorées (palette One Piece), trous et penchés */
      var books = [];
      [0.65, 1.25].forEach(function (sy) {
        var bx3 = -0.88;
        while (bx3 < 0.85) {
          var bw = 0.055 + rng() * 0.045;
          if (rng() < 0.12) { bx3 += 0.07; continue; }
          var bh3 = 0.30 + rng() * 0.13;
          books.push({ x: bx3 + bw / 2, y: sy + bh3 / 2, w: bw, h: bh3, lean: (rng() - 0.5) * 0.12 });
          bx3 += bw + 0.012;
        }
      });
      var bookMesh = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1),
        new T.MeshLambertMaterial({ color: 0xffffff }), Math.max(books.length, 1));
      var BOOKCOLS = [0xc23a2a, 0xe88a2a, 0xe8c84a, 0x4a9a5a, 0x3a7ac2, 0x7a4ac2, 0x2ac2b0, 0xc24a8a, 0x8a5a2a, 0x4a4a8a];
      var colB2 = new T.Color();
      books.forEach(function (bk, bi2) {
        q.setFromAxisAngle(zAxis, bk.lean);
        pv.set(bk.x, bk.y, -0.05);
        sc.set(bk.w, bk.h, 0.30 + hash2(bi2, 5.5) * 0.16);
        m4.compose(pv, q, sc);
        bookMesh.setMatrixAt(bi2, m4);
        colB2.setHex(BOOKCOLS[bi2 % BOOKCOLS.length]);
        if (hash2(bi2, 9.1) < 0.3) colB2.multiplyScalar(0.75);
        bookMesh.setColorAt(bi2, colB2);
      });
      if (bookMesh.instanceColor) bookMesh.instanceColor.needsUpdate = true;
      g2.add(bookMesh);
      var kl = new T.Mesh(new T.BoxGeometry(0.14, 0.18, 0.14), new T.MeshBasicMaterial({ color: 0xffc97a }));
      kl.position.set(0.75, 1.85, 0.3);
      g2.add(kl);
      refs.kioskLight = new T.PointLight(0xffc070, 0.7, 9, 2);
      refs.kioskLight.position.set(0.75, 1.8, 0.35);
      g2.add(refs.kioskLight);
      group.add(g2);
    })();

    return refs;
  }

  /* ============================================================
     L'ÎLE — terrain lissé, lagon, palmiers, forêt, volcan, plage
     ============================================================ */
  function buildIsland(T, scene, uDay, uPixelRatio) {
    var I = ISLAND, V = I.volcano;
    var group = new T.Group();
    group.position.set(I.cx, 0, I.cz);

    /* ---- Terrain : relief lissé, couleurs fondues par bruit ---- */
    var SIZE = 180, SEG = 150;
    var geo = new T.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    var posA = geo.attributes.position;
    for (var i = 0; i < posA.count; i++) {
      posA.setY(i, terrainH(posA.getX(i), posA.getZ(i)));
    }
    geo.computeVertexNormals();

    var norA = geo.attributes.normal;
    var colors = new Float32Array(posA.count * 3);
    /* Palette pensée en sRGB ; three lit les vertex colors en LINÉAIRE
       (r152+), on convertit via pow 2.2 — sans ça tout ressort délavé. */
    function lin3(r, g, b) { return [Math.pow(r, 2.2), Math.pow(g, 2.2), Math.pow(b, 2.2)]; }
    var C = {
      seabed:   lin3(0.55, 0.58, 0.45),
      sandWet:  lin3(0.72, 0.60, 0.44),
      sandDry:  lin3(0.87, 0.76, 0.55),
      sandHigh: lin3(0.92, 0.84, 0.64),
      grass:    lin3(0.36, 0.60, 0.27),
      lush:     lin3(0.16, 0.38, 0.18),
      dirt:     lin3(0.48, 0.37, 0.25),
      rock:     lin3(0.45, 0.42, 0.38),
      basalt:   lin3(0.20, 0.18, 0.17),
      scoria:   lin3(0.48, 0.22, 0.13)
    };
    function mix3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

    for (var vi = 0; vi < posA.count; vi++) {
      var vx = posA.getX(vi), vy = posA.getY(vi), vz = posA.getZ(vi);
      var ny = norA.getY(vi);
      var dv = Math.sqrt((vx - V.x) * (vx - V.x) + (vz - V.z) * (vz - V.z));
      var dpr = Math.sqrt((vx - I.head.x) * (vx - I.head.x) + (vz - I.head.z) * (vz - I.head.z));
      var c;
      if (vy < -0.25) {
        c = mix3(C.seabed, C.sandWet, clamp01((vy + 2.6) / 2.35));
      } else if (vy < 0.45) {
        /* bande de sable mouillé au bord de l'eau */
        c = mix3(C.sandWet, C.sandDry, clamp01(vy / 0.45));
      } else {
        /* plage sèche dorée, patchs plus clairs */
        var dunes = clamp01(fbm2(vx * 0.5 + 4.0, vz * 0.5) * 1.1 - 0.15);
        var sand = mix3(C.sandDry, C.sandHigh, dunes);
        /* fondu sable -> végétation, brisé par du bruit (pas de bande nette) */
        var edge = clamp01((vy - 0.85) / 0.9 + (fbm2(vx * 0.35, vz * 0.35) - 0.5) * 0.8);
        var lushT = clamp01(fbm2(vx * 0.16 + 11.0, vz * 0.16 - 5.0) * 1.7 - 0.35);
        var veg = mix3(C.grass, C.lush, lushT);
        var dirtT = clamp01((fbm2(vx * 0.22 - 7.0, vz * 0.22 + 3.0) - 0.60) * 3.2) * 0.65;
        veg = mix3(veg, C.dirt, dirtT);
        c = mix3(sand, veg, edge);
        var rockT = clamp01((0.70 - ny) * 3.2) + clamp01((vy - 8.0) * 0.30);
        c = mix3(c, C.rock, clamp01(rockT));
        /* volcan : basalte sombre + traînées de scories vers le cratère */
        if (dv < V.r * 1.05 && vy > 4.5) {
          c = mix3(c, C.basalt, clamp01((vy - 4.5) * 0.35 + 0.25));
          var angV = Math.atan2(vz - V.z, vx - V.x);
          var streak = clamp01((vnoise2(angV * 2.6 + 13.0, vy * 0.25) - 0.55) * 3.0);
          c = mix3(c, C.scoria, streak * clamp01((vy - 7.0) * 0.22));
        }
        /* promontoire du phare : roche nue */
        if (dpr < I.head.r * 1.15 && vy > 0.8) {
          c = mix3(c, C.rock, clamp01((vy - 0.6) * 0.45 + 0.2) * 0.85);
        }
      }
      var grain = (hash2(vx * 17.3, vz * 13.1) - 0.5) * (vy > -0.25 && vy < 1.0 ? 0.06 : 0.035);
      colors[vi * 3]     = Math.max(0, c[0] + grain);
      colors[vi * 3 + 1] = Math.max(0, c[1] + grain);
      colors[vi * 3 + 2] = Math.max(0, c[2] + grain);
    }
    geo.setAttribute('color', new T.BufferAttribute(colors, 3));
    var terrain = new T.Mesh(geo, new T.MeshStandardMaterial({
      vertexColors: true, roughness: 0.96, metalness: 0
    }));
    group.add(terrain);

    /* ---- Îles lointaines : silhouettes dans la brume (profondeur) ---- */
    if (!skipped('far')) {
      var farIsle = function (px, pz, size, hMax, col) {
        var fg = new T.PlaneGeometry(size, size, 28, 28);
        fg.rotateX(-Math.PI / 2);
        var fp = fg.attributes.position;
        var lim = size * 0.42;
        for (var fi = 0; fi < fp.count; fi++) {
          var fx = fp.getX(fi), fz = fp.getZ(fi);
          var fr = Math.sqrt(fx * fx + fz * fz);
          var fh = Math.pow(clamp01(1 - fr / lim), 1.3) * hMax;
          fh += (fbm2(fx * 0.08 + px * 0.1, fz * 0.08) - 0.5) * 3.5 * clamp01(fh * 0.4);
          fp.setY(fi, fr > lim ? -3 : fh);
        }
        fg.computeVertexNormals();
        var m = new T.Mesh(fg, new T.MeshStandardMaterial({ color: col, roughness: 1, metalness: 0 }));
        m.position.set(px, 0, pz);
        group.add(m);
      };
      farIsle(-70, -150, 100, 11, 0x2c4636);
      farIsle(58, -125, 46, 5.5, 0x32503c);
    }

    olog('terrain ok');
    /* ---- Végétation : feuillus, buissons, herbe + palmiers de plage ---- */
    var leafTex = makeLeafTexture(T, false);
    var leafDeepTex = makeLeafTexture(T, true);
    var frondTex = makeFrondTexture(T);
    var grassTex = makeGrassTexture(T);
    var rng = mulberry32(20260611);

    /* Feuillus : 3 plans croisés par arbre, deux essences. Les bosquets
       sont dessinés par le bruit (des trouées subsistent) et la
       végétation respecte les clairières des props/caméras. */
    var spots = [];
    var guard = 0;
    while (!skipped('foliage') && spots.length < 170 && guard++ < 16000) {
      var a = rng() * Math.PI * 2;
      var rr = 4 + rng() * (I.R - 4);
      var tx = Math.cos(a) * rr, tz = Math.sin(a) * rr;
      var th = terrainH(tx, tz);
      var dvv = Math.sqrt((tx - V.x) * (tx - V.x) + (tz - V.z) * (tz - V.z));
      if (th < 1.1 || th > 8.5 || dvv < V.r + 1.0) continue;
      if (fbm2(tx * 0.13 + 5.0, tz * 0.13 - 2.0) < 0.40) continue;
      if (isCleared(tx, tz, 0)) continue;
      spots.push({ x: tx, y: th, z: tz, s: 2.0 + rng() * 3.0, rot: rng() * Math.PI, hue: rng(), deep: rng() < 0.45 });
    }
    var leafMatA = new T.MeshLambertMaterial({ map: leafTex, alphaTest: 0.5, side: T.DoubleSide });
    var leafMatB = new T.MeshLambertMaterial({ map: leafDeepTex, alphaTest: 0.5, side: T.DoubleSide });
    var planeGeo = new T.PlaneGeometry(1, 1);
    planeGeo.translate(0, 0.42, 0);
    var nA = 0, nB = 0;
    spots.forEach(function (s) { if (s.deep) nB++; else nA++; });
    var crossA = new T.InstancedMesh(planeGeo, leafMatA, Math.max(nA * 3, 1));
    var crossB = new T.InstancedMesh(planeGeo, leafMatB, Math.max(nB * 3, 1));
    var trunkGeo = new T.CylinderGeometry(0.09, 0.16, 1.0, 6);
    trunkGeo.translate(0, 0.5, 0);
    var trunkMat = new T.MeshStandardMaterial({ color: 0x4a3826, roughness: 1 });
    var trunkMesh = new T.InstancedMesh(trunkGeo, trunkMat, Math.max(spots.length, 1));

    var m4 = new T.Matrix4(), q = new T.Quaternion(), q2 = new T.Quaternion(), sc = new T.Vector3(), pv = new T.Vector3();
    var yAxis = new T.Vector3(0, 1, 0), zAxis = new T.Vector3(0, 0, 1);
    var colT = new T.Color();
    var iA = 0, iB = 0;
    spots.forEach(function (s, idx) {
      var mesh = s.deep ? crossB : crossA;
      var bi = s.deep ? iB : iA;
      for (var k = 0; k < 3; k++) {
        q.setFromAxisAngle(yAxis, s.rot + k * Math.PI / 3);
        q2.setFromAxisAngle(zAxis, (hash2(idx, k) - 0.5) * 0.16);
        q.multiply(q2);
        pv.set(s.x, s.y + s.s * 0.16, s.z);
        sc.set(s.s, s.s * (0.92 + s.hue * 0.18), s.s);
        m4.compose(pv, q, sc);
        mesh.setMatrixAt(bi * 3 + k, m4);
        colT.setHSL(0.27 + s.hue * 0.07, 0.45, 0.30 + s.hue * 0.14);
        mesh.setColorAt(bi * 3 + k, colT);
      }
      if (s.deep) iB++; else iA++;
      q.setFromAxisAngle(yAxis, s.rot);
      pv.set(s.x, s.y - 0.05, s.z);
      var ts = 0.5 + s.s * 0.24;
      sc.set(ts, ts, ts);
      m4.compose(pv, q, sc);
      trunkMesh.setMatrixAt(idx, m4);
    });
    if (crossA.instanceColor) crossA.instanceColor.needsUpdate = true;
    if (crossB.instanceColor) crossB.instanceColor.needsUpdate = true;
    group.add(crossA, crossB, trunkMesh);

    /* Buissons : mêmes feuillages, petits, en lisière */
    var bushes = [];
    guard = 0;
    while (!skipped('foliage') && bushes.length < 90 && guard++ < 9000) {
      var ba = rng() * Math.PI * 2;
      var br = 3 + rng() * (I.R - 1);
      var bx = Math.cos(ba) * br, bz = Math.sin(ba) * br;
      var bh = terrainH(bx, bz);
      var bdv = Math.sqrt((bx - V.x) * (bx - V.x) + (bz - V.z) * (bz - V.z));
      if (bh < 0.55 || bh > 7.0 || bdv < V.r * 0.8) continue;
      if (isCleared(bx, bz, -0.8)) continue;
      bushes.push({ x: bx, y: bh, z: bz, s: 0.7 + rng() * 0.9, rot: rng() * Math.PI, hue: rng() });
    }
    var bushMesh = new T.InstancedMesh(planeGeo, leafMatA, Math.max(bushes.length * 2, 1));
    bushes.forEach(function (b, idx) {
      for (var k = 0; k < 2; k++) {
        q.setFromAxisAngle(yAxis, b.rot + k * Math.PI / 2);
        pv.set(b.x, b.y + b.s * 0.05, b.z);
        sc.set(b.s, b.s * 0.7, b.s);
        m4.compose(pv, q, sc);
        bushMesh.setMatrixAt(idx * 2 + k, m4);
        colT.setHSL(0.26 + b.hue * 0.08, 0.48, 0.30 + b.hue * 0.12);
        bushMesh.setColorAt(idx * 2 + k, colT);
      }
    });
    if (bushMesh.instanceColor) bushMesh.instanceColor.needsUpdate = true;
    group.add(bushMesh);

    /* Touffes d'herbe sur la transition plage/herbe */
    var tufts = [];
    guard = 0;
    while (!skipped('foliage') && tufts.length < 150 && guard++ < 9000) {
      var ga = rng() * Math.PI * 2;
      var gr = I.R * (0.45 + rng() * 0.55);
      var gx = Math.cos(ga) * gr, gz = Math.sin(ga) * gr;
      var gh = terrainH(gx, gz);
      if (gh < 0.35 || gh > 2.2) continue;
      if (isCleared(gx, gz, -1.6)) continue;
      tufts.push({ x: gx, y: gh, z: gz, s: 0.5 + rng() * 0.55, rot: rng() * Math.PI });
    }
    var grassMat = new T.MeshLambertMaterial({ map: grassTex, alphaTest: 0.35, side: T.DoubleSide });
    var tuftMesh = new T.InstancedMesh(planeGeo, grassMat, Math.max(tufts.length * 2, 1));
    tufts.forEach(function (gt, idx) {
      for (var k = 0; k < 2; k++) {
        q.setFromAxisAngle(yAxis, gt.rot + k * Math.PI / 2);
        pv.set(gt.x, gt.y + gt.s * 0.02, gt.z);
        sc.set(gt.s, gt.s, gt.s);
        m4.compose(pv, q, sc);
        tuftMesh.setMatrixAt(idx * 2 + k, m4);
      }
    });
    group.add(tuftMesh);
    olog('foliage ok (' + spots.length + '+' + bushes.length + '+' + tufts.length + ')');

    /* Palmiers : tronc courbé + collerette, 9 palmes retombantes
       (géométrie partagée, courbure parabolique), noix de coco */
    var frondMat = new T.MeshLambertMaterial({
      map: frondTex, alphaTest: 0.45, side: T.DoubleSide
    });
    var palmTrunkMat = new T.MeshStandardMaterial({ color: 0x7a6148, roughness: 1 });
    var cocoMat = new T.MeshStandardMaterial({ color: 0x5a4226, roughness: 1 });
    var cocoGeo = new T.SphereGeometry(0.11, 6, 5);
    var frondGeo = new T.PlaneGeometry(2.3, 0.95, 5, 1);
    frondGeo.translate(1.15, 0, 0);
    (function () {
      var fp2 = frondGeo.attributes.position;
      for (var i2 = 0; i2 < fp2.count; i2++) {
        var fx2 = fp2.getX(i2);
        var t2 = fx2 / 2.3;
        fp2.setY(i2, fp2.getY(i2) - t2 * t2 * 0.85);
      }
      frondGeo.computeVertexNormals();
    })();
    var palmBand = [];
    guard = 0;
    while (!skipped('palms') && palmBand.length < 16 && guard++ < 9000) {
      var pa = (0.10 + rng() * 0.80) * Math.PI;          /* biais arc sud (plage caméra) */
      var pr2 = I.R * (0.70 + rng() * 0.26);
      var px = Math.cos(pa) * pr2, pz = Math.sin(pa) * pr2;
      var ph = terrainH(px, pz);
      if (ph < 0.35 || ph > 1.8) continue;
      if (isCleared(px, pz, 0.4)) continue;
      palmBand.push({ x: px, y: ph, z: pz, lean: rng() * 0.5 + 0.2, rot: rng() * Math.PI * 2, s: 0.85 + rng() * 0.55 });
    }
    palmBand.forEach(function (p) {
      var palm = new T.Group();
      var hgt = 3.6 * p.s;
      var leanX = Math.cos(p.rot) * p.lean * 1.7;
      var leanZ = Math.sin(p.rot) * p.lean * 1.7;
      var curve = new T.QuadraticBezierCurve3(
        new T.Vector3(0, 0, 0),
        new T.Vector3(leanX * 0.35, hgt * 0.55, leanZ * 0.35),
        new T.Vector3(leanX, hgt, leanZ)
      );
      var trunk = new T.Mesh(new T.TubeGeometry(curve, 8, 0.10 * p.s, 6), palmTrunkMat);
      palm.add(trunk);
      var collar = new T.Mesh(new T.CylinderGeometry(0.13 * p.s, 0.20 * p.s, 0.6 * p.s, 7), palmTrunkMat);
      collar.position.y = 0.25 * p.s;
      palm.add(collar);
      var top = curve.getPoint(1);
      for (var f2 = 0; f2 < 9; f2++) {
        var frond = new T.Mesh(frondGeo, frondMat);
        frond.position.copy(top);
        frond.position.y += 0.06;
        frond.rotation.y = (f2 / 9) * Math.PI * 2 + p.rot;
        frond.rotation.z = -0.12 - (f2 % 3) * 0.16;
        frond.scale.setScalar(p.s * (0.92 + hash2(f2, p.rot) * 0.25));
        palm.add(frond);
      }
      for (var c2 = 0; c2 < 3; c2++) {
        var coco = new T.Mesh(cocoGeo, cocoMat);
        var ca = c2 * 2.1 + p.rot;
        coco.scale.setScalar(p.s);
        coco.position.set(top.x + Math.cos(ca) * 0.18 * p.s, top.y - 0.10 * p.s, top.z + Math.sin(ca) * 0.18 * p.s);
        palm.add(coco);
      }
      palm.position.set(p.x, p.y - 0.06, p.z);
      group.add(palm);
    });

    olog('palms ok (' + palmBand.length + ')');
    /* ---- Bois flotté sur la plage (premier plan photo) ---- */
    var driftMat = new T.MeshStandardMaterial({ color: 0x97876e, roughness: 1 });
    function driftwood(lx, lz, scale, rotY) {
      var dy = Math.max(terrainH(lx, lz), 0.05);
      var pts = [];
      for (var d2 = 0; d2 < 5; d2++) {
        pts.push(new T.Vector3(
          d2 * 0.55 * scale + (hash2(d2 * 3.1, lx) - 0.5) * 0.3,
          0.05 + Math.sin(d2 * 1.4) * 0.16 * scale,
          (hash2(d2 * 7.7, lz) - 0.5) * 0.5
        ));
      }
      var wood = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 10, 0.07 * scale, 5), driftMat);
      wood.position.set(lx, dy, lz);
      wood.rotation.y = rotY;
      group.add(wood);
      var branch = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([
        pts[2].clone(), pts[2].clone().add(new T.Vector3(0.3, 0.55 * scale, 0.2))
      ]), 4, 0.04 * scale, 4), driftMat);
      branch.position.copy(wood.position);
      branch.rotation.y = rotY;
      group.add(branch);
    }
    if (!skipped('drift')) {
      driftwood(5.0, 30.8, 1.3, 2.2);
      driftwood(-19.5, 21.5, 1.5, 0.7);
    }

    /* ---- Rochers : icosaèdres bruités (sans couture), instanciés ----
       Trois variantes de géométrie ; le jitter dépend de la position du
       sommet (déterministe) pour rester étanche malgré les faces séparées. */
    function makeRockGeo(seed) {
      var rg = new T.IcosahedronGeometry(1, 1);
      var rp = rg.attributes.position;
      for (var i2 = 0; i2 < rp.count; i2++) {
        var rx = rp.getX(i2), ry = rp.getY(i2), rz = rp.getZ(i2);
        var j = (hash2(Math.round(rx * 997) * 0.011 + seed, Math.round(ry * 997) * 0.013 + Math.round(rz * 997) * 0.007) - 0.5) * 0.5;
        var k2 = 1 + j;
        rp.setXYZ(i2, rx * k2, ry * k2 * 0.72, rz * k2);
      }
      rg.computeVertexNormals();
      return rg;
    }
    var rockGeos = [makeRockGeo(11), makeRockGeo(77), makeRockGeo(301)];
    var rockMat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 });
    var rockSpots = [[], [], []];
    function addRock(lx, lz, s, sink, shade) {
      rockSpots[Math.floor(rng() * 3)].push({ x: lx, z: lz, s: s, sink: sink, shade: shade, rot: rng() * Math.PI * 2 });
    }
    /* gros blocs au pied du promontoire du phare */
    for (var rh = 0; rh < 9; rh++) {
      var ra2 = rng() * Math.PI * 2;
      var rd2 = 1.5 + rng() * 5.0;
      addRock(I.head.x + Math.cos(ra2) * rd2, I.head.z + Math.sin(ra2) * rd2 * 0.8,
        0.8 + rng() * 2.0, 0.35, 0.55 + rng() * 0.25);
    }
    /* blocs épars demi-enterrés sur la plage */
    guard = 0;
    var nBeach = 0;
    while (nBeach < 14 && guard++ < 5000) {
      var ba2 = rng() * Math.PI * 2;
      var br2 = I.R * (0.62 + rng() * 0.45);
      var bx2 = Math.cos(ba2) * br2, bz2 = Math.sin(ba2) * br2;
      var bh2 = terrainH(bx2, bz2);
      if (bh2 < -0.6 || bh2 > 1.6) continue;
      if (isCleared(bx2, bz2, -0.5)) continue;
      addRock(bx2, bz2, 0.35 + rng() * 0.9, 0.45, 0.62 + rng() * 0.3);
      nBeach++;
    }
    /* scories sombres sur les pentes du volcan */
    guard = 0;
    var nScoria = 0;
    while (nScoria < 10 && guard++ < 4000) {
      var sa2 = rng() * Math.PI * 2;
      var sd2 = V.craterR + 1.5 + rng() * (V.r - V.craterR - 1.0);
      var sx2 = V.x + Math.cos(sa2) * sd2;
      var sz2 = V.z + Math.sin(sa2) * sd2;
      if (terrainH(sx2, sz2) < 4.0) continue;
      addRock(sx2, sz2, 0.4 + rng() * 1.0, 0.4, 0.16 + rng() * 0.12);
      nScoria++;
    }
    rockSpots.forEach(function (list, gi) {
      if (!list.length) return;
      var rm = new T.InstancedMesh(rockGeos[gi], rockMat, list.length);
      list.forEach(function (rk, idx) {
        q.setFromAxisAngle(yAxis, rk.rot);
        pv.set(rk.x, terrainH(rk.x, rk.z) - rk.sink * rk.s, rk.z);
        sc.set(rk.s, rk.s, rk.s);
        m4.compose(pv, q, sc);
        rm.setMatrixAt(idx, m4);
        var shd = Math.pow(rk.shade, 2.2);   /* sRGB -> linéaire (cf. palette) */
        colT.setRGB(shd, shd * 0.94, shd * 0.86);
        rm.setColorAt(idx, colT);
      });
      if (rm.instanceColor) rm.instanceColor.needsUpdate = true;
      group.add(rm);
    });
    olog('rocks ok');

    /* ---- Volcan : lave + fumée ---- */
    var craterY = terrainH(V.x, V.z) + 0.35;
    var lava = new T.Mesh(
      new T.CircleGeometry(V.craterR * 0.62, 20),
      new T.MeshBasicMaterial({ color: 0xff5a18 })
    );
    lava.rotation.x = -Math.PI / 2;
    lava.position.set(V.x, craterY, V.z);
    group.add(lava);

    var lavaLight = new T.PointLight(0xff6a20, 1.2, 30, 2);
    lavaLight.position.set(V.x, craterY + 1.6, V.z);
    group.add(lavaLight);

    var smokeN = 70;
    var sPos = new Float32Array(smokeN * 3);
    var sSeed = new Float32Array(smokeN);
    for (var s2 = 0; s2 < smokeN; s2++) {
      sPos[s2 * 3] = V.x; sPos[s2 * 3 + 1] = craterY + 0.5; sPos[s2 * 3 + 2] = V.z;
      sSeed[s2] = Math.random();
    }
    var smokeGeo = new T.BufferGeometry();
    smokeGeo.setAttribute('position', new T.BufferAttribute(sPos, 3));
    smokeGeo.setAttribute('aSeed', new T.BufferAttribute(sSeed, 1));
    var smokeMat = new T.ShaderMaterial({
      vertexShader: SMOKE_VERT, fragmentShader: SMOKE_FRAG,
      uniforms: { uTime: { value: 0 }, uPixelRatio: uPixelRatio, uDay: uDay },
      transparent: true, depthWrite: false
    });
    var smoke = new T.Points(smokeGeo, smokeMat);
    smoke.renderOrder = 3;
    group.add(smoke);

    /* coulées de lave depuis la lèvre du cratère (face sud, côté caméras) */
    var lavaStreakMat = new T.MeshBasicMaterial({
      color: 0xff4a14, transparent: true, opacity: 0.75,
      blending: T.AdditiveBlending, depthWrite: false
    });
    [1.85, 2.45, 0.95].forEach(function (a0, si) {
      var pts2 = [];
      for (var st = 0; st <= 6; st++) {
        var dd = V.craterR * 1.02 + st * (1.0 + si * 0.25);
        var ax2 = V.x + Math.cos(a0 + st * 0.07 * (si - 1)) * dd;
        var az2 = V.z + Math.sin(a0 + st * 0.07 * (si - 1)) * dd;
        pts2.push(new T.Vector3(ax2, terrainH(ax2, az2) + 0.07, az2));
      }
      var streak = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts2), 12, 0.14 + si * 0.04, 5), lavaStreakMat);
      streak.renderOrder = 2;
      group.add(streak);
    });

    /* ---- Pavillon planté sur la plage ---- */
    var flagGroup = new T.Group();
    var fh = Math.max(terrainH(I.flag.x, I.flag.z), 0.1);
    flagGroup.position.set(I.flag.x, fh, I.flag.z);
    flagGroup.rotation.y = -0.6;
    var pole = new T.Mesh(
      new T.CylinderGeometry(0.04, 0.06, 2.8, 6),
      new T.MeshStandardMaterial({ color: 0x4a3828, roughness: 1 })
    );
    pole.position.y = 1.4;
    flagGroup.add(pole);

    var flagCanvas = document.createElement('canvas');
    flagCanvas.width = 256; flagCanvas.height = 160;
    var fc = flagCanvas.getContext('2d');
    fc.fillStyle = '#14181f';
    fc.fillRect(0, 0, 256, 160);
    var flagTex = new T.CanvasTexture(flagCanvas);
    flagTex.colorSpace = T.SRGBColorSpace;
    var jr = new Image();
    jr.onload = function () {
      fc.drawImage(jr, 64, 16, 128, 128);
      flagTex.needsUpdate = true;
    };
    jr.src = 'images/jolly_roger.png';

    var flagMat = new T.ShaderMaterial({
      vertexShader: FLAG_VERT, fragmentShader: FLAG_FRAG,
      uniforms: { uTime: { value: 0 }, uMap: { value: flagTex }, uDay: uDay },
      side: T.DoubleSide, transparent: true
    });
    var flagGeo = new T.PlaneGeometry(1.5, 0.94, 12, 6);
    flagGeo.translate(0.75, 0, 0);
    var flag = new T.Mesh(flagGeo, flagMat);
    flag.position.y = 2.25;
    flagGroup.add(flag);
    group.add(flagGroup);

    /* ---- Feu de camp : trépied de bûches, pierres, flammes, braises ---- */
    var fireGroup = new T.Group();
    var fy = Math.max(terrainH(I.fire.x, I.fire.z), 0.1);
    fireGroup.position.set(I.fire.x, fy, I.fire.z);
    var logMat = new T.MeshStandardMaterial({ color: 0x4a3424, roughness: 1 });
    var logGeo = new T.CylinderGeometry(0.045, 0.06, 0.95, 5);
    var fireApex = new T.Vector3(0, 0.58, 0);
    var upV = new T.Vector3(0, 1, 0);
    for (var lg = 0; lg < 5; lg++) {
      var la = (lg / 5) * Math.PI * 2 + 0.3;
      var fbase = new T.Vector3(Math.cos(la) * 0.30, 0.04, Math.sin(la) * 0.30);
      var log = new T.Mesh(logGeo, logMat);
      log.position.copy(fbase).add(fireApex).multiplyScalar(0.5);
      log.quaternion.setFromUnitVectors(upV, fireApex.clone().sub(fbase).normalize());
      fireGroup.add(log);
    }
    var stoneMat = new T.MeshStandardMaterial({ color: 0x6f695f, roughness: 1 });
    for (var st2 = 0; st2 < 7; st2++) {
      var sa3 = (st2 / 7) * Math.PI * 2 + 0.2;
      var stone = new T.Mesh(rockGeos[st2 % 3], stoneMat);
      stone.scale.setScalar(0.13 + hash2(st2, 3.3) * 0.07);
      stone.position.set(Math.cos(sa3) * 0.52, 0.03, Math.sin(sa3) * 0.52);
      stone.rotation.y = sa3 * 2.3;
      fireGroup.add(stone);
    }
    var flameMat = new T.ShaderMaterial({
      vertexShader: FLAME_VERT, fragmentShader: FLAME_FRAG,
      uniforms: { uTime: { value: 0 }, uSeed: { value: 3.7 }, uDay: uDay },
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide
    });
    var flameGeo = new T.PlaneGeometry(0.62, 0.85, 1, 4);
    flameGeo.translate(0, 0.425, 0);
    for (var fl = 0; fl < 2; fl++) {
      var flame = new T.Mesh(flameGeo, flameMat);
      flame.position.y = 0.14;
      flame.rotation.y = fl * Math.PI / 2;
      flame.renderOrder = 3;
      fireGroup.add(flame);
    }
    var fireLight = new T.PointLight(0xff8a30, 1.4, 16, 2);
    fireLight.position.y = 0.7;
    fireGroup.add(fireLight);

    var emberN = 50;
    var ePos = new Float32Array(emberN * 3);
    var eSeed = new Float32Array(emberN);
    for (var e2 = 0; e2 < emberN; e2++) {
      ePos[e2 * 3] = 0; ePos[e2 * 3 + 1] = 0.25; ePos[e2 * 3 + 2] = 0;
      eSeed[e2] = Math.random();
    }
    var emberGeo = new T.BufferGeometry();
    emberGeo.setAttribute('position', new T.BufferAttribute(ePos, 3));
    emberGeo.setAttribute('aSeed', new T.BufferAttribute(eSeed, 1));
    var emberMat = new T.ShaderMaterial({
      vertexShader: EMBER_VERT, fragmentShader: EMBER_FRAG,
      uniforms: { uTime: { value: 0 }, uPixelRatio: uPixelRatio },
      transparent: true, depthWrite: false, blending: T.AdditiveBlending
    });
    var embers = new T.Points(emberGeo, emberMat);
    embers.renderOrder = 3;
    fireGroup.add(embers);
    group.add(fireGroup);

    /* ---- Décors par mode (ponton, phare, totem…) ---- */
    var props = buildModeProps(T, group, rng, planeGeo, leafMatB, rockGeos, uDay);
    olog('props ok');

    scene.add(group);
    return {
      smokeMat: smokeMat, emberMat: emberMat, flagMat: flagMat,
      flameMats: [flameMat].concat(props.flameMats),
      lavaLight: lavaLight, fireLight: fireLight, lavaStreakMat: lavaStreakMat,
      dockLight: props.dockLight, beaconLight: props.beaconLight,
      beamMat: props.beamMat, beamPivot: props.beamPivot,
      stageLight: props.stageLight, kioskLight: props.kioskLight,
      floodLight: props.floodLight, wantedLight: props.wantedLight,
      totemLight: props.totemLight, fruitLight: props.fruitLight,
      fruitMat: props.fruitMat, fruitHalo: props.fruitHalo
    };
  }

  /* ============================================================
     SCÈNE
     ============================================================ */
  function buildScene(canvas, mode) {
    var T = window.THREE;
    var cfg = CONFIGS[mode];

    var waves = WAVE_DEFS.map(function (w) {
      var l = Math.sqrt(w.dx * w.dx + w.dz * w.dz) || 1;
      return { dx: w.dx / l, dz: w.dz / l, amp: w.amp * cfg.waveScale, len: w.len };
    });
    var maxAmp = waves.reduce(function (s, w) { return s + w.amp; }, 0);

    function waveHeight(x, z, t) {
      var y = 0;
      for (var i = 0; i < waves.length; i++) {
        var w = waves[i];
        var k = (2 * Math.PI) / w.len;
        var c = Math.sqrt(9.81 / k);
        y += w.amp * Math.sin(k * ((w.dx * x + w.dz * z) - c * t));
      }
      return y;
    }

    /* ---- Renderer ---- */
    var renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
    var pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    var uPixelRatio = { value: pixelRatio };
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    var scene = new T.Scene();
    scene.fog = new T.FogExp2(0x020d1e, PAL_NIGHT.fogD);

    var camera = new T.PerspectiveCamera(cfg.fov, window.innerWidth / window.innerHeight, 0.1, 700);

    /* ---- Jour / nuit ---- */
    function isDay() { return document.documentElement.getAttribute('data-theme') === 'light'; }
    var dayBlend = isDay() ? 1 : 0;
    var dayTarget = dayBlend;
    var uDay = { value: dayBlend };
    new MutationObserver(function () { dayTarget = isDay() ? 1 : 0; })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    /* ---- Uniformes partagés ---- */
    var uTime = { value: 0 };
    var uWaves = {
      value: waves.map(function (w) { return new T.Vector4(w.dx, w.dz, w.amp, w.len); })
    };
    var astroDir = new T.Vector3();
    var moonV = new T.Vector3(DIR_MOON.x, DIR_MOON.y, DIR_MOON.z);
    var sunV  = new T.Vector3(DIR_SUN.x,  DIR_SUN.y,  DIR_SUN.z);

    function v3(rgb) { return new T.Vector3(rgb[0], rgb[1], rgb[2]); }

    var lerpedColors = [];
    function dayColor(night, day) {
      var u = { value: v3(night) };
      lerpedColors.push({ u: u, n: night, d: day });
      return u;
    }
    var uFogColorW = dayColor(PAL_NIGHT.fog, PAL_DAY.fog);
    var uFogColorS = dayColor(PAL_NIGHT.fog, PAL_DAY.fog);
    var uFogDensity = { value: PAL_NIGHT.fogD };

    /* ---- Eau ---- */
    var waterGeo = new T.PlaneGeometry(cfg.waterSize, cfg.waterSize, cfg.segments, cfg.segments);
    waterGeo.rotateX(-Math.PI / 2);
    var uMouse = { value: new T.Vector2(0, -25) };
    var uMouseForce = { value: 0 };
    var waterMat = new T.ShaderMaterial({
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
      uniforms: {
        uTime: uTime, uDay: uDay, uWaves: uWaves, uMouse: uMouse, uMouseForce: uMouseForce,
        uSteep: { value: 0.72 },
        uMoonDir: { value: astroDir },
        uDeep:    dayColor(PAL_NIGHT.deep,    PAL_DAY.deep),
        uSurface: dayColor(PAL_NIGHT.surface, PAL_DAY.surface),
        uFoam:    dayColor(PAL_NIGHT.foam,    PAL_DAY.foam),
        uMoonCol: dayColor(PAL_NIGHT.spec,    PAL_DAY.spec),
        uHorizon: dayColor(PAL_NIGHT.horizon, PAL_DAY.horizon),
        uFogColor: uFogColorW,
        uFogDensity: uFogDensity,
        uMaxAmp: { value: maxAmp },
        uIslandOn: { value: (cfg.island && !skipped('shore')) ? 1 : 0 },
        uCoastTex: { value: buildCoastTexture(T, cfg.island) },
        uCoastArea: { value: new T.Vector4(ISLAND.cx, ISLAND.cz, 1 / 220, 6.0) }
      }
    });
    scene.add(new T.Mesh(waterGeo, waterMat));

    /* ---- Ciel ---- */
    var skyMat = new T.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: T.BackSide,
      depthWrite: false,
      uniforms: {
        uTime: uTime, uDay: uDay,
        uMoonDir: { value: astroDir },
        uZenith:   dayColor(PAL_NIGHT.zenith,  PAL_DAY.zenith),
        uHorizonC: dayColor(PAL_NIGHT.horizon, PAL_DAY.horizon),
        uMoonCol:  dayColor(PAL_NIGHT.sun,     PAL_DAY.sun),
        uFogColor: uFogColorS
      }
    });
    var sky = new T.Mesh(new T.SphereGeometry(260, 48, 32), skyMat);
    sky.renderOrder = -1;
    scene.add(sky);

    /* ---- Lumières (lerpées nuit <-> jour) ---- */
    var ambient = new T.AmbientLight(0x1a2a44, 0.95);
    scene.add(ambient);
    var hemi = new T.HemisphereLight(0x1a2a4a, 0x0a1420, 0.45);
    scene.add(hemi);
    var astroLight = new T.DirectionalLight(0xbcd4ff, 1.05);
    scene.add(astroLight);
    var horizonGlow = new T.PointLight(0xf0d880, 1.2, 0, 2);
    scene.add(horizonGlow);
    /* Fill : lève les ombres côté caméra (l'astre éclaire par derrière) */
    var fillLight = new T.DirectionalLight(0x4a6a9a, 0.55);
    fillLight.position.set(20, 35, 90);
    scene.add(fillLight);

    var LIGHTS_NIGHT = {
      amb:  { c: new T.Color(0x223450), i: 1.02 },
      hemiS:{ c: new T.Color(0x22324e) }, hemiG: { c: new T.Color(0x0c1626) }, hemiI: 0.52,
      dir:  { c: new T.Color(0xbcd4ff), i: 1.15 },
      glow: { c: new T.Color(0xf0d880), i: 1.20 },
      fill: { c: new T.Color(0x4a6a9a), i: 0.68 },
      expo: 1.2, ship: new T.Color(0x8a9cba)
    };
    var LIGHTS_DAY = {
      amb:  { c: new T.Color(0xa8c8e0), i: 1.00 },
      hemiS:{ c: new T.Color(0xbfdcf5) }, hemiG: { c: new T.Color(0x7a9468) }, hemiI: 0.90,
      dir:  { c: new T.Color(0xfff2d8), i: 1.60 },
      glow: { c: new T.Color(0xfff0c0), i: 0.30 },
      fill: { c: new T.Color(0xdce9f5), i: 0.70 },
      expo: 1.05, ship: new T.Color(0xffffff)
    };

    /* ---- Navire (Vogue Merry) ----
       Jeu : à quai en mode Classique, mouillée au large sinon —
       elle glisse doucement de l'une à l'autre position. */
    var ship = null;
    var shipBase = { x: 0, z: 0 };
    var shipTarget = { x: 0, z: 0 };
    function shipSpotFor(modeId) {
      var s = (modeId === 'classic') ? ISLAND.dockShip : ISLAND.ship;
      return { x: ISLAND.cx + s.x, z: ISLAND.cz + s.z };
    }
    if (cfg.island) {
      var s0 = shipSpotFor('classic');
      shipBase.x = s0.x; shipBase.z = s0.z;
      shipTarget.x = s0.x; shipTarget.z = s0.z;
    } else {
      shipBase.x = LAND_SHIP_PATH[0].x;
      shipBase.z = LAND_SHIP_PATH[0].z;
    }
    new T.TextureLoader().load('images/going_merry.png', function (tex) {
      tex.colorSpace = T.SRGBColorSpace;
      var mat = new T.SpriteMaterial({ map: tex, color: 0x7287a8, fog: true });
      ship = new T.Sprite(mat);
      ship.scale.set(cfg.ship.w, cfg.ship.h, 1);
      ship.position.set(shipBase.x, cfg.ship.lift, shipBase.z);
      ship.renderOrder = 1;
      scene.add(ship);
    });

    /* ---- L'île (jeu uniquement) ---- */
    var island = null;
    var GAME_VIEWS = null;
    if (cfg.island) {
      if (!skipped('island')) island = buildIsland(T, scene, uDay, uPixelRatio);
      GAME_VIEWS = buildGameViews();
      olog('island ok');
    }

    /* ---- Particules d'écume ---- */
    var count = cfg.particles;
    var pos = new Float32Array(count * 3);
    var rand = new Float32Array(count * 4);
    for (var i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * cfg.field.w;
      pos[i * 3 + 1] = 0;
      pos[i * 3 + 2] = cfg.field.zFar + Math.random() * (cfg.field.zNear - cfg.field.zFar);
      rand[i * 4]     = Math.random();
      rand[i * 4 + 1] = Math.random();
      rand[i * 4 + 2] = 0.5 + Math.random() * 1.2;
      rand[i * 4 + 3] = Math.random();
    }
    var foamGeo = new T.BufferGeometry();
    foamGeo.setAttribute('position', new T.BufferAttribute(pos, 3));
    foamGeo.setAttribute('aRand', new T.BufferAttribute(rand, 4));
    var foamMat = new T.ShaderMaterial({
      vertexShader: FOAM_VERT,
      fragmentShader: FOAM_FRAG,
      uniforms: {
        uTime: uTime, uWaves: uWaves,
        uField: { value: cfg.field.w },
        uPixelRatio: uPixelRatio
      },
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending
    });
    var foam = new T.Points(foamGeo, foamMat);
    foam.renderOrder = 2;
    if (!skipped('foam')) scene.add(foam);

    /* ---- Souris : parallaxe caméra + houle locale ---- */
    var mouse = { x: 0, y: 0, tx: 0, ty: 0, lastMove: -1e4 };
    window.addEventListener('pointermove', function (e) {
      mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.ty = -((e.clientY / window.innerHeight) * 2 - 1);
      mouse.lastMove = performance.now();
    }, { passive: true });

    var rayV = new T.Vector3();
    function projectMouseOnWater() {
      rayV.set(mouse.x, mouse.y, 0.5).unproject(camera);
      rayV.sub(camera.position).normalize();
      if (rayV.y < -0.05) {
        var t = -camera.position.y / rayV.y;
        if (t > 0 && t < 400) {
          uMouse.value.set(camera.position.x + rayV.x * t, camera.position.z + rayV.z * t);
        }
      }
    }

    /* ---- Scroll : la traversée (landing) / léger panoramique (jeu) ---- */
    var scroll = { t: 0, s: 0 };
    function readScroll() {
      var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      scroll.t = clamp01((window.scrollY || window.pageYOffset || 0) / max);
    }
    window.addEventListener('scroll', readScroll, { passive: true });
    readScroll();

    function samplePath(path, pr, out) {
      var i = 0;
      while (i < path.length - 2 && pr > path[i + 1].p) i++;
      var a = path[i], b = path[i + 1];
      var t = smoothstep01(clamp01((pr - a.p) / (b.p - a.p)));
      for (var k in out) {
        if (a[k] instanceof Array) {
          for (var j = 0; j < a[k].length; j++) out[k][j] = a[k][j] + (b[k][j] - a[k][j]) * t;
        } else {
          out[k] = a[k] + (b[k] - a[k]) * t;
        }
      }
      return out;
    }
    var camSample = { pos: [0, 0, 0], look: [0, 0, 0] };
    var shipSample = { x: 0, z: 0 };

    /* ---- Vol de caméra entre points de vue (jeu) ---- */
    var flight = null;
    var viewCur = null;
    if (cfg.island) {
      viewCur = {
        pos: new T.Vector3().fromArray(GAME_VIEWS.classic.pos),
        look: new T.Vector3().fromArray(GAME_VIEWS.classic.look)
      };
      var flyTo = function (modeId) {
        var v = GAME_VIEWS[modeId];
        if (!v) return;
        flight = {
          fromP: viewCur.pos.clone(), fromL: viewCur.look.clone(),
          toP: new T.Vector3().fromArray(v.pos), toL: new T.Vector3().fromArray(v.look),
          t0: performance.now(), dur: 2100
        };
        var sp = shipSpotFor(modeId);
        shipTarget.x = sp.x; shipTarget.z = sp.z;
      };
      document.querySelectorAll('.mode-tab').forEach(function (btn) {
        btn.addEventListener('click', function () {
          flyTo(btn.id.replace('tab-', ''));
        });
      });
      /* app.js restaure le dernier mode joué après coup : on se cale dessus */
      setTimeout(function () {
        var act = document.querySelector('.mode-tab.active');
        if (act) {
          var modeId = act.id.replace('tab-', '');
          var v = GAME_VIEWS[modeId];
          if (v) {
            viewCur.pos.fromArray(v.pos);
            viewCur.look.fromArray(v.look);
          }
          var sp = shipSpotFor(modeId);
          shipTarget.x = sp.x; shipTarget.z = sp.z;
          shipBase.x = sp.x; shipBase.z = sp.z;
        }
      }, 1200);
    }

    /* ---- Redimensionnement ---- */
    window.addEventListener('resize', function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      readScroll();
    });

    /* ---- Boucle ---- */
    var clock = new T.Clock();
    var rafId = 0;
    var frameAcc = 0, frameN = 0, degraded = false;
    var lastFrame = performance.now();
    var lookTarget = new T.Vector3();

    function applyDayNight() {
      var b = dayBlend;
      for (var i = 0; i < lerpedColors.length; i++) {
        var lc = lerpedColors[i];
        lc.u.value.set(
          lc.n[0] + (lc.d[0] - lc.n[0]) * b,
          lc.n[1] + (lc.d[1] - lc.n[1]) * b,
          lc.n[2] + (lc.d[2] - lc.n[2]) * b
        );
      }
      uFogDensity.value = PAL_NIGHT.fogD + (PAL_DAY.fogD - PAL_NIGHT.fogD) * b;
      scene.fog.color.setRGB(
        PAL_NIGHT.fog[0] + (PAL_DAY.fog[0] - PAL_NIGHT.fog[0]) * b,
        PAL_NIGHT.fog[1] + (PAL_DAY.fog[1] - PAL_NIGHT.fog[1]) * b,
        PAL_NIGHT.fog[2] + (PAL_DAY.fog[2] - PAL_NIGHT.fog[2]) * b
      );
      scene.fog.density = uFogDensity.value;

      astroDir.lerpVectors(moonV, sunV, b).normalize();
      astroLight.position.copy(astroDir).multiplyScalar(120);
      horizonGlow.position.set(astroDir.x * 160, 4 + b * 30, astroDir.z * 160);

      ambient.color.lerpColors(LIGHTS_NIGHT.amb.c, LIGHTS_DAY.amb.c, b);
      ambient.intensity = LIGHTS_NIGHT.amb.i + (LIGHTS_DAY.amb.i - LIGHTS_NIGHT.amb.i) * b;
      hemi.color.lerpColors(LIGHTS_NIGHT.hemiS.c, LIGHTS_DAY.hemiS.c, b);
      hemi.groundColor.lerpColors(LIGHTS_NIGHT.hemiG.c, LIGHTS_DAY.hemiG.c, b);
      hemi.intensity = LIGHTS_NIGHT.hemiI + (LIGHTS_DAY.hemiI - LIGHTS_NIGHT.hemiI) * b;
      astroLight.color.lerpColors(LIGHTS_NIGHT.dir.c, LIGHTS_DAY.dir.c, b);
      astroLight.intensity = LIGHTS_NIGHT.dir.i + (LIGHTS_DAY.dir.i - LIGHTS_NIGHT.dir.i) * b;
      horizonGlow.color.lerpColors(LIGHTS_NIGHT.glow.c, LIGHTS_DAY.glow.c, b);
      horizonGlow.intensity = LIGHTS_NIGHT.glow.i + (LIGHTS_DAY.glow.i - LIGHTS_NIGHT.glow.i) * b;
      fillLight.color.lerpColors(LIGHTS_NIGHT.fill.c, LIGHTS_DAY.fill.c, b);
      fillLight.intensity = LIGHTS_NIGHT.fill.i + (LIGHTS_DAY.fill.i - LIGHTS_NIGHT.fill.i) * b;
      renderer.toneMappingExposure = LIGHTS_NIGHT.expo + (LIGHTS_DAY.expo - LIGHTS_NIGHT.expo) * b;
      if (ship) ship.material.color.lerpColors(LIGHTS_NIGHT.ship, LIGHTS_DAY.ship, b);
      if (island) {
        island.lavaLight.intensity = (1.1 + Math.sin(uTime.value * 7.3) * 0.25) * (1 - b * 0.55);
        island.fireLight.intensity = (1.3 + Math.sin(uTime.value * 9.1) * 0.3 + Math.sin(uTime.value * 15.7) * 0.15) * (1 - b * 0.45);
        var nf = 1 - b;
        island.dockLight.intensity = 0.15 + nf * 1.45;
        island.beaconLight.intensity = 0.18 + nf * 2.00;
        island.stageLight.intensity = 0.10 + nf * 1.40;
        island.kioskLight.intensity = 0.06 + nf * 1.05;
        island.floodLight.intensity = nf * 14.0;   /* à ~5 m, decay² physique */
        island.wantedLight.intensity = 0.06 + nf * 1.30;
        island.totemLight.intensity = 0.05 + nf * 1.40;
        island.beamMat.opacity = 0.02 + nf * 0.10;
        island.lavaStreakMat.opacity = 0.35 + nf * 0.45;
      }
    }
    applyDayNight();

    function frame() {
      rafId = requestAnimationFrame(frame);
      var now = performance.now();
      var dt = now - lastFrame;
      lastFrame = now;

      /* Garde-fou perf à deux étages : on baisse la définition, et si le
         GPU s'effondre malgré tout, on coupe le 3D proprement. */
      if (dt < 4000) {
        frameAcc += dt; frameN++;
        if (!degraded && frameN >= 60) {
          if (frameAcc / frameN > 26 && pixelRatio > 1) {
            pixelRatio = Math.max(1, pixelRatio * 0.66);
            renderer.setPixelRatio(pixelRatio);
            uPixelRatio.value = pixelRatio;
            degraded = true;
          }
          frameAcc = 0; frameN = 0;
        } else if (degraded && frameN >= 30) {
          if (frameAcc / frameN > 120) {
            cancelAnimationFrame(rafId);
            canvas.style.display = 'none';
            console.warn('Ocean3D: GPU trop lent, rendu 3D désactivé.');
            return;
          }
          frameAcc = 0; frameN = 0;
        }
      } else {
        /* Une frame > 4 s = GPU à genoux : on coupe immédiatement */
        cancelAnimationFrame(rafId);
        canvas.style.display = 'none';
        console.warn('Ocean3D: GPU trop lent, rendu 3D désactivé.');
        return;
      }

      var t = clock.getElapsedTime();
      uTime.value = t;
      if (island) {
        island.smokeMat.uniforms.uTime.value = t;
        island.emberMat.uniforms.uTime.value = t;
        island.flagMat.uniforms.uTime.value = t;
        for (var fmi = 0; fmi < island.flameMats.length; fmi++) {
          island.flameMats[fmi].uniforms.uTime.value = t;
        }
        island.beamPivot.rotation.y = t * 0.42;
        var pulse = Math.sin(t * 2.2);
        island.fruitMat.emissiveIntensity = 0.45 + (0.35 + pulse * 0.25) * (1 - dayBlend * 0.6);
        var hps = 1.25 + pulse * 0.22;
        island.fruitHalo.scale.set(hps, hps, 1);
        island.fruitHalo.material.opacity = (0.5 + pulse * 0.18) * (1 - dayBlend * 0.75);
        island.fruitLight.intensity = (1.50 + pulse * 0.45) * (1 - dayBlend * 0.85);
      }

      var db = dayTarget - dayBlend;
      if (Math.abs(db) > 0.0005) {
        dayBlend += db * 0.025;
        uDay.value = dayBlend;
        applyDayNight();
      } else if (island) {
        applyDayNight();
      }

      mouse.x += (mouse.tx - mouse.x) * 0.04;
      mouse.y += (mouse.ty - mouse.y) * 0.04;
      var targetForce = (now - mouse.lastMove < 1500) ? 1 : 0;
      uMouseForce.value += (targetForce - uMouseForce.value) * 0.05;

      scroll.s += (scroll.t - scroll.s) * 0.06;

      var intro = Math.min(t / 3.0, 1);
      var introE = 1 - Math.pow(1 - intro, 3);

      if (!cfg.island) {
        /* —— Landing : la traversée scrollée —— */
        samplePath(LAND_CAM_PATH, scroll.s, camSample);
        camera.position.set(
          camSample.pos[0] + mouse.x * cfg.mouseAmp.x,
          camSample.pos[1] + (1 - introE) * 1.4 + mouse.y * cfg.mouseAmp.y + Math.sin(t * 0.3) * 0.06,
          camSample.pos[2] + (1 - introE) * 2.5
        );
        lookTarget.set(camSample.look[0], camSample.look[1], camSample.look[2]);
        camera.lookAt(lookTarget);

        if (ship) {
          samplePath(LAND_SHIP_PATH, scroll.s, shipSample);
          var sx = shipSample.x + mouse.x * cfg.ship.mouseAmp;
          var sz = shipSample.z;
          var h0 = waveHeight(sx, sz, t);
          var slope = (waveHeight(sx + 1.5, sz, t) - waveHeight(sx - 1.5, sz, t)) / 3;
          ship.position.set(sx, h0 + cfg.ship.lift, sz);
          ship.material.rotation = Math.max(-0.12, Math.min(0.12, slope * 0.9)) + Math.sin(t * 0.5) * 0.03;
        }
      } else {
        /* —— Jeu : promenade sur l'île, un point de vue par mode —— */
        if (flight) {
          var k = clamp01((now - flight.t0) / flight.dur);
          var ke = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
          viewCur.pos.lerpVectors(flight.fromP, flight.toP, ke);
          viewCur.look.lerpVectors(flight.fromL, flight.toL, ke);
          if (k >= 1) flight = null;
        }
        camera.position.set(
          viewCur.pos.x + mouse.x * cfg.mouseAmp.x,
          viewCur.pos.y + (1 - introE) * 1.0 + mouse.y * cfg.mouseAmp.y + Math.sin(t * 0.32) * 0.04 - scroll.s * 0.4,
          viewCur.pos.z + (1 - introE) * 1.6
        );
        lookTarget.set(viewCur.look.x, viewCur.look.y - scroll.s * 0.25, viewCur.look.z);
        camera.lookAt(lookTarget);

        if (ship) {
          /* glisse douce vers le quai (classic) ou le mouillage (autres) */
          shipBase.x += (shipTarget.x - shipBase.x) * 0.014;
          shipBase.z += (shipTarget.z - shipBase.z) * 0.014;
          var h1 = waveHeight(shipBase.x, shipBase.z, t);
          ship.position.set(shipBase.x, h1 + cfg.ship.lift, shipBase.z);
          ship.material.rotation = Math.sin(t * 0.45) * 0.035;
        }
      }

      projectMouseOnWater();
      renderer.render(scene, camera);
      if (!frame._logged) { frame._logged = true; olog('frame 1 rendue'); }
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        cancelAnimationFrame(rafId);
      } else if (ocean3dEnabled()) {
        lastFrame = performance.now();
        frame();
      }
    });

    OCEAN_CTL.pause = function () { cancelAnimationFrame(rafId); };
    OCEAN_CTL.resume = function () {
      cancelAnimationFrame(rafId);   /* évite une double boucle */
      lastFrame = performance.now();
      frame();
    };

    frame();
  }

  /* ============================================================
     INIT
     ============================================================ */
  document.addEventListener('DOMContentLoaded', function () {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    initCardTilt();
    if (!window.THREE) return;
    var mode = document.body.dataset.ocean;
    var canvas = document.getElementById('ocean-canvas');
    if (!canvas || !mode || !CONFIGS[mode]) return;
    function start() {
      try {
        buildScene(canvas, mode);
        OCEAN_CTL.built = true;
      } catch (err) {
        canvas.style.display = 'none';
        console.warn('Ocean3D init failed:', err);
      }
    }
    syncOceanClass();
    if (ocean3dEnabled()) {
      start();
    } else {
      canvas.style.display = 'none';   /* le fond classique du thème reprend */
    }
    /* bascule en direct depuis les paramètres (setOcean3d dans app.js) */
    window.addEventListener('lp-ocean3d-changed', function () {
      syncOceanClass();
      if (ocean3dEnabled()) {
        canvas.style.display = '';
        if (!OCEAN_CTL.built) start();
        else if (OCEAN_CTL.resume) OCEAN_CTL.resume();
      } else {
        canvas.style.display = 'none';
        if (OCEAN_CTL.pause) OCEAN_CTL.pause();
      }
    });
  });
})();
