/**
 * ads.js — Логика показа и управления рекламными баннерами
 * ──────────────────────────────────────────────────────────
 * Исправлено:
 *  - Запрос без составного индекса Firestore (фильтрация в JS)
 *  - Баннер на странице вместо всплывающей модалки
 *  - 9 пресетов позиции + перемещение стрелками + привязка координат
 *  - Предпросмотр в редакторе
 *  - Адаптив: на мобильных всегда снизу по центру
 */

const shownAdIds = new Set();

// ─────────────────────────────────────────────────────────────────
//  ПОКАЗ БАННЕРА
// ─────────────────────────────────────────────────────────────────

async function showAd(currentPage) {
  try {
    // Грузим ВСЕ объявления одним запросом без составного индекса
    const snapshot = await db.collection('ads').get();

    const candidates = [];
    snapshot.forEach(doc => {
      const ad = doc.data();
      const pageMatch = ad.showOn === 'all' || ad.showOn === currentPage;
      if (ad.active && pageMatch && !shownAdIds.has(doc.id)) {
        candidates.push({ id: doc.id, ad });
      }
    });

    if (candidates.length === 0) return;

    candidates.sort((a, b) => (b.ad.priority || 0) - (a.ad.priority || 0));
    const { id: selectedId, ad: selectedAd } = candidates[0];
    shownAdIds.add(selectedId);
    displayAdBanner(selectedAd, selectedId);
  } catch (e) {
    console.warn('Не удалось загрузить рекламу:', e);
  }
}
window.showAd = showAd;

// ─────────────────────────────────────────────────────────────────
//  ОТОБРАЖЕНИЕ БАННЕРА НА СТРАНИЦЕ
// ─────────────────────────────────────────────────────────────────

function displayAdBanner(ad, adId) {
  const old = document.getElementById('site-ad-banner');
  if (old) old.remove();

  let mediaHTML = '';
  if (ad.type === 'video') {
    mediaHTML = `<video autoplay muted loop playsinline style="max-width:100%;max-height:100%;display:block;border-radius:6px"><source src="${ad.url}" type="video/mp4"></video>`;
  } else {
    mediaHTML = `<img src="${ad.url}" alt="Реклама" style="max-width:100%;max-height:100%;display:block;border-radius:6px" onerror="this.closest('#site-ad-banner').remove()">`;
  }

  const inner = (ad.clickable && ad.link)
    ? `<div style="cursor:pointer" onclick="handleAdClick('${adId}','${escapeHtml(ad.link)}')">${mediaHTML}</div>`
    : mediaHTML;

  const banner = document.createElement('div');
  banner.id = 'site-ad-banner';
  banner.setAttribute('data-ad-id', adId);
  banner.style.cssText = `
    position:fixed; z-index:500; max-width:320px; max-height:280px;
    background:#fff; border-radius:8px;
    box-shadow:0 4px 24px rgba(28,58,94,0.18);
    overflow:hidden; transition:left 0.2s ease,top 0.2s ease;
  `;

  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
  closeBtn.style.cssText = `
    position:absolute;top:6px;right:6px;z-index:10;width:24px;height:24px;
    border-radius:50%;background:rgba(0,0,0,0.45);color:#fff;border:none;
    cursor:pointer;font-size:0.75rem;display:flex;align-items:center;justify-content:center;
  `;
  closeBtn.onclick = () => banner.remove();

  banner.innerHTML = inner;
  banner.appendChild(closeBtn);
  document.body.appendChild(banner);
  applyBannerPosition(banner, ad);
}

function applyBannerPosition(banner, ad) {
  const isMobile = window.innerWidth < 600;
  if (isMobile) {
    banner.style.bottom    = '12px';
    banner.style.top       = 'auto';
    banner.style.left      = '50%';
    banner.style.right     = 'auto';
    banner.style.transform = 'translateX(-50%)';
    banner.style.maxWidth  = 'calc(100vw - 24px)';
    return;
  }
  banner.style.transform = '';
  banner.style.bottom = 'auto';
  if (ad.posX !== undefined && ad.posY !== undefined) {
    banner.style.left  = ad.posX + 'px';
    banner.style.top   = ad.posY + 'px';
    banner.style.right = 'auto';
    return;
  }
  applyPositionPresetToEl(banner, ad.position || 'bottom-right');
}

