import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { DocsProvider, DocsViewer } from "@jestrux/docs-viewer";
import "@jestrux/docs-viewer/styles";
import { docsConfig } from "./docs-config";

const logo = (
  <div
    style={{ backgroundColor: "#0D9488" }}
    className="size-9 rounded-lg flex items-center justify-center shadow-sm"
  >
    <svg
      style={{ color: "white" }}
      className="size-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </svg>
  </div>
);

const favicon = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#0D9488" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <style>{`@media (prefers-color-scheme: dark) { path { stroke: #5EEAD4; } }`}</style>
    <path d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/overview/intro" replace />} />
        <Route
          path="/:categoryId/:sectionId"
          element={
            <DocsProvider config={{
              ...docsConfig,
              logo,
              favicon,
              theme: {
                primary: "#0D9488",
                primaryDark: "#5EEAD4",
                light: {
                  background: "#FFFFFF",
                  foreground: "#0F2825",
                  card: "#FFFFFF",
                  "card-foreground": "#0F2825",
                  primary: "#0D9488",
                  "primary-foreground": "#FFFFFF",
                  muted: "#F0FAFA",
                  "muted-foreground": "#5E8A85",
                  border: "#D1EDEA",
                  sidebar: "#FFFFFF",
                  "sidebar-foreground": "#0F2825",
                  "sidebar-border": "#D1EDEA",
                  "sidebar-accent": "#F0FAFA",
                  "sidebar-accent-foreground": "#0F2825",
                },
                dark: {
                  background: "#071A18",
                  foreground: "#E6F7F5",
                  card: "#0D2420",
                  "card-foreground": "#E6F7F5",
                  primary: "#5EEAD4",
                  "primary-foreground": "#071A18",
                  muted: "#122E2A",
                  "muted-foreground": "#6BA89F",
                  border: "#163D38",
                  sidebar: "#0D2420",
                  "sidebar-foreground": "#E6F7F5",
                  "sidebar-border": "#163D38",
                  "sidebar-accent": "#122E2A",
                  "sidebar-accent-foreground": "#E6F7F5",
                },
              },
            }}
            >
              <DocsViewer />
            </DocsProvider>
          }
        />
      </Routes>
    </HashRouter>
  );
}
