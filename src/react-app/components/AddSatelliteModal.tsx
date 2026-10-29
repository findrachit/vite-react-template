import React, { useState } from "react";
import { X, Plus, Search, Satellite, Sparkles, Check, AlertCircle } from "lucide-react";
import type { SatelliteInfo } from "../types";

interface AddSatelliteModalProps {
	isOpen: boolean;
	onClose: () => void;
	onAddSatellite: (sat: SatelliteInfo) => void;
}

const POPULAR_SUGGESTIONS = [
	{
		noradId: 20580,
		name: "HST (Hubble Space Telescope)",
		category: "Space Telescope",
		color: "#3b82f6",
	},
	{
		noradId: 48274,
		name: "CSS (Tiangong Space Station)",
		category: "Space Station",
		color: "#f59e0b",
	},
	{
		noradId: 33591,
		name: "NOAA 19 (Weather Satellite)",
		category: "Earth Observation",
		color: "#10b981",
	},
	{
		noradId: 43013,
		name: "NOAA 20 (JPSS-1)",
		category: "Earth Observation",
		color: "#06b6d4",
	},
];

export const AddSatelliteModal: React.FC<AddSatelliteModalProps> = ({
	isOpen,
	onClose,
	onAddSatellite,
}) => {
	const [noradInput, setNoradInput] = useState("");
	const [nameInput, setNameInput] = useState("");
	const [tle1Input, setTle1Input] = useState("");
	const [tle2Input, setTle2Input] = useState("");
	const [colorInput, setColorInput] = useState("#ec4899");
	const [isLoading, setIsLoading] = useState(false);
	const [statusMessage, setStatusMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

	if (!isOpen) return null;

	const handleCelesTrakLookup = async (idToLookup?: number) => {
		const targetId = idToLookup ? idToLookup.toString() : noradInput.trim();
		if (!targetId) {
			setStatusMessage({ type: "error", text: "Please enter a NORAD catalog ID." });
			return;
		}

		setIsLoading(true);
		setStatusMessage(null);

		try {
			const res = await fetch(`/api/lookup/${targetId}`);
			if (!res.ok) {
				const errorData = await res.json().catch(() => ({}));
				throw new Error(errorData.error || `Satellite NORAD ID ${targetId} not found`);
			}

			const data = await res.json();
			setNameInput(data.name || `Satellite ${targetId}`);
			setNoradInput(targetId);
			setTle1Input(data.tleLine1);
			setTle2Input(data.tleLine2);
			setStatusMessage({
				type: "success",
				text: `Successfully fetched orbital TLE for ${data.name}!`,
			});
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : "Failed to fetch satellite from CelesTrak";
			setStatusMessage({
				type: "error",
				text: message,
			});
		} finally {
			setIsLoading(false);
		}
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const noradId = parseInt(noradInput, 10);
		if (isNaN(noradId)) {
			setStatusMessage({ type: "error", text: "Invalid NORAD Catalog ID" });
			return;
		}
		if (!tle1Input.trim() || !tle2Input.trim()) {
			setStatusMessage({ type: "error", text: "Please provide both TLE Line 1 and Line 2" });
			return;
		}

		const newSat: SatelliteInfo = {
			id: `sat-${noradId}-${Date.now()}`,
			name: nameInput.trim() || `Satellite ${noradId}`,
			displayName: nameInput.trim() || `Satellite ${noradId}`,
			noradId,
			color: colorInput,
			category: "User Tracked Asset",
			description: `Tracked satellite added via NORAD ID ${noradId}`,
			tleLine1: tle1Input.trim(),
			tleLine2: tle2Input.trim(),
		};

		onAddSatellite(newSat);
		onClose();
	};

	return (
		<div className="modal-backdrop" onClick={onClose}>
			<div className="modal-card" onClick={(e) => e.stopPropagation()}>
				<div className="modal-header">
					<div className="flex-align-gap">
						<Plus className="icon-cyan" size={20} />
						<h2 className="modal-title">Track Additional Satellite</h2>
					</div>
					<button className="close-btn" onClick={onClose}>
						<X size={18} />
					</button>
				</div>

				<div className="modal-body">
					<p className="modal-desc">
						Enter any NORAD Catalog ID to auto-fetch the latest Two-Line Element (TLE) from CelesTrak, or choose from popular spacecraft below.
					</p>

					{/* Popular suggestions */}
					<div className="section-label">
						<Sparkles size={14} className="icon-cyan" />
						<span>Popular Satellites</span>
					</div>
					<div className="preset-grid">
						{POPULAR_SUGGESTIONS.map((item) => (
							<button
								key={item.noradId}
								type="button"
								className="preset-btn"
								onClick={() => handleCelesTrakLookup(item.noradId)}
							>
								<div className="preset-name">{item.name}</div>
								<div className="preset-region">{item.category}</div>
								<div className="preset-coords">NORAD #{item.noradId}</div>
							</button>
						))}
					</div>

					{/* Form */}
					<form onSubmit={handleSubmit} className="manual-form">
						<div className="section-label">
							<Satellite size={14} className="icon-blue" />
							<span>Satellite Details</span>
						</div>

						<div className="coords-row">
							<div className="form-group flex-1">
								<label>NORAD Catalog ID</label>
								<div className="input-with-button">
									<input
										type="number"
										value={noradInput}
										onChange={(e) => setNoradInput(e.target.value)}
										placeholder="e.g. 20580"
										className="input-field"
										required
									/>
									<button
										type="button"
										className="btn-lookup"
										onClick={() => handleCelesTrakLookup()}
										disabled={isLoading}
									>
										<Search size={14} />
										<span>{isLoading ? "Fetching..." : "Fetch TLE"}</span>
									</button>
								</div>
							</div>

							<div className="form-group flex-1">
								<label>Display Name</label>
								<input
									type="text"
									value={nameInput}
									onChange={(e) => setNameInput(e.target.value)}
									placeholder="e.g. Hubble Telescope"
									className="input-field"
									required
								/>
							</div>
						</div>

						<div className="coords-row">
							<div className="form-group flex-1">
								<label>Color Accent</label>
								<div className="color-picker-row">
									<input
										type="color"
										value={colorInput}
										onChange={(e) => setColorInput(e.target.value)}
										className="color-picker"
									/>
									<span className="color-hex-tag">{colorInput}</span>
								</div>
							</div>
						</div>

						<div className="form-group">
							<label>TLE Line 1</label>
							<input
								type="text"
								value={tle1Input}
								onChange={(e) => setTle1Input(e.target.value)}
								placeholder="1 20580U 90037B ..."
								className="input-field font-mono"
								required
							/>
						</div>

						<div className="form-group">
							<label>TLE Line 2</label>
							<input
								type="text"
								value={tle2Input}
								onChange={(e) => setTle2Input(e.target.value)}
								placeholder="2 20580  28.4697 ..."
								className="input-field font-mono"
								required
							/>
						</div>

						{statusMessage && (
							<div
								className={`alert-box ${
									statusMessage.type === "error" ? "alert-warning" : "alert-success"
								}`}
							>
								{statusMessage.type === "error" ? (
									<AlertCircle size={16} />
								) : (
									<Check size={16} />
								)}
								<span>{statusMessage.text}</span>
							</div>
						)}

						<div className="modal-actions">
							<button type="button" className="btn-secondary" onClick={onClose}>
								Cancel
							</button>
							<button type="submit" className="btn-accent">
								<Plus size={16} />
								<span>Add to Tracked Fleet</span>
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	);
};
