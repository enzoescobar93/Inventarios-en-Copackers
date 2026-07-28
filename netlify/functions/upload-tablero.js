const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }
  try {
    const payload = event.body;
    // Validación mínima: que sea JSON parseable y tenga la forma esperada
    const parsed = JSON.parse(payload);
    if (!parsed || !parsed.sections || !parsed.top20) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Formato de datos inválido' }) };
    }
    const store = getStore({ name: 'tablero-copackers', siteID: process.env.BLOBS_SITE_ID, token: process.env.BLOBS_TOKEN });
    await store.set('latest', payload, {
      metadata: { updatedAt: new Date().toISOString() }
    });
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, updatedAt: new Date().toISOString() }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: String(err && err.message || err) }) };
  }
};