function applyPositionPresetToEl(el, preset) {
  const g = 16;
  el.style.transform = '';
  const p = {
    'top-left':      [g+'px', 'auto', 'auto', g+'px', ''],
    'top-center':    [g+'px', 'auto', 'auto', '50%', 'translateX(-50%)'],
    'top-right':     [g+'px', g+'px', 'auto', 'auto', ''],
    'middle-left':   ['50%', 'auto', 'auto', g+'px', 'translateY(-50%)'],
    'center':        ['50%', 'auto', 'auto', '50%', 'translate(-50%,-50%)'],
    'middle-right':  ['50%', g+'px', 'auto', 'auto', 'translateY(-50%)'],
    'bottom-left':   ['auto', 'auto', g+'px', g+'px', ''],
    'bottom-center': ['auto', 'auto', g+'px', '50%', 'translateX(-50%)'],
    'bottom-right':  ['auto', g+'px', g+'px', 'auto', ''],
  }[preset] || ['auto', g+'px', g+'px', 'auto', ''];
  [el.style.top, el.style.right, el.style.bottom, el.style.left, el.style.transform] = p;
}
window.applyPositionPresetToEl = applyPositionPresetToEl;

// ─────────────────────────────────────────────────────────────────
//  КЛИК ПО РЕКЛАМЕ
// ─────────────────────────────────────────────────────────────────

async function handleAdClick(adId, link) {
  window.open(link, '_blank', 'noopener,noreferrer');
  try {
    const todayStr = formatFullDate(new Date());
    const inc = firebase.firestore.FieldValue.increment(1);
    await db.collection('statistics').doc('counters').set({ adClicks: { [adId]: inc } }, { merge: true });
    await db.collection('statistics').doc('daily').collection('daily').doc(todayStr).set({ adClicks: { [adId]: inc } }, { merge: true });
  } catch (e) { console.warn('Клик не записан:', e); }
}
window.handleAdClick = handleAdClick;

// ─────────────────────────────────────────────────────────────────
//  РЕДАКТОР ПОЗИЦИИ
// ─────────────────────────────────────────────────────────────────

window._editorPreset  = 'bottom-right';
window._editorOffsetX = 0;
window._editorOffsetY = 0;

