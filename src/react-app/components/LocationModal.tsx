import React, { useState } from "react";
import { X, Navigation, MapPin, Check, Globe } from "lucide-react";
import type { ObserverLocation } from "../types";

interface LocationModalProps {
	isOpen: boolean;
	onClose: () => void;
	currentLocation: ObserverLocation;
	onSaveLocation: (loc: ObserverLocation) => void;
}

const PRESET_LOCATIONS: Array<{ name: string; lat: number; lng: number; alt: number; region: string }> = [
	{ name: "London", region: "United Kingdom", lat: 51.5074, lng: -0.1278, alt: 0.03 },
	{ name: "Yakutsk", region: "Sakha Republic (Home of SakhaCube)", lat: 62.0355, lng: 129.6755, alt: 0.1 },
	{ name: "New York", region: "United States", lat: 40.7128, lng: -74.006, alt: 0.02 },
	{ name: "Tokyo", region: "Japan", lat: 35.6762, lng: 139.6503, alt: 0.04 },
	{ name: "New Delhi", region: "India", lat: 28.6139, lng: 77.209, alt: 0.21 },
	{ name: "San Francisco", region: "United States", lat: 37.7749, lng: -122.4194, alt: 0.05 },
	{ name: "Sydney", region: "Australia", lat: -33.8688, lng: 151.2093, alt: 0.03 },
	{ name: "Paris", region: "France", lat: 48.8566, lng: 2.3522, alt: 0.035 },
];

