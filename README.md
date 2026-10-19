# JGJG Image Studio

A small, responsive text-to-image web app with a prompt box, six visual styles, square/portrait/landscape sizes, two quality settings, an in-page preview, and PNG download.

Image requests are sent from a serverless function. The OpenAI API key is never sent to the browser. The app asks for a studio password before generating images.

## Deploy from this GitHub repository

1. Create a Vercel project and import `bitsbb01/image-creation-from-text`.
2. Add these environment variables in the Vercel project settings:
   - `OPENAI_API_KEY`: an OpenAI API key with image generation access.
   - `APP_PASSWORD`: a strong password for the studio.
   - `OPENAI_IMAGE_MODEL`: optional; defaults to `gpt-image-2.5-sunburst`.
3. Deploy. The Vercel URL will serve the app and its `/api/login` and `/api/generate` functions.

Do not put API keys or passwords in repository files, browser code, or GitHub Pages settings. GitHub Pages can host static files, but it cannot run these protected serverless endpoints; deploy through Vercel (or another compatible Node serverless host) for image generation.

## Run locally

Install the Vercel CLI, copy `.env.example` to `.env.local`, fill in the two required secrets, then run `vercel dev`. Open the local URL printed by the CLI.

The generated image is kept in the current browser page and can be downloaded as a PNG. The app does not save prompts or images to a server.
