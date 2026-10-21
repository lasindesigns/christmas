const form = document.getElementById('open-form');
const input = document.getElementById('invite');
const errorBox = document.getElementById('open-error');

function extractToken(value) {
  const text = value.trim();
  const match = /\/join\/([a-f0-9]{16,})/i.exec(text) || /^([a-f0-9]{16,})$/i.exec(text);
  return match ? match[1].toLowerCase() : null;
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const token = extractToken(input.value);
  if (!token) {
    errorBox.textContent = 'Tai nepanašu į galiojančią kvietimo nuorodą ar kodą.';
    errorBox.hidden = false;
    return;
  }
  location.href = `/join/${token}`;
});
