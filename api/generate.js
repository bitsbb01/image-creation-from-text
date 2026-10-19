const { createHmac, timingSafeEqual } = require("node:crypto");

const COOKIE_NAME = "jg_img_session";
const STYLES = {
  storybook: "Cheerful children's storybook illustration, warm expressive characters, soft bright colors, whimsical details, polished hand-painted look.",
  fantasy: "Whimsical fantasy illustration, magical atmosphere, rich color, finely detailed environment, cinematic storybook composition.",
  coloring: "Clean black line art for a coloring book, bold smooth outlines, white background, no shading, no gray, no color, large open areas, fully framed subject.",
  photoreal: "Photorealistic image, natural lighting, lifelike materials and details, carefully composed.",
  watercolor: "Delicate watercolor illustration, visible paper texture, gentle pigment washes, graceful edges, harmonious colors.",
  custom: ""
};
const SIZES = new Set(["1024x1024", "1024x1536", "1536x1024"]);
const QUALITIES = new Set(["medium", "high"]);

function send(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
  res.end(JSON.stringify(body));
}

function isAuthorized(req, secret) {
  const cookieHeader = req.headers.cookie || "";
  const encoded = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`));
  if (!encoded) return false;
  const token = decodeURIComponent(encoded.slice(COOKIE_NAME.length + 1));
  const [expires, providedSignature] = token.split(".");
  if (!/^\d+$/.test(expires || "") || !providedSignature || Number(expires) <= Math.floor(Date.now() / 1000)) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(expires).digest("hex"));
  const actual = Buffer.from(providedSignature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST for this request." }, { Allow: "POST" });
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) return send(res, 503, { error: "The studio access password has not been configured." });
  if (!isAuthorized(req, appPassword)) return send(res, 401, { error: "Please unlock the studio to generate an image." });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return send(res, 503, { error: "The image service key has not been configured." });

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const style = STYLES[body?.style];
  const size = body?.size;
  const quality = body?.quality;
  if (!prompt) return send(res, 400, { error: "Please describe the image you want." });
  if (prompt.length > 4000) return send(res, 400, { error: "Keep the description under 4,000 characters." });
  if (style === undefined) return send(res, 400, { error: "Choose one of the available image styles." });
  if (!SIZES.has(size)) return send(res, 400, { error: "Choose a supported image shape." });
  if (!QUALITIES.has(quality)) return send(res, 400, { error: "Choose a supported image detail setting." });

  const finalPrompt = style ? `${prompt}\n\nVisual style: ${style}` : prompt;
  let upstream;
  try {
    upstream = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.5-sunburst",
        prompt: finalPrompt,
        size,
        quality,
        output_format: "png",
        n: 1
      }),
      signal: AbortSignal.timeout(180000)
    });
  } catch (error) {
    console.error("Image service request failed", error?.name || "network error");
    return send(res, 502, { error: "The image service could not be reached. Please try again in a moment." });
  }

  const result = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const requestId = upstream.headers.get("x-request-id");
    console.error("Image service returned an error", { status: upstream.status, requestId, code: result?.error?.code });
    const message = upstream.status === 429
      ? "The image service is busy or its current limit has been reached. Please try again later."
      : result?.error?.code === "moderation_blocked"
        ? "This prompt could not be used. Try changing the description and submit again."
        : "The image service could not complete that request. Check the service setup and try again.";
    return send(res, upstream.status === 429 ? 429 : 502, { error: message });
  }

  const image = result?.data?.[0]?.b64_json;
  if (typeof image !== "string" || !image) return send(res, 502, { error: "The image service returned no image. Please try again." });
  return send(res, 200, { image, format: "png" });
};
