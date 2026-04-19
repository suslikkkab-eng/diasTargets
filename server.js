// ══════════════════════════════════════════════════════════
//  server.js  —  Render-ready
//  CommonJS (require), CORS, /api/config, /api/submit
// ══════════════════════════════════════════════════════════

const express    = require('express');
const bodyParser = require('body-parser');
const fetch      = require('node-fetch');
const cors       = require('cors');

const app = express();

// ── CORS — разрешаем фронтенд и локальную разработку ──
app.use(cors({
  origin: [
    'https://suslikkkab-eng.github.io',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
  ],
}));

app.use(bodyParser.json());

// ── Токены только из env-переменных, никогда не в коде ──
const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || '';
const TG_CHAT_ID   = process.env.TG_CHAT_ID   || '';


// ══════════════════════════════════════════════════════════
//  GET /api/config  —  отдаёт фронтенду публичные настройки
//  TG_BOT_TOKEN и TG_CHAT_ID НЕ передаются фронтенду —
//  они используются только на сервере.
// ══════════════════════════════════════════════════════════
app.get('/api/config', (req, res) => {
  res.json({
    wa_number:       process.env.WA_NUMBER       || '',
    apps_script_url: process.env.APPS_SCRIPT_URL || '',
    backend_url:     process.env.BACKEND_URL     || '',
  });
});


// ══════════════════════════════════════════════════════════
//  validatePayload
//  Возвращает { value } при успехе или { error } при ошибке
// ══════════════════════════════════════════════════════════
function validatePayload(payload) {
  const type = payload && payload.type;

  // ── LEAD ──────────────────────────────────────────────
  if (type === 'lead') {
    const { name, phone, lang, source, utm } = payload;
    if (!name || String(name).trim().length === 0)   return { error: 'name required' };
    if (String(name).trim().length > 60)             return { error: 'name too long' };
    if (!phone || String(phone).trim().length === 0) return { error: 'phone required' };
    if (String(phone).trim().length > 60)            return { error: 'phone too long' };

    return {
      value: {
        type,
        name:     String(name).trim(),
        phone:    String(phone).trim(),
        lang:     lang   || '',
        source:   source || '',
        utm:      utm    || {},
        text: '', plan: '', method: '', rating: null,
        business: '', budget: '', request: '', hasSales: '',
      }
    };
  }

  // ── PAYMENT ───────────────────────────────────────────
  if (type === 'payment') {
    const { name, phone, plan, method, lang, source, utm } = payload;
    if (!name || String(name).trim().length === 0)   return { error: 'name required' };
    if (String(name).trim().length > 60)             return { error: 'name too long' };
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
    const { name, phone, business, budget, request, hasSales, lang, source, utm } = payload;

    if (!name || String(name).trim().length === 0)   return { error: 'name required' };
    if (String(name).trim().length > 60)             return { error: 'name too long' };
    if (!phone || String(phone).trim().length === 0) return { error: 'phone required' };
    if (String(phone).trim().length > 60)            return { error: 'phone too long' };
    if (business && String(business).length > 100)   return { error: 'business too long' };
    if (budget   && String(budget).length   > 100)   return { error: 'budget too long' };
    if (request  && String(request).length  > 1000)  return { error: 'request too long' };
    if (hasSales && String(hasSales).length > 100)   return { error: 'hasSales too long' };

    return {
      value: {
        type,
        name:     String(name).trim(),
        phone:    String(phone).trim(),
        business: business ? String(business).trim() : '',
        budget:   budget   ? String(budget).trim()   : '',
        request:  request  ? String(request).trim()  : '',
        hasSales: hasSales ? String(hasSales).trim() : '',
        lang:     lang     || '',
        source:   source   || 'квиз',
        utm:      utm      || {},
        text: '', plan: '', method: '', rating: null,
      }
    };
  }

  // ── Неизвестный тип ───────────────────────────────────
  return { error: 'Unsupported type' };
}


// ══════════════════════════════════════════════════════════
//  buildTelegramMessage
// ══════════════════════════════════════════════════════════
function buildTelegramMessage(data) {
  const now = new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' });

  if (data.type === 'quiz') {
    return (
      `📩 НОВАЯ ЗАЯВКА С САЙТА\n\n` +
      `👤 Имя: ${data.name      || '—'}\n` +
      `📱 Контакт: ${data.phone    || '—'}\n` +
      `🏢 Бизнес: ${data.business  || '—'}\n` +
      `💰 Бюджет: ${data.budget    || '—'}\n` +
      `📝 Запрос: ${data.request   || '—'}\n` +
      `👥 Отдел продаж: ${data.hasSales || '—'}\n` +
      `🏷 Источник: ${data.source   || '—'}\n` +
      `🕐 Время: ${now}\n` +
      `🌐 Язык: ${data.lang || '—'}`
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
  if (!TG_BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id:    TG_CHAT_ID,
      text:       text,
      parse_mode: 'HTML',
    }),
  });
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

    const tgText = buildTelegramMessage(value);
    await sendTelegramMessage(tgText);

    // ── Сохранение в Google Sheets / БД — вставь здесь ──
    // await saveToSheets(value);
    // await db.collection('leads').insertOne(value);
    // ────────────────────────────────────────────────────

    return res.json({ ok: true });

  } catch (err) {
    console.error('Submit error:', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});


// ══════════════════════════════════════════════════════════
//  Запуск
// ══════════════════════════════════════════════════════════
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
