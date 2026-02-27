/**
 * BHAISAUR — Mobile Responsive Edition
 * Uses CSS scale() to fit the game canvas on any screen size.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import './App.css';

// --- Roaming Bhai images (4 images from public/, each used twice = 8 total) ---
const BHAI_IMAGES = [
  "/bhai1.jpg", "/bhai2.jpg", "/bhai3.jpg", "/bhai4.jpg",
  "/bhai1.jpg", "/bhai2.jpg", "/bhai3.jpg", "/bhai4.jpg",
];

// Generate 8 roaming bhais with unique random starting positions & speeds
function makeRoamingBhais() {
  return BHAI_IMAGES.map((src, i) => ({
    id: i,
    src,
    // Start scattered around edges and middle zone
    x: 5 + Math.random() * 90,       // % of viewport width
    y: 20 + Math.random() * 60,       // % of viewport height — keeps them mid-zone
    vx: (Math.random() * 0.3 + 0.1) * (Math.random() > 0.5 ? 1 : -1),
    vy: (Math.random() * 0.2 + 0.08) * (Math.random() > 0.5 ? 1 : -1),
    rotate: Math.random() * 360,
    rotateSpeed: (Math.random() * 0.4 - 0.2),
    size: 48 + Math.floor(Math.random() * 24), // 48–72px
  }));
}

// Hook: animate roaming bhais around the container area
function useRoamingBhais() {
  const [bhais, setBhais] = useState(() => makeRoamingBhais());
  const rafRef = useRef(null);
  const bhaisRef = useRef(bhais);

  useEffect(() => {
    const animate = () => {
      bhaisRef.current = bhaisRef.current.map(b => {
        let { x, y, vx, vy, rotate, rotateSpeed, size } = b;
        const sizeVW = (size / window.innerWidth) * 100;
        const sizeVH = (size / window.innerHeight) * 100;

        x += vx;
        y += vy;
        rotate += rotateSpeed;

        // Bounce off edges — kept in mid zone vertically (15%–85%)
        if (x < 0)           { x = 0;              vx = Math.abs(vx); }
        if (x > 100 - sizeVW){ x = 100 - sizeVW;   vx = -Math.abs(vx); }
        if (y < 15)          { y = 15;              vy = Math.abs(vy); }
        if (y > 85 - sizeVH) { y = 85 - sizeVH;    vy = -Math.abs(vy); }

        return { ...b, x, y, vx, vy, rotate };
      });
      setBhais([...bhaisRef.current]);
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return bhais;
}

// --- GAME CONSTANTS (logical pixels, never change) ---
const GROUND_HEIGHT   = 60;
const PLAYER_WIDTH    = 80;
const PLAYER_HEIGHT   = 80;
const OBSTACLE_WIDTH  = 120;
const OBSTACLE_HEIGHT = 150;
const GRAVITY         = 0.6;
const JUMP_VELOCITY   = -16;
const INITIAL_SPEED   = 5;
const SPEED_INCREMENT = 0.004;
const MAX_SPEED       = 18;
const GAME_WIDTH      = 800;
const GAME_HEIGHT     = 500;

// Hook: compute scale so the game always fits the screen
function useGameScale() {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const compute = () => {
      const padding = 16;
      const scaleX = (window.innerWidth - padding * 2) / GAME_WIDTH;
      const scaleY = (window.innerHeight - 160) / GAME_HEIGHT;
      setScale(Math.min(scaleX, scaleY, 1));
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  return scale;
}

export default function Game() {
  const scale = useGameScale();
  const roamingBhais = useRoamingBhais();

  const [gameState, setGameState] = useState("idle");
  const [score, setScore]         = useState(0);
  const [hiScore, setHiScore]     = useState(0);
  const [playerY, setPlayerY]     = useState(0);
  const [obstacles, setObstacles] = useState([]);
  const [showRetry, setShowRetry] = useState(false);

  const rafRef          = useRef(null);
  const gameStateRef    = useRef("idle");
  const playerYRef      = useRef(0);
  const velocityRef     = useRef(0);
  const isJumpingRef    = useRef(false);
  const obstaclesRef    = useRef([]);
  const scoreRef        = useRef(0);
  const speedRef        = useRef(INITIAL_SPEED);
  const frameRef        = useRef(0);
  const nextObstacleIn  = useRef(100);

  const jumpSoundRef    = useRef(null);
  const videoRef        = useRef(null);
  const audioVersionRef = useRef(0);

  const playLaugh = () => {
    if (!jumpSoundRef.current) return;
    const audio = jumpSoundRef.current;
    audioVersionRef.current += 1;
    const v = audioVersionRef.current;
    audio.currentTime = 1.0;
    audio.play().catch(() => {});
    setTimeout(() => {
      if (!audio.paused && audioVersionRef.current === v) audio.pause();
    }, 1000);
  };

  const handleGameOver = useCallback(() => {
    gameStateRef.current = "dead";
    setGameState("dead");
    setHiScore(prev => Math.max(prev, scoreRef.current));
    setShowRetry(false);
    setTimeout(() => setShowRetry(true), 1500);
  }, []);

  const jump = useCallback(() => {
    if (isJumpingRef.current || gameStateRef.current !== "playing") return;
    isJumpingRef.current = true;
    velocityRef.current = JUMP_VELOCITY;
    playLaugh();
  }, []);

  const startGame = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    playerYRef.current    = 0;
    velocityRef.current   = 0;
    isJumpingRef.current  = false;
    obstaclesRef.current  = [];
    scoreRef.current      = 0;
    speedRef.current      = INITIAL_SPEED;
    frameRef.current      = 0;
    nextObstacleIn.current = 100;

    setScore(0);
    setPlayerY(0);
    setObstacles([]);
    setGameState("playing");
    gameStateRef.current = "playing";
  }, []);

  const checkCollision = (pY, obs) => {
    const px = 80 + 15;
    const py = GAME_HEIGHT - GROUND_HEIGHT - PLAYER_HEIGHT - pY + 15;
    const pw = PLAYER_WIDTH - 30;
    const ph = PLAYER_HEIGHT - 20;
    for (const ob of obs) {
      const ox = ob.x + 20;
      const oy = GAME_HEIGHT - GROUND_HEIGHT - OBSTACLE_HEIGHT + 20;
      const ow = OBSTACLE_WIDTH - 40;
      const oh = OBSTACLE_HEIGHT - 25;
      if (px < ox + ow && px + pw > ox && py < oy + oh && py + ph > oy) return true;
    }
    return false;
  };

  const gameLoop = useCallback(() => {
    if (gameStateRef.current !== "playing") return;

    frameRef.current++;
    velocityRef.current += GRAVITY;
    playerYRef.current  -= velocityRef.current;

    if (playerYRef.current <= 0) {
      playerYRef.current  = 0;
      velocityRef.current = 0;
      isJumpingRef.current = false;
    }

    if (speedRef.current < MAX_SPEED) speedRef.current += SPEED_INCREMENT;

    let currentObs = obstaclesRef.current
      .map(o => ({ ...o, x: o.x - speedRef.current }))
      .filter(o => o.x > -OBSTACLE_WIDTH);

    nextObstacleIn.current--;
    if (nextObstacleIn.current <= 0) {
      currentObs.push({ id: frameRef.current, x: GAME_WIDTH + 100 });
      const minGap = Math.max(45, 120 - speedRef.current * 3);
      nextObstacleIn.current = Math.floor(Math.random() * 70 + minGap);
    }
    obstaclesRef.current = currentObs;

    if (frameRef.current % 6 === 0) scoreRef.current++;

    if (checkCollision(playerYRef.current, currentObs)) {
      handleGameOver();
      return;
    }

    setPlayerY(playerYRef.current);
    setObstacles(currentObs);
    setScore(scoreRef.current);

    rafRef.current = requestAnimationFrame(gameLoop);
  }, [handleGameOver]);

  useEffect(() => {
    if (gameState === "playing") rafRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [gameState, gameLoop]);

  // Play death video with sound
  useEffect(() => {
    if (gameState === "dead" && videoRef.current) {
      const video = videoRef.current;
      video.currentTime = 0;
      video.muted = false;
      video.volume = 1.0;
      video.play().catch(() => {
        video.muted = true;
        video.play().catch(() => {});
      });
    }
  }, [gameState]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === "Space" || e.key === "ArrowUp") {
        e.preventDefault();
        if (gameStateRef.current === "playing") jump();
        else if (gameStateRef.current === "idle" || (gameStateRef.current === "dead" && showRetry)) startGame();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [jump, startGame, showRetry]);

  const handleTap = (e) => {
    e.preventDefault();
    if (gameState === "playing") jump();
    else if (gameState === "idle" || (gameState === "dead" && showRetry)) startGame();
  };

  const scaledW = GAME_WIDTH * scale;
  const scaledH = GAME_HEIGHT * scale;
  const isMobile = typeof window !== "undefined" && "ontouchstart" in window;

  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "#fff",
      fontFamily: "monospace",
      color: "#000",
      overflow: "hidden",
      padding: "8px",
      boxSizing: "border-box",
      userSelect: "none",
      WebkitUserSelect: "none",
      touchAction: "none",
      position: "relative",
    }}>
      {/* ── Roaming Bhais (behind everything, pointer-events off) ── */}
      {roamingBhais.map(b => (
        <img
          key={b.id}
          src={b.src}
          alt="bhai"
          style={{
            position: "fixed",
            left: `${b.x}vw`,
            top: `${b.y}vh`,
            width: b.size,
            height: b.size,
            objectFit: "cover",
            borderRadius: "50%",
            border: "2px solid #000",
            transform: `rotate(${b.rotate}deg)`,
            pointerEvents: "none",
            zIndex: 0,
            opacity: 0.55,
            boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
          }}
        />
      ))}

      <audio ref={jumpSoundRef} src="/bhaailaugh.mp3" preload="auto" />

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: scale < 0.55 ? "2px" : "10px", position: "relative", zIndex: 1 }}>
        <h1 style={{
          fontSize: `clamp(1.2rem, 7vw, 2.8rem)`,
          fontWeight: 900,
          letterSpacing: "-0.04em",
          textTransform: "uppercase",
          margin: 0,
          lineHeight: 1,
        }}>
          BHAAISAUR
        </h1>
        <p style={{
          fontSize: "clamp(6px, 2vw, 10px)",
          fontWeight: 700,
          color: "#aaa",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          margin: "3px 0 0",
        }}>
          DONT TOUCH THE CUNNING BHAAI
        </p>
      </div>

      {/* Score bar */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        width: scaledW,
        fontSize: "clamp(9px, 2.8vw, 13px)",
        fontWeight: 700,
        marginBottom: "4px",
        position: "relative",
        zIndex: 1,
      }}>
        <span>HI {String(hiScore).padStart(5, "0")}</span>
        <span>{String(score).padStart(5, "0")}</span>
      </div>

      {/* 
        RESPONSIVE CANVAS:
        Outer div = scaled pixel dimensions (what takes up screen space)
        Inner div = always 800×500 in logical px, scaled via CSS transform
      */}
      <div
        style={{
          width: scaledW,
          height: scaledH,
          position: "relative",
          flexShrink: 0,
          zIndex: 1,
        }}
        onClick={handleTap}
        onTouchStart={handleTap}
      >
        <div style={{
          width: GAME_WIDTH,
          height: GAME_HEIGHT,
          position: "absolute",
          top: 0,
          left: 0,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          border: "4px solid #000",
          background: "#fff",
          boxShadow: "0 8px 40px rgba(0,0,0,0.15)",
          overflow: "hidden",
          cursor: "pointer",
        }}>
          {/* Ground */}
          <div style={{ position: "absolute", left: 0, right: 0, bottom: GROUND_HEIGHT, height: 2, background: "#000" }} />

          {/* Player */}
          <div style={{
            position: "absolute",
            left: 80,
            bottom: GROUND_HEIGHT + playerY,
            width: PLAYER_WIDTH,
            height: PLAYER_HEIGHT,
            transform: isJumpingRef.current ? "rotate(-10deg)" : "rotate(0deg)",
            transition: "transform 0.1s",
            zIndex: 10,
          }}>
            <img
              src="/Bhaai.png"
              alt="Player"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                opacity: gameState === "dead" ? 0 : 1,
              }}
            />
          </div>

          {/* Obstacles */}
          {obstacles.map((ob) => (
            <div key={ob.id} style={{
              position: "absolute",
              left: ob.x,
              bottom: GROUND_HEIGHT,
              width: OBSTACLE_WIDTH,
              height: OBSTACLE_HEIGHT,
            }}>
              <img src="/SuryaBhaai.png" alt="Obstacle" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
          ))}

          {/* Death screen */}
          {gameState === "dead" && (
            <div style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "#fff",
              zIndex: 20,
            }}>
              <video
                ref={videoRef}
                src="/BhaaiOut.mp4"
                playsInline
                style={{ maxHeight: "100%", maxWidth: "100%" }}
              />
              {showRetry && (
                <div style={{ position: "absolute", bottom: 24, animation: "gameBounce 0.7s ease-in-out infinite alternate" }}>
                  <button style={{
                    padding: "14px 32px",
                    background: "#000",
                    color: "#fff",
                    fontFamily: "monospace",
                    fontWeight: 900,
                    fontSize: 20,
                    textTransform: "uppercase",
                    border: "2px solid #fff",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
                    cursor: "pointer",
                    letterSpacing: "0.05em",
                  }}>
                    RETRY BHAAi
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Idle screen */}
          {gameState === "idle" && (
            <div style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255,255,255,0.88)",
              zIndex: 20,
            }}>
              <button style={{
                padding: "20px 52px",
                background: "#000",
                color: "#fff",
                fontFamily: "monospace",
                fontWeight: 900,
                fontSize: 26,
                textTransform: "uppercase",
                border: "none",
                cursor: "pointer",
                letterSpacing: "0.05em",
              }}>
                START GAME
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Hint */}
      <p style={{
        marginTop: 8,
        fontSize: "clamp(6px, 1.8vw, 10px)",
        color: "#bbb",
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        fontWeight: 700,
        position: "relative",
        zIndex: 1,
      }}>
        {isMobile ? "TAP TO JUMP" : "SPACE / CLICK TO JUMP"}
      </p>

      <style>{`
        @keyframes gameBounce {
          from { transform: translateY(0px); }
          to   { transform: translateY(-12px); }
        }
        * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
        html, body { margin: 0; overflow: hidden; overscroll-behavior: none; }
      `}</style>
    </div>
  );
}