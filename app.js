const form = document.querySelector("#creatorForm");
const promptInput = document.querySelector("#prompt");
const charCount = document.querySelector("#charCount");
const styleInput = document.querySelector("#style");
const formMessage = document.querySelector("#formMessage");
const generateButton = document.querySelector("#generateButton");
const buttonText = document.querySelector("#buttonText");
const emptyState = document.querySelector("#emptyState");
const loadingState = document.querySelector("#loadingState");
const generatedImage = document.querySelector("#generatedImage");
const downloadButton = document.querySelector("#downloadButton");
const previewTitle = document.querySelector("#previewTitle");
const imageCaption = document.querySelector("#imageCaption");
const loginDialog = document.querySelector("#loginDialog");
const loginForm = document.querySelector("#loginForm");
const loginMessage = document.querySelector("#loginMessage");
const loginButton = document.querySelector("#loginButton");

const styles = {
  storybook: "Cheerful children's storybook illustration, warm expressive characters, soft bright colors, whimsical details, polished hand-painted look.",
  fantasy: "Whimsical fantasy illustration, magical atmosphere, rich color, finely detailed environment, cinematic storybook composition.",
  coloring: "Clean black line art for a coloring book, bold smooth outlines, white background, no shading, no gray, no color, large open areas, fully framed subject.",
  photoreal: "Photorealistic image, natural lighting, lifelike materials and details, carefully composed.",
  watercolor: "Delicate watercolor illustration, visible paper texture, gentle pigment washes, graceful edges, harmonious colors.",
  custom: ""
};

promptInput.addEventListener("input", () => {
  charCount.textContent = `${promptInput.value.length} / 4000`;
});

document.querySelectorAll(".style-option").forEach((option) => {
  option.addEventListener("click", () => {
    document.querySelectorAll(".style-option").forEach((item) => {
      const selected = item === option;
      item.classList.toggle("selected", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
    styleInput.value = option.dataset.style;
  });
});

function setBusy(busy) {
  generateButton.disabled = busy;
  buttonText.textContent = busy ? "Creating image…" : "Create image";
  loadingState.hidden = !busy;
  if (busy) {
    emptyState.hidden = true;
    generatedImage.hidden = true;
    downloadButton.hidden = true;
    previewTitle.textContent = "Your image is on its way";
    imageCaption.textContent = "The studio is bringing your idea to life.";
  }
}

async function postJSON(path, payload) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

function requestLogin() {
  if (!loginDialog.open) loginDialog.showModal();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginMessage.textContent = "";
  loginButton.disabled = true;
  try {
    const { response, body } = await postJSON("/api/login", { password: document.querySelector("#password").value });
    if (!response.ok) throw new Error(body.error || "That password could not be verified.");
    loginDialog.close();
    document.querySelector("#password").value = "";
    formMessage.textContent = "Studio unlocked. Your image is ready to create.";
  } catch (error) {
    loginMessage.textContent = error.message;
  } finally {
    loginButton.disabled = false;
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formMessage.textContent = "";
  const prompt = promptInput.value.trim();
  if (!prompt) {
    formMessage.textContent = "Add a description first, then create your image.";
    promptInput.focus();
    return;
  }

  setBusy(true);
  try {
    const { response, body } = await postJSON("/api/generate", {
      prompt,
      style: styleInput.value,
      size: document.querySelector("#size").value,
      quality: document.querySelector("#quality").value
    });
    if (response.status === 401) {
      setBusy(false);
      requestLogin();
      return;
    }
    if (!response.ok) throw new Error(body.error || "The image could not be created. Please try again.");
    if (!body.image) throw new Error("The image service returned no image. Please try again.");
    generatedImage.src = `data:image/png;base64,${body.image}`;
    generatedImage.alt = prompt;
    generatedImage.hidden = false;
    loadingState.hidden = true;
    emptyState.hidden = true;
    downloadButton.href = generatedImage.src;
    downloadButton.download = `jgjg-image-${new Date().toISOString().slice(0, 10)}.png`;
    downloadButton.hidden = false;
    previewTitle.textContent = "Your image is ready";
    imageCaption.textContent = prompt;
  } catch (error) {
    loadingState.hidden = true;
    emptyState.hidden = false;
    previewTitle.textContent = "Ready when you are";
    imageCaption.textContent = "A little imagination goes a long way.";
    formMessage.textContent = error.message;
  } finally {
    generateButton.disabled = false;
    buttonText.textContent = "Create image";
  }
});
