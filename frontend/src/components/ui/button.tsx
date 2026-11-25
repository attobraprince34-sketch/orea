import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

/**
 * Bouton Orea (v2) : pilule nette, sans bordure ni ombre décalée.
 * - default   : noir Encre, l'action principale (comme « Join Now » de la référence)
 * - highlight : Orange retour avec texte Encre (contraste 7,1:1), l'appel à l'action
 * Retour tactile : léger agrandissement au survol, enfoncement au clic.
 */
const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap select-none outline-none transition-[transform,background-color,color,box-shadow] duration-200 ease-out active:scale-[0.97] focus-visible:ring-4 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-destructive/30 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-ink text-ink-foreground hover:bg-ink/85",
        highlight: "bg-highlight text-highlight-foreground hover:bg-glow-400",
        brand: "bg-brand-700 text-white hover:bg-brand-800 dark:bg-brand-300 dark:text-brand-950 dark:hover:bg-brand-200",
        outline: "border border-input bg-card text-foreground hover:border-foreground/30 hover:bg-muted",
        secondary: "bg-muted text-foreground hover:bg-border",
        ghost: "text-foreground hover:bg-muted",
        destructive: "bg-destructive/10 text-destructive hover:bg-destructive/15",
        link: "rounded-md px-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 text-sm",
        sm: "h-9 px-4 text-sm",
        lg: "h-12 px-6 text-[15px]",
        xl: "h-14 px-7 text-base",
        icon: "size-10",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

/** Pastille ronde avec flèche, placée à droite d'un bouton (comme la référence). */
function ArrowBadge({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "-mr-2 ml-1 grid size-7 place-items-center rounded-full border-[1.5px] border-current transition-transform duration-200 group-hover/button:translate-x-0.5",
        className
      )}
    >
      <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 8h10M9 4l4 4-4 4" />
      </svg>
    </span>
  )
}

export { ArrowBadge, Button, buttonVariants }
