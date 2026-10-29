import React, { useState } from "react";
import {
	Radio,
	Sparkles,
	Clock,
	Compass,
	ArrowRight,
	Satellite,
	Radar,
} from "lucide-react";
import type { SatellitePass, SatelliteInfo } from "../types";
import { formatDuration } from "../utils/satelliteTracker";

interface PassListProps {
	passes: SatellitePass[];
	satellites: SatelliteInfo[];
	onSelectPassForRadar: (pass: SatellitePass) => void;
	selectedPassId?: string;
}

export const PassList: React.FC<PassListProps> = ({
	passes,
	satellites,
	onSelectPassForRadar,
	selectedPassId,
}) => {
	const [selectedSatelliteId, setSelectedSatelliteId] = useState<string>("all");
	const [minElevationFilter, setMinElevationFilter] = useState<number>(10);
	const [visibleOnly, setVisibleOnly] = useState<boolean>(false);
	const [timeMode, setTimeMode] = useState<"local" | "utc">("local");

	// Filter passes
	const filteredPasses = passes.filter((pass) => {
		if (selectedSatelliteId !== "all" && pass.satelliteId !== selectedSatelliteId) {
			return false;
		}
		if (pass.maxElevation < minElevationFilter) {
			return false;
		}
		if (visibleOnly && pass.visibility !== "visible") {
			return false;
		}
		return true;
	});

	// Group passes by calendar day
	const groupedPasses: Record<string, SatellitePass[]> = {};
	filteredPasses.forEach((pass) => {
		const dayKey = pass.startTime.toLocaleDateString([], {
			weekday: "short",
			month: "short",
			day: "numeric",
			year: "numeric",
		});
		if (!groupedPasses[dayKey]) groupedPasses[dayKey] = [];
		groupedPasses[dayKey].push(pass);
	});

	const formatTime = (date: Date) => {
		if (timeMode === "utc") {
			return `${date.toUTCString().slice(17, 22)} UTC`;
		}
		return date.toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	return (
		<div className="pass-list-section">
			{/* Controls and Filters */}
			<div className="filters-card">
				<div className="filters-row">
					{/* Satellite Filter Tabs */}
					<div className="filter-group">
						<span className="filter-label">Satellite:</span>
						<div className="btn-tab-group">
							<button
								className={`filter-chip ${selectedSatelliteId === "all" ? "active" : ""}`}
								onClick={() => setSelectedSatelliteId("all")}
							>
								All Fleet ({passes.length})
							</button>
							{satellites.map((s) => {
								const satPassCount = passes.filter((p) => p.satelliteId === s.id).length;
								return (
									<button
										key={s.id}
										className={`filter-chip ${selectedSatelliteId === s.id ? "active" : ""}`}
										onClick={() => setSelectedSatelliteId(s.id)}
									>
										<span
											className="sat-indicator"
											style={{ backgroundColor: s.color }}
										/>
										{s.displayName.split(" ")[0]} ({satPassCount})
									</button>
								);
							})}
						</div>
					</div>

					{/* Elevation and Visibility Filters */}
					<div className="filter-group-right">
						{/* Min Elevation Filter */}
						<div className="filter-group">
							<span className="filter-label">Min Elevation:</span>
							<select
								value={minElevationFilter}
								onChange={(e) => setMinElevationFilter(Number(e.target.value))}
								className="select-field"
							>
								<option value={10}>All Passes (≥10°)</option>
								<option value={25}>Good Passes (≥25°)</option>
								<option value={50}>Overhead Passes (≥50°)</option>
							</select>
						</div>

						{/* Visible only toggle */}
						<button
							className={`toggle-btn ${visibleOnly ? "active" : ""}`}
							onClick={() => setVisibleOnly(!visibleOnly)}
						>
							<Sparkles size={14} className={visibleOnly ? "text-emerald" : ""} />
							<span>Naked-Eye Visible Only</span>
						</button>

						{/* Local vs UTC time toggle */}
						<button
							className="time-mode-btn"
							onClick={() => setTimeMode(timeMode === "local" ? "utc" : "local")}
						>
							<Clock size={14} />
							<span>{timeMode === "local" ? "Local Time" : "UTC Time"}</span>
						</button>
					</div>
				</div>
			</div>

			{/* Pass count status */}
			<div className="pass-count-summary">
				Showing <strong>{filteredPasses.length}</strong> satellite passes across the next 48 hours
			</div>

			{/* Pass Groupings */}
			{Object.keys(groupedPasses).length === 0 ? (
				<div className="empty-results-box">
					<Satellite className="empty-icon" size={28} />
					<div className="empty-title">No passes match current filters</div>
					<div className="empty-subtitle">
						Try clearing the "Naked-Eye Visible" toggle or setting the minimum elevation back to 10°.
					</div>
					<button
						className="btn-secondary mt-12"
						onClick={() => {
							setSelectedSatelliteId("all");
							setMinElevationFilter(10);
							setVisibleOnly(false);
						}}
					>
						Reset Filters
					</button>
				</div>
			) : (
				Object.entries(groupedPasses).map(([dayString, dayPasses]) => (
					<div key={dayString} className="day-group">
						<div className="day-header">
							<div className="day-title">{dayString}</div>
							<div className="day-badge">{dayPasses.length} passes</div>
						</div>

						<div className="pass-grid">
							{dayPasses.map((pass) => {
								const isSelected = selectedPassId === pass.id;
								return (
									<div
										key={pass.id}
										className={`pass-card ${isSelected ? "selected-pass-card" : ""}`}
									>
										{/* Top Row: Satellite + Visibility Badge */}
										<div className="pass-card-header">
											<div className="sat-title-group">
												<div
													className="sat-avatar-dot"
													style={{ backgroundColor: pass.satelliteColor }}
												/>
												<div>
													<span className="sat-card-name">
														{pass.satelliteDisplayName}
													</span>
													<span className="sat-card-category">
														{pass.category || "Satellite"} • #{pass.noradId}
													</span>
												</div>
											</div>

											{pass.visibility === "visible" ? (
												<span className="vis-pill vis-pill-emerald">
													<Sparkles size={13} />
													<span>Naked Eye</span>
												</span>
											) : pass.visibility === "daylight" ? (
												<span className="vis-pill vis-pill-amber">
													<Radio size={13} />
													<span>Daytime RF</span>
												</span>
											) : (
												<span className="vis-pill vis-pill-violet">
													<Compass size={13} />
													<span>Earth Shadow</span>
												</span>
											)}
										</div>

										{/* Time Timeline & Elevation Gauge */}
										<div className="pass-card-body">
											<div className="time-col">
												<div className="time-segment">
													<span className="t-label">AOS (Rise)</span>
													<span className="t-val">{formatTime(pass.startTime)}</span>
													<span className="t-sub">{pass.startDirection} ({pass.startAzimuth}°)</span>
												</div>
												<div className="timeline-arrow">
													<ArrowRight size={14} className="text-muted" />
												</div>
												<div className="time-segment peak-highlight">
													<span className="t-label">MAX CULMINATION</span>
													<span className="t-val highlight-cyan">{formatTime(pass.peakTime)}</span>
													<span className="t-sub">{pass.peakDirection} ({pass.peakAzimuth}°)</span>
												</div>
												<div className="timeline-arrow">
													<ArrowRight size={14} className="text-muted" />
												</div>
												<div className="time-segment">
													<span className="t-label">LOS (Set)</span>
													<span className="t-val">{formatTime(pass.endTime)}</span>
													<span className="t-sub">{pass.endDirection} ({pass.endAzimuth}°)</span>
												</div>
											</div>

											{/* Elevation Arc & Duration */}
											<div className="elevation-col">
												<div className="el-badge-display">
													<span
														className={`badge-elevation-pill ${
															pass.maxElevation >= 50
																? "el-high"
																: pass.maxElevation >= 25
																? "el-med"
																: "el-low"
														}`}
													>
														{pass.maxElevation}° Max
													</span>
													<span className="duration-pill">
														{formatDuration(pass.durationSec)}
													</span>
												</div>
												<div className="range-info">
													Slant Range: <strong>{pass.minRangeKm} km</strong>
												</div>
											</div>
										</div>

										{/* Card Footer: Frequency and Radar Action */}
										<div className="pass-card-footer">
											{pass.frequency && (
												<div className="freq-tag" title={pass.frequency}>
													<Radio size={12} className="text-cyan" />
													<span>{pass.frequency.split("/")[0].trim()}</span>
												</div>
											)}
											<button
												className="radar-view-btn"
												onClick={() => onSelectPassForRadar(pass)}
											>
												<Radar size={14} />
												<span>Track on Radar</span>
											</button>
										</div>
									</div>
								);
							})}
						</div>
					</div>
				))
			)}
		</div>
	);
};
