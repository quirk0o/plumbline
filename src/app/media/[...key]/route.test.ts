import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/storage', () => ({
  getObject: vi.fn(),
}))

import { getObject } from '@/lib/storage'
import { GET } from './route'

const mockedGetObject = vi.mocked(getObject)

function ctx(key: string[]) {
  return { params: Promise.resolve({ key }) }
}

beforeEach(() => {
  mockedGetObject.mockReset()
})

describe('GET /media/[...key]', () => {
  it('streams the object bytes with its content type for an existing object', async () => {
    const bytes = Buffer.from('png-bytes')
    mockedGetObject.mockResolvedValue({ body: bytes, contentType: 'image/png' })

    const res = await GET(
      new Request('http://localhost/media/uploads/user-1/a.png'),
      ctx(['uploads', 'user-1', 'a.png']),
    )

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(Buffer.from(await res.arrayBuffer())).toEqual(Buffer.from('png-bytes'))
    expect(mockedGetObject).toHaveBeenCalledWith('uploads/user-1/a.png')
  })

  it('returns 400 for a key containing .. without calling storage', async () => {
    const res = await GET(
      new Request('http://localhost/media/uploads/../secret'),
      ctx(['uploads', '..', 'secret']),
    )

    expect(res.status).toBe(400)
    expect(mockedGetObject).not.toHaveBeenCalled()
  })

  it('returns 400 for a key containing an empty segment without calling storage', async () => {
    const res = await GET(
      new Request('http://localhost/media/uploads//a.png'),
      ctx(['uploads', '', 'a.png']),
    )

    expect(res.status).toBe(400)
    expect(mockedGetObject).not.toHaveBeenCalled()
  })

  it('serves a file whose name contains .. as a substring (not a traversal segment)', async () => {
    const bytes = Buffer.from('ok')
    mockedGetObject.mockResolvedValue({ body: bytes, contentType: 'image/png' })

    const res = await GET(
      new Request('http://localhost/media/uploads/user-1/re..lease.png'),
      ctx(['uploads', 'user-1', 're..lease.png']),
    )

    expect(res.status).toBe(200)
    expect(mockedGetObject).toHaveBeenCalledWith('uploads/user-1/re..lease.png')
  })

  it('returns 404 when the object does not exist', async () => {
    mockedGetObject.mockResolvedValue(null)

    const res = await GET(
      new Request('http://localhost/media/uploads/user-1/missing.png'),
      ctx(['uploads', 'user-1', 'missing.png']),
    )

    expect(res.status).toBe(404)
  })

  it('returns 502 when storage throws a non-404 error', async () => {
    mockedGetObject.mockRejectedValue(new Error('S3 down'))

    const res = await GET(
      new Request('http://localhost/media/uploads/user-1/boom.png'),
      ctx(['uploads', 'user-1', 'boom.png']),
    )

    expect(res.status).toBe(502)
  })
})
