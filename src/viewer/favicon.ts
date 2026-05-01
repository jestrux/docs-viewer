import React, { useEffect } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { DocsConfig } from "../types";

type FaviconValue = DocsConfig["favicon"];

function setFaviconHref(href: string, type?: string) {
  let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = href;
  if (type) link.type = type;
}

export function useFavicon(favicon: FaviconValue) {
  useEffect(() => {
    if (favicon == null || favicon === false) return;

    // Single URL string
    if (typeof favicon === "string") {
      setFaviconHref(favicon);
      return;
    }

    // { light, dark } URL pair — swap on color scheme change
    if (typeof favicon === "object" && "light" in (favicon as object) && "dark" in (favicon as object)) {
      const { light, dark } = favicon as { light: string; dark: string };
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const update = () => setFaviconHref(mq.matches ? dark : light);
      update();
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }

    // React node — serialize to SVG data URL
    try {
      const markup = renderToStaticMarkup(favicon as React.ReactElement);
      setFaviconHref(`data:image/svg+xml,${encodeURIComponent(markup)}`, "image/svg+xml");
    } catch {
      // Not a renderable element, skip
    }
  }, [favicon]);
}
