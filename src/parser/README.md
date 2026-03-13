# Markdown Parser

Parse markdown files with frontmatter into the `DocsCategory[]` structure used by the DocsViewer.

## Frontmatter Format

```yaml
---
id: intro
number: 1
title: Introduction
description: What the app is and who it's for
category: overview
categoryTitle: Overview
---
```

## Markdown Conventions

| Markdown | Content Block |
|---|---|
| Paragraphs | `text` (supports `**bold**`, `` `code` ``, `[[link:path\|Label]]`, `[[types:Name]]`) |
| `## Heading` | Subsection boundary |
| ` ```lang ` | `code` block |
| `- item` / `1. item` | `list` block |
| GFM tables | `table` block |
| `> **Note:** ...` | `note` (info) |
| `> **Warning:** ...` | `note` (warning) |
| `> **Tip:** ...` | `note` (tip) |
| `> **Concept:** ...` | `concept` block |
| `> plain text` | `concept` block (default for blockquotes) |
| ` ```files ` | `files` block (use `tree` content) |

## Usage

```typescript
import { parseMarkdownDocs, organizeSidebar } from "@anthropic/docs-viewer/parser";

const files = [
  { path: "overview/intro.md", content: "---\nid: intro\n..." },
  { path: "overview/arch.md", content: "---\nid: architecture\n..." },
];

const categories = parseMarkdownDocs(files);

const sections = organizeSidebar(categories, [
  { title: "Product", categoryIds: ["pages", "flows"] },
  { title: "Platform", categoryIds: ["systems"] },
]);
```
