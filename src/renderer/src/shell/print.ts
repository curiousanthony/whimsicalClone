/**
 * Print / PDF entry point (Whimsical: Print > Save as PDF; PDFs always use light mode).
 * Forces the light theme while the print dialog renders, then restores it.
 */

export function printDocument(): void {
  const root = document.documentElement;
  const previous = root.dataset.theme;
  root.dataset.theme = 'light';
  root.classList.add('is-printing');
  const restore = () => {
    if (previous) root.dataset.theme = previous;
    root.classList.remove('is-printing');
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);
  // Let the light theme apply before the print snapshot.
  window.requestAnimationFrame(() => {
    window.print();
    // Some Chromium builds do not fire afterprint when cancelled synchronously.
    window.setTimeout(restore, 0);
  });
}
