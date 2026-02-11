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
  size = "icon",
  label,
  ...props 
}: IconButtonProps) {
    const mappedVariant = (variant as any) === "primary" ? "default" : variant
    
    const iconClass = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-6 w-6" : "h-5 w-5"
    
    const sizeClasses = {
        sm: "h-9 w-9 min-h-[36px] min-w-[36px]",
        default: "h-10 w-10 min-h-[40px] min-w-[40px]",
        md: "h-10 w-10 min-h-[40px] min-w-[40px]",
        lg: "h-11 w-11 min-h-[44px] min-w-[44px]",
        icon: "h-10 w-10 min-h-[40px] min-w-[40px]"
    }
    
    const heightClass = sizeClasses[size as keyof typeof sizeClasses] || "h-10 w-10 min-h-[40px] min-w-[40px]"

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
