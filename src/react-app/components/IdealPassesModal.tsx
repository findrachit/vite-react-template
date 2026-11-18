import React, { useState } from "react";
import {
	X,
	Compass,
	Check,
	RotateCcw,
	Building2,
	Eye,
	Sparkles,
	SlidersHorizontal,
	ShieldAlert,
} from "lucide-react";
import type { IdealPassesSettings, SatellitePass, SkyDirection } from "../types";
import {
	ALL_SKY_DIRECTIONS,
	SKY_DIRECTION_INFO,
	SKY_PRESETS,
	DEFAULT_IDEAL_PASSES_SETTINGS,
	isPassIdeal,
} from "../utils/idealPasses";

interface IdealPassesModalProps {
	isOpen: boolean;
	onClose: () => void;
	settings: IdealPassesSettings;
	onSaveSettings: (newSettings: IdealPassesSettings) => void;
	passes: SatellitePass[];
}

export const IdealPassesModal: React.FC<IdealPassesModalProps> = ({
	isOpen,
	onClose,
	settings,
	onSaveSettings,
	passes,
}) => {
	const [currentSettings, setCurrentSettings] = useState<IdealPassesSettings>(settings);

	if (!isOpen) return null;

	const handleToggleDirection = (dir: SkyDirection) => {
		setCurrentSettings((prev) => {
			const exists = prev.directions.includes(dir);
			let nextDirs: SkyDirection[];
			if (exists) {
				nextDirs = prev.directions.filter((d) => d !== dir);
			} else {
				nextDirs = [...prev.directions, dir];
			}

			const hasAll = ALL_SKY_DIRECTIONS.every((d) => nextDirs.includes(d));
			return {
				...prev,
				entireSky: hasAll && prev.includeOverhead,
				directions: nextDirs,
			};
		});
	};

	const handleToggleOverhead = () => {
		setCurrentSettings((prev) => {
			const nextOverhead = !prev.includeOverhead;
			const hasAll = ALL_SKY_DIRECTIONS.every((d) => prev.directions.includes(d));
			return {
				...prev,
				includeOverhead: nextOverhead,
				entireSky: hasAll && nextOverhead,
			};
		});
	};

	const handleApplyPreset = (presetDirections: SkyDirection[], includeOverhead: boolean, isDefault?: boolean) => {
		setCurrentSettings({
			entireSky: Boolean(isDefault),
			directions: [...presetDirections],
			includeOverhead,
			maxElevationThreshold: 60,
		});
	};

	const handleResetEntireSky = () => {
		setCurrentSettings({ ...DEFAULT_IDEAL_PASSES_SETTINGS });
	};

	const handleSave = () => {
		onSaveSettings(currentSettings);
		onClose();
	};

	// Calculate preview stats
	const matchingPassCount = passes.filter((p) => isPassIdeal(p, currentSettings)).length;
	const hiddenPassCount = passes.length - matchingPassCount;

	const isEntireSkyActive =
		currentSettings.entireSky ||
		(ALL_SKY_DIRECTIONS.every((d) => currentSettings.directions.includes(d)) &&
			currentSettings.includeOverhead);

	return (
		<div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
			<div className="modal-card ideal-passes-modal-card" onClick={(e) => e.stopPropagation()}>
				{/* Modal Header */}
				<div className="modal-header">
					<div className="modal-header-brand">
						<div className="modal-icon-glow">
							<Compass size={22} className="text-cyan" />
						</div>
						<div>
							<h2 className="modal-title">Ideal Passes — Sky Access</h2>
							<div className="modal-subtitle">
								Filter satellite passes to only the portions of the sky you can view
							</div>
						</div>
					</div>
					<button className="close-btn" onClick={onClose} title="Close">
						<X size={18} />
					</button>
				</div>

				<div className="modal-body">
					{/* Explanatory Banner */}
					<div className="ideal-passes-banner">
						<Building2 size={20} className="banner-icon text-cyan" />
						<div className="banner-text">
							<strong>Balcony & Urban Obstruction Use-Case:</strong> If your view is limited to specific
							balconies (e.g. East-facing or South-facing), you cannot receive passes in the West or North,
							and you cannot receive overhead passes blocked by your upper-floor balcony or ceiling overhang.
						</div>
					</div>

					{/* Presets Grid */}
					<div className="settings-section">
						<div className="section-label">
							<Sparkles size={14} className="icon-cyan" />
							<span>Quick Sky View Presets</span>
						</div>
						<div className="sky-preset-grid">
							{SKY_PRESETS.map((preset) => {
								const isSelected =
									preset.isDefault
										? isEntireSkyActive
										: !isEntireSkyActive &&
										  preset.directions.length === currentSettings.directions.length &&
										  preset.directions.every((d) => currentSettings.directions.includes(d)) &&
										  preset.includeOverhead === currentSettings.includeOverhead;

								return (
									<button
										key={preset.id}
										type="button"
										className={`sky-preset-card ${isSelected ? "selected" : ""}`}
										onClick={() =>
											handleApplyPreset(
												preset.directions,
												preset.includeOverhead,
												preset.isDefault
											)
										}
									>
										<div className="preset-card-top">
											<span className="preset-card-title">{preset.title}</span>
											{isSelected && <Check size={14} className="text-cyan check-icon" />}
										</div>
										<span className="preset-card-sub">{preset.subtitle}</span>
									</button>
								);
							})}
						</div>
					</div>

					{/* Sky Directions Selection */}
					<div className="settings-section">
						<div className="section-label">
							<SlidersHorizontal size={14} className="icon-cyan" />
							<span>Accessible Sky Directions (Horizons)</span>
						</div>
						<div className="sky-direction-options-grid">
							{ALL_SKY_DIRECTIONS.map((dirKey) => {
								const info = SKY_DIRECTION_INFO[dirKey];
								const isChecked = currentSettings.directions.includes(dirKey);

								return (
									<label
										key={dirKey}
										className={`direction-option-card ${isChecked ? "active" : "inactive"}`}
									>
										<div className="dir-checkbox-col">
											<input
												type="checkbox"
												checked={isChecked}
												onChange={() => handleToggleDirection(dirKey)}
												className="sky-checkbox"
											/>
										</div>
										<div className="dir-info-col">
											<div className="dir-title-row">
												<span className="dir-name">{info.label}</span>
												<span className="dir-az-badge">{info.azimuthRange}</span>
											</div>
											<span className="dir-desc">{info.description}</span>
										</div>
									</label>
								);
							})}
						</div>
					</div>

					{/* Overhead Pass Filter Toggle */}
					<div className="settings-section">
						<div className="section-label">
							<Eye size={14} className="icon-cyan" />
							<span>Overhead / Zenith Passes (≥60° Max Elevation)</span>
						</div>
						<label
							className={`overhead-option-card ${
								currentSettings.includeOverhead ? "active" : "blocked"
							}`}
						>
							<div className="dir-checkbox-col">
								<input
									type="checkbox"
									checked={currentSettings.includeOverhead}
									onChange={handleToggleOverhead}
									className="sky-checkbox"
								/>
							</div>
							<div className="dir-info-col">
								<div className="dir-title-row">
									<span className="dir-name">
										{currentSettings.includeOverhead
											? "Include Overhead Passes (Zenith ≥60°)"
											: "Exclude Overhead Passes (Blocked by Balcony Ceilings)"}
									</span>
									<span
										className={`status-pill ${
											currentSettings.includeOverhead ? "pill-enabled" : "pill-disabled"
										}`}
									>
										{currentSettings.includeOverhead ? "Enabled (Rooftop / Dome)" : "Blocked (Balcony Ceiling)"}
									</span>
								</div>
								<span className="dir-desc">
									Passes reaching near zenith (straight up). Balconies with an upper floor or roof
									overhang cannot receive high-angle passes above ~60°. Uncheck this option if your
									balcony ceiling obstructs straight-up overhead passes.
								</span>
							</div>
						</label>
					</div>

					{/* Visual Sky Dome Preview */}
					<div className="settings-section">
						<div className="sky-visual-container">
							<div className="sky-dome-preview-graphic">
								<svg viewBox="0 0 200 200" className="sky-dome-svg" aria-label="Sky coverage diagram">
									{/* Background circle */}
									<circle cx="100" cy="100" r="90" fill="#08142a" stroke="rgba(56,189,248,0.2)" strokeWidth="1.5" />
									<circle cx="100" cy="100" r="60" fill="none" stroke="rgba(56,189,248,0.12)" strokeDasharray="3,3" />
									<circle cx="100" cy="100" r="30" fill="none" stroke="rgba(56,189,248,0.12)" strokeDasharray="3,3" />

									{/* Sector 1: Northern (315° to 45° -> SVG coordinates: top wedge) */}
									<path
										d="M 100 100 L 36.36 36.36 A 90 90 0 0 1 163.64 36.36 Z"
										fill={
											currentSettings.directions.includes("northern")
												? "rgba(56, 189, 248, 0.28)"
												: "rgba(15, 23, 42, 0.75)"
										}
										stroke={
											currentSettings.directions.includes("northern")
												? "rgba(56, 189, 248, 0.6)"
												: "rgba(239, 68, 68, 0.25)"
										}
										strokeWidth="1"
									/>

									{/* Sector 2: Eastern (45° to 135° -> SVG coordinates: right wedge) */}
									<path
										d="M 100 100 L 163.64 36.36 A 90 90 0 0 1 163.64 163.64 Z"
										fill={
											currentSettings.directions.includes("eastern")
												? "rgba(16, 185, 129, 0.28)"
												: "rgba(15, 23, 42, 0.75)"
										}
										stroke={
											currentSettings.directions.includes("eastern")
												? "rgba(16, 185, 129, 0.6)"
												: "rgba(239, 68, 68, 0.25)"
										}
										strokeWidth="1"
									/>

									{/* Sector 3: Southern (135° to 225° -> SVG coordinates: bottom wedge) */}
									<path
										d="M 100 100 L 163.64 163.64 A 90 90 0 0 1 36.36 163.64 Z"
										fill={
											currentSettings.directions.includes("southern")
												? "rgba(56, 189, 248, 0.28)"
												: "rgba(15, 23, 42, 0.75)"
										}
										stroke={
											currentSettings.directions.includes("southern")
												? "rgba(56, 189, 248, 0.6)"
												: "rgba(239, 68, 68, 0.25)"
										}
										strokeWidth="1"
									/>

									{/* Sector 4: Western (225° to 315° -> SVG coordinates: left wedge) */}
									<path
										d="M 100 100 L 36.36 163.64 A 90 90 0 0 1 36.36 36.36 Z"
										fill={
											currentSettings.directions.includes("western")
												? "rgba(56, 189, 248, 0.28)"
												: "rgba(15, 23, 42, 0.75)"
										}
										stroke={
											currentSettings.directions.includes("western")
												? "rgba(56, 189, 248, 0.6)"
												: "rgba(239, 68, 68, 0.25)"
										}
										strokeWidth="1"
									/>

									{/* Center Zenith Circle (Overhead) */}
									<circle
										cx="100"
										cy="100"
										r="25"
										fill={
											currentSettings.includeOverhead
												? "rgba(56, 189, 248, 0.45)"
												: "rgba(239, 68, 68, 0.35)"
										}
										stroke={
											currentSettings.includeOverhead
												? "#38bdf8"
												: "rgba(239, 68, 68, 0.8)"
										}
										strokeWidth="1.5"
									/>

									{/* Crosshairs */}
									<line x1="100" y1="10" x2="100" y2="190" stroke="rgba(255,255,255,0.18)" strokeWidth="0.8" />
									<line x1="10" y1="100" x2="190" y2="100" stroke="rgba(255,255,255,0.18)" strokeWidth="0.8" />

									{/* Direction Cardinal Labels */}
									<text x="100" y="24" textAnchor="middle" fill={currentSettings.directions.includes("northern") ? "#38bdf8" : "#64748b"} fontSize="11" fontWeight="bold">N</text>
									<text x="180" y="104" textAnchor="middle" fill={currentSettings.directions.includes("eastern") ? "#10b981" : "#64748b"} fontSize="11" fontWeight="bold">E</text>
									<text x="100" y="184" textAnchor="middle" fill={currentSettings.directions.includes("southern") ? "#38bdf8" : "#64748b"} fontSize="11" fontWeight="bold">S</text>
									<text x="20" y="104" textAnchor="middle" fill={currentSettings.directions.includes("western") ? "#38bdf8" : "#64748b"} fontSize="11" fontWeight="bold">W</text>
									<text x="100" y="103" textAnchor="middle" fill={currentSettings.includeOverhead ? "#ffffff" : "#ef4444"} fontSize="8" fontWeight="bold">
										{currentSettings.includeOverhead ? "ZENITH" : "BLOCKED"}
									</text>
								</svg>
							</div>

							<div className="sky-visual-details">
								<div className="sky-visual-heading">CURRENT SKY PROFILE</div>
								<div className="sky-visual-status">
									{isEntireSkyActive ? (
										<span className="text-emerald">Entire Sky (Full Unobstructed View)</span>
									) : (
										<span>
											{currentSettings.directions.map((d) => SKY_DIRECTION_INFO[d].shortLabel).join(" + ") || "None"}
											{!currentSettings.includeOverhead && " (No Overhead)"}
										</span>
									)}
								</div>
								<p className="sky-visual-hint">
									Satellites will be filtered to only passes that reach culmination or travel through
									your active sky quadrants without passing overhead into blocked ceilings.
								</p>
							</div>
						</div>
					</div>

					{/* Pass Preview Counter */}
					<div className="filter-stats-card">
						<div className="stats-main-text">
							<strong>{matchingPassCount}</strong> of <strong>{passes.length}</strong> upcoming passes
							match this sky access
						</div>
						{hiddenPassCount > 0 && (
							<div className="stats-sub-text">
								{hiddenPassCount} pass{hiddenPassCount > 1 ? "es" : ""} outside your accessible view will be
								filtered out
							</div>
						)}
						{matchingPassCount === 0 && (
							<div className="stats-warning-text">
								<ShieldAlert size={14} />
								<span>No passes in the current window match. Consider selecting more directions.</span>
							</div>
						)}
					</div>
				</div>

				{/* Modal Footer */}
				<div className="modal-footer">
					<button
						type="button"
						className="btn-secondary"
						onClick={handleResetEntireSky}
						title="Reset to Entire Sky (Default)"
					>
						<RotateCcw size={14} />
						<span>Reset to Entire Sky</span>
					</button>

					<div className="modal-footer-right">
						<button type="button" className="btn-cancel" onClick={onClose}>
							Cancel
						</button>
						<button
							type="button"
							className="btn-accent"
							onClick={handleSave}
						>
							<Check size={16} />
							<span>Apply & Save to LocalStorage</span>
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};
