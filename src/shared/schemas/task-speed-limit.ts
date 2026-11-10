import { z } from 'zod'

const limitValueSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)

export const setTaskSpeedLimitSchema = z.object({
  taskId: z.string().min(1),
  download: limitValueSchema.optional(),
  upload: limitValueSchema.optional(),
})

export type SetTaskSpeedLimitPayload = z.infer<typeof setTaskSpeedLimitSchema>
