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
}
