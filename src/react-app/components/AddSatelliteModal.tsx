import React, { useState, useMemo } from "react";
import {
	X,
	Plus,
	Search,
	Satellite,
	Check,
	AlertCircle,
	Lock,
	Loader2,
} from "lucide-react";
import type { SatelliteInfo, SatelliteSearchResult } from "../types";

interface AddSatelliteModalProps {
	isOpen: boolean;
	onClose: () => void;
	onAddSatellite: (sat: SatelliteInfo) => void;
	isAuthorized?: boolean;
	onOpenAccessModal?: () => void;
	existingSatellites?: SatelliteInfo[];
}

// Known enrichments for common satellites to auto-populate metadata
const KNOWN_METADATA: Record<
	number,
	{
		category?: string;
		color?: string;
		frequency?: string;
		transmissions?: SatelliteInfo["transmissions"];
	}
> = {
	20580: {
		category: "Space Telescope",
		color: "#3b82f6",
		frequency: "2255.500 MHz (S-Band Telemetry)",
		transmissions: [
			{
				type: "S-Band Telemetry",
				frequency: "2255.500 MHz",
				band: "S-Band",
				description: "Multiple Access Tracking & Telemetry",
			},
		],
	},
	48274: {
		category: "Space Station",
		color: "#f59e0b",
		frequency: "145.900 MHz (FM Voice) / 437.050 MHz (GMSK Telemetry)",
		transmissions: [
			{
				type: "FM Voice",
				frequency: "145.900 MHz",
				band: "VHF",
				description: "Crew Voice Downlink",
			},
			{
				type: "GMSK Telemetry",
				frequency: "437.050 MHz",
				band: "UHF",
				description: "Engineering Telemetry Beacon",
			},
		],
	},
	33591: {
		category: "Earth Observation",
		color: "#10b981",
		frequency: "137.100 MHz (APT Weather Fax) / 1698.000 MHz (HRPT)",
		transmissions: [
			{
				type: "APT Weather Fax",
				frequency: "137.100 MHz",
				band: "VHF",
				description: "Analog Weather Satellite Image Broadcast",
			},
			{
				type: "HRPT Telemetry",
				frequency: "1698.000 MHz",
				band: "L-Band",
				description: "High Resolution Picture Telemetry",
			},
		],
	},
	43013: {
		category: "Earth Observation",
		color: "#06b6d4",
		frequency: "7812.000 MHz (HRD Telemetry)",
		transmissions: [
			{
				type: "HRD Telemetry",
				frequency: "7812.000 MHz",
				band: "X-Band",
				description: "High Rate Data Direct Broadcast",
			},
		],
	},
	25544: {
		category: "Space Station",
		color: "#38bdf8",
		frequency: "145.800 MHz (FM Voice) / 145.825 MHz (APRS)",
		transmissions: [
			{
				type: "FM Voice",
				frequency: "145.800 MHz",
				band: "VHF",
				description: "Voice Downlink & ARISS Crew Contact",
			},
			{
				type: "APRS",
				frequency: "145.825 MHz",
				band: "VHF",
				description: "AX.25 Packet Radio Digipeater",
			},
		],
	},
};

const COLOR_PALETTE = [
	"#38bdf8",
	"#3b82f6",
	"#10b981",
	"#f59e0b",
	"#ec4899",
	"#8b5cf6",
	"#06b6d4",
	"#f97316",
	"#14b8a6",
];

function getPaletteColor(noradId: number): string {
	const index = Math.abs(noradId) % COLOR_PALETTE.length;
	return COLOR_PALETTE[index];
}

