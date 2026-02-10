/**
 * Session validation schemas
 */

const { z } = require('zod');

const createSessionSchema = z.object({
  visitId: z.string().min(1, 'Visit ID is required'),
  code: z.string().min(3, 'Code must be at least 3 characters').max(50).optional(),
});

const logActivitySchema = z.object({
  action: z.enum(['tellMore', 'tellLess', 'simpler', 'tooSimple']),
});

module.exports = {
  createSessionSchema,
  logActivitySchema,
};
