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

const openingHoursSchema = z.object({
  mon: z.string().optional(),
  tue: z.string().optional(),
  wed: z.string().optional(),
  thu: z.string().optional(),
  fri: z.string().optional(),
  sat: z.string().optional(),
  sun: z.string().optional(),
});

const mapDataSchema = z.object({
  imageUrl: z.string().url().optional(),
  bounds: z.object({
    north: z.number(),
    south: z.number(),
    east: z.number(),
    west: z.number(),
  }).optional(),
  center: coordinatesSchema.optional(),
}).optional();      // Revisit when testing with actual maps

const createMuseumSchema = z.object({
  name: z.string().min(1, 'Museum name is required').trim(),
  address: z.string().trim().optional(),
  description: z.string().trim().optional(),
  website: z.string().url('Inserisci un URL valido').optional().or(z.literal('')),
  email: z.string().email('Inserisci un email valida').optional().or(z.literal('')),
  phone: z.string().trim().optional(),
  openingHours: openingHoursSchema.optional(),
  mapData: mapDataSchema,
  pointsOfInterest: z.array(pointOfInterestSchema).optional(),
  imageUrl: z.string().url().optional().or(z.literal('')),
});

const updateMuseumSchema = createMuseumSchema.partial();

const createContentSchema = z.object({
  type: z.enum(['Artwork', 'Artist', 'Movement', 'Place']),
  universalId: z.string().optional(),
  name: z.string().min(1, 'Content name is required').trim(),
  author: z.string().trim().optional(),
  year: z.string().trim().optional(),
  imageUrl: z.string().optional(),
  imgPath: z.string().optional(),
  imageRecognitionUrl: z.string().url().optional(),
  coordinates: coordinatesSchema.optional(),
  qrCode: z.string().optional(),
});

module.exports = {
  createMuseumSchema,
  updateMuseumSchema,
  createContentSchema,
};
