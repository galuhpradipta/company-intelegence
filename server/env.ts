import { z } from 'zod'

const booleanFlag = z
  .string()
  .optional()
  .transform((value) => value === '1' || value === 'true')

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().default('gpt-5.4-mini'),
  OPENAI_FALLBACK_MODEL: z.string().default('gpt-5.4'),
  NEWS_API_KEY: z.string().optional(),
  GNEWS_API_KEY: z.string().optional(),
  PEOPLE_DATA_LABS_API_KEY: z.string().optional(),
  OPENCORPORATES_API_KEY: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  BATCH_CONCURRENCY: z.coerce.number().default(5),
  PROVIDER_TIMEOUT_MS: z.coerce.number().default(10000),
  NEWS_LOOKBACK_DAYS: z.coerce.number().default(30),
  LOG_LEVEL: z.string().default('info'),
  COMPANY_INTELLIGENCE_MOCK_EXTERNAL_PROVIDERS: booleanFlag,
})

export const env = envSchema.parse(process.env)
