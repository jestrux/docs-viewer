import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { DocsConfig, DocsCategory } from "./types";

interface DocsContextValue extends DocsConfig {
  categories: DocsCategory[];
  basePath: string;
}

const DocsContext = createContext<DocsContextValue | null>(null);

export function DocsProvider({
  config,
  children,
}: {
  config: DocsConfig;
  children: ReactNode;
}) {
  const value = useMemo<DocsContextValue>(
    () => ({
      ...config,
      categories: config.categories ?? config.sections.flatMap((s) => s.categories),
      basePath: config.basePath ?? "",
    }),
    [config]
  );

  return (
    <DocsContext.Provider value={value}>
      {children}
    </DocsContext.Provider>
  );
}

export function useDocs(): DocsContextValue {
  const ctx = useContext(DocsContext);
  if (!ctx) throw new Error("useDocs must be used within DocsProvider");
  return ctx;
}
