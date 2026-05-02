import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Section, SubSection } from "../types";
import { useDocs } from "../context";
import { ContentRenderer } from "./ContentRenderer";
import { buildDerivedThemeCSS } from "./theme";
import {
  createSearchInstance,
  buildSectionMap,
  type SearchResult,
} from "./search";
import { CommandPalette } from "./CommandPalette";
import { useLinkPreview } from "./LinkPreviewPopover";
import { useFavicon } from "./favicon";
import { useMediaQuery } from "./hooks";

export function DocsViewer() {
  const {
    title,
    subtitle = "Documentation",
    sections: sidebarSections,
    categories,
    logo,
    basePath = "",
    theme,
    favicon,
  } = useDocs();

  const themeCSS = useMemo(() => theme ? buildDerivedThemeCSS(theme) : "", [theme]);
  useFavicon(favicon);
  const navigate = useNavigate();
  const { categoryId, sectionId } = useParams();

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const fuse = useMemo(() => createSearchInstance(categories), [categories]);
  const sectionMap = useMemo(() => buildSectionMap(categories), [categories]);
  const storageKey = `${title.toLowerCase().replace(/\s+/g, "-")}-docs-search-history`;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSelectResult = (result: SearchResult) => {
    setIsCommandPaletteOpen(false);
    navigate(`${basePath}/${result.categoryId}/${result.sectionId}`);
    if (result.subsectionId) {
      setTimeout(() => {
        const el = document.getElementById(`section-${result.subsectionId}`);
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  };

  const { categoryIndex, sectionIndex } = useMemo(() => {
    if (sectionId && sectionMap[sectionId]) {
      return sectionMap[sectionId];
    }
    if (categoryId) {
      const catIdx = categories.findIndex((c) => c.id === categoryId);
      if (catIdx !== -1) return { categoryIndex: catIdx, sectionIndex: 0 };
    }
    return { categoryIndex: 0, sectionIndex: 0 };
  }, [categoryId, sectionId, sectionMap, categories]);

  const [activeSubSection, setActiveSubSection] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(
    new Set([categoryIndex])
  );
  const contentRef = useRef<HTMLDivElement>(null);

  const currentCategory = categories[categoryIndex];
  const currentSection = currentCategory.sections[sectionIndex];
  const isSingleSection = currentCategory.sections.length === 1;

  useEffect(() => {
    setExpandedCategories((prev) => new Set(prev).add(categoryIndex));
  }, [categoryIndex]);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [categoryIndex, sectionIndex]);

  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSubSection(entry.target.id);
        }
      },
      { root: container, rootMargin: "-10% 0px -70% 0px" }
    );
    const headings = container.querySelectorAll("h3[id]");
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [categoryIndex, sectionIndex]);

  const scrollToSubSection = (id: string) => {
    const el = document.getElementById(id);
    if (el && contentRef.current) {
      const top = el.offsetTop - 80;
      contentRef.current.scrollTo({ top, behavior: "smooth" });
    }
  };

  const toggleCategory = (index: number) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const selectSection = (catIndex: number, secIndex: number) => {
    const cat = categories[catIndex];
    const sec = cat.sections[secIndex];
    navigate(`${basePath}/${cat.id}/${sec.id}`);
    setActiveSubSection(null);
    setIsSidebarOpen(false);
  };

  const getNextSection = () => {
    if (sectionIndex < currentCategory.sections.length - 1)
      return {
        categoryIndex,
        sectionIndex: sectionIndex + 1,
        title: currentCategory.sections[sectionIndex + 1].title,
      };
    if (categoryIndex < categories.length - 1)
      return {
        categoryIndex: categoryIndex + 1,
        sectionIndex: 0,
        title: categories[categoryIndex + 1].sections[0].title,
      };
    return null;
  };

  const getPrevSection = () => {
    if (sectionIndex > 0)
      return {
        categoryIndex,
        sectionIndex: sectionIndex - 1,
        title: currentCategory.sections[sectionIndex - 1].title,
      };
    if (categoryIndex > 0) {
      const prevCat = categories[categoryIndex - 1];
      return {
        categoryIndex: categoryIndex - 1,
        sectionIndex: prevCat.sections.length - 1,
        title: prevCat.sections[prevCat.sections.length - 1].title,
      };
    }
    return null;
  };

  const handleTypeLink = (typeId: string) => {
    const typesCategory = categories.find((c) => c.id === "types");
    if (typesCategory) {
      const typeSection = typesCategory.sections.find(
        (s) =>
          s.id === `type-${typeId.toLowerCase()}` ||
          s.title.toLowerCase().includes(typeId.toLowerCase())
      );
      if (typeSection) {
        navigate(`${basePath}/types/${typeSection.id}`);
        return;
      }
    }
    navigate(`${basePath}/types/types-overview`);
  };

  const handlePageLink = (path: string) => navigate(`${basePath}/${path}`);

  const linkPreviewPopover = useLinkPreview(
    categories,
    contentRef,
    handlePageLink,
    isDesktop
  );

  const renderSidebar = () => {
    let globalCatIndex = 0;
    return sidebarSections.map((section, sectionIdx) => (
      <div
        key={sectionIdx}
        className={section.title ? "mt-6 first:mt-0" : ""}
      >
        {section.title && (
          <div className="px-3 py-2 text-[11px] font-semibold text-[var(--docs-muted-foreground)] uppercase tracking-wider">
            {section.title}
          </div>
        )}
        <div className="space-y-0.5">
          {section.categories.map((category) => {
            const catIndex = globalCatIndex++;
            const isExpanded = expandedCategories.has(catIndex);
            const isActiveCategory = categoryIndex === catIndex;
            const hasSingleSection = category.sections.length === 1;

            return (
              <div key={category.id}>
                <button
                  onClick={() =>
                    hasSingleSection
                      ? selectSection(catIndex, 0)
                      : toggleCategory(catIndex)
                  }
                  className={`w-full text-left px-3 py-2 rounded-lg text-[14px] transition-colors flex items-center gap-2 ${
                    isActiveCategory
                      ? "text-[var(--docs-sidebar-foreground)] font-medium"
                      : "text-[var(--docs-muted-foreground)] hover:text-[var(--docs-sidebar-foreground)] hover:bg-[var(--docs-sidebar-accent)]"
                  }`}
                >
                  {hasSingleSection ? (
                    <svg
                      className={`size-3.5 flex-shrink-0 ${isActiveCategory ? "text-[var(--docs-primary)]" : "text-[var(--docs-muted-foreground)]"}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  ) : (
                    <svg
                      className={`size-3.5 text-[var(--docs-muted-foreground)] transition-transform flex-shrink-0 ${isExpanded ? "rotate-90" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  )}
                  <span
                    className={`truncate ${isActiveCategory ? "font-medium" : ""}`}
                  >
                    {category.title}
                  </span>
                </button>

                {isExpanded && !hasSingleSection && (
                  <div className="ml-5 mt-0.5 space-y-0.5 relative">
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[var(--docs-border)]" />
                    {category.sections.map((sec, secIndex) => {
                      const isActive =
                        isActiveCategory && sectionIndex === secIndex;
                      return (
                        <button
                          key={sec.id}
                          onClick={() => selectSection(catIndex, secIndex)}
                          className={`relative w-full text-left pl-3 pr-3 py-1.5 text-[13px] transition-colors ${
                            isActive
                              ? "text-[var(--docs-sidebar-foreground)] font-medium"
                              : "text-[var(--docs-muted-foreground)] hover:text-[var(--docs-sidebar-foreground)]"
                          }`}
                        >
                          {isActive && (
                            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[var(--docs-primary)]" />
                          )}
                          {sec.title}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    ));
  };

  const sidebarContent = (
    <div className="p-5">
      <div className="flex items-center gap-2.5 mb-6 px-2">
        {logo ?? (
          <div className="size-8 rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center shadow-sm">
            <span className="text-white text-[13px] font-bold">
              {title.charAt(0)}
            </span>
          </div>
        )}
        <div>
          <div className="font-semibold text-[var(--docs-sidebar-foreground)] text-[15px]">
            {title}
          </div>
          <div className="text-[11px] text-[var(--docs-muted-foreground)]">{subtitle}</div>
        </div>
      </div>

      <button
        onClick={() => setIsCommandPaletteOpen(true)}
        className="w-full hidden lg:flex items-center gap-3 px-3 py-2 mb-6 text-[13px] bg-[var(--docs-card)] border border-[var(--docs-border)] rounded-lg hover:bg-[var(--docs-muted)] transition-colors text-left"
      >
        <svg className="size-4 text-[var(--docs-muted-foreground)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className="flex-1 text-[var(--docs-muted-foreground)]">Search docs...</span>
        <kbd className="px-1.5 py-0.5 text-[10px] font-medium text-[var(--docs-muted-foreground)] bg-[var(--docs-muted)] border border-[var(--docs-border)] rounded hidden lg:inline">
          {"\u2318"}K
        </kbd>
      </button>

      <nav className="space-y-1">{renderSidebar()}</nav>
    </div>
  );

  return (
    <div
      className="docs-root h-screen flex overflow-hidden bg-[var(--docs-background)]"
      data-color-scheme={theme?.colorScheme && theme.colorScheme !== "system" ? theme.colorScheme : undefined}
    >
      {themeCSS && <style>{themeCSS}</style>}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelect={handleSelectResult}
        fuse={fuse}
        storageKey={storageKey}
      />

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 h-14 flex items-center justify-between px-4 border-b border-[var(--docs-sidebar-border)] bg-[var(--docs-sidebar)]">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="size-9 flex items-center justify-center rounded-lg text-[var(--docs-muted-foreground)] hover:bg-[var(--docs-sidebar-accent)] transition-colors"
        >
          <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          {logo ?? (
            <div className="size-7 rounded-md bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center">
              <span className="text-white text-[11px] font-bold">{title.charAt(0)}</span>
            </div>
          )}
          <span className="font-semibold text-[var(--docs-sidebar-foreground)] text-[14px]">{title}</span>
        </div>
        <button
          onClick={() => setIsCommandPaletteOpen(true)}
          className="size-9 flex items-center justify-center rounded-lg text-[var(--docs-muted-foreground)] hover:bg-[var(--docs-sidebar-accent)] transition-colors"
        >
          <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      </div>

      {/* Mobile sidebar backdrop */}
      {isSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto w-72 border-r border-[var(--docs-sidebar-border)] overflow-y-auto flex-shrink-0 bg-[var(--docs-sidebar)] transition-transform duration-300 ease-in-out lg:translate-x-0 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {sidebarContent}
      </aside>

      {/* Main content */}
      <main ref={contentRef} className="flex-1 overflow-y-auto pt-14 lg:pt-0">
        <div className="max-w-[760px] mx-auto px-4 md:px-8 lg:px-12 py-8 lg:py-12">
          <div className="mb-8">
            {!isSingleSection && (
              <div className="text-[13px] text-[var(--docs-muted-foreground)] mb-2">
                {currentCategory.title} · Section {currentSection.number}
              </div>
            )}
            <h1 className="text-[26px] md:text-[32px] font-semibold text-[var(--docs-foreground)] tracking-tight">
              {isSingleSection ? currentCategory.title : currentSection.title}
            </h1>
            {currentSection.description && (
              <p className="text-[15px] text-[var(--docs-muted-foreground)] mt-2">
                {currentSection.description}
              </p>
            )}
          </div>

          <SectionContent
            section={currentSection}
            onTypeLink={handleTypeLink}
            onPageLink={handlePageLink}
          />

          <div className="flex justify-between items-center mt-16 pt-8 border-t border-[var(--docs-border)]">
            {(() => {
              const prev = getPrevSection();
              return prev ? (
                <button onClick={() => selectSection(prev.categoryIndex, prev.sectionIndex)} className="group flex flex-col items-start">
                  <span className="text-[12px] text-[var(--docs-muted-foreground)] mb-1">Previous</span>
                  <span className="text-[14px] text-[var(--docs-muted-foreground)] group-hover:text-[var(--docs-foreground)] transition-colors">
                    {"\u2190"} {prev.title}
                  </span>
                </button>
              ) : <div />;
            })()}
            {(() => {
              const next = getNextSection();
              return next ? (
                <button onClick={() => selectSection(next.categoryIndex, next.sectionIndex)} className="group flex flex-col items-end">
                  <span className="text-[12px] text-[var(--docs-muted-foreground)] mb-1">Next</span>
                  <span className="text-[14px] text-[var(--docs-muted-foreground)] group-hover:text-[var(--docs-foreground)] transition-colors">
                    {next.title} {"\u2192"}
                  </span>
                </button>
              ) : <div />;
            })()}
          </div>
        </div>
      </main>

      {/* On this page — desktop only */}
      {currentSection.subsections.length > 0 && (
        <aside className="hidden lg:block w-56 border-l border-[var(--docs-border)] overflow-y-auto flex-shrink-0">
          <div className="sticky top-0 p-6">
            <div className="text-[12px] font-medium text-[var(--docs-muted-foreground)] uppercase tracking-wider mb-4">
              On this page
            </div>
            <nav className="space-y-1">
              {currentSection.subsections.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => scrollToSubSection(`section-${sub.id}`)}
                  className={`w-full text-left text-[13px] py-1.5 transition-colors ${
                    activeSubSection === `section-${sub.id}`
                      ? "text-[var(--docs-foreground)] font-medium"
                      : "text-[var(--docs-muted-foreground)] hover:text-[var(--docs-foreground)]"
                  }`}
                >
                  {sub.title}
                </button>
              ))}
            </nav>
          </div>
        </aside>
      )}

      {linkPreviewPopover}
    </div>
  );
}

function SectionContent({
  section,
  onTypeLink,
  onPageLink,
}: {
  section: Section;
  onTypeLink: (typeId: string) => void;
  onPageLink: (path: string) => void;
}) {
  return (
    <div className="text-[15px] text-[var(--docs-foreground)] leading-relaxed">
      {section.subsections.map((subsection) => (
        <SubSectionContent
          key={subsection.id}
          subsection={subsection}
          onTypeLink={onTypeLink}
          onPageLink={onPageLink}
        />
      ))}
    </div>
  );
}

function SubSectionContent({
  subsection,
  onTypeLink,
  onPageLink,
}: {
  subsection: SubSection;
  onTypeLink: (typeId: string) => void;
  onPageLink: (path: string) => void;
}) {
  return (
    <section className="mt-10 first:mt-0">
      <h3
        id={`section-${subsection.id}`}
        className="scroll-mt-20 text-[18px] font-semibold text-[var(--docs-foreground)] mb-4"
      >
        {subsection.title}
      </h3>
      {subsection.content.map((block, i) => (
        <ContentRenderer
          key={i}
          block={block}
          onTypeLink={onTypeLink}
          onPageLink={onPageLink}
        />
      ))}
    </section>
  );
}
