import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type Fuse from "fuse.js";
import {
  highlightWithIndices,
  getSearchHistory,
  addToSearchHistory,
  clearSearchHistory,
  type SearchResult,
} from "./search";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (result: SearchResult) => void;
  fuse: Fuse<any>;
  storageKey: string;
}

export function CommandPalette({
  isOpen,
  onClose,
  onSelect,
  fuse,
  storageKey,
}: CommandPaletteProps) {
  if (!isOpen) return null;
  return (
    <CommandPaletteContent
      onClose={onClose}
      onSelect={onSelect}
      fuse={fuse}
      storageKey={storageKey}
    />
  );
}

function CommandPaletteContent({
  onClose,
  onSelect,
  fuse,
  storageKey,
}: Omit<CommandPaletteProps, "isOpen">) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [history] = useState<SearchResult[]>(() =>
    getSearchHistory(storageKey)
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 10);
    return () => clearTimeout(timer);
  }, []);

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
          .filter((result) => {
            const key = `${result.item.sectionId}-${result.item.subsectionId || ""}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .map((result) => {
            const item = result.item;
            const matches = result.matches || [];
            const fuseScore = result.score ?? 1;

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
    const timer = setTimeout(() => performSearch(query), 100);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

  const handleSelect = useMemo(
    () => (result: SearchResult) => {
      addToSearchHistory(storageKey, result);
      onSelect(result);
    },
    [storageKey, onSelect]
  );

  const displayItems = query.trim() ? results : history;
  const showingHistory = !query.trim() && history.length > 0;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, displayItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && displayItems[selectedIndex]) {
      e.preventDefault();
      handleSelect(displayItems[selectedIndex]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (query) setQuery("");
      else onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl border border-zinc-200 overflow-hidden">
        <div className="flex items-center gap-3 px-4 border-b border-zinc-200">
          <svg
            className="size-5 text-zinc-400 shrink-0"
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
            placeholder="Search documentation..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 py-4 text-[15px] bg-transparent outline-none placeholder:text-zinc-400"
          />
          <kbd className="px-2 py-1 text-[11px] font-medium text-zinc-400 bg-zinc-100 border border-zinc-200 rounded">
            ESC
          </kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {query && results.length === 0 ? (
            <div className="px-4 py-8 text-center text-zinc-400 text-[14px]">
              No results found for &quot;{query}&quot;
            </div>
          ) : displayItems.length > 0 ? (
            <div className="py-2">
              {showingHistory && (
                <div className="flex items-center justify-between px-4 py-2">
                  <span className="text-[12px] font-medium text-zinc-400 uppercase tracking-wider">
                    Recent
                  </span>
                  <button
                    onClick={() => {
                      clearSearchHistory(storageKey);
                      onClose();
                    }}
                    className="text-[12px] text-zinc-400 hover:text-zinc-600 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              )}
              {displayItems.map((result, i) => (
                <button
                  key={`${result.sectionId}-${result.subsectionId}-${i}`}
                  onClick={() => handleSelect(result)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={`w-full text-left px-4 py-3 transition-colors ${
                    i === selectedIndex ? "bg-blue-50" : "hover:bg-zinc-50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <svg
                      className="size-4 text-zinc-400 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      {showingHistory ? (
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      ) : (
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      )}
                    </svg>
                    <span className="text-[14px] font-medium text-zinc-900">
                      {showingHistory
                        ? result.subsectionTitle || result.sectionTitle
                        : highlightWithIndices(
                            result.subsectionTitle || result.sectionTitle,
                            result.titleIndices
                          )}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[12px] text-zinc-400 ml-6">
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
                  {!showingHistory && result.matchText && (
                    <p className="text-[13px] text-zinc-500 mt-1 ml-6 truncate">
                      {highlightWithIndices(
                        result.matchText,
                        result.matchIndices
                      )}
                    </p>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="px-4 py-6 text-center text-zinc-400 text-[14px]">
              Type to search the documentation
            </div>
          )}
        </div>

        {displayItems.length > 0 && (
          <div className="flex items-center gap-4 px-4 py-2 border-t border-zinc-100 text-[12px] text-zinc-400">
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-zinc-100 border border-zinc-200 rounded text-[10px]">
                {"\u2191"}
              </kbd>
              <kbd className="px-1.5 py-0.5 bg-zinc-100 border border-zinc-200 rounded text-[10px]">
                {"\u2193"}
              </kbd>
              <span className="ml-1">to navigate</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-zinc-100 border border-zinc-200 rounded text-[10px]">
                {"\u21B5"}
              </kbd>
              <span className="ml-1">to select</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
