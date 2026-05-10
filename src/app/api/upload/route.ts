import { put } from '@vercel/blob'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { fileTypeFromBuffer } from 'file-type'

const BLOCKED_TYPES = ['image/svg+xml', 'image/svg', 'text/html', 'image/x-icon']
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (!file.type.startsWith('image/') || BLOCKED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'File type not allowed' }, { status: 400 })
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'File size must be under 5 MB' }, { status: 413 })
  }

  const bytes = await file.arrayBuffer()
  const detected = await fileTypeFromBuffer(bytes)
  if (!detected || !ALLOWED_MIME.includes(detected.mime)) {
    return NextResponse.json({ error: 'Unsupported image format' }, { status: 400 })
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    const filename = `${Date.now()}-${safeName}`
    await writeFile(join(process.cwd(), 'public', 'uploads', filename), Buffer.from(bytes))
    return NextResponse.json({ url: `/uploads/${filename}` })
  }

  const blob = await put(`uploads/${session.user.id}/${Date.now()}-${safeName}`, file, {
    access: 'public',
  })

  return NextResponse.json({ url: blob.url })
}
