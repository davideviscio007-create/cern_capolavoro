"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";

// ── costanti ──────────────────────────────────────────────────────────────────
const ZOOM_TOTAL      = 314;
const REWIND_TOTAL    = 158;
const COLLISION_TOTAL = 554; // Sincronizzato con la tua nuova estrazione a 60fps
const FPS             = 60;
const MS_PER_FRAME    = 1000 / FPS;
const CROSSFADE_MS    = 280; // durata crossfade in ms

const pad  = (n: number) => String(n).padStart(4, "0");
const zSrc = (i: number) => `/frames/zoom/zoom_frame_${pad(i)}.jpg`;
const rSrc = (i: number) => `/frames/rewind/rewind_frame_${pad(i)}.jpg`;
const cSrc = (i: number) => `/frames/collision/collision_frame_${pad(i)}.jpg`;

// cache immagini in memoria
const imgCache = new Map<string, HTMLImageElement>();

function loadImg(src: string): Promise<HTMLImageElement> {
  if (imgCache.has(src)) return Promise.resolve(imgCache.get(src)!);
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload  = () => { imgCache.set(src, img); res(img); };
    img.onerror = rej;
    img.src = src;
  });
}

function preloadBatch(srcs: string[]) {
  srcs.forEach(s => loadImg(s).catch(() => {}));
}

// ── tipi ──────────────────────────────────────────────────────────────────────
type Sequence = "zoom" | "rewind" | "collision";
type UIState  = "intro" | "spheres" | "oblique" | "postcollision" | "subpage";
type SubPageType = "cern" | "orchestra" | "pallavolo";

interface AnimState {
  seq:   Sequence;
  frame: number;        // frame corrente (1-based)
  total: number;
  dir:   1 | -1;        // 1=avanti, -1=indietro
  getSrc: (i: number) => string;
}

