const webpush = require('web-push');

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE;
const DB_URL = 'https://fc-niksar-default-rtdb.europe-west1.firebasedatabase.app';

webpush.setVapidDetails('mailto:fc-niksar@example.com', VAPID_PUBLIC, VAPID_PRIVATE);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Nur GET (Cron) erlauben
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Trainings aus Firebase laden
    const trainingsRes = await fetch(`${DB_URL}/trainings.json`);
    const trainingsData = await trainingsRes.json();

    if (!trainingsData) return res.status(200).json({ reminders: 0 });

    // Datum in 2 Tagen berechnen
    const today = new Date();
    const in2Days = new Date(today);
    in2Days.setDate(today.getDate() + 2);
    const in2DaysStr = in2Days.toISOString().slice(0, 10);

    // Trainings in 2 Tagen finden
    const upcomingTrainings = Object.values(trainingsData).filter(t => t.date === in2DaysStr);

    if (upcomingTrainings.length === 0) {
      return res.status(200).json({ reminders: 0, message: 'Kein Training in 2 Tagen' });
    }

    // Push-Subscriptions laden
    const subsRes = await fetch(`${DB_URL}/pushSubscriptions.json`);
    const subs = await subsRes.json();

    if (!subs) return res.status(200).json({ reminders: 0 });

    let sentCount = 0;
    const toDelete = [];

    for (const training of upcomingTrainings) {
      const dateStr = training.date || '';
      const timeStr = training.time || '';
      const location = training.location || '';

      // Datum formatieren
      const d = new Date(dateStr + 'T12:00:00');
      const dayNames = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
      const monthNames = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
      const dayLabel = `${dayNames[d.getDay()]}, ${d.getDate()}. ${monthNames[d.getMonth()]}`;

      const payload = JSON.stringify({
        title: '⏰ Training übermorgen!',
        body: `${dayLabel}${timeStr ? ' · ' + timeStr + ' Uhr' : ''}${location ? ' · ' + location : ''} – Bitte noch abstimmen!`,
        url: 'https://fc-niksar-f1.github.io/fc-niksar/'
      });

      const entries = Object.entries(subs);
      await Promise.allSettled(entries.map(async ([key, sub]) => {
        try {
          await webpush.sendNotification(sub, payload);
          sentCount++;
        } catch (e) {
          if (e.statusCode === 410 || e.statusCode === 404) {
            toDelete.push(key);
          }
        }
      }));
    }

    // Abgelaufene Subscriptions löschen
    await Promise.allSettled(toDelete.map(key =>
      fetch(`${DB_URL}/pushSubscriptions/${key}.json`, { method: 'DELETE' })
    ));

    return res.status(200).json({ reminders: sentCount, trainings: upcomingTrainings.length });
  } catch (e) {
    console.error('Reminder-Fehler:', e);
    return res.status(500).json({ error: e.message });
  }
};
