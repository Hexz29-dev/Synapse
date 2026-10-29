import { Fragment, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Icon } from './icons';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="my-4 overflow-hidden rounded-xl border border-line bg-sunken text-ink">
      <div className="flex items-center justify-between border-b border-line/60 px-4 py-2 text-xs text-muted">
        <span className="font-mono">{lang}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          }}
          className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-muted transition-colors hover:bg-ink/[0.06] hover:text-ink"
          aria-label="Copiar código"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={copied ? 'ok' : 'copy'}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.12 }}
              className="inline-flex"
            >
              {copied ? <Icon.Check size={14} /> : <Icon.Copy size={14} />}
            </motion.span>
          </AnimatePresence>
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <pre className="scrollbar-thin overflow-x-auto px-4 py-3.5 font-mono text-[13px] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function MarkdownContent({ content, className = '' }: MarkdownContentProps) {
  const segments = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className={`space-y-3 leading-relaxed ${className}`}>
      {segments.map((segment, index) => {
        if (segment.startsWith('```') && segment.endsWith('```') && segment.length > 6) {
          const lines = segment.slice(3, -3).replace(/^\n/, '').split('\n');
          const first = lines[0]?.trim() ?? '';
          const hasLang = /^[a-zA-Z0-9_+-]+$/.test(first);
          return (
            <CodeBlock
              key={index}
              lang={hasLang ? first : 'código'}
              code={(hasLang ? lines.slice(1) : lines).join('\n').replace(/\n$/, '')}
            />
          );
        }

        const blocks = segment.trim().split(/\n\n+/).filter(Boolean);
        return (
          <Fragment key={index}>
            {blocks.map((block, b) => {
              const trimmed = block.trim();
              const lines = trimmed.split('\n');

              if (/^#{1,3}\s/.test(trimmed) && lines.length === 1) {
                return (
                  <p key={b} className="font-semibold tracking-tight">
                    {renderInline(trimmed.replace(/^#{1,3}\s/, ''))}
                  </p>
                );
              }
              if (trimmed.startsWith('>')) {
                return (
                  <blockquote key={b} className="border-l-2 border-line-strong pl-4 text-muted">
                    {renderInline(trimmed.replace(/^>\s?/gm, ''))}
                  </blockquote>
                );
              }
              if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
                return (
                  <ul key={b} className="list-disc space-y-1 pl-5 marker:text-faint">
                    {lines.map((l, i) => (
                      <li key={i}>{renderInline(l.replace(/^\s*[-*]\s+/, ''))}</li>
                    ))}
                  </ul>
                );
              }
              if (lines.every((l) => /^\s*\d+\.\s+/.test(l))) {
                return (
                  <ol key={b} className="list-decimal space-y-1 pl-5 marker:text-faint">
                    {lines.map((l, i) => (
                      <li key={i}>{renderInline(l.replace(/^\s*\d+\.\s+/, ''))}</li>
                    ))}
                  </ol>
                );
              }
              return (
                <p key={b} className="whitespace-pre-line">
                  {renderInline(trimmed)}
                </p>
              );
            })}
          </Fragment>
        );
      })}
    </div>
  );
}

function renderInline(text: string): ReactNode[] {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g).map((part, i) => {
    if (part.length > 2 && part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="rounded-md border border-line bg-sunken px-1.5 py-0.5 font-mono text-[0.86em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold">
          {renderInline(part.slice(2, -2))}
        </strong>
      );
    }
    if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

/** Remove a marcação para prévias de uma linha. */
export function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' [código] ')
    .replace(/[`*#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
