import { Link } from "react-router-dom";
import { highlight } from "sugar-high";

// Splits text into typed tokens: bold, italic, code, link, or plain text
const INLINE_TOKEN =
  /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[[^\]]+\]\([^)]+\))/g;

function renderInlineNodes(text: string, basePath: string): React.ReactNode[] {
  const parts = text.split(INLINE_TOKEN);
  return parts.flatMap((part, i): React.ReactNode[] => {
    if (!part) return [];

    if (part.startsWith("**") && part.endsWith("**")) {
      return [<strong key={i} className="font-semibold text-[var(--docs-foreground)]">{part.slice(2, -2)}</strong>];
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return [<em key={i}>{part.slice(1, -1)}</em>];
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return [
        <code key={i} className="px-1 py-0.5 rounded bg-[var(--docs-muted)] text-[var(--docs-foreground)] text-[11px] font-mono">
          {part.slice(1, -1)}
        </code>,
      ];
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, label, href] = linkMatch;
      const isInternal = !href.startsWith("http") && !href.startsWith("/") && !href.startsWith("#");
      if (isInternal) {
        return [
          <Link
            key={i}
            to={`${basePath}/${href}`}
            className="inline-flex items-center gap-0.5 text-[var(--docs-primary)] underline underline-offset-2 hover:opacity-80 transition-opacity"
          >
            {label}
            <svg className="size-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>,
        ];
      }
      return [
        <a key={i} href={href} target="_blank" rel="noopener noreferrer"
          className="text-[var(--docs-primary)] underline underline-offset-2 hover:opacity-80 transition-opacity">
          {label}
        </a>,
      ];
    }
    return [part];
  });
}

function TextContent({ text, basePath }: { text: string; basePath: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) { i++; continue; }

    if (trimmed.startsWith("## ")) {
      blocks.push(
        <p key={`h2-${i}`} className="text-[13px] font-semibold text-[var(--docs-foreground)] mt-2">
          {renderInlineNodes(trimmed.slice(3), basePath)}
        </p>
      );
      i++; continue;
    }

    if (trimmed.startsWith("# ")) {
      blocks.push(
        <p key={`h1-${i}`} className="text-[14px] font-semibold text-[var(--docs-foreground)] mt-2">
          {renderInlineNodes(trimmed.slice(2), basePath)}
        </p>
      );
      i++; continue;
    }

    if (/^[-*•] /.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && (/^[-*•] /.test(lines[i].trim()) || !lines[i].trim())) {
        if (lines[i].trim()) items.push(lines[i].trim().replace(/^[-*•] /, ""));
        i++;
      }
      blocks.push(
        <ul key={`ul-${i}`} className="ml-3 space-y-0.5 list-disc list-outside my-1">
          {items.map((item, j) => (
            <li key={j} className="text-[13px] text-[var(--docs-muted-foreground)] leading-relaxed">
              {renderInlineNodes(item, basePath)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^\d+\. /.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && (/^\d+\. /.test(lines[i].trim()) || !lines[i].trim())) {
        if (lines[i].trim()) items.push(lines[i].trim().replace(/^\d+\. /, ""));
        i++;
      }
      blocks.push(
        <ol key={`ol-${i}`} className="ml-3 space-y-0.5 list-decimal list-outside my-1">
          {items.map((item, j) => (
            <li key={j} className="text-[13px] text-[var(--docs-muted-foreground)] leading-relaxed">
              {renderInlineNodes(item, basePath)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^[-*•\d]/.test(lines[i].trim()) &&
      !lines[i].trim().startsWith("#")
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push(
        <p key={`p-${i}`} className="text-[13px] text-[var(--docs-muted-foreground)] leading-relaxed">
          {renderInlineNodes(paraLines.join(" "), basePath)}
        </p>
      );
    }
  }

  return <>{blocks}</>;
}

export function MarkdownMessage({ text, basePath = "" }: { text: string; basePath?: string }) {
  const nodes: React.ReactNode[] = [];
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index);
    if (before) nodes.push(<TextContent key={`t-${lastIndex}`} text={before} basePath={basePath} />);
    const [, , code] = match;
    nodes.push(
      <pre
        key={`c-${match.index}`}
        className="my-2 p-3 rounded-lg bg-zinc-900 text-zinc-100 text-[11px] font-mono leading-relaxed overflow-x-auto whitespace-pre"
      >
        <code dangerouslySetInnerHTML={{ __html: highlight(code.trimEnd()) }} />
      </pre>
    );
    lastIndex = match.index + match[0].length;
  }

  const remaining = text.slice(lastIndex);
  if (remaining) nodes.push(<TextContent key="t-end" text={remaining} basePath={basePath} />);

  return <div className="space-y-1">{nodes}</div>;
}