export default function Page() {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const stateRef   = useRef<{
    anim:       AnimState;
    ui:         UIState;
    locked:     boolean;
    rafId:      number;
    lastTime:   number;
    crossfade:  { active: boolean; progress: number; fromImg: HTMLImageElement | null };
  }>({
    anim:      { seq:"zoom", frame:1, total:ZOOM_TOTAL, dir:1, getSrc:zSrc },
    ui:        "intro",
    locked:    false,
    rafId:     0,
    lastTime:  0,
    crossfade: { active:false, progress:0, fromImg:null },
  });

  const [ui, setUI]         = useState<UIState>("intro");
  const [uiVisible, setUIV] = useState(true);
  const [activeSub, setActiveSub] = useState<SubPageType | null>(null);

  // ── object-fit cover per canvas ──────────────────────────────────────────
  const coverRect = useCallback((
    canvas: HTMLCanvasElement,
    img: HTMLImageElement
  ): [number, number, number, number] => {
    const cw = canvas.width;
    const ch = canvas.height;
    const iw = img.naturalWidth  || img.width;
    const ih = img.naturalHeight || img.height;
    const scale = Math.max(cw / iw, ch / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (cw - dw) / 2;
    const dy = (ch - dh) / 2;
    return [dx, dy, dw, dh];
  }, []);

  // ── disegna frame sul canvas ──────────────────────────────────────────────
  const draw = useCallback((img: HTMLImageElement, alpha = 1, overImg?: HTMLImageElement | null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (overImg && alpha < 1) {
      ctx.globalAlpha = 1 - alpha;
      const [ox, oy, ow, oh] = coverRect(canvas, overImg);
      ctx.drawImage(overImg, ox, oy, ow, oh);
      ctx.globalAlpha = alpha;
      const [ix, iy, iw, ih] = coverRect(canvas, img);
      ctx.drawImage(img, ix, iy, iw, ih);
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = alpha;
      const [ix, iy, iw, ih] = coverRect(canvas, img);
      ctx.drawImage(img, ix, iy, iw, ih);
      ctx.globalAlpha = 1;
    }
  }, [coverRect]);

  // ── resize canvas con devicePixelRatio ───────────────────────────────────
  useEffect(() => {
    const resize = () => {
      const c = canvasRef.current;
      if (!c) return;
      const dpr = window.devicePixelRatio || 1;
      const w   = window.innerWidth;
      const h   = window.innerHeight;
      c.width  = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      c.style.width  = `${w}px`;
      c.style.height = `${h}px`;
      const ctx = c.getContext("2d");
      if (ctx) ctx.setTransform(1, 0, 0, 1, 0, 0);

      // ridisegna frame corrente — il resize svuota il canvas in HTML5
      const s = stateRef.current;
      const currentSrc = s.anim.getSrc(s.anim.frame);
      const img = imgCache.get(currentSrc);
      if (img) draw(img);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [draw]);

  // ── loop principale rAF ───────────────────────────────────────────────────
  const startLoop = useCallback(() => {
    const s = stateRef.current;
    if (s.rafId) cancelAnimationFrame(s.rafId);
    s.lastTime = 0;

    const loop = (time: number) => {
      if (s.lastTime === 0) s.lastTime = time;
      const elapsed = time - s.lastTime;

      if (elapsed >= MS_PER_FRAME) {
        s.lastTime = time;
        const { anim, crossfade } = s;

        if (crossfade.active) {
          crossfade.progress += elapsed / CROSSFADE_MS;
          if (crossfade.progress >= 1) {
            crossfade.active    = false;
            crossfade.progress  = 0;
            crossfade.fromImg   = null;
          }
          const toImg = imgCache.get(anim.getSrc(anim.frame));
          if (toImg) draw(toImg, Math.min(crossfade.progress, 1), crossfade.fromImg);
        } else {
          const next = anim.frame + anim.dir;
          const done = anim.dir === 1 ? next > anim.total : next < 1;

          if (done) {
            s.locked = false;
            const finalImg = imgCache.get(anim.getSrc(anim.frame));
            if (finalImg) draw(finalImg);

            if (anim.seq === "zoom" && anim.dir === 1) {
              s.ui = "spheres";
              setUI("spheres");
              setUIV(true);
              preloadBatch(Array.from({length:REWIND_TOTAL}, (_,i) => rSrc(i+1)));
            } else if (anim.seq === "zoom" && anim.dir === -1) {
              s.ui = "intro";
              setUI("intro");
              setUIV(true);
            } else if (anim.seq === "rewind" && anim.dir === 1) {
              s.ui = "oblique";
              setUI("oblique");
              setUIV(true);
              preloadBatch(Array.from({length:COLLISION_TOTAL}, (_,i) => cSrc(i+1)));
            } else if (anim.seq === "rewind" && anim.dir === -1) {
              s.ui = "spheres";
              setUI("spheres");
              setUIV(true);
            } else if (anim.seq === "collision" && anim.dir === 1) {
              s.ui = "postcollision";
              setUI("postcollision");
              setUIV(true);
            } else if (anim.seq === "collision" && anim.dir === -1) {
              s.ui = "oblique";
              setUI("oblique");
              setUIV(true);
            }
            cancelAnimationFrame(s.rafId);
            return;
          }

          anim.frame = next;

          const lookahead = anim.dir === 1
            ? Math.min(anim.frame + 45, anim.total)
            : Math.max(anim.frame - 45, 1);
          loadImg(anim.getSrc(lookahead)).catch(() => {});

          const img = imgCache.get(anim.getSrc(anim.frame));
          if (img) draw(img);
        }
      }

      s.rafId = requestAnimationFrame(loop);
    };

    s.rafId = requestAnimationFrame(loop);
  }, [draw]);

  // ── avvio: preload zoom e disegna frame 1 ────────────────────────────────
  useEffect(() => {
    preloadBatch(Array.from({length:90}, (_,i) => zSrc(i+1)));
    loadImg(zSrc(1)).then(img => draw(img));
  }, [draw]);

  // ── transizione con crossfade ─────────────────────────────────────────────
  const transition = useCallback((
    newSeq: Sequence,
    newDir: 1 | -1,
    newTotal: number,
    newGetSrc: (i: number) => string,
    startFrame: number
  ) => {
    const s = stateRef.current;
    if (s.locked) return;
    s.locked = true;

    const fromSrc = s.anim.getSrc(s.anim.frame);
    const fromImg = imgCache.get(fromSrc) || null;

    s.anim = { seq:newSeq, frame:startFrame, total:newTotal, dir:newDir, getSrc:newGetSrc };
    s.crossfade = { active:true, progress:0, fromImg };
    s.lastTime  = 0;

    startLoop();
  }, [startLoop]);

  // ── AVANTI ────────────────────────────────────────────────────────────────
  const goForward = useCallback(() => {
    const s = stateRef.current;
    if (s.locked || s.ui === "subpage") return;

    if (s.ui === "intro") {
      setUIV(false);
      setTimeout(() => {
        transition("zoom", 1, ZOOM_TOTAL, zSrc, 2);
      }, 650);
    }
    if (s.ui === "spheres") {
      setUIV(false);
      setTimeout(() => transition("rewind", 1, REWIND_TOTAL, rSrc, 1), 350);
    }
    if (s.ui === "oblique") {
      setUIV(false);
      setTimeout(() => transition("collision", 1, COLLISION_TOTAL, cSrc, 1), 300);
    }
  }, [transition]);

  // ── INDIETRO ──────────────────────────────────────────────────────────────
  const goBack = useCallback(() => {
    const s = stateRef.current;
    if (s.locked || s.ui === "subpage") return;

    if (s.ui === "spheres") {
      setUIV(false);
      setTimeout(() => transition("zoom", -1, ZOOM_TOTAL, zSrc, ZOOM_TOTAL), 300);
    }
    if (s.ui === "oblique") {
      setUIV(false);
      setTimeout(() => transition("rewind", -1, REWIND_TOTAL, rSrc, REWIND_TOTAL), 300);
    }
    if (s.ui === "postcollision") {
      setUIV(false);
      setTimeout(() => transition("collision", -1, COLLISION_TOTAL, cSrc, COLLISION_TOTAL), 300);
    }
  }, [transition]);

  // ── tastiera ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (stateRef.current.ui === "subpage") return;
      if (e.code === "Space")     { e.preventDefault(); goForward(); }
      if (e.code === "ArrowLeft" || e.code === "Backspace") { e.preventDefault(); goBack(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goForward, goBack]);

  // ── gestione sottomoduli personali ────────────────────────────────────────
  const openSub = (page: SubPageType) => {
    stateRef.current.ui = "subpage";
    setUI("subpage");
    setActiveSub(page);
  };

  const closeSub = () => {
    stateRef.current.ui = "spheres";
    setUI("spheres");
    setActiveSub(null);
    setUIV(true);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400;1,600;1,700&family=Rajdhani:wght@300;400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        html, body { background:#000; overflow:hidden; width:100vw; height:100vh; }

        .scene { position:fixed; inset:0; width:100vw; height:100vh; }

        /* ── CANVAS & BLUR SHIFT ── */
        canvas {
          position:absolute; inset:0;
          width:100%; height:100%;
          display:block;
          transition: transform 1.5s cubic-bezier(0.2, 0.8, 0.2, 1), filter 1s ease;
        }
        .canvas--shifted {
          transform: translateY(3vh) scale(1.03);
        }
        .canvas--blurred {
          transform: scale(1.05);
          filter: blur(25px) brightness(0.35);
        }

        .ui-layer {
          position:absolute; inset:0;
          width:100%; height:100%;
          pointer-events:none;
          transition: opacity 0.35s ease;
        }
        .ui-layer--hidden { opacity:0; pointer-events:none; }

        /* ── INTRO ── */
        .intro-wrap {
          position:absolute; bottom:12vh; left:4vw;
          pointer-events:none;
          filter: drop-shadow(0px 4px 24px rgba(0,0,0,0.95));
          max-width: 85vw;
        }
        .intro-eye {
          font-family:'Rajdhani',sans-serif;
          font-weight:400;
          font-size:clamp(0.68rem,1vw,0.85rem);
          color:rgba(125,244,255,0.45);
          letter-spacing:0.35em; text-transform:uppercase;
          margin-bottom:1.5rem;
        }
        .intro-title {
          font-family:'Cormorant Garamond',serif;
          font-weight:400;
          font-size:clamp(3rem, 6.5vw, 6rem);
          color:#ffffff;
          letter-spacing:-0.03em;
          text-transform:none;
          line-height:0.95;
        }
        .intro-accent {
          font-style:italic;
          font-weight:700;
          color: rgba(125,244,255,0.9);
          padding-right: 0.1em;
        }
        .intro-bold-blue {
          font-weight:700;
          color: rgba(125,244,255,0.9);
        }
        .intro-sub {
          display:block;
          font-family:'Cormorant Garamond',serif;
          font-style:italic;
          font-weight:300;
          font-size:clamp(1.2rem, 1.8vw, 1.6rem);
          color:rgba(255,255,255,0.65);
          letter-spacing:0.02em; text-transform:none;
          margin-top:2.5rem;
          border-left: 1px solid rgba(125,244,255,0.3);
          padding-left: 1rem;
        }

        .pulse-hint {
          position:absolute; bottom:5.5vh; left:50%;
          transform:translateX(-50%);
          display:flex; flex-direction:column; align-items:center; gap:6px;
          pointer-events:none;
        }
        .pulse-bar {
          width:1px; height:42px;
          background:rgba(125,244,255,0.35);
          animation:pulsebar 2.2s ease-in-out infinite;
        }
        .pulse-label {
          font-family:'Rajdhani',sans-serif;
          font-size:0.56rem; letter-spacing:0.38em;
          color:rgba(125,244,255,0.32); text-transform:uppercase;
        }
        @keyframes pulsebar {
          0%,100%{opacity:0.15;transform:scaleY(0.5)}
          50%{opacity:0.7;transform:scaleY(1)}
        }

        /* ── INTERFACCIA SFERE ── */
        .pin {
          position:absolute;
          display:flex; align-items:center; gap:14px;
          opacity:0;
          animation:pinIn 0.65s ease forwards;
          pointer-events:auto;
        }
        @keyframes pinIn {
          from{opacity:0;transform:translateY(12px)}
          to{opacity:1;transform:translateY(0)}
        }
        .pin--orchestra { top:16%; left:38%; animation-delay:0.2s; }
        .pin--cern      { top:50%; left:58%; animation-delay:0.08s; }
        .pin--pallavolo { top:62%; left:22%; animation-delay:0.35s; }

        .pin__line { height:1px; width:4.5vw; min-width:40px; }
        .line-to-right { background:linear-gradient(to right, rgba(125,244,255,0.45), transparent); }
        .line-to-left  { background:linear-gradient(to left, rgba(125,244,255,0.45), transparent); }

        .card {
          background:rgba(4,12,22,0.45);
          backdrop-filter:blur(16px);
          -webkit-backdrop-filter:blur(16px);
          border:1px solid rgba(125,244,255,0.25);
          padding:1.25rem 1.6rem 1.35rem;
          text-decoration:none; display:block;
          transition:border-color 0.4s, background 0.4s, transform 0.35s, filter 0.4s;
          min-width:185px;
          cursor:pointer;
        }
        .card:hover {
          border-color:rgba(125,244,255,0.6);
          background:rgba(4,18,32,0.6);
          transform:translateY(-5px);
          filter:drop-shadow(0 0 18px rgba(125,244,255,0.35));
        }
        .card__idx {
          font-family:'Cormorant Garamond',serif;
          font-style:italic; font-size:0.7rem;
          color:rgba(125,244,255,0.45); letter-spacing:0.28em;
          margin-bottom:0.25rem;
        }
        .card__name {
          font-family:'Rajdhani',sans-serif; font-weight:400;
          font-size:clamp(1.05rem,1.8vw,1.4rem);
          color:rgba(255,255,255,0.95);
          letter-spacing:0.15em; text-transform:uppercase;
          margin-bottom:0.2rem;
        }
        .card__note {
          font-family:'Cormorant Garamond',serif;
          font-style:italic; font-size:0.8rem;
          color:rgba(255,255,255,0.4);
        }
        .card__cta {
          margin-top:0.75rem;
          font-family:'Rajdhani',sans-serif;
          font-size:0.65rem; letter-spacing:0.3em;
          color:rgba(125,244,255,0.35); text-transform:uppercase;
          transition:color 0.3s;
        }
        .card:hover .card__cta { color:rgba(125,244,255,0.75); }

        .nav-hint {
          position:absolute; bottom:5vh; left:50%;
          transform:translateX(-50%);
          font-family:'Rajdhani',sans-serif;
          font-size:0.55rem; letter-spacing:0.38em;
          color:rgba(125,244,255,0.28); text-transform:uppercase;
          pointer-events:none;
        }
        .back-hint {
          position:absolute; bottom:5vh; right:5vw;
          font-family:'Rajdhani',sans-serif;
          font-size:0.55rem; letter-spacing:0.32em;
          color:rgba(255,255,255,0.16); text-transform:uppercase;
          pointer-events:none;
        }

        /* ── POST COLLISIONE ── */
        .post-wrap {
          position:absolute; inset:0;
          display:flex; align-items:center; justify-content:center;
          padding:0 10vw;
          pointer-events:none;
          background: radial-gradient(ellipse 80% 75% at 50% 50%, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.0) 100%);
        }
        .post-block {
          max-width:72vw;
          text-align:center;
          display:flex; flex-direction:column; align-items:center; gap:0;
        }
        .post-question {
          font-family:'Cormorant Garamond',serif;
          font-style:italic; font-weight:400;
          font-size:clamp(2.4rem, 5vw, 5.6rem);
          color:#ffffff;
          line-height:1.22;
          letter-spacing:-0.01em;
          text-shadow:
            0 2px 4px rgba(0,0,0,1),
            0 4px 16px rgba(0,0,0,0.95),
            0 8px 40px rgba(0,0,0,0.9),
            0 0 80px rgba(0,0,0,0.8),
            0 0 120px rgba(0,4,8,0.7);
        }
        .post-question em {
          color:rgba(125,244,255,1);
          font-style:italic;
          text-shadow:
            0 2px 4px rgba(0,0,0,1),
            0 4px 20px rgba(0,0,0,0.95),
            0 0 40px rgba(125,244,255,0.25);
        }
        .post-question-break {
          display:block;
          height:clamp(1.6rem, 2.8vw, 2.6rem);
        }
        .post-question-small {
          font-family:'Cormorant Garamond',serif;
          font-style:italic; font-weight:300;
          font-size:clamp(1.5rem, 2.8vw, 3rem);
          color:rgba(125,244,255,0.7);
          line-height:1.3;
          margin-top:clamp(1rem, 2vw, 2rem);
          letter-spacing:0.04em;
          text-shadow:
            0 2px 6px rgba(0,0,0,1),
            0 4px 20px rgba(0,0,0,0.95),
            0 0 50px rgba(125,244,255,0.2);
        }
        .post-nav {
          margin-top:6vh;
          font-family:'Rajdhani',sans-serif;
          font-size:0.55rem; letter-spacing:0.38em;
          color:rgba(125,244,255,0.28); text-transform:uppercase;
          pointer-events:none;
          text-shadow: 0 1px 8px rgba(0,0,0,0.9);
        }

        /* ── MODULI SOTTOPAGINE REALI (EDITORIALE ASIMMETRICO) ── */
        .sub-window {
          position:fixed; inset:0;
          width:100vw; height:100vh;
          display:grid; grid-template-columns:1.1fr 1.3fr;
          padding:8vh 6vw; gap:6vw;
          z-index:50; pointer-events:auto;
          overflow-y:auto;
        }
        .sub-close {
          position:absolute; top:4vh; left:6vw;
          background:none; border:none;
          font-family:'Rajdhani',sans-serif; font-size:0.65rem;
          color:rgba(255,255,255,0.4); letter-spacing:0.35em;
          text-transform:uppercase; cursor:pointer;
          transition:color 0.3s, transform 0.3s;
        }
        .sub-close:hover { color:#7df4ff; transform:translateX(-4px); }

        .sub-left-content { display:flex; flex-direction:column; justify-content:center; }
        .sub-tag {
          font-family:'Rajdhani',sans-serif; font-size:0.65rem;
          color:#7df4ff; opacity:0.6;
          letter-spacing:0.4em; text-transform:uppercase;
          margin-bottom:1.5rem;
        }
        .sub-headline {
          font-family:'Cormorant Garamond',serif; font-weight:300;
          font-size:clamp(2rem, 3.8vw, 3.6rem); color:#fff;
          line-height:1.05; letter-spacing:-0.01em; margin-bottom:2.5rem;
        }
        .sub-text {
          font-family:'Cormorant Garamond',serif; font-style:italic;
          font-size:clamp(1.05rem, 1.4vw, 1.3rem); color:rgba(255,255,255,0.5);
          line-height:1.75;
        }

        /* Composizioni fotografiche a mosaico */
        .photo-grid {
          position:relative; width:100%; height:100%;
          display:flex; align-items:center; justify-content:center;
        }
        
        /* Ripristiniamo il cover per far aderire i bordi senza spazi vuoti */
        .sub-img {
          position:absolute; object-fit:cover;
          border:1px solid rgba(255,255,255,0.15);
          filter: drop-shadow(0 15px 35px rgba(0,0,0,0.8));
          transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.4s;
        }
        .sub-img:hover {
          transform: scale(1.03) translateY(-5px) !important;
          border-color: rgba(125,244,255,0.4);
          z-index:10 !important;
        }

        /* ── GEOMETRIE SCULTPURE: ADATTATE ALLE TUE FOTO ── */
        
        /* CERN (1: Gruppo orizzontale, 2: Ascensore verticale) */
        .img-cern-1 { width:55%; height:45%; top:10%; left:0; z-index:2; }
        .img-cern-2 { width:32%; height:55%; bottom:8%; right:5%; z-index:1; }

        /* ORCHESTRA: Proporzioni reali calcolate sulle tue foto
           1: Enrico (orchestra_1.jpg) -> Quadrato perfetto
           2: Chiesa/Stupinigi (orchestra_3.jpg) -> Ritratto Verticale
           3: Piazza (orchestra_2.jpg) -> Paesaggio Orizzontale 
        */
        .img-orch-1 { width:42%; height:45%; top:2%; left:2%; z-index:2; }
        .img-orch-2 { width:34%; height:58%; top:8%; right:0; z-index:1; }
        .img-orch-3 { width:55%; height:38%; bottom:4%; left:10%; z-index:3; }
        /* PALLAVOLO (1: Azione Verticale, 2: Squadra Orizzontale, 3: Green Volley Orizzontale) */
        .img-vly-1 { width:32%; height:62%; top:8%; left:5%; z-index:1; }
        .img-vly-2 { width:45%; height:35%; top:5%; right:0; z-index:2; }
        .img-vly-3 { width:48%; height:38%; bottom:5%; right:10%; z-index:3; }
      `}</style>

      <div className="scene">

        {/* CANVAS CON GESTIONE INTRECCIATA DINAMICA DI SHIFT E BLUR */}
        <canvas 
          ref={canvasRef} 
          className={ui === "subpage" ? "canvas--blurred" : ui === "spheres" ? "canvas--shifted" : ""} 
        />

        {/* ── UI LAYER ── */}
        <div className={`ui-layer${uiVisible ? "" : " ui-layer--hidden"}`}>

          {/* INTRO */}
          {ui === "intro" && (
            <>
              <div className="intro-wrap">
                <p className="intro-eye">Esame di Stato · 2026</p>
                <h1 className="intro-title">
                  È possibile<br />
                  decodificare<br />
                  l'<span className="intro-accent">esistenza</span><br />
                  nel <span className="intro-bold-blue">microscopico</span>?
                </h1>
                <span className="intro-sub">Come ogni collisione genera un percorso</span>
              </div>
              <div className="pulse-hint">
                <div className="pulse-bar" />
                <span className="pulse-label">spazio per iniziare</span>
              </div>
            </>
          )}

          {/* SFERE (NAVIGAZIONE NUCLEI) */}
          {ui === "spheres" && (
            <>
              {/* ORCHESTRA */}
              <div className="pin pin--orchestra">
                <div className="card" onClick={() => openSub("orchestra")}>
                  <p className="card__idx">II.</p>
                  <p className="card__name">Orchestra</p>
                  <p className="card__note">quando il molteplice risuona</p>
                  <p className="card__cta">scopri →</p>
                </div>
                <div className="pin__line line-to-right" />
              </div>

              {/* CERN */}
              <div className="pin pin--cern">
                <div className="card" onClick={() => openSub("cern")}>
                  <p className="card__idx">I.</p>
                  <p className="card__name">CERN</p>
                  <p className="card__note">ciò che esiste si rivela nell'urto</p>
                  <p className="card__cta">scopri →</p>
                </div>
                <div className="pin__line line-to-right" />
              </div>

              {/* PALLAVOLO */}
              <div className="pin pin--pallavolo">
                <div className="pin__line line-to-left" />
                <div className="card" onClick={() => openSub("pallavolo")}>
                  <p className="card__idx">III.</p>
                  <p className="card__name">Pallavolo</p>
                  <p className="card__note">l'io come variabile dipendente</p>
                  <p className="card__cta">scopri →</p>
                </div>
              </div>

              <div className="nav-hint">[ spazio ] continua · [ ← ] indietro</div>
            </>
          )}

          {/* OBLIQUE */}
          {ui === "oblique" && (
            <>
              <div className="nav-hint">[ spazio ] esegui collisione</div>
              <div className="back-hint">← indietro</div>
            </>
          )}

          {/* POST COLLISIONE */}
          {ui === "postcollision" && (
            <div className="post-wrap">
              <div className="post-block">
                <p className="post-question">
                  Dopo ogni collisione,<br/>
                  la materia non torna com'era.
                  <span className="post-question-break"/>
                  Non perché sia <em>cambiata</em>.<br/>
                  Perché finalmente si è <em>vista</em>.
                  <span className="post-question-break"/>
                  E adesso —
                </p>
                <p className="post-question-small">verso cosa, adesso?</p>
                <div className="post-nav">[ ← ] riavvolgi l'impatto</div>
              </div>
            </div>
          )}

        </div>

        {/* ── SEZIONE SOTTOPAGINE PERSONALI (SUBPAGE ACTIVE) ── */}
        {ui === "subpage" && activeSub && (
          <div className="sub-window">
            <button className="sub-close" onClick={closeSub}>← Torna alla plancia</button>
            
            {/* CERN MODULE */}
            {activeSub === "cern" && (
              <>
                <div className="sub-left-content">
                  <p className="sub-tag">Sezione I // Ricerca & Struttura</p>
                  <h2 className="sub-headline">Ciò che Esiste<br/>si Rivela nell'Urto</h2>
                  <p className="sub-text">
                    Nel tunnel, nulla viene creato. Viene estratto — strappato alla simmetria originaria con energia sufficiente a rompere ciò che sembrava intero. Ho capito al CERN che capire la realtà non significa osservarla: significa avere il coraggio di distruggerla per vedere cosa rimane. Le discipline scientifiche sono i miei acceleratori: vettori con cui forzo la materia del reale fino a che non rivela la propria struttura.
                  </p>
                </div>
                <div className="photo-grid">
                  <img src="/personal/cern_1.jpg" className="sub-img img-cern-1" alt="Cern Tunnel" />
                  <img src="/personal/cern_2.jpg" className="sub-img img-cern-2" alt="Cern Red Elevator" />
                </div>
              </>
            )}

            {/* ORCHESTRA MODULE */}
            {activeSub === "orchestra" && (
              <>
                <div className="sub-left-content">
                  <p className="sub-tag">Sezione II // Geometria del Suono</p>
                  <h2 className="sub-headline">Quando il Molteplice<br/>Risuona</h2>
                  <p className="sub-text">
                    Ogni corda vibra secondo equazioni precise — frequenza, tensione, risonanza. Ma la musica non emerge dalla fisica: emerge dall'accordo tra corpi distinti che rinunciano al proprio caos individuale. Suonare in orchestra è stato il primo esperimento in cui ho capito che la complessità non si controlla, si abita. L'armonia non è un punto di arrivo: è una legge che si sceglie di rispettare.
                  </p>
                </div>
                <div className="photo-grid">
                  <img src="/personal/orchestra_1.jpg" className="sub-img img-orch-1" alt="Concerto Chiesa" />
                  <img src="/personal/orchestra_3.jpg" className="sub-img img-orch-2" alt="Fiori e Violino" />
                  <img src="/personal/orchestra_2.jpg" className="sub-img img-orch-3" alt="Concerto Piazza" />
                </div>
              </>
            )}

            {/* PALLAVOLO MODULE */}
            {activeSub === "pallavolo" && (
              <>
                <div className="sub-left-content">
                  <p className="sub-tag">Sezione III // Dinamica dei Corpi</p>
                  <h2 className="sub-headline">L'Io come<br/>Variabile Dipendente</h2>
                  <p className="sub-text">
                    Ogni schiacciata è un vettore — direzione, modulo, intensità. Ma nessun vettore agisce nel vuoto: ogni gesto è la risposta a un campo di forze umane in continua ridefinizione. Ho imparato sul parquet che la forza individuale è nulla senza la sincronizzazione della squadra. Il campo da gioco è stato il laboratorio in cui ho scoperto che l'io non è una costante: è una funzione degli altri.
                  </p>
                </div>
                <div className="photo-grid">
                  <img src="/personal/pallavolo_1.jpg" className="sub-img img-vly-1" alt="Battuta Salto" />
                  <img src="/personal/pallavolo_2.jpg" className="sub-img img-vly-2" alt="Squadra Campo" />
                  <img src="/personal/pallavolo_3.jpg" className="sub-img img-vly-3" alt="Green Volley Prato" />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}