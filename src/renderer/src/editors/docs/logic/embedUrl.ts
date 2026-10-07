/** External embed providers (research 03 section 6.1). Embeds render as link cards offline. */

export type EmbedProvider = 'youtube' | 'vimeo' | 'loom' | 'figma' | 'airtable' | 'canva' | 'hex' | 'codepen' | 'whimsical' | 'link';

const HOSTS: Array<[RegExp, EmbedProvider]> = [
  [/(^|\.)youtube\.com$|(^|\.)youtu\.be$/, 'youtube'],
  [/(^|\.)vimeo\.com$/, 'vimeo'],
  [/(^|\.)loom\.com$/, 'loom'],
  [/(^|\.)figma\.com$/, 'figma'],
  [/(^|\.)airtable\.com$/, 'airtable'],
  [/(^|\.)canva\.com$/, 'canva'],
  [/(^|\.)hex\.(tech|dev)$/, 'hex'],
  [/(^|\.)codepen\.io$/, 'codepen'],
  [/(^|\.)whimsical\.com$/, 'whimsical'],
];

export function parseEmbedUrl(raw: string): { url: string; host: string; provider: EmbedProvider } | null {
  const text = raw.trim();
  if (!/^https?:\/\//i.test(text)) return null;
  try {
    const u = new URL(text);
    const host = u.hostname.replace(/^www\./, '');
    const provider = HOSTS.find(([re]) => re.test(host))?.[1] ?? 'link';
    return { url: u.toString(), host, provider };
  } catch {
    return null;
  }
}
