/* Carousel Maker – Instagram & LinkedIn carousel generator (vanilla JS, canvas) */
(function () {
  'use strict';
  const C = window.APP_CONFIG || {};
  const S = window.Studio;
  const $ = id => document.getElementById(id);

  // ---------- constants ----------
  const STATE_KEY = 'cm_state_v1', KITS_KEY = 'cm_kits_v1';
  const FREE_SLIDES = 5, MAX_SLIDES = 20, FREE_KITS = 1;
  const FORMATS = {
    '4:5': { w: 1080, h: 1350, label: '1080 × 1350' },
    '1:1': { w: 1080, h: 1080, label: '1080 × 1080' },
    '9:16': { w: 1080, h: 1920, label: '1080 × 1920' },
    'linkedin': { w: 1080, h: 1350, label: '1080 × 1350 · PDF' }
  };
  const FONTS = {
    system: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    georgia: 'Georgia, "Times New Roman", Times, serif',
    trebuchet: '"Trebuchet MS", "Lucida Grande", "Segoe UI", sans-serif',
    courier: '"Courier New", Courier, "Lucida Console", monospace',
    impact: '"Arial Black", "Helvetica Neue", Arial, system-ui, sans-serif',
    palatino: '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif'
  };

  const DEFAULT_TEXT = [
    '5 mistakes new freelancers make\n(and how to fix them before they cost you clients)',
    '1. Charging by the hour\nHourly rates punish you for being fast. Price the outcome, not the time: start with day rates or fixed project packages.',
    '2. Saying yes to everyone\nEvery bad-fit client eats the hours you need for a great one. Qualify before you quote: budget, timeline, decision maker.',
    '3. No contract, no deposit\nA one-page agreement and a 30–50% deposit filter out the clients who were never going to pay.',
    '4. Skipping the follow-up\nMost proposals die in silence, not in a "no". Follow up three times, 3–4 days apart. Polite persistence wins.',
    '5. Marketing only when you\'re empty\nPipeline work is a weekly habit, not an emergency. Block two hours every week for outreach and content.'
  ].join('\n\n');

  const DEFAULTS = {
    format: '4:5', template: 'bold', current: 0,
    theme: { bg: '#0f0f10', bg2: '#3b1d0a', gradient: false, text: '#fafafa', accent: '#f97316', font: 'auto', scale: 100, padding: 80, badge: true, arrow: true, dots: true },
    brand: { on: true, name: 'Alex Rivera', handle: '@alexfreelances', avatar: null },
    cta: { on: true, text: 'Follow for more', sub: 'Save this post for the next time you quote a project.' },
    scale2x: false,
    slides: null
  };

  // ---------- state ----------
  let state = loadState();
  const imgCache = new Map();  // dataURL -> HTMLImageElement
  let thumbsDirty = true;

  function parseText(text) {
    return String(text || '').split(/\n[ \t]*\n/).map(b => b.replace(/^\s+|\s+$/g, '')).filter(Boolean).map(b => {
      const lines = b.split('\n');
      return { title: lines[0].trim(), body: lines.slice(1).join('\n').trim() };
    });
  }
  function slidesToText(slides) { return slides.map(s => s.title + (s.body ? '\n' + s.body : '')).join('\n\n'); }
  function newSlide(p) { return Object.assign({ id: Math.random().toString(36).slice(2, 9), title: '', body: '', image: null, fit: 'cover', pos: 'top', overlay: 55 }, p || {}); }

  // ---------- sanitizers: everything restored from localStorage (state, kits) is untrusted ----------
  // (function declarations: loadState() runs before later consts are initialised)
  function own(o, k) { return o != null && Object.prototype.hasOwnProperty.call(o, k); }
  function isHex(v) { return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v); }
  function safeImg(v) { return (typeof v === 'string' && /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+$/i.test(v)) ? v : null; }
  function numIn(v, lo, hi, d) { const n = Number(v); return isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; }
  function str(v, d, max) { return (typeof v === 'string' ? v : d).slice(0, max || 2000); }
  function cleanTheme(t, base) {
    const d = Object.assign({}, base || DEFAULTS.theme); t = t && typeof t === 'object' ? t : {};
    ['bg', 'bg2', 'text', 'accent'].forEach(k => { if (isHex(t[k])) d[k] = t[k]; });
    ['gradient', 'badge', 'arrow', 'dots'].forEach(k => { if (own(t, k)) d[k] = !!t[k]; });
    if (t.font === 'auto' || own(FONTS, t.font)) d.font = t.font;
    if (own(t, 'scale')) d.scale = numIn(t.scale, 70, 140, d.scale);
    if (own(t, 'padding')) d.padding = numIn(t.padding, 40, 140, d.padding);
    return d;
  }
  function cleanBrand(b, base) {
    const d = Object.assign({}, base || DEFAULTS.brand); b = b && typeof b === 'object' ? b : {};
    if (own(b, 'on')) d.on = !!b.on;
    if (own(b, 'name')) d.name = str(b.name, '', 80);
    if (own(b, 'handle')) d.handle = str(b.handle, '', 80);
    if (own(b, 'avatar')) d.avatar = safeImg(b.avatar);
    return d;
  }
  function cleanSlide(s) {
    s = s && typeof s === 'object' ? s : {};
    return newSlide({ title: str(s.title, '', 500), body: str(s.body, '', 4000), image: safeImg(s.image), fit: ['cover', 'contain'].includes(s.fit) ? s.fit : 'cover', pos: ['top', 'bottom', 'background'].includes(s.pos) ? s.pos : 'top', overlay: numIn(s.overlay, 0, 90, 55) });
  }
  function loadState() {
    let saved = S.safeParse(localStorage.getItem(STATE_KEY) || '{}', {});
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) saved = {};
    const cta = saved.cta && typeof saved.cta === 'object' ? saved.cta : {};
    const st = {
      format: own(FORMATS, saved.format) ? saved.format : DEFAULTS.format,
      template: typeof saved.template === 'string' ? saved.template.slice(0, 40) : DEFAULTS.template, // checked against TEMPLATE_ORDER below
      current: Math.max(0, Math.floor(numIn(saved.current, 0, MAX_SLIDES, 0))),
      theme: cleanTheme(saved.theme),
      brand: cleanBrand(saved.brand),
      cta: { on: own(cta, 'on') ? !!cta.on : DEFAULTS.cta.on, text: str(cta.text, DEFAULTS.cta.text, 300), sub: str(cta.sub, DEFAULTS.cta.sub, 1000) },
      scale2x: !!saved.scale2x,
      slides: Array.isArray(saved.slides) && saved.slides.length ? saved.slides.slice(0, MAX_SLIDES).map(cleanSlide) : parseText(DEFAULT_TEXT).map(newSlide)
    };
    return st;
  }
  const saveState = S.debounce(() => {
    try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); }
    catch (e) { // quota: retry without images
      try { localStorage.setItem(STATE_KEY, JSON.stringify(Object.assign({}, state, { slides: state.slides.map(s => Object.assign({}, s, { image: null })), brand: Object.assign({}, state.brand, { avatar: null }) }))); } catch (e2) {}
    }
  }, 300);

  function allSlides() {
    const list = state.slides.slice();
    if (state.cta.on) list.push({ id: '__cta', cta: true, title: state.cta.text || 'Follow for more', body: state.cta.sub || '', image: null });
    return list;
  }
  function currentSlide() { const all = allSlides(); state.current = Math.max(0, Math.min(state.current, all.length - 1)); return all[state.current]; }
  function fmt() { return FORMATS[state.format] || FORMATS['4:5']; }

  // ---------- images ----------
  function getImg(src, onload) {
    if (!src) return null;
    let im = imgCache.get(src);
    if (im) return im.complete && im.naturalWidth ? im : null;
    im = new Image(); imgCache.set(src, im);
    im.onload = () => { thumbsDirty = true; onload && onload(); };
    im.src = src;
    return null;
  }
  async function fileToDataURL(file, max, quality) {
    const bmp = await S.readImage(file);
    const w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight;
    const f = S.fit(w, h, max, max);
    const c = document.createElement('canvas'); c.width = f.w; c.height = f.h;
    c.getContext('2d').drawImage(bmp, 0, 0, f.w, f.h);
    const hasAlpha = /png|webp|gif/.test(file.type);
    return c.toDataURL(hasAlpha ? 'image/png' : 'image/jpeg', quality || 0.86);
  }

  // ---------- drawing helpers ----------
  function family(env) { return env.family; }
  function fontStr(env, weight, size, italic) { return (italic ? 'italic ' : '') + weight + ' ' + Math.round(size * env.scale) + 'px ' + env.family; }
  function fillBg(ctx, env) {
    const t = env.theme;
    if (t.gradient) { const g = ctx.createLinearGradient(0, 0, env.w, env.h); g.addColorStop(0, t.bg); g.addColorStop(1, t.bg2 || t.accent); ctx.fillStyle = g; }
    else ctx.fillStyle = t.bg;
    ctx.fillRect(0, 0, env.w, env.h);
  }
  function drawImg(ctx, im, r, fit, radius) {
    ctx.save();
    if (radius) { S.roundRect(ctx, r.x, r.y, r.w, r.h, radius); ctx.clip(); }
    const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
    if (fit === 'contain') { const f = S.fit(iw, ih, r.w, r.h); if (f.r === 1) { /* allow upscale */ const rr = Math.min(r.w / iw, r.h / ih); f.w = iw * rr; f.h = ih * rr; } ctx.drawImage(im, r.x + (r.w - f.w) / 2, r.y + (r.h - f.h) / 2, f.w, f.h); }
    else { const c = S.cover(iw, ih, r.w, r.h); ctx.drawImage(im, c.sx, c.sy, c.sw, c.sh, r.x, r.y, r.w, r.h); }
    ctx.restore();
  }
  // Places the slide image (if any) and returns the rect left for text.
  function placeImage(ctx, env, slide, opts) {
    opts = opts || {};
    const c = env.content; const r = { x: c.x, y: c.y, w: c.w, h: c.h };
    if (!slide.image) return r;
    const im = getImg(slide.image, env.redraw);
    const pos = slide.pos || 'top', fit = slide.fit || 'cover';
    if (pos === 'background') {
      if (im) drawImg(ctx, im, { x: 0, y: 0, w: env.w, h: env.h }, fit, 0);
      ctx.fillStyle = S.hexToRgba(env.theme.bg, (slide.overlay == null ? 55 : slide.overlay) / 100); ctx.fillRect(0, 0, env.w, env.h);
      return r;
    }
    const ih = Math.round(c.h * (opts.ratio || 0.42)), gap = Math.round(28 * env.scale);
    const ir = pos === 'top' ? { x: c.x, y: c.y, w: c.w, h: ih } : { x: c.x, y: c.y + c.h - ih, w: c.w, h: ih };
    if (opts.polaroid) {
      ctx.save(); ctx.translate(ir.x + ir.w / 2, ir.y + ir.h / 2); ctx.rotate(-0.025);
      ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10; ctx.fillStyle = '#fff'; ctx.fillRect(-ir.w / 2, -ir.h / 2, ir.w, ir.h); ctx.shadowColor = 'transparent';
      if (im) drawImg(ctx, im, { x: -ir.w / 2 + 14, y: -ir.h / 2 + 14, w: ir.w - 28, h: ir.h - 28 }, fit, 0); else { ctx.fillStyle = '#eee'; ctx.fillRect(-ir.w / 2 + 14, -ir.h / 2 + 14, ir.w - 28, ir.h - 28); }
      ctx.restore();
    } else {
      if (im) drawImg(ctx, im, ir, fit, opts.radius == null ? 24 : opts.radius);
      else { ctx.fillStyle = S.hexToRgba(env.theme.text, .08); S.roundRect(ctx, ir.x, ir.y, ir.w, ir.h, opts.radius == null ? 24 : opts.radius); ctx.fill(); }
    }
    if (pos === 'top') return { x: c.x, y: ir.y + ir.h + gap, w: c.w, h: c.h - ih - gap };
    return { x: c.x, y: c.y, w: c.w, h: c.h - ih - gap };
  }
  // Fit a text block: shrink until lines fit maxH. Returns {size, lines, lineH}
  function fitText(ctx, env, text, maxW, maxH, weight, size, lh, italic, minRatio) {
    let s = size;
    for (let i = 0; i < 12; i++) {
      ctx.font = fontStr(env, weight, s, italic);
      const lines = S.wrapText(ctx, text, maxW);
      const lineH = Math.round(s * env.scale * lh);
      if (lines.length * lineH <= maxH || s <= size * (minRatio || 0.45)) return { size: s, lines, lineH, h: lines.length * lineH, font: ctx.font };
      s = Math.round(s * 0.9);
    }
    ctx.font = fontStr(env, weight, s, italic); const lines = S.wrapText(ctx, text, maxW); const lineH = Math.round(s * env.scale * lh);
    return { size: s, lines, lineH, h: lines.length * lineH, font: ctx.font };
  }
  function drawLines(ctx, block, x, y, align, color) {
    ctx.font = block.font; ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = color;
    block.lines.forEach((l, i) => ctx.fillText(l, x, y + block.lineH * 0.8 + i * block.lineH));
    return y + block.h;
  }
  // Generic title+body block. Returns {y: endY}
  function textBlock(ctx, env, slide, r, o) {
    o = o || {};
    const align = o.align || 'left', gap = Math.round((o.gap || 28) * env.scale);
    const tSize = o.titleSize || (env.first ? 96 : 70), bSize = o.bodySize || 36;
    const maxTitleH = slide.body ? r.h * 0.6 : r.h;
    const title = slide.title ? fitText(ctx, env, slide.title, r.w, maxTitleH, o.titleWeight || 800, tSize, o.titleLH || 1.06, o.titleItalic) : null;
    const remaining = r.h - (title ? title.h + gap : 0);
    const body = slide.body ? fitText(ctx, env, slide.body, r.w, Math.max(remaining, 60), o.bodyWeight || 400, bSize, o.bodyLH || 1.38, o.bodyItalic) : null;
    const total = (title ? title.h : 0) + (title && body ? gap : 0) + (body ? body.h : 0) + (o.extra || 0);
    const v = o.valign || 'center';
    let y = v === 'top' ? r.y : v === 'bottom' ? r.y + r.h - total : r.y + (r.h - total) / 2;
    const x = align === 'center' ? r.x + r.w / 2 : align === 'right' ? r.x + r.w : r.x;
    if (o.before) y = o.before(y, x, title, body);
    if (title) y = drawLines(ctx, title, x, y, align, o.titleColor || env.theme.text);
    if (title && body) { if (o.between) o.between(y + gap / 2, x); y += gap; }
    if (body) y = drawLines(ctx, body, x, y, align, o.bodyColor || S.hexToRgba(env.theme.text, .82));
    env.lastY = y; env.lastX = x; env.lastAlign = align;
    return y;
  }
  function pill(ctx, env, text, x, y, align, fill, color, size) {
    ctx.save(); ctx.font = fontStr(env, 700, size || 26); const tw = ctx.measureText(text).width; const h = Math.round((size || 26) * env.scale * 1.9), w = tw + h;
    const px = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    ctx.fillStyle = fill; S.roundRect(ctx, px, y, w, h, h / 2); ctx.fill();
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, px + w / 2, y + h / 2 + 1); ctx.restore();
    return { x: px, y, w, h };
  }

  // ---------- templates ----------
  const TEMPLATES = {
    bold: {
      name: 'Bold', palette: { bg: '#0f0f10', bg2: '#3b1d0a', text: '#fafafa', accent: '#f97316', gradient: false }, font: 'system',
      draw(ctx, slide, env) {
        fillBg(ctx, env); const r = placeImage(ctx, env, slide);
        textBlock(ctx, env, slide, r, { titleWeight: 800, titleSize: env.first ? 100 : 72, valign: 'center', before: (y, x) => { ctx.fillStyle = env.theme.accent; S.roundRect(ctx, x, y, 90 * env.scale, 12 * env.scale, 6); ctx.fill(); return y + 36 * env.scale; }, extra: 36 * env.scale });
      }
    },
    minimal: {
      name: 'Minimal', palette: { bg: '#fbfaf6', bg2: '#f1ede4', text: '#1d1d1f', accent: '#c2410c', gradient: false }, font: 'georgia',
      draw(ctx, slide, env) {
        fillBg(ctx, env); const r = placeImage(ctx, env, slide, { radius: 8 });
        ctx.save(); ctx.font = fontStr(env, 600, 24); ctx.fillStyle = S.hexToRgba(env.theme.text, .5); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        try { ctx.letterSpacing = '0.25em'; } catch (e) {}
        ctx.fillText(String(env.i + 1).padStart(2, '0') + '  —  ' + String(env.n).padStart(2, '0'), env.w / 2, env.content.y); ctx.restore();
        textBlock(ctx, env, slide, r, { align: 'center', titleWeight: 400, titleSize: env.first ? 88 : 64, titleLH: 1.12, bodySize: 34, bodyLH: 1.5, gap: 44, between: (y, x) => { ctx.fillStyle = env.theme.accent; ctx.fillRect(x - 30 * env.scale, y - 1, 60 * env.scale, 2); } });
      }
    },
    notebook: {
      name: 'Notebook', palette: { bg: '#fdf8e7', bg2: '#f7edc9', text: '#2b2b2b', accent: '#ef4444', gradient: false }, font: 'trebuchet',
      draw(ctx, slide, env) {
        fillBg(ctx, env);
        const lh = Math.round(56 * env.scale), top = env.content.y - 8;
        ctx.strokeStyle = 'rgba(70,110,200,.28)'; ctx.lineWidth = 2;
        for (let y = top; y < env.h - env.pad * 0.5; y += lh) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(env.w, y); ctx.stroke(); }
        const mx = Math.max(60, env.pad * 0.8); ctx.strokeStyle = S.hexToRgba(env.theme.accent, .55); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(mx, env.h); ctx.stroke();
        ctx.fillStyle = S.hexToRgba(env.theme.text, .18); for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(mx / 2, env.h * (0.2 + k * 0.3), 14, 0, Math.PI * 2); ctx.fill(); }
        const c0 = env.content; const r0 = { x: Math.max(c0.x, mx + 36), y: c0.y, w: c0.w - Math.max(0, mx + 36 - c0.x), h: c0.h };
        const saved = env.content; env.content = r0; const r = placeImage(ctx, env, slide, { polaroid: true, ratio: 0.4 }); env.content = saved;
        textBlock(ctx, env, slide, r, { titleWeight: 800, titleSize: env.first ? 84 : 62, bodySize: 34, bodyLH: lh / (34 * env.scale), valign: env.first ? 'center' : 'top', before: (y, x, title) => { if (title) { ctx.fillStyle = S.hexToRgba(env.theme.accent, .32); title.lines.forEach((l, i) => { ctx.font = title.font; const w = ctx.measureText(l).width; ctx.fillRect(x - 8, y + i * title.lineH + title.lineH * 0.22, w + 16, title.lineH * 0.7); }); } return y; } });
      }
    },
    gradient: {
      name: 'Gradient Pop', palette: { bg: '#7c3aed', bg2: '#ec4899', text: '#ffffff', accent: '#fde047', gradient: true }, font: 'system',
      draw(ctx, slide, env) {
        fillBg(ctx, env);
        ctx.save(); const g1 = ctx.createRadialGradient(env.w * 0.85, env.h * 0.15, 0, env.w * 0.85, env.h * 0.15, env.w * 0.6); g1.addColorStop(0, 'rgba(255,255,255,.22)'); g1.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g1; ctx.fillRect(0, 0, env.w, env.h);
        const g2 = ctx.createRadialGradient(env.w * 0.1, env.h * 0.9, 0, env.w * 0.1, env.h * 0.9, env.w * 0.5); g2.addColorStop(0, 'rgba(0,0,0,.18)'); g2.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g2; ctx.fillRect(0, 0, env.w, env.h); ctx.restore();
        const r = placeImage(ctx, env, slide, { radius: 32 });
        if (!slide.body) { textBlock(ctx, env, slide, r, { titleWeight: 900, titleSize: env.first ? 104 : 76, titleLH: 1.02 }); return; }
        // title + frosted body card
        const gap = 32 * env.scale, padC = 36 * env.scale;
        const title = fitText(ctx, env, slide.title, r.w, r.h * 0.55, 900, env.first ? 96 : 70, 1.02);
        const body = fitText(ctx, env, slide.body, r.w - padC * 2, r.h - title.h - gap - padC * 2, 500, 34, 1.4);
        const total = title.h + gap + body.h + padC * 2; let y = r.y + (r.h - total) / 2;
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 6; y = drawLines(ctx, title, r.x, y, 'left', env.theme.text); ctx.restore();
        y += gap; ctx.fillStyle = 'rgba(255,255,255,.16)'; S.roundRect(ctx, r.x, y, r.w, body.h + padC * 2, 28); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; ctx.stroke();
        env.lastY = drawLines(ctx, body, r.x + padC, y + padC, 'left', env.theme.text) + padC; env.lastX = r.x; env.lastAlign = 'left';
      }
    },
    darktech: {
      name: 'Dark Tech', palette: { bg: '#0a0a0a', bg2: '#0f172a', text: '#e5e5e5', accent: '#22d3ee', gradient: false }, font: 'courier',
      draw(ctx, slide, env) {
        fillBg(ctx, env);
        ctx.fillStyle = S.hexToRgba(env.theme.text, .13); for (let x = 30; x < env.w; x += 44) for (let y = 30; y < env.h; y += 44) ctx.fillRect(x, y, 2, 2);
        const in_ = Math.round(env.pad * 0.45); ctx.strokeStyle = S.hexToRgba(env.theme.accent, .5); ctx.lineWidth = 2; ctx.strokeRect(in_, in_, env.w - in_ * 2, env.h - in_ * 2);
        ctx.fillStyle = env.theme.accent; const m = 18; [[in_, in_], [env.w - in_, in_], [in_, env.h - in_], [env.w - in_, env.h - in_]].forEach(([x, y]) => ctx.fillRect(x - 5, y - 5, 10, 10));
        ctx.save(); ctx.font = fontStr(env, 700, 26); ctx.fillStyle = env.theme.accent; ctx.textBaseline = 'top'; ctx.textAlign = 'left'; ctx.fillText('// slide ' + String(env.i + 1).padStart(2, '0') + (env.first ? '  —  start' : env.last ? '  —  end' : ''), env.content.x, env.content.y - 10 * env.scale); ctx.restore();
        const r = placeImage(ctx, env, slide, { radius: 6 }); r.y += 40 * env.scale; r.h -= 40 * env.scale;
        textBlock(ctx, env, slide, r, { titleWeight: 700, titleSize: env.first ? 86 : 64, bodySize: 32, bodyLH: 1.5, bodyColor: S.hexToRgba(env.theme.text, .8) });
        // cursor block
        ctx.fillStyle = env.theme.accent; ctx.fillRect(env.lastX, env.lastY + 10 * env.scale, 22 * env.scale, 36 * env.scale);
        void m;
      }
    },
    quote: {
      name: 'Quote', palette: { bg: '#111827', bg2: '#1f2937', text: '#f9fafb', accent: '#fbbf24', gradient: false }, font: 'georgia',
      draw(ctx, slide, env) {
        fillBg(ctx, env); const r = placeImage(ctx, env, slide, { radius: 16 });
        const rr = { x: r.x, y: r.y + 150 * env.scale, w: r.w, h: r.h - 150 * env.scale };
        textBlock(ctx, env, slide, rr, { titleWeight: 400, titleItalic: true, titleSize: env.first ? 80 : 64, titleLH: 1.18, bodySize: 32, bodyColor: env.theme.accent, bodyWeight: 600, gap: 40, extra: 120 * env.scale,
          before: (y, x) => { ctx.save(); ctx.font = fontStr(env, 700, 260); ctx.fillStyle = S.hexToRgba(env.theme.accent, .9); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.fillText('“', x - 16 * env.scale, y + 150 * env.scale); ctx.restore(); return y + 120 * env.scale; },
          between: (y, x) => { ctx.fillStyle = env.theme.accent; ctx.fillRect(x, y - 1, 70 * env.scale, 3); } });
      }
    },
    magazine: {
      name: 'Magazine', pro: true, palette: { bg: '#f5f1ea', bg2: '#ebe4d6', text: '#111111', accent: '#b91c1c', gradient: false }, font: 'georgia',
      draw(ctx, slide, env) {
        fillBg(ctx, env); const c = env.content;
        ctx.fillStyle = env.theme.text; ctx.fillRect(c.x, c.y, c.w, 4);
        ctx.save(); ctx.font = '700 ' + Math.round(22 * env.scale) + 'px ' + FONTS.system; ctx.textBaseline = 'top'; try { ctx.letterSpacing = '0.22em'; } catch (e) {}
        ctx.fillStyle = env.theme.text; ctx.textAlign = 'left'; ctx.fillText((env.brand.name || 'CAROUSEL').toUpperCase(), c.x, c.y + 18 * env.scale);
        ctx.textAlign = 'right'; ctx.fillStyle = env.theme.accent; ctx.fillText('NO. ' + String(env.i + 1).padStart(2, '0'), c.x + c.w, c.y + 18 * env.scale); ctx.restore();
        const saved = env.content; env.content = { x: c.x, y: c.y + 70 * env.scale, w: c.w, h: c.h - 70 * env.scale }; const r = placeImage(ctx, env, slide, { radius: 0, ratio: 0.45 }); env.content = saved;
        ctx.save(); ctx.font = '300 ' + Math.round(200 * env.scale) + 'px ' + FONTS.system; ctx.fillStyle = S.hexToRgba(env.theme.accent, .16); ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic'; ctx.fillText(String(env.i + 1).padStart(2, '0'), c.x + c.w + 10, r.y + r.h); ctx.restore();
        textBlock(ctx, env, slide, r, { titleWeight: 700, titleSize: env.first ? 100 : 76, titleLH: 0.98, bodySize: 32, bodyLH: 1.5, gap: 36, between: (y, x) => { ctx.fillStyle = env.theme.text; ctx.fillRect(x, y - 1, r.w, 2); } });
        ctx.fillStyle = env.theme.text; ctx.fillRect(c.x, c.y + c.h - 2, c.w, 2);
      }
    },
    neon: {
      name: 'Neon', pro: true, palette: { bg: '#050510', bg2: '#1a0b2e', text: '#ffffff', accent: '#ff2d95', gradient: true }, font: 'system',
      draw(ctx, slide, env) {
        fillBg(ctx, env);
        const g = ctx.createRadialGradient(env.w / 2, env.h / 2, 0, env.w / 2, env.h / 2, env.w * 0.8); g.addColorStop(0, S.hexToRgba(env.theme.accent, .28)); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, env.w, env.h);
        const in_ = Math.round(env.pad * 0.5); ctx.save(); ctx.shadowColor = env.theme.accent; ctx.shadowBlur = 30; ctx.strokeStyle = env.theme.accent; ctx.lineWidth = 4; S.roundRect(ctx, in_, in_, env.w - in_ * 2, env.h - in_ * 2, 28); ctx.stroke(); ctx.stroke(); ctx.restore();
        const r = placeImage(ctx, env, slide, { radius: 20 });
        ctx.save(); ctx.shadowColor = env.theme.accent; ctx.shadowBlur = 28;
        textBlock(ctx, env, slide, r, { align: 'center', titleWeight: 800, titleSize: env.first ? 96 : 72, bodySize: 34, bodyLH: 1.45, gap: 36, bodyColor: S.hexToRgba(env.theme.text, .85) });
        ctx.restore();
      }
    },
    papercut: {
      name: 'Paper cut', pro: true, palette: { bg: '#fde68a', bg2: '#fbbf24', text: '#1f2937', accent: '#f97316', gradient: false }, font: 'trebuchet',
      draw(ctx, slide, env) {
        fillBg(ctx, env);
        const layer = (x, y, w, h, rot, color) => { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.shadowColor = 'rgba(0,0,0,.22)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 14; ctx.fillStyle = color; S.roundRect(ctx, -w / 2, -h / 2, w, h, 60); ctx.fill(); ctx.restore(); };
        layer(env.w * 0.15, env.h * 0.1, env.w * 0.9, env.h * 0.5, -0.18, S.hexToRgba(env.theme.accent, .55));
        layer(env.w * 0.9, env.h * 0.85, env.w * 0.9, env.h * 0.5, 0.22, S.hexToRgba(env.theme.accent, .8));
        layer(env.w * 0.8, env.h * 0.2, env.w * 0.5, env.w * 0.5, 0.4, S.hexToRgba(env.theme.text, .12));
        const c = env.content, padC = 48 * env.scale;
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 18; ctx.fillStyle = '#ffffff'; S.roundRect(ctx, c.x, c.y, c.w, c.h, 36); ctx.fill(); ctx.restore();
        const saved = env.content; env.content = { x: c.x + padC, y: c.y + padC, w: c.w - padC * 2, h: c.h - padC * 2 }; const r = placeImage(ctx, env, slide, { radius: 20 }); env.content = saved;
        textBlock(ctx, env, slide, r, { titleWeight: 800, titleSize: env.first ? 88 : 66, bodySize: 32, bodyLH: 1.45, titleColor: env.theme.text, bodyColor: S.hexToRgba(env.theme.text, .75), before: (y, x) => { ctx.fillStyle = env.theme.accent; ctx.beginPath(); ctx.arc(x + 18 * env.scale, y + 18 * env.scale, 18 * env.scale, 0, Math.PI * 2); ctx.fill(); return y + 56 * env.scale; }, extra: 56 * env.scale });
      }
    },
    swiss: {
      name: 'Swiss grid', pro: true, palette: { bg: '#ffffff', bg2: '#f4f4f5', text: '#000000', accent: '#e11d48', gradient: false }, font: 'system',
      draw(ctx, slide, env) {
        fillBg(ctx, env); const c = env.content;
        ctx.strokeStyle = S.hexToRgba(env.theme.text, .08); ctx.lineWidth = 1; for (let k = 0; k <= 6; k++) { const x = c.x + c.w * k / 6; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, env.h); ctx.stroke(); }
        for (let y = c.y; y < env.h; y += c.w / 6) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(env.w, y); ctx.stroke(); }
        const sq = 90 * env.scale; ctx.fillStyle = env.theme.accent; ctx.fillRect(c.x, c.y, sq, sq);
        ctx.save(); ctx.font = fontStr(env, 300, 56); ctx.fillStyle = env.theme.text; ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillText(String(env.i + 1).padStart(2, '0') + '/' + String(env.n).padStart(2, '0'), c.x + c.w, c.y); ctx.restore();
        const saved = env.content; env.content = { x: c.x, y: c.y + sq + 40 * env.scale, w: c.w, h: c.h - sq - 40 * env.scale }; const r = placeImage(ctx, env, slide, { radius: 0, ratio: 0.4 }); env.content = saved;
        // body top (narrow column), title bottom
        let bodyH = 0;
        if (slide.body) { const body = fitText(ctx, env, slide.body, r.w * 0.62, r.h * 0.35, 400, 28, 1.45); drawLines(ctx, body, r.x, r.y, 'left', S.hexToRgba(env.theme.text, .8)); bodyH = body.h + 40 * env.scale; }
        const title = fitText(ctx, env, slide.title, r.w, r.h - bodyH, 800, env.first ? 112 : 84, 0.96);
        ctx.fillStyle = env.theme.text; ctx.fillRect(r.x, r.y + r.h - title.h - 28 * env.scale, c.w * 0.25, 6);
        env.lastY = drawLines(ctx, title, r.x, r.y + r.h - title.h, 'left', env.theme.text); env.lastX = r.x; env.lastAlign = 'left';
        // CTA pill is drawn by chrome; here we have no room below title, so move pill above
        env.ctaPillY = r.y + r.h - title.h - 28 * env.scale - 90 * env.scale;
      }
    }
  };
  const TEMPLATE_ORDER = ['bold', 'minimal', 'notebook', 'gradient', 'darktech', 'quote', 'magazine', 'neon', 'papercut', 'swiss'];
  if (!TEMPLATE_ORDER.includes(state.template)) state.template = DEFAULTS.template; // restored value must be a known template

  // ---------- chrome (counter, arrow, dots, brand, CTA) ----------
  function drawChrome(ctx, slide, env) {
    const t = env.theme, pad = env.pad, textC = t.text;
    ctx.save();
    // counter badge
    if (t.badge) pill(ctx, env, (env.i + 1) + '/' + env.n, env.w - pad, pad - 10 * env.scale, 'right', S.hexToRgba(textC, .12), textC, 24);
    // brand bar
    const barY = env.h - pad - 56 * env.scale, barH = 56 * env.scale;
    if (env.brand.on && (env.brand.name || env.brand.handle || env.brand.avatar)) {
      let x = pad;
      const av = env.brand.avatar ? getImg(env.brand.avatar, env.redraw) : null;
      ctx.save(); ctx.beginPath(); ctx.arc(x + barH / 2, barY + barH / 2, barH / 2, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
      if (av) drawImg(ctx, av, { x, y: barY, w: barH, h: barH }, 'cover', 0);
      else { ctx.fillStyle = t.accent; ctx.fillRect(x, barY, barH, barH); ctx.fillStyle = '#fff'; ctx.font = fontStr(env, 800, 26); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText((env.brand.name || env.brand.handle || 'A').replace('@', '').slice(0, 1).toUpperCase(), x + barH / 2, barY + barH / 2 + 1); }
      ctx.restore();
      x += barH + 18 * env.scale; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      if (env.brand.name && env.brand.handle) {
        ctx.font = fontStr(env, 700, 26); ctx.fillStyle = textC; ctx.fillText(env.brand.name, x, barY + barH * 0.32);
        ctx.font = fontStr(env, 500, 24); ctx.fillStyle = S.hexToRgba(textC, .65); ctx.fillText(env.brand.handle, x, barY + barH * 0.72);
      } else { ctx.font = fontStr(env, 700, 28); ctx.fillStyle = textC; ctx.fillText(env.brand.name || env.brand.handle, x, barY + barH / 2); }
    }
    // arrow
    if (t.arrow && !env.last) { ctx.font = fontStr(env, 800, 44); ctx.fillStyle = t.accent; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText('→', env.w - pad, barY + barH / 2); }
    // dots
    if (t.dots && env.n > 1) {
      const dy = env.brand.on ? barY - 30 * env.scale : barY + barH / 2; const r = 6 * env.scale, gap = 10 * env.scale, n = env.n; const tot = n * r * 2 + (n - 1) * gap; let x = env.w / 2 - tot / 2 + r;
      for (let k = 0; k < n; k++) { ctx.beginPath(); ctx.arc(x, dy, r, 0, Math.PI * 2); ctx.fillStyle = k === env.i ? t.accent : S.hexToRgba(textC, .3); ctx.fill(); x += r * 2 + gap; }
    }
    // CTA pill
    if (slide.cta && env.brand.handle) {
      const y = env.ctaPillY != null ? env.ctaPillY : env.lastY + 44 * env.scale;
      const r = pill(ctx, env, 'Follow ' + env.brand.handle, env.lastAlign === 'center' ? env.w / 2 : env.lastX, y, env.lastAlign === 'center' ? 'center' : 'left', t.accent, '#ffffff', 30);
      void r;
    }
    ctx.restore();
  }

  function makeEnv(w, h, i, redraw) {
    const all = allSlides(), n = all.length, t = state.theme, tpl = TEMPLATES[state.template] || TEMPLATES.bold;
    const scale = (t.scale / 100) * (w / 1080);
    const pad = Math.round(t.padding * (w / 1080));
    const fontKey = t.font === 'auto' ? (tpl.font || 'system') : t.font;
    const brand = state.brand;
    const top = pad + (t.badge ? 70 * scale : 0);
    let bottom = pad;
    if (brand.on) bottom += 56 * scale + 28 * scale;
    if (t.dots) bottom += brand.on ? 30 * scale : 0;
    if (!brand.on && (t.dots || t.arrow)) bottom += 60 * scale;
    return { w, h, i, n, first: i === 0, last: i === n - 1, theme: t, scale, pad, family: FONTS[fontKey] || FONTS.system, brand, redraw, content: { x: pad, y: top, w: w - pad * 2, h: h - top - bottom }, lastY: top, lastX: pad, lastAlign: 'left' };
  }
  function drawSlide(ctx, w, h, i, redraw) {
    const all = allSlides(); const slide = all[Math.max(0, Math.min(i, all.length - 1))];
    const env = makeEnv(w, h, i, redraw);
    const tpl = TEMPLATES[state.template] || TEMPLATES.bold;
    ctx.save(); ctx.textBaseline = 'alphabetic'; tpl.draw(ctx, slide, env); ctx.restore();
    ctx.save(); drawChrome(ctx, slide, env); ctx.restore();
  }

  // ---------- rendering ----------
  const preview = $('preview'), pctx = preview.getContext('2d');
  const render = S.raf(() => {
    const f = fmt(); if (preview.width !== f.w || preview.height !== f.h) { preview.width = f.w; preview.height = f.h; }
    pctx.setTransform(1, 0, 0, 1, 0, 0); pctx.clearRect(0, 0, f.w, f.h);
    try { drawSlide(pctx, f.w, f.h, state.current, render); } catch (e) { console.error(e); }
    renderThumbs();
  });
  const renderThumbs = S.debounce(() => {
    const f = fmt(), all = allSlides(), strip = $('strip');
    const th = 148; const tw = Math.round(th * f.w / f.h);
    // sync number of thumbs
    while (strip.children.length > all.length) strip.lastElementChild.remove();
    while (strip.children.length < all.length) strip.appendChild(makeThumb());
    all.forEach((s, i) => {
      const el = strip.children[i]; const c = el.querySelector('canvas');
      if (c.width !== tw || c.height !== th) { c.width = tw; c.height = th; }
      const ctx = c.getContext('2d'); ctx.setTransform(tw / f.w, 0, 0, th / f.h, 0, 0);
      try { drawSlide(ctx, f.w, f.h, i, render); } catch (e) {}
      el.classList.toggle('active', i === state.current); el.dataset.index = i; el.setAttribute('aria-selected', i === state.current ? 'true' : 'false');
      el.querySelector('.n').textContent = i + 1; el.querySelector('.cta-tag').hidden = !s.cta; el.draggable = !s.cta;
    });
    $('slideCount').textContent = all.length + ' slide' + (all.length === 1 ? '' : 's');
    const act = strip.children[state.current]; if (act && act.scrollIntoView) act.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, 80);
  function makeThumb() {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'thumb'; b.setAttribute('role', 'option');
    b.innerHTML = '<canvas aria-hidden="true"></canvas><span class="n"></span><span class="cta-tag" hidden>CTA</span>';
    b.addEventListener('click', () => { selectSlide(+b.dataset.index); });
    b.addEventListener('dragstart', e => { dragIdx = +b.dataset.index; b.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(dragIdx)); } catch (x) {} });
    b.addEventListener('dragend', () => { b.classList.remove('dragging'); clearDropMarks(); dragIdx = -1; });
    b.addEventListener('dragover', e => { if (dragIdx < 0) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; const r = b.getBoundingClientRect(); const after = e.clientX > r.left + r.width / 2; clearDropMarks(); b.classList.add(after ? 'drop-after' : 'drop-before'); });
    b.addEventListener('drop', e => { if (dragIdx < 0) return; e.preventDefault(); const r = b.getBoundingClientRect(); const after = e.clientX > r.left + r.width / 2; let to = +b.dataset.index + (after ? 1 : 0); moveSlide(dragIdx, to); clearDropMarks(); });
    return b;
  }
  let dragIdx = -1;
  function clearDropMarks() { document.querySelectorAll('.thumb.drop-before,.thumb.drop-after').forEach(x => x.classList.remove('drop-before', 'drop-after')); }

  function update(opts) { opts = opts || {}; saveState(); if (opts.panel !== false) syncSlidePanel(); render(); renderThumbs(); }

  // ---------- slide operations ----------
  function selectSlide(i) { state.current = i; syncSlidePanel(); render(); saveState(); }
  function moveSlide(from, to) {
    const n = state.slides.length; if (from < 0 || from >= n) return; to = Math.max(0, Math.min(to, n)); if (to === from || to === from + 1) return;
    const [s] = state.slides.splice(from, 1); if (to > from) to--; state.slides.splice(to, 0, s); state.current = to; syncText(); update();
  }
  function addSlide(after) {
    if (state.slides.length >= MAX_SLIDES) { toast('Maximum ' + MAX_SLIDES + ' slides per carousel'); return; }
    const i = Math.min(after == null ? state.slides.length - 1 : after, state.slides.length - 1);
    const s = newSlide({ title: 'New slide', body: '' }); state.slides.splice(i + 1, 0, s); state.current = i + 1; syncText(); update(); track('slide_add', {});
    const t = $('slideTitle'); t.focus(); t.select();
  }
  function duplicateSlide() {
    const cur = currentSlide(); if (cur.cta) { toast('The CTA slide is generated automatically'); return; }
    if (state.slides.length >= MAX_SLIDES) { toast('Maximum ' + MAX_SLIDES + ' slides per carousel'); return; }
    const copy = newSlide(Object.assign({}, cur, { id: undefined })); state.slides.splice(state.current + 1, 0, copy); state.current++; syncText(); update();
  }
  function deleteSlide() {
    const cur = currentSlide(); if (cur.cta) { state.cta.on = false; $('ctaOn').checked = false; $('ctaFields').classList.add('hidden'); update(); return; }
    if (state.slides.length <= 1) { toast('Keep at least one slide'); return; }
    state.slides.splice(state.current, 1); state.current = Math.max(0, state.current - 1); syncText(); update();
  }

  // ---------- text <-> slides ----------
  const textEl = $('text');
  function syncText() { if (document.activeElement !== textEl) textEl.value = slidesToText(state.slides); }
  textEl.addEventListener('input', S.debounce(() => {
    const parsed = parseText(textEl.value);
    if (!parsed.length) { state.slides = [newSlide({ title: '' })]; }
    else state.slides = parsed.map((p, i) => { const old = state.slides[i]; return old ? Object.assign(old, p) : newSlide(p); }).slice(0, MAX_SLIDES);
    if (parsed.length > MAX_SLIDES) toast('Only the first ' + MAX_SLIDES + ' slides are used');
    update();
  }, 150));
  $('exampleBtn').addEventListener('click', () => { state.slides = parseText(DEFAULT_TEXT).map(newSlide); state.current = 0; textEl.value = DEFAULT_TEXT; update(); toast('Example loaded'); });
  $('clearBtn').addEventListener('click', () => { state.slides = [newSlide({ title: 'Your hook goes here', body: '' })]; state.current = 0; textEl.value = ''; update(); textEl.focus(); });
  $('ctaOn').addEventListener('change', e => { state.cta.on = e.target.checked; $('ctaFields').classList.toggle('hidden', !state.cta.on); update(); });
  $('ctaText').addEventListener('input', e => { state.cta.text = e.target.value; update({ panel: false }); });
  $('ctaSub').addEventListener('input', e => { state.cta.sub = e.target.value; update({ panel: false }); });

  // ---------- slide panel ----------
  let panelLock = false;
  function syncSlidePanel() {
    const s = currentSlide(), all = allSlides(); panelLock = true;
    $('slideIdx').textContent = (state.current + 1) + ' / ' + all.length + (s.cta ? ' · CTA' : '');
    $('slideTitle').value = s.title || ''; $('slideBody').value = s.body || '';
    $('slideImgBlock').classList.toggle('hidden', !!s.cta);
    const has = !!s.image; $('slideImgOpts').classList.toggle('hidden', !has);
    const pv = $('slideImgPreview'); pv.hidden = !has; if (has) pv.src = s.image; $('slideImgText').textContent = has ? 'Replace image' : 'Click or drop an image';
    fitSeg.set(s.fit || 'cover'); posSeg.set(s.pos || 'top'); $('overlayRow').classList.toggle('hidden', (s.pos || 'top') !== 'background');
    $('overlayRange').value = s.overlay == null ? 55 : s.overlay; $('overlayVal').textContent = $('overlayRange').value + '%';
    $('dupSlideBtn').disabled = !!s.cta; $('moveLeftBtn').disabled = !!s.cta || state.current === 0; $('moveRightBtn').disabled = !!s.cta || state.current >= state.slides.length - 1;
    panelLock = false;
  }
  function editCurrent(fn) { const s = currentSlide(); if (s.cta) { fn(state.cta, true); } else fn(s, false); syncText(); update({ panel: false }); }
  $('slideTitle').addEventListener('input', e => { if (panelLock) return; editCurrent((s, cta) => { if (cta) { s.text = e.target.value; $('ctaText').value = s.text; } else s.title = e.target.value; }); });
  $('slideBody').addEventListener('input', e => { if (panelLock) return; editCurrent((s, cta) => { if (cta) { s.sub = e.target.value; $('ctaSub').value = s.sub; } else s.body = e.target.value; }); });
  const fitSeg = S.seg($('fitSeg'), v => { const s = currentSlide(); if (!s.cta) { s.fit = v; update({ panel: false }); } });
  const posSeg = S.seg($('posSeg'), v => { const s = currentSlide(); if (!s.cta) { s.pos = v; $('overlayRow').classList.toggle('hidden', v !== 'background'); update({ panel: false }); } });
  $('overlayRange').addEventListener('input', e => { const s = currentSlide(); if (!s.cta) { s.overlay = +e.target.value; $('overlayVal').textContent = s.overlay + '%'; update({ panel: false }); } });
  $('slideImgRemove').addEventListener('click', () => { const s = currentSlide(); if (!s.cta) { s.image = null; update(); } });
  S.dropzone($('slideImgDrop'), async files => {
    const s = currentSlide(); if (s.cta) return;
    try { s.image = await fileToDataURL(files[0], 1600); update(); track('image_add', {}); } catch (e) { toast('Could not read that image'); }
  }, { accept: 'image/*', paste: false });

  // ---------- templates ----------
  function buildTiles() {
    const box = $('tiles'); box.innerHTML = '';
    TEMPLATE_ORDER.forEach(key => {
      const t = TEMPLATES[key]; const b = document.createElement('button'); b.type = 'button'; b.className = 'tile'; b.dataset.key = key;
      const p = t.palette; const bg = p.gradient ? 'linear-gradient(135deg,' + p.bg + ',' + p.bg2 + ')' : p.bg;
      b.innerHTML = '<span class="sw" style="background:' + bg + '"><b style="color:' + p.text + ';font-family:' + FONTS[t.font || 'system'].replace(/"/g, '&quot;') + '">Aa</b><i style="background:' + p.accent + '"></i></span><span style="color:' + p.text + '">' + t.name + '</span>' + (t.pro ? '<span class="pro-badge" data-pro-only>PRO</span>' : '');
      b.setAttribute('aria-label', t.name + (t.pro ? ' (Pro)' : ''));
      b.addEventListener('click', () => {
        if (t.pro && !S.gate('template')) return;
        state.template = key; Object.assign(state.theme, { bg: p.bg, bg2: p.bg2, text: p.text, accent: p.accent, gradient: !!p.gradient });
        syncThemePanel(); markTile(); update({ panel: false }); track('template', { template: key });
      });
      box.appendChild(b);
    });
    markTile();
  }
  function markTile() { document.querySelectorAll('#tiles .tile').forEach(b => b.classList.toggle('active', b.dataset.key === state.template)); }

  // ---------- theme panel ----------
  function syncThemePanel() {
    const t = state.theme;
    [['bgColor', 'bg'], ['bg2Color', 'bg2'], ['textColor', 'text'], ['accentColor', 'accent']].forEach(([id, k]) => { $(id).value = t[k]; $(id.replace('Color', 'Hex')).textContent = t[k]; });
    $('gradOn').checked = !!t.gradient; $('bg2Row').classList.toggle('hidden', !t.gradient);
    $('fontSel').value = t.font; $('scaleRange').value = t.scale; $('scaleVal').textContent = t.scale + '%'; $('padRange').value = t.padding; $('padVal').textContent = t.padding;
    $('badgeOn').checked = !!t.badge; $('arrowOn').checked = !!t.arrow; $('dotsOn').checked = !!t.dots;
  }
  [['bgColor', 'bg'], ['bg2Color', 'bg2'], ['textColor', 'text'], ['accentColor', 'accent']].forEach(([id, k]) => $(id).addEventListener('input', e => { state.theme[k] = e.target.value; $(id.replace('Color', 'Hex')).textContent = e.target.value; update({ panel: false }); }));
  $('gradOn').addEventListener('change', e => { state.theme.gradient = e.target.checked; $('bg2Row').classList.toggle('hidden', !e.target.checked); update({ panel: false }); });
  $('fontSel').addEventListener('change', e => { state.theme.font = e.target.value; update({ panel: false }); });
  $('scaleRange').addEventListener('input', e => { state.theme.scale = +e.target.value; $('scaleVal').textContent = e.target.value + '%'; update({ panel: false }); });
  $('padRange').addEventListener('input', e => { state.theme.padding = +e.target.value; $('padVal').textContent = e.target.value; update({ panel: false }); });
  $('badgeOn').addEventListener('change', e => { state.theme.badge = e.target.checked; update({ panel: false }); });
  $('arrowOn').addEventListener('change', e => { state.theme.arrow = e.target.checked; update({ panel: false }); });
  $('dotsOn').addEventListener('change', e => { state.theme.dots = e.target.checked; update({ panel: false }); });

  // ---------- brand panel ----------
  function syncBrandPanel() {
    const b = state.brand; $('brandOn').checked = !!b.on; $('brandName').value = b.name || ''; $('brandHandle').value = b.handle || '';
    const pv = $('avatarPreview'); pv.hidden = !b.avatar; if (b.avatar) pv.src = b.avatar; $('avatarInitial').hidden = !!b.avatar; $('avatarInitial').textContent = (b.name || b.handle || 'A').replace('@', '').slice(0, 1).toUpperCase();
  }
  $('brandOn').addEventListener('change', e => { state.brand.on = e.target.checked; update({ panel: false }); });
  $('brandName').addEventListener('input', e => { state.brand.name = e.target.value; $('avatarInitial').textContent = (e.target.value || 'A').slice(0, 1).toUpperCase(); update({ panel: false }); });
  $('brandHandle').addEventListener('input', e => { let v = e.target.value.trim(); if (v && v[0] !== '@') v = '@' + v; state.brand.handle = v; update({ panel: false }); });
  $('brandHandle').addEventListener('blur', e => { e.target.value = state.brand.handle || ''; });
  $('avatarRemove').addEventListener('click', () => { state.brand.avatar = null; syncBrandPanel(); update({ panel: false }); });
  S.dropzone($('avatarDrop'), async files => { try { state.brand.avatar = await fileToDataURL(files[0], 256, 0.9); syncBrandPanel(); update({ panel: false }); } catch (e) { toast('Could not read that image'); } }, { accept: 'image/*', paste: false });

  // brand kits
  function loadKits() {
    const v = S.safeParse(localStorage.getItem(KITS_KEY) || '[]', []);
    return Array.isArray(v) ? v.filter(k => k && typeof k === 'object').slice(0, 200).map(k => ({ name: str(k.name, 'Kit', 120), brand: cleanBrand(k.brand), theme: cleanTheme(k.theme), template: own(TEMPLATES, k.template) ? k.template : null })) : [];
  }
  function saveKits(k) { try { localStorage.setItem(KITS_KEY, JSON.stringify(k)); } catch (e) { toast('Could not save (storage full)'); } }
  function renderKits() {
    const sel = $('kitSel'), kits = loadKits(); const cur = sel.value; sel.innerHTML = '<option value="">Saved kits…</option>' + kits.map((k, i) => '<option value="' + i + '">' + escapeHtml(k.name) + '</option>').join('');
    if (cur) sel.value = cur; $('kitHint').textContent = isPro() ? kits.length + ' saved kit' + (kits.length === 1 ? '' : 's') + ' · unlimited with Pro' : 'Free: ' + FREE_KITS + ' saved kit (' + kits.length + '/' + FREE_KITS + '). Pro: unlimited.';
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
  $('kitSave').addEventListener('click', () => {
    const kits = loadKits(); if (kits.length >= FREE_KITS && !S.gate('kits')) return;
    const name = (state.brand.name || state.brand.handle || 'Kit') + ' · ' + (TEMPLATES[state.template] || {}).name;
    kits.push({ name, brand: Object.assign({}, state.brand), theme: Object.assign({}, state.theme), template: state.template }); saveKits(kits); renderKits(); $('kitSel').value = String(kits.length - 1); toast('Brand kit saved'); track('kit_save', {});
  });
  $('kitSel').addEventListener('change', e => {
    const k = loadKits()[+e.target.value]; if (!k) return;
    state.brand = cleanBrand(k.brand, state.brand); state.theme = cleanTheme(k.theme, state.theme); if (k.template && own(TEMPLATES, k.template) && (!TEMPLATES[k.template].pro || isPro())) state.template = k.template;
    syncBrandPanel(); syncThemePanel(); markTile(); update({ panel: false }); toast('Kit applied');
  });
  $('kitDel').addEventListener('click', () => { const sel = $('kitSel'); if (sel.value === '') return; const kits = loadKits(); kits.splice(+sel.value, 1); saveKits(kits); sel.value = ''; renderKits(); toast('Kit deleted'); });

  // ---------- format ----------
  const fmtSeg = S.seg($('fmtSeg'), v => { state.format = v; $('sizeLabel').textContent = FORMATS[v].label; update({ panel: false }); track('format', { format: v }); });

  // ---------- strip tools ----------
  $('addSlideBtn').addEventListener('click', () => addSlide(currentSlide().cta ? state.slides.length - 1 : state.current));
  $('dupSlideBtn').addEventListener('click', duplicateSlide);
  $('delSlideBtn').addEventListener('click', deleteSlide);
  $('moveLeftBtn').addEventListener('click', () => moveSlide(state.current, state.current - 1));
  $('moveRightBtn').addEventListener('click', () => moveSlide(state.current, state.current + 2));
  document.addEventListener('keydown', e => {
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || document.querySelector('.modal.open')) return;
    if (e.key === 'ArrowLeft') selectSlide(Math.max(0, state.current - 1));
    if (e.key === 'ArrowRight') selectSlide(Math.min(allSlides().length - 1, state.current + 1));
  });

  // ---------- export ----------
  function exportScale() { return state.scale2x && isPro() ? 2 : 1; }
  function slideName(i) { return 'carousel-slide-' + String(i + 1).padStart(2, '0'); }
  function drawFn(i) { return (ctx, w, h) => { drawSlide(ctx, w, h, i, null); }; }
  let busy = false;
  async function withBusy(btn, label, fn) {
    if (busy) return; busy = true; const old = btn.textContent; btn.disabled = true; btn.textContent = label;
    try { await fn(); } catch (e) { console.error(e); toast('Export failed. Try again.'); } finally { busy = false; btn.disabled = false; btn.textContent = old; }
  }
  $('dlBtn').addEventListener('click', () => withBusy($('dlBtn'), 'Rendering…', async () => {
    const f = fmt(); await S.exportPNG(drawFn(state.current), f.w, f.h, { scale: exportScale(), name: slideName(state.current) }); toast('Slide downloaded');
  }));
  $('copyBtn').addEventListener('click', () => withBusy($('copyBtn'), 'Copying…', async () => {
    const f = fmt(); const blob = await S.exportPNG(drawFn(state.current), f.w, f.h, { scale: 1, download: false });
    try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); toast('Slide copied to clipboard'); track('copy', {}); }
    catch (e) { toast('Clipboard not available here. Use Download instead.'); }
  }));
  $('scaleChip').addEventListener('click', () => {
    if (!isPro()) { openPro('scale'); return; }
    state.scale2x = !state.scale2x; refreshProUI(); saveState();
  });
  $('zipBtn').addEventListener('click', () => withBusy($('zipBtn'), 'Rendering…', async () => {
    const all = allSlides(), n = all.length;
    if (n > FREE_SLIDES && !S.gate('slides')) return;
    if (n > MAX_SLIDES) { toast('Maximum ' + MAX_SLIDES + ' slides per export'); return; }
    const f = fmt(), files = [];
    for (let i = 0; i < n; i++) { const blob = await S.exportPNG(drawFn(i), f.w, f.h, { scale: exportScale(), download: false }); files.push({ name: slideName(i) + '.png', blob }); }
    await S.zip(files, 'carousel-' + n + '-slides'); toast('ZIP downloaded'); track('export_zip', { slides: n });
  }));
  $('pdfBtn').addEventListener('click', () => withBusy($('pdfBtn'), 'Building PDF…', async () => {
    if (!S.gate('pdf')) return;
    const all = allSlides(), n = all.length; if (n > MAX_SLIDES) { toast('Maximum ' + MAX_SLIDES + ' slides per export'); return; }
    const blob = await buildCarouselPDF(); S.download(blob, 'linkedin-carousel-' + n + '-pages.pdf'); toast('PDF downloaded'); track('export_pdf', { slides: n });
  }));
  async function buildCarouselPDF() {
    const all = allSlides(), f = fmt(), sc = exportScale(), imgs = [];
    for (let i = 0; i < all.length; i++) {
      const blob = await S.exportPNG(drawFn(i), f.w, f.h, { scale: sc, download: false, type: 'image/jpeg', quality: 0.92 });
      imgs.push({ bytes: new Uint8Array(await blob.arrayBuffer()), w: Math.round(f.w * sc), h: Math.round(f.h * sc) });
    }
    return makePDF(imgs, f.w * 0.75, f.h * 0.75);
  }
  // Minimal PDF writer: one JPEG XObject per page, no external library.
  function makePDF(images, pw, ph) {
    const enc = new TextEncoder(); const parts = []; let len = 0; const offsets = [];
    const push = s => { const b = typeof s === 'string' ? enc.encode(s) : s; parts.push(b); len += b.length; };
    push('%PDF-1.4\n'); push(new Uint8Array([0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A]));
    const n = images.length; const num = s => (Math.round(s * 100) / 100).toString();
    const addObj = (id, body) => { offsets[id] = len; push(id + ' 0 obj\n'); (Array.isArray(body) ? body : [body]).forEach(push); push('\nendobj\n'); };
    addObj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    addObj(2, '<< /Type /Pages /Kids [' + images.map((_, i) => (3 + i * 3) + ' 0 R').join(' ') + '] /Count ' + n + ' >>');
    images.forEach((im, i) => {
      const p = 3 + i * 3, c = p + 1, x = p + 2;
      addObj(p, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + num(pw) + ' ' + num(ph) + '] /Resources << /XObject << /Im0 ' + x + ' 0 R >> >> /Contents ' + c + ' 0 R >>');
      const content = 'q ' + num(pw) + ' 0 0 ' + num(ph) + ' 0 0 cm /Im0 Do Q';
      addObj(c, '<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream');
      addObj(x, ['<< /Type /XObject /Subtype /Image /Width ' + im.w + ' /Height ' + im.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + im.bytes.length + ' >>\nstream\n', im.bytes, '\nendstream']);
    });
    const total = 3 + n * 3, xrefPos = len;
    let xref = 'xref\n0 ' + total + '\n0000000000 65535 f \n';
    for (let i = 1; i < total; i++) xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
    push(xref); push('trailer\n<< /Size ' + total + ' /Root 1 0 R >>\nstartxref\n' + xrefPos + '\n%%EOF\n');
    return new Blob(parts, { type: 'application/pdf' });
  }
  window.__cmBuildPDF = buildCarouselPDF; window.__cmDraw = drawSlide; // used by tests / power users

  // ---------- pro UI ----------
  function refreshProUI() {
    const pro = isPro();
    document.querySelectorAll('[data-pro-only]').forEach(el => el.classList.toggle('hidden', pro));
    const chip = $('scaleChip'); if (!pro) state.scale2x = false; chip.classList.toggle('active', pro && state.scale2x); chip.setAttribute('aria-pressed', pro && state.scale2x ? 'true' : 'false');
    $('exportHint').textContent = pro ? 'Pro active: no watermark · up to ' + MAX_SLIDES + ' slides per ZIP / PDF' + (state.scale2x ? ' · 2x (' + fmt().w * 2 + ' px wide)' : '') : 'Free: PNG with a small watermark · ZIP up to ' + FREE_SLIDES + ' slides. Pro: no watermark, ' + MAX_SLIDES + ' slides, 2x, PDF.';
    renderKits();
  }
  document.addEventListener('pro:changed', () => { refreshProUI(); render(); });

  // ---------- init ----------
  function init() {
    $('proPrice').textContent = C.PRO_PRICE || '$12'; document.querySelectorAll('[data-pro-price]').forEach(el => el.textContent = C.PRO_PRICE || '$12');
    textEl.value = slidesToText(state.slides);
    $('ctaOn').checked = !!state.cta.on; $('ctaFields').classList.toggle('hidden', !state.cta.on); $('ctaText').value = state.cta.text; $('ctaSub').value = state.cta.sub;
    buildTiles(); syncThemePanel(); syncBrandPanel(); fmtSeg.set(state.format); $('sizeLabel').textContent = fmt().label;
    refreshProUI(); syncSlidePanel(); render();
    window.addEventListener('resize', S.debounce(render, 200));
  }
  init();
})();
