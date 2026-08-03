const { getStore } = require('@netlify/blobs');

exports.handler = async () => {
  try {
    const store = getStore({ name: 'tablero-copackers', siteID: process.env.BLOBS_SITE_ID, token: process.env.BLOBS_TOKEN });
    const raw = await store.get('fx');
    const value = raw ? JSON.parse(raw).value : null;
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: String(err && err.message || err) }) };
  }
};
