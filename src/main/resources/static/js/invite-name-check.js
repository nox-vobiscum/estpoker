(function () {
  // --- tiny helpers ---------------------------------------------------------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function enc(s) { return encodeURIComponent(s == null ? "" : String(s)); }
  function safe(s) { return (s == null) ? "" : String(s).trim(); }
  function qp(name) { try { return new URLSearchParams(location.search).get(name); } catch { return null; } }

  // Minimal HTML escape for text injections
  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Reusable inline notice right after the name input (nice UX)
  function ensureNoticeAfter(input) {
    let n = document.getElementById('nameCheckNotice');
    if (n && n.parentElement) return n;
    n = document.createElement('div');
    n.id = 'nameCheckNotice';
    n.className = 'notice-inline notice-warn';
    input.insertAdjacentElement('afterend', n);
    return n;
  }
  function clearNotice() {
    const n = document.getElementById('nameCheckNotice');
    if (n && n.parentElement) n.remove();
  }
  function renderTakenNotice(input, rawName, suggestion, onAccept, onEdit) {
    const n = ensureNoticeAfter(input);
    n.innerHTML = `
      <div class="notice-content">
        <div class="notice-title">Name already in use</div>
        <div class="notice-text">
          The name "<strong>${esc(rawName)}</strong>" is already used in this room.
          You can join as "<strong>${esc(suggestion)}</strong>" instead.
        </div>
        <div class="notice-actions">
          <button type="button" class="btn btn-primary" id="nameUseSuggestion">
            Use “${esc(suggestion)}”
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

  // Find the invite form (posts to /join)
  function findInviteForm() {
    return document.querySelector('form[action="/join"]') || document.querySelector('form');
  }

  // --- main check -----------------------------------------------------------
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

    const url = `/api/rooms/${enc(roomCode)}/name-available?name=${enc(rawName)}`;
    console.debug('[invite-name-check] checking', { roomCode, rawName, url });

    try {
      const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });

      if (!resp.ok) {
        console.warn('[invite-name-check] API not OK:', resp.status);
        form.submit(); // be permissive on API failures
        return;
      }

      const data = await resp.json();
      console.debug('[invite-name-check] API response', data);

      if (data && data.available === false && data.suggestion && data.suggestion !== rawName) {
        // Robust fallback: always ask via confirm() first (works even if CSS is cached/missing)
        const ok = window.confirm(
          `The name "${rawName}" is already used in this room.\n\nJoin as "${data.suggestion}" instead?`
        );
        if (ok) {
          nameInput.value = data.suggestion;
          form.submit();
          return;
        }

        // If user cancels, show a nice inline notice with buttons
        renderTakenNotice(
          nameInput,
          rawName,
          data.suggestion,
          // onAccept
          () => { nameInput.value = data.suggestion; clearNotice(); form.submit(); },
          // onEdit
          () => { clearNotice(); nameInput.focus(); nameInput.select?.(); }
        );
        return; // stop here, user will decide
      }
    } catch (err) {
      console.warn('[invite-name-check] API error:', err);
      // fall through to submit-as-is
    }

    // Either available or API unreachable → submit as-is
    form.submit();
  }

  // --- bootstrapping --------------------------------------------------------
  document.addEventListener('DOMContentLoaded', function () {
    console.debug('[invite-name-check] loaded v4');
    const form = findInviteForm();
    if (!form) { console.warn('[invite-name-check] form not found'); return; }

    // If server redirected here with nameTaken=1 (legacy path), show an immediate hint
    if (qp('nameTaken') === '1') {
      alert('This name is already used in this room. Please choose a unique display name.');
    }

    // Clear inline notice whenever user edits the name
    const nameInput = $('input[name="participantName"]', form);
    if (nameInput) nameInput.addEventListener('input', clearNotice);

    form.addEventListener('submit', checkAndMaybeAdjustName, { once: false });
  });
})();
