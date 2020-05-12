"use strict";

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => {
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const body = chunks.length > 0 ? JSON.parse(Buffer.concat(chunks).toString()) : {};
        resolve(body);
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

module.exports = parseBody;
