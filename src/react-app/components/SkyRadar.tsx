import React, { useRef, useEffect, useState } from "react";
import { Radar, Play, Pause, Satellite, Radio } from "lucide-react";
import type { SatellitePass, LiveTelemetry, SatelliteInfo } from "../types";
import { getSatelliteTransmissions } from "../utils/satelliteTracker";

interface SkyRadarProps {
	passes: SatellitePass[];
	selectedPass: SatellitePass | null;
	onSelectPass: (pass: SatellitePass) => void;
	liveTelemetries: Record<string, LiveTelemetry | null>;
	satellites: SatelliteInfo[];
}

export const SkyRadar: React.FC<SkyRadarProps> = ({
	passes,
	selectedPass,
	onSelectPass,
	liveTelemetries,
	satellites,
}) => {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const [simProgress, setSimProgress] = useState<number | null>(null);
	const [isPlaying, setIsPlaying] = useState<boolean>(false);

	// Fallback to first upcoming pass if none selected
	const activePass = selectedPass || passes[0] || null;

	// Animation player for pass trajectory
	useEffect(() => {
		if (!isPlaying || !activePass || activePass.points.length === 0) return;

		const timer = setInterval(() => {
			setSimProgress((prev) => {
				const next = (prev === null ? 0 : prev) + 0.015;
				if (next >= 1) {
					setIsPlaying(false);
					return 1;
				}
				return next;
			});
		}, 60);

		return () => clearInterval(timer);
	}, [isPlaying, activePass]);

	// Draw radar
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const size = canvas.width;
		const cx = size / 2;
		const cy = size / 2;
		const radius = size * 0.42;

		ctx.clearRect(0, 0, size, size);

		// Polar coordinate helper: Azimuth (0=N, 90=E, 180=S, 270=W) and Elevation (0=horizon, 90=zenith)
		const getCanvasCoords = (azimuthDeg: number, elevationDeg: number) => {
			const clampedEl = Math.max(0, Math.min(90, elevationDeg));
			const r = (1 - clampedEl / 90) * radius;
			const azRad = ((azimuthDeg - 90) * Math.PI) / 180;
			return {
				x: cx + r * Math.cos(azRad),
				y: cy + r * Math.sin(azRad),
			};
		};

		// 1. Draw radar background gradient
		const bgGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, radius);
		bgGrad.addColorStop(0, "rgba(8, 20, 42, 0.95)");
		bgGrad.addColorStop(0.7, "rgba(6, 12, 28, 0.98)");
		bgGrad.addColorStop(1, "rgba(3, 7, 18, 1)");
		ctx.fillStyle = bgGrad;
		ctx.beginPath();
		ctx.arc(cx, cy, radius, 0, Math.PI * 2);
		ctx.fill();

		// 2. Concentric Elevation Rings (0°, 30°, 60°, 90°)
		const rings = [
			{ el: 0, label: "0° (Horizon)", color: "rgba(56, 189, 248, 0.35)", lw: 1.5 },
			{ el: 30, label: "30°", color: "rgba(56, 189, 248, 0.15)", lw: 1 },
			{ el: 60, label: "60°", color: "rgba(56, 189, 248, 0.15)", lw: 1 },
		];

		rings.forEach(({ el, label, color, lw }) => {
			const r = (1 - el / 90) * radius;
			ctx.beginPath();
			ctx.arc(cx, cy, r, 0, Math.PI * 2);
			ctx.strokeStyle = color;
			ctx.lineWidth = lw;
			ctx.stroke();

			// Ring elevation labels
			ctx.font = "10px monospace";
			ctx.fillStyle = "rgba(148, 163, 184, 0.7)";
			ctx.textAlign = "center";
			ctx.fillText(label, cx, cy - r + 12);
		});

		// Center Zenith marker
		ctx.beginPath();
		ctx.arc(cx, cy, 3, 0, Math.PI * 2);
		ctx.fillStyle = "#38bdf8";
		ctx.fill();
		ctx.font = "10px monospace";
		ctx.fillText("Zenith 90°", cx, cy + 14);

		// 3. Azimuth Crosshairs & Radial Spokes (N, NE, E, SE, S, SW, W, NW)
		const spokes = [
			{ deg: 0, label: "N", isMajor: true },
			{ deg: 45, label: "NE", isMajor: false },
			{ deg: 90, label: "E", isMajor: true },
			{ deg: 135, label: "SE", isMajor: false },
			{ deg: 180, label: "S", isMajor: true },
			{ deg: 225, label: "SW", isMajor: false },
			{ deg: 270, label: "W", isMajor: true },
			{ deg: 315, label: "NW", isMajor: false },
		];

		spokes.forEach(({ deg, label, isMajor }) => {
			const rad = ((deg - 90) * Math.PI) / 180;
			const edgeX = cx + radius * Math.cos(rad);
			const edgeY = cy + radius * Math.sin(rad);

			ctx.beginPath();
			ctx.moveTo(cx, cy);
			ctx.lineTo(edgeX, edgeY);
			ctx.strokeStyle = isMajor
				? "rgba(56, 189, 248, 0.25)"
				: "rgba(56, 189, 248, 0.08)";
			ctx.lineWidth = isMajor ? 1.2 : 0.8;
			ctx.stroke();

			// Compass labels outside perimeter
			const textRad = radius + 18;
			const tx = cx + textRad * Math.cos(rad);
			const ty = cy + textRad * Math.sin(rad) + 4;
			ctx.font = isMajor ? "bold 12px Inter, sans-serif" : "10px Inter, sans-serif";
			ctx.fillStyle = isMajor ? "#38bdf8" : "rgba(148, 163, 184, 0.7)";
			ctx.textAlign = "center";
			ctx.fillText(label, tx, ty);
		});

		// 4. Draw Selected Pass Trajectory
		if (activePass && activePass.points.length >= 2) {
			const points = activePass.points;
			const color = activePass.satelliteColor || "#38bdf8";

			// Draw full flight path curve
			ctx.beginPath();
			points.forEach((p, idx) => {
				const { x, y } = getCanvasCoords(p.azimuth, p.elevation);
				if (idx === 0) ctx.moveTo(x, y);
				else ctx.lineTo(x, y);
			});
			ctx.strokeStyle = `${color}88`;
			ctx.lineWidth = 3;
			ctx.lineCap = "round";
			ctx.lineJoin = "round";
			ctx.stroke();

			// Glowing overlay
			ctx.strokeStyle = color;
			ctx.lineWidth = 1.5;
			ctx.stroke();

			// AOS (Rise) marker
			const aos = getCanvasCoords(activePass.startAzimuth, points[0].elevation);
			ctx.beginPath();
			ctx.arc(aos.x, aos.y, 5, 0, Math.PI * 2);
			ctx.fillStyle = "#10b981";
			ctx.fill();
			ctx.strokeStyle = "#ffffff";
			ctx.lineWidth = 1.5;
			ctx.stroke();
			ctx.font = "bold 10px monospace";
			ctx.fillStyle = "#10b981";
			ctx.textAlign = "right";
			ctx.fillText("AOS", aos.x - 8, aos.y + 3);

			// Peak (Culmination) marker
			const peak = getCanvasCoords(activePass.peakAzimuth, activePass.maxElevation);
			ctx.beginPath();
			ctx.arc(peak.x, peak.y, 6, 0, Math.PI * 2);
			ctx.fillStyle = color;
			ctx.fill();
			ctx.strokeStyle = "#ffffff";
			ctx.lineWidth = 2;
			ctx.stroke();
			ctx.font = "bold 11px monospace";
			ctx.fillStyle = "#ffffff";
			ctx.textAlign = "left";
			ctx.fillText(`Max ${activePass.maxElevation}°`, peak.x + 9, peak.y + 4);

			// LOS (Set) marker
			const los = getCanvasCoords(activePass.endAzimuth, points[points.length - 1].elevation);
			ctx.beginPath();
			ctx.arc(los.x, los.y, 5, 0, Math.PI * 2);
			ctx.fillStyle = "#ef4444";
			ctx.fill();
			ctx.strokeStyle = "#ffffff";
			ctx.lineWidth = 1.5;
			ctx.stroke();
			ctx.font = "bold 10px monospace";
			ctx.fillStyle = "#ef4444";
			ctx.textAlign = "left";
			ctx.fillText("LOS", los.x + 8, los.y + 3);

			// Simulated position marker if playing
			if (simProgress !== null && simProgress >= 0 && simProgress <= 1) {
				const ptIdx = Math.min(
					Math.floor(simProgress * (points.length - 1)),
					points.length - 1
				);
				const currPt = points[ptIdx];
				const simCoords = getCanvasCoords(currPt.azimuth, currPt.elevation);

				// Glowing satellite pulse
				ctx.beginPath();
				ctx.arc(simCoords.x, simCoords.y, 14, 0, Math.PI * 2);
				ctx.fillStyle = `${color}33`;
				ctx.fill();

				ctx.beginPath();
				ctx.arc(simCoords.x, simCoords.y, 8, 0, Math.PI * 2);
				ctx.fillStyle = "#ffffff";
				ctx.fill();
				ctx.strokeStyle = color;
				ctx.lineWidth = 3;
				ctx.stroke();

				// Telemetry callout
				ctx.font = "bold 10px monospace";
				ctx.fillStyle = "#38bdf8";
				ctx.textAlign = "center";
				ctx.fillText(
					`El: ${currPt.elevation.toFixed(1)}° Az: ${currPt.azimuth.toFixed(0)}°`,
					simCoords.x,
					simCoords.y - 12
				);
			}
		}

		// 5. Live Satellite Overhead Positions
		satellites.forEach((sat) => {
			const telemetry = liveTelemetries[sat.id];
			if (telemetry && telemetry.isOverhead) {
				const coords = getCanvasCoords(telemetry.azimuthDeg, telemetry.elevationDeg);
				const satColor = sat.color || "#38bdf8";

				// Satellite icon ring
				ctx.beginPath();
				ctx.arc(coords.x, coords.y, 10, 0, Math.PI * 2);
				ctx.fillStyle = `${satColor}44`;
				ctx.fill();
				ctx.strokeStyle = satColor;
				ctx.lineWidth = 2;
				ctx.stroke();

				// Label
				ctx.font = "bold 10px Inter, sans-serif";
				ctx.fillStyle = "#ffffff";
				ctx.textAlign = "center";
				ctx.fillText(sat.displayName.split(" ")[0], coords.x, coords.y + 20);
			}
		});
	}, [activePass, simProgress, liveTelemetries, satellites]);

	return (
		<div className="radar-layout">
			{/* Canvas polar view */}
			<div className="radar-canvas-panel">
				<div className="radar-header">
					<div className="radar-title-row">
						<Radar className="icon-cyan" size={18} />
						<span className="radar-heading">LOCAL HORIZON SKY RADAR</span>
					</div>
					<div className="radar-legend">
						<span className="legend-item">
							<span className="dot dot-green" /> AOS (Rise)
						</span>
						<span className="legend-item">
							<span className="dot dot-cyan" /> Max Elevation
						</span>
						<span className="legend-item">
							<span className="dot dot-red" /> LOS (Set)
						</span>
					</div>
				</div>

				<div className="canvas-wrapper">
					<canvas
						ref={canvasRef}
						width={500}
						height={500}
						className="radar-canvas"
					/>
				</div>

				{/* Trajectory Simulation Controls */}
				{activePass && (
					<div className="playback-controls">
						<button
							className="btn-play-pause"
							onClick={() => setIsPlaying(!isPlaying)}
						>
							{isPlaying ? <Pause size={16} /> : <Play size={16} />}
							<span>{isPlaying ? "Pause Flight" : "Simulate Sky Track"}</span>
						</button>
						<input
							type="range"
							min="0"
							max="1"
							step="0.005"
							value={simProgress ?? 0}
							onChange={(e) => {
								setIsPlaying(false);
								setSimProgress(parseFloat(e.target.value));
							}}
							className="sim-slider"
						/>
						<span className="sim-percent">
							{Math.round((simProgress ?? 0) * 100)}%
						</span>
					</div>
				)}
			</div>

			{/* Pass Selector & Trajectory Telemetry */}
			<div className="radar-telemetry-panel">
				<div className="panel-title">Pass Flight Path Details</div>

				{activePass ? (
					<div className="active-pass-inspect">
						<div
							className="pass-inspect-badge"
							style={{ borderColor: activePass.satelliteColor }}
						>
							<Satellite size={16} style={{ color: activePass.satelliteColor }} />
							<div>
								<div className="sat-title">{activePass.satelliteDisplayName}</div>
								<div className="sat-time-range">
									{activePass.startTime.toLocaleDateString([], {
										weekday: "short",
										month: "short",
										day: "numeric",
									})}{" "}
									•{" "}
									{activePass.startTime.toLocaleTimeString([], {
										hour: "2-digit",
										minute: "2-digit",
									})}{" "}
									–{" "}
									{activePass.endTime.toLocaleTimeString([], {
										hour: "2-digit",
										minute: "2-digit",
									})}
								</div>
							</div>
						</div>

						<div className="telemetry-stat-grid">
							<div className="stat-card">
								<span className="stat-lbl">Max Elevation</span>
								<span className="stat-val highlight-cyan">
									{activePass.maxElevation}°
								</span>
							</div>
							<div className="stat-card">
								<span className="stat-lbl">Duration</span>
								<span className="stat-val">
									{Math.round(activePass.durationSec / 60)} min
								</span>
							</div>
							<div className="stat-card">
								<span className="stat-lbl">Visibility</span>
								<span className="stat-val text-emerald">
									{activePass.visibilityLabel}
								</span>
							</div>
							<div className="stat-card">
								<span className="stat-lbl">Closest Range</span>
								<span className="stat-val">{activePass.minRangeKm} km</span>
							</div>
						</div>

						{/* Transmissions & Frequencies */}
						{(() => {
							const transmissions = getSatelliteTransmissions(activePass);
							if (transmissions.length === 0) return null;
							return (
								<div className="radar-transmissions-box">
									<div className="radar-trans-header">
										<Radio size={12} className="text-cyan" />
										<span>Downlink Transmissions:</span>
									</div>
									<div className="radar-trans-chips">
										{transmissions.map((t) => (
											<div key={t.type} className="radar-trans-chip" title={t.description || ""}>
												<span className="radar-trans-type">{t.type}</span>
												<span className="radar-trans-freq highlight-cyan">{t.frequency}</span>
												{t.band && <span className="radar-trans-band">{t.band}</span>}
											</div>
										))}
									</div>
								</div>
							);
						})()}

						{/* Trajectory Breakdown */}
						<div className="trajectory-flow-card">
							<div className="flow-step">
								<div className="step-circle step-green">1</div>
								<div className="step-info">
									<div className="step-label">Acquisition of Signal (AOS)</div>
									<div className="step-time">
										{activePass.startTime.toLocaleTimeString([], {
											hour: "2-digit",
											minute: "2-digit",
											second: "2-digit",
										})}
									</div>
									<div className="step-sub">
										Azimuth: {activePass.startAzimuth}° ({activePass.startDirection})
									</div>
								</div>
							</div>

							<div className="flow-divider" />

							<div className="flow-step">
								<div className="step-circle step-cyan">2</div>
								<div className="step-info">
									<div className="step-label">Maximum Culmination</div>
									<div className="step-time">
										{activePass.peakTime.toLocaleTimeString([], {
											hour: "2-digit",
											minute: "2-digit",
											second: "2-digit",
										})}
									</div>
									<div className="step-sub">
										Peak: {activePass.maxElevation}° at {activePass.peakAzimuth}° (
										{activePass.peakDirection})
									</div>
								</div>
							</div>

							<div className="flow-divider" />

							<div className="flow-step">
								<div className="step-circle step-red">3</div>
								<div className="step-info">
									<div className="step-label">Loss of Signal (LOS)</div>
									<div className="step-time">
										{activePass.endTime.toLocaleTimeString([], {
											hour: "2-digit",
											minute: "2-digit",
											second: "2-digit",
										})}
									</div>
									<div className="step-sub">
										Azimuth: {activePass.endAzimuth}° ({activePass.endDirection})
									</div>
								</div>
							</div>
						</div>

						{/* Quick select other passes */}
						<div className="other-passes-section">
							<div className="section-label">Switch Pass Trajectory</div>
							<div className="pass-selector-list">
								{passes.slice(0, 8).map((p) => (
									<button
										key={p.id}
										className={`pass-chip ${p.id === activePass.id ? "selected" : ""}`}
										onClick={() => {
											onSelectPass(p);
											setSimProgress(0);
											setIsPlaying(false);
										}}
									>
										<span
											className="sat-indicator"
											style={{ backgroundColor: p.satelliteColor }}
										/>
										<span className="p-chip-name">{p.satelliteDisplayName.split(" ")[0]}</span>
										<span className="p-chip-time">
											{p.startTime.toLocaleTimeString([], {
												hour: "2-digit",
												minute: "2-digit",
											})}
										</span>
										<span className="p-chip-el">{p.maxElevation}°</span>
									</button>
								))}
							</div>
						</div>
					</div>
				) : (
					<div className="empty-panel">No pass selected</div>
				)}
			</div>
		</div>
	);
};
