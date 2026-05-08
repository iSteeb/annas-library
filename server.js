require('dotenv').config();

const os = require('os');
const path = require('path');
const express = require('express');
const { generateRootCatalog, generateOpenSearch, generateLanguageCatalog, generateContentTypeCatalog, generateCategoryCatalog } = require('./lib/catalog');
const api = require('./lib/api');
const { handleSearch, handlePopular, handleDownload, getBaseUrl, OPDS_CONTENT_TYPE } = require('./lib/routes');

const app = express();
const PORT = process.env.PORT || 3000;


const { createServer: createViteServer } = require('vite');

async function startServer() {
  const isDev = process.env.NODE_ENV === 'development';
  const clientBuildPath = path.join(__dirname, 'client', 'dist');

  let vite;
  if (isDev) {
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
      root: path.join(__dirname, 'client')
    });
    app.use(vite.middlewares);
  }

  // API & OPDS Routes (same as before)
  const route = (contentType, generator) => (req, res) =>
    res.set('Content-Type', contentType)
      .send(generator(getBaseUrl(req), ...Object.values({ ...req.params, ...req.query })));

  app.get('/api/books', api.getBooks);
  app.get('/api/books/:md5', api.getBook);
  app.get('/api/popular/:lang', api.getPopular);
  app.get('/api/categories', api.getCategories);
  app.get('/api/content-types', api.getContentTypes);
  app.get('/api/languages', api.getLanguages);
  app.get('/api/zlib-detail/:id/:hash', api.getZlibDetail);
  app.get('/api/similar/:id/:hash', api.getSimilar);
  app.get('/api/recommended/:id', api.getRecommended);
  
  // Translation endpoints - serve category translations with proper encoding
  app.get('/api/translations/categories/:lang', (req, res) => {
    try {
      const { getTranslation } = require('./lib/translations');
      const lang = req.params.lang === 'fr' ? 'fr' : 'en';
      const translations = getTranslation(lang, 'categories');
      res.json({ success: true, data: translations });
    } catch (error) {
      console.error('[API] Translations error:', error.message);
      res.status(500).json({ success: false, error: 'Failed to fetch translations' });
    }
  });

  app.get('/opds', route(OPDS_CONTENT_TYPE, generateRootCatalog));
  app.get('/opds/search', handleSearch);
  app.get('/opds/:lang(en|fr)', route(OPDS_CONTENT_TYPE, generateLanguageCatalog));
  app.get('/opds/:lang(en|fr)/popular', handlePopular);
  app.get('/opds/:lang(en|fr)/:contentType', route(OPDS_CONTENT_TYPE, generateContentTypeCatalog));
  app.get('/opds/:lang(en|fr)/:contentType/:category', route(OPDS_CONTENT_TYPE, generateCategoryCatalog));
  app.get('/download/:md5', handleDownload);
  app.get('/opensearch.xml', route('application/opensearchdescription+xml', generateOpenSearch));

  // Serve the public local files (cached books)
  const LOCAL_DIR = process.env.LOCAL_BOOKS_DIR || path.join(require('os').homedir(), 'annas-books');
  app.use('/annas', express.static(LOCAL_DIR));

  if (!isDev) {
    app.use(express.static(clientBuildPath));
  }

  // Catch-all
  app.get('*', async (req, res) => {
    const url = req.originalUrl;
    
    if (isDev) {
      try {
        let template = require('fs').readFileSync(path.resolve(__dirname, 'client/index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e);
        res.status(500).end(e.stack);
      }
    } else {
      if (req.path.startsWith('/opds') || req.path.startsWith('/api')) {
        return res.status(404).send('Not found');
      }
      res.sendFile(path.join(clientBuildPath, 'index.html'));
    }
  });


  app.listen(PORT, () => {
    console.log(`\n✨ OPDS Server (${isDev ? 'Development' : 'Production'}) started on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});