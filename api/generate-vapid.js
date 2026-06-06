const webpush = require('web-push');

module.exports = async function handler(req, res) {
  const keys = webpush.generateVAPIDKeys();
  res.status(200).json({
    publicKey: keys.publicKey,
    privateKey: keys.privateKey,
    info: 'Kopiere beide Keys in Vercel Environment Variables!'
  });
};