const { getStore } = require('@netlify/blobs');

exports.handler = async () => {
  try {
    const store = getStore('tablero-copackers');
    const raw = await store.get('conteos');
    const data = raw ? JSON.parse(raw) : {};
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: String(err && err.message || err) }) };
  }
};
