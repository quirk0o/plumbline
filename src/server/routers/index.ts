import { z } from 'zod'
import { router, publicProcedure } from '../trpc'

export const appRouter = router({
  hello: publicProcedure
    .input(z.object({ name: z.string().optional() }))
    .query(({ input }) => {
      return { message: `Hello ${input.name ?? 'World'}` }
    }),
})

export type AppRouter = typeof appRouter
