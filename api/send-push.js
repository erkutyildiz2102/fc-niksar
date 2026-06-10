const webpush = require('web-push');

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE;
const DB_URL = 'https://fc-niksar-default-rtdb.europe-west1.firebasedatabase.app';

webpush.setVapidDetails('mailto:fc-niksar@example.com', VAPID_PUBLIC, VAPID_PRIVATE);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { title, body, excludeKey, page } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title fehlt' });

  try {
    const fbRes = await fetch(`${DB_URL}/pushSubscriptions.json`);
    const subs = await fbRes.json();

    if (!subs) return res.status(200).json({ sent: 0, message: 'Keine Abonnenten' });

    const entries = Object.entries(subs);
    console.log(`Push an ${entries.length} Abonnenten: "${title}" → Seite: ${page||'home'}`);

    const baseUrl = 'https://fc-niksar-f1.github.io/fc-niksar/';
    // Chat-Notifications → direkt in den Chat; alles andere → Startseite
    const targetUrl = page === 'chat' ? `${baseUrl}?page=chat` : baseUrl;

    const payload = JSON.stringify({
      title,
      body: body || '',
      url: targetUrl
    });

    let sent = 0;
    const toDelete = [];

    await Promise.allSettled(entries.map(async ([key, sub]) => {
      // Eigenen Sender überspringen
      if (excludeKey && key === excludeKey) return;
      try {
        await webpush.sendNotification(sub, payload);
        sent++;
        console.log(`Gesendet an: ${key}`);
      } catch(e) {
        console.error(`Fehler fuer ${key}: ${e.statusCode} - ${e.message}`);
        if (e.statusCode === 410 || e.statusCode === 404) toDelete.push(key);
      }
    }));

    await Promise.allSettled(toDelete.map(key =>
      fetch(`${DB_URL}/pushSubscriptions/${key}.json`, { method: 'DELETE' })
    ));

    console.log(`Ergebnis: ${sent} gesendet, ${toDelete.length} geloescht`);
    return res.status(200).json({ sent, deleted: toDelete.length });

  } catch(e) {
    console.error('API Fehler:', e.message);
    return res.status(500).json({ error: e.message });
  }
};