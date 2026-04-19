// ══════════════════════════════════════════════════════════
//  server.js  —  patched: добавлена поддержка type='quiz'
//  Изменены только: validatePayload, buildTelegramMessage
//  Всё остальное не тронуто.
// ══════════════════════════════════════════════════════════

const express    = require('express');
const bodyParser = require('body-parser');
const fetch      = require('node-fetch'); // или встроенный fetch в Node 18+

const app = express();
app.use(bodyParser.json());

// ── Замени на свои ──
const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || 'ВАШ_BOT_TOKEN';
const TG_CHAT_ID   = process.env.TG_CHAT_ID   || 'ВАШ_CHAT_ID';
// ────────────────────

// ══════════════════════════════════════════════════════════
//  validatePayload
//  Возвращает { value } при успехе или { error } при ошибке
// ══════════════════════════════════════════════════════════
function validatePayload(payload) {
  const type = payload && payload.type;

  // ── LEAD ──────────────────────────────────────────────
  if (type === 'lead') {
    const { name, phone, lang, source, utm } = payload;
    if (!name || String(name).trim().length === 0) return { error: 'name required' };
    if (String(name).trim().length > 60)           return { error: 'name too long' };
    if (!phone || String(phone).trim().length === 0) return { error: 'phone required' };
    if (String(phone).trim().length > 60)           return { error: 'phone too long' };

    return {
      value: {
        type,
        name:     String(name).trim(),
        phone:    String(phone).trim(),
        lang:     lang     || '',
        source:   source   || '',
        utm:      utm      || {},
        // поля, не используемые в lead — пустые для совместимости схемы
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
  // ✅ НОВАЯ ВЕТКА — добавлена для совместимости с новым фронтендом
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
        // поля схемы, не используемые в quiz
        text: '', plan: '', method: '', rating: null,
      }
    };
  }

  // ── Неизвестный тип ───────────────────────────────────
  return { error: 'Unsupported type' };
}


// ══════════════════════════════════════════════════════════
//  buildTelegramMessage
//  Формирует текст сообщения для Telegram по типу заявки
// ══════════════════════════════════════════════════════════
function buildTelegramMessage(data) {
  const now = new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' });

  // ── QUIZ ──────────────────────────────────────────────
  // ✅ НОВАЯ ВЕТКА
  if (data.type === 'quiz') {
    return (
      `📩 НОВАЯ ЗАЯВКА С САЙТА\n\n` +
      `👤 Имя: ${data.name     || '—'}\n` +
      `📱 Контакт: ${data.phone   || '—'}\n` +
      `🏢 Бизнес: ${data.business || '—'}\n` +
      `💰 Бюджет: ${data.budget   || '—'}\n` +
      `📝 Запрос: ${data.request  || '—'}\n` +
      `👥 Отдел продаж: ${data.hasSales || '—'}\n` +
      `🏷 Источник: ${data.source  || '—'}\n` +
      `🕐 Время: ${now}\n` +
      `🌐 Язык: ${data.lang || '—'}`
    );
  }

  // ── LEAD ──────────────────────────────────────────────
  if (data.type === 'lead') {
    return (
      `🔔 Новая заявка — Лид\n\n` +
      `👤 Имя: ${data.name  || '—'}\n` +
      `📱 Телефон: ${data.phone || '—'}\n` +
      `🏷 Источник: ${data.source || '—'}\n` +
      `🕐 Время: ${now}\n` +
      `🌐 Язык: ${data.lang || '—'}`
    );
  }

  // ── PAYMENT ───────────────────────────────────────────
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

  // ── REVIEW ────────────────────────────────────────────
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

  // Fallback — на случай неизвестного типа
  return `📋 Новое сообщение\n\n${JSON.stringify(data, null, 2)}`;
}


// ══════════════════════════════════════════════════════════
//  sendTelegramMessage  —  вспомогательная функция
// ══════════════════════════════════════════════════════════
async function sendTelegramMessage(text) {
  if (!TG_BOT_TOKEN || TG_BOT_TOKEN.includes('ВАШ')) return;
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
//  GET /api/config  —  отдаёт фронтенду чувствительные ключи
//  Фронтенд запрашивает этот маршрут при загрузке страницы.
//  Без него квиз не сможет отправлять заявки.
// ══════════════════════════════════════════════════════════
app.get('/api/config', (req, res) => {
  res.json({
    wa_number:       process.env.WA_NUMBER       || '',
    tg_bot_token:    process.env.TG_BOT_TOKEN    || TG_BOT_TOKEN,
    tg_chat_id:      process.env.TG_CHAT_ID      || TG_CHAT_ID,
    apps_script_url: process.env.APPS_SCRIPT_URL || '',
    backend_url:     process.env.BACKEND_URL     || '',
  });
});


// ══════════════════════════════════════════════════════════
//  POST /api/submit  —  основной эндпоинт
// ══════════════════════════════════════════════════════════
app.post('/api/submit', async (req, res) => {
  try {
    const { value, error } = validatePayload(req.body);

    if (error) {
      return res.status(400).json({ ok: false, error });
    }

    // Отправить в Telegram
    const tgText = buildTelegramMessage(value);
    await sendTelegramMessage(tgText);

    // ── Если есть сохранение в Google Sheets / БД — вставь здесь ──
    // await saveToSheets(value);
    // await db.collection('leads').insertOne(value);
    // ──────────────────────────────────────────────────────────────

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
