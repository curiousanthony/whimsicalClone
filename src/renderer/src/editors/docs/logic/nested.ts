/**
 * Nested files on disk. Whimsical nests boards/docs "under" a doc; the local clone maps that to a
 * sibling folder named after the doc: the nested files of `Dir/Notes.md` live in `Dir/Notes/`,
 * so the sidebar shows them right next to their parent and `⌘Esc` can find the parent again.
 */

/** Folder that holds the nested files of a doc: `Dir/Notes.md` -> { dir: "Dir", name: "Notes" }. */
export function nestedFolderOf(docPath: string): { dir: string; name: string; path: string } {
  const slash = docPath.lastIndexOf('/');
  const dir = slash >= 0 ? docPath.slice(0, slash) : '';
  const base = slash >= 0 ? docPath.slice(slash + 1) : docPath;
  const dot = base.lastIndexOf('.');
  const name = dot > 0 ? base.slice(0, dot) : base;
  return { dir, name, path: dir ? `${dir}/${name}` : name };
}

/** Candidate parent doc of a nested file: `Dir/Notes/Child.wboard` -> `Dir/Notes.md`. */
export function parentDocOf(path: string): string | null {
  const slash = path.lastIndexOf('/');
  if (slash < 0) return null;
  return `${path.slice(0, slash)}.md`;
}

/** Anchor used by "Copy link to block" (GitHub-style heading slug). */
export function headingSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-');
}
