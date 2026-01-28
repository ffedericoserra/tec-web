/**
 * Visit validation schemas
 */

const { z } = require('zod');

const sequenceItemSchema = z.object({
  itemId: z.string().min(1, 'Item ID is required'),
  nextDirections: z.string().default(''),
  prevDirections: z.string().default(''),
  overrideImage: z.string().url().optional(),
});

const quizQuestionSchema = z.object({
  question: z.string().min(1, 'Question is required'),
  options: z.array(z.string()).min(2, 'At least 2 options are required'),
  correctIndex: z.number().min(0),
});

const createVisitSchema = z.object({
  title: z.string().min(1, 'Visit title is required').trim(),
  museumId: z.string().min(1, 'Museum ID is required'),
  description: z.string().trim().optional(),
  imageUrl: z.string().url().optional(),
  sequence: z.array(sequenceItemSchema).optional(),
  type: z.enum(['standard', 'synchronized']).default('standard'),
  length: z.enum(['quick', 'normal', 'deep']).default('normal'),
  isPublic: z.boolean().default(true),
  quiz: z.array(quizQuestionSchema).optional(),
});

const updateVisitSchema = z.object({
  title: z.string().trim().optional(),
  description: z.string().trim().optional(),
  imageUrl: z.string().url().optional(),
  sequence: z.array(sequenceItemSchema).optional(),
  type: z.enum(['standard', 'synchronized']).optional(),
  length: z.enum(['quick', 'normal', 'deep']).optional(),
  isPublic: z.boolean().optional(),
  quiz: z.array(quizQuestionSchema).optional(),
});

module.exports = {
  createVisitSchema,
  updateVisitSchema,
};
