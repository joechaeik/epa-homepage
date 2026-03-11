// ─── Navbar scroll behavior ───
const navbar = document.getElementById('navbar');
const heroSection = document.querySelector('.hero-bg, .page-hero');

function updateNavbar() {
  if (!navbar) return;
  const scrolled = window.scrollY > 50;
  if (scrolled) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
}

window.addEventListener('scroll', updateNavbar);
updateNavbar();

// ─── Active nav link ───
const currentPath = window.location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.nav-link').forEach(link => {
  const href = link.getAttribute('href');
  if (href === currentPath || (currentPath === '' && href === 'index.html')) {
    link.classList.add('active');
  }
});

// ─── Mobile menu ───
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');
const mobileMenuClose = document.getElementById('mobile-menu-close');

if (mobileMenuBtn) {
  mobileMenuBtn.addEventListener('click', () => mobileMenu.classList.add('open'));
}
if (mobileMenuClose) {
  mobileMenuClose.addEventListener('click', () => mobileMenu.classList.remove('open'));
}
if (mobileMenu) {
  mobileMenu.querySelectorAll('.nav-link').forEach(l => {
    l.addEventListener('click', () => mobileMenu.classList.remove('open'));
  });
}

// ─── Scroll reveal ───
const observer = new IntersectionObserver(
  entries => entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      observer.unobserve(e.target);
    }
  }),
  { threshold: 0.1 }
);

document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// ─── Smooth scroll for anchor links ───
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});
