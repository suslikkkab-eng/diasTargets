// ══════════════════════════════════════════════════════════
//  server.js  —  исправлено:
//  1. CommonJS require → ES Module import (package.json type=module)
//  2. Добавлен GET /api/config — без него фронтенд не устанавливает
//     _configLoaded=true и submitQuiz() молча выходит (строка 1623)
// ══════════════════════════════════════════════════════════

import express from 'express';
import cors    from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// ── Токены из переменных окружения ──
const TG_BOT_TOKEN    = process.env.TG_BOT_TOKEN    || '';
const TG_CHAT_ID      = process.env.TG_CHAT_ID      || '';
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || '';
const WA_NUMBER       = process.env.WA_NUMBER       || '';

// ══════════════════════════════════════════════════════════
//  GET /api/config  ← ГЛАВНОЕ ИСПРАВЛЕНИЕ
//  Фронтенд делает fetch('/api/config') при загрузке страницы.
//  Если этот эндпоинт не отвечает → _configLoaded остаётся false
//  → submitQuiz() выходит раньше отправки (строка 1623 в HTML)
// ══════════════════════════════════════════════════════════
app.get('/api/config', (req, res) => {
  res.json({
    tg_bot_token:    TG_BOT_TOKEN,
    tg_chat_id:      TG_CHAT_ID,
    apps_script_url: APPS_SCRIPT_URL,
    wa_number:       WA_NUMBER,
    backend_url:     process.env.BACKEND_URL || 'https://diastargets-2.onrender.com/api/submit',
  });
});


// ══════════════════════════════════════════════════════════
//  validatePayload
// ══════════════════════════════════════════════════════════
function validatePayload(payload) {
  const type = payload && payload.type;

  if (type === 'lead') {
    const { name, phone, lang, source, utm } = payload;
    if (!name  || !String(name).trim())  return { error: 'name required' };
    if (String(name).trim().length > 60) return { error: 'name too long' };
    if (!phone || !String(phone).trim()) return { error: 'phone required' };
    if (String(phone).trim().length > 60) return { error: 'phone too long' };
    return { value: { type, name: String(name).trim(), phone: String(phone).trim(), lang: lang||'', source: source||'', utm: utm||{}, text:'', plan:'', method:'', rating:null, business:'', budget:'', request:'', hasSales:'' } };
  }

  if (type === 'payment') {
    const { name, phone, plan, method, lang, source, utm } = payload;
    if (!name  || !String(name).trim())  return { error: 'name required' };
    if (String(name).trim().length > 60) return { error: 'name too long' };
    if (!phone || !String(phone).trim()) return { error: 'phone required' };
    if (String(phone).trim().length > 60) return { error: 'phone too long' };
    return { value: { type, name: String(name).trim(), phone: String(phone).trim(), plan: plan||'', method: method||'', lang: lang||'', source: source||'', utm: utm||{}, text:'', rating:null, business:'', budget:'', request:'', hasSales:'' } };
  }

  if (type === 'review') {
    const { name, text, rating, lang } = payload;
    if (!name || !String(name).trim()) return { error: 'name required' };
    if (String(name).trim().length > 60) return { error: 'name too long' };
    if (!text || !String(text).trim()) return { error: 'text required' };
    if (String(text).trim().length > 2000) return { error: 'text too long' };
    return { value: { type, name: String(name).trim(), text: String(text).trim(), rating: Number(rating)||5, lang: lang||'', phone:'', source:'', plan:'', method:'', utm:{}, business:'', budget:'', request:'', hasSales:'' } };
  }

  if (type === 'quiz') {
    const { name, phone, business, city, budget, avgCheck, clientSource, mainProblem, hasSales, goal, appNum, request, lang, source, utm } = payload;
    if (!name  || !String(name).trim())  return { error: 'name required' };
    if (String(name).trim().length > 60) return { error: 'name too long' };
    if (!phone || !String(phone).trim()) return { error: 'phone required' };
    if (String(phone).trim().length > 60) return { error: 'phone too long' };
    return {
      value: {
        type,
        appNum:       appNum       ? String(appNum).trim()       : '',
        name:         String(name).trim(),
        phone:        String(phone).trim(),
        business:     business     ? String(business).trim()     : '',
        city:         city         ? String(city).trim()         : '',
        budget:       budget       ? String(budget).trim()       : '',
        avgCheck:     avgCheck     ? String(avgCheck).trim()     : '',
        clientSource: clientSource ? String(clientSource).trim() : '',
        mainProblem:  mainProblem  ? String(mainProblem).trim()  : '',
        hasSales:     hasSales     ? String(hasSales).trim()     : '',
        goal:         goal         ? String(goal).trim()         : '',
        request:      request      ? String(request).trim()      : '',
        lang:         lang         || '',
        source:       source       || 'quiz',
        utm:          utm          || {},
        text:'', plan:'', method:'', rating:null,
      }
    };
  }

  return { error: 'Unsupported type' };
}


