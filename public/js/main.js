document.addEventListener('DOMContentLoaded', function() {
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('navLinks');
    if (hamburger && navLinks) {
      hamburger.onclick = () => navLinks.classList.toggle('open');
      navLinks.querySelectorAll('a').forEach(link => {
        link.onclick = () => navLinks.classList.remove('open');
      });
    }
  });