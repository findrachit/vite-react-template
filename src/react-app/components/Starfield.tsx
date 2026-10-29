import React, { useEffect, useRef } from "react";

export const Starfield: React.FC = () => {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		let animationFrameId: number;
		let width = (canvas.width = window.innerWidth);
		let height = (canvas.height = window.innerHeight);

		const handleResize = () => {
			if (!canvas) return;
			width = canvas.width = window.innerWidth;
			height = canvas.height = window.innerHeight;
		};
		window.addEventListener("resize", handleResize);

		// Generate stars
		const starCount = Math.min(Math.floor((width * height) / 4000), 220);
		const stars = Array.from({ length: starCount }, () => ({
			x: Math.random() * width,
			y: Math.random() * height,
			radius: Math.random() * 1.4 + 0.3,
			baseAlpha: Math.random() * 0.7 + 0.2,
			alpha: Math.random() * 0.7 + 0.2,
			twinkleSpeed: (Math.random() * 0.02 + 0.005) * (Math.random() > 0.5 ? 1 : -1),
			color:
				Math.random() > 0.8
					? "rgba(186, 230, 253, " // blue-white
					: Math.random() > 0.7
					? "rgba(224, 231, 255, " // lavender
					: "rgba(255, 255, 255, ", // white
		}));

		// Faint shooting stars
		let shootingStar: {
			x: number;
			y: number;
			len: number;
			speed: number;
			dx: number;
			dy: number;
			alpha: number;
			active: boolean;
		} | null = null;

		const maybeSpawnShootingStar = () => {
			if (!shootingStar && Math.random() < 0.008) {
				const startX = Math.random() * width;
				const startY = (Math.random() * height) / 2;
				const angle = (Math.PI / 4) + (Math.random() - 0.5) * 0.4;
				const speed = Math.random() * 8 + 8;
				shootingStar = {
					x: startX,
					y: startY,
					len: Math.random() * 80 + 50,
					speed,
					dx: Math.cos(angle) * speed,
					dy: Math.sin(angle) * speed,
					alpha: 1,
					active: true,
				};
			}
		};

		const render = () => {
			ctx.clearRect(0, 0, width, height);

			// Draw ambient nebula gradients
			const grad1 = ctx.createRadialGradient(
				width * 0.15,
				height * 0.2,
				10,
				width * 0.2,
				height * 0.25,
				width * 0.5
			);
			grad1.addColorStop(0, "rgba(30, 58, 138, 0.14)");
			grad1.addColorStop(1, "rgba(10, 15, 30, 0)");
			ctx.fillStyle = grad1;
			ctx.fillRect(0, 0, width, height);

			const grad2 = ctx.createRadialGradient(
				width * 0.85,
				height * 0.75,
				10,
				width * 0.8,
				height * 0.7,
				width * 0.45
			);
			grad2.addColorStop(0, "rgba(88, 28, 135, 0.10)");
			grad2.addColorStop(1, "rgba(10, 15, 30, 0)");
			ctx.fillStyle = grad2;
			ctx.fillRect(0, 0, width, height);

			// Draw stars
			for (const star of stars) {
				star.alpha += star.twinkleSpeed;
				if (star.alpha > 0.95 || star.alpha < 0.15) {
					star.twinkleSpeed = -star.twinkleSpeed;
				}

				ctx.beginPath();
				ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
				ctx.fillStyle = `${star.color}${star.alpha.toFixed(2)})`;
				ctx.fill();
			}

			// Draw shooting star
			maybeSpawnShootingStar();
			if (shootingStar && shootingStar.active) {
				const { x, y, dx, dy, len, alpha } = shootingStar;
				ctx.strokeStyle = `rgba(186, 230, 253, ${alpha})`;
				ctx.lineWidth = 1.5;
				ctx.beginPath();
				ctx.moveTo(x, y);
				ctx.lineTo(x - (dx / shootingStar.speed) * len, y - (dy / shootingStar.speed) * len);
				ctx.stroke();

				shootingStar.x += dx;
				shootingStar.y += dy;
				shootingStar.alpha -= 0.02;
				if (
					shootingStar.alpha <= 0 ||
					shootingStar.x > width ||
					shootingStar.y > height
				) {
					shootingStar = null;
				}
			}

			animationFrameId = requestAnimationFrame(render);
		};

		render();

		return () => {
			window.removeEventListener("resize", handleResize);
			cancelAnimationFrame(animationFrameId);
		};
	}, []);

	return (
		<canvas
			ref={canvasRef}
			className="fixed inset-0 pointer-events-none z-0"
			style={{
				position: "fixed",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				zIndex: 0,
				pointerEvents: "none",
			}}
		/>
	);
};
