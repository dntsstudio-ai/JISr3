/**
 * stats.js — Страница статистики
 * ─────────────────────────────────
 * Отображает:
 *  - Карточки с общими показателями (посещения, регистрации, клики)
 *  - Линейный график посещений и регистраций за 30 дней
 *  - Горизонтальный бар-чарт топ-5 реклам по кликам
 *
 * Доступна только администраторам.
 */

// Ссылки на Chart.js графики (нужны для перерисовки при обновлении)
let visitsChart = null;
let adsChart    = null;

// ── Инициализация страницы статистики ────────────────────────────
async function initStatsPage() {
  const main = document.getElementById('main-content');

  main.innerHTML = `
    <div class="stats-page">
      <h1 class="page-title">
        <i class="fa-solid fa-chart-line"></i>
        Статистика
      </h1>

      <!-- Карточки с итоговыми числами -->
      <div class="stats-cards" id="stats-cards">
        <div class="stat-card">
          <div class="stat-icon visits"><i class="fa-solid fa-eye"></i></div>
          <div>
            <div class="stat-value" id="stat-total-visits">—</div>
            <div class="stat-label">Всего посещений</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon regs"><i class="fa-solid fa-user-plus"></i></div>
          <div>
            <div class="stat-value" id="stat-total-regs">—</div>
            <div class="stat-label">Регистраций</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon clicks"><i class="fa-solid fa-computer-mouse"></i></div>
          <div>
            <div class="stat-value" id="stat-total-clicks">—</div>
            <div class="stat-label">Кликов по рекламе</div>
          </div>
        </div>
      </div>

      <!-- График посещений за 30 дней -->
      <div class="chart-card">
        <h3><i class="fa-solid fa-chart-line"></i> Посещения и регистрации (последние 30 дней)</h3>
        <canvas id="visits-chart" height="100"></canvas>
      </div>

      <!-- Топ реклам по кликам -->
      <div class="chart-card">
        <h3><i class="fa-solid fa-rectangle-ad"></i> Топ-5 реклам по кликам</h3>
        <canvas id="ads-chart" height="120"></canvas>
      </div>
    </div>
  `;

  // Загружаем данные параллельно
  await Promise.all([
    loadCounters(),
    loadDailyStats(),
    loadAdsStats(),
  ]);
}

// ── Загрузить общие счётчики ──────────────────────────────────────
async function loadCounters() {
  try {
    const doc = await db.collection('statistics').doc('counters').get();

    if (!doc.exists) {
      setStatValue('stat-total-visits', 0);
      setStatValue('stat-total-regs', 0);
      setStatValue('stat-total-clicks', 0);
      return;
    }

    const data = doc.data();

    setStatValue('stat-total-visits', data.totalVisits || 0);
    setStatValue('stat-total-regs',   data.totalRegistrations || 0);

    // Суммируем все клики по рекламе
    const adClicks = data.adClicks || {};
    const totalClicks = Object.values(adClicks).reduce((sum, v) => sum + (v || 0), 0);
    setStatValue('stat-total-clicks', totalClicks);

  } catch (e) {
    console.error('Ошибка загрузки счётчиков:', e);
  }
}

// ── Загрузить суточную статистику за 30 дней ─────────────────────
async function loadDailyStats() {
  try {
    // Генерируем массив из 30 дат (от сегодня минус 29 дней)
    const dates  = [];
    const labels = [];
    const today  = new Date();

    for (let i = 29; i >= 0; i--) {
      const d   = new Date(today);
      d.setDate(today.getDate() - i);
      dates.push(formatFullDate(d));

      // Короткие метки для оси X: "дд.мм"
      labels.push(
        `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`
      );
    }

    // Загружаем все документы суточной статистики
    const snapshot = await db.collection('statistics').doc('daily')
      .collection('daily').get();

    // Создаём словарь {date: {visits, registrations}}
    const dailyMap = {};
    snapshot.forEach(doc => {
      dailyMap[doc.id] = doc.data();
    });

    // Сопоставляем с нашим массивом дат
    const visitsData = dates.map(d => (dailyMap[d]?.visits || 0));
    const regsData   = dates.map(d => (dailyMap[d]?.registrations || 0));

    // Строим линейный график
    buildVisitsChart(labels, visitsData, regsData);

  } catch (e) {
    console.error('Ошибка загрузки суточной статистики:', e);
  }
}

