(function () {
  function $(sel, root) { return (root || document).querySelector(sel); }
  function encode(s) { return encodeURIComponent(s == null ? "" : String(s)); }
  function safe(s) { return (s == null) ? "" : String(s).trim(); }

  function findInviteForm() {
    // Prefer the form that posts to /join; fallback to first form.
    return document.querySelector('form[action="/join"]') || document.querySelector('form');
  }

  // Create (or reuse) a single inline notice container right after the name input
  function ensureNoticeAfter(input) {
    let n = $('#nameCheckNotice');
    if (n && n.parentElement) return n;
    n = document.createElement('div');
    n.id = 'nameCheckNotice';
    n.className = 'notice-inline notice-warn';
    // Insert right after the input
    input.insertAdjacentElement('afterend', n);
    return n;
  }

  function clearNotice() {
    const n = $('#nameCheckNotice');
    if (n && n.parentElement) n.remove();
  }

  function renderTakenNotice(input, rawName, suggestion, onAccept, onEdit) {
    const n = ensureNoticeAfter(input);
    n.innerHTML = `
      <div class="notice-content">
        <div class="notice-title">Name already in use</div>
        <div class="notice-text">
          The name "<strong>${escapeHtml(rawName)}</strong>" is already used in this room.
          You can join as "<strong>${escapeHtml(suggestion)}</strong>" instead.
        </div>
        <div class="notice-actions">
          <button type="button" class="btn btn-primary" id="nameUseSuggestion">
            Use “${escapeHtml(suggestion)}”
          </button>
          <button type="button" class="btn btn-link" id="nameEdit">
            Edit name
          </button>
        </div>
      </div>
    `;
    $('#nameUseSuggestion', n)?.addEventListener('click', onAccept);
    $('#nameEdit', n)?.addEventListener('click', onEdit);
  }

  // Minimal HTML escape for text injections
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function checkAndMaybeAdjustName(e) {
    const form = e.currentTarget;
    const nameInput = $('input[name="participantName"]', form);
    const roomInput = $('input[name="roomCode"]', form);
    if (!nameInput || !roomInput) return;

    const rawName = safe(nameInput.value);
    const roomCode = safe(roomInput.value);
    if (!rawName || !roomCode) return; // let server-side validation handle

    // Pause submit while checking
    e.preventDefault();
    clearNotice();

    try {
      const url = `/api/rooms/${encode(roomCode)}/name-available?name=${encode(rawName)}`;
      const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });

      if (resp.ok) {
        const data = await resp.json();
        if (data && data.available === false && data.suggestion && data.suggestion !== rawName) {
          // Show inline notice with actions
          renderTakenNotice(
            nameInput,
            rawName,
            data.suggestion,
            // onAccept
            () => {
              nameInput.value = data.suggestion;
              clearNotice();
              form.submit();
            },
            // onEdit
            () => {
              clearNotice();
              nameInput.focus();
              nameInput.select?.();
            }
          );
          return; // do not submit yet
        }
      }
    } catch (_) {
      // Best-effort: on error, fall through and submit as-is
    }

    // Either available, API unreachable, or no suggestion → submit as-is
    form.submit();
  }

  document.addEventListener('DOMContentLoaded', function () {
    const form = findInviteForm();
    if (!form) return;

    // Clear notice when user changes the name again
    const nameInput = $('input[name="participantName"]', form);
    if (nameInput) {
      nameInput.addEventListener('input', clearNotice);
    }

    form.addEventListener('submit', checkAndMaybeAdjustName, { once: false });
  });
})();
