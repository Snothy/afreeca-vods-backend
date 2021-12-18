/**
 * Module that handles JSON Validation on requests.
 * @module controllers/validation
 * @author Petar Drumev
 * @see schemas/* for JSON Schema definitions
 */
const { Validator, ValidationError } = require('jsonschema');

const addStreamerSchema = require('../schemas/streamers.json').definitions.addStreamer;
const getBrowseSchema = require('../schemas/streamers.json').definitions.getBrowse;
const loginSchema = require('../schemas/streamers.json').definitions.login;
const getLiveSchema = require('../schemas/streamers.json').definitions.getLive;
const fetchVodsSchema = require('../schemas/vods.json').definitions.fetchVods;
const fetchNewVodSchema = require('../schemas/vods.json').definitions.fetchNewVod;

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

    try {
      v.validate(body, schema, validationOptions);
      await next();
    } catch (err) {
      if (err instanceof ValidationError) {
        ctx.status = 400;
        ctx.body = err;
      } else {
        throw err;
      }
    }
  };
  return handler;
};

exports.validateAddStreamer = validator(addStreamerSchema, 'streamer');
exports.validateGetBrowse = validator(getBrowseSchema, 'streams');
exports.validateLogin = validator(loginSchema, 'streamer');
exports.validateGetLive = validator(getLiveSchema, 'streamer');
exports.validateFetchVods = validator(fetchVodsSchema, 'vod');
exports.validateFetchNewVod = validator(fetchNewVodSchema, 'vod');
