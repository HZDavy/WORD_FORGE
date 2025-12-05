import React, { useEffect, useRef } from 'react';

export const MatrixRain: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let drops: number[] = [];

    const fontSize = 14;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$+-*/=%"\'#&_(),.;:?!\\|{}<>[]^~';

    const initMatrix = (preserve = false) => {
        const newWidth = window.innerWidth;
        const newHeight = window.innerHeight;

        // Skip if size hasn't changed
        if (preserve && canvas.width === newWidth && canvas.height === newHeight) return;

        width = canvas.width = newWidth;
        height = canvas.height = newHeight;
        
        const newColumns = Math.ceil(width / fontSize);
        const maxRows = Math.ceil(height / fontSize);
        
        const newDrops: number[] = [];

        for (let i = 0; i < newColumns; i++) {
            if (preserve && drops[i] !== undefined) {
                // Preserve existing drop position
                newDrops[i] = drops[i];
            } else {
                // Initialize new columns with random positions to fill screen immediately
                newDrops[i] = Math.floor(Math.random() * maxRows);
            }
        }
        drops = newDrops;
    };

    // Initial setup
    initMatrix(false);

    const draw = () => {
      // Check dimensions every frame to catch layout shifts (scrollbar changes, etc.)
      if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
          initMatrix(true);
      }

      // Trail effect
      ctx.fillStyle = 'rgba(50, 52, 55, 0.1)'; 
      ctx.fillRect(0, 0, width, height);

      ctx.font = `${fontSize}px "Roboto Mono"`;

      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        
        // Random coloring
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

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 z-0 pointer-events-none opacity-40"
    />
  );
};