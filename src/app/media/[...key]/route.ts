import { NextResponse } from 'next/server'
import { getObject } from '@/lib/storage'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key } = await params

  if (key.some((segment) => segment === '..' || segment === '')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  const objectKey = key.join('/')

  let object
  try {
    object = await getObject(objectKey)
  } catch {
    return NextResponse.json({ error: 'Storage unavailable' }, { status: 502 })
  }

  if (!object) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Stream the bytes through this stable same-origin URL rather than redirecting
  // to a presigned URL: next/image's optimizer does not follow 302 redirects.
  // Copy into a fresh ArrayBuffer-backed view so the body is a plain BodyInit
  // (the SDK's Uint8Array can be SharedArrayBuffer-backed, which BodyInit rejects).
  const bytes = new Uint8Array(object.body.byteLength)
  bytes.set(object.body)
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      'Content-Type': object.contentType,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
