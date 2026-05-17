/* ============================================================
   VENATICI – THEME JAVASCRIPT
   ============================================================ */

(function () {
  'use strict';

  // ── Header ──────────────────────────────────────────────────
  const Header = {
    el: null,
    threshold: 80,

    init() {
      this.el = document.querySelector('.site-header');
      if (!this.el) return;
      this.el.classList.add('site-header--expanded');
      window.addEventListener('scroll', this.onScroll.bind(this), { passive: true });
      this.onScroll();
    },

    onScroll() {
      if (window.scrollY > this.threshold) {
        this.el.classList.remove('site-header--expanded');
        this.el.classList.add('site-header--scrolled');
      } else {
        this.el.classList.add('site-header--expanded');
        this.el.classList.remove('site-header--scrolled');
      }
    }
  };

  // ── Cart Drawer ──────────────────────────────────────────────
  const CartDrawer = {
    drawer: null,
    isOpen: false,

    init() {
      this.drawer = document.querySelector('.cart-drawer');
      if (!this.drawer) return;

      document.querySelectorAll('.js-cart-open').forEach(btn => {
        btn.addEventListener('click', () => this.open());
      });

      const overlay = this.drawer.querySelector('.cart-drawer__overlay');
      if (overlay) overlay.addEventListener('click', () => this.close());

      const closeBtn = this.drawer.querySelector('.cart-drawer__close');
      if (closeBtn) closeBtn.addEventListener('click', () => this.close());

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen) this.close();
      });
    },

    open() {
      this.isOpen = true;
      this.drawer.classList.add('cart-drawer--open');
      document.body.classList.add('body-cart-open');
      CartAPI.renderDrawer();
    },

    close() {
      this.isOpen = false;
      this.drawer.classList.remove('cart-drawer--open');
      document.body.classList.remove('body-cart-open');
    }
  };

  // ── Cart API ─────────────────────────────────────────────────
  const CartAPI = {
    async addItem(variantId, quantity) {
      const res = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: variantId, quantity: quantity })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.description || 'Could not add item to cart.');
      }

      return res.json();
    },

    async getCart() {
      const res = await fetch('/cart.js');
      return res.json();
    },

    async removeItem(key) {
      const res = await fetch('/cart/change.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: key, quantity: 0 })
      });
      return res.json();
    },

    formatMoney(cents) {
      return (cents / 100).toLocaleString('de-DE', {
        style: 'currency',
        currency: 'EUR'
      });
    },

    async renderDrawer() {
      const body = document.querySelector('.cart-drawer__body');
      const subtotalEl = document.querySelector('.cart-drawer__subtotal-price');
      const countEls = document.querySelectorAll('.cart-count');

      if (!body) return;

      const cart = await this.getCart();

      // Update cart count badge
      countEls.forEach(el => {
        el.textContent = cart.item_count;
        el.dataset.count = cart.item_count;
      });

      if (cart.item_count === 0) {
        body.innerHTML = '<p class="cart-drawer__empty">Your cart is empty.</p>';
        if (subtotalEl) subtotalEl.textContent = this.formatMoney(0);
        return;
      }

      if (subtotalEl) {
        subtotalEl.textContent = this.formatMoney(cart.total_price);
      }

      body.innerHTML = cart.items.map(item => `
        <div class="cart-item">
          ${item.image
            ? `<img class="cart-item__image" src="${item.image}" alt="${item.product_title}" width="80" height="80">`
            : `<div class="cart-item__image"></div>`
          }
          <div class="cart-item__details">
            <div class="cart-item__title">${item.product_title}</div>
            ${item.variant_title && item.variant_title !== 'Default Title'
              ? `<div class="cart-item__variant">${item.variant_title}</div>`
              : ''
            }
            <div class="cart-item__price">${this.formatMoney(item.final_line_price)}</div>
            <button
              class="cart-item__remove js-cart-remove"
              data-key="${item.key}"
              aria-label="Remove ${item.product_title}"
            >Remove</button>
          </div>
        </div>
      `).join('');

      // Bind remove buttons
      body.querySelectorAll('.js-cart-remove').forEach(btn => {
        btn.addEventListener('click', async () => {
          await CartAPI.removeItem(btn.dataset.key);
          CartAPI.renderDrawer();
        });
      });
    }
  };

  // ── Add to Cart ──────────────────────────────────────────────
  const ATC = {
    init() {
      document.querySelectorAll('[data-atc-form]').forEach(form => {
        form.addEventListener('submit', (e) => this.handleSubmit(e, form));
      });
    },

    async handleSubmit(e, form) {
      e.preventDefault();

      const btn = form.querySelector('[data-atc-btn]');
      const errorEl = form.querySelector('.atc-error');
      const variantInput = form.querySelector('[name="id"]');
      const qtyInput = form.querySelector('[name="quantity"]');

      if (!variantInput) return;

      const variantId = parseInt(variantInput.value, 10);
      const quantity = qtyInput ? parseInt(qtyInput.value, 10) || 1 : 1;

      if (errorEl) errorEl.textContent = '';

      if (btn) {
        btn.setAttribute('aria-disabled', 'true');
        btn.dataset.originalText = btn.textContent;
        btn.textContent = 'Adding…';
      }

      try {
        await CartAPI.addItem(variantId, quantity);
        CartDrawer.open();
      } catch (err) {
        if (errorEl) errorEl.textContent = err.message;
      } finally {
        if (btn) {
          btn.removeAttribute('aria-disabled');
          btn.textContent = btn.dataset.originalText || 'Add to Cart';
        }
      }
    }
  };

  // ── Variant Selector ─────────────────────────────────────────
  const VariantSelector = {
    init() {
      document.querySelectorAll('.variant-select').forEach(select => {
        select.addEventListener('change', () => this.onChange(select));
      });
    },

    onChange(select) {
      const form = select.closest('form');
      if (!form) return;

      const option = select.options[select.selectedIndex];
      const variantId = option.dataset.variantId;
      const price = option.dataset.price;
      const available = option.dataset.available !== 'false';

      const hiddenInput = form.querySelector('[name="id"]');
      if (hiddenInput && variantId) hiddenInput.value = variantId;

      const priceEl = form.closest('[data-product-section]')?.querySelector('.featured-product__price');
      if (priceEl && price) {
        priceEl.textContent = CartAPI.formatMoney(parseInt(price, 10));
      }

      const atcBtn = form.querySelector('[data-atc-btn]');
      if (atcBtn) {
        if (!available) {
          atcBtn.setAttribute('aria-disabled', 'true');
          atcBtn.textContent = 'Sold Out';
        } else {
          atcBtn.removeAttribute('aria-disabled');
          atcBtn.textContent = atcBtn.dataset.originalText || 'Add to Cart';
        }
      }
    }
  };

  // ── Qty Input ────────────────────────────────────────────────
  const QtyInput = {
    init() {
      document.querySelectorAll('.qty-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const input = btn.closest('.qty-wrap')?.querySelector('.qty-input');
          if (!input) return;
          const current = parseInt(input.value, 10) || 1;
          const delta = btn.dataset.action === 'increase' ? 1 : -1;
          const next = Math.max(1, current + delta);
          input.value = next;
        });
      });
    }
  };

  // ── Scroll Animations ────────────────────────────────────────
  const ScrollAnimations = {
    init() {
      const els = document.querySelectorAll('.fade-in-up');
      if (!els.length) return;

      if (!('IntersectionObserver' in window)) {
        els.forEach(el => el.classList.add('is-visible'));
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
      );

      els.forEach(el => observer.observe(el));
    }
  };

  // ── Smooth Scroll ────────────────────────────────────────────
  const SmoothScroll = {
    init() {
      document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', (e) => {
          const targetId = link.getAttribute('href').slice(1);
          const target = document.getElementById(targetId);
          if (!target) return;
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
    }
  };

  // ── Hero Ken Burns + Video Autoplay ─────────────────────────
  const Hero = {
    init() {
      const hero = document.querySelector('.hero');
      if (!hero) return;
      requestAnimationFrame(() => hero.classList.add('hero--loaded'));

      // Force autoplay on all hero videos — suppresses browser play button
      hero.querySelectorAll('video').forEach(video => {
        video.muted = true;
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        video.removeAttribute('controls');

        const tryPlay = () => {
          const p = video.play();
          if (p !== undefined) p.catch(() => {});
        };

        if (video.readyState >= 2) {
          tryPlay();
        } else {
          video.addEventListener('canplay', tryPlay, { once: true });
        }

        // Retry on first user interaction if blocked
        const onInteract = () => {
          tryPlay();
          document.removeEventListener('touchstart', onInteract);
          document.removeEventListener('click', onInteract);
        };
        document.addEventListener('touchstart', onInteract, { once: true, passive: true });
        document.addEventListener('click', onInteract, { once: true });
      });
    }
  };

  // ── Testimonial Slider ───────────────────────────────────────
  const TestimonialSlider = {
    init() {
      const slider = document.querySelector('[data-testimonial-slider]');
      if (!slider) return;

      const track = slider.querySelector('[data-testimonial-track]');
      const dotsContainer = slider.querySelector('[data-testimonial-dots]');
      const slides = track.querySelectorAll('.testimonial');
      const total = slides.length;
      let current = 0;
      let startX = 0;
      let isDragging = false;

      if (total <= 1) return;

      // build dots
      slides.forEach((_, i) => {
        const dot = document.createElement('button');
        dot.className = 'testimonials__dot' + (i === 0 ? ' testimonials__dot--active' : '');
        dot.setAttribute('aria-label', `Bewertung ${i + 1}`);
        dot.addEventListener('click', () => goTo(i));
        dotsContainer.appendChild(dot);
      });

      function goTo(index) {
        current = (index + total) % total;
        track.style.transform = `translateX(-${current * 100}%)`;
        dotsContainer.querySelectorAll('.testimonials__dot').forEach((d, i) => {
          d.classList.toggle('testimonials__dot--active', i === current);
        });
      }

      slider.querySelector('[data-testimonial-prev]').addEventListener('click', () => goTo(current - 1));
      slider.querySelector('[data-testimonial-next]').addEventListener('click', () => goTo(current + 1));

      // touch/swipe
      track.addEventListener('touchstart', e => { startX = e.touches[0].clientX; isDragging = true; }, { passive: true });
      track.addEventListener('touchend', e => {
        if (!isDragging) return;
        const diff = startX - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) goTo(diff > 0 ? current + 1 : current - 1);
        isDragging = false;
      });

      // auto-advance
      setInterval(() => goTo(current + 1), 6000);
    }
  };

  // ── Parallax ─────────────────────────────────────────────────
  const Parallax = {
    items: [],

    init() {
      const heroContent = document.querySelector('.hero__content');
      const productImg  = document.querySelector('.featured-product__image-wrap');
      const storyInner  = document.querySelector('.fragrance-story__inner');

      if (heroContent) this.items.push({ el: heroContent, speed: 0.25, dir: 'up' });
      if (productImg)  this.items.push({ el: productImg,  speed: 0.08, dir: 'down' });
      if (storyInner)  this.items.push({ el: storyInner,  speed: 0.1,  dir: 'up' });

      if (!this.items.length) return;
      window.addEventListener('scroll', this.onScroll.bind(this), { passive: true });
      this.onScroll();
    },

    onScroll() {
      const sy = window.scrollY;
      this.items.forEach(({ el, speed, dir }) => {
        const rect   = el.parentElement.getBoundingClientRect();
        const center = rect.top + rect.height / 2 - window.innerHeight / 2;
        const offset = center * speed * (dir === 'up' ? -1 : 1);
        el.style.transform = `translateY(${offset}px)`;
      });
    }
  };

  // ── Stats Counter ────────────────────────────────────────────
  const StatsCounter = {
    init() {
      const numbers = document.querySelectorAll('.product-stats__number');
      if (!numbers.length) return;

      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          this.animate(entry.target);
        });
      }, { threshold: 0.5 });

      numbers.forEach(n => observer.observe(n));
    },

    animate(el) {
      const text  = el.textContent.trim();
      if (text.includes('–') || text.includes('-')) return;
      const match = text.match(/[\d]+/);
      if (!match) return;

      const target  = parseInt(match[0]);
      const prefix  = text.slice(0, match.index);
      const suffix  = text.slice(match.index + match[0].length);
      const duration = 1400;
      const start    = performance.now();

      const unit = el.querySelector('.product-stats__unit');
      const unitHTML = unit ? unit.outerHTML : '';
      const unitText = unit ? unit.textContent : '';

      const tick = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(ease * target);
        el.innerHTML = prefix + current + unitHTML;
        if (progress < 1) requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    }
  };

  // ── Scroll Velocity Tilt ─────────────────────────────────────
  const ScrollTilt = {
    lastY: 0,
    cards: [],

    init() {
      this.cards = [...document.querySelectorAll('.akte-card')];
      if (!this.cards.length) return;
      window.addEventListener('scroll', this.onScroll.bind(this), { passive: true });
    },

    onScroll() {
      const delta = window.scrollY - this.lastY;
      this.lastY  = window.scrollY;
      const tilt  = Math.max(-4, Math.min(4, delta * 0.3));
      this.cards.forEach((card, i) => {
        const dir = i % 2 === 0 ? 1 : -1;
        card.style.transform = `translateY(${tilt * dir}px)`;
        card.style.transition = 'transform 0.6s cubic-bezier(0.25,0.46,0.45,0.94)';
      });
    }
  };

  // ── Bundle Picker ────────────────────────────────────────────
  const BundlePicker = {
    init() {
      const picker = document.querySelector('.bundle-picker');
      if (!picker) return;

      const options  = picker.querySelectorAll('.bundle-option');
      const varInput = document.querySelector('[data-variant-input]');
      const priceEl  = document.querySelector('.product-main__price');

      options.forEach(opt => {
        opt.addEventListener('click', () => {
          options.forEach(o => o.classList.remove('bundle-option--active'));
          opt.classList.add('bundle-option--active');

          if (varInput) varInput.value = opt.dataset.variantId;
          if (priceEl && opt.dataset.price) {
            priceEl.textContent = CartAPI.formatMoney(parseInt(opt.dataset.price, 10));
          }
        });
      });
    }
  };

  // ── Product Gallery Slider ───────────────────────────────────
  const ProductGallery = {
    current: 0,
    total: 3,

    init() {
      const slider = document.querySelector('[data-product-slider]');
      if (!slider) return;

      const track     = slider.querySelector('[data-slider-track]');
      const prevBtn   = slider.querySelector('[data-slider-prev]');
      const nextBtn   = slider.querySelector('[data-slider-next]');
      const dots      = slider.querySelectorAll('[data-dot]');
      const thumbs    = document.querySelectorAll('[data-thumb]');

      this.total = slider.querySelectorAll('.product-main__slide').length;

      const goTo = (index) => {
        this.current = (index + this.total) % this.total;
        track.style.transform = `translateX(-${this.current * 100}%)`;

        dots.forEach((d, i) => d.classList.toggle('product-main__slider-dot--active', i === this.current));
        thumbs.forEach((t, i) => t.classList.toggle('product-main__thumb--active', i === this.current));
      };

      if (prevBtn) prevBtn.addEventListener('click', () => goTo(this.current - 1));
      if (nextBtn) nextBtn.addEventListener('click', () => goTo(this.current + 1));

      dots.forEach(dot => {
        dot.addEventListener('click', () => goTo(parseInt(dot.dataset.dot, 10)));
      });

      thumbs.forEach(thumb => {
        thumb.addEventListener('click', () => goTo(parseInt(thumb.dataset.thumb, 10)));
      });

      // Touch / swipe
      let startX = 0;
      let startY = 0;
      let dragging = false;

      track.addEventListener('touchstart', e => {
        startX   = e.touches[0].clientX;
        startY   = e.touches[0].clientY;
        dragging = true;
      }, { passive: true });

      track.addEventListener('touchmove', e => {
        if (!dragging) return;
        const dx = Math.abs(e.touches[0].clientX - startX);
        const dy = Math.abs(e.touches[0].clientY - startY);
        if (dx > dy) e.preventDefault();
      }, { passive: false });

      track.addEventListener('touchend', e => {
        if (!dragging) return;
        const diff = startX - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 40) goTo(diff > 0 ? this.current + 1 : this.current - 1);
        dragging = false;
      });

      // Mouse drag (desktop)
      let mouseStartX = 0;
      let mouseDragging = false;

      track.addEventListener('mousedown', e => {
        mouseStartX   = e.clientX;
        mouseDragging = true;
        track.style.cursor = 'grabbing';
      });
      track.addEventListener('mouseup', e => {
        if (!mouseDragging) return;
        mouseDragging = false;
        track.style.cursor = 'grab';
        const diff = mouseStartX - e.clientX;
        if (Math.abs(diff) > 50) goTo(diff > 0 ? this.current + 1 : this.current - 1);
      });
      track.addEventListener('mouseleave', () => {
        mouseDragging = false;
        track.style.cursor = 'grab';
      });
    }
  };

  // ── Sticky ATC ───────────────────────────────────────────────
  const StickyATC = {
    init() {
      const stickyEl  = document.getElementById('product-sticky-atc');
      const mainBtn   = document.querySelector('.product-main__atc-btn');
      const stickyBtn = document.querySelector('.js-sticky-atc-trigger');

      if (!stickyEl || !mainBtn) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          stickyEl.classList.toggle('product-sticky-atc--visible', !entry.isIntersecting);
          stickyEl.setAttribute('aria-hidden', String(entry.isIntersecting));
        },
        { threshold: 0 }
      );

      observer.observe(mainBtn);

      if (stickyBtn) {
        stickyBtn.addEventListener('click', () => {
          const form = mainBtn.closest('form');
          if (form) form.requestSubmit ? form.requestSubmit() : form.submit();
        });
      }
    }
  };

  // ── Accordion ────────────────────────────────────────────────
  const Accordion = {
    init() {
      document.querySelectorAll('.product-main__accordion-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const expanded = btn.getAttribute('aria-expanded') === 'true';
          btn.setAttribute('aria-expanded', String(!expanded));
          btn.querySelector('.product-main__accordion-chevron').textContent = expanded ? '+' : '−';
          const body = btn.nextElementSibling;
          if (body) body.style.display = expanded ? 'none' : 'block';
        });
      });
    }
  };

  // ── Init ─────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    Header.init();
    CartDrawer.init();
    ATC.init();
    VariantSelector.init();
    QtyInput.init();
    ScrollAnimations.init();
    SmoothScroll.init();
    Hero.init();
    CartAPI.renderDrawer();
    TestimonialSlider.init();
    Parallax.init();
    StatsCounter.init();
    ScrollTilt.init();
    ProductGallery.init();
    StickyATC.init();
    Accordion.init();
    BundlePicker.init();
  });

})();