window.openPositionEditor = async function(adId) {
  let ad = null;
  try {
    const doc = await db.collection('ads').doc(adId).get();
    if (!doc.exists) { showToast('Объявление не найдено','error'); return; }
    ad = doc.data();
  } catch(e) { showToast('Ошибка загрузки','error'); return; }

  window._editorPreset  = ad.position || 'bottom-right';
  window._editorOffsetX = 0;
  window._editorOffsetY = 0;
  const hasPinned = ad.posX !== undefined && ad.posY !== undefined;

  const presets = [
    ['top-left','↖ Лево-верх'],['top-center','↑ Верх-центр'],['top-right','↗ Право-верх'],
    ['middle-left','← Лево-центр'],['center','⊙ По центру'],['middle-right','→ Право-центр'],
    ['bottom-left','↙ Лево-низ'],['bottom-center','↓ Низ-центр'],['bottom-right','↘ Право-низ'],
  ];

  openModal(`
    <h2 class="modal-title">
      <i class="fa-solid fa-arrows-up-down-left-right"></i>
      Позиция баннера: ${escapeHtml(ad.title || '')}
    </h2>

    <div class="form-label" style="margin-bottom:8px"><i class="fa-solid fa-th"></i> Пресет позиции</div>
    <div class="position-grid" id="position-grid">
      ${presets.map(([key, label]) => `
        <button class="pos-preset-btn ${window._editorPreset===key?'active':''}" data-preset="${key}"
                title="${label}" onclick="editorApplyPreset('${key}')">
          ${label.split(' ')[0]}
        </button>`).join('')}
    </div>

    <div class="form-label" style="margin:14px 0 8px"><i class="fa-solid fa-eye"></i> Предпросмотр</div>
    <div id="ad-preview-area" style="
      position:relative;width:100%;height:200px;
      background:linear-gradient(135deg,#1C3A5E 0%,#2B5B84 100%);
      border-radius:8px;overflow:hidden;border:2px solid var(--clr-border);">
      <div style="position:absolute;top:0;left:0;right:0;height:26px;background:rgba(0,0,0,0.2);
        display:flex;align-items:center;padding:0 10px;font-size:0.6rem;color:rgba(255,255,255,0.8)">
        <i class="fa-solid fa-calendar-star" style="margin-right:4px;color:#C9A84C"></i>Праздничный Календарь
      </div>
      <div id="preview-banner" style="
        position:absolute;background:#fff;border-radius:5px;
        box-shadow:0 2px 10px rgba(0,0,0,0.3);padding:6px 10px;
        font-size:0.65rem;font-weight:600;color:#1C3A5E;white-space:nowrap;
        transition:left 0.15s,top 0.15s,right 0.15s,bottom 0.15s;pointer-events:none;">
        <i class="fa-solid fa-rectangle-ad" style="color:#C9A84C;margin-right:3px"></i>${escapeHtml(ad.title||'Баннер')}
      </div>
    </div>

    <div class="form-label" style="margin:14px 0 8px"><i class="fa-solid fa-gamepad"></i> Точное смещение (по 10px)</div>
    <div class="arrow-pad">
      <div></div>
      <button class="arrow-btn" onclick="editorMove(0,-10)" title="Вверх"><i class="fa-solid fa-chevron-up"></i></button>
      <div></div>
      <button class="arrow-btn" onclick="editorMove(-10,0)" title="Влево"><i class="fa-solid fa-chevron-left"></i></button>
      <button class="arrow-btn center-btn" onclick="editorApplyPreset('center')" title="По центру"><i class="fa-solid fa-crosshairs"></i></button>
      <button class="arrow-btn" onclick="editorMove(10,0)" title="Вправо"><i class="fa-solid fa-chevron-right"></i></button>
      <div></div>
      <button class="arrow-btn" onclick="editorMove(0,10)" title="Вниз"><i class="fa-solid fa-chevron-down"></i></button>
      <div></div>
    </div>

    <div id="pin-status" style="
      margin-top:14px;padding:10px 14px;border-radius:6px;font-size:0.82rem;
      background:${hasPinned?'rgba(201,168,76,0.1)':'var(--clr-surface-2)'};
      color:var(--clr-text-muted);display:flex;align-items:center;gap:8px;">
      <i class="fa-solid fa-thumbtack" id="pin-icon" style="color:${hasPinned?'#C9A84C':'inherit'}"></i>
      <span id="pin-text">${hasPinned?`Привязана: X=${ad.posX}px Y=${ad.posY}px`:`Пресет: <b>${window._editorPreset}</b>`}</span>
    </div>

    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px;flex-wrap:wrap">
      <button class="btn btn-outline-dark btn-sm" onclick="editorClearPin('${adId}')">
        <i class="fa-solid fa-rotate-left"></i> Сбросить
      </button>
      <button class="btn btn-outline-dark" onclick="openManageAdsModal()">
        <i class="fa-solid fa-arrow-left"></i> Назад
      </button>
      <button class="btn btn-primary" onclick="editorSavePin('${adId}')">
        <i class="fa-solid fa-thumbtack"></i> Привязать позицию
      </button>
    </div>
  `);

  // Рендерим превью после добавления в DOM
  setTimeout(() => editorApplyPreset(window._editorPreset), 50);
};

window.editorApplyPreset = function(preset) {
  window._editorPreset  = preset;
  window._editorOffsetX = 0;
  window._editorOffsetY = 0;
  refreshEditorPreview();
  document.querySelectorAll('.pos-preset-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.preset === preset);
  });
  const text = document.getElementById('pin-text');
  if (text) text.innerHTML = `Пресет: <b>${preset}</b>. Нажмите «Привязать позицию».`;
};

window.editorMove = function(dx, dy) {
  window._editorOffsetX += dx;
  window._editorOffsetY += dy;
  refreshEditorPreview();
  const text = document.getElementById('pin-text');
  if (text) {
    const ox = window._editorOffsetX, oy = window._editorOffsetY;
    text.innerHTML = `Пресет <b>${window._editorPreset}</b> + смещение (${ox>0?'+':''}${ox}px, ${oy>0?'+':''}${oy}px)`;
  }
};

