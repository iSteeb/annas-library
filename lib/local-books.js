const fs = require('fs');
const path = require('path');

const LOCAL_DIR = process.env.LOCAL_BOOKS_DIR || path.join(require('os').homedir(), 'annas-books');

function getLocalBooksSet() {
  const set = new Set();
  if (fs.existsSync(LOCAL_DIR)) {
    try {
      const files = fs.readdirSync(LOCAL_DIR);
      for (const file of files) {
        const match = file.match(/^([a-fA-F0-9]{32})\./i);
        if (match) {
          set.add(match[1].toLowerCase());
        }
      }
    } catch (e) {
      console.error('[LOCAL_BOOKS] Error reading directory:', e.message);
    }
  }
  return set;
}

function getLocalBookFile(md5) {
  if (!md5) return null;
  if (fs.existsSync(LOCAL_DIR)) {
    try {
      const files = fs.readdirSync(LOCAL_DIR);
      for (const file of files) {
        if (file.toLowerCase().startsWith(md5.toLowerCase() + '.')) {
          return file;
        }
      }
    } catch (e) {
      console.error('[LOCAL_BOOKS] Error matching file:', e.message);
    }
  }
  return null;
}

module.exports = { 
  LOCAL_DIR, 
  getLocalBooksSet, 
  getLocalBookFile 
};