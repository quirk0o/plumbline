import '@testing-library/jest-dom'
import { server } from './msw-server'

process.env.DATABASE_URL ??= 'postgresql://postgres:password@localhost:5432/simstrack_test?schema=public'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
