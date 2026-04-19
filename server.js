// ══════════════════════════════════════════════════════════
//  server.js  —  Render-ready
//  CommonJS (require), CORS, /api/config, /api/submit, /api/revoke
// ══════════════════════════════════════════════════════════

const express    = require('express');
const bodyParser = require('body-parser');
const fetch      = require('node-fetch');
const cors       = require('cors');

const app = express();

// ── CORS — разрешаем все фронтенды ──
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

// Дефолтные origins если переменная не задана
const DEFAULT_ORIGINS = [
  'https://suslikkkab-eng.github.io',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
];

const ALL_ORIGINS = [...new Set([...DEFAULT_ORIGINS, ...ALLOWED_ORIGINS])];

app.use(cors({
  origin: function (origin, callback) {
    // Разрешаем запросы без origin (Postman, curl, мобильные)
    if (!origin) return callback(null, true);
    if (ALL_ORIGINS.includes(origin)) return callback(null, true);
    // Разрешаем любой netlify.app поддомен
    if (/\.netlify\.app$/.test(origin)) return callback(null, true);
    // Разрешаем любой github.io поддомен
    if (/\.github\.io$/.test(origin)) return callback(null, true);
    callback(null, true); // временно разрешаем всё — уберите если нужна строгость
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.options('*', cors()); // pre-flight для всех маршрутов

app.use(bodyParser.json({ limit: '50kb' }));
app.use(bodyParser.urlencoded({ extended: false }));

// ── Токены только из env-переменных ──
const TG_BOT_TOKEN   = process.env.TG_BOT_TOKEN   || '';
const TG_CHAT_ID     = process.env.TG_CHAT_ID     || '';
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || '';


// ══════════════════════════════════════════════════════════
//  GET /api/config  —  отдаёт фронтенду публичные настройки
// ══════════════════════════════════════════════════════════
app.get('/api/config', (req, res) => {
  res.json({
    wa_number:       process.env.WA_NUMBER       || '',
    apps_script_url: APPS_SCRIPT_URL,
    backend_url:     process.env.BACKEND_URL     || '',
  });
});


// ══════════════════════════════════════════════════════════
//  validatePayload
// ══════════════════════════════════════════════════════════
function validatePayload(payload) {
  const type = payload && payload.type;

  // ── LEAD ──────────────────────────────────────────────
  if (type === 'lead') {
    const { name, phone, lang, source, utm } = payload;
    if (!name  || String(name).trim().length  === 0) return { error: 'name required' };
    if (String(name).trim().length  > 60)            return { error: 'name too long' };
    if (!phone || String(phone).trim().length === 0) return { error: 'phone required' };
    if (String(phone).trim().length > 60)            return { error: 'phone too long' };

    return {
      value: {
        type,
        name:   String(name).trim(),
        phone:  String(phone).trim(),
        lang:   lang   || '',
        source: source || '',
        utm:    utm    || {},
        text: '', plan: '', method: '', rating: null,
        business: '', budget: '', request: '', hasSales: '',
      }
    };
  }

  // ── PAYMENT ───────────────────────────────────────────
  if (type === 'payment') {
    const { name, phone, plan, method, lang, source, utm } = payload;
    if (!name  || String(name).trim().length  === 0) return { error: 'name required' };
    if (String(name).trim().length  > 60)            return { error: 'name too long' };
    if (!phone || String(phone).trim().length === 0) return { error: 'phone required' };
    if (String(phone).trim().length > 60)            return { error: 'phone too long' };

    return {
      value: {
        type,
        name:   String(name).trim(),
        phone:  String(phone).trim(),
        plan:   plan   || '',
        method: method || '',
        lang:   lang   || '',
        source: source || '',
        utm:    utm    || {},
        text: '', rating: null,
        business: '', budget: '', request: '', hasSales: '',
      }
    };
  }

  // ── REVIEW ────────────────────────────────────────────
  if (type === 'review') {
    const { name, text, rating, lang } = payload;
    if (!name || String(name).trim().length === 0) return { error: 'name required' };
    if (String(name).trim().length > 60)           return { error: 'name too long' };
    if (!text || String(text).trim().length === 0) return { error: 'text required' };
    if (String(text).trim().length > 2000)         return { error: 'text too long' };

    return {
      value: {
        type,
        name:   String(name).trim(),
        text:   String(text).trim(),
        rating: Number(rating) || 5,
        lang:   lang || '',
        phone: '', source: '', plan: '', method: '', utm: {},
        business: '', budget: '', request: '', hasSales: '',
      }
    };
  }

  // ── QUIZ ──────────────────────────────────────────────
  if (type === 'quiz') {
    const {
      name, phone,
      business, city, budget, avgCheck,
      clientSource, mainProblem, hasSales, goal,
      request, appNum,
      lang, source, utm
    } = payload;

    if (!name  || String(name).trim().length  === 0) return { error: 'name required' };
    if (String(name).trim().length  > 60)            return { error: 'name too long' };
    if (!phone || String(phone).trim().length === 0) return { error: 'phone required' };
    if (String(phone).trim().length > 60)            return { error: 'phone too long' };

    return {
      value: {
        type,
        appNum:      appNum      ? String(appNum).trim()      : '',
        name:        String(name).trim(),
        phone:       String(phone).trim(),
        business:    business    ? String(business).trim()    : '',
        city:        city        ? String(city).trim()        : '',
        budget:      budget      ? String(budget).trim()      : '',
        avgCheck:    avgCheck    ? String(avgCheck).trim()    : '',
        clientSource:clientSource? String(clientSource).trim(): '',
        mainProblem: mainProblem ? String(mainProblem).trim() : '',
        hasSales:    hasSales    ? String(hasSales).trim()    : '',
        goal:        goal        ? String(goal).trim()        : '',
        request:     request     ? String(request).trim()     : '',
        lang:        lang        || '',
        source:      source      || 'квиз',
        utm:         utm         || {},
        text: '', plan: '', method: '', rating: null,
      }
    };
  }

  // ── Неизвестный тип ───────────────────────────────────
  return { error: 'Unsupported type: ' + type };
}


// ══════════════════════════════════════════════════════════
//  buildTelegramMessage
// ══════════════════════════════════════════════════════════
function buildTelegramMessage(data) {
  const now = new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' });

  if (data.type === 'quiz') {
    const utmStr = data.utm && Object.keys(data.utm).length
      ? '\n📊 UTM: ' + JSON.stringify(data.utm)
      : '';
    return (
      `📩 НОВАЯ ЗАЯВКА — КВИЗ\n\n` +
      `🔖 Заявка: ${data.appNum    || '—'}\n` +
      `👤 Имя: ${data.name         || '—'}\n` +
      `📱 Контакт: ${data.phone    || '—'}\n` +
      `🏢 Бизнес: ${data.business  || '—'}\n` +
      `🌆 Город: ${data.city       || '—'}\n` +
      `💰 Бюджет: ${data.budget    || '—'}\n` +
      `💵 Средний чек: ${data.avgCheck    || '—'}\n` +
      `📍 Источник клиентов: ${data.clientSource || '—'}\n` +
      `⚠️ Проблема: ${data.mainProblem   || '—'}\n` +
      `👥 Менеджер: ${data.hasSales      || '—'}\n` +
      `🎯 Цель: ${data.goal              || '—'}\n` +
      `🏷 Источник: ${data.source        || '—'}\n` +
      `🕐 Время: ${now}` +
      utmStr
    );
  }

  if (data.type === 'lead') {
    return (
      `🔔 Новая заявка — Лид\n\n` +
      `👤 Имя: ${data.name   || '—'}\n` +
      `📱 Телефон: ${data.phone  || '—'}\n` +
      `🏷 Источник: ${data.source || '—'}\n` +
      `🕐 Время: ${now}\n` +
      `🌐 Язык: ${data.lang || '—'}`
    );
  }

  if (data.type === 'payment') {
    return (
      `💳 Новая оплата\n\n` +
      `👤 Имя: ${data.name   || '—'}\n` +
      `📱 Телефон: ${data.phone  || '—'}\n` +
      `🎯 Тариф: ${data.plan   || '—'}\n` +
      `💳 Способ: ${data.method || '—'}\n` +
      `🏷 Источник: ${data.source || '—'}\n` +
      `🕐 Время: ${now}\n` +
      `🌐 Язык: ${data.lang || '—'}`
    );
  }

  if (data.type === 'review') {
    return (
      `⭐ Новый отзыв\n\n` +
      `👤 Имя: ${data.name   || '—'}\n` +
      `💬 Текст: ${data.text   || '—'}\n` +
      `🌟 Рейтинг: ${data.rating || 5}/5\n` +
      `🕐 Время: ${now}\n` +
      `🌐 Язык: ${data.lang || '—'}`
    );
  }

  return `📋 Новое сообщение\n\n${JSON.stringify(data, null, 2)}`;
}


// ══════════════════════════════════════════════════════════
//  sendTelegramMessage
// ══════════════════════════════════════════════════════════
async function sendTelegramMessage(text) {
  if (!TG_BOT_TOKEN || !TG_CHAT_ID) return;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id:    TG_CHAT_ID,
          text:       text,
          parse_mode: 'HTML',
        }),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      console.error('Telegram error:', err);
    }
  } catch (e) {
    console.error('Telegram fetch error:', e.message);
  }
}


