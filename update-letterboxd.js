const cheerio = require('cheerio');
const fs = require('fs-extra');
const path = require('path');

const USERNAME = 'vkworkofficial';
const OUT_FILE = path.join(__dirname, 'public', `${USERNAME}-movies.json`);
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

// Simple fetch with delay
async function pfetch(url) {
  await new Promise(r => setTimeout(r, 300)); // throttle requests
  const res = await fetch(url); // Node 18 native fetch
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res;
}

// Scrape public Letterboxd diary page (page 1 for now)
async function scrapeDiaryPage() {
  const url = `https://letterboxd.com/${USERNAME}/films/page/1/`;
  const html = await (await pfetch(url)).text();
  const $ = cheerio.load(html);
  const entries = [];

  $('.poster-list .film-poster').each((i, el) => {
    const link = $(el).find('a').attr('href');
    const title = $(el).find('img').attr('alt');
    entries.push({
      title: title?.trim(),
      letterboxdUrl: link ? `https://letterboxd.com${link}` : null
    });
  });

  return entries;
}

// TMDb search for poster
async function tmdbSearch(title) {
  const url = `${TMDB_BASE}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}`;
  const res = await (await pfetch(url)).json();
  return res.results?.[0] || null;
}

// Enrich with TMDb poster
async function enrich(entries) {
  const enriched = [];
  for (const e of entries) {
    const tm = await tmdbSearch(e.title);
    enriched.push({
      ...e,
      posterUrl: tm?.poster_path ? `${TMDB_IMAGE_BASE}${tm.poster_path}` : null
    });
  }
  return enriched;
}

// Main
(async () => {
  await fs.ensureDir(path.join(__dirname, 'public'));
  const entries = await scrapeDiaryPage();
  const enriched = await enrich(entries);
  await fs.writeJson(OUT_FILE, enriched, { spaces: 2 });
  console.log('JSON written to', OUT_FILE);
})();
