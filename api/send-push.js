const webpush = require('web-push');

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE;
const DB_URL = 'https://fc-niksar-default-rtdb.europe-west1.firebasedatabase.app';

webpush.setVapidDetails('mailto:fc-niksar@example.com', VAPID_PUBLIC, VAPID_PRIVATE);

export default async function handler(req, res) {
  // CORS erlauben (GitHub Pages darf diese API aufrufen)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { title, body } = req.body;
  if (!title) return res.status(400).json({ error: 'title fehlt' });

  try {
    // Alle Push-Abonnements aus Firebase laden
    const fbRes = await fetch(`${DB_URL}/pushSubscriptions.json`);
    const subs = await fbRes.json();

    if (!subs) return res.status(200).json({ sent: 0 });

    const entries = Object.entries(subs);
    const payload = JSON.stringify({ title, body: body || '', url: 'https://fc-niksar-f1.github.io/fc-niksar/' });

    let sent = 0;
    const toDelete = [];

    await Promise.allSettled(entries.map(async ([key, sub]) => {
      try {
        await webpush.sendNotification(sub, payload);
        sent++;
      } catch(e) {
        if (e.statusCode === 410 || e.statusCode === 404) {
          toDelete.push(key); // Abgelaufene Abonnements merken
        }
      }
    }));

    // Abgelaufene Abonnements aus Firebase löschen
    await Promise.allSettled(toDelete.map(key =>
      fetch(`${DB_URL}/pushSubscriptions/${key}.json`, { method: 'DELETE' })
    ));

    return res.status(200).json({ sent, deleted: toDelete.length });
  } catch(e) {
    console.error('Push-Fehler:', e);
    return res.status(500).json({ error: e.message });
  }
}
