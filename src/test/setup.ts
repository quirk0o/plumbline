import { config } from 'dotenv'
import { existsSync } from 'fs'
import { resolve } from 'path'
import '@testing-library/jest-dom'
import { server } from './msw-server'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const testEnv = resolve(process.cwd(), '.env.test')
config({ path: existsSync(testEnv) ? testEnv : resolve(process.cwd(), '.env') })
