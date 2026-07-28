const { getStore } = require('@netlify/blobs');

exports.handler = async () => {
  try {
    const store = getStore('tablero-copackers');
    const entry = await store.getWithMetadata('latest');
    if (!entry) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Todavía no se subió ningún Excel' }),
      };
    }
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: entry.data,
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: String(err && err.message || err) }) };
  }
};
