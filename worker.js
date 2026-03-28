// Paths that should never be served as static assets
const BLOCKED_PATHS = [
  '/wrangler.toml',
  '/worker.js',
  '/.gitignore',
  '/_headers',
  '/_redirects',
  '/_preview-icon-gradient.html',
];

// Security headers applied to all responses
const SECURITY_HEADERS = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-src https://www.google.com https://challenges.cloudflare.com; connect-src 'self'; font-src 'self' https://fonts.gstatic.com; base-uri 'self'; form-action 'self'",
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

// Simple in-memory rate limiter (resets on worker restart)
const rateLimitMap = new Map();
const RATE_LIMIT_MAX = 5;       // max submissions
const RATE_LIMIT_WINDOW = 3600; // per hour (seconds)

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now - entry.start > RATE_LIMIT_WINDOW * 1000) {
    rateLimitMap.set(ip, { start: now, count: 1 });
    return false;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return true;
  }
  return false;
}

// Periodically clean up stale entries to prevent memory growth
function cleanupRateLimit() {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now - entry.start > RATE_LIMIT_WINDOW * 1000) {
      rateLimitMap.delete(ip);
    }
  }
}

function addSecurityHeaders(response) {
  const newResponse = new Response(response.body, response);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    newResponse.headers.set(key, value);
  }
  return newResponse;
}

const ALLOWED_ORIGINS = [
  'https://buffingtonfamilymedicine.com',
  'https://www.buffingtonfamilymedicine.com',
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Block access to config/server files and hidden directories
    if (BLOCKED_PATHS.includes(url.pathname) ||
        url.pathname.startsWith('/.git') ||
        url.pathname.startsWith('/.wrangler') ||
        url.pathname.startsWith('/.claude') ||
        url.pathname.startsWith('/.env') ||
        url.pathname.startsWith('/.assetsignore')) {
      return addSecurityHeaders(new Response('Not Found', { status: 404 }));
    }

    // Handle contact form
    if (url.pathname === '/functions/contact' && request.method === 'POST') {
      const response = await handleContact(request, env);
      return addSecurityHeaders(response);
    }

    // Serve static assets with security headers
    const response = await env.ASSETS.fetch(request);
    return addSecurityHeaders(response);
  }
};

async function handleContact(request, env) {
  try {
    // CSRF: Validate Origin header
    const origin = request.headers.get('Origin');
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      // Also allow localhost for development
      if (!origin.startsWith('http://localhost') && !origin.startsWith('http://127.0.0.1')) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Rate limiting by IP
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (isRateLimited(ip)) {
      return Response.json(
        { error: 'Too many requests. Please try again later or call us at (817) 431-9199.' },
        { status: 429 }
      );
    }

    // Periodically clean up rate limit map
    if (rateLimitMap.size > 1000) {
      cleanupRateLimit();
    }

    const body = await request.json();
    const { name, email, phone, message } = body;

    // Honeypot check - if filled, it's a bot. Return fake success.
    if (body.website) {
      return Response.json({ success: true });
    }

    // Validate required fields
    if (!name || !email || !message) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Input length limits
    if (name.length > 100) {
      return Response.json({ error: 'Name is too long (max 100 characters)' }, { status: 400 });
    }
    if (email.length > 254) {
      return Response.json({ error: 'Email is too long' }, { status: 400 });
    }
    if (phone && phone.length > 30) {
      return Response.json({ error: 'Phone number is too long' }, { status: 400 });
    }
    if (message.length > 5000) {
      return Response.json({ error: 'Message is too long (max 5000 characters)' }, { status: 400 });
    }

    // Email format validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: 'Invalid email address' }, { status: 400 });
    }

    // Turnstile CAPTCHA verification (if configured)
    const turnstileToken = body['cf-turnstile-response'];
    if (env.TURNSTILE_SECRET) {
      if (!turnstileToken) {
        return Response.json({ error: 'Please complete the CAPTCHA verification' }, { status: 400 });
      }

      const turnstileResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: env.TURNSTILE_SECRET,
          response: turnstileToken,
          remoteip: ip,
        }),
      });

      const turnstileResult = await turnstileResponse.json();
      if (!turnstileResult.success) {
        return Response.json({ error: 'CAPTCHA verification failed. Please try again.' }, { status: 400 });
      }
    }

    // Sanitize name for use in email subject (strip newlines)
    const safeName = name.replace(/[\r\n]/g, '').trim();
    const safePhone = phone ? phone.replace(/[\r\n]/g, '').trim() : '';

    // Send email via MailChannels
    const emailResponse = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [
          { to: [{ email: 'info@buffingtonfamilymedicine.com', name: 'Buffington Family Medicine' }] },
        ],
        from: { email: 'noreply@buffingtonfamilymedicine.com', name: 'BFM Website Contact Form' },
        reply_to: { email, name: safeName },
        subject: `New Contact Form Submission from ${safeName}`,
        content: [
          {
            type: 'text/plain',
            value: `New contact form submission:\n\nName: ${safeName}\nEmail: ${email}\nPhone: ${safePhone || 'Not provided'}\n\nMessage:\n${message}`,
          },
          {
            type: 'text/html',
            value: `
              <h2>New Contact Form Submission</h2>
              <table style="border-collapse:collapse;width:100%;max-width:600px;">
                <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Name</td><td style="padding:8px;border-bottom:1px solid #eee;">${esc(safeName)}</td></tr>
                <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Email</td><td style="padding:8px;border-bottom:1px solid #eee;"><a href="mailto:${esc(email)}">${esc(email)}</a></td></tr>
                <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Phone</td><td style="padding:8px;border-bottom:1px solid #eee;">${esc(safePhone || 'Not provided')}</td></tr>
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