// ── Загрузить статистику кликов по рекламе ───────────────────────
async function loadAdsStats() {
  try {
    // Получаем общие счётчики кликов
    const countersDoc = await db.collection('statistics').doc('counters').get();
    const adClicks    = countersDoc.exists ? (countersDoc.data().adClicks || {}) : {};

    // Получаем названия объявлений
    const adsSnapshot = await db.collection('ads').get();
    const adNames     = {};
    adsSnapshot.forEach(doc => {
      adNames[doc.id] = doc.data().title || doc.id;
    });

    // Сортируем по кликам, берём топ-5
    const sorted = Object.entries(adClicks)
      .map(([id, clicks]) => ({ name: adNames[id] || id, clicks }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 5);

    if (sorted.length === 0) {
      const canvas = document.getElementById('ads-chart');
      if (canvas) {
        canvas.parentElement.innerHTML += `
          <p class="text-muted" style="text-align:center;padding:20px">
            Кликов по рекламе пока нет.
          </p>`;
        canvas.style.display = 'none';
      }
      return;
    }

    buildAdsChart(
      sorted.map(a => a.name),
      sorted.map(a => a.clicks)
    );

  } catch (e) {
    console.error('Ошибка загрузки статистики рекламы:', e);
  }
}

// ── Построить линейный график посещений ──────────────────────────
function buildVisitsChart(labels, visitsData, regsData) {
  const canvas = document.getElementById('visits-chart');
  if (!canvas) return;

  // Уничтожить предыдущий график если есть
  if (visitsChart) { visitsChart.destroy(); visitsChart = null; }

  visitsChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Посещения',
          data: visitsData,
          borderColor: '#1C3A5E',
          backgroundColor: 'rgba(28,58,94,0.08)',
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 6,
          borderWidth: 2,
        },
        {
          label: 'Регистрации',
          data: regsData,
          borderColor: '#C9A84C',
          backgroundColor: 'rgba(201,168,76,0.08)',
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 6,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: { family: 'Jost, sans-serif', size: 13 },
            color: '#1A1A2E',
            usePointStyle: true,
          },
        },
        tooltip: {
          backgroundColor: '#1C3A5E',
          titleFont: { family: 'Cormorant Garamond, serif', size: 14 },
          bodyFont:  { family: 'Jost, sans-serif' },
        },
      },
      scales: {
        x: {
          ticks: {
            maxTicksLimit: 10,
            font: { family: 'Jost, sans-serif', size: 11 },
            color: '#6B7280',
          },
          grid: { color: 'rgba(0,0,0,0.05)' },
        },
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
            font: { family: 'Jost, sans-serif', size: 11 },
            color: '#6B7280',
          },
          grid: { color: 'rgba(0,0,0,0.05)' },
        },
      },
    },
  });
}

// ── Построить горизонтальный бар-чарт топ реклам ─────────────────
function buildAdsChart(labels, data) {
  const canvas = document.getElementById('ads-chart');
  if (!canvas) return;

  if (adsChart) { adsChart.destroy(); adsChart = null; }

  adsChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Кликов',
        data: data,
        backgroundColor: [
          'rgba(28,58,94,0.75)',
          'rgba(201,168,76,0.75)',
          'rgba(74,124,89,0.75)',
          'rgba(107,78,155,0.75)',
          'rgba(192,96,58,0.75)',
        ],
        borderRadius: 4,
        borderWidth: 0,
      }],
    },
    options: {
      indexAxis: 'y',  // горизонтальные столбики
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1C3A5E',
          titleFont: { family: 'Cormorant Garamond, serif', size: 14 },
          bodyFont:  { family: 'Jost, sans-serif' },
          callbacks: {
            label: (ctx) => ` ${ctx.parsed.x} кликов`,
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: {
            precision: 0,
            font: { family: 'Jost, sans-serif', size: 11 },
            color: '#6B7280',
          },
          grid: { color: 'rgba(0,0,0,0.05)' },
        },
        y: {
          ticks: {
            font: { family: 'Jost, sans-serif', size: 12 },
            color: '#1A1A2E',
          },
          grid: { display: false },
        },
      },
    },
  });
}

// ── Утилита: установить значение счётчика с анимацией ────────────
function setStatValue(id, value) {
  const el = document.getElementById(id);
  if (!el) return;

  // Анимируем нарастание числа
  const target  = parseInt(value) || 0;
  const steps   = 30;
  const step    = Math.ceil(target / steps);
  let   current = 0;

  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = current.toLocaleString('ru-RU');
    if (current >= target) clearInterval(timer);
  }, 30);
}
