import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type { DocsCategory, ContentBlock } from "../types";
import { ContentRenderer } from "./ContentRenderer";

interface PreviewData {
  categoryTitle: string;
  sectionTitle: string;
  subsectionTitle?: string;
  blocks: ContentBlock[];
}

function resolvePageLink(
  path: string,
  categories: DocsCategory[]
): PreviewData | null {
  const parts = path.split("/");
  const categoryId = parts[0];
  const sectionId = parts[1];
  const subsectionId = parts[2];

  const category = categories.find((c) => c.id === categoryId);
  if (!category) return null;

  const section = category.sections.find((s) => s.id === sectionId);
  if (!section) {
    const first = category.sections[0];
    if (!first) return null;
    return {
      categoryTitle: category.title,
      sectionTitle: first.title,
      blocks: first.subsections[0]?.content.slice(0, 3) ?? [],
    };
  }

  if (subsectionId) {
    const sub = section.subsections.find((s) => s.id === subsectionId);
    if (sub) {
      return {
        categoryTitle: category.title,
        sectionTitle: section.title,
        subsectionTitle: sub.title,
        blocks: sub.content.slice(0, 3),
      };
    }
  }

  const firstSub = section.subsections[0];
  const blocks: ContentBlock[] = [];
  if (section.description) {
    blocks.push({ type: "text", content: section.description });
  }
  if (firstSub) {
    blocks.push(...firstSub.content.slice(0, 2));
  }

  return {
    categoryTitle: category.title,
    sectionTitle: section.title,
    blocks: blocks.slice(0, 3),
  };
}

function computePosition(
  anchor: DOMRect,
  popoverWidth: number,
  popoverHeight: number,
  scrollContainer: HTMLElement | null
) {
  const viewportHeight = window.innerHeight;
  const margin = 8;
  const spaceBelow = viewportHeight - anchor.bottom;
  const spaceAbove = anchor.top;

  let top: number;
  if (spaceBelow >= popoverHeight + margin) top = anchor.bottom + margin;
  else if (spaceAbove >= popoverHeight + margin)
    top = anchor.top - popoverHeight - margin;
  else top = anchor.bottom + margin;

  let left = anchor.left + anchor.width / 2 - popoverWidth / 2;
  const rightEdge =
    (scrollContainer?.getBoundingClientRect().right ?? window.innerWidth) - 16;
  const leftEdge = scrollContainer?.getBoundingClientRect().left ?? 16;
  left = Math.max(leftEdge, Math.min(left, rightEdge - popoverWidth));

  return { top, left };
}

export function useLinkPreview(
  categories: DocsCategory[],
  contentRef: React.RefObject<HTMLDivElement | null>,
  onNavigate?: (path: string) => void
) {
  const [preview, setPreview] = useState<{
    data: PreviewData;
    anchor: DOMRect;
    path: string;
  } | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const popoverMeasureRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const showPreview = useCallback(
    (path: string, anchorRect: DOMRect) => {
      const data = resolvePageLink(path, categories);
      if (!data) return;
      setPosition(null);
      setPreview({ data, anchor: anchorRect, path });
    },
    [categories]
  );

  const hidePreview = useCallback(() => {
    setPreview(null);
    setPosition(null);
  }, []);

  useEffect(() => {
    if (!preview) return;
    const el = popoverMeasureRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pos = computePosition(
      preview.anchor,
      380,
      rect.height,
      contentRef.current
    );
    setPosition(pos);
  }, [preview, contentRef]);

  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const handleMouseOver = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest(
        "[data-path]"
      ) as HTMLElement | null;
      if (!target) return;

      if (leaveTimeoutRef.current) {
        clearTimeout(leaveTimeoutRef.current);
        leaveTimeoutRef.current = null;
      }
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = setTimeout(() => {
        const path = target.dataset.path;
        if (path) showPreview(path, target.getBoundingClientRect());
      }, 300);
    };

    const handleMouseOut = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest(
        "[data-path]"
      ) as HTMLElement | null;
      const related = (e.relatedTarget as HTMLElement)?.closest?.(
        "[data-path]"
      ) as HTMLElement | null;
      if (target && related && target === related) return;

      const relatedEl = e.relatedTarget as HTMLElement | null;
      if (relatedEl && popoverRef.current?.contains(relatedEl)) return;

      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
      leaveTimeoutRef.current = setTimeout(hidePreview, 200);
    };

    container.addEventListener("mouseover", handleMouseOver);
    container.addEventListener("mouseout", handleMouseOut);

    return () => {
      container.removeEventListener("mouseover", handleMouseOver);
      container.removeEventListener("mouseout", handleMouseOut);
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);
    };
  }, [contentRef, showPreview, hidePreview]);

  if (!preview) return null;

  const handleNavigate = () => {
    if (onNavigate) {
      hidePreview();
      onNavigate(preview.path);
    }
  };

  return createPortal(
    <div
      ref={(el) => {
        (
          popoverRef as React.MutableRefObject<HTMLDivElement | null>
        ).current = el;
        (
          popoverMeasureRef as React.MutableRefObject<HTMLDivElement | null>
        ).current = el;
      }}
      onMouseEnter={() => {
        if (leaveTimeoutRef.current) {
          clearTimeout(leaveTimeoutRef.current);
          leaveTimeoutRef.current = null;
        }
      }}
      onMouseLeave={() => {
        leaveTimeoutRef.current = setTimeout(hidePreview, 150);
      }}
      className="fixed z-50 w-[380px] bg-[var(--docs-card)] rounded-xl shadow-xl border border-[var(--docs-border)] overflow-hidden transition-opacity duration-150 flex flex-col"
      style={{
        top: position?.top ?? -9999,
        left: position?.left ?? -9999,
        opacity: position ? 1 : 0,
        maxHeight: 320,
      }}
    >
      <div className="px-4 py-3 border-b border-[var(--docs-border)] bg-[var(--docs-muted)] flex-shrink-0">
        <div className="text-[11px] text-[var(--docs-muted-foreground)] mb-0.5">
          {preview.data.categoryTitle}
        </div>
        <div className="text-[14px] font-semibold text-[var(--docs-foreground)]">
          {preview.data.subsectionTitle ?? preview.data.sectionTitle}
        </div>
      </div>
      <div className="px-4 py-3 overflow-y-auto flex-1 min-h-0">
        <div className="text-[13px] leading-relaxed [&>*]:!my-2 [&>*]:!text-[13px] [&_pre]:!text-[11px] [&_pre]:!p-2 [&_code]:!text-[11px]">
          {preview.data.blocks.map((block, i) => (
            <ContentRenderer key={i} block={block} />
          ))}
        </div>
      </div>
      <div className="px-3 py-2 border-t border-[var(--docs-border)] bg-[var(--docs-muted)] flex items-center justify-between flex-shrink-0">
        <span className="text-[11px] text-[var(--docs-muted-foreground)]">
          {preview.data.categoryTitle}
        </span>
        <button
          onClick={handleNavigate}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium text-[var(--docs-primary)] hover:opacity-80 hover:bg-[var(--docs-muted)] transition-colors"
        >
          Go to page
          <svg
            className="size-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
            />
          </svg>
        </button>
      </div>
    </div>,
    contentRef.current?.closest(".docs-root") ?? document.body
  );
}
