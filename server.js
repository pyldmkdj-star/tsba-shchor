const express = require('express');
const webpush = require('web-push');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// ═══════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════
const BOT_TOKEN = '8803612361:AAE3aJxb5tfKDa2vZTXufCZHV4UmkIwYZqM';
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const PORT = process.env.PORT || 3000;

const VAPID_PUBLIC  = 'BLOlBL1N3z7j7cTeVPYX1cLBHPql08czYV6FBw-Ta0sCu0QWiSfnsIX79o3i5QoiHEJe1wQwKuZ1RiLhLN5-oHA';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';

if (VAPID_PRIVATE) {
  webpush.setVapidDetails('mailto:admin@tzeva-shahor.com', VAPID_PUBLIC, VAPID_PRIVATE);
  console.log('✅ VAPID configured — push notifications enabled');
} else {
  console.warn('⚠️  VAPID_PRIVATE_KEY not set — push notifications will NOT work. Set it in Render Environment Variables.');
}

const ALL_LABEL = 'כל הארץ';

const REGIONS = [
  ALL_LABEL,
  'אבן יהודה','אופקים','אור יהודה','אור עקיבא','אורנית','אזור','אילת','אלעד',
  'אלפי מנשה','אלקנה','אפרת','אריאל','אשדוד','אשקלון','באר יעקב','באר שבע','בית דגן',
  'בית שאן','בית שמש','ביתר עילית','בני ברק','בני עי"ש','בנימינה גבעת עדה','בת ים',
  'בת חפר','גבעת זאב','גבעת שמואל','גבעתיים','גדרה','גן יבנה','דימונה','הוד השרון',
  'הרצליה','זכרון יעקב','חדרה','חולון','חיפה','חצור הגלילית','חריש','טבריה','טירת כרמל',
  'יבנה','יהוד מונסון','יקנעם עילית','ירושלים','כוכב יאיר צור יגאל','כפר ורדים',
  'כפר חב"ד','כפר יונה','כפר סבא','כפר תבור','כרמיאל','להבים','מבשרת ציון','מגדל העמק',
  'מודיעין עילית','מודיעין מכבים רעות','מזכרת בתיה','מיתר','מעלה אדומים','מצפה רמון',
  'נהריה','נס ציונה','נשר','נתיבות','נתניה','עילומי (עומר)','עמנואל','עפולה','ערד',
  'עתלית','פרדס חנה כרכור','פרדסיה','פתח תקווה','צור הדסה','צור יצחק','צפת','קיסריה',
  'קצרין','קדומים','קרית אונו','קרית ארבע','קרית אתא','קרית ביאליק','קרית גת',
  'קרית טבעון','קרית ים','קרית יערים','קרית מוצקין','קרית מלאכי','קרית עקרון',
  'קרית שמונה','קרני שומרון','ראש העין','ראשון לציון','רחובות','רמת גן','רמת השרון',
  'רמת ישי','רעננה','רכסים','שדרות','שוהם','שלומי','תל אביב-יפו','תל מונד'
];

// ═══════════════════════════════════════════════
// IN-MEMORY STORE
// ═══════════════════════════════════════════════
let alerts = [];        // { id, region, desc, image, ts }
let subscribers = [];   // { subscription, regions[] }

function pruneAlerts() {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  alerts = alerts.filter(a => a.ts > cutoff);
}

// ═══════════════════════════════════════════════
// PUSH HELPERS
// ═══════════════════════════════════════════════
async function pushToSubscriber(sub, payload) {
  if (!VAPID_PRIVATE) return false;
  try {
    await webpush.sendNotification(sub.subscription, JSON.stringify(payload));
    return true;
  } catch (e) {
    console.error('Push error:', e.statusCode, e.body || e.message);
    if (e.statusCode === 410 || e.statusCode === 404) {
      subscribers = subscribers.filter(s => s.subscription.endpoint !== sub.subscription.endpoint);
    }
    return false;
  }
}

async function broadcastAlert(alert) {
  const isAllHaretz = alert.region === ALL_LABEL;
  const title = isAllHaretz ? 'צבע שחור' : `צבע שחור ב${alert.region}`;

  const payload = {
    title,
    body: alert.desc,
    image: alert.image || undefined,
    tag: 'tzeva-' + alert.id
  };

  let sentCount = 0;
  for (const sub of subscribers) {
    const userRegions = sub.regions || [];
    const shouldSend =
      isAllHaretz ||
      userRegions.includes(ALL_LABEL) ||
      userRegions.includes(alert.region);

    if (shouldSend) {
      const ok = await pushToSubscriber(sub, payload);
      if (ok) sentCount++;
    }
  }
  return sentCount;
}

// ═══════════════════════════════════════════════
// TELEGRAM HELPERS
// ═══════════════════════════════════════════════
function isUrl(str) {
  try { new URL(str); return true; } catch { return false; }
}

function parseAlertMessage(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;
  const region = lines[0];
  let image = null;
  let descLines = [];
  for (let i = 1; i < lines.length; i++) {
    if (i === lines.length - 1 && isUrl(lines[i])) image = lines[i];
    else descLines.push(lines[i]);
  }
  const desc = descLines.join('\n');
  if (!REGIONS.includes(region)) return null;
  return { region, desc, image };
}

