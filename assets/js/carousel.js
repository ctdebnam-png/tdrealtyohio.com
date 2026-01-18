/* FILE: /assets/js/carousel.js */
(() => {
  "use strict";

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function initCarousel(root) {
    const track = root.querySelector("[data-carousel-track]");
    const slides = Array.from(root.querySelectorAll("[data-carousel-slide]"));
    const prevBtn = root.querySelector("[data-carousel-prev]");
    const nextBtn = root.querySelector("[data-carousel-next]");
    const dotsWrap = root.querySelector("[data-carousel-dots]");

    if (!track || slides.length === 0) return;

    let index = 0;
    let timer = null;
    const intervalMs = Number(root.getAttribute("data-interval-ms") || 6500);

    function renderDots() {
      if (!dotsWrap) return;
      dotsWrap.innerHTML = "";
      slides.forEach((_, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "td-carousel-dot";
        b.setAttribute("aria-label", `Go to slide ${i + 1}`);
        b.setAttribute("aria-pressed", i === index ? "true" : "false");
        b.addEventListener("click", () => goTo(i, true));
        dotsWrap.appendChild(b);
      });
    }

    function updateAria() {
      slides.forEach((s, i) => {
        s.classList.toggle("is-active", i === index);
        s.setAttribute("aria-hidden", i === index ? "false" : "true");
      });
      if (dotsWrap) {
        Array.from(dotsWrap.querySelectorAll("button")).forEach((b, i) => {
          b.setAttribute("aria-pressed", i === index ? "true" : "false");
        });
      }
    }

    function goTo(i, userAction) {
      index = (i + slides.length) % slides.length;
      track.style.transform = `translateX(${-index * 100}%)`;
      updateAria();
      if (userAction) restart();
    }

    function next(userAction) { goTo(index + 1, userAction); }
    function prev(userAction) { goTo(index - 1, userAction); }

    function stop() {
      if (timer) window.clearInterval(timer);
      timer = null;
    }

    function start() {
      if (prefersReducedMotion()) return;
      stop();
      timer = window.setInterval(() => next(false), intervalMs);
    }

    function restart() {
      stop();
      start();
    }

    function onKeyDown(e) {
      if (e.key === "ArrowLeft") prev(true);
      if (e.key === "ArrowRight") next(true);
    }

    renderDots();
    goTo(0, false);

    if (prevBtn) prevBtn.addEventListener("click", () => prev(true));
    if (nextBtn) nextBtn.addEventListener("click", () => next(true));

    root.addEventListener("mouseenter", stop);
    root.addEventListener("mouseleave", start);
    root.addEventListener("focusin", stop);
    root.addEventListener("focusout", start);
    root.addEventListener("keydown", onKeyDown);

    start();
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-carousel='hero']").forEach(initCarousel);
  });
})();
