"use strict";
const util = require("util");
const config = require("exp-config");
const {buildLogger} = require("lu-logger");
const axios = require("axios");
const {livesInGcp} = config;
const {getGcpAuthHeaders} = require("./gcp-auth");
const callingAppName = require(`${process.cwd()}/package.json`).name;

const backends = buildBackends();

async function performRequest(method, params) {
  const logger = buildLogger({
    meta: {
      correlationId: params.correlationId,
      requesterName: callingAppName,
      routingKey: params.routingKey,
      key: params.key
    }
  });
  const url = getUrl(params);
  logger.info(`HTTP ${method}, ${url}, params: ${JSON.stringify(params)}`);

  const opts = {
    method,
    params: {...params.qs, ...params.query},
    headers: await buildHeaders(params, {...(params.headers || {})}),
    validateStatus: () => true, // do not let axios validate status, we do that ourselves
    maxBodyLength: Infinity,
    maxContentLength: Infinity
  };

  if (params.body) {
    opts.data = params.body;
  }
  if (params.timeout) {
    opts.timeout = params.timeout;
  }
  if (params.responseType) {
    opts.responseType = params.responseType;
  }

  let response;
  try {
    response = await axios(url, opts);
    logger.info(`HTTP response for ${method} ${url}, ${response.status}, ${JSON.stringify(response.data)}`);
  } catch (err) {
    logger.warning(
      `HTTP ${method}:${url} yielded ${response && response.status}, error: ${err}, body: ${response && response.data}`
    );
    throw err;
  }

  // for backwards compability
  response.statusCode = response.status;
  response.body = response.data;
  return response;
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
  const body = (response && response.data && JSON.stringify(response.data)) || response.text;
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

  result.getAsStream = async (params) => {
    const url = getUrl(params);
    const opts = {
      method: "get",
      params: {...params.qs, ...params.query},
      headers: await buildHeaders(params, {...(params.headers || {})}),
      validateStatus: function () {
        return true; // do not let axios validate status, we do that ourselves
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      responseType: "stream"
    };

    if (params.timeout) {
      opts.timeout = params.timeout;
    }
    const response = await axios(url, opts);

    return response.data;
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

function getUrl(params) {
  const application = params.path.split("/").find(Boolean);
  if (livesInGcp && livesInGcp.includes(application)) {
    return `${params.baseUrl || config.gcpProxy.url}${params.path}`;
  }
  return `${params.baseUrl || config.proxyUrl}${params.path}`;
}

module.exports = backends;
