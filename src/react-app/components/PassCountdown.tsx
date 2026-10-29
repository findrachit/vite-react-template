import React, { useState, useEffect } from "react";
import {
	Clock,
	Compass,
	Radio,
	Sparkles,
	ArrowUpRight,
	Satellite,
	Radar,
	ChevronRight,
} from "lucide-react";
import type { SatellitePass, LiveTelemetry } from "../types";
import { formatDuration } from "../utils/satelliteTracker";

interface PassCountdownProps {
	nextPass: SatellitePass | null;
	activePass: SatellitePass | null;
	liveTelemetry: LiveTelemetry | null;
	onSelectPassForRadar: (pass: SatellitePass) => void;
}

export const PassCountdown: React.FC<PassCountdownProps> = ({
	nextPass,
	activePass,
	liveTelemetry,
	onSelectPassForRadar,
}) => {
	const [now, setNow] = useState(new Date());

	useEffect(() => {
		const interval = setInterval(() => setNow(new Date()), 1000);
		return () => clearInterval(interval);
	}, []);

	if (!nextPass && !activePass) {
		return (
			<div className="countdown-card empty-state">
				<Satellite className="empty-icon" size={32} />
				<div className="empty-title">No passes detected in the next 48 hours</div>
				<div className="empty-subtitle">
					Try lowering the minimum elevation filter or checking your ground station coordinates.
				</div>
			</div>
		);
	}

	// If a pass is happening RIGHT NOW
	if (activePass) {
		const remainingSec = Math.max(
			0,
			Math.floor((activePass.endTime.getTime() - now.getTime()) / 1000)
		);

		return (
			<div className="countdown-card active-pass-glow">
				<div className="pass-status-header">
					<div className="active-badge">
						<span className="pulsing-dot" />
						<span>SATELLITE PASS IN PROGRESS • OVERHEAD</span>
					</div>
					<div className="satellite-pill" style={{ borderColor: activePass.satelliteColor }}>
						<Satellite size={14} style={{ color: activePass.satelliteColor }} />
						<span>{activePass.satelliteDisplayName}</span>
					</div>
				</div>

				<div className="countdown-content-grid">
					<div className="countdown-timer-group">
						<div className="time-remaining-label">TIME UNTIL LOS (LOSS OF SIGNAL)</div>
						<div className="timer-digits text-emerald">
							{formatDuration(remainingSec)}
						</div>
						<div className="pass-duration-hint">
							Total pass duration: {formatDuration(activePass.durationSec)}
						</div>
					</div>

					{/* Live telemetry values */}
					<div className="live-telemetry-block">
						<div className="telemetry-item">
							<span className="tel-label">CURRENT ELEVATION</span>
							<span className="tel-val highlight-cyan">
								{liveTelemetry?.elevationDeg !== undefined
									? `${liveTelemetry.elevationDeg.toFixed(1)}°`
									: `${activePass.maxElevation}° (Peak)`}
							</span>
						</div>
						<div className="telemetry-item">
							<span className="tel-label">AZIMUTH / HEADING</span>
							<span className="tel-val">
								{liveTelemetry?.azimuthDeg !== undefined
									? `${liveTelemetry.azimuthDeg.toFixed(0)}° ${liveTelemetry.direction}`
									: `${activePass.peakAzimuth}° ${activePass.peakDirection}`}
							</span>
						</div>
						<div className="telemetry-item">
							<span className="tel-label">SLANT RANGE</span>
							<span className="tel-val">
								{liveTelemetry?.rangeKm
									? `${Math.round(liveTelemetry.rangeKm)} km`
									: `${activePass.minRangeKm} km`}
							</span>
						</div>
						<div className="telemetry-item">
							<span className="tel-label">MAX ELEVATION</span>
							<span className="tel-val text-amber">{activePass.maxElevation}°</span>
						</div>
					</div>
				</div>

				<div className="pass-footer-bar">
					<div className="pass-path-summary">
						<span>Trajectory:</span>
						<span className="path-node">{activePass.startDirection} ({activePass.startAzimuth}°)</span>
						<ChevronRight size={14} className="text-muted" />
						<span className="path-node peak-node">Max {activePass.maxElevation}° ({activePass.peakDirection})</span>
						<ChevronRight size={14} className="text-muted" />
						<span className="path-node">{activePass.endDirection} ({activePass.endAzimuth}°)</span>
					</div>

					<button
						className="btn-radar-jump"
						onClick={() => onSelectPassForRadar(activePass)}
					>
						<Radar size={15} />
						<span>Open Sky Radar Track</span>
					</button>
				</div>
			</div>
		);
	}

	if (!nextPass) {
		return null;
	}

	// Normal Next Pass Countdown
	const diffMs = nextPass.startTime.getTime() - now.getTime();
	const diffSec = Math.max(0, Math.floor(diffMs / 1000));
	const hours = Math.floor(diffSec / 3600);
	const minutes = Math.floor((diffSec % 3600) / 60);
	const seconds = diffSec % 60;

	const isStartingSoon = diffSec < 600; // less than 10 mins

	return (
		<div className={`countdown-card ${isStartingSoon ? "starting-soon-glow" : ""}`}>
			<div className="pass-status-header">
				<div className="next-badge">
					<Clock size={14} className="icon-cyan" />
					<span>NEXT UPCOMING PASS</span>
				</div>
				<div
					className="satellite-pill"
					style={{
						borderColor: nextPass.satelliteColor,
						boxShadow: `0 0 12px ${nextPass.satelliteColor}33`,
					}}
				>
					<Satellite size={14} style={{ color: nextPass.satelliteColor }} />
					<span className="sat-name-text">{nextPass.satelliteDisplayName}</span>
					<span className="sat-norad-tag">NORAD #{nextPass.noradId}</span>
				</div>
			</div>

			<div className="countdown-content-grid">
				<div className="countdown-timer-group">
					<div className="time-remaining-label">
						{isStartingSoon ? "ACQUISITION IMMINENT" : "COUNTDOWN TO ACQUISITION OF SIGNAL (AOS)"}
					</div>
					<div className="timer-grid">
						<div className="timer-box">
							<span className="timer-num">
								{hours.toString().padStart(2, "0")}
							</span>
							<span className="timer-unit">HOURS</span>
						</div>
						<span className="timer-colon">:</span>
						<div className="timer-box">
							<span className="timer-num">
								{minutes.toString().padStart(2, "0")}
							</span>
							<span className="timer-unit">MINS</span>
						</div>
						<span className="timer-colon">:</span>
						<div className="timer-box">
							<span className="timer-num highlight-cyan">
								{seconds.toString().padStart(2, "0")}
							</span>
							<span className="timer-unit">SECS</span>
						</div>
					</div>
					<div className="pass-duration-hint">
						AOS at{" "}
						<strong className="text-white">
							{nextPass.startTime.toLocaleTimeString([], {
								hour: "2-digit",
								minute: "2-digit",
								second: "2-digit",
							})}
						</strong>{" "}
						• Duration: {formatDuration(nextPass.durationSec)}
					</div>
				</div>

				{/* Key Pass Highlights */}
				<div className="pass-highlights-block">
					<div className="elevation-arc-card">
						<div className="arc-header">
							<span className="arc-label">PEAK ELEVATION</span>
							<span
								className={`el-badge ${
									nextPass.maxElevation >= 50
										? "badge-high"
										: nextPass.maxElevation >= 25
										? "badge-med"
										: "badge-low"
								}`}
							>
								{nextPass.maxElevation}° Max
							</span>
						</div>
						<div className="arc-meter-track">
							<div
								className="arc-meter-fill"
								style={{
									width: `${(nextPass.maxElevation / 90) * 100}%`,
									backgroundColor: nextPass.satelliteColor,
								}}
							/>
						</div>
						<div className="arc-scale-labels">
							<span>0° Horizon</span>
							<span>45°</span>
							<span>90° Zenith</span>
						</div>
					</div>

					<div className="visibility-badge-row">
						{nextPass.visibility === "visible" ? (
							<div className="vis-tag vis-tag-bright">
								<Sparkles size={15} className="text-emerald" />
								<span>{nextPass.visibilityLabel}</span>
							</div>
						) : nextPass.visibility === "daylight" ? (
							<div className="vis-tag vis-tag-day">
								<Radio size={15} className="text-amber" />
								<span>Daytime Radio Pass (Antenna tracking)</span>
							</div>
						) : (
							<div className="vis-tag vis-tag-shadow">
								<Compass size={15} className="text-violet" />
								<span>In Earth Shadow (RF / Telemetry)</span>
							</div>
						)}
					</div>
				</div>
			</div>

			<div className="pass-footer-bar">
				<div className="pass-path-summary">
					<span className="path-label">Sky Trajectory:</span>
					<span className="path-node">
						Rise: <strong>{nextPass.startDirection}</strong> ({nextPass.startAzimuth}°)
					</span>
					<ArrowUpRight size={14} className="text-cyan" />
					<span className="path-node peak-node">
						Peak: <strong>{nextPass.peakDirection}</strong> at {nextPass.maxElevation}°
					</span>
					<ArrowUpRight size={14} className="text-cyan rotate-90" />
					<span className="path-node">
						Set: <strong>{nextPass.endDirection}</strong> ({nextPass.endAzimuth}°)
					</span>
				</div>

				<button
					className="btn-radar-jump"
					onClick={() => onSelectPassForRadar(nextPass)}
				>
					<Radar size={15} />
					<span>Track on Sky Radar</span>
				</button>
			</div>
		</div>
	);
};
