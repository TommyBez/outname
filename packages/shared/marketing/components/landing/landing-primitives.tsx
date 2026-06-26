'use client'

import { BrandGlyph } from '@outname/shared/marketing/components/landing/brand-glyph'
import {
  revealVariants,
  staggerVariants,
} from '@outname/shared/marketing/components/landing/landing-motion'
import {
  channelsCard,
  type PrimitiveProduct,
  primitiveCards,
} from '@outname/shared/marketing/data/primitives'
import { domAnimation, LazyMotion, m as motion } from 'motion/react'

function ProductRow({ product }: { product: PrimitiveProduct }) {
  return (
    <div className="ease flex items-start gap-3 border border-transparent p-3 transition-colors duration-200 hover:border-border hover:bg-muted">
      <BrandGlyph
        className="mt-0.5 size-4 text-foreground"
        name={product.name}
      />
      <div className="min-w-0">
        <p className="font-medium text-sm tracking-tight">{product.name}</p>
        <p className="mt-0.5 text-muted-foreground text-sm leading-relaxed">
          {product.role}
        </p>
      </div>
    </div>
  )
}

export function LandingPrimitives({
  shouldReduceMotion,
}: {
  shouldReduceMotion: boolean
}) {
  return (
    <section
      className="px-4 py-14 sm:px-6 md:px-10 md:py-28 lg:px-12"
      id="primitives"
    >
      <LazyMotion features={domAnimation}>
        <motion.div
          className="mx-auto max-w-7xl"
          initial={shouldReduceMotion ? false : 'hidden'}
          variants={staggerVariants}
          viewport={{ margin: '-80px', once: true }}
          whileInView="visible"
        >
          <motion.div
            className="grid gap-5 border-border border-t pt-5 md:grid-cols-[minmax(0,0.82fr)_minmax(0,1fr)] md:items-end"
            variants={revealVariants}
          >
            <div>
              <p className="swiss-label text-muted-foreground">
                Built on primitives
              </p>
              <h2 className="mt-4 text-balance font-semibold text-4xl leading-[1.05] tracking-tight md:text-5xl">
                Nothing you can't host yourself.
              </h2>
            </div>
            <p className="max-w-2xl text-lg text-muted-foreground leading-relaxed">
              Open source, sitting on building blocks you already trust. Bring
              your own keys, swap the providers, run the whole thing on your own
              infrastructure.
            </p>
          </motion.div>

          <motion.div
            className="mt-10 grid gap-px border border-border bg-border lg:grid-cols-2"
            variants={revealVariants}
          >
            {primitiveCards.map((card) => (
              <div className="flex flex-col bg-background p-6" key={card.id}>
                <p className="swiss-label text-foreground">{card.eyebrow}</p>
                <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
                  {card.summary}
                </p>
                <div className="mt-5 grid gap-1">
                  {card.products.map((product) => (
                    <ProductRow key={product.name} product={product} />
                  ))}
                </div>
              </div>
            ))}

            <div className="bg-background p-6 lg:col-span-2 lg:grid lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] lg:gap-10">
              <div>
                <p className="swiss-label text-foreground">
                  {channelsCard.eyebrow}
                </p>
                <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
                  {channelsCard.summary}
                </p>
                <div className="mt-5">
                  <ProductRow product={channelsCard.product} />
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-5 lg:mt-0 lg:justify-center">
                <div>
                  <p className="swiss-label text-muted-foreground">Channels</p>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {channelsCard.channels.map((channel) => (
                      <li key={channel}>
                        <span className="inline-flex items-center gap-1.5 border border-border bg-foreground px-2.5 py-1 font-mono text-[11px] text-background tracking-normal">
                          <BrandGlyph
                            className="size-3 text-background"
                            name={channel}
                          />
                          {channel}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="swiss-label text-muted-foreground">
                    Connections
                  </p>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {channelsCard.connections.map((connection) => (
                      <li key={connection}>
                        <span className="inline-flex items-center gap-1.5 border border-border bg-background px-2.5 py-1 font-mono text-[11px] text-muted-foreground tracking-normal">
                          <BrandGlyph
                            className="size-3 text-foreground"
                            name={connection}
                          />
                          {connection}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </LazyMotion>
    </section>
  )
}
