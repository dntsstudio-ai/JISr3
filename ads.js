/**
 * ads.js — Логика показа рекламных модальных окон
 * ──────────────────────────────────────────────────
 * Функция showAd(page) выбирает самое приоритетное активное объявление
 * для текущей страницы и отображает его в модальном окне.
 * Клики по рекламе записываются в статистику.
 */

// Не показывать одно и то же объявление дважды за сессию
const shownAdIds = new Set();

// ── Главная функция: показать рекламу ────────────────────────────
async function showAd(currentPage) {
  try {
    // Загружаем активные объявления, подходящие для этой страницы
    // Сортируем по приоритету (наибольший — первым)
    const snapshot = await db.collection('ads')
      .where('active', '==', true)
      .orderBy('priority', 'desc')
      .get();

    // Найти подходящее объявление, которое ещё не показывали
    let selectedAd = null;
    let selectedId = null;

    snapshot.forEach(doc => {
      if (selectedAd) return; // уже нашли

      const ad = doc.data();

      // Проверяем соответствие страницы
      const pageMatch = ad.showOn === 'all'
        || ad.showOn === currentPage;

      // Не показывать одно и то же дважды
      if (pageMatch && !shownAdIds.has(doc.id)) {
        selectedAd = ad;
        selectedId = doc.id;
      }
    });

    if (!selectedAd) return; // нет подходящего объявления

    // Отметить как показанное в этой сессии
    shownAdIds.add(selectedId);

    // Показать модальное окно с рекламой
    displayAdModal(selectedAd, selectedId);

  } catch (e) {
    // Реклама — не критичная функция, тихо игнорируем ошибки
    console.warn('Не удалось загрузить рекламу:', e);
  }
}
window.showAd = showAd;

// ── Отобразить модальное окно рекламы ────────────────────────────
function displayAdModal(ad, adId) {
  const overlay  = document.getElementById('ad-modal-overlay');
  const content  = document.getElementById('ad-modal-content');
  const closeBtn = document.getElementById('ad-modal-close');

  if (!overlay || !content) return;

  // Сформировать медиа-контент
  let mediaHTML = '';

  if (ad.type === 'video') {
    mediaHTML = `
      <video controls autoplay muted playsinline
             style="width:100%;max-height:360px;object-fit:contain;display:block">
        <source src="${ad.url}" type="video/mp4">
        Ваш браузер не поддерживает видео.
      </video>`;
  } else {
    // image или gif
    mediaHTML = `
      <img src="${ad.url}"
           alt="Реклама"
           style="width:100%;max-height:360px;object-fit:contain;display:block"
           onerror="this.style.display='none'">`;
  }

  // Если реклама кликабельна — оборачиваем в ссылку
  if (ad.clickable && ad.link) {
    content.innerHTML = `
      <div style="cursor:pointer" onclick="handleAdClick('${adId}', '${escapeHtml(ad.link)}')">
        ${mediaHTML}
        <div style="padding:12px 16px;font-size:0.8rem;color:var(--clr-text-muted);text-align:center">
          <i class="fa-solid fa-arrow-up-right-from-square"></i> Нажмите для перехода
        </div>
      </div>`;
  } else {
    content.innerHTML = mediaHTML;
  }

  // Показать оверлей
  overlay.classList.remove('hidden');

  // Закрытие кнопкой
  closeBtn.onclick = () => overlay.classList.add('hidden');

  // Закрытие кликом по оверлею
  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.classList.add('hidden');
  };
}

// ── Обработка клика по рекламе ────────────────────────────────────
async function handleAdClick(adId, link) {
  // Открыть ссылку в новой вкладке
  window.open(link, '_blank', 'noopener,noreferrer');

  // Закрыть модалку
  document.getElementById('ad-modal-overlay')?.classList.add('hidden');

  // Записать клик в статистику (fire-and-forget)
  try {
    const today     = new Date();
    const todayStr  = formatFullDate(today);
    const increment = firebase.firestore.FieldValue.increment(1);

    // Общий счётчик кликов
    await db.collection('statistics').doc('counters').set({
      adClicks: { [adId]: increment },
    }, { merge: true });

    // Суточный счётчик
    await db.collection('statistics').doc('daily').collection('daily').doc(todayStr).set({
      adClicks: { [adId]: increment },
    }, { merge: true });

  } catch (e) {
    console.warn('Не удалось записать клик по рекламе:', e);
  }
}
window.handleAdClick = handleAdClick;
