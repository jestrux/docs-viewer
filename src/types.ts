export type ContentBlock =
  | { type: "text"; content: string }
  | { type: "code"; language: string; content: string }
  | { type: "note"; variant: "info" | "warning" | "tip"; content: string }
  | { type: "concept"; content: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "list"; items: string[]; ordered?: boolean }
  | { type: "files"; tree: string }
  | { type: "props"; items: PropDefinition[] }
  | { type: "fields"; items: FieldDefinition[] };

export interface PropDefinition {
  name: string;
  type: string;
  required?: boolean;
  description: string;
}

export interface FieldDefinition {
  name: string;
  type: string;
  description: string;
}

export interface SubSection {
  id: string;
  title: string;
  content: ContentBlock[];
}

export interface Section {
  id: string;
  number: number;
  title: string;
  description?: string;
  subsections: SubSection[];
}

export interface DocsCategory {
  id: string;
  title: string;
  sections: Section[];
}

export interface SidebarSection {
  title: string;
  categories: DocsCategory[];
}

export type DocsSection = Section;

export interface DocsAiConfig {
  /** Force a specific provider instead of auto-detecting from key prefix */
  provider?: "openai" | "anthropic";
  /** Model override. Defaults: openai → "gpt-4o", anthropic → "claude-haiku-4-5-20251001" */
  model?: string;
  /** Hardcode an API key — users will never be prompted */
  key?: string;
  /** Custom ask function — bypasses all built-in key management and fetch logic */
  ask?: (messages: import("./viewer/ai").ChatMessage[], context: string) => AsyncIterable<string>;
}

export interface DocsEntityConfig {
  /** Keywords that trigger this as a quick-jump result in the palette */
  keywords: string[];
  /** Navigation path, e.g. "architecture/loan-lifecycle" */
  path: string;
  /** Display label */
  label: string;
  /** Optional description shown under the label */
  description?: string;
}

export interface DocsThemeTokens {
  background?: string;
  foreground?: string;
  card?: string;
  "card-foreground"?: string;
  primary?: string;
  "primary-foreground"?: string;
  secondary?: string;
  "secondary-foreground"?: string;
  muted?: string;
  "muted-foreground"?: string;
  border?: string;
  sidebar?: string;
  "sidebar-foreground"?: string;
  "sidebar-border"?: string;
  "sidebar-accent"?: string;
  "sidebar-accent-foreground"?: string;
}

export interface DocsThemeConfig {
  /** Primary brand color (hex). Derives the full light palette automatically. */
  primary?: string;
  /** Primary color for dark mode. If omitted, auto-lightened from primary. */
  primaryDark?: string;
  /** Explicit light mode token overrides (merged on top of derived values) */
  light?: DocsThemeTokens;
  /** Explicit dark mode token overrides (merged on top of derived values) */
  dark?: DocsThemeTokens;
  /** Force a color scheme. Defaults to "system" (follows prefers-color-scheme). */
  colorScheme?: "light" | "dark" | "system";
}

export interface DocsConfig {
  /** App name shown in sidebar header */
  title: string;
  /** Subtitle shown below title */
  subtitle?: string;
  /** Sidebar sections with categories */
  sections: SidebarSection[];
  /** Flat list of all categories (derived from sections if not provided) */
  categories?: DocsCategory[];
  /** Default route to redirect to from / */
  defaultRoute?: string;
  /** Logo element to render in sidebar (optional, defaults to first letter of title) */
  logo?: React.ReactNode;
  /** Base path prefix for all navigation (e.g. "/docs"). Defaults to "". */
  basePath?: string;
  /** Enable AI Q&A. true = auto-detect provider from key prefix. Object = custom config. Omit to disable. */
  ai?: true | DocsAiConfig;
  /** Entity quick-jump entries shown in the command palette */
  entities?: DocsEntityConfig[];
  /** Theme configuration. Pass primary color for auto-derived palette, or full token sets. */
  theme?: DocsThemeConfig;
  /** Favicon. Accepts a React node (SVG element), a single URL string, or { light, dark } URLs. */
  favicon?: React.ReactNode | string | { light: string; dark: string };
}
