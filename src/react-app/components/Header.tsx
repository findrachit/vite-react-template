import React, { useState, useEffect } from "react";
import {
	MapPin,
	Radio,
	Clock,
	Plus,
	Satellite,
	Radar,
	Layers,
	RefreshCw,
} from "lucide-react";
import type { ObserverLocation } from "../types";

interface HeaderProps {
	location: ObserverLocation;
	onOpenLocationModal: () => void;
	onOpenAddSatelliteModal: () => void;
	activeTab: "passes" | "radar" | "fleet";
	onSelectTab: (tab: "passes" | "radar" | "fleet") => void;
	satelliteCount: number;
	passCount: number;
	onRefresh: () => void;
	isRefreshing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
	location,
	onOpenLocationModal,
	onOpenAddSatelliteModal,
	activeTab,
	onSelectTab,
	satelliteCount,
	passCount,
	onRefresh,
	isRefreshing,
}) => {
	const [currentTime, setCurrentTime] = useState(new Date());

	useEffect(() => {
		const timer = setInterval(() => setCurrentTime(new Date()), 1000);
		return () => clearInterval(timer);
	}, []);

	const utcString = currentTime.toUTCString().slice(17, 25);
	const localString = currentTime.toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	});

	return (
		<header className="header-glass">
			<div className="header-container">
				{/* Brand */}
				<div className="brand-group">
					<div className="brand-icon-wrapper">
						<Satellite className="brand-icon" />
						<div className="pulse-ring" />
					</div>
					<div>
						<div className="brand-title">
							ASTRO<span className="text-cyan">PASS</span>
							<span className="live-pill">LIVE 48H</span>
						</div>
						<div className="brand-subtitle">
							Orbital Pass Predictor & Ground Station
						</div>
					</div>
				</div>

				{/* Location / Ground Station Info */}
				<div className="telemetry-bar">
					<button
						className="ground-station-btn"
						onClick={onOpenLocationModal}
						title="Click to change your coordinates or use GPS"
					>
						<MapPin className="icon-cyan" size={16} />
						<div className="ground-station-info">
							<span className="station-label">
								GROUND STATION {location.isGps ? "• GPS LOCK" : "• CUSTOM"}
							</span>
							<span className="station-value">
								{location.name} (
								{location.latitude >= 0
									? `${location.latitude.toFixed(2)}°N`
									: `${Math.abs(location.latitude).toFixed(2)}°S`}
								,{" "}
								{location.longitude >= 0
									? `${location.longitude.toFixed(2)}°E`
									: `${Math.abs(location.longitude).toFixed(2)}°W`}
								)
							</span>
						</div>
						<span className="change-btn-tag">Change</span>
					</button>

					{/* Time Telemetry */}
					<div className="clock-badge">
						<Clock size={15} className="icon-blue" />
						<div className="clock-digits">
							<span className="clock-sub">UTC: {utcString}</span>
							<span className="clock-main">LOCAL: {localString}</span>
						</div>
					</div>
				</div>

				{/* Actions */}
				<div className="header-actions">
					<button
						className={`refresh-btn ${isRefreshing ? "spin" : ""}`}
						onClick={onRefresh}
						title="Recalculate passes and update telemetry"
					>
						<RefreshCw size={16} />
					</button>
					<button
						className="btn-accent"
						onClick={onOpenAddSatelliteModal}
					>
						<Plus size={16} />
						<span>Track Satellite</span>
					</button>
				</div>
			</div>

			{/* Navigation Tabs */}
			<div className="tabs-bar">
				<div className="tabs-container">
					<button
						className={`nav-tab ${activeTab === "passes" ? "active" : ""}`}
						onClick={() => onSelectTab("passes")}
					>
						<Radio size={16} />
						<span>Upcoming Passes ({passCount})</span>
					</button>
					<button
						className={`nav-tab ${activeTab === "radar" ? "active" : ""}`}
						onClick={() => onSelectTab("radar")}
					>
						<Radar size={16} />
						<span>Sky Radar & Dome</span>
					</button>
					<button
						className={`nav-tab ${activeTab === "fleet" ? "active" : ""}`}
						onClick={() => onSelectTab("fleet")}
					>
						<Layers size={16} />
						<span>Tracked Fleet ({satelliteCount})</span>
					</button>
				</div>
			</div>
		</header>
	);
};
