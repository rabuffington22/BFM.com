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

    const data = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      message: form.message.value.trim(),
    };

    // Basic validation
    if (!data.name || !data.email || !data.message) {
      status.textContent = 'Please fill in all required fields.';
      status.className = 'form-status form-status--error';
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

      if (res.ok) {
        status.textContent = 'Thank you! Your message has been sent. We\'ll get back to you soon.';
        status.className = 'form-status form-status--success';
        form.reset();
      } else {
        throw new Error('Server error');
      }
    } catch (err) {
      status.textContent = 'Something went wrong. Please call us at (817) 431-9199 or try again later.';
      status.className = 'form-status form-status--error';
    }

    btn.textContent = originalText;
    btn.disabled = false;
  });
});
