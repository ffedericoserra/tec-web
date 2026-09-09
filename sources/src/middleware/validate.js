/**
 * Zod validation middleware
 * Validates request body, query, or params against a zod schema
 */

const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    try {
      const data = req[source];
      const result = schema.safeParse(data);

      if (!result.success) {
        const errors = result.error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        return res.status(400).json({
          error: 'Validation Error',
          details: errors,
        });
      }

      // Replace with parsed/transformed data
      req[source] = result.data;
      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = validate;