// ══════════════════════════════════════════════════════════
//  sendToAppsScript — сохраняет в Google Sheets
// ══════════════════════════════════════════════════════════
async function sendToAppsScript(data) {
  if (!APPS_SCRIPT_URL) return;
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain' }, // text/plain — обходит preflight CORS
      body:    JSON.stringify(data),
      redirect: 'follow',
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('Apps Script error:', err);
    }
  } catch (e) {
    console.error('Apps Script fetch error:', e.message);
  }
}


// ══════════════════════════════════════════════════════════
//  POST /api/submit
// ══════════════════════════════════════════════════════════
app.post('/api/submit', async (req, res) => {
  try {
    const { value, error } = validatePayload(req.body);

    if (error) {
      return res.status(400).json({ ok: false, error });
    }

    // Отправляем параллельно — не ждём одно перед другим
    await Promise.allSettled([
      sendTelegramMessage(buildTelegramMessage(value)),
      sendToAppsScript(value),
    ]);

    return res.json({ ok: true });

  } catch (err) {
    console.error('Submit error:', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});


// ══════════════════════════════════════════════════════════
//  POST /api/revoke — отзыв заявки
// ══════════════════════════════════════════════════════════
app.post('/api/revoke', async (req, res) => {
  try {
    const { phone, name } = req.body || {};

    // Уведомляем в Telegram
    const now = new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' });
    const tgText =
      `🚫 Заявка ОТОЗВАНА\n\n` +
      `👤 Имя: ${name  || '—'}\n` +
      `📱 Контакт: ${phone || '—'}\n` +
      `🕐 Время: ${now}`;

    await Promise.allSettled([
      sendTelegramMessage(tgText),
      sendToAppsScript({ type: 'revoke', phone, name }),
    ]);

    return res.json({ ok: true });
  } catch (err) {
    console.error('Revoke error:', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});


// ══════════════════════════════════════════════════════════
//  GET /health  —  проверка работоспособности
// ══════════════════════════════════════════════════════════
app.get('/health', (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});


// ══════════════════════════════════════════════════════════
//  Запуск
// ══════════════════════════════════════════════════════════
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`   TG_BOT_TOKEN:    ${TG_BOT_TOKEN    ? '✓ set' : '✗ missing'}`);
  console.log(`   TG_CHAT_ID:      ${TG_CHAT_ID      ? '✓ set' : '✗ missing'}`);
  console.log(`   APPS_SCRIPT_URL: ${APPS_SCRIPT_URL ? '✓ set' : '✗ missing'}`);
  console.log(`   WA_NUMBER:       ${process.env.WA_NUMBER ? '✓ set' : '✗ missing'}`);
});
