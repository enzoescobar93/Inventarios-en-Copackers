const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }
  try {
    const store = getStore({ name: 'tablero-copackers', siteID: process.env.BLOBS_SITE_ID, token: process.env.BLOBS_TOKEN });
    const body = JSON.parse(event.body);
    await store.set('conteos', JSON.stringify(body));
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: String(err && err.message || err) }) };
  }
};
