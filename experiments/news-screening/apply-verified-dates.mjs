import fs from 'node:fs/promises';

const [inputPath, datesPath, outputPath] = process.argv.slice(2);
if (!inputPath || !datesPath || !outputPath) throw new Error('Usage: node apply-verified-dates.mjs INPUT DATES OUTPUT');
const source = JSON.parse(await fs.readFile(inputPath, 'utf8'));
const verified = JSON.parse(await fs.readFile(datesPath, 'utf8'));
const used = new Set();
const articles = source.articles.map(article => {
  const key = String(article.sampleNumber);
  const date = verified.dates[key];
  if (!date) return article;
  if (article.publishedAt) throw new Error(`Refusing to overwrite existing date for #${key}`);
  if (!/^2026-\d{2}-\d{2}$/u.test(date) || !article.url?.startsWith('https://')) throw new Error(`Invalid verified date/source for #${key}`);
  used.add(key);
  return { ...article, publishedAt: date, publishedAtEvidence: { sourceUrl: article.url, method: 'source_page_publication_date' } };
});
if (used.size !== Object.keys(verified.dates).length) throw new Error('Date list contains a sample number absent from input');
await fs.writeFile(outputPath, JSON.stringify({ ...source, articles }, null, 2) + '\n');
console.log(`Applied ${used.size} source dates; original input untouched`);
