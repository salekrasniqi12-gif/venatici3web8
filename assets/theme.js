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
      window.addEventListener('scroll', this.onScroll.bind(this), { passive: true });
      this.onScroll();
    },

    onScroll() {
      if (window.scrollY > this.threshold) {
        this.el.classList.add('site-header--scrolled');
      } else {
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

  // ── Hero Ken Burns ───────────────────────────────────────────
  const Hero = {
    init() {
      const hero = document.querySelector('.hero');
      if (!hero) return;
      requestAnimationFrame(() => hero.classList.add('hero--loaded'));
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
  });

})();
