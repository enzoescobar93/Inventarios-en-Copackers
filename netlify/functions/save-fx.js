const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }
  try {
    const body = JSON.parse(event.body);
    const value = Number(body.value);
    if (!isFinite(value) || value <= 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Valor de FX inválido' }) };
    }
    const store = getStore({ name: 'tablero-copackers', siteID: process.env.BLOBS_SITE_ID, token: process.env.BLOBS_TOKEN });
    await store.set('fx', JSON.stringify({ value, updatedAt: new Date().toISOString() }));
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, value }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: String(err && err.message || err) }) };
  }
};
