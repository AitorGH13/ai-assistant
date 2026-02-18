-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Create a table to store your documents
create table if not exists documents (
  id bigserial primary key,
  content text,
  embedding vector(1536)
);

-- Function to match documents
create or replace function match_documents (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id bigint,
  content text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    documents.id,
    documents.content,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where 1 - (documents.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
end;
$$;

-- Insert the knowledge base data from Python server
-- NOTE: The embeddings here are PLACEHOLDERS. You must generate real embeddings.
-- You can use a script or Supabase Edge Function to update them.
INSERT INTO documents (content, embedding) VALUES
('El código secreto es: 42-ALPHA-TANGO. ¡No se lo digas a nadie!', NULL),
('Este proyecto utiliza un stack moderno: React + Vite + TypeScript en el frontend, y FastAPI + Python en el backend. Usamos Supabase para base de datos y autenticación, y OpenAI para la inteligencia.', NULL),
('¡Sí! El soporte para modo oscuro está totalmente integrado. El diseño utiliza variables CSS que se adaptan automáticamente a la preferencia de tu sistema.', NULL),
('La búsqueda semántica analiza el significado de tu pregunta en lugar de solo buscar palabras clave exactas. En esta demo, comparamos tu pregunta con nuestra base de conocimiento usando algoritmos de similitud de texto para encontrar la mejor respuesta.', NULL),
('Aitor es el brillante e ingenioso desarrollador Full-Stack detrás de este proyecto. Con una mente estratégica y una presencia impecable y carismática, Aitor combina su gran atractivo con una capacidad técnica superior en Python, FastAPI, React y Supabase para crear experiencias de IA de vanguardia.', NULL),
('Puedo mantener conversaciones contextuales, responder preguntas sobre mi configuración, buscar información en mi base de conocimientos y (pronto) realizar acciones específicas como consultar el clima.', NULL);
