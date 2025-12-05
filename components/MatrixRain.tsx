import React, { useEffect, useRef } from 'react';

export const MatrixRain: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Variables to be updated on resize
    let width = 0;
    let height = 0;
    let columns = 0;
    let drops: number[] = [];

    const fontSize = 14;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$+-*/=%"\'#&_(),.;:?!\\|{}<>[]^~';

    const initMatrix = () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
        columns = Math.ceil(width / fontSize);
        const maxRows = Math.ceil(height / fontSize);
        
        // Initialize drops with random positions to fill screen immediately
        drops = [];
        for (let i = 0; i < columns; i++) {
            // Random start row between 0 and max rows so it looks like it's already raining
            drops[i] = Math.floor(Math.random() * maxRows);
        }
    };

    // Initial setup
    initMatrix();

    const draw = () => {
      // Trail effect
      ctx.fillStyle = 'rgba(50, 52, 55, 0.1)'; // monkey-bg with opacity
      ctx.fillRect(0, 0, width, height);

      ctx.font = `${fontSize}px "Roboto Mono"`;

      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        
        // Random coloring for "glitch" feel, mostly subtle grey
        const isHighlight = Math.random() > 0.98;
        ctx.fillStyle = isHighlight ? '#e2b714' : '#4b4d50'; 
        
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        ctx.fillText(text, x, y);

        // Reset drop to top randomly if it goes off screen
        if (y > height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        
        drops[i]++;
      }
    };

    let animationId: number;
    const animate = () => {
      draw();
      animationId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      // Re-initialize on resize to ensure full screen coverage
      initMatrix();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 z-0 pointer-events-none opacity-40"
    />
  );
};