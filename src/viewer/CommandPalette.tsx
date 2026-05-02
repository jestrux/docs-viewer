import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useMediaQuery } from "./hooks";
import type Fuse from "fuse.js";
import { useNavigate } from "react-router-dom";
import { useDocs } from "../context";
import {
  highlightWithIndices,
  getSearchHistory,
  addToSearchHistory,
  clearSearchHistory,
  buildDocsContext,
  type SearchResult,
} from "./search";
import {
  getStoredApiKey,
  storeApiKey,
  removeStoredApiKey,
  resolveAiConfig,
  resolveApiKey,
  streamAiAnswer,
  type ChatMessage,
} from "./ai";
import { MarkdownMessage } from "./markdown";
import { useLinkPreview } from "./LinkPreviewPopover";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (result: SearchResult) => void;
  fuse: Fuse<any>;
  storageKey: string;
  isMobile?: boolean;
}

export function CommandPalette({
  isOpen,
  onClose,
  onSelect,
  fuse,
  storageKey,
}: CommandPaletteProps) {
  const [hasOpened, setHasOpened] = useState(false);
  const isMobile = useMediaQuery("(max-width: 767px)");

  useEffect(() => {
    if (isOpen) setHasOpened(true);
  }, [isOpen]);

  if (!hasOpened) return null;

  if (isMobile) {
    return (
      <MobileCommandPalette
        isOpen={isOpen}
        onClose={onClose}
        onSelect={onSelect}
        fuse={fuse}
        storageKey={storageKey}
      />
    );
  }

  return (
    <div style={{ display: isOpen ? undefined : "none" }}>
      <CommandPaletteContent
        isOpen={isOpen}
        onClose={onClose}
        onSelect={onSelect}
        fuse={fuse}
        storageKey={storageKey}
      />
    </div>
  );
}

type PaletteMode = "search" | "api-key" | "answer";

type DisplayItem =
  | { kind: "entity"; path: string; label: string; description?: string }
  | { kind: "page"; path: string; label: string; categoryTitle: string }
  | { kind: "result"; result: SearchResult }
  | { kind: "ask-ai" };

function isQuestion(q: string): boolean {
  const trimmed = q.trim();
  const lower = trimmed.toLowerCase();
  if (lower.endsWith("?")) return true;
  if (trimmed.split(/\s+/).length >= 6) return true;
  const starters = [
    "how", "what", "why", "when", "where", "who", "which",
    "can", "does", "is", "are", "will", "would", "should", "could", "do",
    "explain", "tell me", "describe", "walk me", "show me",
  ];
  return starters.some((w) => lower.startsWith(w + " "));
}

// ─── PaletteItem — handles scroll-into-view when selected ────────────────

function PaletteItem({
  isSelected,
  isFirstInSection,
  onClick,
  className,
  children,
}: {
  isSelected: boolean;
  isFirstInSection?: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (isSelected) {
      const target = isFirstInSection
        ? (ref.current?.previousElementSibling ?? ref.current)
        : ref.current;
      target?.scrollIntoView({ block: "nearest" });
    }
  }, [isSelected, isFirstInSection]);

  return (
    <button
      ref={ref}
      onClick={onClick}
      className={`w-full text-left transition-colors hover:bg-[var(--docs-muted)] ${
        isSelected ? "bg-[var(--docs-sidebar-accent)]" : ""
      } ${className ?? ""}`}
    >
      {children}
    </button>
  );
}

// ─── Section label ────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="px-4 pt-3 pb-1">
      <span className="text-[11px] font-semibold text-[var(--docs-muted-foreground)] uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}

// ─── Main content ─────────────────────────────────────────────────────────

