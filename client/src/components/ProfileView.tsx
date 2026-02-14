import { useState } from "react";
import { useAuth } from "../context/AuthProvider";
import { LogOut, Mail, Calendar, User as UserIcon, Pencil, X, Loader2 } from "lucide-react";

interface ProfileViewProps {
  onBack: () => void;
}

export function ProfileView({ }: ProfileViewProps) {
  const { user, signOut, updateProfile } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  // Inicializamos con un valor seguro para evitar errores de controlado/no controlado
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
    
    // Si no ha cambiado, solo salimos del modo edición
    if (newName === fullName) {
        setIsEditing(false);
        return;
    }

    setIsSaving(true);
    // updateProfile viene del AuthProvider modificado anteriormente
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

  // Manejador de teclas: Enter para guardar, Escape para cancelar
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault(); // Evitar comportamientos por defecto
      handleSaveName();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Perfil</h2>

        <div className="space-y-4 mb-6">
          
          {/* Sección Nombre Completo */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
            <UserIcon size={18} className="text-gray-500 dark:text-gray-400 flex-shrink-0" />
            
            <div className="flex-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">Nombre completo</p>
              
              {isEditing ? (
                <div className="mt-1">
                    <input 
                        type="text" 
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isSaving}
                        className="w-full px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        autoFocus
                        placeholder="Escribe tu nombre..."
                    />
                    <p className="text-[10px] text-gray-400 mt-1 ml-1">
                        Presiona <span className="font-bold">Enter</span> para guardar
                    </p>
                </div>
              ) : (
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">
                    {fullName}
                </p>
              )}
            </div>

            {/* Botones de control (Solo Editar o Cancelar/Loading) */}
            <div className="flex items-center gap-1 self-start mt-1">
                {isEditing ? (
                    // Si está editando, mostramos Spinner (si guarda) o X para cancelar
                    isSaving ? (
                        <div className="p-1.5">
                            <Loader2 size={16} className="animate-spin text-primary-600" />
                        </div>
                    ) : (
                        <button 
                            onClick={handleCancel}
                            className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            title="Cancelar (Esc)"
                        >
                            <X size={16} />
                        </button>
                    )
                ) : (
                    // Si no está editando, botón de lápiz
                    <button 
                        onClick={() => {
                            setNewName(fullName);
                            setIsEditing(true);
                        }}
                        className="p-1.5 rounded-md text-gray-400 hover:text-primary-600 transition-colors"
                        title="Editar nombre"
                    >
                        <Pencil size={16} />
                    </button>
                )}
            </div>
          </div>

          {/* Email (Solo lectura) */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
            <Mail size={18} className="text-gray-500 dark:text-gray-400 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Email</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user?.email}</p>
            </div>
          </div>

          {/* Fecha creación */}
          {createdAt && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <Calendar size={18} className="text-gray-500 dark:text-gray-400 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Cuenta creada</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{createdAt}</p>
              </div>
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => void signOut()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-primary-600 dark:text-primary-400 font-medium transition-colors w-full sm:w-auto justify-center sm:justify-start"
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}