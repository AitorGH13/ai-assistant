import { Button, ButtonProps } from "./Button"
import { LucideIcon } from "lucide-react"
import { cn } from "../../lib/utils"

interface IconButtonProps extends Omit<ButtonProps, 'children'> {
  icon: LucideIcon
  label?: string
}

export function IconButton({ 
  icon: Icon, 
  className, 
  variant = "ghost", 
  size = "icon", // Default to icon size of shadcn
  label,
  ...props 
}: IconButtonProps) {
    // Map variants if old code uses 'primary'
    const mappedVariant = (variant as any) === "primary" ? "default" : variant
    
    // Adjust icon size based on button size prop if needed, or default to reasonable size
    // Shadcn 'icon' size is h-10 w-10. 'sm' button is h-9. 'lg' is h-11.
    // Let's deduce icon size.
    const iconClass = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-6 w-6" : "h-5 w-5"
    
    // If user passed a specific size like 'sm' but wants an icon button (square),
    // Shadcn Button with size='sm' is NOT square (it has px-3). 
    // We should force square dimensions if we want a true icon button, or use size="icon" and scale via className.
    // For simplicity, let's trust size="icon" is mostly what we want, or map:
    const buttonSize = size === "sm" || size === "lg" || size === "default" || size === "icon" ? "icon" : "icon"
    
    const sizeClasses = {
        sm: "h-8 w-8",
        default: "h-10 w-10",
        md: "h-10 w-10", // map md to default/icon
        lg: "h-12 w-12",
        icon: "h-10 w-10"
    }
    
    const heightClass = sizeClasses[size as keyof typeof sizeClasses] || "h-10 w-10"

  return (
    <Button
      variant={mappedVariant as any}
      size="icon"
      className={cn(heightClass, className)} 
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon className={iconClass} />
    </Button>
  )
}
