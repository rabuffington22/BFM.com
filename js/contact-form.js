document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('contact-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const status = document.getElementById('form-status');
    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn.textContent;

    btn.textContent = 'Sending...';
    btn.disabled = true;
    status.className = 'form-status';
    status.style.display = 'none';

    // Honeypot check - if filled, silently "succeed" (it's a bot)
    const honeypot = form.querySelector('input[name="website"]');
    if (honeypot && honeypot.value) {
      status.textContent = 'Thank you! Your message has been sent.';
      status.className = 'form-status form-status--success';
      status.style.display = '';
      form.reset();
      btn.textContent = originalText;
      btn.disabled = false;
      return;
    }

    const data = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      message: form.message.value.trim(),
    };

    // Include Turnstile token if present
    const turnstileInput = form.querySelector('input[name="cf-turnstile-response"]');
    if (turnstileInput) {
      data['cf-turnstile-response'] = turnstileInput.value;
    }

    // Basic validation
    if (!data.name || !data.email || !data.message) {
      status.textContent = 'Please fill in all required fields.';
      status.className = 'form-status form-status--error';
      status.style.display = '';
      btn.textContent = originalText;
      btn.disabled = false;
      return;
    }

    // Length validation
    if (data.message.length > 5000) {
      status.textContent = 'Message is too long (max 5000 characters).';
      status.className = 'form-status form-status--error';
      status.style.display = '';
      btn.textContent = originalText;
      btn.disabled = false;
      return;
    }

    try {
      const res = await fetch('/functions/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await res.json().catch(() => null);

      if (res.ok) {
        status.textContent = 'Thank you! Your message has been sent. We\'ll get back to you soon.';
        status.className = 'form-status form-status--success';
        form.reset();
        // Reset Turnstile widget if present
        if (typeof turnstile !== 'undefined') {
          turnstile.reset();
        }
      } else if (res.status === 429) {
        status.textContent = result?.error || 'Too many requests. Please try again later or call us at (817) 431-9199.';
        status.className = 'form-status form-status--error';
      } else {
        status.textContent = result?.error || 'Something went wrong. Please call us at (817) 431-9199 or try again later.';
        status.className = 'form-status form-status--error';
      }
    } catch (err) {
      status.textContent = 'Something went wrong. Please call us at (817) 431-9199 or try again later.';
      status.className = 'form-status form-status--error';
    }

    status.style.display = '';
    btn.textContent = originalText;
    btn.disabled = false;
  });
});
