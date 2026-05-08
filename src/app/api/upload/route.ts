import { put } from '@vercel/blob'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

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
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 })
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'File size must be under 5 MB' }, { status: 413 })
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const bytes = await file.arrayBuffer()
    await writeFile(join(process.cwd(), 'public', 'uploads', filename), Buffer.from(bytes))
    return NextResponse.json({ url: `/uploads/${filename}` })
  }

  const blob = await put(`uploads/${session.user.id}/${Date.now()}-${file.name}`, file, {
    access: 'public',
  })

  return NextResponse.json({ url: blob.url })
}
