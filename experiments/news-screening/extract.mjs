export function clean(value = '') {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/<(script|style|nav|footer|header|aside)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#(?:x([\da-f]+)|(\d+));/gi, (_, hex, decimal) => {
      const code = parseInt(hex || decimal, hex ? 16 : 10);
      return code <= 0x10ffff ? String.fromCodePoint(code) : '';
    }).replace(/&(?:nbsp|apos);/g, ' ').replace(/\s+/g, ' ').trim();
}

// Track matching container ends so nested divs do not truncate the article.
export function extractBody(html) {
  const sanitized = html.replace(/<!--[^]*?-->|<(script|style)\b[^>]*>[^]*?<\/\1>/gi, '');
  const containers = [];
  const stack = [];
  const tags = /<\/?([a-z][\w:-]*)\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
  for (const match of sanitized.matchAll(tags)) {
    const tag = match[1].toLowerCase();
    const closing = match[0].startsWith('</');
    if (closing) {
      const index = stack.findLastIndex(item => item.tag === tag);
      if (index < 0) continue;
      for (const item of stack.splice(index)) {
        if (item.selector) containers.push({ ...item, html: sanitized.slice(item.start, match.index) });
      }
      continue;
    }
    if (/^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(tag) || /\/>$/.test(match[0])) continue;
    const attributes = Object.fromEntries([...match[0].matchAll(/\b(id|class)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)]
      .map(attribute => [attribute[1].toLowerCase(), attribute[2] ?? attribute[3]]));
    const classes = (attributes.class || '').split(/\s+/);
    const selector = attributes.id === 'paragraph' ? '#paragraph'
      : classes.includes('post-content') ? '.post-content'
        : classes.includes('entry-content') ? '.entry-content'
          : ['article', 'main'].includes(tag) ? tag : '';
    stack.push({ tag, selector, start: match.index + match[0].length });
  }
  const candidates = containers.map(container => {
    const paragraphs = [...container.html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
      .map(match => clean(match[1])).filter(text => text.length >= 20 && !/^(?:Previous post|Next post|Related articles?|You may also like|Continue reading)\s*[:：]?/iu.test(text));
    return { selector: container.selector, paragraphs, characters: paragraphs.join(' ').length };
  });
  const preferred = candidates.filter(candidate => ['#paragraph', '.post-content', '.entry-content'].includes(candidate.selector));
  const selected = (preferred.length ? preferred : candidates).sort((a, b) => b.characters - a.characters)[0];
  const blocked = /<title[^>]*>[^<]*(?:just a moment|access denied|captcha)|cf-chl-|challenge-platform/iu.test(html);
  return {
    bodyEvidence: selected?.paragraphs || [],
    bodyStatus: selected?.characters >= 250 ? 'ok' : blocked ? 'blocked' : 'insufficient',
    bodySelector: selected?.selector || '',
    bodyCharacters: selected?.characters || 0
  };
}
