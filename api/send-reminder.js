const webpush = require('web-push');

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE;
const DB_URL = 'https://fc-niksar-default-rtdb.europe-west1.firebasedatabase.app';

webpush.setVapidDetails('mailto:fc-niksar@example.com', VAPID_PUBLIC, VAPID_PRIVATE);

const BASE_URL = 'https://fc-niksar-f1.github.io/fc-niksar/';

// Datum formatieren: "Fr, 13. Jun"
function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const days   = ['So','Mo','Di','Mi','Do','Fr','Sa'];
  const months = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  return `${days[d.getDay()]}, ${d.getDate()}. ${months[d.getMonth()]}`;
}

// Push an eine Subscription senden
async function sendPush(sub, toDelete, key, payload) {
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload));
    return true;
  } catch (e) {
    if (e.statusCode === 410 || e.statusCode === 404) toDelete.push(key);
    return false;
  }
}

// Push an ALLE Subscriber senden
async function pushToAll(subs, toDelete, payload) {
  let sent = 0;
  await Promise.allSettled(Object.entries(subs).map(async ([key, sub]) => {
    const ok = await sendPush(sub, toDelete, key, payload);
    if (ok) sent++;
  }));
  return sent;
}

// Firebase-Wert schreiben
async function fbSet(path, value) {
  await fetch(`${DB_URL}/${path}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value)
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const now = Date.now();
    const TEST_MODE = process.env.REMINDER_TEST === 'true';
    const REMIND_AFTER_MS = TEST_MODE ? 2 * 60 * 1000        : 5 * 60 * 60 * 1000;  // Test: 2min | Prod: 5h
    const WINDOW_MS       = TEST_MODE ? 60 * 60 * 1000       : 60 * 60 * 1000;       // 1 Stunde Fenster
    const todayStr = new Date().toISOString().slice(0, 10);

    // Nur zwischen 08:00 und 21:00 Uhr (Europe/Berlin) senden
    const berlinHour = new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin', hour: 'numeric', hour12: false });
    const hour = parseInt(berlinHour);
    if (hour < 8 || hour >= 21) {
      return res.status(200).json({ sent: 0, message: `Außerhalb Sendezeit (${hour}:xx Uhr)` });
    }

    // Alles aus Firebase laden
    const [trainingsRes, gamesRes, pollsRes, subsRes, playersRes, trainerDevicesRes] = await Promise.all([
      fetch(`${DB_URL}/trainings.json`),
      fetch(`${DB_URL}/games.json`),
      fetch(`${DB_URL}/polls.json`),
      fetch(`${DB_URL}/pushSubscriptions.json`),
      fetch(`${DB_URL}/players.json`),
      fetch(`${DB_URL}/trainerDevices.json`)
    ]);

    const [trainingsData, gamesData, pollsData, subs, playersData, trainerDevices] = await Promise.all([
      trainingsRes.json(),
      gamesRes.json(),
      pollsRes.json(),
      subsRes.json(),
      playersRes.json(),
      trainerDevicesRes.json()
    ]);

    if (!subs) return res.status(200).json({ sent: 0, message: 'Keine Subscriptions' });

    const toDelete = [];
    let sentCount  = 0;
    const debugLog = [];

    // ──────────────────────────────────────────────
    // 1. TRAINING: 5h nach Erstellung, noch offene Stimmen
    // ──────────────────────────────────────────────
    if (trainingsData) {
      for (const [id, t] of Object.entries(trainingsData)) {
        const age = now - t.createdAt;
        const ageH = Math.round(age / 3600000 * 10) / 10;

        if (t.reminderSent) { debugLog.push(`${id.slice(-6)}: skip – reminderSent`); continue; }
        if (!t.createdAt)   { debugLog.push(`${id.slice(-6)}: skip – no createdAt`); continue; }
        if (t.date < todayStr) { debugLog.push(`${id.slice(-6)}: skip – past (${t.date})`); continue; }
        if (t.cancelled)    { debugLog.push(`${id.slice(-6)}: skip – cancelled`); continue; }
        if (age < REMIND_AFTER_MS) { debugLog.push(`${id.slice(-6)}: skip – too young (${ageH}h)`); continue; }

        const attendances = t.attendances || {};
        const total    = Object.keys(attendances).length;
        const answered = Object.values(attendances).filter(v => v === 'yes' || v === 'no').length;
        const open     = total - answered;

        if (open === 0) {
          debugLog.push(`${id.slice(-6)}: skip – all answered`);
          await fbSet(`trainings/${id}/reminderSent`, true);
          continue;
        }

        debugLog.push(`${id.slice(-6)}: SEND – ${open} open, ${ageH}h old, subs=${Object.keys(subs).length}`);
        const payload = {
          title: '⏰ Rückmeldung fürs Training fehlt noch!',
          body: `${fmtDate(t.date)}${t.time ? ' · ' + t.time + ' Uhr' : ''}${t.location ? ' · ' + t.location : ''} – Bitte zu- oder absagen!`,
          url: BASE_URL + '?page=termine'
        };

        const pushed = await pushToAll(subs, toDelete, payload);
        sentCount += pushed;
        debugLog.push(`${id.slice(-6)}: pushed=${pushed}`);
        if (pushed > 0) await fbSet(`trainings/${id}/reminderSent`, true);
      }
    }

    // ──────────────────────────────────────────────
    // 2. SPIEL: 5h nach Erstellung, Kader ohne Rückmeldung
    // ──────────────────────────────────────────────
    if (gamesData) {
      for (const [id, g] of Object.entries(gamesData)) {
        if (g.reminderSent) continue;
        if (!g.createdAt) continue;
        if (g.date < todayStr) continue;

        const age = now - g.createdAt;
        if (age < REMIND_AFTER_MS) continue;

        // Nominierte Spieler ohne Bestätigung
        const squad        = g.squad || {};
        const squadConfirm = g.squadConfirm || {};
        const nominated    = Object.keys(squad).filter(pid => squad[pid] === true);
        const confirmed    = nominated.filter(pid => squadConfirm[pid] === 'yes' || squadConfirm[pid] === 'no');
        const open         = nominated.length - confirmed.length;

        if (nominated.length > 0 && open === 0) {
          await fbSet(`games/${id}/reminderSent`, true);
          continue;
        }

        const payload = {
          title: '⚽ Rückmeldung fürs Spiel fehlt noch!',
          body: `${g.opponent || 'Spiel'} · ${fmtDate(g.date)}${g.time ? ' · ' + g.time + ' Uhr' : ''} – Bitte zu- oder absagen!`,
          url: BASE_URL + '?page=termine'
        };

        const pushedG = await pushToAll(subs, toDelete, payload);
        sentCount += pushedG;
        if (pushedG > 0) await fbSet(`games/${id}/reminderSent`, true);
      }
    }

    // ──────────────────────────────────────────────
    // 3. ABSTIMMUNG: 5h nach Erstellung, noch nicht alle abgestimmt
    // ──────────────────────────────────────────────
    if (pollsData) {
      const subsCount = Object.keys(subs).length;

      for (const [id, p] of Object.entries(pollsData)) {
        if (p.reminderSent) continue;
        if (!p.createdAt) continue;

        // Abgelaufene Abstimmungen überspringen
        if (p.deadline && p.deadline < todayStr) continue;

        const age = now - p.createdAt;
        if (age < REMIND_AFTER_MS) continue;

        const votes     = p.votes || {};
        const voteCount = Object.keys(votes).length;

        // Wenn alle abgestimmt haben, keinen Reminder nötig
        if (subsCount > 0 && voteCount >= subsCount) {
          await fbSet(`polls/${id}/reminderSent`, true);
          continue;
        }

        const question = (p.question || 'Abstimmung').slice(0, 60);
        const payload = {
          title: '🗳️ Noch nicht abgestimmt?',
          body: `„${question}" – Bitte jetzt abstimmen!`,
          url: BASE_URL + '?page=home'
        };

        const pushedP = await pushToAll(subs, toDelete, payload);
        sentCount += pushedP;
        if (pushedP > 0) await fbSet(`polls/${id}/reminderSent`, true);
      }
    }

    // ──────────────────────────────────────────────
    // 4. GEBURTSTAG: Täglich um 09:00 Uhr → nur an Trainer
    // ──────────────────────────────────────────────
    const hour09 = new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin', hour: 'numeric', hour12: false });
    if (parseInt(hour09) === 9 && playersData && trainerDevices) {
      const todayMMDD = todayStr.slice(5); // "06-10"
      const birthdays = [];

      // Alle Spieler durchgehen und Geburtstage heute finden
      for (const [id, p] of Object.entries(playersData)) {
        if (p.birthday) {
          // Format kann DD.MM.YYYY oder YYYY-MM-DD sein
          let birthdayMMDD;
          if (p.birthday.includes('.')) {
            const parts = p.birthday.split('.');
            birthdayMMDD = `${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
          } else {
            birthdayMMDD = p.birthday.slice(5);
          }
          if (birthdayMMDD === todayMMDD) {
            birthdays.push(p.name || 'Spieler');
          }
        }
      }

      // Wenn Geburtstage heute, an alle Trainer pushen
      if (birthdays.length > 0) {
        const trainerSubs = {};
        for (const [key, sub] of Object.entries(subs)) {
          if (trainerDevices[key]) { // Nur wenn das Gerät als Trainer markiert ist
            trainerSubs[key] = sub;
          }
        }

        if (Object.keys(trainerSubs).length > 0) {
          const payload = {
            title: '🎂 Heute Geburtstag!',
            body: birthdays.join(', '),
            url: BASE_URL + '?page=team'
          };
          sentCount += await pushToAll(trainerSubs, toDelete, payload);
          console.log(`🎂 Geburtstags-Push an ${Object.keys(trainerSubs).length} Trainer: ${birthdays.join(', ')}`);
        }
      }
    }

    // Abgelaufene Subscriptions aufräumen
    await Promise.allSettled([...new Set(toDelete)].map(key =>
      fetch(`${DB_URL}/pushSubscriptions/${key}.json`, { method: 'DELETE' })
    ));

    console.log(`Reminder: ${sentCount} Pushes gesendet, ${toDelete.length} Subs gelöscht`);
    return res.status(200).json({ sent: sentCount, deleted: toDelete.length, debug: debugLog });

  } catch (e) {
    console.error('Reminder-Fehler:', e);
    return res.status(500).json({ error: e.message });
  }
};
