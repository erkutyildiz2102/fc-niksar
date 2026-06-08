const webpush = require('web-push');

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE;
const DB_URL = 'https://fc-niksar-default-rtdb.europe-west1.firebasedatabase.app';

webpush.setVapidDetails('mailto:fc-niksar@example.com', VAPID_PUBLIC, VAPID_PRIVATE);

async function sendPush(subs, toDelete, key, payload) {
  const sub = subs[key];
  if (!sub) return;
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload));
    return true;
  } catch (e) {
    if (e.statusCode === 410 || e.statusCode === 404) toDelete.push(key);
    return false;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    // Datum-Hilfsfunktion
    const fmtDate = (dateStr) => {
      const d = new Date(dateStr + 'T12:00:00');
      const days = ['So','Mo','Di','Mi','Do','Fr','Sa'];
      const months = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
      return `${days[d.getDay()]}, ${d.getDate()}. ${months[d.getMonth()]}`;
    };

    // Alle Daten aus Firebase laden
    const [trainingsRes, gamesRes, playersRes, subsRes] = await Promise.all([
      fetch(`${DB_URL}/trainings.json`),
      fetch(`${DB_URL}/games.json`),
      fetch(`${DB_URL}/players.json`),
      fetch(`${DB_URL}/pushSubscriptions.json`)
    ]);

    const [trainingsData, gamesData, playersData, subs] = await Promise.all([
      trainingsRes.json(),
      gamesRes.json(),
      playersRes.json(),
      subsRes.json()
    ]);

    if (!subs) return res.status(200).json({ sent: 0, message: 'Keine Subscriptions' });

    const toDelete = [];
    let sentCount = 0;

    // ── 1. TRAINING-REMINDER: Training in 2 Tagen, noch keine Abstimmung ──
    if (trainingsData) {
      const in2Days = new Date(today);
      in2Days.setDate(today.getDate() + 2);
      const in2DaysStr = in2Days.toISOString().slice(0, 10);

      const upcoming = Object.values(trainingsData).filter(t => t.date === in2DaysStr);

      for (const training of upcoming) {
        const payload = {
          title: '⏰ Training übermorgen!',
          body: `${fmtDate(training.date)}${training.time ? ' · ' + training.time + ' Uhr' : ''}${training.location ? ' · ' + training.location : ''} – Bitte noch abstimmen!`,
          url: 'https://fc-niksar-f1.github.io/fc-niksar/'
        };

        // Nur an Spieler senden die noch nicht abgestimmt haben
        // (pushSubscriptions sind pro Gerät, nicht pro Spieler → an alle senden)
        await Promise.allSettled(Object.keys(subs).map(async key => {
          const ok = await sendPush(subs, toDelete, key, payload);
          if (ok) sentCount++;
        }));
      }
    }

    // ── 2. SPIEL-KADER-REMINDER: Nominiert aber keine Rückmeldung seit ≥1 Tag ──
    if (gamesData && playersData) {
      const upcomingGames = Object.entries(gamesData)
        .map(([id, g]) => ({ id, ...g }))
        .filter(g => g.date >= todayStr);

      // Spieler-Map: pushKey → playerId (gespeichert in Firebase unter players/{id}/pushKey)
      // Da wir keinen direkten Mapping haben, nutzen wir players mit pushSubscriptionKey
      const playerMap = {}; // playerId → pushSubscriptionKey
      if (playersData) {
        Object.entries(playersData).forEach(([id, p]) => {
          if (p.pushKey) playerMap[id] = p.pushKey;
        });
      }

      for (const game of upcomingGames) {
        const squad = game.squad || {};
        const squadConfirm = game.squadConfirm || {};
        const createdAt = game.createdAt || 0;

        // Spiel muss mindestens 1 Tag alt sein (damit erste Push schon raus ist)
        const ageMs = Date.now() - createdAt;
        const oneDayMs = 24 * 60 * 60 * 1000;
        if (ageMs < oneDayMs) continue;

        // Nominierte Spieler ohne Rückmeldung finden
        const pendingPlayerIds = Object.keys(squad)
          .filter(pid => squad[pid] === true)
          .filter(pid => !squadConfirm[pid] || squadConfirm[pid] === 'open');

        if (pendingPlayerIds.length === 0) continue;

        const payload = {
          title: '⚽ Rückmeldung fürs Spiel fehlt noch!',
          body: `${game.opponent || 'Spiel'} · ${fmtDate(game.date)}${game.time ? ' · ' + game.time + ' Uhr' : ''} – Bitte zu- oder absagen!`,
          url: 'https://fc-niksar-f1.github.io/fc-niksar/'
        };

        // An Spieler mit bekanntem pushKey senden
        const sentToKeys = new Set();
        for (const pid of pendingPlayerIds) {
          const pushKey = playerMap[pid];
          if (pushKey && subs[pushKey] && !sentToKeys.has(pushKey)) {
            const ok = await sendPush(subs, toDelete, pushKey, payload);
            if (ok) { sentCount++; sentToKeys.add(pushKey); }
          }
        }

        // Falls kein pushKey-Mapping vorhanden: an alle senden (Fallback)
        if (sentToKeys.size === 0 && pendingPlayerIds.length > 0) {
          await Promise.allSettled(Object.keys(subs).map(async key => {
            const ok = await sendPush(subs, toDelete, key, payload);
            if (ok) sentCount++;
          }));
        }
      }
    }

    // Abgelaufene Subscriptions löschen
    await Promise.allSettled([...new Set(toDelete)].map(key =>
      fetch(`${DB_URL}/pushSubscriptions/${key}.json`, { method: 'DELETE' })
    ));

    return res.status(200).json({ sent: sentCount, deleted: toDelete.length });
  } catch (e) {
    console.error('Reminder-Fehler:', e);
    return res.status(500).json({ error: e.message });
  }
};
