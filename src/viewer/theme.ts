import type { DocsThemeConfig } from "../types";

/** Generates a <style> tag content that derives a full palette from the primary color.
 *  Uses CSS color-mix(in oklch, ...) — runs entirely in the browser, no JS color math. */
export function buildDerivedThemeCSS(theme: DocsThemeConfig): string {
  if (!theme.primary) return "";

  const p = theme.primary;
  const pd = theme.primaryDark ?? `color-mix(in oklch, ${p} 65%, white)`;

  const lightVars = buildLightVars(p, theme.light);
  const darkVars = buildDarkVars(pd, theme.dark);

  const lightBlock = Object.entries(lightVars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");

  const darkBlock = Object.entries(darkVars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");

  const forcedDark = theme.colorScheme === "dark"
    ? `.docs-root[data-color-scheme="dark"] {\n${darkBlock}\n}`
    : "";

  return `
.docs-root {
${lightBlock}
}

@media (prefers-color-scheme: dark) {
  .docs-root:not([data-color-scheme="light"]) {
${darkBlock}
  }
}
${forcedDark}`.trim();
}

function buildLightVars(
  primary: string,
  overrides?: DocsThemeConfig["light"]
): Record<string, string> {
  const vars: Record<string, string> = {
    "--docs-primary": primary,
    "--docs-muted": `color-mix(in oklch, ${primary} 6%, white)`,
    "--docs-muted-foreground": `color-mix(in oklch, ${primary} 35%, #71717a)`,
    "--docs-border": `color-mix(in oklch, ${primary} 18%, #e4e4e7)`,
    "--docs-sidebar": `color-mix(in oklch, ${primary} 4%, rgba(250, 250, 250, 0.5))`,
    "--docs-sidebar-border": `color-mix(in oklch, ${primary} 12%, #f4f4f5)`,
    "--docs-sidebar-accent": `color-mix(in oklch, ${primary} 8%, #f4f4f5)`,
    "--docs-sidebar-accent-foreground": `color-mix(in oklch, ${primary} 80%, #18181b)`,
  };
  if (overrides) {
    for (const [key, val] of Object.entries(overrides)) {
      if (val) vars[`--docs-${key}`] = val;
    }
  }
  return vars;
}

function buildDarkVars(
  primaryDark: string,
  overrides?: DocsThemeConfig["dark"]
): Record<string, string> {
  const vars: Record<string, string> = {
    "--docs-primary": primaryDark,
    "--docs-muted": `color-mix(in oklch, ${primaryDark} 14%, #09090b)`,
    "--docs-muted-foreground": `color-mix(in oklch, ${primaryDark} 55%, #a1a1aa)`,
    "--docs-border": `color-mix(in oklch, ${primaryDark} 22%, #3f3f46)`,
    "--docs-sidebar": `color-mix(in oklch, ${primaryDark} 9%, rgba(9, 9, 11, 0.5))`,
    "--docs-sidebar-border": `color-mix(in oklch, ${primaryDark} 16%, #27272a)`,
    "--docs-sidebar-accent": `color-mix(in oklch, ${primaryDark} 16%, #27272a)`,
    "--docs-sidebar-accent-foreground": `color-mix(in oklch, ${primaryDark} 80%, #fafafa)`,
  };
  if (overrides) {
    for (const [key, val] of Object.entries(overrides)) {
      if (val) vars[`--docs-${key}`] = val;
    }
  }
  return vars;
}

/** Returns explicit token overrides as inline CSS properties (for non-derived tokens). */
export function buildExplicitThemeVars(theme: DocsThemeConfig): Record<string, string> {
  const vars: Record<string, string> = {};
  // Only set card/background/foreground explicitly if provided — otherwise CSS defaults apply
  const explicit = theme.light;
  if (explicit) {
    for (const [key, val] of Object.entries(explicit)) {
      if (val) vars[`--docs-${key}`] = val;
    }
  }
  return vars;
}
