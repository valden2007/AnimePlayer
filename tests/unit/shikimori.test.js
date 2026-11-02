const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { ShikimoriProvider } = require('../../providers/shikimori');

describe('ShikimoriProvider', () => {
  let originalFetch;
  let provider;

  before(() => {
    originalFetch = global.fetch;
    provider = new ShikimoriProvider();
  });

  after(() => {
    global.fetch = originalFetch;
  });

  test('search returns normalized titles', async () => {
    global.fetch = async () => ({
      ok: true,
      json: async () => ([
        { id: 1, russian: 'Тест', name: 'Test', aired_on: '2024-01-01', status: 'ongoing', genres: [{ russian: 'Экшен', entry_type: 'Anime' }], image: { original: '/img.jpg' }, kind: 'tv' }
      ])
    });
    const res = await provider.search('тест');
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].name, 'Тест');
    assert.strictEqual(res[0].provider, 'shikimori');
    assert.strictEqual(res[0].year, 2024);
  });

  test('getTitle returns normalized title', async () => {
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ id: 2, russian: 'Тайтл', name: 'Title', aired_on: '2023-05-01', status: 'released', genres: [{ russian: 'Драма', entry_type: 'Anime' }], image: { original: '/t.jpg' }, kind: 'tv', score: '8.5' })
    });
    const res = await provider.getTitle(2);
    assert.strictEqual(res.name, 'Тайтл');
    assert.strictEqual(res.status, 'Завершён');
    assert.strictEqual(res.rating, 8.5);
  });

  test('getEpisodes returns empty array', async () => {
    const res = await provider.getEpisodes(1);
    assert.deepStrictEqual(res, []);
  });

  test('getGenres filters anime genres', async () => {
    global.fetch = async () => ({
      ok: true,
      json: async () => ([
        { id: 1, russian: 'Экшен', entry_type: 'Anime' },
        { id: 2, russian: 'Полиция', entry_type: 'Manga' }
      ])
    });
    const res = await provider.getGenres();
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].name, 'Экшен');
  });
});