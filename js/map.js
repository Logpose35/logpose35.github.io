// ===== P6 — CARTE DE GRAND LINE =====
// Carte interactive : 32 îles = 32 arcs de One Piece, débloquées selon le score
// cumulé (LS.cumulativeScore, le même que les rangs pirate). Overlay SVG posé sur
// l'image de fond images/carte.jpeg. Aucune donnée nouvelle persistée (recalcul live).
// Dépendances globales (app.js) : lsGet, LS, sanitizeNum, getRankFromScore, esc.

(function () {
  'use strict';

  // Base des assets lourds (VPS) — locale à l'IIFE pour éviter toute collision
  // avec la constante homonyme d'app.js (scripts classiques, portée globale partagée).
  const ASSET_BASE = window.ASSET_BASE || '';

  // ── Table des 32 îles ──
  // x / y : position en % sur l'image (0-100). seuil : score cumulé requis.
  // Le parcours suit le voyage : East Blue (haut-droite) → Reverse Mountain (centre)
  // → Paradise (bande droite) → [tour du monde] → New World (bande gauche).
  // Coordonnées calées sur les VRAIS emplacements de carte.jpeg (lecture des labels).
  // La Red Line apparaît au centre ET sur les bords (projection cylindrique) :
  // Fish-Man Island / Mariejois sont à l'extrême-gauche, le New World va de la gauche vers le centre.
  const ISLANDS = [
    // East Blue (quadrant haut-droite)
    { arc: 1,  name: 'Romance Dawn',       x: 92, y: 18, seuil: 0 },        // Foosha / Shells Town / Goa
    { arc: 2,  name: 'Orange Town',        x: 75, y: 21, seuil: 3000 },
    { arc: 3,  name: 'Syrup Village',      x: 68, y: 24, seuil: 8000 },
    { arc: 4,  name: 'Baratie',            x: 63, y: 30, seuil: 15000 },
    { arc: 5,  name: 'Arlong Park',        x: 58, y: 22, seuil: 25000 },    // Conomi / Gecko Islands
    { arc: 6,  name: 'Loguetown',          x: 57, y: 35, seuil: 38000 },
    // Entrée de Grand Line (Red Line centrale)
    { arc: 7,  name: 'Reverse Mountain',   x: 50, y: 45, seuil: 50000 },    // Matelot
    // Paradise (bande Grand Line droite, vraies positions)
    { arc: 8,  name: 'Whisky Peak',        x: 54, y: 51, seuil: 68000 },    // Cactus Island
    { arc: 9,  name: 'Little Garden',      x: 53, y: 47, seuil: 90000 },
    { arc: 10, name: 'Drum Island',        x: 56, y: 46, seuil: 115000 },
    { arc: 11, name: 'Alabasta',           x: 60, y: 48, seuil: 150000 },   // Sandy Island · Pirate
    { arc: 12, name: 'Jaya',               x: 61, y: 53, seuil: 190000 },
    { arc: 13, name: 'Skypiea',            x: 61, y: 43, seuil: 235000 },   // ciel au-dessus de Jaya
    { arc: 14, name: 'Long Ring Long Land',x: 72, y: 48, seuil: 285000 },
    { arc: 15, name: 'Water 7',            x: 78, y: 45, seuil: 350000 },   // Second
    { arc: 16, name: 'Enies Lobby',        x: 85, y: 50, seuil: 430000 },
    { arc: 17, name: 'Post-Enies Lobby',   x: 81, y: 47, seuil: 520000 },
    { arc: 18, name: 'Thriller Bark',      x: 90, y: 46, seuil: 610000 },   // Florian Triangle
    { arc: 19, name: 'Sabaody',            x: 96, y: 47, seuil: 700000 },   // pied de la Red Line · Capitaine
    // Calm Belt sud (côté Paradise) + Red Line
    { arc: 20, name: 'Amazon Lily',        x: 83, y: 57, seuil: 850000 },
    { arc: 21, name: 'Impel Down',         x: 88, y: 56, seuil: 1020000 },
    { arc: 22, name: 'Marineford',         x: 91, y: 57, seuil: 1230000 },  // Calm Belt sud, sous Thriller Bark
    { arc: 23, name: 'Post-Guerre',        x: 80, y: 59, seuil: 1500000 },  // Rusukaina · Corsaire
    // New World (extrême-gauche → centre)
    { arc: 24, name: 'Fish-Man Island',    x: 3,  y: 58, seuil: 1800000 },  // sous la Red Line (bord)
    { arc: 25, name: 'Punk Hazard',        x: 6,  y: 54, seuil: 2150000 },  // près du G-5
    { arc: 26, name: 'Dressrosa',          x: 9,  y: 58, seuil: 2550000 },  // Green Bit
    { arc: 27, name: 'Zou',                x: 19, y: 59, seuil: 3000000 },  // Amiral
    { arc: 28, name: 'Whole Cake Island',  x: 18, y: 46, seuil: 3600000 },  // Totland, au-dessus de Zou
    { arc: 29, name: 'Reverie',            x: 3,  y: 49, seuil: 4250000 },  // Mariejois (bord Red Line)
    { arc: 30, name: 'Wano',               x: 31, y: 49, seuil: 5000000 },
    { arc: 31, name: 'Egghead',            x: 32, y: 57, seuil: 6000000 },  // Eggland Island · Yonko
    { arc: 32, name: 'Elbaf',              x: 39, y: 48, seuil: 7500000 },
  ];

  // Zone spéciale « Films & Filler » (arc 0) — HORS de la progression Grand Line :
  // toujours débloquée, non comptée dans les « / 32 îles », pas de compteur communauté.
  // Regroupe les personnages hors-canon (films, hors-série) taggés arc:0 dans data.json.
  const FILLER_ZONE = { arc: 0, name: 'Films & Filler', x: 12, y: 12, seuil: 0 };

  // Résout un numéro d'arc vers son île / sa zone (arc 0 = zone Filler).
  function zoneByArc(arc) {
    return arc === 0 ? FILLER_ZONE : ISLANDS.find(i => i.arc === arc);
  }

  // Conversion % → unités viewBox (1000 × 500, ratio 2:1 comme l'image)
  const VBW = 1000, VBH = 500;
  const px = p => (p / 100) * VBW;
  const py = p => (p / 100) * VBH;

  function currentScore() {
    return sanitizeNum(lsGet(LS.cumulativeScore));
  }

  // Renvoie l'index (0-based) de la dernière île débloquée, -1 si aucune.
  function lastUnlockedIndex(score) {
    let last = -1;
    for (let i = 0; i < ISLANDS.length; i++) {
      if (score >= ISLANDS[i].seuil) last = i;
    }
    return last;
  }

  // ── Construction du SVG overlay ──
  function buildSvg(score) {
    const lastIdx = lastUnlockedIndex(score);

    // Pastilles des îles (placées à leurs vrais emplacements géographiques)
    let pins = '';
    ISLANDS.forEach((isl, i) => {
      const cx = px(isl.x), cy = py(isl.y);
      const unlocked = i <= lastIdx;
      const isLast = i === lastIdx;
      const cls = 'jm-pin ' + (unlocked ? 'jm-pin--on' : 'jm-pin--off') + (isLast ? ' jm-pin--here' : '');
      const r = unlocked ? 9 : 7;
      pins += `<g class="${cls}" data-arc="${isl.arc}" data-name="${esc(isl.name)}" `
            + `data-seuil="${isl.seuil}" data-unlocked="${unlocked ? 1 : 0}" `
            + `transform="translate(${cx} ${cy})" tabindex="0" role="button" `
            + `aria-label="${esc(isl.name)}${unlocked ? '' : ' (verrouillée)'}">`
            + `<circle class="jm-halo" r="${r + 6}"></circle>`
            + `<circle class="jm-dot" r="${r}"></circle>`
            + (unlocked
                ? `<text class="jm-flag" y="1.5" text-anchor="middle">☠</text>`
                : `<text class="jm-lock" y="3" text-anchor="middle">🔒</text>`)
            + (isLast ? `<image class="jm-boat" href="images/going_merry.png" x="-21" y="-38" width="42" height="28" preserveAspectRatio="xMidYMid meet"/>` : '')
            + `</g>`;
    });

    // Pin spécial « Films & Filler » — toujours débloqué, hors progression
    const fz = FILLER_ZONE;
    pins += `<g class="jm-pin jm-pin--on jm-pin--filler" data-arc="${fz.arc}" data-name="${esc(fz.name)}" `
          + `data-seuil="0" data-unlocked="1" transform="translate(${px(fz.x)} ${py(fz.y)})" `
          + `tabindex="0" role="button" aria-label="${esc(fz.name)}">`
          + `<circle class="jm-halo" r="15"></circle>`
          + `<circle class="jm-dot" r="9"></circle>`
          + `<path class="jm-filler-film" d="M-5.5 -6.5H5.5V6.5H-5.5ZM-4.7 -5.15h1.2v1.3h-1.2ZM-4.7 -2.15h1.2v1.3h-1.2ZM-4.7 0.85h1.2v1.3h-1.2ZM-4.7 3.85h1.2v1.3h-1.2ZM3.5 -5.15h1.2v1.3h-1.2ZM3.5 -2.15h1.2v1.3h-1.2ZM3.5 0.85h1.2v1.3h-1.2ZM3.5 3.85h1.2v1.3h-1.2Z"></path>`
          + `</g>`;

    return `<svg class="jm-svg" viewBox="0 0 ${VBW} ${VBH}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">`
         + pins
         + `</svg>`;
  }

  // ── Tooltip (rattaché au .map-stage NON transformé → taille constante au zoom) ──
  let _tip = null;
  function stageEl() { return document.querySelector('.map-stage'); }
  function ensureTip() {
    const stage = stageEl();
    if (!stage) return null;
    if (_tip && _tip.parentNode === stage) return _tip;
    // nettoie d'éventuels résidus (évite l'accumulation de tooltips)
    stage.querySelectorAll('.jm-tip').forEach(n => n.remove());
    _tip = document.createElement('div');
    _tip.className = 'jm-tip';
    _tip.hidden = true;
    stage.appendChild(_tip);
    return _tip;
  }
  function showTip(g) {
    const stage = stageEl();
    const tip = ensureTip();
    if (!stage || !tip) return;
    const name = g.getAttribute('data-name');
    const arc  = g.getAttribute('data-arc');
    const unlocked = g.getAttribute('data-unlocked') === '1';
    const seuil = parseInt(g.getAttribute('data-seuil'), 10);
    const arcLabel = arc === '0' ? 'Hors-série' : `Arc ${esc(arc)}`;
    tip.innerHTML = unlocked
      ? `<span class="jm-tip-arc">${arcLabel}</span><strong>${esc(name)}</strong><span class="jm-tip-state jm-tip-state--on">☠ Débloquée</span>`
      : `<span class="jm-tip-arc">${arcLabel}</span><strong>${esc(name)}</strong><span class="jm-tip-state">🔒 ${seuil.toLocaleString('fr-FR')} pts cumulés</span>`;
    // position en pixels écran relative au stage (tient compte du zoom via getBoundingClientRect)
    const sr = stage.getBoundingClientRect();
    const gr = g.getBoundingClientRect();
    tip.style.left = (gr.left - sr.left + gr.width / 2) + 'px';
    tip.style.top  = (gr.top  - sr.top) + 'px';
    tip.hidden = false;
  }
  function hideTip() { if (_tip) _tip.hidden = true; }

  // ── Zoom / déplacement ──
  const _view = { scale: 1, tx: 0, ty: 0 };
  let _zoomReady = false;
  const MIN_SCALE = 1, MAX_SCALE = 5;

  function applyView() {
    const canvas = document.getElementById('map-canvas');
    if (canvas) canvas.style.transform = `translate(${_view.tx}px, ${_view.ty}px) scale(${_view.scale})`;
  }
  function clampView() {
    const stage = stageEl(); if (!stage) return;
    const w = stage.clientWidth, h = stage.clientHeight;
    const minTx = w * (1 - _view.scale), minTy = h * (1 - _view.scale);
    _view.tx = Math.min(0, Math.max(minTx, _view.tx));
    _view.ty = Math.min(0, Math.max(minTy, _view.ty));
  }
  function setScale(newScale, clientX, clientY) {
    const stage = stageEl(); if (!stage) return;
    newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
    const r = stage.getBoundingClientRect();
    const sx = (clientX == null ? r.width / 2  : clientX - r.left);
    const sy = (clientY == null ? r.height / 2 : clientY - r.top);
    const cpx = (sx - _view.tx) / _view.scale;   // point de la carte sous le curseur
    const cpy = (sy - _view.ty) / _view.scale;
    _view.scale = newScale;
    _view.tx = sx - cpx * newScale;
    _view.ty = sy - cpy * newScale;
    clampView(); applyView();
    hideTip();
  }
  function resetView() { _view.scale = 1; _view.tx = 0; _view.ty = 0; applyView(); }

  function setupZoom() {
    if (_zoomReady) return;
    const stage = stageEl(); if (!stage) return;
    _zoomReady = true;

    // Molette → zoom centré sur le curseur
    stage.addEventListener('wheel', e => {
      e.preventDefault();
      setScale(_view.scale * (e.deltaY < 0 ? 1.18 : 1 / 1.18), e.clientX, e.clientY);
    }, { passive: false });

    // Glisser (pan) + pincement (pinch) via Pointer Events
    const pts = new Map();
    let lastDist = 0, moved = false, downId = null;
    stage.addEventListener('pointerdown', e => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { stage.setPointerCapture(e.pointerId); } catch (_) {}
      stage.classList.add('jm-grabbing');
      moved = false; downId = e.pointerId;
    });
    stage.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      const prev = pts.get(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) {
        const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
        if (Math.abs(dx) + Math.abs(dy) > 2) { moved = true; hideTip(); }
        _view.tx += dx; _view.ty += dy;
        clampView(); applyView();
      } else if (pts.size === 2) {
        const a = [...pts.values()];
        const dist = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
        const mx = (a[0].x + a[1].x) / 2, my = (a[0].y + a[1].y) / 2;
        if (lastDist) setScale(_view.scale * (dist / lastDist), mx, my);
        lastDist = dist; moved = true;
      }
    });
    const release = e => {
      const wasTap = e.type === 'pointerup' && !moved && pts.size === 1;
      const tx = e.clientX, ty = e.clientY;
      pts.delete(e.pointerId);
      if (pts.size < 2) lastDist = 0;
      if (pts.size === 0) stage.classList.remove('jm-grabbing');
      if (wasTap) handleTap(tx, ty);
    };
    stage.addEventListener('pointerup', release);
    stage.addEventListener('pointercancel', release);

    // Double-clic / double-tap → bascule zoom
    stage.addEventListener('dblclick', e => {
      e.preventDefault();
      setScale(_view.scale < 2 ? 2.6 : 1, e.clientX, e.clientY);
    });

    // Boutons +/- / reset
    const bIn  = document.getElementById('map-zoom-in');
    const bOut = document.getElementById('map-zoom-out');
    const bRst = document.getElementById('map-zoom-reset');
    if (bIn)  bIn.addEventListener('click',  () => setScale(_view.scale * 1.4));
    if (bOut) bOut.addEventListener('click', () => setScale(_view.scale / 1.4));
    if (bRst) bRst.addEventListener('click', resetView);
  }

  // ── Rendu principal ──
  function renderMap() {
    const container = document.getElementById('map-canvas');
    if (!container) return;
    const score = currentScore();

    container.innerHTML = buildSvg(score);
    ensureTip(); hideTip();

    // Sous-titre : progression
    const lastIdx = lastUnlockedIndex(score);
    const sub = document.getElementById('map-progress');
    if (sub) {
      const n = lastIdx + 1;
      const cur = lastIdx >= 0 ? ISLANDS[lastIdx].name : '—';
      const nextIsl = ISLANDS[lastIdx + 1];
      sub.innerHTML = `<strong>${n} / 32 îles</strong> · ${esc(cur)}`
        + (nextIsl
            ? ` · prochaine : ${esc(nextIsl.name)} (${nextIsl.seuil.toLocaleString('fr-FR')} pts)`
            : ` · Route de Laugh Tale tracée !`);
    }

    // Interactions : survol = tooltip ; tap/clic = dossier (géré dans pointerup) ; clavier
    container.querySelectorAll('.jm-pin').forEach(g => {
      const arc = +g.getAttribute('data-arc');
      const isl = zoneByArc(arc);
      const unlocked = g.getAttribute('data-unlocked') === '1';
      const enter = () => showTip(g);
      g.addEventListener('mouseenter', enter);
      g.addEventListener('focus', enter);
      g.addEventListener('mouseleave', hideTip);
      g.addEventListener('blur', hideTip);
      g.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); unlocked ? openDossier(isl) : showTip(g); }
      });
    });
  }

  // Tap (clic sans glissement) sur une pastille → dossier si débloquée
  function handleTap(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    const pin = el && el.closest ? el.closest('.jm-pin') : null;
    if (!pin) return;
    const isl = zoneByArc(+pin.getAttribute('data-arc'));
    if (pin.getAttribute('data-unlocked') === '1') openDossier(isl);
    else showTip(pin);
  }

  // ── Ouverture / fermeture de la modal ──
  function openMap() {
    const modal = document.getElementById('map-modal');
    if (!modal) return;
    closeCharSheet(); closeDossier();  // toujours rouvrir sur la carte
    renderMap();                       // recalcul live à chaque ouverture
    modal.classList.remove('hidden');
    setupZoom();                       // attache les écouteurs (1 seule fois)
    resetView();                       // repart à l'échelle 1 à chaque ouverture
    document.body.style.overflow = 'hidden';
    const closeBtn = document.getElementById('map-close-btn');
    if (closeBtn) closeBtn.focus();
  }
  function closeMap() {
    const modal = document.getElementById('map-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    document.body.style.overflow = '';
    hideTip();
  }

  // ── B — Carnet de capture & dossier d'arc ──
  function capturedSet() {
    return new Set(safeParseJSON(lsGet(LS.captured), []));
  }
  function arcChars(arc) {
    return (typeof CHARACTERS !== 'undefined' ? CHARACTERS : []).filter(c => c.arc === arc);
  }

  function openDossier(isl) {
    const panel = document.getElementById('map-dossier');
    if (!panel || !isl) return;
    const chars = arcChars(isl.arc);
    const cap   = capturedSet();
    const nCap  = chars.filter(c => cap.has(c.name)).length;

    const cards = chars.map(c => {
      const on   = cap.has(c.name);
      const file = (typeof getImgFile === 'function') ? getImgFile(c) : null;
      const media = file
        ? `<img src="${ASSET_BASE}images/${file}.jpg" alt="" loading="lazy" draggable="false">`
        : `<div class="jm-char-noimg">☠</div>`;
      return `<div class="jm-char ${on ? 'jm-char--on' : 'jm-char--off'}"`
           + (on ? ` data-name="${esc(c.name)}" tabindex="0" role="button"` : '')
           + ` title="${on ? esc(c.name) : 'Non capturé — trouve-le en jeu pour révéler sa fiche'}">`
           + media
           + `<span class="jm-char-name">${on ? esc(c.name) : '? ? ?'}</span>`
           + `</div>`;
    }).join('');

    panel.innerHTML =
        '<div class="jm-dossier-head">'
      +   '<button class="jm-dossier-back" type="button">← Carte</button>'
      +   '<div class="jm-dossier-titles">'
      +     '<div class="jm-dossier-arc">' + (isl.arc === 0 ? 'Hors-série' : 'Arc ' + isl.arc) + '</div>'
      +     '<div class="jm-dossier-title">' + esc(isl.name) + '</div>'
      +   '</div>'
      + '</div>'
      + '<div class="jm-dossier-meta">'
      +   '<span class="jm-dossier-capture">🎯 ' + nCap + ' / ' + chars.length + ' capturés</span>'
      +   '<span class="jm-dossier-community" id="jm-community">👥 …</span>'
      + '</div>'
      + '<div class="jm-dossier-grid">'
      +   (cards || '<div class="jm-dossier-empty">Aucun personnage référencé pour cet arc.</div>')
      + '</div>';

    panel.querySelector('.jm-dossier-back').addEventListener('click', closeDossier);
    // Clic / Entrée sur un perso capturé → fiche détaillée
    const grid = panel.querySelector('.jm-dossier-grid');
    if (grid) {
      const openFromCard = card => {
        const ch = (typeof CHARACTERS !== 'undefined' ? CHARACTERS : []).find(c => c.name === card.getAttribute('data-name'));
        if (ch) openCharSheet(ch);
      };
      grid.addEventListener('click', e => {
        const card = e.target.closest && e.target.closest('.jm-char--on');
        if (card) openFromCard(card);
      });
      grid.addEventListener('keydown', e => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const card = e.target.closest && e.target.closest('.jm-char--on');
        if (card) { e.preventDefault(); openFromCard(card); }
      });
    }
    panel.scrollTop = 0;
    panel.classList.remove('hidden');
    hideTip();

    // Compteur communauté (Firebase, fire-and-forget) — sauf zone Filler (hors progression)
    const commEl = document.getElementById('jm-community');
    if (commEl && isl.arc === 0) {
      commEl.textContent = '';
    } else if (commEl && typeof fbGet === 'function') {
      fbGet('island-reach/' + isl.arc).then(v => {
        const n = parseInt(v, 10) || 0;
        commEl.textContent = n > 0
          ? `👥 ${n.toLocaleString('fr-FR')} navigateur${n > 1 ? 's ont' : ' a'} atteint cette île`
          : '👥 Sois le premier à planter ton pavillon ici';
      }).catch(() => { commEl.textContent = ''; });
    }
  }
  function closeDossier() {
    const panel = document.getElementById('map-dossier');
    if (panel) panel.classList.add('hidden');
  }

  // ── Fiche personnage (clic sur un perso capturé) ──
  function openCharSheet(c) {
    const sheet = document.getElementById('map-charsheet');
    if (!sheet || !c) return;
    const file = (typeof getImgFile === 'function') ? getImgFile(c) : null;
    const media = file
      ? `<img src="${ASSET_BASE}images/${file}.jpg" alt="${esc(c.name)}" draggable="false">`
      : `<div class="jm-cs-noimg">☠</div>`;

    // Lignes d'info réutilisant RECAP_COLS (mêmes libellés/formats que le mode Classique)
    const cols = (typeof RECAP_COLS !== 'undefined') ? RECAP_COLS : [];
    const rows = cols.map(col => {
      let val; try { val = col.fn(c); } catch (e) { val = '—'; }
      return `<div class="jm-cs-row"><span class="jm-cs-key">${esc(col.label)}</span>`
           + `<span class="jm-cs-val">${esc(String(val))}</span></div>`;
    }).join('');

    const emojis = Array.isArray(c.emoji) ? c.emoji.join(' ') : '';

    sheet.innerHTML =
        '<div class="jm-cs-head"><button class="jm-cs-back" type="button">← Retour au dossier</button></div>'
      + '<div class="jm-cs-body">'
      +   '<div class="jm-cs-media">' + media + '</div>'
      +   '<div class="jm-cs-main">'
      +     '<div class="jm-cs-name">' + esc(c.name) + '</div>'
      +     (c.epithet ? '<div class="jm-cs-epithet">« ' + esc(c.epithet) + ' »</div>' : '')
      +     '<div class="jm-cs-rows">' + rows + '</div>'
      +     (emojis ? '<div class="jm-cs-emoji" title="Indices du mode Émoji">' + emojis + '</div>' : '')
      +   '</div>'
      + '</div>';

    sheet.querySelector('.jm-cs-back').addEventListener('click', closeCharSheet);
    sheet.scrollTop = 0;
    sheet.classList.remove('hidden');
  }
  function closeCharSheet() {
    const sheet = document.getElementById('map-charsheet');
    if (sheet) sheet.classList.add('hidden');
  }

  // ── E — Compteur communauté : 1 incrément Firebase par île atteinte (1×/appareil) ──
  window.reportIslandsReached = function (score) {
    const reached = safeParseJSON(lsGet(LS.islandsReached), []);
    let changed = false;
    ISLANDS.forEach(isl => {
      if (score >= isl.seuil && reached.indexOf(isl.arc) === -1) {
        reached.push(isl.arc); changed = true;
        if (typeof fbIncrement === 'function') fbIncrement('island-reach/' + isl.arc);
      }
    });
    if (changed) lsSet(LS.islandsReached, JSON.stringify(reached));
  };

  // Fermeture : Échap (fiche → dossier → carte)
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const s = document.getElementById('map-charsheet');
    if (s && !s.classList.contains('hidden')) { closeCharSheet(); return; }
    const d = document.getElementById('map-dossier');
    if (d && !d.classList.contains('hidden')) { closeDossier(); return; }
    const m = document.getElementById('map-modal');
    if (m && !m.classList.contains('hidden')) closeMap();
  });

  // ── Exports ──
  window.openMap = openMap;
  window.closeMap = closeMap;
  window.renderGrandLineMap = renderMap;

})();
