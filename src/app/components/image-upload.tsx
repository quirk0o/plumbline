'use client'

import { useRef, useState } from 'react'
import styles from './image-upload.module.css'

interface ImageUploadProps {
  value?: string
  onChange: (url: string) => void
  shape?: 'square' | 'circle'
  label?: string
}

export function ImageUpload({
  value,
  onChange,
  shape = 'square',
  label = 'Add image',
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setUploading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      if (!res.ok) throw new Error('Upload failed')
      const data = (await res.json()) as { url: string }
      onChange(data.url)
    } catch {
      setError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file?.type.startsWith('image/')) handleFile(file)
  }

  return (
    <div className={styles.wrapper}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className={styles.hiddenInput}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />
      <button
        type="button"
        className={`${styles.trigger} ${styles[shape]}`}
        style={value ? { backgroundImage: `url("${value}")` } : undefined}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        disabled={uploading}
        aria-label={value ? 'Change image' : label}
      >
        {!value && (
          <span className={styles.placeholder}>
            {uploading ? 'Uploading…' : label}
          </span>
        )}
      </button>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  )
}
