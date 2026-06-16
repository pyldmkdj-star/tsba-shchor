# 🖤 צבע שחור — מדריך פריסה מלא

## קבצים
```
index.html    ← האפליקציה הראשית
sw.js         ← Service Worker להתראות ברקע
manifest.json ← PWA Manifest
```

---

## אפשרות 1: GitHub Pages (חינמי, מהיר)

1. צור חשבון ב-[github.com](https://github.com)
2. צור Repository חדש → `tzeva-shahor`
3. העלה את 3 הקבצים
4. Settings → Pages → Branch: `main` → Save
5. האתר יהיה ב: `https://username.github.io/tzeva-shahor`

---

## אפשרות 2: Netlify (חינמי, קל)

1. כנס ל-[netlify.com](https://netlify.com)
2. "Add new site" → "Deploy manually"
3. גרור את תיקיית הקבצים לאזור ה-Deploy
4. יקבל URL אוטומטי — אפשר להגדיר דומיין מותאם אישית

---

## אפשרות 3: Cloudflare Pages (חינמי, מהיר)

1. [pages.cloudflare.com](https://pages.cloudflare.com)
2. "Create application" → "Pages" → "Upload assets"
3. גרור את 3 הקבצים

---

## דרישות חובה לפני פריסה

### HTTPS
**חובה!** התראות push עובדות רק ב-HTTPS.
כל האפשרויות למעלה כוללות HTTPS אוטומטי.

---

## הגדרת הבוט בטלגרם

### פקודות זמינות:
| פקודה | פעולה |
|-------|--------|
| `/מחיקה` | מוחק את כל ההתראות מ-24 השעות האחרונות |
| `/סטטיסטיקה` | מציג כמה אנשים נרשמו ולאיזה אזורים |

### פורמט שליחת התראה:
```
שם הישוב
תיאור ההתראה
[קישור לתמונה - אופציונלי]
```

**דוגמה:**
```
צפת
הגיעו מלא שוטרים לרחוב צה"ל תבואו מהר
```

**עם תמונה:**
```
ירושלים
תבואו עכשיו לרחוב חשמונאים 5
https://example.com/photo.jpg
```

**לכל הארץ:**
```
כל הארץ
הודעה חשובה לכולם
```

---

## שדרוג לפוש רקע אמיתי (Push API)

כדי לשלוח התראות גם כשהדפדפן **לגמרי סגור**, צריך שרת VAPID.
הפתרון הכי פשוט — Firebase Cloud Messaging (חינמי):

1. צור פרויקט ב-[console.firebase.google.com](https://console.firebase.google.com)
2. Project Settings → Cloud Messaging → Web Push certificates → Generate key pair
3. שמור את ה-VAPID key
4. עדכן את `index.html` עם הקוד הבא:

```javascript
// החלף את startPolling() בפוש אמיתי:
const reg = await navigator.serviceWorker.ready;
const sub = await reg.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: 'YOUR_VAPID_PUBLIC_KEY'
});
// שלח את sub לשרת שלך
```

---

## הערות חשובות

- האתר עובד מיד עם הקבצים הנוכחיים — ה-polling לטלגרם רץ כל 10 שניות
- התראות יופיעו כל עוד הטאב פתוח (ואפשר גם בגרסת PWA מותקנת)
- לפוש מלא כשהדפדפן סגור — נדרש שרת (ראה למעלה)
