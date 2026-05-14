/**
 * admin.js — Административные функции
 * ──────────────────────────────────────
 * Изменения:
 *  - Кнопка «Позиция баннера» в таблице объявлений → открывает редактор из ads.js
 *  - Сброс eventEntryCount при открытии модалки (фикс дублирования)
 *  - Все прочие CRUD функции без изменений
 */

// ═══════════════════════════════════════════════════════════════
//  ПРАЗДНИКИ
// ═══════════════════════════════════════════════════════════════

function openAddHolidayModal(prefillDate) {
  // Сбрасываем счётчик блоков событий при каждом открытии
  eventEntryCount = 1;

  const today = new Date();
  const yyyy  = today.getFullYear();
  let defaultDate = `${yyyy}-${today.toISOString().slice(5, 10)}`;

  if (prefillDate) {
    defaultDate = `${yyyy}-${prefillDate}`;
  }

  const html = `
    <h2 class="modal-title">
      <i class="fa-solid fa-calendar-plus"></i>
      Добавить праздник
    </h2>
    <div class="form-group">
      <label class="form-label" for="add-date">
        <i class="fa-solid fa-calendar-day"></i> Дата
      </label>
      <input type="date" id="add-date" class="form-input" value="${defaultDate}" required>
    </div>
    <div id="events-container">
      ${buildEventEntryHTML(0)}
    </div>
    <button class="btn btn-outline-dark btn-sm" style="margin-bottom:20px" onclick="addEventEntry()">
      <i class="fa-solid fa-plus"></i> Добавить ещё событие
    </button>
    <div id="add-holiday-error" class="form-error" style="margin-bottom:12px;display:none"></div>
    <div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn btn-outline-dark" onclick="closeModal()">Отмена</button>
      <button class="btn btn-primary" onclick="saveNewHoliday()">
        <i class="fa-solid fa-floppy-disk"></i> Сохранить
      </button>
    </div>
  `;
  openModal(html);
}
window.openAddHolidayModal = openAddHolidayModal;

function buildEventEntryHTML(index, ev) {
  ev = ev || {};
  return `
    <div class="event-entry" id="event-entry-${index}">
      <div class="event-entry-header">
        <span class="event-entry-title">
          <i class="fa-solid fa-star"></i> Событие ${index + 1}
        </span>
        ${index > 0 ? `<button class="btn-icon danger" onclick="removeEventEntry(${index})" title="Удалить">
          <i class="fa-solid fa-xmark"></i>
        </button>` : ''}
      </div>
      <div class="form-group">
        <label class="form-label" for="ev-title-${index}">
          <i class="fa-solid fa-tag"></i> Название
        </label>
        <input type="text" id="ev-title-${index}" class="form-input"
               placeholder="Название праздника" value="${escapeHtml(ev.title || '')}" required>
      </div>
      <div class="form-group">
        <label class="form-label" for="ev-type-${index}">
          <i class="fa-solid fa-layer-group"></i> Тип
        </label>
        <select id="ev-type-${index}" class="form-input">
          <option value="official"      ${ev.type==='official'?'selected':''}>Официальный</option>
          <option value="folk"          ${ev.type==='folk'?'selected':''}>Народный</option>
          <option value="international" ${ev.type==='international'?'selected':''}>Международный</option>
          <option value="fun"           ${ev.type==='fun'?'selected':''}>Необычный</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="ev-desc-${index}">
          <i class="fa-solid fa-align-left"></i> Описание (необязательно)
        </label>
        <textarea id="ev-desc-${index}" class="form-input" rows="2"
                  placeholder="Краткое описание">${escapeHtml(ev.description || '')}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label" for="ev-emoji-${index}">
          <i class="fa-regular fa-face-smile"></i> Эмодзи (1-2 символа)
        </label>
        <input type="text" id="ev-emoji-${index}" class="form-input"
               placeholder="🎉" maxlength="4" value="${ev.emoji || ''}" style="max-width:90px">
      </div>
    </div>
  `;
}

