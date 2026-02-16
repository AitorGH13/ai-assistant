import { useState } from "react";
import { useAuth } from "../context/AuthProvider";
import { LogOut, Mail, Calendar, User as UserIcon, Pencil, Loader2 } from "lucide-react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Card, CardContent } from "./ui/Card";

interface ProfileViewProps {
  onBack: () => void;
}

export function ProfileView({ }: ProfileViewProps) {
  const { user, signOut, updateProfile } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(user?.user_metadata?.full_name || "");
  const [isSaving, setIsSaving] = useState(false);

  const fullName = user?.user_metadata?.full_name || "Sin nombre";

  const createdAt = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("es-ES", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const handleSaveName = async () => {
    if (!newName.trim()) return;
    
    if (newName === fullName) {
        setIsEditing(false);
        return;
    }

    setIsSaving(true);
    const error = await updateProfile({ full_name: newName.trim() });
    setIsSaving(false);

    if (error) {
        alert("Error al actualizar: " + error);
    } else {
        setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setNewName(fullName);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveName();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      <Card>
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold text-foreground mb-6">Perfil</h2>

          <div className="space-y-4 mb-6">
            
            {/* Sección Nombre Completo */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-200 dark:bg-slate-900">
              <UserIcon size={18} className="text-muted-foreground flex-shrink-0" />
              
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Nombre completo</p>
                
                {isEditing ? (
                  <div className="mt-1">
                    <Input 
                      type="text" 
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onBlur={handleCancel}
                      disabled={isSaving}
                      className="h-8 text-sm"
                      autoFocus
                      placeholder="Escribe tu nombre..."
                    />
                    <p className="text-[10px] text-muted-foreground mt-1 ml-1">
                      Presiona <span className="font-bold">Enter</span> para guardar
                    </p>
                  </div>
                ) : (
                  <p className="text-sm font-medium text-foreground mt-1">
                    {fullName}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1 self-start mt-1">
                {isEditing ? (
                  isSaving ? (
                    <div className="p-1.5">
                      <Loader2 size={16} className="animate-spin text-primary" />
                    </div>
                  ) : null
                ) : (
                  <Button 
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setNewName(fullName);
                      setIsEditing(true);
                    }}
                    className="h-7 w-7 min-h-[28px] min-w-[28px] text-muted-foreground"
                    title="Editar nombre"
                  >
                    <Pencil size={16} />
                  </Button>
                )}
              </div>
            </div>

            {/* Email */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-200 dark:bg-slate-900">
              <Mail size={18} className="text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium text-foreground">{user?.email}</p>
              </div>
            </div>

            {/* Fecha creación */}
            {createdAt && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-200 dark:bg-slate-900">
                <Calendar size={18} className="text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Cuenta creada</p>
                  <p className="text-sm font-medium text-foreground">{createdAt}</p>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-border">
            <Button
              variant="ghost"
              onClick={() => void signOut()}
              className="text-primary w-full sm:w-auto justify-center sm:justify-start gap-2"
            >
              <LogOut size={16} />
              Cerrar sesión
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}