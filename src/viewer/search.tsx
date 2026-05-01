import Fuse from "fuse.js";
import type { ContentBlock, DocsCategory } from "../types";

export interface SearchResult {
  categoryId: string;
  categoryTitle: string;
  sectionId: string;
  sectionTitle: string;
  subsectionId?: string;
  subsectionTitle?: string;
  matchText: string;
  titleIndices?: ReadonlyArray<readonly [number, number]>;
  matchIndices?: ReadonlyArray<readonly [number, number]>;
}

interface SearchIndexItem {
  categoryId: string;
  categoryTitle: string;
  sectionId: string;
  sectionTitle: string;
  subsectionId?: string;
  subsectionTitle?: string;
  title: string;
  content: string;
}

const EXCLUDED_SECTIONS = new Set(["search", "sitemap"]);

function extractText(blocks: ContentBlock[]): string {
  return blocks
    .map((block) => {
      if (block.type === "text") return block.content;
      if (block.type === "code") return block.content;
      if (block.type === "list") return block.items.join(" ");
      if (block.type === "note") return block.content;
      if (block.type === "table")
        return [...block.headers, ...block.rows.flat()].join(" ");
      if (block.type === "fields")
        return block.items.map((f) => `${f.name} ${f.description}`).join(" ");
      if (block.type === "files") return block.tree;
      return "";
    })
    .join(" ");
}

export function buildSearchIndex(categories: DocsCategory[]): SearchIndexItem[] {
  const index: SearchIndexItem[] = [];

  categories.forEach((category) => {
    category.sections.forEach((section) => {
      if (EXCLUDED_SECTIONS.has(section.id)) return;

      index.push({
        categoryId: category.id,
        categoryTitle: category.title,
        sectionId: section.id,
        sectionTitle: section.title,
        title: section.title,
        content: section.description || "",
      });

      section.subsections.forEach((sub) => {
        index.push({
          categoryId: category.id,
          categoryTitle: category.title,
          sectionId: section.id,
          sectionTitle: section.title,
          subsectionId: sub.id,
          subsectionTitle: sub.title,
          title: sub.title,
          content: extractText(sub.content),
        });
      });
    });
  });

  return index;
}

export function createSearchInstance(categories: DocsCategory[]) {
  const searchIndex = buildSearchIndex(categories);

  return new Fuse(searchIndex, {
    keys: [
      { name: "title", weight: 1 },
      { name: "sectionTitle", weight: 0.8 },
      { name: "content", weight: 1 },
    ],
    threshold: 0.2,
    distance: 30,
    includeMatches: true,
    includeScore: true,
    minMatchCharLength: 2,
    ignoreLocation: true,
  });
}

export function buildSectionMap(categories: DocsCategory[]) {
  const map: Record<string, { categoryIndex: number; sectionIndex: number }> =
    {};
  categories.forEach((category, catIndex) => {
    category.sections.forEach((section, secIndex) => {
      map[section.id] = { categoryIndex: catIndex, sectionIndex: secIndex };
    });
  });
  return map;
}

export function highlightWithIndices(
  text: string,
  indices: ReadonlyArray<readonly [number, number]> | undefined
): React.ReactNode {
  if (!indices || indices.length === 0) return text;

  const result: React.ReactNode[] = [];
  let lastEnd = 0;

  for (const [start, end] of indices) {
    if (start > lastEnd) {
      result.push(text.slice(lastEnd, start));
    }
    result.push(
      <mark key={start} className="bg-yellow-200 text-zinc-900 rounded-sm">
        {text.slice(start, end + 1)}
      </mark>
    );
    lastEnd = end + 1;
  }

  if (lastEnd < text.length) {
    result.push(text.slice(lastEnd));
  }

  return result;
}

const MAX_HISTORY = 10;

export function getSearchHistory(storageKey: string): SearchResult[] {
  try {
    const stored = localStorage.getItem(storageKey);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function addToSearchHistory(storageKey: string, result: SearchResult) {
  const history = getSearchHistory(storageKey);
  const filtered = history.filter(
    (h) =>
      !(
        h.sectionId === result.sectionId &&
        h.subsectionId === result.subsectionId
      )
  );
  const updated = [result, ...filtered].slice(0, MAX_HISTORY);
  localStorage.setItem(storageKey, JSON.stringify(updated));
}

export function clearSearchHistory(storageKey: string) {
  localStorage.removeItem(storageKey);
}

export function buildDocsContext(categories: DocsCategory[]): string {
  const filtered = categories.filter((cat) => !EXCLUDED_SECTIONS.has(cat.id));

  const content = filtered
    .map((cat) => {
      const sections = cat.sections
        .filter((s) => !EXCLUDED_SECTIONS.has(s.id))
        .map((sec) => {
          const subsections = sec.subsections
            .map((sub) => `### ${sub.title}\n${extractText(sub.content)}`)
            .join("\n\n");
          return `## ${sec.title}${sec.description ? "\n" + sec.description : ""}\n\n${subsections}`;
        })
        .join("\n\n");
      return `# ${cat.title}\n\n${sections}`;
    })
    .join("\n\n---\n\n");

  const pathMap = filtered
    .flatMap((cat) =>
      cat.sections
        .filter((s) => !EXCLUDED_SECTIONS.has(s.id))
        .map((sec) => `- [${sec.title}](${cat.id}/${sec.id})`)
    )
    .join("\n");

  return `${content}\n\n---\n\nAvailable doc links (use exact paths when citing):\n${pathMap}`;
}
