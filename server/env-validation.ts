import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be at least 32 characters'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  HELIUS_API_KEY: z.string().optional(),
  SIMPLESWAP_API_KEY: z.string().optional(),
  
  TRON_WALLET_SECRET: z.string().optional(),
  TRON_WALLET_ADDRESS: z.string().optional(),
  SOLANA_WALLET_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnvironment(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment validation failed:');
      error.errors.forEach(err => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      throw new Error('Invalid environment configuration');
    }
    throw error;
  }
}

export function getRequiredEnv(key: keyof Env): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

export function getOptionalEnv(key: keyof Env): string | undefined {
  return process.env[key];
}
