import { describe, it, expect } from 'vitest'
import { imageUrlSchema } from './image-url-schema'

describe('imageUrlSchema', () => {
  it('accepts new /media/ upload URLs', () => {
    expect(imageUrlSchema.parse('/media/uploads/user-1/123-pic.png')).toBe('/media/uploads/user-1/123-pic.png')
  })

  it('accepts legacy /uploads/ URLs (backward compatibility)', () => {
    expect(imageUrlSchema.parse('/uploads/123-pic.png')).toBe('/uploads/123-pic.png')
  })

  it('accepts vercel-storage.com hosted URLs (existing rows)', () => {
    const url = 'https://abc.public.blob.vercel-storage.com/x.png'
    expect(imageUrlSchema.parse(url)).toBe(url)
  })

  it('accepts undefined (optional)', () => {
    expect(imageUrlSchema.parse(undefined)).toBeUndefined()
  })

  it('rejects an arbitrary external domain', () => {
    expect(() => imageUrlSchema.parse('https://evil.example.com/x.png')).toThrow()
  })

  it('rejects a non-URL string', () => {
    expect(() => imageUrlSchema.parse('not a url')).toThrow()
  })
})
