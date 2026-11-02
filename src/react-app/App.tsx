import { useState, useEffect, useMemo, useCallback } from "react";
import "./App.css";
import defaultSatellitesJson from "../data/satellites.json";
import type { SatelliteInfo, ObserverLocation, SatellitePass, LiveTelemetry } from "./types";
import { calculatePasses, calculateLiveTelemetry } from "./utils/satelliteTracker";
import { Starfield } from "./components/Starfield";
import { Header } from "./components/Header";
import { PassCountdown } from "./components/PassCountdown";
import { PassList } from "./components/PassList";
import { SkyRadar } from "./components/SkyRadar";
import { SatelliteFleet } from "./components/SatelliteFleet";
import { LocationModal } from "./components/LocationModal";
import { AddSatelliteModal } from "./components/AddSatelliteModal";

const STORAGE_KEY_LOCATION = "astropass_user_location";
const STORAGE_KEY_SATELLITES = "astropass_custom_satellites";

const DEFAULT_OBSERVER: ObserverLocation = {
	name: "London (Observer)",
	latitude: 51.5074,
	longitude: -0.1278,
	altitude: 0.05,
	isGps: false,
};

export function App() {
	// 1. Satellites State
	const [satellites, setSatellites] = useState<SatelliteInfo[]>(() => {
		const defaultList = defaultSatellitesJson as SatelliteInfo[];
		try {
			const saved = localStorage.getItem(STORAGE_KEY_SATELLITES);
			if (saved) {
				const custom = JSON.parse(saved) as SatelliteInfo[];
				const ids = new Set(defaultList.map((s) => s.id));
				const noradIds = new Set(defaultList.map((s) => s.noradId));
				const extras = custom.filter((s) => !ids.has(s.id) && !noradIds.has(s.noradId));
				return [...defaultList, ...extras];
			}
		} catch {
			// ignore localStorage error
		}
		return defaultList;
	});

	// 2. Observer Location State
	const [location, setLocation] = useState<ObserverLocation>(() => {
		try {
			const saved = localStorage.getItem(STORAGE_KEY_LOCATION);
			if (saved) return JSON.parse(saved);
		} catch {
			// ignore localStorage error
		}
		return DEFAULT_OBSERVER;
	});

	// 3. UI and Modals State
	const [activeTab, setActiveTab] = useState<"passes" | "radar" | "fleet">("passes");
	const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
	const [isAddModalOpen, setIsAddModalOpen] = useState(false);
	const [selectedPass, setSelectedPass] = useState<SatellitePass | null>(null);
	const [selectedTransmissionType, setSelectedTransmissionType] = useState<string>("all");
	const [isRefreshing, setIsRefreshing] = useState(false);

	// 4. Passes State (Current time until next 2 days / 48 hours)
	const [refreshKey, setRefreshKey] = useState(0);
	const [currentTime, setCurrentTime] = useState(new Date());

	// Synchronize satellite fleet with Cloudflare Workers KV
	useEffect(() => {
		let isMounted = true;

		async function fetchFleetFromKV() {
			try {
				const res = await fetch("/api/satellites");
				if (!res.ok) throw new Error("Failed to fetch fleet from KV");
				const kvSats = (await res.json()) as SatelliteInfo[];
				if (!isMounted || !Array.isArray(kvSats) || kvSats.length === 0) return;

				// Check if there are local offline additions to sync to KV
				try {
					const saved = localStorage.getItem(STORAGE_KEY_SATELLITES);
					if (saved) {
						const custom = JSON.parse(saved) as SatelliteInfo[];
						const kvIds = new Set(kvSats.map((s) => s.id));
						const kvNorads = new Set(kvSats.map((s) => s.noradId));
						const unsynced = custom.filter((s) => !kvIds.has(s.id) && !kvNorads.has(s.noradId));
						
						// Auto-sync unsynced satellites to Workers KV
						for (const s of unsynced) {
							await fetch("/api/satellites", {
								method: "POST",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify(s),
							}).catch(() => {});
						}

						if (unsynced.length > 0) {
							setSatellites([...kvSats, ...unsynced]);
							return;
						}
					}
				} catch {
					// ignore localStorage sync error
				}

				setSatellites(kvSats);
			} catch (err) {
				console.warn("Using offline / initial satellite catalog:", err);
			}
		}

		fetchFleetFromKV();

		return () => {
			isMounted = false;
		};
	}, []);

	// Auto-detect GPS location on initial load if not already saved
	useEffect(() => {
		if (localStorage.getItem(STORAGE_KEY_LOCATION)) return;

		if ("geolocation" in navigator) {
			navigator.geolocation.getCurrentPosition(
				(pos) => {
					const gpsLoc: ObserverLocation = {
						name: "My Current Location",
						latitude: pos.coords.latitude,
						longitude: pos.coords.longitude,
						altitude: (pos.coords.altitude || 50) / 1000,
						isGps: true,
					};
					setLocation(gpsLoc);
					try {
						localStorage.setItem(STORAGE_KEY_LOCATION, JSON.stringify(gpsLoc));
					} catch {
						// ignore
					}
				},
				() => {
					// User declined or error, stick with default
				},
				{ timeout: 8000 }
			);
		}
	}, []);

	// Recalculate passes for next 48 hours with useMemo
	const passes = useMemo(() => {
		if (refreshKey < 0) return [];
		const now = new Date();
		return calculatePasses(satellites, location, now, 48, 10);
	}, [satellites, location, refreshKey]);

	const recomputePasses = useCallback(() => {
		setIsRefreshing(true);
		setRefreshKey((k) => k + 1);
		setTimeout(() => setIsRefreshing(false), 400);
	}, []);

	// Live telemetry ticker (every 1 second)
	const [liveTelemetries, setLiveTelemetries] = useState<Record<string, LiveTelemetry | null>>({});

	useEffect(() => {
		const tick = () => {
			const now = new Date();
			setCurrentTime(now);

			const updated: Record<string, LiveTelemetry | null> = {};
			satellites.forEach((sat) => {
				updated[sat.id] = calculateLiveTelemetry(sat, location, now);
			});
			setLiveTelemetries(updated);
		};

		tick();
		const interval = setInterval(tick, 1000);
		return () => clearInterval(interval);
	}, [satellites, location]);

	// Identify active pass (right now) and immediate next upcoming pass
	const { activePass, nextPass } = useMemo(() => {
		const nowMs = currentTime.getTime();
		let active: SatellitePass | null = null;
		let next: SatellitePass | null = null;

		for (const p of passes) {
			const startMs = p.startTime.getTime();
			const endMs = p.endTime.getTime();

			if (nowMs >= startMs && nowMs <= endMs) {
				active = p;
				break;
			}
			if (startMs > nowMs && !next) {
				next = p;
			}
		}

		return { activePass: active, nextPass: next };
	}, [passes, currentTime]);

	// Handlers
	const handleSaveLocation = (newLoc: ObserverLocation) => {
		setLocation(newLoc);
		try {
			localStorage.setItem(STORAGE_KEY_LOCATION, JSON.stringify(newLoc));
		} catch {
			// ignore
		}
	};

	const handleAddSatellite = async (newSat: SatelliteInfo) => {
		// 1. Optimistic UI update
		setSatellites((prev) => {
			const exists = prev.some((s) => s.id === newSat.id || s.noradId === newSat.noradId);
			const updated = exists
				? prev.map((s) => (s.id === newSat.id || s.noradId === newSat.noradId ? newSat : s))
				: [...prev, newSat];
			try {
				const customOnly = updated.filter(
					(s) => !defaultSatellitesJson.some((d) => d.id === s.id || d.noradId === s.noradId)
				);
				localStorage.setItem(STORAGE_KEY_SATELLITES, JSON.stringify(customOnly));
			} catch {
				// ignore
			}
			return updated;
		});

		// 2. Persist to Cloudflare Workers KV
		try {
			await fetch("/api/satellites", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(newSat),
			});
		} catch (err) {
			console.warn("Could not persist satellite to Cloudflare Workers KV:", err);
		}
	};

	const handleDeleteSatellite = async (idOrNorad: string | number) => {
		const targetStr = idOrNorad.toString();

		// 1. Optimistic UI update
		setSatellites((prev) => {
			const updated = prev.filter((s) => s.id !== targetStr && s.noradId.toString() !== targetStr);
			try {
				const customOnly = updated.filter(
					(s) => !defaultSatellitesJson.some((d) => d.id === s.id || d.noradId === s.noradId)
				);
				localStorage.setItem(STORAGE_KEY_SATELLITES, JSON.stringify(customOnly));
			} catch {
				// ignore
			}
			return updated;
		});

		// 2. Delete from Cloudflare Workers KV
		try {
			await fetch(`/api/satellites/${targetStr}`, {
				method: "DELETE",
			});
		} catch (err) {
			console.warn("Could not delete satellite from Cloudflare Workers KV:", err);
		}
	};

	const handleResetFleet = async () => {
		try {
			const res = await fetch("/api/satellites/reset", { method: "POST" });
			if (res.ok) {
				const data = await res.json();
				if (Array.isArray(data.satellites)) {
					setSatellites(data.satellites);
					try {
						localStorage.removeItem(STORAGE_KEY_SATELLITES);
					} catch {
						// ignore
					}
					return;
				}
			}
		} catch (err) {
			console.warn("Reset via KV failed, resetting locally:", err);
		}

		setSatellites(defaultSatellitesJson as SatelliteInfo[]);
		try {
			localStorage.removeItem(STORAGE_KEY_SATELLITES);
		} catch {
			// ignore
		}
	};

	const handleSelectPassForRadar = (pass: SatellitePass) => {
		setSelectedPass(pass);
		setActiveTab("radar");
		window.scrollTo({ top: 0, behavior: "smooth" });
	};

	const activeSelectedPass = useMemo(() => {
		if (selectedPass && passes.some((p) => p.id === selectedPass.id)) {
			return selectedPass;
		}
		return passes[0] || null;
	}, [selectedPass, passes]);

	return (
		<div className="app-wrapper">
			{/* Animated cosmic background */}
			<Starfield />

			{/* Main Mission Control Header */}
			<Header
				location={location}
				onOpenLocationModal={() => setIsLocationModalOpen(true)}
				onOpenAddSatelliteModal={() => setIsAddModalOpen(true)}
				activeTab={activeTab}
				onSelectTab={setActiveTab}
				satelliteCount={satellites.length}
				passCount={passes.length}
				onRefresh={recomputePasses}
				isRefreshing={isRefreshing}
			/>

			{/* Main Dashboard Content */}
			<main className="main-content">
				{/* Top Hero: Real-time Pass Countdown & Overhead Banner */}
				<PassCountdown
					nextPass={nextPass}
					activePass={activePass}
					liveTelemetry={activePass ? liveTelemetries[activePass.satelliteId] : null}
					onSelectPassForRadar={handleSelectPassForRadar}
					selectedTransmissionType={selectedTransmissionType}
					onSelectTransmissionType={setSelectedTransmissionType}
				/>

				{/* Tab 1: 48-Hour Pass Schedule */}
				{activeTab === "passes" && (
					<PassList
						passes={passes}
						satellites={satellites}
						onSelectPassForRadar={handleSelectPassForRadar}
						selectedPassId={activeSelectedPass?.id}
						selectedTransmissionType={selectedTransmissionType}
						onSelectTransmissionType={setSelectedTransmissionType}
					/>
				)}

				{/* Tab 2: Sky Radar & Polar Dome */}
				{activeTab === "radar" && (
					<SkyRadar
						passes={passes}
						selectedPass={activeSelectedPass}
						onSelectPass={setSelectedPass}
						liveTelemetries={liveTelemetries}
						satellites={satellites}
					/>
				)}

				{/* Tab 3: Tracked Fleet Specifications & Telemetry */}
				{activeTab === "fleet" && (
					<SatelliteFleet
						satellites={satellites}
						liveTelemetries={liveTelemetries}
						location={location}
						onOpenAddModal={() => setIsAddModalOpen(true)}
						onDeleteSatellite={handleDeleteSatellite}
						onResetFleet={handleResetFleet}
					/>
				)}
			</main>

			{/* Location Setting Modal */}
			<LocationModal
				isOpen={isLocationModalOpen}
				onClose={() => setIsLocationModalOpen(false)}
				currentLocation={location}
				onSaveLocation={handleSaveLocation}
			/>

			{/* Add Satellite Modal */}
			<AddSatelliteModal
				isOpen={isAddModalOpen}
				onClose={() => setIsAddModalOpen(false)}
				onAddSatellite={handleAddSatellite}
			/>
		</div>
	);
}

export default App;
