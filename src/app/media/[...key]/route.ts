import { NextResponse } from 'next/server'
import { objectExists, presignGetUrl } from '@/lib/storage'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key } = await params

  if (key.some((segment) => segment === '..' || segment === '')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  const objectKey = key.join('/')

  if (!(await objectExists(objectKey))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const url = await presignGetUrl(objectKey)
  return NextResponse.redirect(url, 302)
}