function refreshEditorPreview() {
  const preview = document.getElementById('preview-banner');
  const area    = document.getElementById('ad-preview-area');
  if (!preview || !area) return;

  const aW = area.offsetWidth  || 300;
  const aH = area.offsetHeight || 200;
  const pW = preview.offsetWidth  || 100;
  const pH = preview.offsetHeight || 30;
  const g  = 6;
  const ox = window._editorOffsetX || 0;
  const oy = window._editorOffsetY || 0;

  const map = {
    'top-left':      [g+oy, 'auto', 'auto', g+ox],
    'top-center':    [g+oy, 'auto', 'auto', (aW-pW)/2+ox],
    'top-right':     [g+oy, 'auto', 'auto', aW-pW-g+ox],
    'middle-left':   [(aH-pH)/2+oy, 'auto', 'auto', g+ox],
    'center':        [(aH-pH)/2+oy, 'auto', 'auto', (aW-pW)/2+ox],
    'middle-right':  [(aH-pH)/2+oy, 'auto', 'auto', aW-pW-g+ox],
    'bottom-left':   [aH-pH-g+oy, 'auto', 'auto', g+ox],
    'bottom-center': [aH-pH-g+oy, 'auto', 'auto', (aW-pW)/2+ox],
    'bottom-right':  [aH-pH-g+oy, 'auto', 'auto', aW-pW-g+ox],
  };
  const [t,r,b,l] = map[window._editorPreset] || map['bottom-right'];
  preview.style.top    = (typeof t==='number' ? t+'px' : t);
  preview.style.right  = (typeof r==='number' ? r+'px' : r);
  preview.style.bottom = (typeof b==='number' ? b+'px' : b);
  preview.style.left   = (typeof l==='number' ? l+'px' : l);
  preview.style.transform = '';
}

window.editorSavePin = async function(adId) {
  try {
    const preview = document.getElementById('preview-banner');
    const area    = document.getElementById('ad-preview-area');
    if (!preview || !area) return;

    const scaleX = window.innerWidth  / (area.offsetWidth  || 300);
    const scaleY = window.innerHeight / (area.offsetHeight || 200);
    const realX  = Math.round(parseFloat(preview.style.left || 0) * scaleX);
    const realY  = Math.round(parseFloat(preview.style.top  || 0) * scaleY);

    await db.collection('ads').doc(adId).update({
      posX: realX, posY: realY, position: window._editorPreset
    });

    // Обновить живой баннер если есть
    const live = document.getElementById('site-ad-banner');
    if (live && live.dataset.adId === adId) {
      live.style.left = realX+'px'; live.style.top = realY+'px';
      live.style.right = 'auto'; live.style.bottom = 'auto'; live.style.transform = '';
    }

    const icon = document.getElementById('pin-icon');
    const text = document.getElementById('pin-text');
    const status = document.getElementById('pin-status');
    if (icon) icon.style.color = '#C9A84C';
    if (status) status.style.background = 'rgba(201,168,76,0.1)';
    if (text) text.innerHTML = `Привязана: X=${realX}px, Y=${realY}px`;
    showToast('Позиция баннера сохранена!', 'success');
  } catch(e) {
    showToast('Ошибка сохранения позиции','error');
  }
};

window.editorClearPin = async function(adId) {
  try {
    await db.collection('ads').doc(adId).update({
      posX: firebase.firestore.FieldValue.delete(),
      posY: firebase.firestore.FieldValue.delete(),
      position: window._editorPreset || 'bottom-right',
    });
    window._editorOffsetX = 0; window._editorOffsetY = 0;
    const text = document.getElementById('pin-text');
    const icon = document.getElementById('pin-icon');
    if (text) text.innerHTML = `Привязка сброшена. Пресет: <b>${window._editorPreset}</b>`;
    if (icon) icon.style.color = 'inherit';
    showToast('Привязка сброшена','success');
  } catch(e) { showToast('Ошибка сброса','error'); }
};
