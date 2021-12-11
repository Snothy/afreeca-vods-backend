/**
 * Module that handles JSON Validation on requests.
 * @module controllers/validation
 * @author Petar Drumev
 * @see schemas/* for JSON Schema definitions
 */
const { Validator, ValidationError } = require('jsonschema');

/**
  * Wrapper function that returns a schema validator.
  * @param {object} schema - JSON schema definition
  * @param {string} resource - Name of URI path
  * @returns {function} - Koa middleware handler
  */
const validator = function (schema, resource) {
  const v = new Validator();
  const validationOptions = {
    throwError: true,
    propertyName: resource
  };
  /**
      * Middleware halndler that performs validation on a JSON schema file.
      * @param {object} ctx - Koa context object
      * @param {string} next - Koa callback function
      * @throws {ValidationError} Throws error from jsonschema library
      */
  const handler = async function (ctx, next) {
    const body = ctx.request.body;
    // console.log(body);

    try {
      v.validate(body, schema, validationOptions);
      await next();
    } catch (err) {
      if (err instanceof ValidationError) {
        // console.log(err);
        ctx.status = 400;
        ctx.body = err;
      } else {
        throw err;
      }
    }
  };
  return handler;
};
