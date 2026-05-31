import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockClient } from 'aws-sdk-client-mock'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

import { auth } from '@/lib/auth'
import { POST } from './route'

const s3Mock = mockClient(S3Client)
const mockedAuth = vi.mocked(auth)

// A 1x1 PNG (valid magic bytes for file-type sniffing).
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64',
)

function makeRequest(file: File) {
  const form = new FormData()
  form.append('file', file)
  return new Request('http://localhost/api/upload', { method: 'POST', body: form })
}

beforeEach(() => {
  s3Mock.reset()
  mockedAuth.mockReset()
})

describe('POST /api/upload', () => {
  it('stores a valid image and returns a /media URL', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'user-1' } } as never)
    s3Mock.on(PutObjectCommand).resolves({})
    const file = new File([PNG_BYTES], 'My Pic.png', { type: 'image/png' })

    const res = await POST(makeRequest(file))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.url).toMatch(/^\/media\/uploads\/user-1\/\d+-My_Pic\.png$/)
    const calls = s3Mock.commandCalls(PutObjectCommand)
    expect(calls).toHaveLength(1)
    expect(calls[0].args[0].input.Key).toMatch(/^uploads\/user-1\/\d+-My_Pic\.png$/)
    expect(calls[0].args[0].input.ContentType).toBe('image/png')
  })

  it('rejects unauthenticated requests with 401 and does not store', async () => {
    mockedAuth.mockResolvedValue(null as never)
    const file = new File([PNG_BYTES], 'pic.png', { type: 'image/png' })
    const res = await POST(makeRequest(file))
    expect(res.status).toBe(401)
    expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(0)
  })

  it('rejects a disallowed MIME type with 400 and does not store', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'user-1' } } as never)
    const file = new File(['<svg></svg>'], 'x.svg', { type: 'image/svg+xml' })
    const res = await POST(makeRequest(file))
    expect(res.status).toBe(400)
    expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(0)
  })

  it('rejects a non-image whose bytes do not match an allowed image with 400', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'user-1' } } as never)
    const file = new File([Buffer.from('not really a png')], 'fake.png', { type: 'image/png' })
    const res = await POST(makeRequest(file))
    expect(res.status).toBe(400)
    expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(0)
  })
})
