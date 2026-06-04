// ===== P2 — SHARE IMAGE CANVAS =====
// Génère un PNG 800×500 récapitulant la journée.
// Accède aux globals d'app.js : MODES, safeParseJSON, lsGet, LS, todayKey,
// TARGET_C, getImgFile, getRankFromScore, loadStats, sanitizeNum, getTodayBirthdays.
// Filigrane : pavillon perso via jolly-roger.js (buildJollyRoger, computeDeviceFingerprint),
// avec fallback sur images/jolly_roger.png si le script n'est pas chargé.

// Charge une image en promesse (renvoie null si erreur, pour ne pas bloquer)
async function _csLoadImg(src) {
  return new Promise(res => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload  = () => res(i);
    i.onerror = () => res(null);
    i.src = src;
  });
}

async function generateShareCanvas() {
  const W = 800, H = 500;
  const cvs = document.createElement('canvas');
  cvs.width = W; cvs.height = H;
  const ctx = cvs.getContext('2d');

  // ── Palette ──
  const GOLD  = '#c89408';
  const GOLDB = '#ffd84d';
  const BG1   = '#060d1c';
  const BG2   = '#02080f';
  const TXT   = '#e8d5b0';
  const TDIM  = 'rgba(232,213,176,0.45)';

  // Attendre les fonts (Barlow Condensed + Cinzel Decorative déjà chargées par la page)
  await document.fonts.ready;
  // Pré-chauffer : certains navigateurs n'activent pas les fonts en Canvas sans un premier fillText
  ctx.font = '700 1px "Barlow Condensed"';  ctx.fillText('_', -9, -9);
  ctx.font = '700 1px "Cinzel Decorative"'; ctx.fillText('_', -9, -9);

  // ── 1. Background ──
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, BG1); bgGrad.addColorStop(1, BG2);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // ── 2. Pavillon perso du joueur en filigrane (côté droit, sans spoil) ──
  // Badge Jolly Roger procédural (SVG, déterministe par appareil) rasterisé sur le canvas.
  // Fallback sur le pavillon Mugiwara si jolly-roger.js n'est pas chargé.
  let jrImg = null, jrAlpha = 0.16;
  try {
    if (window.buildJollyRoger && window.computeDeviceFingerprint) {
      const svg = buildJollyRoger(computeDeviceFingerprint()).svg
        .replace('width="100%" height="100%"', 'width="320" height="320"');
      jrImg = await _csLoadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
    }
  } catch (e) { jrImg = null; }
  if (!jrImg) { jrImg = await _csLoadImg('images/jolly_roger.png'); jrAlpha = 0.06; }
  if (jrImg) {
    const size = 300;
    const dx = W - size - 60;
    const dy = (H - size) / 2;
    ctx.save();
    ctx.globalAlpha = jrAlpha;
    ctx.drawImage(jrImg, dx, dy, size, size);
    ctx.restore();
  }

  // ── 3. Bandes dorées top / bottom ──
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, 0, W, 3);
  ctx.fillRect(0, H - 3, W, 3);

  const LX = 44;   // left margin
  const RX = 510;  // bord droit de la zone texte

  // ── 4. En-tête : Logo + Date ──
  ctx.font = '700 28px "Cinzel Decorative", serif';
  ctx.fillStyle = GOLDB;
  ctx.textAlign = 'left';
  ctx.fillText('⚓ LogPose', LX, 52);

  const dk = todayKey();
  const [yy, mm, dd] = dk.split('-');
  ctx.font = '600 15px "Barlow Condensed", sans-serif';
  ctx.fillStyle = TDIM;
  ctx.textAlign = 'right';
  ctx.fillText(`${dd}/${mm}/${yy}`, RX, 52);

  // ── 5. Séparateur haut ──
  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = GOLD; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(LX, 68); ctx.lineTo(RX, 68); ctx.stroke();
  ctx.restore();

  // ── 6. Lignes par mode ──
  const scores  = safeParseJSON(lsGet(LS.score(dk)),  {});
  const results = safeParseJSON(lsGet(LS.result(dk)), {});
  let ry = 102;

  MODES.forEach(({ id, icon }) => {
    const res = results[id];
    const pts = sanitizeNum(scores[id]);

    // Icône du mode
    ctx.font = '21px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = TXT;
    ctx.fillText(icon, LX, ry);

    if (!res) {
      // Non joué
      ctx.font = '500 18px "Barlow Condensed", sans-serif';
      ctx.fillStyle = TDIM;
      ctx.fillText('—  Non joué', LX + 38, ry);
    } else if (res.won) {
      // Victoire
      ctx.font = '20px sans-serif';
      ctx.fillText('✅', LX + 36, ry);
      const essai = res.tries === 1 ? 'essai' : 'essais';
      ctx.font = '600 18px "Barlow Condensed", sans-serif';
      ctx.fillStyle = TXT;
      ctx.fillText(`${res.tries} ${essai}`, LX + 74, ry);
      ctx.font = '700 18px "Barlow Condensed", sans-serif';
      ctx.fillStyle = GOLDB;
      ctx.textAlign = 'right';
      ctx.fillText(`${pts.toLocaleString('fr-FR')} pts`, RX, ry);
    } else {
      // Défaite
      ctx.font = '20px sans-serif';
      ctx.fillText('❌', LX + 36, ry);
      ctx.font = '500 18px "Barlow Condensed", sans-serif';
      ctx.fillStyle = TDIM;
      ctx.fillText('0 pts', LX + 74, ry);
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = TXT;
    ry += 36;
  });

  // ── 7. Séparateur bas ──
  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = GOLD; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(LX, ry + 4); ctx.lineTo(RX, ry + 4); ctx.stroke();
  ctx.restore();
  ry += 20;

  // ── 8. Score total ──
  const total = Object.values(scores).reduce((a, b) => a + sanitizeNum(b), 0);
  ctx.font = '700 24px "Barlow Condensed", sans-serif';
  ctx.fillStyle = GOLDB;
  ctx.textAlign = 'left';
  ctx.fillText(`⭐ ${total.toLocaleString('fr-FR')} / 70 000 pts`, LX, ry + 22);
  ry += 38;

  // ── 9. Rang + Série ──
  const cumul  = sanitizeNum(lsGet(LS.cumulativeScore));
  const { emoji: re, title: rt } = getRankFromScore(cumul);
  const streak = sanitizeNum(loadStats('classic').currentStreak);
  ctx.font = '600 19px "Barlow Condensed", sans-serif';
  ctx.fillStyle = TXT;
  ctx.fillText(`${re} ${rt}   ·   🔥 Série ${streak}j`, LX, ry + 20);
  ry += 34;

  // ── 10. Anniversaire (si applicable) ──
  const bdays = getTodayBirthdays();
  if (bdays.length) {
    const names = bdays.map(c => c.name).join(' & ');
    ctx.font = '600 17px "Barlow Condensed", sans-serif';
    ctx.fillStyle = '#ff85c2';
    ctx.fillText(`🎂 Anniversaire de ${names} !`, LX, ry + 18);
  }

  // ── 11. URL ──
  ctx.font = '400 13px "Barlow Condensed", sans-serif';
  ctx.fillStyle = TDIM;
  ctx.textAlign = 'center';
  ctx.fillText('onepiecedle.fr', W / 2, H - 14);

  return cvs;
}

