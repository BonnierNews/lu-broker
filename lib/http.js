"use strict";
const util = require("util");
const config = require("exp-config");
const {buildLogger} = require("lu-logger");
const request = require("request").defaults({json: true});
const {livesInGcp} = config;
const {getGcpAuthHeaders} = require("./gcp-auth");
const callingAppName = require(`${process.cwd()}/package.json`).name;

const backends = buildBackends();

function performRequest(method, params) {
  const logger = buildLogger({
    meta: {correlationId: params.correlationId, requesterName: callingAppName, routingKey: params.routingKey}
  });

  return new Promise((resolve, reject) => {
    const url = `${params.baseUrl || config.proxyUrl}${params.path}`;
    logger.info(`HTTP ${method}, ${url}, params: ${JSON.stringify(params)}`);

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

      logger.info(`HTTP response for ${method} ${url}, ${response.statusCode}, ${JSON.stringify(response.body)}`);

      return resolve(response);
    });
  });
}

async function buildHeaders(params, headers = {}) {
  const application = params.path.split("/").find(Boolean);
  if (livesInGcp && livesInGcp.includes(application)) {
    const gcpHeader = await getGcpAuthHeaders(config.gcpProxy.audience);
    headers = {...headers, ...gcpHeader};
  }
  const defaults = {
    accept: "application/json",
    "correlation-id": params.correlationId,
    "x-debug-meta-requester-name": callingAppName,
    "x-debug-meta-routing-key": params.routingKey
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

  result.getAsStream = (params) => {
    const logger = buildLogger({
      meta: {correlationId: params.correlationId, requesterName: callingAppName, routingKey: params.routingKey}
    });
    const url = `${params.baseUrl || config.proxyUrl}${params.path}`;
    logger.info(`HTTP get, ${url}, params: ${JSON.stringify(params)}`);

    const opts = {
      method: "get",
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

    return new Promise((resolve, reject) => {
      const stream = request(opts);
      stream.on("response", (response) => {
        if (response.statusCode > 299) {
          reject(buildVerboseError("GET", params, response));
        } else {
          resolve(response);
        }
      });
    });
  };

  return result;
}

function withAssertion(verb, fn, params) {
  return fn(params).then((response) => {
    if (verb === "GET" && response.statusCode > 299) {
      throw buildVerboseError("GET", params, response);
    } else if (![200, 201, 202, 204, 301, 302].includes(response.statusCode)) {
      throw buildVerboseError(verb.toUpperCase(), params, response);
    }

    return response.body;
  });
}

module.exports = backends;