export const LocationModal: React.FC<LocationModalProps> = ({
	isOpen,
	onClose,
	currentLocation,
	onSaveLocation,
}) => {
	const [name, setName] = useState(currentLocation.name);
	const [lat, setLat] = useState(currentLocation.latitude.toString());
	const [lng, setLng] = useState(currentLocation.longitude.toString());
	const [alt, setAlt] = useState(currentLocation.altitude.toString());
	const [isLocating, setIsLocating] = useState(false);
	const [gpsError, setGpsError] = useState<string | null>(null);

	if (!isOpen) return null;

	const handleGpsDetect = () => {
		if (!navigator.geolocation) {
			setGpsError("Geolocation is not supported by your browser");
			return;
		}

		setIsLocating(true);
		setGpsError(null);

		navigator.geolocation.getCurrentPosition(
			(position) => {
				setIsLocating(false);
				const latitude = position.coords.latitude;
				const longitude = position.coords.longitude;
				const altitudeKm = (position.coords.altitude || 50) / 1000;

				setName("Current GPS Location");
				setLat(latitude.toFixed(4));
				setLng(longitude.toFixed(4));
				setAlt(altitudeKm.toFixed(3));

				onSaveLocation({
					name: "Current GPS Location",
					latitude,
					longitude,
					altitude: altitudeKm,
					isGps: true,
				});
				onClose();
			},
			(err) => {
				setIsLocating(false);
				setGpsError(
					err.code === 1
						? "Location permission was denied. Please select a preset or type coordinates manually."
						: `Location error: ${err.message}`
				);
			},
			{ enableHighAccuracy: true, timeout: 10000 }
		);
	};

	const handlePresetSelect = (preset: typeof PRESET_LOCATIONS[0]) => {
		setName(preset.name);
		setLat(preset.lat.toString());
		setLng(preset.lng.toString());
		setAlt(preset.alt.toString());
		setGpsError(null);

		onSaveLocation({
			name: preset.name,
			latitude: preset.lat,
			longitude: preset.lng,
			altitude: preset.alt,
			isGps: false,
		});
		onClose();
	};

	const handleManualSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const latitude = parseFloat(lat);
		const longitude = parseFloat(lng);
		const altitude = parseFloat(alt) || 0.05;

		if (isNaN(latitude) || latitude < -90 || latitude > 90) {
			setGpsError("Latitude must be between -90 and 90 degrees");
			return;
		}
		if (isNaN(longitude) || longitude < -180 || longitude > 180) {
			setGpsError("Longitude must be between -180 and 180 degrees");
			return;
		}

		onSaveLocation({
			name: name.trim() || `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`,
			latitude,
			longitude,
			altitude,
			isGps: false,
		});
		onClose();
	};

	return (
		<div className="modal-backdrop" onClick={onClose}>
			<div className="modal-card" onClick={(e) => e.stopPropagation()}>
				<div className="modal-header">
					<div className="flex-align-gap">
						<MapPin className="icon-cyan" size={20} />
						<h2 className="modal-title">Set Observer Ground Station</h2>
					</div>
					<button className="close-btn" onClick={onClose}>
						<X size={18} />
					</button>
				</div>

				<div className="modal-body">
					<p className="modal-desc">
						Satellite pass times, elevation angles, and radar trajectories are
						calculated specifically for your ground observer position.
					</p>

					{/* Device GPS button */}
					<button
						className="gps-btn"
						onClick={handleGpsDetect}
						disabled={isLocating}
					>
						<Navigation className={isLocating ? "spin" : "icon-cyan"} size={18} />
						<div className="gps-btn-text">
							<span className="gps-primary">
								{isLocating ? "Acquiring GPS Position..." : "Detect My Current Device Location"}
							</span>
							<span className="gps-secondary">
								Uses browser geolocation for exact coordinates
							</span>
						</div>
					</button>

					{gpsError && <div className="alert-box alert-warning">{gpsError}</div>}

					{/* Presets */}
					<div className="section-label">
						<Globe size={14} className="icon-blue" />
						<span>Quick Presets</span>
					</div>
					<div className="preset-grid">
						{PRESET_LOCATIONS.map((preset) => (
							<button
								key={preset.name}
								className={`preset-btn ${
									currentLocation.name === preset.name ? "selected" : ""
								}`}
								onClick={() => handlePresetSelect(preset)}
							>
								<div className="preset-name">{preset.name}</div>
								<div className="preset-region">{preset.region}</div>
								<div className="preset-coords">
									{preset.lat > 0 ? `${preset.lat}°N` : `${Math.abs(preset.lat)}°S`},{" "}
									{preset.lng > 0 ? `${preset.lng}°E` : `${Math.abs(preset.lng)}°W`}
								</div>
							</button>
						))}
					</div>

					{/* Custom Manual Form */}
					<form onSubmit={handleManualSubmit} className="manual-form">
						<div className="section-label">
							<MapPin size={14} className="icon-cyan" />
							<span>Custom Coordinates</span>
						</div>

						<div className="form-group">
							<label>Station / City Name</label>
							<input
								type="text"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="e.g. My Backyard Observatory"
								className="input-field"
							/>
						</div>

						<div className="coords-row">
							<div className="form-group flex-1">
								<label>Latitude (-90° to +90°)</label>
								<input
									type="number"
									step="any"
									value={lat}
									onChange={(e) => setLat(e.target.value)}
									required
									placeholder="51.5074"
									className="input-field"
								/>
							</div>
							<div className="form-group flex-1">
								<label>Longitude (-180° to +180°)</label>
								<input
									type="number"
									step="any"
									value={lng}
									onChange={(e) => setLng(e.target.value)}
									required
									placeholder="-0.1278"
									className="input-field"
								/>
							</div>
							<div className="form-group w-80">
								<label>Altitude (km)</label>
								<input
									type="number"
									step="any"
									value={alt}
									onChange={(e) => setAlt(e.target.value)}
									placeholder="0.05"
									className="input-field"
								/>
							</div>
						</div>

						<div className="modal-actions">
							<button type="button" className="btn-secondary" onClick={onClose}>
								Cancel
							</button>
							<button type="submit" className="btn-accent">
								<Check size={16} />
								<span>Apply Coordinates</span>
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	);
};
