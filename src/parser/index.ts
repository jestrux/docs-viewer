import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import { parse as parseYaml } from "yaml";
import type {
  ContentBlock,
  SubSection,
  Section,
  DocsCategory,
  SidebarSection,
} from "../types";

export interface MarkdownFile {
  /** Raw markdown content including frontmatter */
  content: string;
  /** File path relative to docs root (e.g., "overview/intro.md") */
  path: string;
}

interface Frontmatter {
  id: string;
  number: number;
  title: string;
  description?: string;
  category: string;
  categoryTitle?: string;
}

interface MdastNode {
  type: string;
  children?: MdastNode[];
  value?: string;
  lang?: string;
  depth?: number;
  ordered?: boolean;
  align?: (string | null)[];
  url?: string;
  [key: string]: unknown;
}

const processor = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ["yaml"])
  .use(remarkGfm);

function extractFrontmatter(tree: MdastNode, raw: string): Frontmatter | null {
  const yamlNode = tree.children?.find((n) => n.type === "yaml");
  if (yamlNode?.value) {
    return parseYaml(yamlNode.value) as Frontmatter;
  }
  // Fallback: extract from raw content
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (match) {
    return parseYaml(match[1]) as Frontmatter;
  }
  return null;
}

function collectInlineText(node: MdastNode): string {
  if (node.type === "text") return node.value ?? "";
  if (node.type === "inlineCode") return `\`${node.value}\``;
  if (node.type === "strong")
    return `**${(node.children ?? []).map(collectInlineText).join("")}**`;
  if (node.type === "emphasis")
    return `*${(node.children ?? []).map(collectInlineText).join("")}*`;
  if (node.type === "link")
    return (node.children ?? []).map(collectInlineText).join("");
  if (node.type === "html") return node.value ?? "";
  return (node.children ?? []).map(collectInlineText).join("");
}

function collectParagraphText(node: MdastNode): string {
  return (node.children ?? []).map(collectInlineText).join("");
}

function isNoteBlockquote(text: string): {
  variant: "info" | "warning" | "tip";
  content: string;
} | null {
  const match = text.match(
    /^\*\*(?:Note|Info):\*\*\s*([\s\S]*)/i
  );
  if (match) return { variant: "info", content: match[1].trim() };

  const warnMatch = text.match(/^\*\*Warning:\*\*\s*([\s\S]*)/i);
  if (warnMatch) return { variant: "warning", content: warnMatch[1].trim() };

  const tipMatch = text.match(/^\*\*(?:Tip|Hint):\*\*\s*([\s\S]*)/i);
  if (tipMatch) return { variant: "tip", content: tipMatch[1].trim() };

  return null;
}

function isConceptBlockquote(text: string): string | null {
  const match = text.match(/^\*\*Concept:\*\*\s*([\s\S]*)/i);
  if (match) return match[1].trim();
  return null;
}

function nodeToBlock(node: MdastNode): ContentBlock | null {
  switch (node.type) {
    case "paragraph": {
      const text = collectParagraphText(node);
      return { type: "text", content: text };
    }

    case "code": {
      return {
        type: "code",
        language: node.lang ?? "text",
        content: node.value ?? "",
      };
    }

    case "blockquote": {
      const innerText = (node.children ?? [])
        .map((child) => collectParagraphText(child))
        .join("\n");

      const concept = isConceptBlockquote(innerText);
      if (concept) return { type: "concept", content: concept };

      const note = isNoteBlockquote(innerText);
      if (note) return { type: "note", variant: note.variant, content: note.content };

      // Plain blockquote without a recognized prefix — treat as concept
      return { type: "concept", content: innerText };
    }

    case "list": {
      const items = (node.children ?? []).map((li) => {
        return (li.children ?? []).map(collectParagraphText).join("\n");
      });
      return {
        type: "list",
        items,
        ordered: node.ordered === true,
      };
    }

    case "table": {
      const rows = (node.children ?? []).map((row) =>
        (row.children ?? []).map((cell) => collectParagraphText(cell))
      );
      const headers = rows[0] ?? [];
      return {
        type: "table",
        headers,
        rows: rows.slice(1),
      };
    }

    default:
      return null;
  }
}

