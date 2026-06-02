"use client";
import { useEffect, useRef, useState, useCallback } from "react";

type UIState = "intro" | "playing-zoom" | "spheres" | "playing-rewind" | "oblique" | "playing-collision" | "postcollision" | "subpage";
type SubPageType = "cern" | "orchestra" | "pallavolo";

export default function Page() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ui, setUI] = useState<UIState>("intro");
  const [uiVisible, setUIV] = useState(true);
  const [activeSub, setActiveSub] = useState<SubPageType | null>(null);
  const uiRef = useRef<UIState>("intro");

  const setUIBoth = (state: UIState) => {
    uiRef.current = state;
    setUI(state);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onEnded = () => {
      const current = uiRef.current;
      if (current === "playing-zoom") { setUIBoth("spheres"); setUIV(true); }
      else if (current === "playing-rewind") { setUIBoth("oblique"); setUIV(true); }
      else if (current === "playing-collision") { setUIBoth("postcollision"); setUIV(true); }
    };
    video.addEventListener("ended", onEnded);
    return () => video.removeEventListener("ended", onEnded);
  }, []);

  const playVideo = useCallback((src: string, newState: UIState) => {
    const video = videoRef.current;
    if (!video) return;
    video.src = src;
    video.currentTime = 0;
    video.play().catch(() => {});
    setUIBoth(newState);
  }, []);

  const goForward = useCallback(() => {
    const current = uiRef.current;
    if (current === "subpage") return;
    if (current === "intro") { setUIV(false); setTimeout(() => playVideo("/videos/zoom.mp4", "playing-zoom"), 400); }
    if (current === "spheres") { setUIV(false); setTimeout(() => playVideo("/videos/rewind.mp4", "playing-rewind"), 300); }
    if (current === "oblique") { setUIV(false); setTimeout(() => playVideo("/videos/collision.mp4", "playing-collision"), 300); }
  }, [playVideo]);

  const goBack = useCallback(() => {
    const current = uiRef.current;
    if (current === "subpage") return;
    const video = videoRef.current;
    if (current === "spheres") {
      setUIV(false);
      setTimeout(() => {
        if (video) { video.pause(); video.src = ""; }
        setUIBoth("intro"); setUIV(true);
      }, 300);
    }
    if (current === "oblique") {
      setUIV(false);
      setTimeout(() => {
        if (video) { video.pause(); video.src = ""; }
        setUIBoth("spheres"); setUIV(true);
      }, 300);
    }
    if (current === "postcollision") {
      setUIV(false);
      setTimeout(() => {
        if (video) { video.pause(); video.src = ""; }
        setUIBoth("oblique"); setUIV(true);
      }, 300);
    }
  }, []);

  // ── TASTIERA ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (uiRef.current === "subpage") return;
      if (e.code === "Space") { e.preventDefault(); goForward(); }
      if (e.code === "ArrowLeft" || e.code === "Backspace") { e.preventDefault(); goBack(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goForward, goBack]);

  // ── TOUCH (mobile) ────────────────────────────────────────────────────────
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const touchStartTarget = useRef<EventTarget | null>(null);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      touchStartTarget.current = e.target;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (uiRef.current === "subpage") return;
      // ignora se il touch è partito da una card o bottone
      const target = touchStartTarget.current as HTMLElement | null;
      if (target && (target.closest(".card") || target.closest(".mob-btn") || target.closest(".sub-close"))) return;

      const dx = e.changedTouches[0].clientX - touchStartX.current;
      const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
      if (Math.abs(dx) > 60 && dy < 60) {
        if (dx < 0) goForward();
        else goBack();
      } else if (Math.abs(dx) < 15 && dy < 15) {
        goForward();
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [goForward, goBack]);

  // ── SOTTOPAGINE ───────────────────────────────────────────────────────────
  const openSub = (page: SubPageType) => { setUIBoth("subpage"); setActiveSub(page); };
  const closeSub = () => { setUIBoth("spheres"); setActiveSub(null); setUIV(true); };

  const bgImage = () => {
    if (ui === "intro" || ui === "playing-zoom") return "/images/intro.jpg";
    if (ui === "spheres" || ui === "playing-rewind" || ui === "subpage") return "/images/sfere.jpg";
    if (ui === "oblique" || ui === "playing-collision") return "/images/oblique.jpg";
    if (ui === "postcollision") return "/images/final.jpg";
    return "/images/intro.jpg";
  };

  const isPlaying = ui === "playing-zoom" || ui === "playing-rewind" || ui === "playing-collision";
  const isBlurred = ui === "subpage";
  const isShifted = ui === "spheres";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400;1,600;1,700&family=Rajdhani:wght@300;400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        html, body { background:#000; overflow:hidden; width:100vw; height:100vh; }
        .scene { position:fixed; inset:0; width:100vw; height:100vh; }
        .bg-image { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; transition: transform 1.5s cubic-bezier(0.2, 0.8, 0.2, 1), filter 1s ease, opacity 0.4s ease; z-index:0; }
        .bg-image--shifted { transform: translateY(3vh) scale(1.03); }
        .bg-image--blurred { transform: scale(1.05); filter: blur(25px) brightness(0.35); }
        .bg-image--hidden  { opacity:0; }
        .main-video { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; z-index:1; opacity:0; transition: opacity 0.4s ease; pointer-events:none; }
        .main-video--visible { opacity:1; }
        .ui-layer { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; transition: opacity 0.35s ease; z-index:10; }
        .ui-layer--hidden { opacity:0; pointer-events:none; }

        /* INTRO */
        .intro-wrap { position:absolute; bottom:12vh; left:4vw; pointer-events:none; filter: drop-shadow(0px 4px 24px rgba(0,0,0,0.95)); max-width: 85vw; }
        .intro-eye { font-family:'Rajdhani',sans-serif; font-weight:400; font-size:clamp(0.68rem,1vw,0.85rem); color:rgba(125,244,255,0.45); letter-spacing:0.35em; text-transform:uppercase; margin-bottom:1.5rem; }
        .intro-title { font-family:'Cormorant Garamond',serif; font-weight:400; font-size:clamp(3rem, 6.5vw, 6rem); color:#ffffff; letter-spacing:-0.03em; text-transform:none; line-height:0.95; }
        .intro-accent { font-style:italic; font-weight:700; color:rgba(125,244,255,0.9); padding-right:0.1em; }
        .intro-bold-blue { font-weight:700; color:rgba(125,244,255,0.9); }
        .intro-sub { display:block; font-family:'Cormorant Garamond',serif; font-style:italic; font-weight:300; font-size:clamp(1.2rem, 1.8vw, 1.6rem); color:rgba(255,255,255,0.65); letter-spacing:0.02em; text-transform:none; margin-top:2.5rem; border-left:1px solid rgba(125,244,255,0.3); padding-left:1rem; }
        .pulse-hint { position:absolute; bottom:5.5vh; left:50%; transform:translateX(-50%); display:flex; flex-direction:column; align-items:center; gap:6px; pointer-events:none; }
        .pulse-bar { width:1px; height:42px; background:rgba(125,244,255,0.35); animation:pulsebar 2.2s ease-in-out infinite; }
        .pulse-label { font-family:'Rajdhani',sans-serif; font-size:0.56rem; letter-spacing:0.38em; color:rgba(125,244,255,0.32); text-transform:uppercase; }
        @keyframes pulsebar { 0%,100%{opacity:0.15;transform:scaleY(0.5)} 50%{opacity:0.7;transform:scaleY(1)} }

        /* SFERE */
        .pin { position:absolute; display:flex; align-items:center; gap:14px; opacity:0; animation:pinIn 0.65s ease forwards; pointer-events:auto; }
        @keyframes pinIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .pin--orchestra { top:16%; left:38%; animation-delay:0.2s; }
        .pin--cern      { top:50%; left:58%; animation-delay:0.08s; }
        .pin--pallavolo { top:62%; left:22%; animation-delay:0.35s; }
        .pin__line { height:1px; width:4.5vw; min-width:40px; }
        .line-to-right { background:linear-gradient(to right, rgba(125,244,255,0.45), transparent); }
        .line-to-left  { background:linear-gradient(to left, rgba(125,244,255,0.45), transparent); }
        .card { background:rgba(4,12,22,0.45); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px); border:1px solid rgba(125,244,255,0.25); padding:1.25rem 1.6rem 1.35rem; text-decoration:none; display:block; transition:border-color 0.4s, background 0.4s, transform 0.35s, filter 0.4s; min-width:185px; cursor:pointer; }
        .card:hover { border-color:rgba(125,244,255,0.6); background:rgba(4,18,32,0.6); transform:translateY(-5px); filter:drop-shadow(0 0 18px rgba(125,244,255,0.35)); }
        .card__idx { font-family:'Cormorant Garamond',serif; font-style:italic; font-size:0.7rem; color:rgba(125,244,255,0.45); letter-spacing:0.28em; margin-bottom:0.25rem; }
        .card__name { font-family:'Rajdhani',sans-serif; font-weight:400; font-size:clamp(1.05rem,1.8vw,1.4rem); color:rgba(255,255,255,0.95); letter-spacing:0.15em; text-transform:uppercase; margin-bottom:0.2rem; }
        .card__note { font-family:'Cormorant Garamond',serif; font-style:italic; font-size:0.8rem; color:rgba(255,255,255,0.4); }
        .card__cta { margin-top:0.75rem; font-family:'Rajdhani',sans-serif; font-size:0.65rem; letter-spacing:0.3em; color:rgba(125,244,255,0.35); text-transform:uppercase; transition:color 0.3s; }
        .card:hover .card__cta { color:rgba(125,244,255,0.75); }

        /* contenitore mobile per le sfere */
        .spheres-mobile-row {
          display: contents;
        }

        /* PORTRAIT mobile */
        @media (max-width: 600px) and (orientation: portrait) {
          .spheres-mobile-row {
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
            align-items: center;
            gap: 6px;
            position: absolute;
            bottom: 48px;
            left: 0; right: 0;
            z-index: 15;
            padding: 0 3vw;
          }
          .pin { position: static !important; transform: none !important; width: 100%; max-width: 320px; }
          .pin__line { display: none; }
          .card { min-width: 0; width: 100%; padding: 0.6rem 1rem; background:rgba(4,12,22,0.75); }
          .card__note { display: none; }
          .card__cta  { display: none; }
          .card__name { font-size: 0.85rem; }
        }

        /* LANDSCAPE mobile */
        @media (orientation: landscape) and (max-height: 500px) {
          .spheres-mobile-row {
            display: flex;
            flex-direction: row;
            justify-content: center;
            align-items: flex-end;
            gap: 8px;
            position: absolute;
            bottom: 48px;
            left: 0; right: 0;
            z-index: 15;
            padding: 0 4vw;
          }
          .mobile-controls { display: block; }
          .pin { position: static !important; transform: none !important; flex: 1; max-width: 160px; }
          .pin__line { display: none; }
          .card { min-width: 0; padding: 0.4rem 0.6rem; background:rgba(4,12,22,0.75); text-align:center; }
          .card__note { display: none; }
          .card__cta  { display: none; }
          .card__idx  { display: none; }
          .card__name { font-size: 0.7rem; letter-spacing: 0.08em; margin-bottom: 0; }
        }

        .nav-hint { position:absolute; bottom:5vh; left:50%; transform:translateX(-50%); font-family:'Rajdhani',sans-serif; font-size:0.55rem; letter-spacing:0.38em; color:rgba(125,244,255,0.28); text-transform:uppercase; pointer-events:none; white-space:nowrap; }
        .back-hint { position:absolute; bottom:5vh; right:5vw; font-family:'Rajdhani',sans-serif; font-size:0.55rem; letter-spacing:0.32em; color:rgba(255,255,255,0.16); text-transform:uppercase; pointer-events:none; }

        /* POST COLLISIONE */
        .post-wrap { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; padding:0 10vw; pointer-events:none; background:radial-gradient(ellipse 80% 75% at 50% 50%, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.0) 100%); }
        .post-block { max-width:72vw; text-align:center; display:flex; flex-direction:column; align-items:center; gap:0; }
        .post-question { font-family:'Cormorant Garamond',serif; font-style:italic; font-weight:400; font-size:clamp(2.4rem, 5vw, 5.6rem); color:#ffffff; line-height:1.22; letter-spacing:-0.01em; text-shadow: 0 2px 4px rgba(0,0,0,1), 0 4px 16px rgba(0,0,0,0.95), 0 8px 40px rgba(0,0,0,0.9), 0 0 80px rgba(0,0,0,0.8), 0 0 120px rgba(0,4,8,0.7); }
        .post-question em { color:rgba(125,244,255,1); font-style:italic; text-shadow: 0 2px 4px rgba(0,0,0,1), 0 4px 20px rgba(0,0,0,0.95), 0 0 40px rgba(125,244,255,0.25); }
        .post-question-break { display:block; height:clamp(1.6rem, 2.8vw, 2.6rem); }
        .post-question-small { font-family:'Cormorant Garamond',serif; font-style:italic; font-weight:300; font-size:clamp(1.5rem, 2.8vw, 3rem); color:rgba(125,244,255,0.7); line-height:1.3; margin-top:clamp(1rem, 2vw, 2rem); letter-spacing:0.04em; text-shadow: 0 2px 6px rgba(0,0,0,1), 0 4px 20px rgba(0,0,0,0.95), 0 0 50px rgba(125,244,255,0.2); }
        .post-nav { margin-top:6vh; font-family:'Rajdhani',sans-serif; font-size:0.55rem; letter-spacing:0.38em; color:rgba(125,244,255,0.28); text-transform:uppercase; pointer-events:none; text-shadow:0 1px 8px rgba(0,0,0,0.9); }

        /* SOTTOPAGINE */
        .sub-window { position:fixed; inset:0; width:100vw; height:100vh; display:grid; grid-template-columns:1.1fr 1.3fr; padding:8vh 6vw; gap:6vw; z-index:50; pointer-events:auto; overflow-y:auto; }
        .sub-close { position:absolute; top:4vh; left:6vw; background:none; border:none; font-family:'Rajdhani',sans-serif; font-size:0.65rem; color:rgba(255,255,255,0.4); letter-spacing:0.35em; text-transform:uppercase; cursor:pointer; transition:color 0.3s, transform 0.3s; }
        .sub-close:hover { color:#7df4ff; transform:translateX(-4px); }
        .sub-left-content { display:flex; flex-direction:column; justify-content:center; }
        .sub-tag { font-family:'Rajdhani',sans-serif; font-size:0.65rem; color:#7df4ff; opacity:0.6; letter-spacing:0.4em; text-transform:uppercase; margin-bottom:1.5rem; }
        .sub-headline { font-family:'Cormorant Garamond',serif; font-weight:300; font-size:clamp(2rem, 3.8vw, 3.6rem); color:#fff; line-height:1.05; letter-spacing:-0.01em; margin-bottom:2.5rem; }
        .sub-text { font-family:'Cormorant Garamond',serif; font-style:italic; font-size:clamp(1.05rem, 1.4vw, 1.3rem); color:rgba(255,255,255,0.5); line-height:1.75; }
        .photo-grid { position:relative; width:100%; height:100%; display:flex; align-items:center; justify-content:center; }
        .sub-img { position:absolute; object-fit:cover; border:1px solid rgba(255,255,255,0.15); filter:drop-shadow(0 15px 35px rgba(0,0,0,0.8)); transition:transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.4s; }
        .sub-img:hover { transform: scale(1.03) translateY(-5px) !important; border-color:rgba(125,244,255,0.4); z-index:10 !important; }
        .img-cern-1 { width:55%; height:45%; top:10%; left:0; z-index:2; }
        .img-cern-2 { width:32%; height:55%; bottom:8%; right:5%; z-index:1; }
        .img-orch-1 { width:42%; height:45%; top:2%; left:2%; z-index:2; }
        .img-orch-2 { width:34%; height:58%; top:8%; right:0; z-index:1; }
        .img-orch-3 { width:55%; height:38%; bottom:4%; left:10%; z-index:3; }
        .img-vly-1 { width:32%; height:62%; top:8%; left:5%; z-index:1; }
        .img-vly-2 { width:45%; height:35%; top:5%; right:0; z-index:2; }
        .img-vly-3 { width:48%; height:38%; bottom:5%; right:10%; z-index:3; }

        /* MOBILE */
        .mobile-controls { display:none; position:fixed; bottom:0; left:0; right:0; z-index:20; padding:0 0 env(safe-area-inset-bottom,0); pointer-events:none; }
        .mobile-bar { display:flex; align-items:stretch; height:40px; background:rgba(0,0,0,0.45); backdrop-filter:blur(12px); border-top:1px solid rgba(125,244,255,0.08); }
        .mob-btn { flex:1; background:none; border:none; color:rgba(125,244,255,0.4); font-family:'Rajdhani',sans-serif; font-size:0.5rem; letter-spacing:0.28em; text-transform:uppercase; cursor:pointer; pointer-events:auto; transition:background 0.2s, color 0.2s; display:flex; align-items:center; justify-content:center; gap:6px; }
        .mob-btn:active { background:rgba(125,244,255,0.08); color:rgba(125,244,255,0.9); }
        .mob-btn--fwd { border-left:1px solid rgba(125,244,255,0.08); }
        .mob-divider { width:1px; background:rgba(125,244,255,0.08); flex-shrink:0; }
        .hint-desktop { display:inline; }
        .hint-mobile  { display:none; }

        @media (hover: none) and (pointer: coarse) {
          .mobile-controls { display:block; }
          .hint-desktop { display:none; }
          .hint-mobile  { display:inline; }
          .pulse-hint { bottom:calc(5.5vh + 40px); }
          .nav-hint   { bottom:calc(5vh + 40px); }
          .back-hint  { bottom:calc(5vh + 40px); }
          .post-nav   { margin-top:4vh; }
        }
      `}</style>

      <div className="scene">
        <img
          src={bgImage()}
          className={`bg-image${isShifted ? " bg-image--shifted" : ""}${isBlurred ? " bg-image--blurred" : ""}${isPlaying ? " bg-image--hidden" : ""}`}
          alt=""
        />

        <video
          ref={videoRef}
          className={`main-video${isPlaying ? " main-video--visible" : ""}`}
          playsInline
          preload="none"
        />

        <div className={`ui-layer${uiVisible ? "" : " ui-layer--hidden"}`}>

          {ui === "intro" && (
            <>
              <div className="intro-wrap">
                <p className="intro-eye">Esame di Stato · 2026</p>
                <h1 className="intro-title">
                  È possibile<br />
                  decodificare<br />
                  l&apos;<span className="intro-accent">esistenza</span><br />
                  nel <span className="intro-bold-blue">microscopico</span>?
                </h1>
                <span className="intro-sub">Come ogni collisione genera un percorso</span>
              </div>
              <div className="pulse-hint">
                <div className="pulse-bar" />
                <span className="pulse-label">
                  <span className="hint-desktop">spazio per iniziare</span>
                  <span className="hint-mobile">tocca per iniziare</span>
                </span>
              </div>
            </>
          )}

          {ui === "spheres" && (
            <>
              <div className="spheres-mobile-row">
                <div className="pin pin--orchestra">
                  <div className="card" onClick={() => openSub("orchestra")}>
                    <p className="card__idx">II.</p>
                    <p className="card__name">Orchestra</p>
                    <p className="card__note">quando il molteplice risuona</p>
                    <p className="card__cta">scopri →</p>
                  </div>
                  <div className="pin__line line-to-right" />
                </div>
                <div className="pin pin--cern">
                  <div className="card" onClick={() => openSub("cern")}>
                    <p className="card__idx">I.</p>
                    <p className="card__name">CERN</p>
                    <p className="card__note">ciò che esiste si rivela nell&apos;urto</p>
                    <p className="card__cta">scopri →</p>
                  </div>
                  <div className="pin__line line-to-right" />
                </div>
                <div className="pin pin--pallavolo">
                  <div className="pin__line line-to-left" />
                  <div className="card" onClick={() => openSub("pallavolo")}>
                    <p className="card__idx">III.</p>
                    <p className="card__name">Pallavolo</p>
                    <p className="card__note">l&apos;io come variabile dipendente</p>
                    <p className="card__cta">scopri →</p>
                  </div>
                </div>
              </div>
              <div className="nav-hint">
                <span className="hint-desktop">[ spazio ] continua · [ ← ] indietro</span>
                <span className="hint-mobile">[ swipe o barra sotto ] naviga</span>
              </div>
            </>
          )}

          {ui === "oblique" && (
            <>
              <div className="nav-hint">
                <span className="hint-desktop">[ spazio ] esegui collisione</span>
                <span className="hint-mobile">[ tocca avanti ] esegui collisione</span>
              </div>
              <div className="back-hint">
                <span className="hint-desktop">← indietro</span>
                <span className="hint-mobile">indietro</span>
              </div>
            </>
          )}

          {ui === "postcollision" && (
            <div className="post-wrap">
              <div className="post-block">
                <p className="post-question">
                  Dopo ogni collisione,<br/>
                  la materia non torna com&apos;era.
                  <span className="post-question-break"/>
                  Non perché sia <em>cambiata</em>.<br/>
                  Perché finalmente si è <em>vista</em>.
                  <span className="post-question-break"/>
                  E adesso —
                </p>
                <p className="post-question-small">verso cosa, adesso?</p>
                <div className="post-nav">
                  <span className="hint-desktop">[ ← ] riavvolgi l&apos;impatto</span>
                  <span className="hint-mobile">riavvolgi l&apos;impatto</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {ui === "subpage" && activeSub && (
          <div className="sub-window">
            <button className="sub-close" onClick={closeSub}>← Torna alla plancia</button>
            {activeSub === "cern" && (
              <>
                <div className="sub-left-content">
                  <p className="sub-tag">Sezione I // Ricerca & Struttura</p>
                  <h2 className="sub-headline">Ciò che Esiste<br/>si Rivela nell&apos;Urto</h2>
                  <p className="sub-text">Nel tunnel, nulla viene creato. Viene estratto — strappato alla simmetria originaria con energia sufficiente a rompere ciò che sembrava intero. Ho capito al CERN che capire la realtà non significa osservarla: significa avere il coraggio di distruggerla per vedere cosa rimane. Le discipline scientifiche sono i miei acceleratori: vettori con cui forzo la materia del reale fino a che non rivela la propria struttura.</p>
                </div>
                <div className="photo-grid">
                  <img src="/personal/cern_1.jpg" className="sub-img img-cern-1" alt="Cern Tunnel" />
                  <img src="/personal/cern_2.jpg" className="sub-img img-cern-2" alt="Cern Red Elevator" />
                </div>
              </>
            )}
            {activeSub === "orchestra" && (
              <>
                <div className="sub-left-content">
                  <p className="sub-tag">Sezione II // Geometria del Suono</p>
                  <h2 className="sub-headline">Quando il Molteplice<br/>Risuona</h2>
                  <p className="sub-text">Ogni corda vibra secondo equazioni precise — frequenza, tensione, risonanza. Ma la musica non emerge dalla fisica: emerge dall&apos;accordo tra corpi distinti che rinunciano al proprio caos individuale. Suonare in orchestra è stato il primo esperimento in cui ho capito che la complessità non si controlla, si abita. L&apos;armonia non è un punto di arrivo: è una legge che si sceglie di rispettare.</p>
                </div>
                <div className="photo-grid">
                  <img src="/personal/orchestra_1.jpg" className="sub-img img-orch-1" alt="Concerto Chiesa" />
                  <img src="/personal/orchestra_3.jpg" className="sub-img img-orch-2" alt="Fiori e Violino" />
                  <img src="/personal/orchestra_2.jpg" className="sub-img img-orch-3" alt="Concerto Piazza" />
                </div>
              </>
            )}
            {activeSub === "pallavolo" && (
              <>
                <div className="sub-left-content">
                  <p className="sub-tag">Sezione III // Dinamica dei Corpi</p>
                  <h2 className="sub-headline">L&apos;Io come<br/>Variabile Dipendente</h2>
                  <p className="sub-text">Ogni schiacciata è un vettore — direzione, modulo, intensità. Ma nessun vettore agisce nel vuoto: ogni gesto è la risposta a un campo di forze umane in continua ridefinizione. Ho imparato sul parquet che la forza individuale è nulla senza la sincronizzazione della squadra. Il campo da gioco è stato il laboratorio in cui ho scoperto che l&apos;io non è una costante: è una funzione degli altri.</p>
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

        {ui !== "subpage" && (
          <div className="mobile-controls">
            <div className="mobile-bar">
              <button className="mob-btn" onClick={goBack}>← indietro</button>
              <div className="mob-divider" />
              <button className="mob-btn mob-btn--fwd" onClick={goForward}>avanti →</button>
            </div>
          </div>
        )}

      </div>
    </>
  );
}