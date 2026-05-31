import { describe, it, expect, beforeEach } from 'vitest'
import { mockClient } from 'aws-sdk-client-mock'
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { putObject, getObject } from './storage'

const s3Mock = mockClient(S3Client)

beforeEach(() => {
  s3Mock.reset()
})

describe('putObject', () => {
  it('sends a PutObjectCommand with key, body, content type, and configured bucket', async () => {
    s3Mock.on(PutObjectCommand).resolves({})
    await putObject('uploads/user-1/file.png', Buffer.from('bytes'), 'image/png')
    const calls = s3Mock.commandCalls(PutObjectCommand)
    expect(calls).toHaveLength(1)
    expect(calls[0].args[0].input).toMatchObject({
      Bucket: 'simtrack-test',
      Key: 'uploads/user-1/file.png',
      Body: Buffer.from('bytes'),
      ContentType: 'image/png',
    })
  })
})

describe('getObject', () => {
  it('returns the bytes and content type for an existing object', async () => {
    const bytes = Buffer.from('image-bytes')
    s3Mock.on(GetObjectCommand).resolves({
      Body: { transformToByteArray: async () => new Uint8Array(bytes) } as never,
      ContentType: 'image/png',
    })

    const result = await getObject('uploads/user-1/file.png')

    expect(result).not.toBeNull()
    expect(result?.contentType).toBe('image/png')
    expect(Buffer.from(result!.body)).toEqual(bytes)
    const calls = s3Mock.commandCalls(GetObjectCommand)
    expect(calls[0].args[0].input).toMatchObject({
      Bucket: 'simtrack-test',
      Key: 'uploads/user-1/file.png',
    })
  })

  it('falls back to application/octet-stream when no content type is present', async () => {
    s3Mock.on(GetObjectCommand).resolves({
      Body: { transformToByteArray: async () => new Uint8Array() } as never,
    })

    const result = await getObject('uploads/user-1/file.bin')

    expect(result?.contentType).toBe('application/octet-stream')
  })

  it('returns null when the object does not exist', async () => {
    s3Mock.on(GetObjectCommand).rejects({ name: 'NoSuchKey' })
    expect(await getObject('uploads/user-1/missing.png')).toBeNull()
  })

  it('rethrows non-404 errors instead of reporting the object missing', async () => {
    s3Mock
      .on(GetObjectCommand)
      .rejects({ name: 'InternalError', $metadata: { httpStatusCode: 500 } })
    await expect(getObject('uploads/user-1/boom.png')).rejects.toBeTruthy()
  })
})
