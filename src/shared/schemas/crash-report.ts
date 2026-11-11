import { z } from 'zod'

export const crashErrorPayloadSchema = z
  .object({
    name: z.string().optional(),
    message: z.string().default('Unknown error'),
    stack: z.string().optional(),
  })
  .strict()

export type CrashErrorPayload = z.infer<typeof crashErrorPayloadSchema>

export const crashReportRequestSchema = z
  .object({
    error: crashErrorPayloadSchema.optional(),
    context: z.string().optional(),
    userDescription: z.string().optional(),
  })
  .strict()
  .optional()

export type CrashReportRequest = z.infer<typeof crashReportRequestSchema>
