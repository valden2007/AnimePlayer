const { test, describe, before, after, mock } = require('node:test');
const assert = require('node:assert');
const { AniLibriaProvider } = require('../../providers/anilibria');

describe('AniLibriaProvider', () => {
  let originalFetch;
  let provider;

  before(() => {
    originalFetch = global.fetch;
    provider = new AniLibriaProvider();
  });

  after(() => {
    global.fetch = originalFetch;
  });

  test('search returns normalized titles', async () => {
    global.fetch = async () => ({
      ok: true,
      json: async () => ([
        { id: 1, name: { main: 'Тест', english: 'Test' }, year: 2024, is_ongoing: true, genres: ['Экшен'], poster: { src: '/p.jpg' }, type: { description: 'ТВ' } }
      ])
    });
    const res = await provider.search('тест');
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].name, 'Тест');
    assert.strictEqual(res[0].provider, 'anilibria');
    assert.strictEqual(res[0].year, 2024);
  });

  test('getTitle returns normalized title', async () => {
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ id: 2, name: { main: 'Тайтл' }, year: 2023, is_ongoing: false, genres: ['Драма'], poster: { src: '/t.jpg' }, type: { value: 'TV' } })
    });
    const res = await provider.getTitle(2);
    assert.strictEqual(res.name, 'Тайтл');
    assert.strictEqual(res.status, 'Завершён');
  });

  test('getEpisodes returns normalized episodes with streams', async () => {
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ episodes: [
        { id: 'ep1', ordinal: 1, name: 'Серия 1', hls_720: 'https://example.com/720.m3u8', hls_1080: 'https://example.com/1080.m3u8', duration: 1400, opening: { start: 10, stop: 90 }, ending: { start: 1300, stop: 1380 } }
      ] })
    });
    const res = await provider.getEpisodes(1);
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].number, 1);
    assert.strictEqual(res[0].streams['720'], 'https://example.com/720.m3u8');
    assert.strictEqual(res[0].opening.start, 10);
  });

  test('getGenres returns array', async () => {
    global.fetch = async () => ({
      ok: true,
      json: async () => ([{ id: 1, name: 'Экшен' }, { id: 2, name: 'Комедия' }])
    });
    const res = await provider.getGenres();
    assert.strictEqual(res.length, 2);
    assert.strictEqual(res[0].name, 'Экшен');
  });

  test('getCatalog returns array', async () => {
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ data: [
        { id: 3, name: { main: 'Каталог' }, year: 2024, is_ongoing: true, genres: ['Экшен'], poster: { src: '/c.jpg' }, type: { description: 'ТВ' } }
      ] })
    });
    const res = await provider.getCatalog({ limit: 10 });
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].name, 'Каталог');
  });
});