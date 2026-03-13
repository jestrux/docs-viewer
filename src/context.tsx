import { createContext, useContext, type ReactNode } from "react";
import type { DocsConfig, DocsCategory } from "./types";

interface DocsContextValue extends DocsConfig {
  categories: DocsCategory[];
}

const DocsContext = createContext<DocsContextValue | null>(null);

export function DocsProvider({
  config,
  children,
}: {
  config: DocsConfig;
  children: ReactNode;
}) {
  const categories =
    config.categories ?? config.sections.flatMap((s) => s.categories);

  return (
    <DocsContext.Provider value={{ ...config, categories }}>
      {children}
    </DocsContext.Provider>
  );
}

export function useDocs(): DocsContextValue {
  const ctx = useContext(DocsContext);
  if (!ctx) throw new Error("useDocs must be used within DocsProvider");
  return ctx;
}
