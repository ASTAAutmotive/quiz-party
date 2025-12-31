
// Prefill game code from QR link
const params = new URLSearchParams(window.location.search);
const codeFromUrl = params.get("code");

if (codeFromUrl) {
  gameCodeInput.value = codeFromUrl.toUpperCase();
  playerNameInput.focus();
}

// Existing join logic continues below
