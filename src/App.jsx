/**
 * BHAISAUR — Insane but Fair Edition
 * - Side-by-side obstacles are now synced (Both Up or Both Down)
 * - Increased frequency of flying obstacles
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Analytics } from "@vercel/analytics/next"
// ─── Game constants ────────────────────────────────────────────────────────────
const GROUND_HEIGHT   = 60;
const PLAYER_WIDTH    = 80;
const PLAYER_HEIGHT   = 80;
const OBSTACLE_WIDTH  = 100;
const OBSTACLE_HEIGHT = 100;
const GRAVITY         = 0.6;
const JUMP_VELOCITY   = -16;
const INITIAL_SPEED   = 5;
const SPEED_INCREMENT = 0.005; 
const MAX_SPEED       = 20;
const GAME_WIDTH      = 800;
const GAME_HEIGHT     = 500;
const AIR_OBSTACLE_Y  = 145; 

const BHAI_SRCS = ["/bhai1.png", "/bhai2.png", "/bhai3.png", "/bhai4.png"];
const BHAI_FRAMES = [
  { border: "3px solid #000", borderRadius: "4px", boxShadow: "5px 5px 0px #000", background: "#fff", padding: "4px" },
  { border: "3px dashed #000", borderRadius: "50%", boxShadow: "0 0 0 4px #000", background: "#f8f8f8", padding: "4px" },
  { border: "4px double #000", borderRadius: "10px", boxShadow: "-5px 5px 0px #000", background: "#fff", padding: "4px" },
  { border: "3px solid #000", borderRadius: "16px", boxShadow: "5px -5px 0px #000", background: "#f5f5f5", padding: "4px" },
];
const BHAI_SIZE = 64;

function makeRoamingBhais() {
  const startZones = [{ x:[2,12], y:[25,70] }, { x:[86,96], y:[25,70] }, { x:[25,72], y:[3,10] }, { x:[25,72], y:[85,95] }];
  return BHAI_SRCS.map((src, i) => {
    const zone = startZones[i];
    return {
      id: i, src, frame: BHAI_FRAMES[i],
      x: zone.x[0] + Math.random() * (zone.x[1] - zone.x[0]),
      y: zone.y[0] + Math.random() * (zone.y[1] - zone.y[0]),
      vx: (0.1 + Math.random() * 0.2) * (Math.random() > 0.5 ? 1 : -1),
      vy: (0.08 + Math.random() * 0.15) * (Math.random() > 0.5 ? 1 : -1),
      rotate: Math.random() * 20 - 10,
      rotateSpeed: (Math.random() * 0.4 - 0.2),
    };
  });
}

function useGameScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const compute = () => {
      const pad = 16;
      const sx = (window.innerWidth - pad * 2) / GAME_WIDTH;
      const sy = (window.innerHeight - 200) / GAME_HEIGHT;
      setScale(Math.min(sx, sy, 1));
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);
  return scale;
}

function useRoamingBhais(scale) {
  const [bhais, setBhais] = useState(() => makeRoamingBhais());
  const bhaisRef = useRef(bhais);

  useEffect(() => {
    const animate = () => {
      bhaisRef.current = bhaisRef.current.map(b => {
        let { x, y, vx, vy, rotate, rotateSpeed } = b;
        const sVW = (BHAI_SIZE / window.innerWidth) * 100;
        const sVH = (BHAI_SIZE / window.innerHeight) * 100;
        x += vx; y += vy; rotate += rotateSpeed;
        if (x < 0 || x > 100 - sVW) vx *= -1;
        if (y < 0 || y > 100 - sVH) vy *= -1;
        const marginX = scale < 0.6 ? 8 : 15;
        const marginY = scale < 0.6 ? 6 : 12;
        if (x > marginX && x < (100 - marginX - sVW) && y > marginY && y < (100 - marginY - sVH)) {
          vx *= -1; vy *= -1;
        }
        return { ...b, x, y, vx, vy, rotate };
      });
      setBhais([...bhaisRef.current]);
      requestAnimationFrame(animate);
    };
    const raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [scale]);
  return bhais;
}

export default function Game() {
  const scale = useGameScale();
  const roamingBhais = useRoamingBhais(scale);
  const [gameState, setGameState] = useState("idle");
  const [score, setScore] = useState(0);
  const [hiScore, setHiScore] = useState(0);
  const [playerY, setPlayerY] = useState(0);
  const [obstacles, setObstacles] = useState([]);
  const [showRetry, setShowRetry] = useState(false);

  const gameStateRef = useRef("idle");
  const playerYRef = useRef(0);
  const velocityRef = useRef(0);
  const isJumpingRef = useRef(false);
  const obstaclesRef = useRef([]);
  const scoreRef = useRef(0);
  const speedRef = useRef(INITIAL_SPEED);
  const frameRef = useRef(0);
  const nextObstacleIn = useRef(100);
  const jumpSoundRef = useRef(null);

  const playLaugh = () => {
    if (jumpSoundRef.current) {
      jumpSoundRef.current.currentTime = 0.5;
      jumpSoundRef.current.play().catch(() => {});
    }
  };

  const handleGameOver = useCallback(() => {
    gameStateRef.current = "dead";
    setGameState("dead");
    setHiScore(prev => Math.max(prev, scoreRef.current));
    setShowRetry(false);
    setTimeout(() => setShowRetry(true), 1200);
  }, []);

  const jump = useCallback(() => {
    if (isJumpingRef.current || gameStateRef.current !== "playing") return;
    isJumpingRef.current = true;
    velocityRef.current = JUMP_VELOCITY;
    playLaugh();
  }, []);

  const startGame = useCallback(() => {
    playerYRef.current = 0; velocityRef.current = 0; isJumpingRef.current = false;
    obstaclesRef.current = []; scoreRef.current = 0; speedRef.current = INITIAL_SPEED;
    nextObstacleIn.current = 80;
    setScore(0); setPlayerY(0); setObstacles([]); setGameState("playing");
    gameStateRef.current = "playing";
  }, []);

  const checkCollision = (pY, obs) => {
    const px = 80 + 22, py = GAME_HEIGHT - GROUND_HEIGHT - PLAYER_HEIGHT - pY + 22;
    const pw = PLAYER_WIDTH - 44, ph = PLAYER_HEIGHT - 35;
    for (const ob of obs) {
      const ox = ob.x + 18, oy = GAME_HEIGHT - GROUND_HEIGHT - OBSTACLE_HEIGHT - ob.y + 18;
      const ow = OBSTACLE_WIDTH - 36, oh = OBSTACLE_HEIGHT - 36;
      if (px < ox + ow && px + pw > ox && py < oy + oh && py + ph > oy) return true;
    }
    return false;
  };

  const gameLoop = useCallback(() => {
    if (gameStateRef.current !== "playing") return;
    frameRef.current++;
    velocityRef.current += GRAVITY;
    playerYRef.current -= velocityRef.current;
    if (playerYRef.current <= 0) { playerYRef.current = 0; velocityRef.current = 0; isJumpingRef.current = false; }
    if (speedRef.current < MAX_SPEED) speedRef.current += SPEED_INCREMENT;

    let currentObs = obstaclesRef.current
      .map(o => ({ ...o, x: o.x - speedRef.current }))
      .filter(o => o.x > -200);

    nextObstacleIn.current--;
    if (nextObstacleIn.current <= 0) {
      const spawnX = GAME_WIDTH + 100;
      const isFlying = speedRef.current > 4 && Math.random() > 0.5; // High 50% frequency
      
      // Spawn First Obstacle
      currentObs.push({ 
        id: frameRef.current, x: spawnX, 
        y: isFlying ? AIR_OBSTACLE_Y : 0, 
        type: isFlying ? "air" : "ground" 
      });

      // ─── FIXED SIDE-BY-SIDE LOGIC ───
      if (Math.random() > 0.75) {
        const gap = 120; 
        // Force second obstacle to be the SAME type as the first
        currentObs.push({ 
          id: frameRef.current + 999, x: spawnX + gap, 
          y: isFlying ? AIR_OBSTACLE_Y : 0, 
          type: isFlying ? "air" : "ground" 
        });
        nextObstacleIn.current = Math.floor(Math.random() * 40 + 90);
      } else {
        const minGap = Math.max(35, 95 - speedRef.current * 2);
        nextObstacleIn.current = Math.floor(Math.random() * 50 + minGap);
      }
    }

    obstaclesRef.current = currentObs;
    if (frameRef.current % 6 === 0) scoreRef.current++;
    if (checkCollision(playerYRef.current, currentObs)) { handleGameOver(); return; }

    setPlayerY(playerYRef.current); setObstacles(currentObs); setScore(scoreRef.current);
    requestAnimationFrame(gameLoop);
  }, [handleGameOver]);

  useEffect(() => {
    if (gameState === "playing") requestAnimationFrame(gameLoop);
  }, [gameState, gameLoop]);

  useEffect(() => {
    const handleAction = (e) => {
      if (e.type === 'keydown' && e.code !== "Space" && e.key !== "ArrowUp") return;
      if (gameStateRef.current === "playing") jump();
      else if (gameStateRef.current === "idle" || (gameStateRef.current === "dead" && showRetry)) startGame();
    };
    window.addEventListener("keydown", handleAction);
    return () => window.removeEventListener("keydown", handleAction);
  }, [jump, startGame, showRetry]);

  const scaledW = GAME_WIDTH * scale;
  const scaledH = GAME_HEIGHT * scale;

  return (
    <div 
      onPointerDown={() => {
        if (gameState === "playing") jump();
        else if (gameState === "idle" || (gameState === "dead" && showRetry)) startGame();
      }}
      style={{
        minHeight: "100dvh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", background: "#fff",
        fontFamily: 'Courier New', color: "#000", overflow: "hidden",
        position: "relative", touchAction: "none", userSelect: "none"
      }}>
      
      <audio ref={jumpSoundRef} src="/bhaailaugh.mp3" preload="auto" />

      {roamingBhais.map(b => (
        <div key={b.id} style={{
          position: "fixed", left: `${b.x}vw`, top: `${b.y}vh`,
          width: BHAI_SIZE, height: BHAI_SIZE, transform: `rotate(${b.rotate}deg)`,
          pointerEvents: "none", zIndex: 2, ...b.frame,
        }}>
          <img src={b.src} alt="bhai" style={{ width: "100%", height: "100%", borderRadius: "inherit" }} />
        </div>
      ))}

      <div style={{ textAlign: "center", zIndex: 3 }}>
        <h1 style={{ fontSize: "clamp(1.5rem, 8vw, 3.5rem)", margin: 0, fontWeight: 900, letterSpacing: "-2px" }}>BHAAISAUR</h1>
        <div style={{ display: "flex", justifyContent: "space-between", width: scaledW, fontSize: 16, fontWeight: "bold", marginBottom: 5 }}>
          <span>HI {String(hiScore).padStart(5, "0")}</span>
          <span>{String(score).padStart(5, "0")}</span>
        </div>

        <div style={{
          width: scaledW, height: scaledH, position: "relative",
          border: "5px solid #000", background: "#fff", overflow: "hidden",
          boxShadow: "12px 12px 0px #000"
        }}>
          <div style={{ width: GAME_WIDTH, height: GAME_HEIGHT, position: "absolute", top: 0, left: 0, transform: `scale(${scale})`, transformOrigin: "top left" }}>
            <div style={{ position: "absolute", left: 0, right: 0, bottom: GROUND_HEIGHT, height: 3, background: "#000" }} />
            
            <div style={{ position: "absolute", left: 80, bottom: GROUND_HEIGHT + playerY, width: PLAYER_WIDTH, height: PLAYER_HEIGHT, zIndex: 10 }}>
              <img src="/Bhaai.png" alt="Player" style={{ width: "100%", opacity: gameState === "dead" ? 0 : 1 }} />
            </div>

            {obstacles.map((ob) => (
              <div key={ob.id} style={{ position: "absolute", left: ob.x, bottom: GROUND_HEIGHT + ob.y, width: OBSTACLE_WIDTH, height: OBSTACLE_HEIGHT }}>
                <img src="/SuryaBhaai.png" alt="Obs" style={{ width: "100%", height: "100%", transform: ob.type === "air" ? "scaleY(-1)" : "none" }} />
              </div>
            ))}

            {gameState === "dead" && (
              <div style={{ position: "absolute", inset: 0, background: "#fff", zIndex: 20, display: "flex", justifyContent: "center" }}>
                <video src="/BhaaiOut.mp4" autoPlay playsInline style={{ height: "100%" }} />
                {showRetry && <button style={{ position: "absolute", bottom: 40, padding: "14px 28px", background: "#000", color: "#fff", border: "none", cursor: "pointer", fontWeight: "bold", fontSize: "1.2rem" }}>RETRY</button>}
              </div>
            )}
          </div>
        </div>
        <p style={{ color: "#777", fontSize: 12, marginTop: 15, fontWeight: "bold" }}>TAP ANYWHERE TO JUMP</p>
      </div>

      <style>{`
        * { -webkit-tap-highlight-color: transparent; }
        body { margin: 0; background: #fff; overflow: hidden; touch-action: none; }
      `}</style>
    </div>
  );
}