async function sendTgMessage(chatId, text) {
  try {
    await fetch(`${TG_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    });
  } catch (e) {
    console.error('sendTgMessage error:', e.message);
  }
}

// ═══════════════════════════════════════════════
// TELEGRAM MESSAGE HANDLER
// ═══════════════════════════════════════════════
async function handleTelegramMessage(msg) {
  if (!msg || !msg.text) return;
  const chatId = msg.chat.id;
  const text = msg.text.trim();

  console.log(`📩 Telegram message from ${chatId}: ${text.replace(/\n/g, ' | ')}`);

  if (text === '/start') {
    await sendTgMessage(chatId,
      'ברוך הבא לבוט צבע שחור 🖤\n\n' +
      'כדי לשלוח התראה, שלח הודעה בפורמט:\n' +
      'שורה 1: שם הישוב (או "כל הארץ")\n' +
      'שורה 2: תיאור ההתראה\n' +
      'שורה 3: קישור לתמונה (אופציונלי)\n\n' +
      'פקודות:\n/מחיקה - מחק כל ההתראות\n/סטטיסטיקה - סטטיסטיקות'
    );
    return;
  }

  if (text === '/מחיקה') {
    alerts = [];
    await sendTgMessage(chatId, '✅ כל ההתראות נמחקו בהצלחה');
    return;
  }

  if (text === '/סטטיסטיקה') {
    pruneAlerts();
    const regionCount = {};
    subscribers.forEach(s => {
      (s.regions || []).forEach(r => {
        regionCount[r] = (regionCount[r] || 0) + 1;
      });
    });
    const regionLines = Object.entries(regionCount)
      .sort((a, b) => b[1] - a[1])
      .map(([r, c]) => `  ${r}: ${c} משתמשים`)
      .join('\n') || '  אין מנויים עדיין';

    await sendTgMessage(chatId,
      `📊 סטטיסטיקות צבע שחור\n\n` +
      `👥 סה"כ מנויים (push): ${subscribers.length}\n` +
      `🔔 התראות פעילות (24 שעות): ${alerts.length}\n\n` +
      `📍 מנויים לפי אזור:\n${regionLines}`
    );
    return;
  }

  const parsed = parseAlertMessage(text);
  if (!parsed) {
    await sendTgMessage(chatId,
      '❌ פורמט לא תקין.\n\n' +
      'שלח:\nשם הישוב\nתיאור ההתראה\n[קישור לתמונה - אופציונלי]\n\n' +
      'לשליחה לכולם כתוב "כל הארץ" בשורה הראשונה.\n\n' +
      'שם הישוב חייב להיות מדויק כפי שמופיע באתר.'
    );
    return;
  }

  pruneAlerts();
  const alert = {
    id: Date.now(),
    region: parsed.region,
    desc: parsed.desc,
    image: parsed.image,
    ts: Date.now()
  };
  alerts.unshift(alert);

  const sent = await broadcastAlert(alert);
  await sendTgMessage(chatId,
    `✅ ההתראה נשלחה!\n📍 אזור: ${parsed.region}\n👥 נשלח Push ל-${sent} מנויים\n\n` +
    `(משתמשים שבתוך האתר כרגע יראו את ההתראה מיידית בלי קשר ל-Push)`
  );
}

// ═══════════════════════════════════════════════
// TELEGRAM POLLING LOOP
// ═══════════════════════════════════════════════
let lastUpdateId = 0;
let pollingActive = false;

async function pollTelegram() {
  if (pollingActive) return;
  pollingActive = true;
  try {
    const url = `${TG_API}/getUpdates?offset=${lastUpdateId + 1}&timeout=25`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.ok) {
      console.error('Telegram getUpdates not ok:', data);
    } else {
      for (const upd of data.result) {
        lastUpdateId = upd.update_id;
        try {
          await handleTelegramMessage(upd.message);
        } catch (e) {
          console.error('handleTelegramMessage error:', e.message);
        }
      }
    }
  } catch (e) {
    console.error('Polling fetch error:', e.message);
  } finally {
    pollingActive = false;
    setTimeout(pollTelegram, 500);
  }
}

// ═══════════════════════════════════════════════
// CLIENT API ROUTES
// ═══════════════════════════════════════════════
app.post('/subscribe', (req, res) => {
  const { subscription, regions } = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'missing subscription' });
  }
  const idx = subscribers.findIndex(s => s.subscription.endpoint === subscription.endpoint);
  if (idx >= 0) {
    subscribers[idx].regions = regions || [];
  } else {
    subscribers.push({ subscription, regions: regions || [] });
  }
  console.log(`✅ Subscriber registered. Total: ${subscribers.length}, regions: ${(regions||[]).join(', ')}`);
  res.json({ ok: true, total: subscribers.length });
});

app.post('/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  subscribers = subscribers.filter(s => s.subscription.endpoint !== endpoint);
  res.json({ ok: true });
});

app.get('/alerts', (req, res) => {
  pruneAlerts();
  res.json({ alerts, ts: Date.now() });
});

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    vapid_configured: !!VAPID_PRIVATE,
    subscribers: subscribers.length,
    alerts: alerts.length
  });
});

// ═══════════════════════════════════════════════
// STARTUP
// ═══════════════════════════════════════════════
async function startBot() {
  try {
    const r = await fetch(`${TG_API}/deleteWebhook`);
    const d = await r.json();
    console.log('Webhook cleared:', d.description || d.ok);
  } catch (e) {
    console.error('deleteWebhook error:', e.message);
  }
  console.log('🤖 Starting Telegram polling loop...');
  pollTelegram();
}

app.listen(PORT, async () => {
  console.log(`🖤 צבע שחור שרת רץ על פורט ${PORT}`);
  await startBot();
});
