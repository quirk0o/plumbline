import { describe, it, expect } from 'vitest'
import { buildAuthProviders } from './auth-providers'

describe('buildAuthProviders', () => {
  it('registers base providers and the email provider, but not the test provider, when test mode is off', () => {
    const providers = buildAuthProviders({
      baseProviders: ['google'],
      emailProvider: 'email',
      testProvider: 'test',
      isTestMode: false,
    })
    expect(providers).toEqual(['google', 'email'])
  })

  it('appends the test provider when test mode is on', () => {
    const providers = buildAuthProviders({
      baseProviders: ['google'],
      emailProvider: 'email',
      testProvider: 'test',
      isTestMode: true,
    })
    expect(providers).toEqual(['google', 'email', 'test'])
  })
})
