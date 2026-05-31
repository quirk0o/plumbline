import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/storage', () => ({
  objectExists: vi.fn(),
  presignGetUrl: vi.fn(),
}))

import { objectExists, presignGetUrl } from '@/lib/storage'
import { GET } from './route'

const mockedExists = vi.mocked(objectExists)
const mockedPresign = vi.mocked(presignGetUrl)

function ctx(key: string[]) {
  return { params: Promise.resolve({ key }) }
}

beforeEach(() => {
  mockedExists.mockReset()
  mockedPresign.mockReset()
})

describe('GET /media/[...key]', () => {
  it('302-redirects to the presigned URL for an existing object', async () => {
    mockedExists.mockResolvedValue(true)
    mockedPresign.mockResolvedValue('https://signed.example/obj')

    const res = await GET(new Request('http://localhost/media/uploads/user-1/a.png'), ctx(['uploads', 'user-1', 'a.png']))

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://signed.example/obj')
    expect(mockedPresign).toHaveBeenCalledWith('uploads/user-1/a.png')
  })

  it('returns 400 for a key containing .. without calling storage', async () => {
    const res = await GET(new Request('http://localhost/media/uploads/..%2Fsecret'), ctx(['uploads', '..', 'secret']))

    expect(res.status).toBe(400)
    expect(mockedExists).not.toHaveBeenCalled()
    expect(mockedPresign).not.toHaveBeenCalled()
  })

  it('returns 404 when the object does not exist', async () => {
    mockedExists.mockResolvedValue(false)

    const res = await GET(new Request('http://localhost/media/uploads/user-1/missing.png'), ctx(['uploads', 'user-1', 'missing.png']))

    expect(res.status).toBe(404)
    expect(mockedPresign).not.toHaveBeenCalled()
  })
})
