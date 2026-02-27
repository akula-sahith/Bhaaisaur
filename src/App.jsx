/**
 * BHAISAUR — Video Out Edition
 * Features: Scaling Speed + Video Game Over + Comfortable Restart
 */

import { useState, useEffect, useRef, useCallback } from "react";
import './App.css';

const GROUND_HEIGHT   = 60;    
const PLAYER_WIDTH    = 80;  
const PLAYER_HEIGHT   = 80;
const OBSTACLE_WIDTH  = 120; 
const OBSTACLE_HEIGHT = 150; 
const GRAVITY         = 0.6;  
const JUMP_VELOCITY   = -16; 
const INITIAL_SPEED   = 7;   
const SPEED_INCREMENT = 0.00589; // ⬆️ Slightly faster scaling
const MAX_SPEED       = 18;     // Speed cap to keep it humanly playable
const GAME_WIDTH      = 800;      
const GAME_HEIGHT     = 500; 

export default function Game() {
  const [gameState, setGameState] = useState("idle"); 
  const [score, setScore]         = useState(0);
  const [hiScore, setHiScore]     = useState(0);
  const [playerY, setPlayerY]     = useState(0); 
  const [obstacles, setObstacles] = useState([]);
  const [bgOffset, setBgOffset]   = useState(0);
  const [showRetry, setShowRetry] = useState(false); // For comfortable restart

  const rafRef           = useRef(null);
  const gameStateRef     = useRef("idle");
  const playerYRef       = useRef(0);
  const velocityRef      = useRef(0);
  const isJumpingRef     = useRef(false);
  const obstaclesRef     = useRef([]);
  const scoreRef         = useRef(0);
  const speedRef         = useRef(INITIAL_SPEED);
  const frameRef         = useRef(0);
  const bgOffsetRef      = useRef(0);
  const nextObstacleIn   = useRef(80);

  const jumpSoundRef     = useRef(null);
  const videoRef         = useRef(null);

  const playLaugh = () => {
    if (jumpSoundRef.current) {
      const audio = jumpSoundRef.current;
      audio.currentTime = 1.0; 
      audio.play().catch(() => {});
      setTimeout(() => { if (!audio.paused) audio.pause(); }, 1000);
    }
  };

  const handleGameOver = () => {
    gameStateRef.current = "dead";
    setGameState("dead");
    setHiScore(prev => Math.max(prev, scoreRef.current));
    setShowRetry(false);

    // Play Game Over Video
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }

    // "Comfortable Restart": Delay the retry button appearance by 1.5 seconds
    setTimeout(() => {
      setShowRetry(true);
    }, 1500);
  };

  const jump = useCallback(() => {
    if (isJumpingRef.current || gameStateRef.current !== "playing") return;
    isJumpingRef.current = true;
    velocityRef.current  = JUMP_VELOCITY;
    playLaugh(); 
  }, []);

  const startGame = useCallback(() => {
    playerYRef.current    = 0;
    velocityRef.current   = 0;
    isJumpingRef.current  = false;
    obstaclesRef.current  = [];
    scoreRef.current      = 0;
    speedRef.current      = INITIAL_SPEED;
    frameRef.current      = 0;
    bgOffsetRef.current   = 0;
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
    playerYRef.current -= velocityRef.current;
    
    if (playerYRef.current <= 0) {
      playerYRef.current = 0;
      velocityRef.current = 0;
      isJumpingRef.current = false;
    }

    // ── Scaling Speed ──
    if (speedRef.current < MAX_SPEED) {
        speedRef.current += SPEED_INCREMENT;
    }
    
    bgOffsetRef.current = (bgOffsetRef.current + speedRef.current * 0.4) % 800;

    let currentObs = obstaclesRef.current
      .map(o => ({ ...o, x: o.x - speedRef.current }))
      .filter(o => o.x > -OBSTACLE_WIDTH);

    nextObstacleIn.current--;
    if (nextObstacleIn.current <= 0) {
      currentObs.push({ id: frameRef.current, x: GAME_WIDTH + 100 });
      // Gaps also adjust based on speed so it's not impossible
      const minGap = Math.max(50, 110 - speedRef.current * 2);
      nextObstacleIn.current = Math.floor(Math.random() * 80 + minGap);
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
    setBgOffset(bgOffsetRef.current);

    rafRef.current = requestAnimationFrame(gameLoop);
  }, []);

  useEffect(() => {
    if (gameState === "playing") rafRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [gameState, gameLoop]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === "Space" || e.key === "ArrowUp") {
        e.preventDefault();
        if (gameStateRef.current === "playing") jump();
        else if (gameStateRef.current === "idle" || (gameStateRef.current === "dead" && showRetry)) {
            startGame();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [jump, startGame, showRetry]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white text-black font-mono overflow-hidden">
      <audio ref={jumpSoundRef} src="/bhaailaugh.mp3" preload="auto" />

      <div className="mb-6 text-center">
        <h1 className="text-5xl font-black tracking-tighter uppercase">BHAAISAUR</h1>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">DONT TOUCH THE CUNNING BHAAI</p>
      </div>

      <div className="flex justify-between w-full px-2 mb-1 text-xs font-bold max-w-[800px]">
        <span>HI {String(hiScore).padStart(5, "0")}</span>
        <span>{String(score).padStart(5, "0")}</span>
      </div>

      <div
        className="relative overflow-hidden border-[4px] border-black bg-white shadow-2xl"
        style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
        onClick={() => {
            if (gameState === "playing") jump();
            else if (gameState === "idle" || (gameState === "dead" && showRetry)) startGame();
        }}
      >
        <div className="absolute left-0 right-0 bottom-[60px] h-[2px] bg-black" />

        {/* Player */}
        <div
          className="absolute z-10"
          style={{
            left: 80,
            bottom: GROUND_HEIGHT + playerY,
            width: PLAYER_WIDTH,
            height: PLAYER_HEIGHT,
            transform: isJumpingRef.current ? "rotate(-10deg)" : "rotate(0deg)",
            transition: "transform 0.1s"
          }}
        >
          <img src="/Bhaai.png" className={`w-full h-full object-contain ${gameState === 'dead' ? 'opacity-0' : ''}`} />
        </div>

        {/* Obstacles */}
        {obstacles.map((ob) => (
          <div key={ob.id} className="absolute" style={{ left: ob.x, bottom: GROUND_HEIGHT, width: OBSTACLE_WIDTH, height: OBSTACLE_HEIGHT }}>
            <img src="/SuryaBhaai.png" className="w-full h-full object-contain" />
          </div>
        ))}

        {/* Game Over Video Overlay */}
        {gameState === "dead" && (
            <div className="absolute inset-0 flex items-center justify-center bg-white z-20">
                <video 
                    ref={videoRef}
                    src="/BhaaiOut.mp4" 
                    className="max-h-full max-w-full"
                    playsInline
                />
                {showRetry && (
                    <div className="absolute bottom-10 animate-bounce">
                         <button className="px-10 py-4 bg-black text-white font-black text-xl hover:bg-gray-800 uppercase border-2 border-white shadow-lg">
                            RETRY BHAAi
                         </button>
                    </div>
                )}
            </div>
        )}

        {/* Initial Start Overlay */}
        {gameState === "idle" && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-20">
            <button className="px-12 py-5 bg-black text-white font-black text-2xl hover:invert transition-all uppercase">
              START GAME
            </button>
          </div>
        )}
      </div>
    </div>
  );
}