function parseMarkdownToSection(file: MarkdownFile): {
  frontmatter: Frontmatter;
  section: Section;
} | null {
  const tree = processor.parse(file.content) as MdastNode;
  const frontmatter = extractFrontmatter(tree, file.content);
  if (!frontmatter) return null;

  const contentNodes = (tree.children ?? []).filter(
    (n) => n.type !== "yaml"
  );

  // Split by h2 headings into subsections
  const subsections: SubSection[] = [];
  let currentSubId = "";
  let currentSubTitle = "";
  let currentBlocks: ContentBlock[] = [];

  // Skip the first h1 (it's the section title from frontmatter)
  let skippedH1 = false;

  for (const node of contentNodes) {
    if (node.type === "heading" && node.depth === 1 && !skippedH1) {
      skippedH1 = true;
      continue;
    }

    if (node.type === "heading" && node.depth === 2) {
      // Save previous subsection
      if (currentSubId && currentBlocks.length > 0) {
        subsections.push({
          id: currentSubId,
          title: currentSubTitle,
          content: currentBlocks,
        });
      }
      currentSubTitle = collectParagraphText(node);
      currentSubId = currentSubTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      currentBlocks = [];
      continue;
    }

    const block = nodeToBlock(node);
    if (block) currentBlocks.push(block);
  }

  // Save last subsection
  if (currentSubId && currentBlocks.length > 0) {
    subsections.push({
      id: currentSubId,
      title: currentSubTitle,
      content: currentBlocks,
    });
  }

  // If no h2 headings found, wrap everything in one subsection
  if (subsections.length === 0 && currentBlocks.length > 0) {
    subsections.push({
      id: "content",
      title: frontmatter.title,
      content: currentBlocks,
    });
  }

  return {
    frontmatter,
    section: {
      id: frontmatter.id,
      number: frontmatter.number,
      title: frontmatter.title,
      description: frontmatter.description,
      subsections,
    },
  };
}

/**
 * Parse markdown files into DocsCategory[].
 * Files are grouped by their `category` frontmatter field.
 * Sections are ordered by their `number` frontmatter field.
 */
export function parseMarkdownDocs(files: MarkdownFile[]): DocsCategory[] {
  const categoryMap = new Map<
    string,
    { title: string; sections: Section[] }
  >();

  for (const file of files) {
    const result = parseMarkdownToSection(file);
    if (!result) continue;

    const { frontmatter, section } = result;
    const catId = frontmatter.category;

    if (!categoryMap.has(catId)) {
      categoryMap.set(catId, {
        title:
          frontmatter.categoryTitle ??
          catId.charAt(0).toUpperCase() + catId.slice(1),
        sections: [],
      });
    }

    categoryMap.get(catId)!.sections.push(section);
  }

  // Sort sections by number within each category
  const categories: DocsCategory[] = [];
  for (const [id, { title, sections }] of categoryMap) {
    sections.sort((a, b) => a.number - b.number);
    categories.push({ id, title, sections });
  }

  return categories;
}

/**
 * Organize categories into sidebar sections.
 * Pass a mapping of sidebar group titles to category IDs.
 * Categories not in the mapping are placed at the top (no group title).
 */
export function organizeSidebar(
  categories: DocsCategory[],
  layout: Array<{ title: string; categoryIds: string[] }>
): SidebarSection[] {
  const usedIds = new Set(layout.flatMap((g) => g.categoryIds));
  const ungrouped = categories.filter((c) => !usedIds.has(c.id));

  const sections: SidebarSection[] = [];

  if (ungrouped.length > 0) {
    sections.push({ title: "", categories: ungrouped });
  }

  for (const group of layout) {
    const cats = group.categoryIds
      .map((id) => categories.find((c) => c.id === id))
      .filter(Boolean) as DocsCategory[];
    if (cats.length > 0) {
      sections.push({ title: group.title, categories: cats });
    }
  }

  return sections;
}
