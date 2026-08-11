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

const sectionQuestionSchema = z
  .object({
    prompt: z.string().trim().min(1, 'Question text is required').max(1000),
    answerType: z.enum(['open', 'multiple-choice']),
    options: z.array(z.string().trim().min(1).max(300)).default([]),
  })
  .superRefine((question, context) => {
    if (question.answerType === 'multiple-choice' && question.options.length < 2) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message: 'Multiple-choice questions require at least 2 options',
      });
    }
  });

const visitBlockSchema = z
  .object({
    type: z.enum(['artwork', 'questions']).default('artwork'),
    blockName: z.string().trim().default('Mainboard'),
    items: z.array(z.string().min(1, 'Item ID is required')).default([]),
    questions: z.array(sectionQuestionSchema).default([]),
  })
  .superRefine((block, context) => {
    if (block.type === 'questions' && block.questions.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['questions'],
        message: 'Question sections require at least one question',
      });
    }
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
  blocks: z.array(visitBlockSchema).optional(),
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
  blocks: z.array(visitBlockSchema).optional(),
  type: z.enum(['standard', 'synchronized']).optional(),
  length: z.enum(['quick', 'normal', 'deep']).optional(),
  isPublic: z.boolean().optional(),
  quiz: z.array(quizQuestionSchema).optional(),
});

module.exports = {
  createVisitSchema,
  updateVisitSchema,
};
