import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import type * as React from 'react'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap border-2 border-transparent font-bold text-xs uppercase tracking-[0.16em] outline-none transition-[background-color,color,border-color,transform] duration-150 ease-linear focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          'border-primary bg-primary text-primary-foreground hover:border-accent hover:bg-accent hover:text-accent-foreground',
        destructive:
          'border-destructive bg-destructive text-destructive-foreground hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:ring-destructive',
        outline:
          'border-primary bg-background text-foreground hover:bg-primary hover:text-primary-foreground',
        secondary:
          'border-secondary bg-secondary text-secondary-foreground hover:border-primary hover:bg-primary hover:text-primary-foreground',
        ghost:
          'border-transparent bg-transparent text-foreground hover:border-primary hover:bg-accent hover:text-accent-foreground',
        link: 'border-transparent px-0 text-primary underline-offset-4 hover:text-accent hover:underline',
      },
      size: {
        default: 'h-11 px-5 py-2 has-[>svg]:px-4',
        xs: "h-8 gap-1 px-2 text-[10px] has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: 'h-10 gap-1.5 px-4 has-[>svg]:px-3',
        lg: 'h-14 px-8 has-[>svg]:px-6',
        icon: 'size-11',
        'icon-xs': "size-8 [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': 'size-10',
        'icon-lg': 'size-14',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      data-size={size}
      data-slot="button"
      data-variant={variant}
      {...props}
    />
  )
}

export { Button, buttonVariants }
