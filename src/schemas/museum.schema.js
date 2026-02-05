/**
 * Museum validation schemas
 */

const { z } = require('zod');

const coordinatesSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

const pointOfInterestSchema = z.object({
  type: z.enum(['toilet', 'exit', 'bar', 'stairs', 'entrance', 'shop']),
  coordinates: coordinatesSchema,
  label: z.string().min(1, 'Label is required'),
});

const themeSchema = z.object({
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  font: z.string().optional(),
}).optional();

const mapDataSchema = z.object({
  imageUrl: z.string().url().optional(),
  bounds: z.object({
    north: z.number(),
    south: z.number(),
    east: z.number(),
    west: z.number(),
  }).optional(),
  center: coordinatesSchema.optional(),
}).optional();      // TODO: Maybe we want the img to be mandatory?

const createMuseumSchema = z.object({
  name: z.string().min(1, 'Museum name is required').trim(),
  address: z.string().trim().optional(),
  description: z.string().trim().optional(),
  theme: themeSchema,
  mapData: mapDataSchema,
  pointsOfInterest: z.array(pointOfInterestSchema).optional(),
  imageUrl: z.string().url().optional(),
});

const updateMuseumSchema = createMuseumSchema.partial();

const createContentSchema = z.object({
  type: z.enum(['Artwork', 'Artist', 'Movement', 'Place']),
  universalId: z.string().optional(),
  name: z.string().min(1, 'Content name is required').trim(),
  author: z.string().trim().optional(),
  year: z.string().trim().optional(),
  imageRecognitionUrl: z.string().url().optional(),
  coordinates: coordinatesSchema.optional(),
  qrCode: z.string().optional(),
});

module.exports = {
  createMuseumSchema,
  updateMuseumSchema,
  createContentSchema,
};