// ── Blob courant (partagé entre download et share natif) ──
let _shareBlob = null;

async function shareImage() {
  const btn = document.getElementById('share-via-image-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ ...'; }

  try {
    const cvs  = await generateShareCanvas();
    const blob = await new Promise(res => cvs.toBlob(res, 'image/png'));
    _shareBlob = blob;

    // Afficher la preview dans le popup
    const wrap = document.getElementById('share-canvas-wrap');
    const prev = document.getElementById('share-canvas-img');
    if (wrap && prev) {
      prev.src = cvs.toDataURL('image/png');
      wrap.style.display = 'block';
      wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Afficher / masquer le bouton "Partager" selon support
    const nativeBtn = document.getElementById('share-canvas-native-btn');
    if (nativeBtn) {
      const file = new File([blob], `logpose-${todayKey()}.png`, { type: 'image/png' });
      nativeBtn.style.display = (navigator.canShare && navigator.canShare({ files: [file] }))
        ? 'flex' : 'none';
    }

  } catch(e) {
    if (e?.name !== 'AbortError') console.warn('[canvas-share]', e);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🖼️ Image'; }
  }
}

function downloadShareImage() {
  if (!_shareBlob) return;
  const url = URL.createObjectURL(_shareBlob);
  const a   = document.createElement('a');
  a.href = url; a.download = `logpose-${todayKey()}.png`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

async function shareImageNative() {
  if (!_shareBlob) return;
  const file = new File([_shareBlob], `logpose-${todayKey()}.png`, { type: 'image/png' });
  try {
    await navigator.share({ files: [file], title: 'LogPose' });
  } catch(e) {
    if (e?.name !== 'AbortError') downloadShareImage(); // fallback silencieux
  }
}

function hideCanvasPreview() {
  const wrap = document.getElementById('share-canvas-wrap');
  if (wrap) wrap.style.display = 'none';
  _shareBlob = null;
}
