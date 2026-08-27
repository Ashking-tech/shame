const board = document.querySelector("#board");
const emptyState = document.querySelector("#empty-state");
const cardTemplate = document.querySelector("#card-template");
const form = document.querySelector("#upload-form");
const uploadPanel = document.querySelector("#upload-panel");
const uploadToggle = document.querySelector("#upload-toggle");
const adminTokenInput = document.querySelector("#admin-token-input");
const imageInput = document.querySelector("#image-input");
const captionInput = document.querySelector("#caption-input");
const dropzone = document.querySelector("#dropzone");
const submitButton = form.querySelector(".submit");
const formStatus = document.querySelector("#form-status");
const ADMIN_TOKEN_KEY = "hall-admin-token";

adminTokenInput.value = loadAdminToken();

let verifiedToken = "";

adminTokenInput.addEventListener("input", async () => {
  const token = adminTokenInput.value.trim();
  window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
  await verifyAndRender(token);
});

async function verifyAndRender(token) {
  if (!token) {
    verifiedToken = "";
    renderDeleteControls();
    return;
  }

  try {
    const response = await fetch("/api/verify-token", {
      headers: { "x-admin-token": token },
    });
    const result = await response.json();
    verifiedToken = result.valid ? token : "";
  } catch {
    verifiedToken = "";
  }

  renderDeleteControls();
}

verifyAndRender(loadAdminToken());
hydrateBoard();

uploadToggle.addEventListener("click", () => {
  const shouldOpen = uploadPanel.hidden;
  uploadPanel.hidden = !shouldOpen;
  uploadToggle.textContent = shouldOpen ? "Close" : "Upload";

  if (shouldOpen) {
    captionInput.focus();
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const file = imageInput.files[0];
  if (!file) {
    setStatus("Choose an image first.", true);
    imageInput.click();
    return;
  }

  const payload = new FormData();
  payload.append("caption", captionInput.value.trim());
  payload.append("image", file);

  try {
    setSubmitting(true);
    const response = await fetch("/api/posts", {
      method: "POST",
      body: payload,
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Upload failed.");
    }

    prependPost(result);
    form.reset();
    uploadPanel.hidden = true;
    uploadToggle.textContent = "Upload";
    setStatus("Posted to the wall.");
  } catch (error) {
    setStatus(error.message || "Upload failed.", true);
  } finally {
    setSubmitting(false);
  }
});

["dragenter", "dragover"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.add("is-dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.remove("is-dragging");
  });
});

dropzone.addEventListener("drop", (event) => {
  const [file] = event.dataTransfer.files;
  if (!file || !file.type.startsWith("image/")) {
    setStatus("Only image files are allowed.", true);
    return;
  }

  const transfer = new DataTransfer();
  transfer.items.add(file);
  imageInput.files = transfer.files;
  setStatus(`${file.name} ready to post.`);
});

imageInput.addEventListener("change", () => {
  const [file] = imageInput.files;
  if (!file) {
    return;
  }

  setStatus(`${file.name} ready to post.`);
});

// ponytail: paste image from clipboard (Ctrl+V) — reuses same DataTransfer path
document.addEventListener("paste", (event) => {
  const items = [...(event.clipboardData?.items || [])];
  const imgItem = items.find((i) => i.kind === "file" && i.type.startsWith("image/"));
  const file = imgItem?.getAsFile() || [...(event.clipboardData?.files || [])].find((f) => f.type.startsWith("image/"));
  if (!file) return;
  event.preventDefault();
  if (uploadPanel.hidden) {
    uploadPanel.hidden = false;
    uploadToggle.textContent = "Close";
  }
  const transfer = new DataTransfer();
  transfer.items.add(file);
  imageInput.files = transfer.files;
  setStatus(`${file.name || "pasted image"} ready to post.`);
  dropzone.classList.add("is-dragging");
  setTimeout(() => dropzone.classList.remove("is-dragging"), 400);
});

// ponytail: local dummy wall — shows ./img/* when API is dummy/unreachable
const DUMMY_POSTS = [
  { id: "dummy-1", caption: "Screenshot 20260531", imageUrl: "./img/Screenshot_20260531_010155.png" },
  { id: "dummy-2", caption: "Screenshot 20260610", imageUrl: "./img/Screenshot_20260610_171059.png" },
  { id: "dummy-3", caption: "Screenshot 20260614", imageUrl: "./img/Screenshot_20260614_164355.png" },
  { id: "dummy-4", caption: "Screenshot 20260617", imageUrl: "./img/Screenshot_20260617_204226.png" },
];

async function hydrateBoard() {
  try {
    const response = await fetch("/api/posts");
    const posts = await response.json();

    if (!response.ok) throw new Error("Could not load posts.");
    if (!posts.length) { renderPosts(DUMMY_POSTS); return; }
    renderPosts(posts);
  } catch (error) {
    // fallback to local img folder when Supabase dummy/offline
    renderPosts(DUMMY_POSTS);
  }
}

function renderPosts(posts) {
  board.innerHTML = "";
  emptyState.hidden = posts.length > 0;

  posts.forEach((post) => {
    board.appendChild(buildCard(post));
  });
}

function prependPost(post) {
  emptyState.hidden = true;
  board.prepend(buildCard(post));
}

function buildCard(post) {
  const card = cardTemplate.content.firstElementChild.cloneNode(true);
  const image = card.querySelector(".card__image");
  const caption = card.querySelector(".card__caption");
  const deleteButton = card.querySelector(".card__delete");

  image.src = post.imageUrl;
  image.alt = post.caption;
  caption.textContent = post.caption;

  deleteButton.hidden = !Boolean(verifiedToken);
  deleteButton.addEventListener("click", () => {
    deletePost(post.id, card);
  });

  return card;
}

function setSubmitting(isSubmitting) {
  submitButton.disabled = isSubmitting;
  submitButton.textContent = isSubmitting ? "Posting..." : "Post to wall";
}

function setStatus(message, isError = false) {
  formStatus.textContent = message;
  formStatus.classList.toggle("is-error", isError);
  formStatus.classList.toggle("is-success", !isError && Boolean(message));
}

async function deletePost(postId, card) {
  // ponytail: dummy cards are local-only, no API needed
  if (String(postId).startsWith("dummy-")) {
    card.remove();
    emptyState.hidden = board.children.length > 0;
    setStatus("Post deleted.");
    return;
  }
  if (!verifiedToken) {
    setStatus("Enter the admin token to delete posts.", true);
    uploadPanel.hidden = false;
    uploadToggle.textContent = "Close";
    adminTokenInput.focus();
    return;
  }

  try {
    const response = await fetch(`/api/posts/${postId}`, {
      method: "DELETE",
      headers: {
        "x-admin-token": verifiedToken,
      },
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || "Delete failed.");
    }

    card.remove();
    emptyState.hidden = board.children.length > 0;
    setStatus("Post deleted.");
  } catch (error) {
    setStatus(error.message || "Delete failed.", true);
  }
}

function renderDeleteControls() {
  const shouldShow = Boolean(verifiedToken);
  board.querySelectorAll(".card__delete").forEach((button) => {
    button.hidden = !shouldShow;
  });
}

function loadAdminToken() {
  return window.localStorage.getItem(ADMIN_TOKEN_KEY) || "";
}
