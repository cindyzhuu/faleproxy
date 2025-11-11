const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
// Allow overriding the port in tests/CI; default to 3001 locally
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

// Middleware to parse request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Route to serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint to fetch and modify content
app.post('/fetch', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Fetch the content from the provided URL
    const response = await axios.get(url);
    const html = response.data;

    // Use cheerio to parse HTML and selectively replace text content, not URLs
    const $ = cheerio.load(html);

    // Replace only text nodes (do not touch attributes/URLs)
    $('body *')
      .contents()
      .filter(function () {
        return this.nodeType === 3; // Text nodes only
      })
      .each(function () {
        const text = $(this).text();
        const newText = text
          .replace(/Yale/g, 'Fale')
          .replace(/yale/g, 'fale'); // keep YALE unchanged (tests cover case handling separately)
        if (text !== newText) {
          $(this).replaceWith(newText);
        }
      });

    // Process title separately
    const title = $('title')
      .text()
      .replace(/Yale/g, 'Fale')
      .replace(/yale/g, 'fale');
    $('title').text(title);

    return res.json({
      success: true,
      content: $.html(),
      title,
      originalUrl: url,
    });
  } catch (error) {
    console.error('Error fetching URL:', error.message);
    return res.status(500).json({
      error: `Failed to fetch content: ${error.message}`,
    });
  }
});

// Only start the server if this file is run directly (not when required by tests)
/* istanbul ignore next */
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Faleproxy server running at http://localhost:${PORT}`);
  });
}

module.exports = app;