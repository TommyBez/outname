'use client'

import { Button } from '@outname/ui/components/ui/button'
import { Input } from '@outname/ui/components/ui/input'
import { X } from 'lucide-react'
import { useMemo, useState } from 'react'

export interface MemoryFileRow {
  content: string
  path: string
  updatedLabel: string
}

export function AgentMemoryFilesList({ files }: { files: MemoryFileRow[] }) {
  const [query, setQuery] = useState('')
  const visibleFiles = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) {
      return files
    }
    return files.filter(
      (file) =>
        file.path.toLowerCase().includes(needle) ||
        file.content.toLowerCase().includes(needle)
    )
  }, [files, query])

  return (
    <div className="flex flex-col gap-6">
      <div className="max-w-md">
        <div className="relative">
          <Input
            aria-label="Search files by name or content"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search files by name or content..."
            value={query}
          />
          {query ? (
            <Button
              aria-label="Clear search"
              className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground"
              onClick={() => setQuery('')}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <X aria-hidden className="size-4" />
            </Button>
          ) : null}
        </div>
        <p
          aria-live="polite"
          className="mt-2 font-mono text-muted-foreground text-xs"
        >
          {query
            ? `${visibleFiles.length} of ${files.length} files`
            : `${files.length} files`}
        </p>
      </div>

      {visibleFiles.length === 0 ? (
        <div className="border border-border bg-muted p-8">
          <p className="font-semibold text-2xl leading-none tracking-tighter">
            No files match “{query}”.
          </p>
          <p className="mt-3 max-w-md text-muted-foreground text-sm">
            Search matches file names and file contents.
          </p>
          <Button
            className="mt-6"
            onClick={() => setQuery('')}
            size="sm"
            type="button"
            variant="outline"
          >
            Clear search
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-10">
          {visibleFiles.map((row) => (
            <li className="flex flex-col gap-3" key={row.path}>
              <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-border border-b pb-2">
                <h2 className="font-bold font-mono text-sm">{row.path}</h2>
                <span className="font-mono text-muted-foreground text-xs">
                  Updated {row.updatedLabel}
                </span>
              </header>
              <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap border border-border bg-muted p-4 font-mono text-xs leading-relaxed">
                {row.content}
              </pre>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
