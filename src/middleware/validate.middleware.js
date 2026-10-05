const ApiError = require('../utils/ApiError');

/**
 * validate({ body: schema, query: schema, params: schema })
 * Replaces the request parts with the parsed (coerced and stripped) values.
 */
const validate = (schemas) => (req, _res, next) => {
  for (const part of ['body', 'query', 'params']) {
    if (!schemas[part]) continue;
    const result = schemas[part].safeParse(req[part]);
    if (!result.success) {
      return next(
        ApiError.badRequest(
          'Validation failed',
          'VALIDATION_ERROR',
          result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
        )
      );
    }
    if (part === 'query') {
      Object.keys(req.query).forEach((k) => delete req.query[k]);
      Object.assign(req.query, result.data);
    } else {
      req[part] = result.data;
    }
  }
  next();
};

module.exports = validate;