// ══════════════════════════════════════════════════════════
//  buildTelegramMessage
// ══════════════════════════════════════════════════════════
function buildTelegramMessage(data) {
  const now = new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' });

  if (data.type === 'quiz') {
    return [
      '📩 НОВАЯ ЗАЯВКА — КВИЗ', '',
      `🔢 Номер: ${data.appNum       || '—'}`,
      `👤 Имя: ${data.name           || '—'}`,
      `📱 Контакт: ${data.phone      || '—'}`,
      `🏢 Бизнес: ${data.business    || '—'}`,
      `🌆 Город: ${data.city         || '—'}`,
      `💰 Бюджет: ${data.budget      || '—'}`,
      `💵 Средний чек: ${data.avgCheck    || '—'}`,
      `📍 Источник клиентов: ${data.clientSource || '—'}`,
      `⚠️ Главная проблема: ${data.mainProblem  || '—'}`,
      `👥 Менеджер: ${data.hasSales  || '—'}`,
      `🎯 Цель: ${data.goal          || '—'}`,
      `🏷 Источник: ${data.source    || '—'}`,
      `🌐 Язык: ${data.lang          || '—'}`,
      `🕐 Время: ${now}`,
    ].join('\n');
  }

  if (data.type === 'lead')    return `🔔 Новая заявка — Лид\n\n👤 ${data.name||'—'}\n📱 ${data.phone||'—'}\n🏷 ${data.source||'—'}\n🕐 ${now}`;
  if (data.type === 'payment') return `💳 Новая оплата\n\n👤 ${data.name||'—'}\n📱 ${data.phone||'—'}\n🎯 ${data.plan||'—'}\n💳 ${data.method||'—'}\n🕐 ${now}`;
  if (data.type === 'review')  return `⭐ Новый отзыв\n\n👤 ${data.name||'—'}\n💬 ${data.text||'—'}\n🌟 ${data.rating||5}/5\n🕐 ${now}`;

  return `📋 Новое сообщение\n\n${JSON.stringify(data, null, 2)}`;
}


// ══════════════════════════════════════════════════════════
//  sendTelegramMessage
// ══════════════════════════════════════════════════════════
async function sendTelegramMessage(text) {
  if (!TG_BOT_TOKEN || !TG_BOT_TOKEN.trim() || TG_BOT_TOKEN.includes('ВАШ')) return;
  await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TG_CHAT_ID, text, parse_mode: 'HTML' }),
  });
}


// ══════════════════════════════════════════════════════════
//  POST /api/submit
// ══════════════════════════════════════════════════════════
app.post('/api/submit', async (req, res) => {
  try {
    const { value, error } = validatePayload(req.body);
    if (error) return res.status(400).json({ ok: false, error });

    await sendTelegramMessage(buildTelegramMessage(value));

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
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
