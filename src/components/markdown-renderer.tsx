'use client';

import { useMemo } from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  const html = useMemo(() => renderMarkdown(content), [content]);

  return (
    <div
      className={`text-sm leading-relaxed text-[var(--foreground)] ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function renderMarkdown(text: string): string {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 1. Protect code blocks
  const codeBlocks: string[] = [];
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_m, _lang, code) => {
    const i = codeBlocks.length;
    codeBlocks.push('<pre class="bg-[var(--panel)] p-3 rounded-lg overflow-x-auto my-2 text-sm"><code>' + code.trim() + '</code></pre>');
    return '\x00CODE_' + i + '\x00';
  });

  // 2. Build tables
  // Replace each table row with a numbered marker, skip separator rows
  const tableRows: string[] = [];
  html = html.replace(/^\|.+\|[\s]*$/gm, (line) => {
    const trimmed = line.trim();
    const cells = trimmed.split('|').slice(1, -1).map(c => c.trim());
    // Skip separator rows (|---|---|)
    if (cells.every(c => /^[\s\-:]+$/.test(c))) {
      return '\n';
    }
    const rowCells = cells.map(c => {
      let cell = c
        .replace(/\*\*(.+?)\*\*/g, '<strong class="text-[var(--accent)]">$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code class="text-[var(--accent)] bg-[var(--panel)] px-1 rounded text-xs">$1</code>');
      return '<td class="border border-[var(--border)] px-3 py-2 text-sm align-top">' + cell + '</td>';
    }).join('');
    const id = tableRows.length;
    tableRows.push('<tr>' + rowCells + '</tr>');
    return '\x00TR_' + id + '\x00';
  });

  // Wrap consecutive row markers in a table
  html = html.replace(/((?:\x00TR_\d+\x00\s*)+)/g, (match) => {
    const ids: number[] = [];
    const regex = /\x00TR_(\d+)\x00/g;
    let m;
    while ((m = regex.exec(match)) !== null) {
      ids.push(parseInt(m[1], 10));
    }
    if (ids.length === 0) return match;
    const inner = ids.map(id => tableRows[id]).join('\n');
    return '<div class="overflow-x-auto my-3"><table class="w-full border-collapse border border-[var(--border)]">' + inner + '</table></div>';
  });

  // 3. Inline formatting
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code class="text-[var(--accent)] bg-[var(--panel)] px-1 rounded text-xs">$1</code>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-[var(--accent)] hover:underline">$1</a>');

  // 4. Split into blocks by double newline
  const blocks = html.split(/\n{2,}/);
  const processed = blocks.map(block => {
    const trimmed = block.trim();
    if (!trimmed) return '';
    // Pass through blocks that are already HTML elements
    if (trimmed.includes('\x00') || trimmed.startsWith('<table') || trimmed.startsWith('<pre') || trimmed.startsWith('<div')) return trimmed;
    return '<p class="my-2">' + trimmed.replace(/\n/g, '<br/>') + '</p>';
  });
  html = processed.join('\n');

  // 5. Restore code blocks
  codeBlocks.forEach((cb, i) => {
    html = html.replace('\x00CODE_' + i + '\x00', cb);
  });

  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');

  return html;
}
