import { productHuntSocialImage } from '@outname/shared/launch/product-hunt'
import { describe, expect, it, vi } from 'vitest'
import { metadata } from './page'

vi.mock('server-only', () => ({}))

describe('Product Hunt page metadata', () => {
  it('uses the launch-specific social preview image', () => {
    expect(metadata.openGraph).toMatchObject({
      images: [productHuntSocialImage],
    })
    expect(metadata.twitter).toMatchObject({
      card: 'summary_large_image',
      images: [
        {
          alt: productHuntSocialImage.alt,
          url: productHuntSocialImage.url,
        },
      ],
    })
  })
})
