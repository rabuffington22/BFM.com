// Inject shared header and footer partials
(async function loadPartials() {
  const header = document.getElementById('header-placeholder');
  const footer = document.getElementById('footer-placeholder');

  if (header) {
    try {
      const res = await fetch('/partials/header.html');
      header.innerHTML = await res.text();
      initNav();
      setActiveLink();
    } catch (e) {
      console.warn('Header partial failed to load:', e);
    }
  }

  if (footer) {
    try {
      const res = await fetch('/partials/footer.html');
      footer.innerHTML = await res.text();
    } catch (e) {
      console.warn('Footer partial failed to load:', e);
    }
  }
})();

function initNav() {
  const nav = document.getElementById('nav');
  const toggle = document.getElementById('nav-toggle');
  const mobile = document.getElementById('nav-mobile');

  // Scroll behavior - add solid bg
  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  }, { passive: true });

  // Trigger once on load
  if (window.scrollY > 20) nav.classList.add('scrolled');

  // Mobile toggle
  if (toggle && mobile) {
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('active');
      mobile.classList.toggle('open');
      document.body.style.overflow = mobile.classList.contains('open') ? 'hidden' : '';
    });

    // Close on link click
    mobile.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        toggle.classList.remove('active');
        mobile.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }
}

function setActiveLink() {
  const path = window.location.pathname;
  document.querySelectorAll('.nav__links a:not(.nav__cta):not(.nav__phone)').forEach(link => {
    const href = link.getAttribute('href');
    if (path === href || (href !== '/' && path.startsWith(href))) {
      link.classList.add('active');
    }
  });
}
