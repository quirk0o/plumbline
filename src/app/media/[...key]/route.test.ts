import { describe, it, expect, beforeEach } from 'vitest'
import { mockClient } from 'aws-sdk-client-mock'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { GET } from './route'

const s3Mock = mockClient(S3Client)

// A 1x1 PNG (valid magic bytes — same buffer shape used in upload/route.test.ts).
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64',
)

function ctx(key: string[]) {
  return { params: Promise.resolve({ key }) }
}

beforeEach(() => {
  s3Mock.reset()
})

describe('GET /media/[...key]', () => {
  it('streams the object bytes with its content type for an existing object', async () => {
    s3Mock.on(GetObjectCommand).resolves({
      Body: { transformToByteArray: async () => new Uint8Array(PNG_BYTES) } as never,
      ContentType: 'image/png',
    })

    const res = await GET(
      new Request('http://localhost/media/uploads/user-1/a.png'),
      ctx(['uploads', 'user-1', 'a.png']),
    )

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(Buffer.from(await res.arrayBuffer())).toEqual(PNG_BYTES)
    const calls = s3Mock.commandCalls(GetObjectCommand)
    expect(calls).toHaveLength(1)
    expect(calls[0].args[0].input.Key).toBe('uploads/user-1/a.png')
  })

  it('returns 400 for a key containing .. without calling storage', async () => {
    const res = await GET(
      new Request('http://localhost/media/uploads/../secret'),
      ctx(['uploads', '..', 'secret']),
    )

    expect(res.status).toBe(400)
    expect(s3Mock.commandCalls(GetObjectCommand)).toHaveLength(0)
  })

  it('returns 400 for a key containing an empty segment without calling storage', async () => {
    const res = await GET(
      new Request('http://localhost/media/uploads//a.png'),
      ctx(['uploads', '', 'a.png']),
    )

    expect(res.status).toBe(400)
    expect(s3Mock.commandCalls(GetObjectCommand)).toHaveLength(0)
  })

  it('serves a file whose name contains .. as a substring (not a traversal segment)', async () => {
    s3Mock.on(GetObjectCommand).resolves({
      Body: { transformToByteArray: async () => new Uint8Array(Buffer.from('ok')) } as never,
      ContentType: 'image/png',
    })

    const res = await GET(
      new Request('http://localhost/media/uploads/user-1/re..lease.png'),
      ctx(['uploads', 'user-1', 're..lease.png']),
    )

    expect(res.status).toBe(200)
    const calls = s3Mock.commandCalls(GetObjectCommand)
    expect(calls).toHaveLength(1)
    expect(calls[0].args[0].input.Key).toBe('uploads/user-1/re..lease.png')
  })

  it('returns 404 when the object does not exist', async () => {
    s3Mock
      .on(GetObjectCommand)
      .rejects(Object.assign(new Error('nope'), { name: 'NoSuchKey' }))

    const res = await GET(
      new Request('http://localhost/media/uploads/user-1/missing.png'),
      ctx(['uploads', 'user-1', 'missing.png']),
    )

    expect(res.status).toBe(404)
  })

  it('returns 502 when storage throws a non-404 error', async () => {
    s3Mock
      .on(GetObjectCommand)
      .rejects(
        Object.assign(new Error('boom'), { $metadata: { httpStatusCode: 500 } }),
      )

    const res = await GET(
      new Request('http://localhost/media/uploads/user-1/boom.png'),
      ctx(['uploads', 'user-1', 'boom.png']),
    )

    expect(res.status).toBe(502)
  })
})