let eventEntryCount = 1;

function addEventEntry() {
  const container = document.getElementById('events-container');
  if (!container) return;
  const div = document.createElement('div');
  div.innerHTML = buildEventEntryHTML(eventEntryCount);
  container.appendChild(div.firstElementChild);
  eventEntryCount++;
}
window.addEventEntry = addEventEntry;

function removeEventEntry(index) {
  const entry = document.getElementById(`event-entry-${index}`);
  if (entry) entry.remove();
}
window.removeEventEntry = removeEventEntry;

async function saveNewHoliday() {
  const dateInput = document.getElementById('add-date');
  const errorEl   = document.getElementById('add-holiday-error');
  errorEl.style.display = 'none';

  if (!dateInput || !dateInput.value) {
    showFieldError(errorEl, 'Выберите дату'); return;
  }

  const parts   = dateInput.value.split('-');
  const dateKey = `${parts[1]}-${parts[2]}`;

  const entries = document.querySelectorAll('.event-entry');
  const events  = [];

  for (const entry of entries) {
    const idx   = entry.id.replace('event-entry-', '');
    const title = document.getElementById(`ev-title-${idx}`)?.value?.trim();
    if (!title) {
      showFieldError(errorEl, 'Заполните название для всех событий'); return;
    }
    events.push({
      title,
      type:        document.getElementById(`ev-type-${idx}`)?.value || 'fun',
      description: document.getElementById(`ev-desc-${idx}`)?.value?.trim() || '',
      emoji:       document.getElementById(`ev-emoji-${idx}`)?.value?.trim() || '',
    });
  }

  if (events.length === 0) {
    showFieldError(errorEl, 'Добавьте хотя бы одно событие'); return;
  }

  try {
    const docRef = db.collection('holidays').doc(dateKey);
    const doc    = await docRef.get();
    if (doc.exists) {
      const existing = doc.data().events || [];
      await docRef.update({
        events: [...existing, ...events],
        lastModified: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      await docRef.set({
        events,
        lastModified: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }
    closeModal();
    showToast('Праздник успешно добавлен', 'success');
    const todayKey = formatDateKey(new Date());
    if (dateKey === todayKey) renderHome();
    if (typeof holidayCache !== 'undefined') delete holidayCache[dateKey];
  } catch (e) {
    console.error('Ошибка сохранения:', e);
    showFieldError(errorEl, 'Ошибка сохранения. Проверьте права доступа.');
  }
}
window.saveNewHoliday = saveNewHoliday;

async function openEditHolidayModal(dateKey, eventIndex) {
  let ev = null;
  try {
    const doc = await db.collection('holidays').doc(dateKey).get();
    if (doc.exists) ev = (doc.data().events || [])[eventIndex];
  } catch (e) {
    showToast('Не удалось загрузить данные', 'error'); return;
  }
  if (!ev) { showToast('Событие не найдено', 'error'); return; }

  openModal(`
    <h2 class="modal-title">
      <i class="fa-solid fa-pen-to-square"></i>
      Редактировать событие
    </h2>
    <p class="text-muted" style="margin-bottom:20px">
      <i class="fa-regular fa-calendar"></i>
      Дата: ${dateKey.split('-').reverse().join('.')}
    </p>
    ${buildEventEntryHTML(0, ev)}
    <div id="edit-holiday-error" class="form-error" style="margin-bottom:12px;display:none"></div>
    <div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn btn-outline-dark" onclick="closeModal()">Отмена</button>
      <button class="btn btn-primary" onclick="saveEditedHoliday('${dateKey}',${eventIndex})">
        <i class="fa-solid fa-floppy-disk"></i> Сохранить
      </button>
    </div>
  `);
}
window.openEditHolidayModal = openEditHolidayModal;

async function saveEditedHoliday(dateKey, eventIndex) {
  const errorEl = document.getElementById('edit-holiday-error');
  errorEl.style.display = 'none';
  const title = document.getElementById('ev-title-0')?.value?.trim();
  if (!title) { showFieldError(errorEl, 'Название не может быть пустым'); return; }

  const updatedEvent = {
    title,
    type:        document.getElementById('ev-type-0')?.value || 'fun',
    description: document.getElementById('ev-desc-0')?.value?.trim() || '',
    emoji:       document.getElementById('ev-emoji-0')?.value?.trim() || '',
  };

  try {
    const docRef = db.collection('holidays').doc(dateKey);
    const doc    = await docRef.get();
    if (!doc.exists) { showFieldError(errorEl, 'Документ не найден'); return; }
    const events = doc.data().events || [];
    events[eventIndex] = updatedEvent;
    await docRef.update({ events, lastModified: firebase.firestore.FieldValue.serverTimestamp() });
    closeModal();
    showToast('Событие обновлено', 'success');
    if (typeof holidayCache !== 'undefined') delete holidayCache[dateKey];
    if (dateKey === formatDateKey(new Date())) renderHome();
  } catch (e) {
    showFieldError(errorEl, 'Ошибка сохранения');
  }
}
window.saveEditedHoliday = saveEditedHoliday;

function confirmDeleteEvent(dateKey, eventIndex) {
  openModal(`
    <h2 class="modal-title">
      <i class="fa-solid fa-triangle-exclamation" style="color:var(--clr-danger)"></i>
      Удалить событие?
    </h2>
    <p style="margin-bottom:24px;line-height:1.6">Это действие необратимо.</p>
    <div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn btn-outline-dark" onclick="closeModal()">Отмена</button>
      <button class="btn btn-danger" onclick="deleteEvent('${dateKey}',${eventIndex})">
        <i class="fa-solid fa-trash"></i> Удалить
      </button>
    </div>
  `);
}
window.confirmDeleteEvent = confirmDeleteEvent;

async function deleteEvent(dateKey, eventIndex) {
  try {
    const docRef = db.collection('holidays').doc(dateKey);
    const doc    = await docRef.get();
    if (!doc.exists) { closeModal(); return; }
    let events = doc.data().events || [];
    events.splice(eventIndex, 1);
    if (events.length === 0) {
      await docRef.delete();
    } else {
      await docRef.update({ events, lastModified: firebase.firestore.FieldValue.serverTimestamp() });
    }
    closeModal();
    showToast('Событие удалено', 'success');
    if (typeof holidayCache !== 'undefined') delete holidayCache[dateKey];
    if (dateKey === formatDateKey(new Date())) renderHome();
  } catch (e) {
    showToast('Ошибка удаления', 'error');
  }
}
window.deleteEvent = deleteEvent;

// ═══════════════════════════════════════════════════════════════
//  РЕКЛАМА
// ═══════════════════════════════════════════════════════════════

async function openManageAdsModal() {
  openModal(`
    <h2 class="modal-title">
      <i class="fa-solid fa-rectangle-ad"></i>
      Управление рекламой
    </h2>
    <div id="ads-list-container">
      <p class="text-muted"><i class="fa-solid fa-spinner fa-spin"></i> Загрузка...</p>
    </div>
    <button class="btn btn-primary" style="margin-top:16px" onclick="openAddAdModal()">
      <i class="fa-solid fa-plus"></i> Добавить объявление
    </button>
  `);
  await loadAdsList();
}
window.openManageAdsModal = openManageAdsModal;

async function loadAdsList() {
  const container = document.getElementById('ads-list-container');
  if (!container) return;
  try {
    // Грузим без orderBy — не требует индекса
    const snapshot = await db.collection('ads').get();
    if (snapshot.empty) {
      container.innerHTML = `<p class="text-muted">Объявлений ещё нет.</p>`; return;
    }

    // Сортируем в JS по приоритету
    const docs = [];
    snapshot.forEach(doc => docs.push({ id: doc.id, data: doc.data() }));
    docs.sort((a, b) => (b.data.priority || 0) - (a.data.priority || 0));

    let rows = '';
    docs.forEach(({ id, data: ad }) => {
      const posLabel = ad.posX !== undefined
        ? `<span style="color:var(--clr-accent-2);font-size:0.75rem"><i class="fa-solid fa-thumbtack"></i> X${ad.posX} Y${ad.posY}</span>`
        : `<span style="font-size:0.75rem;color:var(--clr-text-muted)">${ad.position||'bottom-right'}</span>`;

      rows += `
        <tr>
          <td>
            <span class="ad-status ${ad.active?'active':'inactive'}"></span>
            ${escapeHtml(ad.title)}
          </td>
          <td>${escapeHtml(ad.type)}</td>
          <td>${ad.priority||1}</td>
          <td>${posLabel}</td>
          <td>
            <div style="display:flex;gap:4px;flex-wrap:wrap">
              <button class="btn-icon" title="Позиция" onclick="openPositionEditor('${id}')">
                <i class="fa-solid fa-arrows-up-down-left-right"></i>
              </button>
              <button class="btn-icon" title="Редактировать" onclick="openEditAdModal('${id}')">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
              <button class="btn-icon danger" title="Удалить" onclick="confirmDeleteAd('${id}')">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>`;
    });

    container.innerHTML = `
      <div style="overflow-x:auto">
        <table class="ads-table">
          <thead>
            <tr>
              <th>Название</th><th>Тип</th><th>Приоритет</th><th>Позиция</th><th>Действия</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  } catch (e) {
    container.innerHTML = `<p class="form-error">Ошибка загрузки</p>`;
  }
}

function openAddAdModal() { openModal(buildAdFormHTML('add')); }
window.openAddAdModal = openAddAdModal;

async function openEditAdModal(adId) {
  let ad = {};
  try {
    const doc = await db.collection('ads').doc(adId).get();
    if (doc.exists) ad = doc.data();
  } catch (e) { showToast('Не удалось загрузить','error'); return; }
  openModal(buildAdFormHTML('edit', adId, ad));
}
window.openEditAdModal = openEditAdModal;

function buildAdFormHTML(mode, adId, ad) {
  ad = ad || {};
  return `
    <h2 class="modal-title">
      <i class="fa-solid fa-rectangle-ad"></i>
      ${mode==='add'?'Добавить объявление':'Редактировать объявление'}
    </h2>
    <div class="form-group">
      <label class="form-label"><i class="fa-solid fa-heading"></i> Название</label>
      <input type="text" id="ad-title" class="form-input" value="${escapeHtml(ad.title||'')}" placeholder="Баннер март">
    </div>
    <div class="form-group">
      <label class="form-label"><i class="fa-solid fa-photo-film"></i> Тип медиа</label>
      <select id="ad-type" class="form-input">
        <option value="image" ${ad.type==='image'?'selected':''}>Изображение</option>
        <option value="gif"   ${ad.type==='gif'?'selected':''}>GIF-анимация</option>
        <option value="video" ${ad.type==='video'?'selected':''}>Видео (mp4)</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label"><i class="fa-solid fa-link"></i> URL медиафайла</label>
      <input type="url" id="ad-url" class="form-input" value="${escapeHtml(ad.url||'')}" placeholder="https://...">
    </div>
    <div class="form-group">
      <label class="form-check">
        <input type="checkbox" id="ad-clickable" ${ad.clickable?'checked':''}
               onchange="document.getElementById('ad-link-group').style.display=this.checked?'block':'none'">
        Кликабельная (переход по ссылке)
      </label>
    </div>
    <div class="form-group" id="ad-link-group" style="display:${ad.clickable?'block':'none'}">
      <label class="form-label"><i class="fa-solid fa-arrow-up-right-from-square"></i> Ссылка перехода</label>
      <input type="url" id="ad-link" class="form-input" value="${escapeHtml(ad.link||'')}" placeholder="https://...">
    </div>
    <div class="form-group">
      <label class="form-label"><i class="fa-solid fa-display"></i> Страницы показа</label>
      <select id="ad-show-on" class="form-input">
        <option value="all"      ${ad.showOn==='all'?'selected':''}>Все страницы</option>
        <option value="home"     ${ad.showOn==='home'?'selected':''}>Только главная</option>
        <option value="calendar" ${ad.showOn==='calendar'?'selected':''}>Только календарь</option>
      </select>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div class="form-group">
        <label class="form-label"><i class="fa-solid fa-arrow-up-9-1"></i> Приоритет</label>
        <input type="number" id="ad-priority" class="form-input" value="${ad.priority||1}" min="1" max="100">
      </div>
      <div class="form-group" style="display:flex;align-items:flex-end;padding-bottom:4px">
        <label class="form-check">
          <input type="checkbox" id="ad-active" ${ad.active!==false?'checked':''}>
          Активна
        </label>
      </div>
    </div>
    <div id="ad-form-error" class="form-error" style="margin-bottom:12px;display:none"></div>
    <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap">
      <button class="btn btn-outline-dark" onclick="openManageAdsModal()">
        <i class="fa-solid fa-arrow-left"></i> Назад
      </button>
      <button class="btn btn-primary" onclick="saveAd('${mode}','${adId||''}')">
        <i class="fa-solid fa-floppy-disk"></i> Сохранить
      </button>
    </div>
  `;
}

async function saveAd(mode, adId) {
  const errorEl  = document.getElementById('ad-form-error');
  errorEl.style.display = 'none';
  const title    = document.getElementById('ad-title')?.value?.trim();
  const url      = document.getElementById('ad-url')?.value?.trim();
  const clickable= document.getElementById('ad-clickable')?.checked;
  const link     = document.getElementById('ad-link')?.value?.trim();

  if (!title) { showFieldError(errorEl, 'Введите название'); return; }
  if (!url)   { showFieldError(errorEl, 'Введите URL медиафайла'); return; }
  if (clickable && !link) { showFieldError(errorEl, 'Введите ссылку для перехода'); return; }

  const adData = {
    title, url, clickable,
    type:     document.getElementById('ad-type')?.value || 'image',
    link:     clickable ? link : '',
    showOn:   document.getElementById('ad-show-on')?.value || 'all',
    priority: parseInt(document.getElementById('ad-priority')?.value) || 1,
    active:   document.getElementById('ad-active')?.checked,
  };

  try {
    if (mode === 'add') {
      // Позиция по умолчанию при создании
      adData.position = 'bottom-right';
      await db.collection('ads').add(adData);
      showToast('Объявление добавлено', 'success');
    } else {
      await db.collection('ads').doc(adId).update(adData);
      showToast('Объявление обновлено', 'success');
    }
    openManageAdsModal();
  } catch (e) {
    showFieldError(errorEl, 'Ошибка сохранения');
  }
}
window.saveAd = saveAd;

function confirmDeleteAd(adId) {
  openModal(`
    <h2 class="modal-title">
      <i class="fa-solid fa-triangle-exclamation" style="color:var(--clr-danger)"></i>
      Удалить объявление?
    </h2>
    <p style="margin-bottom:24px">Объявление будет удалено безвозвратно.</p>
    <div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn btn-outline-dark" onclick="openManageAdsModal()">Отмена</button>
      <button class="btn btn-danger" onclick="deleteAd('${adId}')">
        <i class="fa-solid fa-trash"></i> Удалить
      </button>
    </div>
  `);
}
window.confirmDeleteAd = confirmDeleteAd;

async function deleteAd(adId) {
  try {
    await db.collection('ads').doc(adId).delete();
    // Убрать баннер с экрана если показывается
    const live = document.getElementById('site-ad-banner');
    if (live && live.dataset.adId === adId) live.remove();
    showToast('Объявление удалено', 'success');
    openManageAdsModal();
  } catch (e) { showToast('Ошибка удаления','error'); }
}
window.deleteAd = deleteAd;

function showFieldError(el, msg) {
  if (!el) return;
  el.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${escapeHtml(msg)}`;
  el.style.display = 'flex';
}
window.showFieldError = showFieldError;