export const AddSatelliteModal: React.FC<AddSatelliteModalProps> = ({
	isOpen,
	onClose,
	onAddSatellite,
	isAuthorized = false,
	onOpenAccessModal,
	existingSatellites = [],
}) => {
	// Search by name state
	const [searchQuery, setSearchQuery] = useState("");
	const [lastSearchedQuery, setLastSearchedQuery] = useState("");
	const [isSearching, setIsSearching] = useState(false);
	const [searchResults, setSearchResults] = useState<SatelliteSearchResult[]>([]);
	const [hasSearched, setHasSearched] = useState(false);
	const [searchError, setSearchError] = useState<string | null>(null);
	const [addedNoradIds, setAddedNoradIds] = useState<Set<number>>(new Set());

	// Manual ID input state
	const [noradInput, setNoradInput] = useState("");
	const [nameInput, setNameInput] = useState("");
	const [tle1Input, setTle1Input] = useState("");
	const [tle2Input, setTle2Input] = useState("");
	const [colorInput, setColorInput] = useState("#ec4899");
	const [isLoading, setIsLoading] = useState(false);
	const [statusMessage, setStatusMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

	const existingNoradSet = useMemo(() => {
		return new Set((existingSatellites || []).map((s) => s.noradId));
	}, [existingSatellites]);

	if (!isOpen) return null;

	const handleSearchByName = async () => {
		const trimmed = searchQuery.trim();
		if (!trimmed) {
			setSearchError("Please enter a satellite name to search.");
			return;
		}

		setIsSearching(true);
		setSearchError(null);
		setHasSearched(true);
		setLastSearchedQuery(trimmed);

		try {
			const res = await fetch(`/api/lookup/search?q=${encodeURIComponent(trimmed)}`);
			if (!res.ok) {
				const errorData = await res.json().catch(() => ({}));
				throw new Error(errorData.error || `Failed to search satellites for "${trimmed}"`);
			}

			const data = await res.json();
			const results: SatelliteSearchResult[] = data.results || [];
			setSearchResults(results);
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : "Lookup failed";
			setSearchError(message);
			setSearchResults([]);
		} finally {
			setIsSearching(false);
		}
	};

	const handleAddFromSearch = (sat: SatelliteSearchResult) => {
		const noradId = sat.noradId;
		const known = KNOWN_METADATA[noradId];

		const newSat: SatelliteInfo = {
			id: `sat-${noradId}-${Date.now()}`,
			name: sat.name.trim() || `Satellite ${noradId}`,
			displayName: sat.displayName?.trim() || sat.name.trim() || `Satellite ${noradId}`,
			noradId,
			color: sat.color || known?.color || getPaletteColor(noradId),
			category: sat.category || known?.category || "User Tracked Asset",
			frequency: sat.frequency || known?.frequency,
			transmissions: sat.transmissions || known?.transmissions,
			description: `Tracked satellite added via NORAD ID ${noradId}`,
			tleLine1: sat.tleLine1.trim(),
			tleLine2: sat.tleLine2.trim(),
		};

		setAddedNoradIds((prev) => new Set(prev).add(noradId));
		onAddSatellite(newSat);
		onClose();
	};

	const handleSelectForManual = (sat: SatelliteSearchResult) => {
		const noradId = sat.noradId;
		const known = KNOWN_METADATA[noradId];

		setNoradInput(noradId.toString());
		setNameInput(sat.displayName || sat.name);
		setTle1Input(sat.tleLine1);
		setTle2Input(sat.tleLine2);
		setColorInput(sat.color || known?.color || getPaletteColor(noradId));
		setStatusMessage({
			type: "success",
			text: `Loaded ${sat.displayName || sat.name} (NORAD #${noradId}) into manual form below.`,
		});

		const formEl = document.getElementById("manual-satellite-form");
		if (formEl) {
			formEl.scrollIntoView({ behavior: "smooth" });
		}
	};

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
			const noradNum = parseInt(targetId, 10);
			const known = KNOWN_METADATA[noradNum];

			setNameInput(data.name || `Satellite ${targetId}`);
			setNoradInput(targetId);
			setTle1Input(data.tleLine1);
			setTle2Input(data.tleLine2);
			if (known?.color) {
				setColorInput(known.color);
			}
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

		const known = KNOWN_METADATA[noradId];

		const newSat: SatelliteInfo = {
			id: `sat-${noradId}-${Date.now()}`,
			name: nameInput.trim() || `Satellite ${noradId}`,
			displayName: nameInput.trim() || `Satellite ${noradId}`,
			noradId,
			color: colorInput,
			category: known?.category || "User Tracked Asset",
			frequency: known?.frequency,
			transmissions: known?.transmissions,
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
					<button className="close-btn" onClick={onClose} aria-label="Close modal">
						<X size={18} />
					</button>
				</div>

				<div className="modal-body">
					{!isAuthorized && (
						<div className="alert-box alert-warning">
							<Lock size={15} />
							<div className="alert-text-group">
								<span>Fleet is in <strong>Read-Only</strong> mode. You will need a valid access token to save additions.</span>
								{onOpenAccessModal && (
									<button
										type="button"
										className="btn-link-action"
										onClick={() => {
											onClose();
											onOpenAccessModal();
										}}
									>
										Enter Token Now
									</button>
								)}
							</div>
						</div>
					)}

					<p className="modal-desc">
						Search the CelesTrak catalog by name to find spacecraft and add them directly to your fleet, or configure a satellite using its NORAD Catalog ID.
					</p>

					{/* Section 1: Satellite Lookup by Name */}
					<div className="section-label">
						<Search size={14} className="icon-cyan" />
						<span>Satellite Lookup</span>
					</div>

					<div className="lookup-search-container">
						<div className="lookup-search-input-wrap">
							<Search size={15} className="lookup-search-icon" />
							<input
								type="text"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										handleSearchByName();
									}
								}}
								placeholder="Search satellite by name (e.g. Hubble, ISS, Starlink, NOAA)..."
								className="input-field lookup-input"
							/>
							{searchQuery && (
								<button
									type="button"
									className="lookup-clear-btn"
									onClick={() => {
										setSearchQuery("");
										setSearchResults([]);
										setHasSearched(false);
										setSearchError(null);
									}}
									title="Clear search"
								>
									<X size={14} />
								</button>
							)}
						</div>
						<button
							type="button"
							className="btn-lookup-search"
							onClick={handleSearchByName}
							disabled={isSearching || !searchQuery.trim()}
						>
							{isSearching ? (
								<>
									<Loader2 size={14} className="spinner-icon" />
									<span>Searching...</span>
								</>
							) : (
								<>
									<Search size={14} />
									<span>Search</span>
								</>
							)}
						</button>
					</div>

					{/* Search Error */}
					{searchError && (
						<div className="alert-box alert-warning lookup-status-alert">
							<AlertCircle size={15} />
							<span>{searchError}</span>
						</div>
					)}

					{/* Search Loading */}
					{isSearching && (
						<div className="lookup-loading">
							<Loader2 size={18} className="spinner-icon" />
							<span>Searching CelesTrak orbital catalog...</span>
						</div>
					)}

					{/* Empty Results */}
					{!isSearching && hasSearched && searchResults.length === 0 && !searchError && (
						<div className="lookup-empty">
							No satellites found matching &ldquo;{lastSearchedQuery}&rdquo;. Try another spacecraft name, acronym, or enter a NORAD catalog ID below.
						</div>
					)}

					{/* Search Results List */}
					{!isSearching && searchResults.length > 0 && (
						<div className="lookup-results-container">
							<div className="lookup-results-header">
								<span>Found {searchResults.length} satellite{searchResults.length === 1 ? "" : "s"}</span>
								<span className="lookup-hint">Click &ldquo;Add to Fleet&rdquo; to track immediately</span>
							</div>
							<div className="lookup-results-list">
								{searchResults.map((sat) => {
									const isAlreadyTracked =
										existingNoradSet.has(sat.noradId) || addedNoradIds.has(sat.noradId);
									return (
										<div key={sat.noradId} className="lookup-result-card">
											<div className="lookup-result-info">
												<div className="lookup-result-name-row">
													<span className="lookup-result-name" title={sat.displayName || sat.name}>
														{sat.displayName || sat.name}
													</span>
													<span className="lookup-norad-badge">NORAD #{sat.noradId}</span>
												</div>
												<div className="lookup-result-meta">
													{sat.category && <span className="lookup-tag">{sat.category}</span>}
													{sat.frequency && <span className="lookup-freq">{sat.frequency}</span>}
													<span className="lookup-source">
														Source: {sat.source === "catalog" ? "Catalog" : "CelesTrak"}
													</span>
												</div>
											</div>
											<div className="lookup-result-actions">
												<button
													type="button"
													className="btn-lookup-select"
													onClick={() => handleSelectForManual(sat)}
													title="Load into manual configuration form below"
												>
													Use ID &amp; TLE
												</button>
												<button
													type="button"
													className={`btn-lookup-add ${isAlreadyTracked ? "btn-already-added" : ""}`}
													onClick={() => handleAddFromSearch(sat)}
													title={isAlreadyTracked ? "Already in tracked fleet" : "Add directly to tracked fleet"}
												>
													{isAlreadyTracked ? (
														<>
															<Check size={14} />
															<span>In Fleet</span>
														</>
													) : (
														<>
															<Plus size={14} />
															<span>Add to Fleet</span>
														</>
													)}
												</button>
											</div>
										</div>
									);
								})}
							</div>
						</div>
					)}

					{/* Divider between Search by Name and Manual Add by ID */}
					<div className="modal-divider">
						<span>OR ADD SATELLITE BY NORAD ID</span>
					</div>

					{/* Section 2: Manual NORAD ID Configuration (Preserved) */}
					<form id="manual-satellite-form" onSubmit={handleSubmit} className="manual-form">
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
