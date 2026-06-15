/**
 * Decides which auth providers are registered. The `test` credentials provider
 * is passwordless login-as-anyone, so it is included ONLY when test mode is on.
 * Combined with the env module's hard-fail on `AUTH_TEST_MODE=true` in
 * production, this makes it impossible for the test provider to reach a
 * production deployment.
 */
export function buildAuthProviders<TProvider>(params: {
  baseProviders: TProvider[]
  emailProvider: TProvider
  testProvider: TProvider
  isTestMode: boolean
}): TProvider[] {
  const providers = [...params.baseProviders, params.emailProvider]
  if (params.isTestMode) providers.push(params.testProvider)
  return providers
}
