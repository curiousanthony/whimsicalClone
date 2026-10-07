/**
 * Export dialog (Whimsical Share > Export): PNG (1x/2x, background or transparent, selection
 * only) and SVG through the editor's exporter; PDF through the print dialog; Markdown for
 * docs (download .md or copy).
 */

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { titleFromPath } from '@shared/fileKinds';
import { Button, Modal, SegmentedControl, Switch } from '@renderer/ui';
import { getExporter, subscribeExporters, type ExportFormat, type ExportOptions } from '../exporters';
import { printDocument } from '../print';
import { pluginFor, useDocuments } from '../state/documents';
import { useResolvedTheme } from '../state/prefs';
import { useActiveTab } from '../state/tabs';
import { closeOverlay, showToast } from '../state/ui';

const EXTENSIONS: Record<ExportFormat, string> = { png: 'png', svg: 'svg', pdf: 'pdf', markdown: 'md' };

export function ExportDialog(): JSX.Element {
  const { t } = useTranslation(['shell', 'common']);
  const tab = useActiveTab();
  const path = tab?.kind === 'file' ? tab.path : null;
  const doc = useDocuments((s) => (path ? s.docs[path] : undefined));
  const plugin = path ? pluginFor(path) : undefined;
  const isDoc = plugin?.kind === 'doc';
  const theme = useResolvedTheme();
  const exporterVersion = useSyncExternalStore(subscribeExporters, () => (path ? getExporter(path) : undefined));
  const exporter = exporterVersion;
  // Canvas files offer PNG / SVG only when their editor registered an exporter for them.
  const imageFormats = (['png', 'svg'] as const).filter((f) => exporter?.formats.includes(f));
  const formats: ExportFormat[] = isDoc ? ['markdown', 'pdf'] : [...imageFormats, 'pdf'];
  const [format, setFormat] = useState<ExportFormat>(formats[0]!);
  const [scale, setScale] = useState<'1' | '2'>('2');
  const [transparent, setTransparent] = useState(false);
  const [selectionOnly, setSelectionOnly] = useState(false);
  const [busy, setBusy] = useState(false);

  const defaultFormat = formats[0]!;
  useEffect(() => setFormat(defaultFormat), [defaultFormat]);

  const markdown = useMemo(() => {
    if (!isDoc || !plugin || doc?.status !== 'ready') return '';
    try {
      return plugin.serialize(doc.content);
    } catch {
      return '';
    }
  }, [isDoc, plugin, doc]);

  const name = path ? titleFromPath(path) : '';
  const supported = format === 'pdf' || (format === 'markdown' ? isDoc : !!exporter?.formats.includes(format));
  const hasSelection = exporter?.hasSelection?.() ?? false;
  const options: ExportOptions = {
    scale: scale === '2' ? 2 : 1,
    transparent,
    selectionOnly: selectionOnly && hasSelection,
    theme,
  };

  const produce = async (): Promise<Blob | ArrayBuffer | string> => {
    if (format === 'markdown') {
      return exporter?.formats.includes('markdown') ? exporter.export('markdown', options) : markdown;
    }
    if (!exporter) throw new Error(t('export.unavailable', { format: format.toUpperCase() }));
    return exporter.export(format, options);
  };

  const save = async () => {
    if (format === 'pdf') {
      closeOverlay();
      printDocument();
      return;
    }
    setBusy(true);
    try {
      const data = await produce();
      const payload = data instanceof Blob ? await data.arrayBuffer() : data;
      const ext = EXTENSIONS[format];
      const result = await window.api.app.saveExport(
        {
          title: t('export.dialogTitle'),
          defaultName: `${name}.${ext}`,
          filters: [{ name: t(`export.${format}`), extensions: [ext] }],
        },
        payload,
      );
      if (result.ok && result.value) {
        showToast(t('export.saved', { path: result.value }));
        closeOverlay();
      } else if (!result.ok) showToast(t('export.failed', { message: result.message }), 'error');
    } catch (error) {
      showToast(t('export.failed', { message: error instanceof Error ? error.message : String(error) }), 'error');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    setBusy(true);
    try {
      const data = await produce();
      if (typeof data === 'string') await navigator.clipboard.writeText(data);
      else {
        const blob = data instanceof Blob ? data : new Blob([data], { type: 'image/png' });
        await navigator.clipboard.write([new ClipboardItem({ [blob.type || 'image/png']: blob })]);
      }
      showToast(t('export.copied'));
      closeOverlay();
    } catch (error) {
      showToast(t('export.failed', { message: error instanceof Error ? error.message : String(error) }), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!path || !plugin) {
    return (
      <Modal open onClose={closeOverlay} title={t('export.dialogTitle')} closeLabel={t('common:actions.close')}>
        <p>{t('export.noFile')}</p>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={closeOverlay}
      title={t('export.title', { name })}
      closeLabel={t('common:actions.close')}
      width={520}
      footer={
        <>
          {format !== 'pdf' && (
            <Button onClick={() => void copy()} disabled={!supported || busy}>
              {t('export.copy')}
            </Button>
          )}
          <Button variant="primary" onClick={() => void save()} disabled={!supported || busy}>
            {format === 'pdf' ? t('export.print') : format === 'markdown' ? t('export.download') : t('export.save')}
          </Button>
        </>
      }
    >
      <div className="shell-export">
        <div className="shell-prefs__row">
          <span>{t('export.format')}</span>
          <SegmentedControl
            ariaLabel={t('export.format')}
            value={format}
            onChange={setFormat}
            options={formats.map((f) => ({ value: f, label: t(`export.${f}`) }))}
          />
        </div>
        {format === 'png' && (
          <>
            <div className="shell-prefs__row">
              <span>{t('export.size')}</span>
              <SegmentedControl
                ariaLabel={t('export.size')}
                value={scale}
                onChange={setScale}
                options={[
                  { value: '1', label: t('export.scale1x') },
                  { value: '2', label: t('export.scale2x') },
                ]}
              />
            </div>
          </>
        )}
        {(format === 'png' || format === 'svg') && (
          <>
            <div className="shell-prefs__row">
              <span>{t('export.transparent')}</span>
              <Switch label={t('export.transparent')} checked={transparent} onChange={setTransparent} />
            </div>
            <div className="shell-prefs__row">
              <span>{t('export.selectionOnly')}</span>
              <Switch
                label={t('export.selectionOnly')}
                checked={selectionOnly && hasSelection}
                onChange={(v) => hasSelection && setSelectionOnly(v)}
              />
            </div>
          </>
        )}
        {format === 'pdf' && <p className="shell-prefs__hint">{t('export.pdfHint')}</p>}
        {format === 'markdown' && (
          <textarea className="shell-export__preview" readOnly value={markdown} aria-label={t('export.preview')} />
        )}
        {!supported && (
          <p className="shell-export__warning">{t('export.unavailable', { format: format.toUpperCase() })}</p>
        )}
      </div>
    </Modal>
  );
}
