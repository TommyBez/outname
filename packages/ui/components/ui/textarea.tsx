import type * as React from 'react'

import { cn } from '@outname/ui/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'field-sizing-content flex min-h-24 w-full border-2 border-input bg-background px-3 py-3 text-base outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive md:text-sm',
        className
      )}
      data-slot="textarea"
      {...props}
    />
  )
}

export { Textarea }
