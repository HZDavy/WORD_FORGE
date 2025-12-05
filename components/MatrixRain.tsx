import React, { useEffect, useRef } from 'react';

export const MatrixRain: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$+-*/=%"\'#&_(),.;:?!\\|{}<>[]^~';
    const fontSize = 14;
    const columns = Math.ceil(width / fontSize);
    const drops: number[] = new Array(columns).fill(1);

    const colors = ['#646669', '#3e4044', '#d1d0c5', '#e2b714'];

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
        
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);

        if (drops[i] * fontSize > height && Math.random() > 0.975) {
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
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
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
