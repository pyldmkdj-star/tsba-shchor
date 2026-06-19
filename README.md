# 🖤 צבע שחור — מדריך פריסה מלא (2 Repos)

## מבנה הפרויקט
יש **שני repositories נפרדים**:

1. **`tzeva-shahor`** (התיקייה הזו) — האתר → Render **Static Site**
2. **`tzeva-shahor-server`** — השרת → Render **Web Service**

---

## שלב 1 — פריסת השרת (`tzeva-shahor-server`)

1. צור Repository חדש ב-GitHub: `tzeva-shahor-server`
2. העלה לתוכו את `server.js` + `package.json`
3. ב-Render: **New → Web Service** → חבר את ה-repo
4. הגדרות:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. **חובה** — תחת **Environment → Add Environment Variable**:

   | Key | Value |
   |---|---|
   | `VAPID_PRIVATE_KEY` | המפתח הפרטי שלך (אל תשים אותו בקוד!) |

6. לחץ **Deploy**
7. שמור את ה-URL שתקבל, לדוגמה: `https://tzeva-shahor-server.onrender.com`

### בדיקת תקינות השרת
גש בדפדפן לכתובת השרת (לדוג' `https://tzeva-shahor-server.onrender.com/`):
```json
{"status":"ok","vapid_configured":true,"subscribers":0,"alerts":0}
```
אם `vapid_configured` הוא `false` — בדוק שה-Environment Variable מוגדר נכון.

בלוגים (**Logs** ב-Render) אתה אמור לראות:
```
✅ VAPID configured — push notifications enabled
🤖 Starting Telegram polling loop...
```

---

## שלב 2 — עדכון כתובת השרת באתר

פתח את `index.html` בתיקיית `tzeva-shahor`, חפש את השורה:
```javascript
const SERVER_URL = 'https://YOUR-SERVER.onrender.com';
```
החלף ב-URL האמיתי שקיבלת בשלב 1, לדוגמה:
```javascript
const SERVER_URL = 'https://tzeva-shahor-server.onrender.com';
```

---

## שלב 3 — פריסת האתר (`tzeva-shahor`)

1. צור Repository חדש ב-GitHub: `tzeva-shahor`
2. העלה לתוכו את `index.html` + `sw.js` + `manifest.json` (הקבצים בשורש)
3. ב-Render: **New → Static Site** → חבר את ה-repo
4. הגדרות:
   - **Build Command:** *(ריק)*
   - **Publish Directory:** `.`
5. לחץ **Deploy**

---

## בדיקה מלאה אחרי הפריסה

1. כנס לאתר → בחר אזור (למשל "צפת") → אשר אזורי התראה
2. אשר הרשאת התראות בדפדפן
3. שלח לבוט בטלגרם:
   ```
   צפת
   הגיעו שוטרים תבואו מהר
   ```
4. הבוט אמור לענות: `✅ ההתראה נשלחה! 📍 אזור: צפת 👥 נשלח Push ל-1 מנויים`
5. תוך כמה שניות אתה אמור לקבל **התראת Push אמיתית** — גם אם האתר/דפדפן סגור

---

## פקודות הבוט

| פקודה | פעולה |
|-------|--------|
| `/start` | הסבר על הבוט |
| `/מחיקה` | מוחק את כל ההתראות מהזיכרון של השרת (גלובלי לכולם) |
| `/סטטיסטיקה` | מציג כמה מנויים יש ולאיזה אזורים |

### פורמט שליחת התראה
```
שם הישוב
תיאור ההתראה
[קישור לתמונה - אופציונלי]
```
לשליחה לכולם — כתוב `כל הארץ` בשורה הראשונה.

---

## ⚠️ הערה חשובה על Render Free Tier

ב-**Free Plan** של Render, ה-Web Service "נרדם" אחרי 15 דקות חוסר פעילות, ומתעורר רק עם בקשה נכנסת — מה שעלול לעצור את ה-polling של הבוט עד שמישהו נכנס לאתר.

**פתרון:** שירות "ping" חינמי כמו [UptimeRobot](https://uptimerobot.com) ששולח בקשה לשרת שלך כל 5 דקות, כדי שיישאר פעיל תמיד.

---

## איפוס בעת קריסה

הזיכרון של השרת (`alerts`, `subscribers`) הוא **in-memory** — מתאפס אם השרת קורס או מתבצע Deploy מחדש. זה מתאים להתראות 24 שעות, אבל המנויים יצטרכו לפתוח את האתר מחדש כדי להירשם שוב ל-Push (קורה אוטומטית, בלי פעולה מהמשתמש).
