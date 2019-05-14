"use strict";
const packageInfo = require("../package.json");
const util = require("util");
const config = require("exp-config");
const {buildLogger} = require("lu-logger");
const request = require("request").defaults({json: true});

const backends = buildBackends();

function performRequest(method, params) {
  const logger = buildLogger({meta: {correlationId: params.correlationId}});

  return new Promise((resolve, reject) => {
    const url = `${params.baseUrl || config.proxyUrl}${params.path}`;
    logger.debug("HTTP", method, url, "params:", params);

    const opts = {
      method,
      url,
      qs: params.qs,
      headers: buildHeaders(params, params.headers || {})
    };

    if (params.body) {
      opts.body = params.body;
    }
    if (params.timeout) {
      opts.timeout = params.timeout;
    }

    request(opts, (err, response, body) => {
      if (err) {
        logger.warning("HTTP %s:%s yielded %s (error", method, url, response && response.statusCode, err, body, ")");
        return reject(err);
      }

      // if (response.statusCode > 499) {
      //   return reject(buildVerboseError(method, params, response));
      // }

      return resolve(response);
    });
  });
}

function buildHeaders(params, headers = {}) {
  const defaults = {
    accept: "application/json",
    "correlation-id": params.correlationId,
    "http-requester-name": packageInfo.name
  };
  return {...defaults, ...headers};
}

function buildVerboseError(method, params, response) {
  const url = `${params.baseUrl || config.proxyUrl}${params.path}`;
  const msg = util.format(
    "HTTP %s:%s yielded %s (detail:",
    method,
    url,
    response && response.statusCode,
    dumpResponse(response),
    ")"
  );
  const error = new Error(msg);
  error.statusCode = response.statusCode;

  return error;
}

function dumpResponse(response) {
  const body = (response && response.body && JSON.stringify(response.body)) || response.text;
  return `${response.statusCode}:${body}`;
}

function buildBackends() {
  const result = {
    del: performRequest.bind(null, "DELETE")
  };

  ["HEAD", "GET", "PATCH", "POST", "PUT"].forEach((method) => {
    result[method.toLowerCase()] = performRequest.bind(null, method);
  });

  result.asserted = Object.keys(result).reduce((asserted, verb) => {
    asserted[verb] = withAssertion.bind(withAssertion, verb, result[verb]);
    return asserted;
  }, {});

  return result;
}

function withAssertion(verb, fn, params) {
  return fn(params).then((response) => {
    if (verb === "GET" && response.statusCode > 299) {
      throw buildVerboseError("GET", params, response);
    } else if (![200, 201, 204, 301, 302].includes(response.statusCode)) {
      throw buildVerboseError(verb.toUpperCase(), params, response);
    }

    return response.body;
  });
}

module.exports = backends;
