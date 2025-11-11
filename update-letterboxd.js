/**
 * update-letterboxd.js
 * 
 * Scrapes Letterboxd diary and enriches with TMDb posters
 * Writes JSON to public/vkworkofficial-movies.json
 */

const cheerio = require('cheerio');
const fs = require('fs-extra');
const path = require('path');

const USERNAME = 'vkworkofficial';
const OUT_DIR = path.join(__dirname, 'public');
const OUT_FILE = path.join(OUT_DIR, `${USERNAME}-movies.json`);
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

// Small delay to prevent throttling
async function pfetch(url) {
  await new Promise(r => setTimeout(r, 300));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res;
}

// Scrape Letterboxd diary (first page)
async function scrapeDiaryPage() {
  const url = `https://letterboxd.com/${USERNAME}/films/page/1/`;
  console.log(`🔹 Scraping Letterboxd: ${url}`);
  const html = await (await pfetch(url)).text();
  const $ = cheerio.load(html);
  const entries = [];

  $('.poster-list .film-poster').each((i, el) => {
    const link = $(el).find('a').attr('href');
    const title = $(el).find('img').attr('alt');
    if (title) {
      entries.push({
        title: title.trim(),
        letterboxdUrl: link ? `https://letterboxd.com${link}` : null,
      });
    }
  });

  console.log(`🔹 Found ${entries.length} movies`);
  return entries;
}

// Search TMDb for poster
async function tmdbSearch(title) {
  const url = `${TMDB_BASE}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}`;
  const res = await (await pfetch(url)).json();
  return res.results?.[0] || null;
}

// Enrich entries with TMDb posters
async function enrich(entries) {
  const enriched = [];
  for (const e of entries) {
    try {
      const tm = await tmdbSearch(e.title);
      enriched.push({
        ...e,
        posterUrl: tm?.poster_path ? `${TMDB_IMAGE_BASE}${tm.poster_path}` : null,
      });
      console.log(`✅ Enriched "${e.title}"`);
    } catch (err) {
      console.warn(`⚠️ Failed to enrich "${e.title}":`, err.message);
      enriched.push({ ...e, posterUrl: null });
    }
  }
  return enriched;
}

// Main
(async () => {
  try {
    await fs.ensureDir(OUT_DIR);

    const entries = await scrapeDiaryPage();

    if (entries.length === 0) {
      console.warn('⚠️ No movies found on Letterboxd');
      await fs.writeJson(OUT_FILE, [], { spaces: 2 });
      console.log(`📄 Empty JSON written to ${OUT_FILE}`);
      return;
    }

    const enriched = await enrich(entries);

    await fs.writeJson(OUT_FILE, enriched, { spaces: 2 });
    console.log(`📄 JSON successfully written to ${OUT_FILE}`);
    console.log('🔹 Sample output:', enriched.slice(0, 3));

  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
})();
