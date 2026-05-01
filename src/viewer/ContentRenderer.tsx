import { highlight } from "sugar-high";
import type { ContentBlock, PropDefinition, FieldDefinition } from "../types";

interface ContentRendererProps {
  block: ContentBlock;
  onTypeLink?: (typeId: string) => void;
  onPageLink?: (path: string) => void;
}

function renderInlineCode(
  text: string,
  onTypeLink?: (typeId: string) => void,
  onPageLink?: (path: string) => void
): string {
  let result = text.replace(
    /\*\*([^*]+)\*\*/g,
    '<strong class="font-semibold">$1</strong>'
  );
  result = result.replace(
    /`([^`]+)`/g,
    '<code class="px-1.5 py-0.5 rounded bg-[var(--docs-muted)] text-[var(--docs-foreground)] text-[13px] font-mono">$1</code>'
  );
  if (onPageLink) {
    result = result.replace(
      /\[\[link:([^\]|]+)\|([^\]]+)\]\]/g,
      '<button class="page-link hover:underline font-medium" style="color: var(--docs-primary)" data-path="$1">$2</button>'
    );
  } else {
    result = result.replace(
      /\[\[link:([^\]|]+)\|([^\]]+)\]\]/g,
      '<span class="font-medium" style="color: var(--docs-primary)">$2</span>'
    );
  }
  if (onTypeLink) {
    result = result.replace(
      /\[\[types:([^\]]+)\]\]/g,
      '<button class="type-link hover:underline font-medium" style="color: var(--docs-primary)" data-type="$1">$1</button>'
    );
  } else {
    result = result.replace(
      /\[\[types:([^\]]+)\]\]/g,
      '<code class="px-1.5 py-0.5 rounded text-[13px] font-mono" style="color: var(--docs-primary); background: color-mix(in oklch, var(--docs-primary) 10%, var(--docs-background))">$1</code>'
    );
  }
  return result;
}

export function ContentRenderer({
  block,
  onTypeLink,
  onPageLink,
}: ContentRendererProps) {
  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains("type-link") && onTypeLink) {
      const typeId = target.getAttribute("data-type");
      if (typeId) onTypeLink(typeId);
    }
    if (target.classList.contains("page-link") && onPageLink) {
      const path = target.getAttribute("data-path");
      if (path) onPageLink(path);
    }
  };

  switch (block.type) {
    case "text":
      return (
        <p
          className="text-[15px] text-[var(--docs-foreground)] leading-relaxed mb-4"
          dangerouslySetInnerHTML={{
            __html: renderInlineCode(block.content, onTypeLink, onPageLink),
          }}
          onClick={handleClick}
        />
      );

    case "code":
      return (
        <pre className="my-4 p-4 rounded-lg bg-zinc-900 text-zinc-100 text-[13px] font-mono leading-relaxed overflow-x-auto">
          <code dangerouslySetInnerHTML={{ __html: highlight(block.content) }} />
        </pre>
      );

    case "note": {
      const noteStyles = {
        info: "border-sky-300 bg-sky-50/50 text-sky-900 dark:border-sky-700/50 dark:bg-sky-950/30 dark:text-sky-300",
        warning: "border-amber-300 bg-amber-50/50 text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-300",
        tip: "border-emerald-300 bg-emerald-50/50 text-emerald-900 dark:border-emerald-700/50 dark:bg-emerald-950/30 dark:text-emerald-300",
      };
      const noteLabels = { info: "Note", warning: "Warning", tip: "Tip" };
      return (
        <div
          className={`my-5 pl-4 border-l-2 py-3 pr-4 rounded-r-lg ${noteStyles[block.variant]}`}
        >
          <div className="text-[13px] font-medium mb-2 opacity-80">
            {noteLabels[block.variant]}
          </div>
          <div
            className="text-[14px]"
            dangerouslySetInnerHTML={{
              __html: renderInlineCode(block.content, onTypeLink, onPageLink),
            }}
            onClick={handleClick}
          />
        </div>
      );
    }

    case "concept":
      return (
        <div className="my-5 p-4 rounded-lg bg-violet-50 border border-violet-100 dark:bg-violet-950/30 dark:border-violet-800/50">
          <div className="text-[13px] text-violet-600 dark:text-violet-400 font-medium mb-2">
            Concept
          </div>
          <div
            className="text-[14px] text-violet-900 dark:text-violet-300"
            dangerouslySetInnerHTML={{
              __html: renderInlineCode(block.content, onTypeLink, onPageLink),
            }}
            onClick={handleClick}
          />
        </div>
      );

    case "table":
      return (
        <div className="my-4 overflow-x-auto rounded-lg border border-[var(--docs-border)]">
          <table className="w-full text-[13px]">
            <thead className="bg-[var(--docs-muted)]">
              <tr>
                {block.headers.map((h, i) => (
                  <th
                    key={i}
                    className="text-left py-3 px-4 font-semibold text-[var(--docs-foreground)]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i} className="border-t border-[var(--docs-border)]">
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className="py-3 px-4 text-[var(--docs-muted-foreground)]"
                      dangerouslySetInnerHTML={{
                        __html: renderInlineCode(
                          cell,
                          onTypeLink,
                          onPageLink
                        ),
                      }}
                      onClick={handleClick}
                    />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "list": {
      const ListTag = block.ordered ? "ol" : "ul";
      return (
        <ListTag
          className={`my-3 ml-4 space-y-1.5 list-outside ${
            block.ordered ? "list-decimal" : "list-disc"
          } text-[14px] text-[var(--docs-muted-foreground)]`}
        >
          {block.items.map((item, i) => (
            <li
              key={i}
              dangerouslySetInnerHTML={{
                __html: renderInlineCode(item, onTypeLink, onPageLink),
              }}
              onClick={handleClick}
            />
          ))}
        </ListTag>
      );
    }

    case "files":
      return (
        <pre className="my-4 p-4 rounded-lg bg-[var(--docs-muted)] border border-[var(--docs-border)] text-[13px] font-mono text-[var(--docs-muted-foreground)] overflow-x-auto">
          {block.tree}
        </pre>
      );

    case "props":
      return (
        <PropsTable
          items={block.items}
          onTypeLink={onTypeLink}
          onPageLink={onPageLink}
        />
      );

    case "fields":
      return (
        <FieldsTable
          items={block.items}
          onTypeLink={onTypeLink}
          onPageLink={onPageLink}
        />
      );

    default:
      return null;
  }
}

function PropsTable({
  items,
  onTypeLink,
  onPageLink,
}: {
  items: PropDefinition[];
  onTypeLink?: (typeId: string) => void;
  onPageLink?: (path: string) => void;
}) {
  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains("type-link") && onTypeLink) {
      const typeId = target.getAttribute("data-type");
      if (typeId) onTypeLink(typeId);
    }
    if (target.classList.contains("page-link") && onPageLink) {
      const path = target.getAttribute("data-path");
      if (path) onPageLink(path);
    }
  };

  return (
    <div className="my-4 overflow-x-auto rounded-lg border border-[var(--docs-border)]">
      <table className="w-full text-[13px]">
        <thead className="bg-[var(--docs-muted)]">
          <tr>
            <th className="text-left py-3 px-4 font-semibold text-[var(--docs-muted-foreground)]">
              Prop
            </th>
            <th className="text-left py-3 px-4 font-semibold text-[var(--docs-muted-foreground)]">
              Type
            </th>
            <th className="text-left py-3 px-4 font-semibold text-[var(--docs-muted-foreground)]">
              Description
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} className="border-t border-[var(--docs-border)]">
              <td className="py-3 px-4 text-[var(--docs-foreground)] font-mono">
                {item.name}
                {item.required && (
                  <span className="text-red-500 ml-1">*</span>
                )}
              </td>
              <td
                className="py-3 px-4 text-[var(--docs-muted-foreground)] font-mono text-[12px]"
                dangerouslySetInnerHTML={{
                  __html: renderInlineCode(item.type, onTypeLink, onPageLink),
                }}
                onClick={handleClick}
              />
              <td className="py-3 px-4 text-[var(--docs-muted-foreground)]">{item.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FieldsTable({
  items,
  onTypeLink,
  onPageLink,
}: {
  items: FieldDefinition[];
  onTypeLink?: (typeId: string) => void;
  onPageLink?: (path: string) => void;
}) {
  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains("type-link") && onTypeLink) {
      const typeId = target.getAttribute("data-type");
      if (typeId) onTypeLink(typeId);
    }
    if (target.classList.contains("page-link") && onPageLink) {
      const path = target.getAttribute("data-path");
      if (path) onPageLink(path);
    }
  };

  return (
    <div className="my-4 overflow-x-auto rounded-lg border border-[var(--docs-border)]">
      <table className="w-full text-[13px]">
        <thead className="bg-[var(--docs-muted)]">
          <tr>
            <th className="text-left py-3 px-4 font-semibold text-[var(--docs-muted-foreground)]">
              Field
            </th>
            <th className="text-left py-3 px-4 font-semibold text-[var(--docs-muted-foreground)]">
              Type
            </th>
            <th className="text-left py-3 px-4 font-semibold text-[var(--docs-muted-foreground)]">
              Description
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} className="border-t border-[var(--docs-border)]">
              <td className="py-3 px-4 text-[var(--docs-foreground)] font-mono">{item.name}</td>
              <td
                className="py-3 px-4 text-[var(--docs-muted-foreground)] font-mono text-[12px]"
                dangerouslySetInnerHTML={{
                  __html: renderInlineCode(item.type, onTypeLink, onPageLink),
                }}
                onClick={handleClick}
              />
              <td className="py-3 px-4 text-[var(--docs-muted-foreground)]">{item.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
