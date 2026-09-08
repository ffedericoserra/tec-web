/**
 * Item validation schemas
 */

const { z } = require('zod');

const textSchema = z.object({
  text: z.string().min(1, 'Description text is required'),
  lengthCategory: z.enum(['15s', '30s', '60s']),
  language: z.enum(['it', 'en', 'fr', 'de', 'es']).default('it'),
  isAiGenerated: z.boolean().default(false),
});

const descriptionSchema = z.object({
  tone: z.enum(['easy', 'medium', 'complex']),
  texts: z.array(textSchema).min(1, 'At least one text is required'),
});

const createItemSchema = z.object({
  contentId: z.string().trim().min(1, 'Content ID is required'),
  targetAudience: z.enum(['general', 'children', 'student', 'expert', 'tourist']),
  descriptions: z.array(descriptionSchema).min(1, 'At least one description is required'),
  price: z.number().min(0).default(0),
  license: z.enum(['CC-BY', 'CC-BY-SA', 'CC-BY-NC', 'Copyright', 'Public Domain']).default('CC-BY'),
  isPublic: z.boolean().default(false),
  associatedContents: z.array(z.string()).optional(),
});

const updateItemSchema = z.object({
  targetAudience: z.enum(['general', 'children', 'student', 'expert', 'tourist']).optional(),
  descriptions: z.array(descriptionSchema).optional(),
  price: z.number().min(0).optional(),
  license: z.enum(['CC-BY', 'CC-BY-SA', 'CC-BY-NC', 'Copyright', 'Public Domain']).optional(),
  isPublic: z.boolean().optional(),
  associatedContents: z.array(z.string()).optional(),
});

module.exports = {
  createItemSchema,
  updateItemSchema,
};
