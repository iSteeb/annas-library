const { searchBooks, getBookDetails, getActualDownloadLink, getPopularBooks } = require('./scraper');
const { generateBooksFeed } = require('./catalog');
const { LOCAL_DIR, getLocalBookFile } = require('./local-books');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');

const getBaseUrl = (req) => `${req.protocol}://${req.get('host')}`;
const OPDS_CONTENT_TYPE = 'application/atom+xml;profile=opds-catalog';

const handleSearch = async (req, res) => {
  try {
    let { q = '', lang = '', content = '', category = '', page = 1 } = req.query;
    
    // Parse JSON data if provided
    if (req.query.data) {
      try {
        ({ q, lang, content, category, page } = JSON.parse(decodeURIComponent(req.query.data)));
      } catch (e) { 
        console.error('Parse error:', e); 
      }
    }
    
    const baseUrl = getBaseUrl(req);
    const books = await searchBooks(q, lang, content, category, +page);
    const localMd5s = getLocalBooksSet();
    books.forEach(b => b.isLocal = localMd5s.has(b.md5?.toLowerCase()));
    
    // Sort local books to the top
    books.sort((a, b) => {
      const aLocal = a.isLocal ? 1 : 0;
      const bLocal = b.isLocal ? 1 : 0;
      return bLocal - aLocal;
    });
    
    // Build search URL
    const params = new URLSearchParams({ lang, content, category });
    params.toString(); // Filters empty values
    
    res.set('Content-Type', OPDS_CONTENT_TYPE).send(generateBooksFeed(
      books, 
      baseUrl, 
      q,
      `urn:opds:search:${[q, lang, content, category, page > 1 ? page : ''].filter(Boolean).join(':')}`,
      `${baseUrl}/opensearch.xml${params ? '?' + params : ''}`,
      lang || 'en', 
      category, 
      content, 
      +page, 
      books.length === 50
    ));
  } catch (error) {
    console.error(`Search error: ${error.message}`);
    res.status(500).send('Search failed');
  }
};

const handlePopular = async (req, res) => {
  try {
    const { lang = 'en' } = req.params;
    const { page = 1 } = req.query;
    const baseUrl = getBaseUrl(req);
    
    const { books, nextPage } = await getPopularBooks(lang, +page);
    const localMd5s = getLocalBooksSet();
    books.forEach(b => b.isLocal = localMd5s.has(b.md5?.toLowerCase()));
    
    // Sort local books to the top
    books.sort((a, b) => {
      const aLocal = a.isLocal ? 1 : 0;
      const bLocal = b.isLocal ? 1 : 0;
      return bLocal - aLocal;
    });
    
    res.set('Content-Type', OPDS_CONTENT_TYPE).send(generateBooksFeed(
      books,
      baseUrl,
      '',
      `urn:opds:popular:${lang}:${page}`,
      null,
      lang,
      null,
      'popular',
      +page,
      !!nextPage
    ));
  } catch (error) {
    console.error(`Popular books error: ${error.message}`);
    res.status(500).send('Failed to fetch popular books');
  }
};

const handleDownload = async (req, res) => {
  let { md5 } = req.params;
  const { resolve } = req.query;

  try {
    // 1. Check if we already have it locally
    const existingFile = getLocalBookFile(md5);
    if (existingFile) {
      if (resolve === 'true') {
        const publicUrl = `/annas/${existingFile}`;
        return res.json({ url: publicUrl });
      }
      return res.redirect(`/annas/${existingFile}`);
    }

    // 2. Otherwise fetch details and get remote download link
    const book = await getBookDetails(md5);
    if (book?.downloadLinks?.length) {
      const actualLink = await getActualDownloadLink(book.downloadLinks[0]);
      
      if (actualLink) {
        let resolvedUrl = actualLink;
        
        // Run background download
        const ext = actualLink.split('?')[0].split('.').pop() || 'epub';
        const targetFile = path.join(LOCAL_DIR, `${md5}.${ext}`);

        if (!fs.existsSync(LOCAL_DIR)) {
          fs.mkdirSync(LOCAL_DIR, { recursive: true });
        }
        
        // Make fetch have no arbitrary timeout block here, Node default is often fine or we can extend it.
        fetch(actualLink, { signal: AbortSignal.timeout(600000) }).then(response => {
          if (response.ok && response.body) {
            const dest = fs.createWriteStream(targetFile);
            Readable.fromWeb(response.body).pipe(dest);
            console.log(`[DOWNLOAD] Background caching started: ${targetFile}`);
            dest.on('finish', () => console.log(`[DOWNLOAD] Background cached successfully: ${targetFile}`));
            dest.on('error', (err) => {
              console.error(`[DOWNLOAD] Stream write error:`, err);
              fs.unlink(targetFile, () => {});
            });
          } else {
            console.error(`[DOWNLOAD] Non-ok background fetch: ${response.status}`);
          }
        }).catch(err => console.error('[DOWNLOAD] Background fetch failed:', err.message));

        if (resolve === 'true') {
          return res.json({ url: resolvedUrl });
        }
        
        return res.redirect(resolvedUrl);
      }
    }
    return res.status(404).send('Could not download the book');
  } catch (error) {
    console.error(`Download error: ${error.message}`);
    return res.status(500).send('Could not download the book');
  }
};

module.exports = {
  handleSearch,
  handlePopular,
  handleDownload,
  getBaseUrl,
  OPDS_CONTENT_TYPE
};