function CommandPaletteContent({
  isOpen,
  onClose,
  onSelect,
  fuse,
  storageKey,
}: Omit<CommandPaletteProps, "isMobile">) {
  const { ai, entities, categories, basePath = "" } = useDocs();
  const navigate = useNavigate();

  const [mode, setMode] = useState<PaletteMode>("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [history] = useState<SearchResult[]>(() => getSearchHistory(storageKey));
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [pendingFirstQuestion, setPendingFirstQuestion] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [followUpInput, setFollowUpInput] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const apiKeyInputRef = useRef<HTMLInputElement>(null);
  const followUpInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasStartedStreaming, setHasStartedStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamingNodeRef = useRef<HTMLDivElement>(null);
  const streamingContent = useRef("");
  const docsContext = useMemo(() => buildDocsContext(categories), [categories]);
  const linkPreview = useLinkPreview(categories, chatRef, (path) => {
    onClose();
    navigate(`${basePath}/${path}`);
  });

  const append = useCallback(
    async (userMsg: ChatMessage, priorMessages?: ChatMessage[]) => {
      if (!ai) return;
      abortRef.current?.abort();
      const abort = new AbortController();
      abortRef.current = abort;

      const prior = priorMessages ?? messages;
      const nextMessages: ChatMessage[] = [...prior, userMsg];
      streamingContent.current = "";
      setMessages([...nextMessages, { role: "assistant", content: "" }]);
      setIsStreaming(true);
      setHasStartedStreaming(false);
      setStreamError(null);
      // Scroll AI bubble into view after React renders the new messages
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 0);

      try {
        for await (const chunk of streamAiAnswer(ai, nextMessages, docsContext, abort.signal)) {
          if (abort.signal.aborted) break;
          if (!streamingContent.current) setHasStartedStreaming(true); // one re-render on first chunk
          streamingContent.current += chunk;
          if (streamingNodeRef.current) {
            streamingNodeRef.current.textContent = streamingContent.current;
          }
          messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
        }
      } catch (err) {
        if (!abort.signal.aborted) {
          setStreamError((err as Error).message ?? "Something went wrong");
        }
      } finally {
        if (!abort.signal.aborted) {
          setMessages([...nextMessages, { role: "assistant", content: streamingContent.current }]);
        }
        setIsStreaming(false);
        setHasStartedStreaming(false);
        abortRef.current = null;
        setTimeout(() => followUpInputRef.current?.focus(), 10);
      }
    },
    [ai, messages, docsContext]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  // Focus management — fires on mode change AND whenever palette opens
  const focusForMode = useCallback((m: PaletteMode) => {
    if (m === "search") inputRef.current?.focus();
    else if (m === "api-key") apiKeyInputRef.current?.focus();
    else if (m === "answer") followUpInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => focusForMode(mode), 10);
    return () => clearTimeout(t);
  }, [mode, focusForMode]);

  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => focusForMode(mode), 10);
    return () => clearTimeout(t);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps


  // Search
  const performSearch = useCallback(
    (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([]);
        setSelectedIndex(0);
        return;
      }
      const fuseResults = fuse.search(searchQuery, { limit: 20 });
      const seen = new Set<string>();
      const lowerQuery = searchQuery.toLowerCase();

      const searchResults: Array<SearchResult & { sortScore: number }> =
        fuseResults
          .filter((r) => {
            const key = `${r.item.sectionId}-${r.item.subsectionId || ""}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .map((r) => {
            const item = r.item;
            const matches = r.matches || [];
            const fuseScore = r.score ?? 1;

            const titleMatch = matches.find((m) => m.key === "title");
            const titleIndices = titleMatch?.indices;
            const contentMatch = matches.find((m) => m.key === "content");
            let matchText = "";
            let matchIndices:
              | ReadonlyArray<readonly [number, number]>
              | undefined;

            if (contentMatch && contentMatch.indices.length > 0) {
              const firstMatch = contentMatch.indices[0];
              const start = Math.max(0, firstMatch[0] - 30);
              const end = Math.min(item.content.length, firstMatch[1] + 60);
              matchText =
                (start > 0 ? "..." : "") +
                item.content.slice(start, end) +
                (end < item.content.length ? "..." : "");
              matchIndices = contentMatch.indices
                .filter(([s, e]) => s >= start && e <= end)
                .map(
                  ([s, e]) =>
                    [
                      s - start + (start > 0 ? 3 : 0),
                      e - start + (start > 0 ? 3 : 0),
                    ] as const
                );
            }

            let sortScore = fuseScore;
            const lowerTitle = item.title.toLowerCase();
            const lowerContent = item.content.toLowerCase();
            if (lowerTitle === lowerQuery) sortScore -= 1;
            else if (lowerTitle.includes(lowerQuery)) sortScore -= 0.5;
            if (lowerContent.includes(lowerQuery)) sortScore -= 0.3;

            return {
              categoryId: item.categoryId,
              categoryTitle: item.categoryTitle,
              sectionId: item.sectionId,
              sectionTitle: item.sectionTitle,
              subsectionId: item.subsectionId,
              subsectionTitle: item.subsectionTitle,
              matchText: matchText.replace(/\s+/g, " ").trim(),
              titleIndices,
              matchIndices,
              sortScore,
            };
          });

      searchResults.sort((a, b) => a.sortScore - b.sortScore);
      setResults(searchResults.slice(0, 10));
      setSelectedIndex(0);
    },
    [fuse]
  );

  useEffect(() => {
    const t = setTimeout(() => performSearch(query), 100);
    return () => clearTimeout(t);
  }, [query, performSearch]);

  // Entity matching
  const entityMatches = useMemo(() => {
    if (!entities || !query.trim()) return [];
    const lowerQuery = query.toLowerCase();
    return entities.filter((e) =>
      e.keywords.some(
        (k) =>
          lowerQuery.includes(k.toLowerCase()) ||
          k.toLowerCase().includes(lowerQuery)
      )
    );
  }, [entities, query]);

  const triggerAsk = useCallback(
    (question: string) => {
      if (!ai) return;
      const config = resolveAiConfig(ai);
      const needsKey = !config.ask && !resolveApiKey(config);
      if (needsKey) {
        setPendingFirstQuestion(question);
        setMode("api-key");
      } else {
        setMode("answer");
        append({ role: "user", content: question }, []);
      }
    },
    [ai, append]
  );

  const handleSaveApiKey = () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed || !ai) return;
    const config = resolveAiConfig(ai);
    if (!config.ask) storeApiKey(trimmed);
    setApiKeyInput("");
    setMode("answer");
    append({ role: "user", content: pendingFirstQuestion }, []);
  };

  const handleFollowUp = () => {
    const q = followUpInput.trim();
    if (!q || isStreaming) return;
    setFollowUpInput("");
    append({ role: "user", content: q });
  };

  const goBackToSearch = useCallback(() => {
    stop();
    setMessages([]);
    setMode("search");
    setStreamError(null);
    setFollowUpInput("");
    setTimeout(() => inputRef.current?.focus(), 10);
  }, [stop]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      addToSearchHistory(storageKey, result);
      onSelect(result);
    },
    [storageKey, onSelect]
  );

  const handleEntityNavigate = useCallback(
    (path: string) => {
      onClose();
      navigate(`${basePath}/${path}`);
    },
    [onClose, navigate, basePath]
  );

  // Build display items
  const hasAiRow = !!ai && !!query.trim();
  const queryIsQuestion = hasAiRow && isQuestion(query);
  const showingHistory = !query.trim() && history.length > 0;
  const hasEntities = !!(entities && entities.length > 0);
  const visibleHistory = showingHistory
    ? hasEntities ? history.slice(0, 3) : history
    : [];

  const rootNavPages = useMemo(() =>
    categories
      .filter((cat) => cat.sections.length > 0)
      .map((cat) => ({
        kind: "page" as const,
        path: `${cat.id}/${cat.sections[0].id}`,
        label: cat.title,
        categoryTitle: cat.sections[0].title,
      })),
    [categories]
  );

  const displayItems: DisplayItem[] = useMemo(() => {
    if (!query.trim()) {
      const cappedHistory = hasEntities ? history.slice(0, 3) : history;
      return [
        ...cappedHistory.map((r) => ({ kind: "result" as const, result: r })),
        ...rootNavPages,
        ...(entities ?? []).map((e) => ({
          kind: "entity" as const,
          path: e.path,
          label: e.label,
          description: e.description,
        })),
      ];
    }
    return [
      ...(queryIsQuestion ? [{ kind: "ask-ai" as const }] : []),
      ...entityMatches.map((e) => ({
        kind: "entity" as const,
        path: e.path,
        label: e.label,
        description: e.description,
      })),
      ...results.map((r) => ({ kind: "result" as const, result: r })),
      ...(!queryIsQuestion && hasAiRow ? [{ kind: "ask-ai" as const }] : []),
    ];
  }, [query, queryIsQuestion, entityMatches, results, hasAiRow, history, entities, hasEntities, rootNavPages]);

  // Section start indices for Option+Arrow jumping
  const sectionStarts = useMemo(() => {
    if (!query.trim()) {
      const cappedCount = hasEntities ? Math.min(history.length, 3) : history.length;
      const starts: number[] = [];
      if (history.length > 0) starts.push(0);
      if (rootNavPages.length > 0) starts.push(cappedCount);
      if (entities && entities.length > 0) starts.push(cappedCount + rootNavPages.length);
      return starts;
    }
    const starts: number[] = [];
    let idx = 0;
    if (queryIsQuestion) { starts.push(idx); idx += 1; }
    if (entityMatches.length > 0) { starts.push(idx); idx += entityMatches.length; }
    if (results.length > 0) { starts.push(idx); idx += results.length; }
    if (!queryIsQuestion && hasAiRow) starts.push(idx);
    return starts;
  }, [query, queryIsQuestion, entityMatches.length, results.length, hasAiRow, history.length, entities, rootNavPages.length, hasEntities]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (mode === "answer") {
      if (e.key === "Escape") goBackToSearch();
      return;
    }
    if (mode === "api-key") {
      if (e.key === "Escape") {
        setMode("search");
        setTimeout(() => inputRef.current?.focus(), 10);
      }
      if (e.key === "Enter") handleSaveApiKey();
      return;
    }
    const total = displayItems.length;
    if (e.key === "ArrowDown" && e.altKey) {
      e.preventDefault();
      const next = sectionStarts.find((s) => s > selectedIndex);
      setSelectedIndex(next ?? sectionStarts[0] ?? 0);
    } else if (e.key === "ArrowUp" && e.altKey) {
      e.preventDefault();
      const prev = [...sectionStarts].reverse().find((s) => s < selectedIndex);
      setSelectedIndex(prev ?? sectionStarts[sectionStarts.length - 1] ?? 0);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % total);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + total) % total);
    } else if (e.key === "Enter" && total > 0) {
      e.preventDefault();
      const item = displayItems[selectedIndex];
      if (!item) return;
      if (item.kind === "ask-ai") triggerAsk(query);
      else if (item.kind === "entity") handleEntityNavigate(item.path);
      else if (item.kind === "page") handleEntityNavigate(item.path);
      else handleSelect(item.result);
    } else if (e.key === "Escape") {
      if (query) setQuery("");
      else onClose();
    }
  };

  const aiConfig = ai ? resolveAiConfig(ai) : null;
  const providerLabel =
    aiConfig?.provider === "anthropic" ? "Anthropic" : "OpenAI / Anthropic";

  // ── Render: search mode ─────────────────────────────────────────────────

  const renderSearchMode = () => {
    const isEmpty = !query.trim();

    return (
      <>
        {/* Input */}
        <div className="flex items-center gap-3 px-4 border-b border-[var(--docs-border)]">
          <svg
            className="size-5 text-[var(--docs-muted-foreground)] shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder={ai ? "Search docs or ask AI..." : "Search documentation..."}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 py-4 text-[15px] bg-transparent outline-none placeholder:text-[var(--docs-muted-foreground)]"
          />
          <kbd className="px-2 py-1 text-[11px] font-medium text-[var(--docs-muted-foreground)] bg-[var(--docs-muted)] border border-[var(--docs-border)] rounded">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {isEmpty ? (
            // ── Default state: Recent + Quick Jump ──────────────────────
            <div className="py-2">
              {showingHistory && (
                <div>
                  <div className="flex items-center justify-between px-4 pt-3 pb-1">
                    <span className="text-[11px] font-semibold text-[var(--docs-muted-foreground)] uppercase tracking-wider">
                      Recent
                    </span>
                    <button
                      onClick={() => {
                        clearSearchHistory(storageKey);
                        onClose();
                      }}
                      className="text-[11px] text-[var(--docs-muted-foreground)] hover:text-[var(--docs-foreground)] transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                  {visibleHistory.map((result, i) => (
                    <PaletteItem
                      key={`hist-${i}`}
                      isSelected={i === selectedIndex}
                      isFirstInSection={i === 0}
                      onClick={() => handleSelect(result)}
                      className="px-4 py-3"
                    >
                      <div className="flex items-center gap-2">
                        <svg
                          className="size-4 text-[var(--docs-muted-foreground)] shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span className="text-[14px] font-medium text-[var(--docs-foreground)]">
                          {result.subsectionTitle || result.sectionTitle}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[12px] text-[var(--docs-muted-foreground)] ml-6">
                        <span>{result.categoryTitle}</span>
                        <span>{">"}</span>
                        <span>{result.sectionTitle}</span>
                      </div>
                    </PaletteItem>
                  ))}
                </div>
              )}

              {rootNavPages.length > 0 && (
                <div>
                  <SectionLabel label="Navigation" />
                  {rootNavPages.map((page, i) => {
                    const idx = visibleHistory.length + i;
                    return (
                      <PaletteItem
                        key={`nav-${i}`}
                        isSelected={idx === selectedIndex}
                        isFirstInSection={i === 0}
                        onClick={() => handleEntityNavigate(page.path)}
                        className="px-4 py-2.5"
                      >
                        <div className="flex items-center gap-2">
                          <svg
                            className="size-4 text-[var(--docs-muted-foreground)] shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                          <div>
                            <div className="text-[14px] font-medium text-[var(--docs-foreground)]">{page.label}</div>
                            <div className="text-[12px] text-[var(--docs-muted-foreground)] mt-0.5">{page.categoryTitle}</div>
                          </div>
                        </div>
                      </PaletteItem>
                    );
                  })}
                </div>
              )}

              {entities && entities.length > 0 && (
                <div>
                  <SectionLabel label="Quick Jump" />
                  {entities.map((entity, i) => {
                    const idx = visibleHistory.length + rootNavPages.length + i;
                    return (
                      <PaletteItem
                        key={`entity-default-${i}`}
                        isSelected={idx === selectedIndex}
                        isFirstInSection={i === 0}
                        onClick={() => handleEntityNavigate(entity.path)}
                        className="px-4 py-2.5"
                      >
                        <div className="flex items-start gap-2">
                          <svg
                            className="size-4 text-[var(--docs-primary)] shrink-0 mt-0.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M13 7l5 5m0 0l-5 5m5-5H6"
                            />
                          </svg>
                          <div>
                            <div className="text-[14px] font-medium text-[var(--docs-foreground)]">
                              {entity.label}
                            </div>
                            {entity.description && (
                              <div className="text-[12px] text-[var(--docs-muted-foreground)] mt-0.5">
                                {entity.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </PaletteItem>
                    );
                  })}
                </div>
              )}

            </div>
          ) : displayItems.length === 0 ? (
            // ── No results ───────────────────────────────────────────────
            <div className="px-4 py-8 text-center text-[var(--docs-muted-foreground)] text-[14px]">
              No results for &quot;{query}&quot;
              {hasAiRow && (
                <div className="mt-3">
                  <button
                    onClick={() => triggerAsk(query)}
                    className="text-[var(--docs-primary)] hover:opacity-80 font-medium transition-opacity"
                  >
                    Ask AI instead →
                  </button>
                </div>
              )}
            </div>
          ) : (
            // ── Results with sections ─────────────────────────────────────
            <div className="py-2">
              {/* Ask AI at top when query is a question */}
              {queryIsQuestion && (
                <div>
                  <SectionLabel label="Ask AI" />
                  <AskAiRow
                    query={query}
                    isSelected={selectedIndex === 0}
                    isFirstInSection
                    onClick={() => triggerAsk(query)}
                  />
                </div>
              )}

              {/* Entity matches */}
              {entityMatches.length > 0 && (
                <div>
                  <SectionLabel label="Quick jump" />
                  {entityMatches.map((entity, i) => {
                    const idx = (queryIsQuestion ? 1 : 0) + i;
                    return (
                      <PaletteItem
                        key={`entity-${i}`}
                        isSelected={idx === selectedIndex}
                        isFirstInSection={i === 0}
                        onClick={() => handleEntityNavigate(entity.path)}
                        className="px-4 py-3"
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <svg
                            className="size-4 text-[var(--docs-primary)] shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M13 7l5 5m0 0l-5 5m5-5H6"
                            />
                          </svg>
                          <span className="text-[14px] font-medium text-[var(--docs-foreground)]">
                            {entity.label}
                          </span>
                        </div>
                        {entity.description && (
                          <p className="text-[13px] text-[var(--docs-muted-foreground)] ml-6 truncate">
                            {entity.description}
                          </p>
                        )}
                      </PaletteItem>
                    );
                  })}
                </div>
              )}

              {/* Search results */}
              {results.length > 0 && (
                <div>
                  {(entityMatches.length > 0 || queryIsQuestion) && (
                    <SectionLabel label="Pages" />
                  )}
                  {results.map((result, i) => {
                    const idx =
                      (queryIsQuestion ? 1 : 0) + entityMatches.length + i;
                    return (
                      <PaletteItem
                        key={`${result.sectionId}-${result.subsectionId}-${i}`}
                        isSelected={idx === selectedIndex}
                        isFirstInSection={i === 0 && (entityMatches.length > 0 || queryIsQuestion)}
                        onClick={() => handleSelect(result)}
                        className="px-4 py-3"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <svg
                            className="size-4 text-[var(--docs-muted-foreground)] shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                          <span className="text-[14px] font-medium text-[var(--docs-foreground)]">
                            {highlightWithIndices(
                              result.subsectionTitle || result.sectionTitle,
                              result.titleIndices
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[12px] text-[var(--docs-muted-foreground)] ml-6">
                          <span>{result.categoryTitle}</span>
                          <span>{">"}</span>
                          <span>{result.sectionTitle}</span>
                          {result.subsectionTitle && (
                            <>
                              <span>{">"}</span>
                              <span>{result.subsectionTitle}</span>
                            </>
                          )}
                        </div>
                        {result.matchText && (
                          <p className="text-[13px] text-[var(--docs-muted-foreground)] mt-1 ml-6 truncate">
                            {highlightWithIndices(
                              result.matchText,
                              result.matchIndices
                            )}
                          </p>
                        )}
                      </PaletteItem>
                    );
                  })}
                </div>
              )}

              {/* Ask AI at bottom when query is not a question */}
              {!queryIsQuestion && hasAiRow && (
                <div>
                  <div className="mx-4 my-1 border-t border-[var(--docs-border)]" />
                  <AskAiRow
                    query={query}
                    isSelected={selectedIndex === displayItems.length - 1}
                    onClick={() => triggerAsk(query)}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer hints */}
        {displayItems.length > 0 && (
          <div className="flex items-center gap-4 px-4 py-2 border-t border-[var(--docs-border)] text-[12px] text-[var(--docs-muted-foreground)]">
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-[var(--docs-muted)] border border-[var(--docs-border)] rounded text-[10px]">
                {"\u2191"}
              </kbd>
              <kbd className="px-1.5 py-0.5 bg-[var(--docs-muted)] border border-[var(--docs-border)] rounded text-[10px]">
                {"\u2193"}
              </kbd>
              <span className="ml-1">navigate</span>
            </div>
            {sectionStarts.length > 1 && (
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-[var(--docs-muted)] border border-[var(--docs-border)] rounded text-[10px]">
                  ⌥
                </kbd>
                <kbd className="px-1.5 py-0.5 bg-[var(--docs-muted)] border border-[var(--docs-border)] rounded text-[10px]">
                  {"\u2191"}
                </kbd>
                <kbd className="px-1.5 py-0.5 bg-[var(--docs-muted)] border border-[var(--docs-border)] rounded text-[10px]">
                  {"\u2193"}
                </kbd>
                <span className="ml-1">jump section</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-[var(--docs-muted)] border border-[var(--docs-border)] rounded text-[10px]">
                {"\u21B5"}
              </kbd>
              <span className="ml-1">select</span>
            </div>
          </div>
        )}
      </>
    );
  };

  // ── Render: api-key mode ────────────────────────────────────────────────

  const renderApiKeyMode = () => (
    <>
      <div className="flex items-center gap-3 px-4 border-b border-[var(--docs-border)]">
        <button
          onClick={() => {
            setMode("search");
            setTimeout(() => inputRef.current?.focus(), 10);
          }}
          className="text-[var(--docs-muted-foreground)] hover:text-[var(--docs-foreground)] transition-colors shrink-0"
        >
          <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="flex-1 py-4 text-[15px] text-[var(--docs-muted-foreground)] truncate">
          Ask AI: &quot;{pendingFirstQuestion}&quot;
        </span>
      </div>
      <div className="px-6 py-6">
        <div className="flex items-center gap-2 mb-2">
          <svg className="size-5 text-[var(--docs-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          <span className="text-[15px] font-semibold text-[var(--docs-foreground)]">
            Enter your {providerLabel} API key
          </span>
        </div>
        <p className="text-[13px] text-[var(--docs-muted-foreground)] mb-4">
          Your key is stored only in your browser and used only to answer
          questions about this documentation.
        </p>
        <input
          ref={apiKeyInputRef}
          type="password"
          placeholder="sk-... or sk-ant-..."
          value={apiKeyInput}
          onChange={(e) => setApiKeyInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSaveApiKey();
            if (e.key === "Escape") {
              setMode("search");
              setTimeout(() => inputRef.current?.focus(), 10);
            }
          }}
          className="w-full px-3 py-2.5 text-[14px] border border-[var(--docs-border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--docs-primary)]/20 focus:border-[var(--docs-primary)] font-mono mb-3"
        />
        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveApiKey}
            disabled={!apiKeyInput.trim()}
            className="px-4 py-2 text-[13px] font-medium bg-[var(--docs-primary)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Save & Ask
          </button>
          <button
            onClick={() => {
              setMode("search");
              setTimeout(() => inputRef.current?.focus(), 10);
            }}
            className="px-4 py-2 text-[13px] text-[var(--docs-muted-foreground)] hover:text-[var(--docs-muted-foreground)] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );

  // ── Render: answer mode (chat) ──────────────────────────────────────────

  const renderAnswerMode = () => (
    <div className="flex flex-col h-[75vh]">
      {/* Header — Ask AI badge */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--docs-border)] shrink-0">
        <button
          onClick={goBackToSearch}
          className="text-[var(--docs-muted-foreground)] hover:text-[var(--docs-foreground)] transition-colors shrink-0"
        >
          <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex items-center gap-2 flex-1">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--docs-muted)] border border-[var(--docs-border)]">
            <svg className="size-3.5 text-[var(--docs-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.347a3.17 3.17 0 01-.224.225A4.998 4.998 0 0112 17c-1.38 0-2.628-.56-3.536-1.464a3.17 3.17 0 01-.225-.224L7.9 15.1z" />
            </svg>
            <span className="text-[12px] font-semibold text-[var(--docs-primary)]">Ask AI</span>
          </div>
          {isStreaming && (
            <div className="size-1.5 rounded-full bg-[var(--docs-primary)] animate-pulse" />
          )}
        </div>
        {aiConfig && !aiConfig.ask && !aiConfig.key && getStoredApiKey() && (
          <button
            onClick={() => {
              removeStoredApiKey();
              goBackToSearch();
            }}
            className="text-[11px] text-[var(--docs-muted-foreground)] hover:text-[var(--docs-foreground)] transition-colors shrink-0"
          >
            Remove key
          </button>
        )}
      </div>

      {/* Chat area */}
      <div
        ref={chatRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.tagName === "A" || target.closest("a")) onClose();
        }}
      >
        {messages.map((msg, i) => {
          const isLastAssistant =
            msg.role === "assistant" && i === messages.length - 1;

          if (msg.role === "user") {
            return (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-tr-sm bg-[var(--docs-primary)] text-white text-[13px] leading-relaxed">
                  {msg.content}
                </div>
              </div>
            );
          }

          return (
            <div key={i} className="flex justify-start">
              <div className="max-w-[90%] px-3.5 py-2.5 rounded-2xl rounded-tl-sm bg-[var(--docs-muted)] text-[var(--docs-foreground)]">
                {isLastAssistant && isStreaming && !hasStartedStreaming ? (
                  // Thinking phase — spinner inside bubble while waiting for first chunk
                  <div className="flex items-center gap-2 text-[var(--docs-muted-foreground)] text-[13px]">
                    <div className="size-3.5 rounded-full border-2 border-[var(--docs-primary)] border-t-transparent animate-spin" />
                    <span>Thinking...</span>
                  </div>
                ) : isLastAssistant && isStreaming ? (
                  // Streaming phase — direct DOM writes, React doesn't touch this div
                  <div>
                    <div ref={streamingNodeRef} className="text-[13px] leading-relaxed whitespace-pre-wrap text-[var(--docs-foreground)]" />
                    <div className="flex items-center gap-1 mt-2">
                      <span className="size-1 rounded-full bg-[var(--docs-primary)] animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="size-1 rounded-full bg-[var(--docs-primary)] animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="size-1 rounded-full bg-[var(--docs-primary)] animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                ) : (
                  <MarkdownMessage text={msg.content} basePath={basePath} />
                )}
              </div>
            </div>
          );
        })}

        {streamError && (
          <div className="flex justify-start">
            <div className="max-w-[90%] px-3.5 py-2.5 rounded-2xl rounded-tl-sm bg-red-50 border border-red-100">
              <p className="text-[13px] text-red-600">{streamError}</p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Follow-up input */}
      <div className="shrink-0 px-4 py-3 border-t border-[var(--docs-border)] flex items-center gap-2">
        <input
          ref={followUpInputRef}
          type="text"
          placeholder="Ask a follow-up..."
          value={followUpInput}
          onChange={(e) => setFollowUpInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleFollowUp();
            if (e.key === "Escape") goBackToSearch();
          }}
          disabled={isStreaming}
          className="flex-1 text-[14px] bg-transparent outline-none placeholder:text-[var(--docs-muted-foreground)] disabled:opacity-40"
        />
        <button
          onClick={handleFollowUp}
          disabled={!followUpInput.trim() || isStreaming}
          className="px-3 py-1.5 text-[12px] font-medium bg-[var(--docs-primary)] text-white rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
        >
          {isStreaming ? (
            <div className="size-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              Send
              <svg className="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh]">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-[var(--docs-card)] rounded-xl shadow-2xl border border-[var(--docs-border)] overflow-hidden">
        {mode === "search" && renderSearchMode()}
        {mode === "api-key" && renderApiKeyMode()}
        {mode === "answer" && renderAnswerMode()}
      </div>
      {linkPreview}
    </div>
  );
}

// ─── Mobile Command Palette ────────────────────────────────────────────────

function MobileCommandPalette({
  isOpen,
  onClose,
  onSelect,
  fuse,
  storageKey,
}: Omit<CommandPaletteProps, "isMobile">) {
  const { ai, entities, categories, basePath = "" } = useDocs();
  const navigate = useNavigate();

  const [mode, setMode] = useState<PaletteMode>("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [history] = useState<SearchResult[]>(() => getSearchHistory(storageKey));
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [pendingFirstQuestion, setPendingFirstQuestion] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [followUpInput, setFollowUpInput] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const apiKeyInputRef = useRef<HTMLInputElement>(null);
  const followUpInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasStartedStreaming, setHasStartedStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamingNodeRef = useRef<HTMLDivElement>(null);
  const streamingContent = useRef("");
  const docsContext = useMemo(() => buildDocsContext(categories), [categories]);

  const append = useCallback(
    async (userMsg: ChatMessage, priorMessages?: ChatMessage[]) => {
      if (!ai) return;
      abortRef.current?.abort();
      const abort = new AbortController();
      abortRef.current = abort;
      const prior = priorMessages ?? messages;
      const nextMessages: ChatMessage[] = [...prior, userMsg];
      streamingContent.current = "";
      setMessages([...nextMessages, { role: "assistant", content: "" }]);
      setIsStreaming(true);
      setHasStartedStreaming(false);
      setStreamError(null);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 0);
      try {
        for await (const chunk of streamAiAnswer(ai, nextMessages, docsContext, abort.signal)) {
          if (abort.signal.aborted) break;
          if (!streamingContent.current) setHasStartedStreaming(true);
          streamingContent.current += chunk;
          if (streamingNodeRef.current) streamingNodeRef.current.textContent = streamingContent.current;
          messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
        }
      } catch (err) {
        if (!abort.signal.aborted) setStreamError((err as Error).message ?? "Something went wrong");
      } finally {
        if (!abort.signal.aborted) {
          setMessages([...nextMessages, { role: "assistant", content: streamingContent.current }]);
        }
        setIsStreaming(false);
        setHasStartedStreaming(false);
        abortRef.current = null;
        setTimeout(() => followUpInputRef.current?.focus(), 10);
      }
    },
    [ai, messages, docsContext]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const focusForMode = useCallback((m: PaletteMode) => {
    if (m === "search") inputRef.current?.focus();
    else if (m === "api-key") apiKeyInputRef.current?.focus();
    else if (m === "answer") followUpInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => focusForMode(mode), 10);
    return () => clearTimeout(t);
  }, [mode, focusForMode]);

  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => focusForMode(mode), 10);
    return () => clearTimeout(t);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const performSearch = useCallback(
    (searchQuery: string) => {
      if (!searchQuery.trim()) { setResults([]); setSelectedIndex(0); return; }
      const fuseResults = fuse.search(searchQuery, { limit: 20 });
      const seen = new Set<string>();
      const lowerQuery = searchQuery.toLowerCase();
      const searchResults: Array<SearchResult & { sortScore: number }> = fuseResults
        .filter((r) => {
          const key = `${r.item.sectionId}-${r.item.subsectionId || ""}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((r) => {
          const item = r.item;
          const matches = r.matches || [];
          const fuseScore = r.score ?? 1;
          const titleMatch = matches.find((m) => m.key === "title");
          const titleIndices = titleMatch?.indices;
          const contentMatch = matches.find((m) => m.key === "content");
          let matchText = "";
          let matchIndices: ReadonlyArray<readonly [number, number]> | undefined;
          if (contentMatch && contentMatch.indices.length > 0) {
            const firstMatch = contentMatch.indices[0];
            const start = Math.max(0, firstMatch[0] - 30);
            const end = Math.min(item.content.length, firstMatch[1] + 60);
            matchText = (start > 0 ? "..." : "") + item.content.slice(start, end) + (end < item.content.length ? "..." : "");
            matchIndices = contentMatch.indices.filter(([s, e]) => s >= start && e <= end).map(([s, e]) => [s - start + (start > 0 ? 3 : 0), e - start + (start > 0 ? 3 : 0)] as const);
          }
          let sortScore = fuseScore;
          const lowerTitle = item.title.toLowerCase();
          const lowerContent = item.content.toLowerCase();
          if (lowerTitle === lowerQuery) sortScore -= 1;
          else if (lowerTitle.includes(lowerQuery)) sortScore -= 0.5;
          if (lowerContent.includes(lowerQuery)) sortScore -= 0.3;
          return {
            categoryId: item.categoryId, categoryTitle: item.categoryTitle,
            sectionId: item.sectionId, sectionTitle: item.sectionTitle,
            subsectionId: item.subsectionId, subsectionTitle: item.subsectionTitle,
            matchText: matchText.replace(/\s+/g, " ").trim(),
            titleIndices, matchIndices, sortScore,
          };
        });
      searchResults.sort((a, b) => a.sortScore - b.sortScore);
      setResults(searchResults.slice(0, 10));
      setSelectedIndex(0);
    },
    [fuse]
  );

  useEffect(() => {
    const t = setTimeout(() => performSearch(query), 100);
    return () => clearTimeout(t);
  }, [query, performSearch]);

  const entityMatches = useMemo(() => {
    if (!entities || !query.trim()) return [];
    const lowerQuery = query.toLowerCase();
    return entities.filter((e) => e.keywords.some((k) => lowerQuery.includes(k.toLowerCase()) || k.toLowerCase().includes(lowerQuery)));
  }, [entities, query]);

  const triggerAsk = useCallback(
    (question: string) => {
      if (!ai) return;
      const config = resolveAiConfig(ai);
      const needsKey = !config.ask && !resolveApiKey(config);
      if (needsKey) { setPendingFirstQuestion(question); setMode("api-key"); }
      else { setMode("answer"); append({ role: "user", content: question }, []); }
    },
    [ai, append]
  );

  const handleSaveApiKey = () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed || !ai) return;
    const config = resolveAiConfig(ai);
    if (!config.ask) storeApiKey(trimmed);
    setApiKeyInput("");
    setMode("answer");
    append({ role: "user", content: pendingFirstQuestion }, []);
  };

  const handleFollowUp = () => {
    const q = followUpInput.trim();
    if (!q || isStreaming) return;
    setFollowUpInput("");
    append({ role: "user", content: q });
  };

  const goBackToSearch = useCallback(() => {
    stop();
    setMessages([]);
    setMode("search");
    setStreamError(null);
    setFollowUpInput("");
    setTimeout(() => inputRef.current?.focus(), 10);
  }, [stop]);

  const handleSelect = useCallback(
    (result: SearchResult) => { addToSearchHistory(storageKey, result); onSelect(result); },
    [storageKey, onSelect]
  );

  const handleEntityNavigate = useCallback(
    (path: string) => { onClose(); navigate(`${basePath}/${path}`); },
    [onClose, navigate, basePath]
  );

  const hasAiRow = !!ai && !!query.trim();
  const queryIsQuestion = hasAiRow && isQuestion(query);
  const showingHistory = !query.trim() && history.length > 0;
  const hasEntities = !!(entities && entities.length > 0);
  const visibleHistory = showingHistory ? (hasEntities ? history.slice(0, 3) : history) : [];

  const rootNavPages = useMemo(() =>
    categories.filter((cat) => cat.sections.length > 0).map((cat) => ({
      kind: "page" as const,
      path: `${cat.id}/${cat.sections[0].id}`,
      label: cat.title,
      categoryTitle: cat.sections[0].title,
    })),
    [categories]
  );

  const displayItems: DisplayItem[] = useMemo(() => {
    if (!query.trim()) {
      const cappedHistory = hasEntities ? history.slice(0, 3) : history;
      return [
        ...cappedHistory.map((r) => ({ kind: "result" as const, result: r })),
        ...rootNavPages,
        ...(entities ?? []).map((e) => ({ kind: "entity" as const, path: e.path, label: e.label, description: e.description })),
      ];
    }
    return [
      ...(queryIsQuestion ? [{ kind: "ask-ai" as const }] : []),
      ...entityMatches.map((e) => ({ kind: "entity" as const, path: e.path, label: e.label, description: e.description })),
      ...results.map((r) => ({ kind: "result" as const, result: r })),
      ...(!queryIsQuestion && hasAiRow ? [{ kind: "ask-ai" as const }] : []),
    ];
  }, [query, queryIsQuestion, entityMatches, results, hasAiRow, history, entities, hasEntities, rootNavPages]);

  const sectionStarts = useMemo(() => {
    if (!query.trim()) {
      const cappedCount = hasEntities ? Math.min(history.length, 3) : history.length;
      const starts: number[] = [];
      if (history.length > 0) starts.push(0);
      if (rootNavPages.length > 0) starts.push(cappedCount);
      if (entities && entities.length > 0) starts.push(cappedCount + rootNavPages.length);
      return starts;
    }
    const starts: number[] = [];
    let idx = 0;
    if (queryIsQuestion) { starts.push(idx); idx += 1; }
    if (entityMatches.length > 0) { starts.push(idx); idx += entityMatches.length; }
    if (results.length > 0) { starts.push(idx); idx += results.length; }
    if (!queryIsQuestion && hasAiRow) starts.push(idx);
    return starts;
  }, [query, queryIsQuestion, entityMatches.length, results.length, hasAiRow, history.length, entities, rootNavPages.length, hasEntities]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (mode === "answer") { if (e.key === "Escape") goBackToSearch(); return; }
    if (mode === "api-key") {
      if (e.key === "Escape") { setMode("search"); setTimeout(() => inputRef.current?.focus(), 10); }
      if (e.key === "Enter") handleSaveApiKey();
      return;
    }
    const total = displayItems.length;
    if (e.key === "ArrowDown" && e.altKey) {
      e.preventDefault();
      const next = sectionStarts.find((s) => s > selectedIndex);
      setSelectedIndex(next ?? sectionStarts[0] ?? 0);
    } else if (e.key === "ArrowUp" && e.altKey) {
      e.preventDefault();
      const prev = [...sectionStarts].reverse().find((s) => s < selectedIndex);
      setSelectedIndex(prev ?? sectionStarts[sectionStarts.length - 1] ?? 0);
    } else if (e.key === "ArrowDown") {
      e.preventDefault(); setSelectedIndex((prev) => (prev + 1) % total);
    } else if (e.key === "ArrowUp") {
      e.preventDefault(); setSelectedIndex((prev) => (prev - 1 + total) % total);
    } else if (e.key === "Enter" && total > 0) {
      e.preventDefault();
      const item = displayItems[selectedIndex];
      if (!item) return;
      if (item.kind === "ask-ai") triggerAsk(query);
      else if (item.kind === "entity") handleEntityNavigate(item.path);
      else if (item.kind === "page") handleEntityNavigate(item.path);
      else handleSelect(item.result);
    } else if (e.key === "Escape") {
      if (query) setQuery(""); else onClose();
    }
  };

  const aiConfig = ai ? resolveAiConfig(ai) : null;
  const providerLabel = aiConfig?.provider === "anthropic" ? "Anthropic" : "OpenAI / Anthropic";

  // ── Mobile search mode ─────────────────────────────────────────────────

  const renderSearchMode = () => {
    const isEmpty = !query.trim();
    return (
      <>
        {/* iOS-style header: input + Cancel */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--docs-border)] shrink-0">
          <input
            ref={inputRef}
            type="text"
            placeholder={ai ? "Search docs or ask AI..." : "Search documentation..."}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 py-1.5 text-[15px] bg-transparent outline-none placeholder:text-[var(--docs-muted-foreground)]"
          />
          <button
            onClick={onClose}
            className="text-[var(--docs-primary)] text-[15px] font-medium shrink-0"
          >
            Cancel
          </button>
        </div>

        {/* Results — full height */}
        <div className="flex-1 overflow-y-auto">
          {isEmpty ? (
            <div className="py-2">
              {showingHistory && (
                <div>
                  <div className="flex items-center justify-between px-4 pt-3 pb-1">
                    <span className="text-[11px] font-semibold text-[var(--docs-muted-foreground)] uppercase tracking-wider">Recent</span>
                    <button
                      onClick={() => { clearSearchHistory(storageKey); onClose(); }}
                      className="text-[11px] text-[var(--docs-muted-foreground)] hover:text-[var(--docs-foreground)] transition-colors"
                    >Clear</button>
                  </div>
                  {visibleHistory.map((result, i) => (
                    <PaletteItem key={`hist-${i}`} isSelected={i === selectedIndex} isFirstInSection={i === 0} onClick={() => handleSelect(result)} className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <svg className="size-4 text-[var(--docs-muted-foreground)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-[14px] font-medium text-[var(--docs-foreground)]">{result.subsectionTitle || result.sectionTitle}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[12px] text-[var(--docs-muted-foreground)] ml-6">
                        <span>{result.categoryTitle}</span><span>{">"}</span><span>{result.sectionTitle}</span>
                      </div>
                    </PaletteItem>
                  ))}
                </div>
              )}

              {rootNavPages.length > 0 && (
                <div>
                  <SectionLabel label="Navigation" />
                  {rootNavPages.map((page, i) => {
                    const idx = visibleHistory.length + i;
                    return (
                      <PaletteItem key={`nav-${i}`} isSelected={idx === selectedIndex} isFirstInSection={i === 0} onClick={() => handleEntityNavigate(page.path)} className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <svg className="size-4 text-[var(--docs-muted-foreground)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <div>
                            <div className="text-[14px] font-medium text-[var(--docs-foreground)]">{page.label}</div>
                            <div className="text-[12px] text-[var(--docs-muted-foreground)] mt-0.5">{page.categoryTitle}</div>
                          </div>
                        </div>
                      </PaletteItem>
                    );
                  })}
                </div>
              )}

              {entities && entities.length > 0 && (
                <div>
                  <SectionLabel label="Quick Jump" />
                  {entities.map((entity, i) => {
                    const idx = visibleHistory.length + rootNavPages.length + i;
                    return (
                      <PaletteItem key={`entity-default-${i}`} isSelected={idx === selectedIndex} isFirstInSection={i === 0} onClick={() => handleEntityNavigate(entity.path)} className="px-4 py-2.5">
                        <div className="flex items-start gap-2">
                          <svg className="size-4 text-[var(--docs-primary)] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                          <div>
                            <div className="text-[14px] font-medium text-[var(--docs-foreground)]">{entity.label}</div>
                            {entity.description && <div className="text-[12px] text-[var(--docs-muted-foreground)] mt-0.5">{entity.description}</div>}
                          </div>
                        </div>
                      </PaletteItem>
                    );
                  })}
                </div>
              )}
            </div>
          ) : displayItems.length === 0 ? (
            <div className="px-4 py-8 text-center text-[var(--docs-muted-foreground)] text-[14px]">
              No results for &quot;{query}&quot;
              {hasAiRow && (
                <div className="mt-3">
                  <button onClick={() => triggerAsk(query)} className="text-[var(--docs-primary)] hover:opacity-80 font-medium transition-opacity">Ask AI instead →</button>
                </div>
              )}
            </div>
          ) : (
            <div className="py-2">
              {queryIsQuestion && (
                <div>
                  <SectionLabel label="Ask AI" />
                  <AskAiRow query={query} isSelected={selectedIndex === 0} isFirstInSection onClick={() => triggerAsk(query)} />
                </div>
              )}
              {entityMatches.length > 0 && (
                <div>
                  <SectionLabel label="Quick jump" />
                  {entityMatches.map((entity, i) => {
                    const idx = (queryIsQuestion ? 1 : 0) + i;
                    return (
                      <PaletteItem key={`entity-${i}`} isSelected={idx === selectedIndex} isFirstInSection={i === 0} onClick={() => handleEntityNavigate(entity.path)} className="px-4 py-3">
                        <div className="flex items-center gap-2 mb-0.5">
                          <svg className="size-4 text-[var(--docs-primary)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                          <span className="text-[14px] font-medium text-[var(--docs-foreground)]">{entity.label}</span>
                        </div>
                        {entity.description && <p className="text-[13px] text-[var(--docs-muted-foreground)] ml-6 truncate">{entity.description}</p>}
                      </PaletteItem>
                    );
                  })}
                </div>
              )}
              {results.length > 0 && (
                <div>
                  {(entityMatches.length > 0 || queryIsQuestion) && <SectionLabel label="Pages" />}
                  {results.map((result, i) => {
                    const idx = (queryIsQuestion ? 1 : 0) + entityMatches.length + i;
                    return (
                      <PaletteItem key={`${result.sectionId}-${result.subsectionId}-${i}`} isSelected={idx === selectedIndex} isFirstInSection={i === 0 && (entityMatches.length > 0 || queryIsQuestion)} onClick={() => handleSelect(result)} className="px-4 py-3">
                        <div className="flex items-center gap-2 mb-1">
                          <svg className="size-4 text-[var(--docs-muted-foreground)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="text-[14px] font-medium text-[var(--docs-foreground)]">{highlightWithIndices(result.subsectionTitle || result.sectionTitle, result.titleIndices)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[12px] text-[var(--docs-muted-foreground)] ml-6">
                          <span>{result.categoryTitle}</span><span>{">"}</span><span>{result.sectionTitle}</span>
                          {result.subsectionTitle && (<><span>{">"}</span><span>{result.subsectionTitle}</span></>)}
                        </div>
                        {result.matchText && <p className="text-[13px] text-[var(--docs-muted-foreground)] mt-1 ml-6 truncate">{highlightWithIndices(result.matchText, result.matchIndices)}</p>}
                      </PaletteItem>
                    );
                  })}
                </div>
              )}
              {!queryIsQuestion && hasAiRow && (
                <div>
                  <div className="mx-4 my-1 border-t border-[var(--docs-border)]" />
                  <AskAiRow query={query} isSelected={selectedIndex === displayItems.length - 1} onClick={() => triggerAsk(query)} />
                </div>
              )}
            </div>
          )}
        </div>
      </>
    );
  };

  // ── Mobile api-key mode ─────────────────────────────────────────────────

  const renderApiKeyMode = () => (
    <>
      <div className="flex items-center gap-3 px-4 border-b border-[var(--docs-border)]">
        <button
          onClick={() => { setMode("search"); setTimeout(() => inputRef.current?.focus(), 10); }}
          className="text-[var(--docs-muted-foreground)] hover:text-[var(--docs-foreground)] transition-colors shrink-0"
        >
          <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="flex-1 py-4 text-[15px] text-[var(--docs-muted-foreground)] truncate">Ask AI: &quot;{pendingFirstQuestion}&quot;</span>
        <button onClick={onClose} className="text-[var(--docs-primary)] text-[15px] font-medium shrink-0">Cancel</button>
      </div>
      <div className="px-6 py-6">
        <div className="flex items-center gap-2 mb-2">
          <svg className="size-5 text-[var(--docs-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          <span className="text-[15px] font-semibold text-[var(--docs-foreground)]">Enter your {providerLabel} API key</span>
        </div>
        <p className="text-[13px] text-[var(--docs-muted-foreground)] mb-4">Your key is stored only in your browser and used only to answer questions about this documentation.</p>
        <input
          ref={apiKeyInputRef}
          type="password"
          placeholder="sk-... or sk-ant-..."
          value={apiKeyInput}
          onChange={(e) => setApiKeyInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSaveApiKey();
            if (e.key === "Escape") { setMode("search"); setTimeout(() => inputRef.current?.focus(), 10); }
          }}
          className="w-full px-3 py-2.5 text-[14px] border border-[var(--docs-border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--docs-primary)]/20 focus:border-[var(--docs-primary)] font-mono mb-3"
        />
        <div className="flex items-center gap-3">
          <button onClick={handleSaveApiKey} disabled={!apiKeyInput.trim()} className="px-4 py-2 text-[13px] font-medium bg-[var(--docs-primary)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Save & Ask</button>
          <button onClick={() => { setMode("search"); setTimeout(() => inputRef.current?.focus(), 10); }} className="px-4 py-2 text-[13px] text-[var(--docs-muted-foreground)] transition-colors">Back</button>
        </div>
      </div>
    </>
  );

  // ── Mobile answer mode ──────────────────────────────────────────────────

  const renderAnswerMode = () => (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--docs-border)] shrink-0">
        <button onClick={goBackToSearch} className="text-[var(--docs-muted-foreground)] hover:text-[var(--docs-foreground)] transition-colors shrink-0">
          <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex items-center gap-2 flex-1">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--docs-muted)] border border-[var(--docs-border)]">
            <svg className="size-3.5 text-[var(--docs-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.347a3.17 3.17 0 01-.224.225A4.998 4.998 0 0112 17c-1.38 0-2.628-.56-3.536-1.464a3.17 3.17 0 01-.225-.224L7.9 15.1z" />
            </svg>
            <span className="text-[12px] font-semibold text-[var(--docs-primary)]">Ask AI</span>
          </div>
          {isStreaming && <div className="size-1.5 rounded-full bg-[var(--docs-primary)] animate-pulse" />}
        </div>
        <button onClick={onClose} className="text-[var(--docs-primary)] text-[15px] font-medium shrink-0">Cancel</button>
      </div>

      <div ref={chatRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4" onClick={(e) => { const target = e.target as HTMLElement; if (target.tagName === "A" || target.closest("a")) onClose(); }}>
        {messages.map((msg, i) => {
          const isLastAssistant = msg.role === "assistant" && i === messages.length - 1;
          if (msg.role === "user") {
            return (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-tr-sm bg-[var(--docs-primary)] text-white text-[13px] leading-relaxed">{msg.content}</div>
              </div>
            );
          }
          return (
            <div key={i} className="flex justify-start">
              <div className="max-w-[90%] px-3.5 py-2.5 rounded-2xl rounded-tl-sm bg-[var(--docs-muted)] text-[var(--docs-foreground)]">
                {isLastAssistant && isStreaming && !hasStartedStreaming ? (
                  <div className="flex items-center gap-2 text-[var(--docs-muted-foreground)] text-[13px]">
                    <div className="size-3.5 rounded-full border-2 border-[var(--docs-primary)] border-t-transparent animate-spin" />
                    <span>Thinking...</span>
                  </div>
                ) : isLastAssistant && isStreaming ? (
                  <div>
                    <div ref={streamingNodeRef} className="text-[13px] leading-relaxed whitespace-pre-wrap text-[var(--docs-foreground)]" />
                    <div className="flex items-center gap-1 mt-2">
                      <span className="size-1 rounded-full bg-[var(--docs-primary)] animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="size-1 rounded-full bg-[var(--docs-primary)] animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="size-1 rounded-full bg-[var(--docs-primary)] animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                ) : (
                  <MarkdownMessage text={msg.content} basePath={basePath} />
                )}
              </div>
            </div>
          );
        })}
        {streamError && (
          <div className="flex justify-start">
            <div className="max-w-[90%] px-3.5 py-2.5 rounded-2xl rounded-tl-sm bg-red-50 border border-red-100">
              <p className="text-[13px] text-red-600">{streamError}</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="shrink-0 px-4 py-3 border-t border-[var(--docs-border)] flex items-center gap-2">
        <input
          ref={followUpInputRef}
          type="text"
          placeholder="Ask a follow-up..."
          value={followUpInput}
          onChange={(e) => setFollowUpInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleFollowUp(); if (e.key === "Escape") goBackToSearch(); }}
          disabled={isStreaming}
          className="flex-1 text-[14px] bg-transparent outline-none placeholder:text-[var(--docs-muted-foreground)] disabled:opacity-40"
        />
        <button
          onClick={handleFollowUp}
          disabled={!followUpInput.trim() || isStreaming}
          className="px-3 py-1.5 text-[12px] font-medium bg-[var(--docs-primary)] text-white rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
        >
          {isStreaming ? (
            <div className="size-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>Send <svg className="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg></>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[var(--docs-card)]"
      style={{
        opacity: isOpen ? 1 : 0,
        pointerEvents: isOpen ? "auto" : "none",
        transition: "opacity 0.2s ease",
      }}
    >
      {mode === "search" && renderSearchMode()}
      {mode === "api-key" && renderApiKeyMode()}
      {mode === "answer" && renderAnswerMode()}
    </div>
  );
}

// ─── Ask AI row ────────────────────────────────────────────────────────────

function AskAiRow({
  query,
  isSelected,
  isFirstInSection,
  onClick,
}: {
  query: string;
  isSelected: boolean;
  isFirstInSection?: boolean;
  onClick: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (isSelected) {
      const target = isFirstInSection
        ? (ref.current?.previousElementSibling ?? ref.current)
        : ref.current;
      target?.scrollIntoView({ block: "nearest" });
    }
  }, [isSelected, isFirstInSection]);

  return (
    <button
      ref={ref}
      onClick={onClick}
      className={`w-full text-left px-4 py-3 transition-colors hover:bg-[var(--docs-muted)] ${
        isSelected ? "bg-[var(--docs-sidebar-accent)]" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <svg
          className="size-4 text-[var(--docs-primary)] shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.347a3.17 3.17 0 01-.224.225A4.998 4.998 0 0112 17c-1.38 0-2.628-.56-3.536-1.464a3.17 3.17 0 01-.225-.224L7.9 15.1z"
          />
        </svg>
        <span className="text-[14px] font-medium text-[var(--docs-muted-foreground)]">
          Ask AI:{" "}
          <span className="text-[var(--docs-primary)]">&quot;{query}&quot;</span>
        </span>
      </div>
    </button>
  );
}
