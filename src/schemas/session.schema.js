/**
 * Session validation schemas
 */

const { z } = require('zod');

const createSessionSchema = z.object({
  visitId: z.string().min(1, 'Visit ID is required'),
});

const logActivitySchema = z.object({
  action: z.enum(['tellMore', 'tellLess', 'simpler', 'tooSimple']),
});

module.exports = {
  createSessionSchema,
  logActivitySchema,
};
