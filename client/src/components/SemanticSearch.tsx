import { useState } from "react";
import { Search, Loader2, CheckCircle } from "lucide-react";
import { Button } from "./ui/Button";
import { SearchResponse } from "../types";

export function SemanticSearch() {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setIsSearching(true);
    setError(null);
    
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: query.trim() }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: SearchResponse = await response.json();
      setResult(data);
    } catch (err) {
      console.error("Search failed:", err);
      setError("Failed to perform search. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="text-center">
        <div className="mb-3 sm:mb-4 inline-flex p-3 sm:p-4 rounded-full bg-gradient-to-br from-primary-500/10 to-accent-500/10">
          <Search className="h-10 w-10 sm:h-12 sm:w-12 text-primary-600 dark:text-primary-400" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Semantic Search
        </h2>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4 sm:mb-6 px-2">
          Search through our knowledge base using AI-powered embeddings
        </p>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about this project..."
          disabled={isSearching}
          className="flex-1 rounded-lg sm:rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-primary-500 dark:focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50 transition-all duration-200 shadow-sm hover:shadow-md focus:shadow-md min-h-[44px]"
        />
        <Button
          onClick={handleSearch}
          disabled={isSearching || !query.trim()}
          className="rounded-lg sm:rounded-xl px-4 sm:px-6 min-h-[44px]"
        >
          {isSearching ? (
            <>
              <Loader2 className="animate-spin h-5 w-5" />
              <span className="hidden sm:inline ml-2">Searching</span>
            </>
          ) : (
            <>
              <Search className="h-5 w-5" />
              <span className="hidden sm:inline ml-2">Search</span>
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm sm:text-base text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-3 sm:space-y-4">
          <div className="p-4 sm:p-6 rounded-lg sm:rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
            <div className="flex items-start gap-2 sm:gap-3 mb-3">
              <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-green-500 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Most Relevant Result
                </h3>
                <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 leading-relaxed">
                  {result.result}
                </p>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-2">
                  Similarity: {(result.similarity * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          {result.all_results.length > 1 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white px-1">
                Other relevant results:
              </h4>
              {result.all_results.slice(1).map((item, index) => (
                <div
                  key={index}
                  className="p-3 sm:p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
                >
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {item.text}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Similarity: {(item.similarity * 100).toFixed(1)}%
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-6 sm:mt-8 p-3 sm:p-4 rounded-lg sm:rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
          Try these queries:
        </h4>
        <ul className="text-xs sm:text-sm text-blue-700 dark:text-blue-400 space-y-1">
          <li>• What is the secret code?</li>
          <li>• What technologies does this project use?</li>
          <li>• Does this support dark mode?</li>
        </ul>
      </div>
    </div>
  );
}
