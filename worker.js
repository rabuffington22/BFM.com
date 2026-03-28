export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/functions/contact' && request.method === 'POST') {
      return handleContact(request);
    }

    return env.ASSETS.fetch(request);
  }
};

async function handleContact(request) {
  try {
    const body = await request.json();
    const { name, email, phone, message } = body;

    if (!name || !email || !message) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const emailResponse = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [
          { to: [{ email: 'info@buffingtonfamilymedicine.com', name: 'Buffington Family Medicine' }] },
        ],
        from: { email: 'noreply@buffingtonfamilymedicine.com', name: 'BFM Website Contact Form' },
        reply_to: { email, name },
        subject: `New Contact Form Submission from ${name}`,
        content: [
          {
            type: 'text/plain',
            value: `New contact form submission:\n\nName: ${name}\nEmail: ${email}\nPhone: ${phone || 'Not provided'}\n\nMessage:\n${message}`,
          },
          {
            type: 'text/html',
            value: `
              <h2>New Contact Form Submission</h2>
              <table style="border-collapse:collapse;width:100%;max-width:600px;">
                <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Name</td><td style="padding:8px;border-bottom:1px solid #eee;">${esc(name)}</td></tr>
                <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Email</td><td style="padding:8px;border-bottom:1px solid #eee;"><a href="mailto:${esc(email)}">${esc(email)}</a></td></tr>
                <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Phone</td><td style="padding:8px;border-bottom:1px solid #eee;">${esc(phone || 'Not provided')}</td></tr>
              </table>
              <h3 style="margin-top:20px;">Message</h3>
              <p style="white-space:pre-wrap;">${esc(message)}</p>
            `,
          },
        ],
      }),
    });

    if (emailResponse.ok || emailResponse.status === 202) {
      return Response.json({ success: true });
    } else {
      console.error('MailChannels error:', await emailResponse.text());
      return Response.json({ error: 'Failed to send email' }, { status: 500 });
    }
  } catch (err) {
    console.error('Contact form error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
