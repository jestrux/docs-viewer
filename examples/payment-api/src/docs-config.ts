import { parseMarkdownDocs, organizeSidebar } from "@jestrux/docs-viewer/parser";
import type { DocsConfig } from "@jestrux/docs-viewer";

// ── Overview ──────────────────────────────────────────────────────────────────
import intro from "../docs/overview/01-intro.md?raw";

// ── Guides ────────────────────────────────────────────────────────────────────
import authentication from "../docs/guides/01-authentication.md?raw";
import quickstart from "../docs/guides/02-quickstart.md?raw";

// ── API Reference ─────────────────────────────────────────────────────────────
import charges from "../docs/api-reference/01-charges.md?raw";
import refunds from "../docs/api-reference/02-refunds.md?raw";
import webhooks from "../docs/api-reference/03-webhooks.md?raw";

const files = [
  { content: intro, path: "overview/01-intro.md" },
  { content: authentication, path: "guides/01-authentication.md" },
  { content: quickstart, path: "guides/02-quickstart.md" },
  { content: charges, path: "api-reference/01-charges.md" },
  { content: refunds, path: "api-reference/02-refunds.md" },
  { content: webhooks, path: "api-reference/03-webhooks.md" },
];

const categories = parseMarkdownDocs(files);

const sidebarSections = organizeSidebar(categories, [
  { title: "", categoryIds: ["overview"] },
  { title: "Guides", categoryIds: ["guides"] },
  { title: "API Reference", categoryIds: ["api-reference"] },
]);

export const docsConfig: DocsConfig = {
  title: "FlowPay",
  subtitle: "Payments API",
  sections: sidebarSections,
  ai: true,
  entities: [
    {
      keywords: ["charge", "payment", "create charge", "amount"],
      path: "api-reference/charges",
      label: "Charges",
      description: "Create and manage payment charges",
    },
    {
      keywords: ["refund", "reverse", "return", "cancel"],
      path: "api-reference/refunds",
      label: "Refunds",
      description: "Reverse settled charges fully or partially",
    },
    {
      keywords: ["webhook", "event", "notification", "callback", "settled"],
      path: "api-reference/webhooks",
      label: "Webhooks",
      description: "React to payment events in real time",
    },
    {
      keywords: ["auth", "api key", "token", "secret", "bearer", "test mode"],
      path: "guides/authentication",
      label: "Authentication",
      description: "API keys, test mode, and request signing",
    },
    {
      keywords: ["quickstart", "quick start", "getting started", "first charge", "example"],
      path: "guides/quickstart",
      label: "Quick Start",
      description: "Create your first charge in minutes",
    },
  ],
};
