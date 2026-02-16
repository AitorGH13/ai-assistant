import { useState } from "react";
import { Search, CheckCircle } from "lucide-react";
import { SearchResponse } from "../types";
import { Button } from "./ui/Button";
import { Card, CardContent } from "./ui/Card";
import { Badge } from "./ui/Badge";

export function SemanticSearch() {
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);

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

  (window as any).__performSemanticSearch = performSearch;

  const suggestions = [
    "¿Cuál es el código secreto?",
    "¿Qué tecnologías usa este proyecto?",
    "¿Soporta modo oscuro?",
    "¿Cómo funciona la búsqueda semántica?",
  ];

  const handleSuggestionClick = (suggestion: string) => {
    setShowSuggestions(false);
    performSearch(suggestion);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
      <div className="text-center">
        <div className="mb-3 sm:mb-4 inline-flex p-3 sm:p-4 rounded-full bg-primary/20 dark:bg-primary/20 ring-8 ring-primary/10 shadow-inner">
          <Search className="h-10 w-10 sm:h-12 sm:w-12 text-primary" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
          Búsqueda Semántica
        </h2>
        <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6 px-2">
          Usa el cuadro de búsqueda inferior para buscar en la base de conocimientos usando IA
        </p>
      </div>

      {error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="p-3 sm:p-4">
            <p className="text-sm sm:text-base text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <div className="space-y-3 sm:space-y-4">
          <Card className="shadow-lg">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start gap-2 sm:gap-3 mb-3">
                <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-green-500 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2">
                    Resultado Más Relevante
                  </h3>
                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                    {result.result}
                  </p>
                  <Badge variant="secondary" className="mt-2">
                    Similarity: {(result.similarity * 100).toFixed(1)}%
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {result.all_results.length > 1 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground px-1">
                Otros resultados relevantes:
              </h4>
              {result.all_results.slice(1).map((item, index) => (
                <Card key={index} className="bg-muted/50">
                  <CardContent className="p-3 sm:p-4">
                    <p className="text-sm text-foreground">
                      {item.text}
                    </p>
                    <Badge variant="outline" className="mt-1 text-xs">
                      Similarity: {(item.similarity * 100).toFixed(1)}%
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {showSuggestions && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mt-6 sm:mt-8">
          {suggestions.map((suggestion, index) => (
            <Button
              key={index}
              variant="outline"
              onClick={() => handleSuggestionClick(suggestion)}
              className="p-3 sm:p-4 h-auto text-left justify-start hover:border-primary hover:shadow-md transition-all duration-200"
            >
              <p className="text-xs sm:text-sm">
                {suggestion}
              </p>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
