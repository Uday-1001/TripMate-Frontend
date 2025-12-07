// Open Modal
function openModal() {
  document.getElementById("authModal").classList.add("active");
  document.body.style.overflow = "hidden";
}

// Close Modal
function closeModal() {
  document.getElementById("authModal").classList.remove("active");
  document.body.style.overflow = "auto";
}

// Close modal when clicking outside
document.getElementById("authModal").addEventListener("click", function (e) {
  if (e.target === this) {
    closeModal();
  }
});

// Switch between Login and Sign Up tabs
function switchTab(tab) {
  const tabBtns = document.querySelectorAll(".tab-btn");
  const forms = document.querySelectorAll(".form-content");

  tabBtns.forEach((btn) => btn.classList.remove("active"));
  forms.forEach((form) => form.classList.remove("active"));

  if (tab === "login") {
    tabBtns[0].classList.add("active");
    document.getElementById("loginForm").classList.add("active");
  } else {
    tabBtns[1].classList.add("active");
    document.getElementById("signupForm").classList.add("active");
  }
}

// Handle Login
function handleLogin(event) {
  event.preventDefault();

  // Get form values
  const email = event.target.querySelector('input[type="email"]').value;
  const password = event.target.querySelector('input[type="password"]').value;

  // Basic validation
  if (!email || !password) {
    alert("Please fill in all fields!");
    return;
  }

  // Direct redirect to main page
  window.location.href = "homepage.html";
}

// Handle Sign Up
function handleSignup(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  console.log("Sign up submitted");

  // Validate passwords match
  const password = event.target.querySelector('input[type="password"]').value;
  const confirmPassword = event.target.querySelectorAll(
    'input[type="password"]'
  )[1].value;

  if (password !== confirmPassword) {
    alert("Passwords do not match!");
    return;
  }

  // Simulate successful signup
  alert("Account created successfully! Welcome to TripMate!");
  closeModal();

  window.location.href = "homepage.html";
}

// Handle Social Login
function socialLogin(platform) {
  console.log(`Logging in with ${platform}`);
  alert(
    `${platform.charAt(0).toUpperCase() + platform.slice(1)} login coming soon!`
  );
}

// Fade-in animation on scroll
const observerOptions = {
  threshold: 0.1,
  rootMargin: "0px 0px -100px 0px",
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
    }
  });
}, observerOptions);

document.querySelectorAll(".fade-in").forEach((el) => {
  observer.observe(el);
});

// Animated counter for stats
const animateCounter = (element, target) => {
  let current = 0;
  const increment = target / 100;
  const duration = 2000;
  const stepTime = duration / 100;

  const timer = setInterval(() => {
    current += increment;
    if (current >= target) {
      element.textContent = target.toLocaleString();
      clearInterval(timer);
    } else {
      element.textContent = Math.floor(current).toLocaleString();
    }
  }, stepTime);
};

// Observe stats section for counter animation
const statsObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const counters = entry.target.querySelectorAll(
          ".stat-number[data-target]"
        );
        counters.forEach((counter) => {
          const target = parseInt(counter.getAttribute("data-target"));
          animateCounter(counter, target);
        });
        statsObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.5 }
);

const statsSection = document.querySelector(".stats-section");
if (statsSection) {
  statsObserver.observe(statsSection);
}

// Smooth scroll for all anchor links
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute("href"));
    if (target) {
      target.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  });
});

// Parallax effect for testimonials background
window.addEventListener("scroll", () => {
  const testimonialsBg = document.querySelector(".testimonials-bg");
  if (testimonialsBg) {
    const scrolled = window.pageYOffset;
    const rate = scrolled * 0.3;
    testimonialsBg.style.transform = `translateY(${rate}px)`;
  }
});

// Add hover sound effect (optional - remove if not needed)
document
  .querySelectorAll(".step-card, .experience-card, .stat-item")
  .forEach((card) => {
    card.addEventListener("mouseenter", () => {
      card.style.transition =
        "all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
    });
  });

// CTA button pulse effect
const ctaButtons = document.querySelectorAll(".cta-button, .btn-primary");
ctaButtons.forEach((btn) => {
  setInterval(() => {
    btn.style.animation = "none";
    setTimeout(() => {
      btn.style.animation = "";
    }, 10);
  }, 3000);
});
