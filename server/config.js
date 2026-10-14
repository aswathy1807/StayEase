const { z } = require('zod');

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  MONGODB_URI: z.string().trim().min(1)
    .refine((value) => /^mongodb(?:\+srv)?:\/\//.test(value), 'MONGODB_URI must be a MongoDB connection string'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters')
    .refine((value) => value !== 'replace-with-a-long-random-secret', 'Replace the example JWT_SECRET with a unique random value'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:3000'),
  ADMIN_EMAIL: z.string().email().optional().or(z.literal('')),
  ADMIN_PASSWORD: z.string().min(12).optional().or(z.literal(''))
});

function loadConfig(env = process.env) {
  return envSchema.parse(env);
}

module.exports = { loadConfig };
