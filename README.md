# @jestrux/docs-viewer

A React component library that turns a folder of Markdown files into a fully-featured documentation site — with sidebar navigation, full-text search, cross-linking with hover previews, and optional AI Q&A.

No build step. Ships raw TypeScript source, consumed directly by Vite or any bundler that handles `.ts` imports.

**[Live demo](https://jestrux.github.io/docs-viewer/)** · **[Example source](examples/payment-api)**

---

## Install

```bash
npm install github:jestrux/docs-viewer
# or
yarn add github:jestrux/docs-viewer
```

**Peer dependencies** (must already be in your project):

```
react >= 18
react-dom >= 18
react-router-dom >= 6
```

---

## Quick start

### 1. Write your Markdown files

Each file needs a YAML frontmatter block:

```md
---
id: system-overview
number: 1
title: System Overview
category: architecture
categoryTitle: Architecture   # optional — inferred from category ID if omitted
description: High-level description shown under the page title  # optional
---

## First section heading

Content goes here...

## Second section heading

More content...
```

- `id` — unique identifier for this page, used in URLs and cross-links
- `number` — sort order within the category
- `category` — groups pages together in the sidebar
- `categoryTitle` — display name for the category (only needs to appear once per category)

### 2. Parse the files and build the config

```ts
// docs-config.ts
import { parseMarkdownDocs, organizeSidebar } from "@jestrux/docs-viewer/parser";
import type { DocsConfig } from "@jestrux/docs-viewer";

import intro from "../docs/overview/01-intro.md?raw";
import systemOverview from "../docs/architecture/01-system-overview.md?raw";
// ... import all your files

const categories = parseMarkdownDocs([
  { content: intro, path: "overview/01-intro.md" },
  { content: systemOverview, path: "architecture/01-system-overview.md" },
  // ...
]);

const sidebarSections = organizeSidebar(categories, [
  { title: "",             categoryIds: ["overview"] },
  { title: "Architecture", categoryIds: ["architecture"] },
  { title: "API Reference", categoryIds: ["api-reference"] },
]);

export const docsConfig: DocsConfig = {
  title: "My Docs",
  subtitle: "Technical reference",
  sections: sidebarSections,
};
```

### 3. Render the viewer

```tsx
// App.tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DocsProvider, DocsViewer } from "@jestrux/docs-viewer";
import "@jestrux/docs-viewer/styles";
import { docsConfig } from "./docs-config";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/overview/intro" replace />} />
        <Route
          path="/:categoryId/:sectionId"
          element={
            <DocsProvider config={docsConfig}>
              <DocsViewer />
            </DocsProvider>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
```

---

## Markdown content blocks

The parser converts Markdown constructs into typed content blocks rendered by `ContentRenderer`.

### Text

Regular paragraphs. Supports inline formatting (see [Inline syntax](#inline-syntax)).

```md
This is a paragraph with **bold**, `inline code`, and a [[link:architecture/system-overview|cross-link]].
```

### Code blocks

Fenced code blocks with syntax highlighting (via `sugar-high`).

````md
```typescript
const x: string = "hello";
```
````

### Tables (GFM)

Standard Markdown tables. Cells support inline formatting including cross-links.

```md
| Column A | Column B |
|---|---|
| Value | Another value |
```

### Lists

Ordered and unordered lists. Items support inline formatting.

```md
- First item with `code`
- Second item with [[link:category/section|a link]]

1. Ordered item
2. Another item
```

### Notes / callouts

Blockquotes with a recognised prefix become styled callout blocks:

```md
> **Note:** This is an info callout.

> **Warning:** This is a warning callout.

> **Tip:** This is a tip callout.
```

Variants: `Note` / `Info` → blue, `Warning` → amber, `Tip` / `Hint` → green.

### Concept blocks

```md
> **Concept:** A plain blockquote without a recognised prefix, or with the Concept prefix, renders as a violet concept block.
```

### File trees

Use a fenced code block with language `files`:

````md
```files
src/
  components/
    Button.tsx
  index.ts
```
````

---

## Inline syntax

These patterns work inside any text, list item, table cell, or callout:

| Syntax | Output |
|---|---|
| `**bold**` | Bold text |
| `` `code` `` | Inline code chip |
| `[[link:category/section\|Label]]` | Clickable cross-link button |
| `[[link:category/section/subsection\|Label]]` | Link to a specific subsection |
| `[[types:TypeName]]` | Link to a type definition page |

---

## Cross-links

Cross-links connect pages together and unlock hover previews.

**Syntax:** `[[link:categoryId/sectionId|Link text]]`

```md
See the [[link:architecture/loan-lifecycle|Loan Lifecycle]] for state transitions.

The [[link:integrations/stripe|Stripe integration]] handles payment intents.
```

- `categoryId` — the `category` field in the target file's frontmatter
- `sectionId` — the `id` field in the target file's frontmatter

**Hover previews:** Hovering a cross-link for 300ms shows a popover with a preview of the linked page's first content blocks. Clicking "Go to page" navigates there. This works automatically — no extra configuration needed.

**Subsection links:** Add a third segment to link to a specific `##` heading within a page:

```md
[[link:data-architecture/contracts/contract-states|Contract states]]
```

---

## Sidebar

### Logo

Pass any React node as `logo` in the config:

```tsx
const logo = (
  <div className="size-9 rounded-lg bg-blue-600 flex items-center justify-center">
    <span className="text-white font-bold">A</span>
  </div>
);

export const docsConfig: DocsConfig = {
  title: "My Docs",
  logo,
  // ...
};
```

Without `logo`, the sidebar defaults to a dark square with the first letter of `title`.

### Favicon

Pass a `favicon` in config — accepts a React node (SVG element), a single URL string, or `{ light, dark }` URLs for automatic dark mode switching:

```ts
// React node — SVG handles its own dark/light via @media (prefers-color-scheme)
favicon: <MyLogoSvg />,

// Single URL
favicon: "/favicon.svg",

// Light + dark URLs — swaps automatically based on system color scheme
favicon: {
  light: `${import.meta.env.BASE_URL}favicon.svg`,
  dark: `${import.meta.env.BASE_URL}favicon-dark.svg`,
},
```

The library injects a `<link rel="icon">` into `<head>` and keeps it in sync with color scheme changes. For the React node path, `currentColor` won't work in favicons (no DOM context) — embed `@media (prefers-color-scheme: dark)` inside the SVG instead.

### Sidebar sections and grouping

`organizeSidebar` arranges categories into labelled groups:

```ts
organizeSidebar(categories, [
  { title: "",              categoryIds: ["overview"] },        // no label
  { title: "Architecture",  categoryIds: ["architecture"] },
  { title: "API Reference", categoryIds: ["api-reference"] },
  { title: "Deployment",    categoryIds: ["deployment"] },
]);
```

Categories not listed in the layout appear ungrouped at the top.

### Categories with a single section

If a category contains exactly one section, it renders as a flat link in the sidebar rather than an expandable group.

---

## Search

Full-text fuzzy search is built in (powered by `fuse.js`). Open with `Cmd+K` / `Ctrl+K` or the search button in the sidebar.

- Searches page titles and content
- Highlights matching terms in results
- Remembers the last 10 visited pages per session (stored in `localStorage`)
- Keyboard navigation: `↑` `↓` to move, `↵` to select, `Esc` to dismiss

No configuration required.

---

## Entity quick-jumps

Register named entities so users can jump directly to a page by typing a keyword in the search palette.

```ts
export const docsConfig: DocsConfig = {
  // ...
  entities: [
    {
      keywords: ["stripe", "payment", "checkout"],
      path: "integrations/stripe",
      label: "Stripe Integration",
      description: "PaymentIntents, webhooks, Connect",
    },
    {
      keywords: ["contract", "loan lifecycle", "state machine"],
      path: "architecture/loan-lifecycle",
      label: "Loan Lifecycle",
      description: "State transitions for loans and contracts",
    },
  ],
};
```

When a user types a matching keyword, the entity appears at the top of search results under a **Quick jump** header with an arrow icon. Each entry shows the label as a title with the description on a second line below. Clicking navigates directly to that page.

---

## AI Q&A

Add AI-powered question answering to the command palette. The full documentation context is automatically assembled from all parsed Markdown and sent as the system prompt — no backend, no embeddings, no setup beyond a config flag.

### Enable with defaults

```ts
ai: true
```

That's it. The first time a user selects "Ask AI", they're prompted to enter an API key. The key is stored in `localStorage` under `docs-viewer-ai-key` and reused on subsequent visits.

The provider is **auto-detected from the key prefix**:
- `sk-ant-...` → Anthropic (`claude-haiku-4-5-20251001`)
- `sk-...` → OpenAI (`gpt-4o`)

### Override provider or model

```ts
ai: {
  provider: "anthropic",
  model: "claude-sonnet-4-6",
}
```

### Hardcode a key (no user prompt)

Useful for internal / team docs where you want to supply the key yourself:

```ts
ai: {
  key: import.meta.env.VITE_OPENAI_KEY,
}
```

When `key` is set in config, users are never prompted to enter one.

### Custom ask function

Full escape hatch — the library skips all key management and calls your function directly:

```ts
ai: {
  ask: async function* (question, context) {
    const res = await fetch("/api/ask", {
      method: "POST",
      body: JSON.stringify({ question, context }),
    });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield decoder.decode(value, { stream: true });
    }
  },
}
```

`context` is the full docs content built by `buildDocsContext(categories)`, which is also exported if you need it outside the library.

### AI config reference

| Field | Type | Description |
|---|---|---|
| `provider` | `"openai" \| "anthropic"` | Force a provider instead of auto-detecting from key |
| `model` | `string` | Model override. Defaults: `gpt-4o` / `claude-haiku-4-5-20251001` |
| `key` | `string` | Hardcode an API key — users will never be prompted |
| `ask` | `(question, context) => AsyncIterable<string>` | Custom provider function — bypasses all built-in logic |

All fields are optional. `ai: true` is equivalent to `ai: {}`.

### Citation linking

AI responses include markdown links to relevant doc pages (e.g. `[Loan Lifecycle](architecture/loan-lifecycle)`). These render as clickable links that navigate directly to the referenced page. Hovering them shows the same link preview popover as inline cross-links in the docs content.

### How it works in the palette

1. User types a query → search results appear + "Ask AI: …" row at the bottom
2. User selects the AI row (click or `↵`)
3. If no key is stored and no key is hardcoded → key entry prompt appears
4. User pastes their key → saved to `localStorage`, answer streams immediately
5. On future visits the key is already stored → answer streams directly
6. A "Remove API key" link in the answer view lets users clear the stored key
7. Clicking a citation link navigates to that page and closes the palette

---

## Theming

Pass a `theme` object in config to apply a custom color palette. The viewer uses CSS custom properties scoped to `.docs-root`, so themes are fully isolated and work alongside any existing styles.

### Minimal — primary color only

Pass a single hex color and the full light palette is automatically derived via `color-mix(in oklch)` in the browser. The dark variant is also auto-generated.

```ts
export const docsConfig: DocsConfig = {
  theme: {
    primary: "#9742E7",
  },
};
```

### Primary + explicit dark variant

```ts
theme: {
  primary: "#9742E7",
  primaryDark: "#B47BF0",
}
```

### Full token sets

Pass explicit `light` and `dark` token objects to match an existing design system exactly:

```ts
theme: {
  primary: "#9742E7",
  primaryDark: "#B47BF0",
  light: {
    background: "#FFFFFF",
    foreground: "#1A0F2E",
    card: "#FFFFFF",
    muted: "#F2EFFE",
    "muted-foreground": "#9580B3",
    border: "#E4DAF5",
    sidebar: "#FFFFFF",
    "sidebar-foreground": "#1A0F2E",
    "sidebar-border": "#E4DAF5",
    "sidebar-accent": "#F2EFFE",
    "sidebar-accent-foreground": "#1A0F2E",
  },
  dark: {
    background: "#120A1E",
    foreground: "#F0EAFF",
    card: "#1E1430",
    muted: "#261A3A",
    "muted-foreground": "#8B77A8",
    border: "#2E1F47",
    sidebar: "#1E1430",
    "sidebar-foreground": "#F0EAFF",
    "sidebar-border": "#2E1F47",
    "sidebar-accent": "#261A3A",
    "sidebar-accent-foreground": "#F0EAFF",
  },
}
```

Explicit token values are merged on top of the derived palette, so you can override just the tokens you care about.

### Force a color scheme

```ts
theme: {
  primary: "#9742E7",
  colorScheme: "dark",   // "light" | "dark" | "system" (default)
}
```

`"system"` (the default) follows `prefers-color-scheme`. Pass `"light"` or `"dark"` to force a specific mode regardless of the user's OS setting.

### `DocsThemeTokens` reference

| Token | Description |
|---|---|
| `background` | Page background |
| `foreground` | Primary text color |
| `card` | Surface color for cards and popovers |
| `card-foreground` | Text on card surfaces |
| `primary` | Brand / accent color used for links, buttons, active states |
| `primary-foreground` | Text on primary-colored backgrounds |
| `muted` | Subtle background for code chips, table headers, hover states |
| `muted-foreground` | Secondary / subdued text |
| `border` | Border color for dividers, inputs, cards |
| `sidebar` | Sidebar background |
| `sidebar-foreground` | Sidebar text |
| `sidebar-border` | Sidebar border and divider |
| `sidebar-accent` | Active / selected item background in sidebar |
| `sidebar-accent-foreground` | Text on active sidebar items |

---

## Base path

If your docs are hosted under a path prefix (e.g. `/docs`), set `basePath`:

```ts
export const docsConfig: DocsConfig = {
  basePath: "/docs",
  // ...
};
```

Update your router accordingly:

```tsx
<Route path="/docs/:categoryId/:sectionId" element={...} />
```

---

## Exports

```ts
// Components and hooks
import { DocsViewer, DocsProvider, ContentRenderer, CommandPalette, useDocs, useLinkPreview } from "@jestrux/docs-viewer";

// Parser utilities
import { parseMarkdownDocs, organizeSidebar } from "@jestrux/docs-viewer/parser";

// AI context builder (if you need it outside the library)
import { buildDocsContext } from "@jestrux/docs-viewer";

// Types
import type { DocsConfig, DocsAiConfig, DocsEntityConfig, DocsThemeConfig, DocsThemeTokens, DocsCategory, Section, SubSection, ContentBlock } from "@jestrux/docs-viewer";

// Styles (import once at app root)
import "@jestrux/docs-viewer/styles";
```

---

## `DocsConfig` reference

| Field | Type | Required | Description |
|---|---|---|---|
| `title` | `string` | Yes | App name shown in sidebar header |
| `subtitle` | `string` | No | Subtitle shown below title |
| `sections` | `SidebarSection[]` | Yes | Sidebar layout (from `organizeSidebar`) |
| `categories` | `DocsCategory[]` | No | Flat category list — derived from `sections` if omitted |
| `logo` | `ReactNode` | No | Logo element in sidebar header |
| `basePath` | `string` | No | URL prefix, e.g. `"/docs"`. Defaults to `""` |
| `ai` | `true \| DocsAiConfig` | No | Enable AI Q&A. Omit to disable |
| `entities` | `DocsEntityConfig[]` | No | Quick-jump entries in the command palette |
| `theme` | `DocsThemeConfig` | No | Custom color palette — see [Theming](#theming) |
| `favicon` | `ReactNode \| string \| { light: string; dark: string }` | No | Favicon — React node (SVG), URL string, or light/dark URL pair |
| `defaultRoute` | `string` | No | Default redirect path |

---

## `DocsAiConfig` reference

| Field | Type | Description |
|---|---|---|
| `provider` | `"openai" \| "anthropic"` | Force provider (default: auto-detect from key prefix) |
| `model` | `string` | Model override |
| `key` | `string` | Hardcoded API key — skips user prompt |
| `ask` | `(q: string, ctx: string) => AsyncIterable<string>` | Custom stream function |

---

## `DocsEntityConfig` reference

| Field | Type | Description |
|---|---|---|
| `keywords` | `string[]` | Terms that trigger this entry in the palette |
| `path` | `string` | Navigation path, e.g. `"architecture/loan-lifecycle"` |
| `label` | `string` | Display name |
| `description` | `string` | Optional subtitle shown under the label |

---

## Frontmatter reference

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | Unique page ID, used in URLs and cross-links |
| `number` | `number` | Yes | Sort order within the category |
| `title` | `string` | Yes | Page title |
| `category` | `string` | Yes | Category ID for grouping |
| `categoryTitle` | `string` | No | Display name for the category group |
| `description` | `string` | No | Subtitle shown under the page title |
