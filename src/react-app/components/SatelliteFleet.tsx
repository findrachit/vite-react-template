import React, { useState } from "react";
import {
	Satellite,
	Radio,
	ChevronDown,
	ChevronUp,
	Plus,
} from "lucide-react";
import type { SatelliteInfo, LiveTelemetry, ObserverLocation } from "../types";
import { getSatelliteTransmissions } from "../utils/satelliteTracker";

interface SatelliteFleetProps {
	satellites: SatelliteInfo[];
	liveTelemetries: Record<string, LiveTelemetry | null>;
	location: ObserverLocation;
	onOpenAddModal: () => void;
}

export const SatelliteFleet: React.FC<SatelliteFleetProps> = ({
	satellites,
	liveTelemetries,
	location,
	onOpenAddModal,
}) => {
	const [expandedTleId, setExpandedTleId] = useState<string | null>(null);

	return (
		<div className="fleet-section">
			<div className="fleet-header">
				<div>
					<h2 className="section-title">Tracked Satellite Fleet</h2>
					<p className="section-subtitle">
						Active orbital assets monitored from Ground Station {location.name}.
					</p>
				</div>
				<button className="btn-accent" onClick={onOpenAddModal}>
					<Plus size={16} />
					<span>Add Satellite to Fleet</span>
				</button>
			</div>

			<div className="fleet-grid">
				{satellites.map((sat) => {
					const telemetry = liveTelemetries[sat.id];
					const isOverhead = telemetry?.isOverhead ?? false;
					const isTleOpen = expandedTleId === sat.id;

					return (
						<div
							key={sat.id}
							className="fleet-card"
							style={{ borderTop: `3px solid ${sat.color}` }}
						>
							<div className="fleet-card-header">
								<div className="fleet-title-row">
									<div
										className="sat-icon-circle"
										style={{ backgroundColor: `${sat.color}22`, borderColor: sat.color }}
									>
										<Satellite size={20} style={{ color: sat.color }} />
									</div>
									<div>
										<h3 className="fleet-sat-name">{sat.displayName}</h3>
										<div className="fleet-sat-sub">
											<span>NORAD #{sat.noradId}</span>
											{sat.designator && <span>• {sat.designator}</span>}
											{sat.category && <span>• {sat.category}</span>}
										</div>
									</div>
								</div>

								{/* Status Badge */}
								<div className={`status-pill ${isOverhead ? "status-overhead" : "status-orbit"}`}>
									<span className={`status-dot ${isOverhead ? "pulse" : ""}`} />
									<span>{isOverhead ? "OVERHEAD NOW" : "IN ORBIT"}</span>
								</div>
							</div>

							{/* Live Telemetry Bar */}
							<div className="fleet-telemetry-box">
								<div className="fleet-stat">
									<span className="fs-lbl">ALTITUDE</span>
									<span className="fs-val highlight-cyan">
										{telemetry?.altitudeKm
											? `${Math.round(telemetry.altitudeKm)} km`
											: `${sat.altitudeKm ?? "~450"} km`}
									</span>
								</div>
								<div className="fleet-stat">
									<span className="fs-lbl">SPEED</span>
									<span className="fs-val">
										{telemetry?.velocityKmS
											? `${telemetry.velocityKmS.toFixed(2)} km/s`
											: "7.66 km/s"}
									</span>
								</div>
								<div className="fleet-stat">
									<span className="fs-lbl">SUB-SAT COORDS</span>
									<span className="fs-val">
										{telemetry
											? `${telemetry.latitude >= 0 ? `${telemetry.latitude.toFixed(1)}°N` : `${Math.abs(telemetry.latitude).toFixed(1)}°S`}, ${telemetry.longitude >= 0 ? `${telemetry.longitude.toFixed(1)}°E` : `${Math.abs(telemetry.longitude).toFixed(1)}°W`}`
											: "Calculating..."}
									</span>
								</div>
								<div className="fleet-stat">
									<span className="fs-lbl">CURRENT ELEVATION</span>
									<span
										className={`fs-val ${
											telemetry && telemetry.elevationDeg > 0
												? "text-emerald"
												: "text-muted"
										}`}
									>
										{telemetry ? `${telemetry.elevationDeg.toFixed(1)}°` : "--"}
									</span>
								</div>
							</div>

							{/* Description */}
							<div className="fleet-desc">{sat.description}</div>

							{/* Technical Specifications */}
							<div className="specs-list">
								<div className="spec-row">
									<span className="spec-key">Orbit Class:</span>
									<span className="spec-value">{sat.orbitType || "Low Earth Orbit (LEO)"}</span>
								</div>
								<div className="spec-row">
									<span className="spec-key">Inclination:</span>
									<span className="spec-value">{sat.inclinationDeg ?? 51.6}°</span>
								</div>
								<div className="spec-row">
									<span className="spec-key">Orbital Period:</span>
									<span className="spec-value">{sat.periodMin ?? 92.5} minutes</span>
								</div>
								{(() => {
									const transmissions = getSatelliteTransmissions(sat);
									if (transmissions.length === 0) return null;
									return (
										<div className="spec-row transmissions-spec-row">
											<span className="spec-key">Transmissions & Frequencies:</span>
											<div className="transmissions-spec-list">
												{transmissions.map((t) => (
													<div key={t.type} className="transmission-spec-item">
														<div className="spec-item-header">
															<span className="spec-type-tag">{t.type}</span>
															<span className="spec-freq-val highlight-cyan">
																<Radio size={11} className="inline-icon" />
																{t.frequency}
															</span>
															{t.band && <span className="spec-band-pill">{t.band}</span>}
														</div>
														{t.description && (
															<div className="spec-desc-text">{t.description}</div>
														)}
													</div>
												))}
											</div>
										</div>
									);
								})()}
							</div>

							{/* TLE Expandable Drawer */}
							<div className="tle-section">
								<button
									className="tle-toggle-btn"
									onClick={() => setExpandedTleId(isTleOpen ? null : sat.id)}
								>
									<span>Two-Line Element Set (TLE)</span>
									{isTleOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
								</button>
								{isTleOpen && (
									<div className="tle-code-box">
										<code>
											{sat.tleLine1}
											<br />
											{sat.tleLine2}
										</code>
									</div>
								)}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
};
