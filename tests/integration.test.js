const axios = require('axios');
const cheerio = require('cheerio');
const nock = require('nock');
const app = require('../app'); // import the real Express app

// Test server handle
let server;
const TEST_PORT = 3099;
const baseURL = `http://127.0.0.1:${TEST_PORT}`;

describe('Integration Tests', () => {
  beforeAll(async () => {
    // Mock external HTTP requests; allow localhost only
    nock.disableNetConnect();
    nock.enableNetConnect('127.0.0.1');

    // Start the real app on a test port (no spawn/sed/cp)
    await new Promise((resolve) => {
      server = app.listen(TEST_PORT, () => resolve());
    });
  }, 10000);

  afterAll(async () => {
    // Close server and restore net connections
    if (server && server.close) {
      await new Promise((resolve) => server.close(() => resolve()));
    }
    nock.cleanAll();
    nock.enableNetConnect();
  });

  test('Should replace Yale with Fale in fetched content', async () => {
    const { sampleHtmlWithYale } = require('./test-utils');

    nock('https://example.com')
      .get('/')
      .reply(200, sampleHtmlWithYale);

    const response = await axios.post(`${baseURL}/fetch`, {
      url: 'https://example.com/'
    });

    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);

    const $ = cheerio.load(response.data.content);
    expect($('title').text()).toBe('Fale University Test Page');
    expect($('h1').text()).toBe('Welcome to Fale University');
    expect($('p').first().text()).toContain('Fale University is a private');

    // URLs remain unchanged
    let hasYaleUrl = false;
    $('a').each((_, link) => {
      const href = $(link).attr('href');
      if (href && href.includes('yale.edu')) hasYaleUrl = true;
    });
    expect(hasYaleUrl).toBe(true);

    // Link text changed
    expect($('a').first().text()).toBe('About Fale');
  }, 10000);

  test('Should handle invalid URLs', async () => {
    await expect(
      axios.post(`${baseURL}/fetch`, { url: 'not-a-valid-url' })
    ).rejects.toMatchObject({
      response: expect.objectContaining({ status: 500 })
    });
  });

  test('Should handle missing URL parameter', async () => {
    await expect(
      axios.post(`${baseURL}/fetch`, {})
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        status: 400,
        data: expect.objectContaining({ error: 'URL is required' })
      })
    });
  });
});
