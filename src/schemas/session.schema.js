/**
 * Session validation schemas
 */

const { z } = require('zod');

const createSessionSchema = z.object({
  visitId: z.string().min(1, 'Visit ID is required'),
  code: z.string().min(3, 'Code must be at least 3 characters').max(50).optional(),
});

/**
 * Only the actions a participant can trigger. 'joined' / 'left' are written by
 * the server and are deliberately not accepted here, so a client can't forge
 * them. Mirrors the command ids in frontend-navigator/src/voice.js.
 */
const logActivitySchema = z.object({
  action: z.enum([
    'more',
    'simpler',
    'author',
    'year',
    'exit',
    'map',
    'tellMore',
    'tellLess',
    'tooSimple',
  ]),
});

const sendMessageSchema = z.object({
  text: z.string().trim().min(1, 'Message cannot be empty').max(500),
});

const submitQuizSchema = z.object({
  answers: z
    .array(
      z.object({
        questionIndex: z.number().int().min(0),
        selectedIndex: z.number().int().min(0),
      })
    )
    .min(1, 'At least one answer is required'),
});

const submitSectionAnswerSchema = z
  .object({
    questionId: z.string().min(1, 'Question ID is required'),
    selectedIndex: z.number().int().min(0).optional(),
    text: z.string().trim().max(1000).optional(),
  })
  .refine(
    (answer) => answer.selectedIndex !== undefined || Boolean(answer.text),
    'An answer is required'
  );

module.exports = {
  createSessionSchema,
  logActivitySchema,
  sendMessageSchema,
  submitQuizSchema,
  submitSectionAnswerSchema,
};
