import express from 'express';
import cors from 'cors';

const app = express();

const PORT = process.env.PORT || 3000;
const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN;
const TG_CHAT_ID = process.env.TG_CHAT_ID;
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;
const APPS_SCRIPT_SECRET = process.env.APPS_SCRIPT_SECRET;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '';

app.set('trust proxy', true);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (!ALLOWED_ORIGIN || origin === ALLOWED_ORIGIN) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  }
}));

app.use(express.json({ limit: '50kb' }));

const rateMap = new Map();

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded && typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || 'unknown';
}

function checkRateLimit(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 5;

  const entry = rateMap.get(ip) || { count: 0, start: now };

  if (now - entry.start > windowMs) {
    rateMap.set(ip, { count: 1, start: now });
    return false;
  }

  entry.count += 1;
  rateMap.set(ip, entry);

  return entry.count > maxRequests;
}

function bad(res, message, status = 400) {
  return res.status(status).json({ ok: false, error: message });
}

function sanitizeText(value) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .trim();
}

function validatePayload(payload) {
  const type = sanitizeText(payload.type);
  const name = sanitizeText(payload.name);
  const phone = sanitizeText(payload.phone);
  const text = sanitizeText(payload.text);
  const source = sanitizeText(payload.source);
  const plan = sanitizeText(payload.plan);
  const method = sanitizeText(payload.method);
  const lang = payload.lang === 'kz' ? 'kz' : 'ru';
  const rating = Number(payload.rating);

  if (!type) return { error: 'Missing type' };
  if (!name || name.length > 60) return { error: 'Invalid name' };

  if (type === 'lead') {
    if (!phone || phone.length > 60) return { error: 'Invalid phone' };
  } else if (type === 'payment') {
    if (!phone || phone.length > 60) return { error: 'Invalid phone' };
    if (!plan) return { error: 'Missing plan' };
    if (!method) return { error: 'Missing method' };
  } else if (type === 'review') {
    if (!text || text.length > 1000) return { error: 'Invalid text' };
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return { error: 'Invalid rating' };
    }
  } else {
    return { error: 'Unsupported type' };
  }

  return {
    value: {
      type,
      name,
      phone,
      text,
      source,
      plan,
      method,
      lang,
      rating
    }
  };
}

function buildTelegramMessage(data) {
  const langLabel = data.lang === 'kz' ? 'Қазақша' : 'Русский';
  const now = new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' });

  const planLabels = {
    good: 'Хороший — 19 900 ₸',
    great: 'Отличный — 39 900 ₸',
    mentor: 'Наставничество — 89 900 ₸'
  };

  const methodLabels = {
    kaspi: 'Kaspi Pay',
    card: 'Банковская карта',
    tg: 'Telegram'
  };

  let msg = '📩 НОВАЯ ЗАЯВКА С САЙТА\n\n';
  msg += `👤 Имя: ${data.name}\n`;

  if (data.type === 'lead') {
    msg += `📱 Контакт: ${data.phone}\n`;
    msg += `🏷 Источник: ${data.source || 'лид'}\n`;
  }

  if (data.type === 'payment') {
    msg += `📱 Контакт: ${data.phone}\n`;
    msg += `📦 Тариф: ${planLabels[data.plan] || data.plan}\n`;
    msg += `💳 Способ оплаты: ${methodLabels[data.method] || data.method}\n`;
    msg += `🏷 Источник: ${data.source || 'оплата'}\n`;
  }

  if (data.type === 'review') {
    msg += `⭐ Оценка: ${data.rating}\n`;
    msg += `✍️ Отзыв: ${data.text}\n`;
  }

  msg += `🕐 Время: ${now}\n`;
  msg += `🌐 Язык: ${langLabel}`;

  return msg;
}

async function sendTelegramMessage(message) {
  const response = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TG_CHAT_ID,
      text: message
    })
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.ok === false) {
    throw new Error('Telegram failed');
  }
}

async function sendToAppsScript(data) {
  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...data,
      secret: APPS_SCRIPT_SECRET
    })
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Apps Script failed: ${text}`);
  }
}

app.get('/', (req, res) => {
  res.json({ ok: true, service: 'dias-backend' });
});

app.post('/api/submit', async (req, res) => {
  try {
    const ip = getClientIp(req);

    if (checkRateLimit(ip)) {
      return bad(res, 'Too many requests', 429);
    }

    if (!TG_BOT_TOKEN || !TG_CHAT_ID || !APPS_SCRIPT_URL || !APPS_SCRIPT_SECRET) {
      return bad(res, 'Missing server configuration', 500);
    }

    const result = validatePayload(req.body || {});
    if (result.error) {
      return bad(res, result.error, 400);
    }

    const data = result.value;
    const message = buildTelegramMessage(data);

    await sendTelegramMessage(message);
    await sendToAppsScript(data);

    return res.json({ ok: true });
  } catch (error) {
    console.error('Submit error:', error);
    return bad(res, 'Server error', 500);
  }
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  return res.status(500).json({ ok: false, error: 'Server error' });
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});