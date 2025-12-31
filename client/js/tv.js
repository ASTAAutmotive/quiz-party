
// QR generation for join
function renderQrJoin(code) {
  const el = document.getElementById("qr-code");
  if (!el || !window.QRCode) return;

  el.innerHTML = "";
  const url = new URL("/join.html", window.location.origin);
  url.searchParams.set("code", code);

  new QRCode(el, {
    text: url.toString(),
    width: 220,
    height: 220,
    correctLevel: QRCode.CorrectLevel.M
  });
}

// Call renderQrJoin(gameCode) inside your existing socket.on("gameCreated", ...) handler
