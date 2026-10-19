const { createHmac, timingSafeEqual } = require("node:crypto");

const COOKIE_NAME = "jg_img_session";
const SESSION_SECONDS = 8 * 60 * 60;

function sign(value, secret) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

function send(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST for this request." }, { Allow: "POST" });
  const password = process.env.APP_PASSWORD;
  if (!password) return send(res, 503, { error: "The studio password has not been configured yet." });

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const submitted = typeof body?.password === "string" ? body.password : "";
  const expectedBuffer = Buffer.from(password);
  const submittedBuffer = Buffer.from(submitted);
  const valid = expectedBuffer.length === submittedBuffer.length && timingSafeEqual(expectedBuffer, submittedBuffer);
  if (!valid) return send(res, 401, { error: "That password did not match. Please try again." });

  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const token = `${expires}.${sign(String(expires), password)}`;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return send(res, 200, { ok: true }, {
    "Set-Cookie": `${COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure}`,
    "Cache-Control": "no-store"
  });
};
