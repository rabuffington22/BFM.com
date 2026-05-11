// Booking precheck for existing patients.
//
// Flow: collect last name + DOB → POST to Dwight's /api/public/booking-precheck
// → on ok, redirect to the appropriate Athena consumer-scheduling URL; on
// blocked, swap the form for a "please call" message. Network errors fail open
// (redirect anyway) so an API hiccup never strands a legitimate patient.

(function () {
  const API_BASE = 'https://api.drdwight.ai';

  // Athena consumer-scheduling deep links — practice 17502, location 17502-1.
  // Source of truth here is intentional: the precheck endpoint never returns a
  // URL, only ok/blocked, so the URL stays on the patient-facing side.
  const ATHENA_URLS = {
    michelle: 'https://consumer.scheduling.athena.io/?locationId=17502-1&practitionerId=17502-17',
    ty:       'https://consumer.scheduling.athena.io/?locationId=17502-1&practitionerId=17502-14',
  };

  const PROVIDER_NAMES = {
    michelle: 'Michelle Guilbeault, PA-C',
    ty:       'Ty Talley, PA-C',
  };

  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('precheck-form');
    if (!form) return;

    const status         = document.getElementById('form-status');
    const blockedState   = document.getElementById('blocked-state');
    const blockedMessage = document.getElementById('blocked-message');
    const submitBtn      = document.getElementById('submit-btn');
    const providerGroup  = document.getElementById('provider-group');
    const providerSelect = document.getElementById('provider');
    const providerBanner = document.getElementById('provider-banner');
    const providerName   = document.getElementById('provider-name');
    const pageSubtitle   = document.getElementById('page-subtitle');

    // If ?provider= is in the URL and valid, hide the selector. Otherwise show it.
    const urlProvider = new URLSearchParams(window.location.search).get('provider');
    const presetProvider = urlProvider && ATHENA_URLS[urlProvider] ? urlProvider : null;

    if (presetProvider) {
      providerGroup.style.display = 'none';
      providerSelect.removeAttribute('required');
      providerSelect.value = presetProvider;
      providerBanner.style.display = '';
      providerName.textContent = PROVIDER_NAMES[presetProvider];
    } else {
      providerGroup.style.display = '';
    }

    // Set a sensible min on the target-date picker (today) so patients can't pick the past.
    const todayIso = (() => {
      const d = new Date();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${d.getFullYear()}-${mm}-${dd}`;
    })();
    const targetInput = document.getElementById('targetDate');
    if (targetInput) targetInput.min = todayIso;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const provider   = presetProvider || providerSelect.value;
      const lastName   = form.lastName.value.trim();
      const dob        = form.dob.value;          // <input type="date"> emits YYYY-MM-DD
      const targetDate = form.targetDate.value;   // YYYY-MM-DD

      // Validation
      const errors = [];
      if (!provider || !ATHENA_URLS[provider]) errors.push('Please select a provider.');
      if (!lastName)   errors.push('Please enter your last name.');
      if (!dob)        errors.push('Please enter your date of birth.');
      if (!targetDate) errors.push('Please enter the day you want to come in.');

      if (errors.length > 0) {
        showError(errors.join(' '));
        return;
      }

      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'Checking…';
      submitBtn.disabled = true;
      status.style.display = 'none';

      let result;
      try {
        const res = await fetch(`${API_BASE}/api/public/booking-precheck`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lastName, dob, provider, targetDate }),
        });
        // Rate-limited or 5xx → fail open. 4xx (other than 429) likely indicates
        // a bad request shape; surface a generic error and let them retry / call.
        if (res.status === 429) {
          showError('Too many attempts. Please wait a moment and try again.');
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
          return;
        }
        if (res.status >= 500) {
          // Server error — fail open, send to Athena.
          window.location.href = ATHENA_URLS[provider];
          return;
        }
        if (!res.ok) {
          showError('We could not process your request. Please try again or call (817) 431-9199.');
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
          return;
        }
        result = await res.json();
      } catch (err) {
        // Network failure — fail open, send to Athena. Better to allow occasional
        // duplicates (front desk catches them) than block legitimate patients.
        window.location.href = ATHENA_URLS[provider];
        return;
      }

      if (result && result.ok === false && result.message) {
        // Blocked: swap form for the call-us state.
        form.style.display = 'none';
        providerBanner.style.display = 'none';
        blockedMessage.textContent = result.message;
        blockedState.style.display = '';
        // Scroll the blocked content into view (some screens are short).
        blockedState.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      // ok — redirect to Athena.
      window.location.href = ATHENA_URLS[provider];
    });

    function showError(msg) {
      status.textContent = msg;
      status.className = 'form-status form-status--error';
      status.style.display = '';
    }
  });
})();
