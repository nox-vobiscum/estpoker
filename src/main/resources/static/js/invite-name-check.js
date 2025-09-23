(function () {
  function $(sel, root) { return (root || document).querySelector(sel); }
  function enc(s) { return encodeURIComponent(s == null ? "" : String(s)); }
  function trim(s) { return (s == null) ? "" : String(s).trim(); }

  function findInviteForm() {
    // Prefer the /join form; fallback to first form on the page.
    return document.querySelector('form[action="/join"]') || document.querySelector('form');
  }

  async function onSubmit(e) {
    const form = e.currentTarget;
    const nameInput = $('input[name="participantName"]', form);
    const roomInput = $('input[name="roomCode"]', form);
    if (!nameInput || !roomInput) return; // nothing to do

    const rawName = trim(nameInput.value);
    const roomCode = trim(roomInput.value);
    if (!rawName || !roomCode) return; // let server-side validation handle

    // Pause submit while checking
    e.preventDefault();

    try {
      const url = `/api/rooms/${enc(roomCode)}/name-available?name=${enc(rawName)}`;
      const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });

      if (resp.ok) {
        const data = await resp.json();

        // If name is taken and we have a suggestion, ask the user.
        if (data && data.available === false && data.suggestion && data.suggestion !== rawName) {
          const ok = window.confirm(
            `This name is already used in this room.\n\n` +
            `Join as “${data.suggestion}” instead?`
          );
          if (ok) {
            nameInput.value = data.suggestion;
            form.submit();
            return;
          } else {
            // Let the user edit their name.
            nameInput.focus();
            nameInput.select?.();
            return;
          }
        }
      }
    } catch (_) {
      // Network/JSON error → fall through and submit as-is.
    }

    // Either available or API unreachable → continue with submit.
    form.submit();
  }

  document.addEventListener('DOMContentLoaded', function () {
    const form = findInviteForm();
    if (!form) return;
    form.addEventListener('submit', onSubmit, { once: false });
  });
})();
