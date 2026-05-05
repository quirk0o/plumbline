import { config } from 'dotenv'
import { existsSync } from 'fs'
import { resolve } from 'path'

const testEnv = resolve(process.cwd(), '.env.test')
config({ path: existsSync(testEnv) ? testEnv : resolve(process.cwd(), '.env') })
