// Landing Page JavaScript

document.addEventListener('DOMContentLoaded', () => {
  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  // Navbar scroll effect
  const navbar = document.querySelector('.navbar');
  let lastScroll = 0;

  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;

    if (currentScroll > 100) {
      navbar.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.1)';
    } else {
      navbar.style.boxShadow = '0 1px 2px rgba(15, 23, 42, 0.05)';
    }

    lastScroll = currentScroll;
  });

  // Intersection Observer for animations
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, observerOptions);

  // Observe feature cards
  document.querySelectorAll('.feature-card').forEach(card => {
    observer.observe(card);
  });

  // Observe step items
  document.querySelectorAll('.step-item').forEach(step => {
    observer.observe(step);
  });

  // Counter animation for stats
  const animateCounter = (element, target, duration = 2000) => {
    const start = 0;
    const increment = target / (duration / 16);
    let current = start;

    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        element.textContent = formatNumber(target);
        clearInterval(timer);
      } else {
        element.textContent = formatNumber(Math.floor(current));
      }
    }, 16);
  };

  const formatNumber = (num) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K+';
    }
    return num.toString();
  };

  // Trigger counter animation when stats are in view
  const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !entry.target.classList.contains('animated')) {
        entry.target.classList.add('animated');
        const numbers = entry.target.querySelectorAll('.stat-number');
        
        // Animate each stat
        if (numbers[0]) numbers[0].textContent = '10K+';
        if (numbers[1]) numbers[1].textContent = '50K+';
        if (numbers[2]) numbers[2].textContent = '4.9★';
      }
    });
  }, { threshold: 0.5 });

  const heroStats = document.querySelector('.hero-stats');
  if (heroStats) {
    statsObserver.observe(heroStats);
  }

  // Add parallax effect to hero section
  window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const heroImage = document.querySelector('.hero-image');
    
    if (heroImage && scrolled < window.innerHeight) {
      heroImage.style.transform = `translateY(${scrolled * 0.3}px)`;
    }
  });

  // Feature card hover effect enhancement
  document.querySelectorAll('.feature-card').forEach(card => {
    card.addEventListener('mouseenter', function() {
      this.style.transform = 'translateY(-8px) scale(1.02)';
    });
    
    card.addEventListener('mouseleave', function() {
      this.style.transform = 'translateY(0) scale(1)';
    });
  });

  // Add ripple effect to buttons
  const createRipple = (event) => {
    const button = event.currentTarget;
    const ripple = document.createElement('span');
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;

    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    ripple.classList.add('ripple');

    button.appendChild(ripple);

    setTimeout(() => {
      ripple.remove();
    }, 600);
  };

  // Add ripple CSS dynamically
  const style = document.createElement('style');
  style.textContent = `
    .btn-primary, .btn-secondary, .btn-cta {
      position: relative;
      overflow: hidden;
    }
    
    .ripple {
      position: absolute;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.6);
      transform: scale(0);
      animation: ripple-animation 0.6s ease-out;
      pointer-events: none;
    }
    
    @keyframes ripple-animation {
      to {
        transform: scale(4);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);

  // Log page view (for analytics)
  console.log('🚀 RapidRide Landing Page Loaded');
  console.log('📊 Page view timestamp:', new Date().toISOString());

  // Check for URL parameters to pre-select role
  const urlParams = new URLSearchParams(window.location.search);
  const role = urlParams.get('role');
  
  if (role === 'rider' || role === 'driver') {
    console.log(`👤 User interested in ${role} role`);
  }

  // Easter egg - Konami code
  let konamiCode = [];
  const konamiSequence = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  
  document.addEventListener('keydown', (e) => {
    konamiCode.push(e.key);
    konamiCode = konamiCode.slice(-10);
    
    if (konamiCode.join(',') === konamiSequence.join(',')) {
      activateEasterEgg();
    }
  });

  const activateEasterEgg = () => {
    document.body.style.animation = 'rainbow 2s linear infinite';
    const style = document.createElement('style');
    style.textContent = `
      @keyframes rainbow {
        0% { filter: hue-rotate(0deg); }
        100% { filter: hue-rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
    
    setTimeout(() => {
      document.body.style.animation = '';
      style.remove();
    }, 5000);
    
    console.log('🎉 Easter egg activated!');
  };
});
