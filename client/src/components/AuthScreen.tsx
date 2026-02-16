import { useState } from "react";
import { useAuth } from "../context/AuthProvider";
import { Loader2 } from "lucide-react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Label } from "./ui/Label";
import { Card, CardContent } from "./ui/Card";

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError("Por favor, completa los campos obligatorios.");
      return;
    }

    if (mode === "signup") {
      if (!fullName.trim()) {
        setError("Por favor, ingresa tu nombre completo.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Las contraseñas no coinciden.");
        return;
      }
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setIsSubmitting(true);
    try {
      let result;
      
      if (mode === "login") {
        result = await signIn(email.trim(), password);
      } else {
        result = await signUp(email.trim(), password, { 
          full_name: fullName.trim() 
        });
      }

      if (result) {
        setError(result);
      } else if (mode === "signup") {
        setError(null);
        setMode("login");
        setFullName("");
        setPassword("");
        setConfirmPassword("");
        alert("Cuenta creada exitosamente. Por favor inicia sesión.");
      }
    } catch {
      setError("Ocurrió un error inesperado. Inténtalo de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardContent className="p-6">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-foreground">
              AI Assistant
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "login" ? "Inicia sesión para continuar" : "Crea una cuenta nueva"}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Nombre completo</Label>
                <Input
                  id="fullName"
                  placeholder="Nombre completo"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                placeholder="Email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                placeholder="Contraseña"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                <Input
                  id="confirmPassword"
                  placeholder="Confirmar contraseña"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            )}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin mr-2" />
                  {mode === "login" ? "Iniciando sesión..." : "Creando cuenta..."}
                </>
              ) : (
                mode === "login" ? "Iniciar sesión" : "Crear cuenta"
              )}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "login" ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}{" "}
            <Button
              variant="link"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError(null);
                setConfirmPassword(""); 
              }}
              disabled={isSubmitting}
              className="p-0 h-auto font-medium"
            >
              {mode === "login" ? "Crear cuenta" : "Iniciar sesión"}
            </Button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}