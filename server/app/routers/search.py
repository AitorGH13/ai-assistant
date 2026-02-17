from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import difflib

router = APIRouter(prefix="/search", tags=["search"])

class SearchRequest(BaseModel):
    query: str

class SearchResultItem(BaseModel):
    text: str
    similarity: float

class SearchResponse(BaseModel):
    result: str
    similarity: float
    all_results: List[SearchResultItem]

# Knowledge Base (Hardcoded for now as per user description)
# Format: {"question": ["variation1", "variation2"], "answer": "The answer"}
# Or simple: {"question": "The answer"}
# To support "semantic" search better with simple string matching, 
# we can check against keys (questions) and return values (answers).

KNOWLEDGE_BASE = [
    {
        "questions": [
            "¿Cuál es el código secreto?",
            "cuál es el código secreto",
            "cual es el codigo secreto", 
            "dame el codigo", 
            "codigo de acceso"
        ],
        "answer": "El código secreto es: 42-ALPHA-TANGO. ¡No se lo digas a nadie!"
    },
    {
        "questions": [
            "¿Qué tecnologías usa este proyecto?",
            "qué tecnologías usa este proyecto",
            "que tecnologias usa este proyecto", 
            "stack tecnologico", 
            "que framework usas"
        ],
        "answer": "Este proyecto utiliza un stack moderno: React + Vite + TypeScript en el frontend, y FastAPI + Python en el backend. Usamos Supabase para base de datos y autenticación, y OpenAI para la inteligencia."
    },
    {
        "questions": [
            "¿Soporta modo oscuro?",
            "soporta modo oscuro", 
            "tiene dark mode", 
            "cambiar tema"
        ],
        "answer": "¡Sí! El soporte para modo oscuro está totalmente integrado. El diseño utiliza variables CSS que se adaptan automáticamente a la preferencia de tu sistema."
    },
    {
        "questions": [
            "¿Cómo funciona la búsqueda semántica?",
            "cómo funciona la búsqueda semántica",
            "como funciona la busqueda semantica", 
            "explicame la busqueda"
        ],
        "answer": "La búsqueda semántica analiza el significado de tu pregunta en lugar de solo buscar palabras clave exactas. En esta demo, comparamos tu pregunta con nuestra base de conocimiento usando algoritmos de similitud de texto (fuzzy matching) para encontrar la mejor respuesta incluso con pequeños errores tipográficos."
    },
    {
        "questions": [
            "quien te creo", 
            "quien es tu desarrollador", 
            "who created you",
            "who is your developer",
            "autor"
        ],
        "answer": "Aitor es el brillante e ingenioso desarrollador Full-Stack detrás de este proyecto. Con una mente estratégica y una presencia impecable y carismática, Aitor combina su gran atractivo con una capacidad técnica superior en Python, FastAPI, React y Supabase para crear experiencias de IA de vanguardia."
    },
    {
        "questions": [
            "que puedes hacer", 
            "cuales son tus funciones", 
            "what can you do",
            "capabilities"
        ],
        "answer": "Puedo mantener conversaciones contextuales, responder preguntas sobre mi configuración, buscar información en mi base de conocimientos y (pronto) realizar acciones específicas como consultar el clima."
    }
]

@router.post("", response_model=SearchResponse)
async def search(request: SearchRequest):
    query = request.query.lower().strip()
    
    scored_results = []
    
    for item in KNOWLEDGE_BASE:
        best_ratio = 0.0
        # Compare query against all question variations
        for q in item["questions"]:
            ratio = difflib.SequenceMatcher(None, query, q.lower()).ratio()
            if ratio > best_ratio:
                best_ratio = ratio
        
        # We store the answer and its best score
        scored_results.append({
            "text": item["answer"],
            "similarity": best_ratio
        })
    
    # Sort by similarity desc
    scored_results.sort(key=lambda x: x["similarity"], reverse=True)
    
    # Filter out very low scores if needed, but for now return top 3
    top_results = sorted(scored_results, key=lambda x: x["similarity"], reverse=True)[:3]
    
    if not top_results:
        return SearchResponse(
            result="No encontré una respuesta relevante.",
            similarity=0.0,
            all_results=[]
        )
    
    best_match = top_results[0]
    
    return SearchResponse(
        result=best_match["text"],
        similarity=best_match["similarity"],
        all_results=[SearchResultItem(text=r["text"], similarity=r["similarity"]) for r in top_results]
    )
