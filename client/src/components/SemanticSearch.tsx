import { useState, useRef } from "react";
import { Search, CheckCircle } from "lucide-react";
import { SearchResponse } from "../types";

export function SemanticSearch() {
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // Esta función será llamada desde App.tsx a través del ChatInput
  const performSearch = async (query: string) => {
    setError(null);
    setShowSuggestions(false);
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
    }
  };

  // Exportar la función para que pueda ser llamada externamente
  (window as any).__performSemanticSearch = performSearch;

  // Sugerencias de búsqueda semántica
  const suggestions = [
    "¿Cuál es el código secreto?",
    "¿Qué tecnologías usa este proyecto?",
    "¿Soporta modo oscuro?",
    "¿Cómo funciona la búsqueda semántica?",
  ];

  // Manejar clic en sugerencia
  const handleSuggestionClick = (suggestion: string) => {
    setShowSuggestions(false);
    performSearch(suggestion);
  };


  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
      <div className="text-center">
        <div className="mb-3 sm:mb-4 inline-flex p-3 sm:p-4 rounded-full bg-gradient-to-br from-primary-500/10 to-accent-500/10">
          <Search className="h-10 w-10 sm:h-12 sm:w-12 text-primary-600 dark:text-primary-400" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Búsqueda Semántica
        </h2>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4 sm:mb-6 px-2">
          Usa el cuadro de búsqueda inferior para buscar en la base de conocimientos usando IA
        </p>
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
                  Resultado Más Relevante
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
                Otros resultados relevantes:
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

      {showSuggestions && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mt-6 sm:mt-8">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSuggestionClick(suggestion)}
              className="p-3 sm:p-4 text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-md transition-all duration-200 group"
            >
              <p className="text-xs sm:text-sm text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                {suggestion}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
