/**
 * Static rendering of RichText (same DOM structure and classes as the editor so text does not
 * jump when editing starts).
 */

import { Fragment, type ReactNode } from 'react';
import type { RichText, TextBlock, TextSpan } from '@renderer/core/types';

function renderSpan(span: TextSpan, key: number): ReactNode {
  const parts = span.text.split('\n');
  let node: ReactNode = parts.map((p, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {p}
    </Fragment>
  ));
  for (const mark of span.marks ?? []) {
    switch (mark) {
      case 'bold':
        node = <strong>{node}</strong>;
        break;
      case 'italic':
        node = <em>{node}</em>;
        break;
      case 'strike':
        node = <s>{node}</s>;
        break;
      case 'code':
        node = <code>{node}</code>;
        break;
      case 'highlight':
        node = <mark>{node}</mark>;
        break;
    }
  }
  if (span.href) node = <a href={span.href} data-wc-link="">{node}</a>;
  return <Fragment key={key}>{node}</Fragment>;
}

function inline(block: TextBlock): ReactNode {
  if (block.spans.length === 0 || block.spans.every((s) => s.text === '')) return <br />;
  return block.spans.map(renderSpan);
}

/** Groups consecutive list blocks into nested <ul>/<ol>. */
function renderBlocks(blocks: readonly TextBlock[]): ReactNode[] {
  const out: ReactNode[] = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i]!;
    if (b.type === 'ul' || b.type === 'ol' || b.type === 'check') {
      const start = i;
      while (i < blocks.length && ['ul', 'ol', 'check'].includes(blocks[i]!.type)) i++;
      out.push(<ListGroup key={start} blocks={blocks.slice(start, i)} />);
      continue;
    }
    switch (b.type) {
      case 'h1':
        out.push(<h1 key={i}>{inline(b)}</h1>);
        break;
      case 'h2':
        out.push(<h2 key={i}>{inline(b)}</h2>);
        break;
      case 'h3':
        out.push(<h3 key={i}>{inline(b)}</h3>);
        break;
      case 'quote':
        out.push(
          <blockquote key={i}>
            <p>{inline(b)}</p>
          </blockquote>,
        );
        break;
      case 'code':
        out.push(
          <pre key={i}>
            <code>{b.spans.map((s) => s.text).join('')}</code>
          </pre>,
        );
        break;
      default:
        out.push(<p key={i}>{inline(b)}</p>);
    }
    i++;
  }
  return out;
}

function ListGroup({ blocks }: { blocks: readonly TextBlock[] }): JSX.Element {
  // Flat rendering with indentation classes keeps this simple and matches editor metrics.
  const nodes: ReactNode[] = [];
  let i = 0;
  while (i < blocks.length) {
    const first = blocks[i]!;
    const indent = first.indent ?? 0;
    const type = first.type;
    const items: TextBlock[] = [];
    while (i < blocks.length && blocks[i]!.type === type && (blocks[i]!.indent ?? 0) === indent) items.push(blocks[i++]!);
    const style = indent > 0 ? { marginLeft: `${indent * 1.4}em` } : undefined;
    if (type === 'check') {
      nodes.push(
        <ul key={nodes.length} data-type="taskList" style={style}>
          {items.map((it, k) => (
            <li key={k} data-checked={it.checked ? 'true' : 'false'}>
              <label>
                <input type="checkbox" checked={!!it.checked} readOnly tabIndex={-1} />
              </label>
              <div>
                <p>{inline(it)}</p>
              </div>
            </li>
          ))}
        </ul>,
      );
    } else {
      const List = type === 'ol' ? 'ol' : 'ul';
      nodes.push(
        <List key={nodes.length} style={style}>
          {items.map((it, k) => (
            <li key={k}>
              <p>{inline(it)}</p>
            </li>
          ))}
        </List>,
      );
    }
  }
  return <>{nodes}</>;
}

export function RichTextView({ value, className, style }: { value: RichText | undefined; className?: string; style?: React.CSSProperties }): JSX.Element {
  return (
    <div className={['wc-rte', className].filter(Boolean).join(' ')} style={style}>
      <div className="wc-rte-content">{renderBlocks(value?.blocks ?? [])}</div>
    </div>
  );
}
