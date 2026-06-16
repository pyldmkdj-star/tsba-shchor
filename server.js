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
const SERVER_URL = process.env.SERVER_URL || `http://localhost:${PORT}`;

const VAPID_PUBLIC  = 'BLOlBL1N3z7j7cTeVPYX1cLBHPql08czYV6FBw-Ta0sCu0QWiSfnsIX79o3i5QoiHEJe1wQwKuZ1RiLhLN5-oHA';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY; // set in Render environment variable

webpush.setVapidDetails('mailto:admin@tzeva-shahor.com', VAPID_PUBLIC, VAPID_PRIVATE);

const ALL_LABEL = 'כל הארץ';

// ═══════════════════════════════════════════════
// IN-MEMORY STORE (resets on restart — fine for 24h alerts)
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
  try {
    await webpush.sendNotification(sub.subscription, JSON.stringify(payload));
    return true;
  } catch (e) {
    if (e.statusCode === 410 || e.statusCode === 404) {
      // Subscription expired — remove it
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

  const promises = subscribers.map(sub => {
    const userRegions = sub.regions || [];
    const shouldSend =
      isAllHaretz ||
      userRegions.includes(ALL_LABEL) ||
      userRegions.includes(alert.region);

    if (shouldSend) return pushToSubscriber(sub, payload);
    return Promise.resolve(false);
  });

  const results = await Promise.all(promises);
  return results.filter(Boolean).length;
}

// ═══════════════════════════════════════════════
// TELEGRAM BOT
// ═══════════════════════════════════════════════
const REGIONS = [
  'כל הארץ','אבן יהודה','אופקים','אור יהודה','אור עקיבא','אורנית','אזור','אילת','אלעד',
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
  await fetch(`${TG_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
  });
}

// ═══════════════════════════════════════════════
// TELEGRAM WEBHOOK
// ═══════════════════════════════════════════════
app.post('/webhook', async (req, res) => {
  res.sendStatus(200); // Answer Telegram immediately

  const upd = req.body;
  const msg = upd.message;
  if (!msg || !msg.text) return;

  const chatId = msg.chat.id;
  const text = msg.text.trim();

  // Commands
  if (text === '/start') {
    await sendTgMessage(chatId,
      'ברוך הבא לבוט צבע שחור 🖤\n\n' +
      'כדי לשלוח התראה:\n' +
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
      `👥 סה"כ מנויים: ${subscribers.length}\n` +
      `🔔 התראות פעילות (24 שעות): ${alerts.length}\n\n` +
      `📍 מנויים לפי אזור:\n${regionLines}`
    );
    return;
  }

  // Parse as alert
  const parsed = parseAlertMessage(text);
  if (!parsed) {
    await sendTgMessage(chatId,
      '❌ פורמט לא תקין.\n\n' +
      'שלח:\nשם הישוב\nתיאור ההתראה\n[קישור לתמונה - אופציונלי]\n\n' +
      'לשליחה לכולם כתוב "כל הארץ" בשורה הראשונה'
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
    `✅ ההתראה נשלחה!\n📍 אזור: ${parsed.region}\n👥 נשלח ל-${sent} מנויים`
  );
});

// ═══════════════════════════════════════════════
// CLIENT API ROUTES
// ═══════════════════════════════════════════════

// Register push subscription
app.post('/subscribe', (req, res) => {
  const { subscription, regions } = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'missing subscription' });
  }

  // Update or add
  const idx = subscribers.findIndex(s => s.subscription.endpoint === subscription.endpoint);
  if (idx >= 0) {
    subscribers[idx].regions = regions || [];
  } else {
    subscribers.push({ subscription, regions: regions || [] });
  }
  res.json({ ok: true, total: subscribers.length });
});

// Unsubscribe
app.post('/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  subscribers = subscribers.filter(s => s.subscription.endpoint !== endpoint);
  res.json({ ok: true });
});

// Get alerts (client polls this)
app.get('/alerts', (req, res) => {
  pruneAlerts();
  res.json({ alerts, ts: Date.now() });
});

// Health check
app.get('/', (req, res) => res.json({ status: 'ok', subscribers: subscribers.length, alerts: alerts.length }));

// ═══════════════════════════════════════════════
// SET WEBHOOK ON STARTUP
// ═══════════════════════════════════════════════
async function setWebhook() {
  if (!SERVER_URL || SERVER_URL.includes('localhost')) return;
  try {
    const r = await fetch(`${TG_API}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: `${SERVER_URL}/webhook` })
    });
    const d = await r.json();
    console.log('Webhook set:', d.description);
  } catch (e) {
    console.error('Webhook error:', e.message);
  }
}

app.listen(PORT, async () => {
  console.log(`🖤 צבע שחור שרת רץ על פורט ${PORT}`);
  await setWebhook();
});
