import { cache } from 'react'
import { auth as rawAuth } from '../../auth'

export const auth = cache(rawAuth)
