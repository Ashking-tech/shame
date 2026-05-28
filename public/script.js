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
adminTokenInput.addEventListener("input", () => {
  const token = adminTokenInput.value.trim();
  window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
  renderDeleteControls();
});

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

async function hydrateBoard() {
  try {
    const response = await fetch("/api/posts");
    const posts = await response.json();

    if (!response.ok) {
      throw new Error("Could not load posts.");
    }

    renderPosts(posts);
  } catch (error) {
    setStatus(error.message || "Could not load posts.", true);
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

  deleteButton.hidden = !hasAdminToken();
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
  const token = loadAdminToken();
  if (!token) {
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
        "x-admin-token": token,
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
  const shouldShow = hasAdminToken();
  board.querySelectorAll(".card__delete").forEach((button) => {
    button.hidden = !shouldShow;
  });
}

function hasAdminToken() {
  return Boolean(loadAdminToken());
}

function loadAdminToken() {
  return window.localStorage.getItem(ADMIN_TOKEN_KEY) || "";
}
