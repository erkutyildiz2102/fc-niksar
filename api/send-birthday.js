const webpush = require('web-push');

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE;
const DB_URL = 'https://fc-niksar-default-rtdb.europe-west1.firebasedatabase.app';

webpush.setVapidDetails('mailto:fc-niksar@example.com', VAPID_PUBLIC, VAPID_PRIVATE);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Heutiges Datum als MM-DD
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayMMDD = `${mm}-${dd}`;

    // Spieler aus Firebase laden
    const playersRes = await fetch(`${DB_URL}/players.json`);
    const playersData = await playersRes.json();

    if (!playersData) return res.status(200).json({ sent: 0 });

    // Spieler mit Geburtstag heute finden
    const birthdayKids = Object.values(playersData).filter(p => {
      if (!p.birthday) return false;
      // Format DD.MM.YYYY oder YYYY-MM-DD
      let mmdd;
      if (p.birthday.includes('.')) {
        const parts = p.birthday.split('.');
        mmdd = `${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
      } else {
        mmdd = p.birthday.slice(5);
      }
      return mmdd === todayMMDD;
    });

    if (birthdayKids.length === 0) {
      return res.status(200).json({ sent: 0, message: 'Kein Geburtstag heute' });
    }

    // Push-Subscriptions und Trainer-Devices laden
    const [subsRes, trainersRes] = await Promise.all([
      fetch(`${DB_URL}/pushSubscriptions.json`),
      fetch(`${DB_URL}/trainerDevices.json`)
    ]);
    const [subs, trainers] = await Promise.all([
      subsRes.json(),
      trainersRes.json()
    ]);
    if (!subs || !trainers) return res.status(200).json({ sent: 0, message: 'Keine Trainer registriert' });

    // Nur Trainer-Devices filtern
    const trainerSubs = {};
    for (const [key, sub] of Object.entries(subs)) {
      if (trainers[key]) {
        trainerSubs[key] = sub;
      }
    }
    if (Object.keys(trainerSubs).length === 0) return res.status(200).json({ sent: 0, message: 'Keine Trainer-Devices' });

    const names = birthdayKids.map(p => p.name || '?').join(', ');
    const ages  = birthdayKids.map(p => {
      if (!p.birthday) return null;
      const birthYear = p.birthday.includes('.')
        ? parseInt(p.birthday.split('.')[2], 10)
        : parseInt(p.birthday.slice(0, 4), 10);
      return today.getFullYear() - birthYear;
    });

    let body;
    if (birthdayKids.length === 1) {
      const age = ages[0];
      body = `🎉 ${names} wird heute ${age} Jahre alt! Herzlichen Glückwunsch! 🎂`;
    } else {
      body = `🎉 Heute haben ${birthdayKids.length} Kinder Geburtstag: ${names}! Herzlichen Glückwunsch! 🎂`;
    }

    const payload = JSON.stringify({
      title: '🎂 Geburtstag im Team!',
      body,
      url: 'https://fc-niksar-f1.github.io/fc-niksar/'
    });

    let sentCount = 0;
    const toDelete = [];
    const entries = Object.entries(trainerSubs);

    await Promise.allSettled(entries.map(async ([key, sub]) => {
      try {
        await webpush.sendNotification(sub, payload);
        sentCount++;
      } catch (e) {
        if (e.statusCode === 410 || e.statusCode === 404) toDelete.push(key);
      }
    }));

    // Abgelaufene Subscriptions löschen
    await Promise.allSettled(toDelete.map(key =>
      fetch(`${DB_URL}/pushSubscriptions/${key}.json`, { method: 'DELETE' })
    ));

    return res.status(200).json({ sent: sentCount, kids: birthdayKids.length, names, trainers: entries.length });
  } catch (e) {
    console.error('Birthday-Fehler:', e);
    return res.status(500).json({ error: e.message });
  }
};
