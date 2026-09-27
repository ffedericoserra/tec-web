/**
 * Auth validation schemas
 */

const { z } = require('zod');

const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .trim(),
  // Aggiunto il campo email con la validazione nativa di Zod
  email: z
    .string()
    .email('Invalid email format')
    .trim(),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(100, 'Password must be at most 100 characters'),
});

const loginSchema = z.object({
  // Il campo si chiama "username" nel body, ma accettando anche l'email 
  // aggiorniamo il messaggio di errore per essere più chiari
  username: z.string().min(1, 'Username or Email is required').trim(),
  password: z.string().min(1, 'Password is required'),
});

const rechargeWalletSchema = z.object({
  amount: z
    .number()
    .positive('Recharge amount must be greater than 0')
    .max(10000, 'Recharge amount is too high'),
});

const updateLanguageSchema = z.object({
  language: z.enum(['it', 'en']),
});

module.exports = {
  registerSchema,
  loginSchema,
  rechargeWalletSchema,
  updateLanguageSchema,
};
