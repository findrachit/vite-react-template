import { useState, useEffect, useMemo, useCallback } from "react";
import "./App.css";
import defaultSatellitesJson from "../data/satellites.json";
import type { SatelliteInfo, ObserverLocation, SatellitePass, LiveTelemetry } from "./types";
import { calculatePasses, calculateLiveTelemetry, DEFAULT_PREDICTION_HOURS } from "./utils/satelliteTracker";
import { TabType, resolveTabFromPath, ROUTE_PATHS, TAB_TITLES } from "./routes";
import { Starfield } from "./components/Starfield";
import { Header } from "./components/Header";
import { NavigationTabs } from "./components/NavigationTabs";
import { PassCountdown } from "./components/PassCountdown";
import { PassList } from "./components/PassList";
import { SkyRadar } from "./components/SkyRadar";
import { SatelliteFleet } from "./components/SatelliteFleet";
import { LocationModal } from "./components/LocationModal";
import { AddSatelliteModal } from "./components/AddSatelliteModal";
import { FleetAccessModal } from "./components/FleetAccessModal";
import { Check, AlertCircle, X, ShieldCheck } from "lucide-react";

const STORAGE_KEY_LOCATION = "astropass_user_location";
const STORAGE_KEY_SATELLITES = "astropass_custom_satellites";
const STORAGE_KEY_AUTH_TOKEN = "astropass_fleet_auth_token";
const STORAGE_KEY_TIME_PERIOD = "astropass_pass_duration_hours";

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
	const [activeTab, setActiveTab] = useState<TabType>(() => {
		if (typeof window !== "undefined") {
			return resolveTabFromPath(window.location.pathname);
		}
		return "hero";
	});
	const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
	const [isAddModalOpen, setIsAddModalOpen] = useState(false);
	const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
	const [selectedPass, setSelectedPass] = useState<SatellitePass | null>(null);
	const [selectedTransmissionType, setSelectedTransmissionType] = useState<string>("all");
	const [isRefreshing, setIsRefreshing] = useState(false);

	// Synchronize URL and handle browser back/forward buttons
	useEffect(() => {
		const initialPath = window.location.pathname;
		const matchedTab = resolveTabFromPath(initialPath);

		if (initialPath === "/" || initialPath === "") {
			window.history.replaceState({ tab: matchedTab }, "", ROUTE_PATHS.hero);
		} else {
			window.history.replaceState({ tab: matchedTab }, "", initialPath);
		}

		const handlePopState = (e: PopStateEvent) => {
			const currentPath = window.location.pathname;
			const targetTab = (e.state && e.state.tab) || resolveTabFromPath(currentPath);
			setActiveTab(targetTab);
		};

		window.addEventListener("popstate", handlePopState);
		return () => window.removeEventListener("popstate", handlePopState);
	}, []);

	// Update document title dynamically based on active view
	useEffect(() => {
		document.title = TAB_TITLES[activeTab] || "AstroPass";
	}, [activeTab]);

	const navigateToTab = useCallback((tab: TabType) => {
		setActiveTab(tab);
		const targetPath = ROUTE_PATHS[tab];
		if (window.location.pathname !== targetPath) {
			window.history.pushState({ tab }, "", targetPath);
		}
	}, []);

	// 4. Access Control State
	const [authToken, setAuthToken] = useState<string>(() => {
		try {
			return localStorage.getItem(STORAGE_KEY_AUTH_TOKEN) || "";
		} catch {
			return "";
		}
	});
	const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
	const [toast, setToast] = useState<{
		type: "success" | "error" | "info";
		message: string;
	} | null>(null);

	// 5. Passes State (Configurable prediction window, default 24 hours)
	const [refreshKey, setRefreshKey] = useState(0);
	const [currentTime, setCurrentTime] = useState(new Date());
	const [timePeriodHours, setTimePeriodHours] = useState<number>(() => {
		try {
			const saved = localStorage.getItem(STORAGE_KEY_TIME_PERIOD);
			if (saved) {
				const parsed = parseInt(saved, 10);
				if (!isNaN(parsed) && parsed >= 12 && parsed <= 168 && parsed % 12 === 0) {
					return parsed;
				}
			}
		} catch {
			// ignore localStorage error
		}
		return DEFAULT_PREDICTION_HOURS;
	});

	const handleSelectTimePeriod = useCallback((hours: number) => {
		setTimePeriodHours(hours);
		try {
			localStorage.setItem(STORAGE_KEY_TIME_PERIOD, hours.toString());
		} catch {
			// ignore localStorage error
		}
	}, []);

	// Auto-dismiss toast notification after 5 seconds
	useEffect(() => {
		if (!toast) return;
		const timer = setTimeout(() => setToast(null), 5000);
		return () => clearTimeout(timer);
	}, [toast]);

	// Initialize and verify authentication from localStorage
	useEffect(() => {
		let isMounted = true;

		async function initAuth() {
			let candidateToken = "";

			try {
				candidateToken = localStorage.getItem(STORAGE_KEY_AUTH_TOKEN) || "";
			} catch {
				// ignore
			}

			if (!candidateToken) {
				if (isMounted) setIsAuthorized(false);
				return;
			}

			try {
				const res = await fetch("/api/auth/verify", {
					method: "POST",
					headers: {
						Authorization: `Bearer ${candidateToken}`,
					},
				});

				if (!isMounted) return;

				if (res.ok) {
					setAuthToken(candidateToken);
					setIsAuthorized(true);
				} else {
					setIsAuthorized(false);
				}
			} catch (err) {
				console.warn("Auth check error:", err);
				if (isMounted) setIsAuthorized(false);
			}
		}

		initAuth();

		return () => {
			isMounted = false;
		};
	}, []);

	// Synchronize satellite fleet with server storage
	useEffect(() => {
		let isMounted = true;

		async function fetchFleetFromKV() {
			try {
				const res = await fetch("/api/satellites");
				if (!res.ok) throw new Error("Failed to fetch fleet");
				const kvSats = (await res.json()) as SatelliteInfo[];
				if (!isMounted || !Array.isArray(kvSats) || kvSats.length === 0) return;

				// Check if there are local offline additions to sync to server
				try {
					const saved = localStorage.getItem(STORAGE_KEY_SATELLITES);
					if (saved) {
						const custom = JSON.parse(saved) as SatelliteInfo[];
						const kvIds = new Set(kvSats.map((s) => s.id));
						const kvNorads = new Set(kvSats.map((s) => s.noradId));
						const unsynced = custom.filter((s) => !kvIds.has(s.id) && !kvNorads.has(s.noradId));

						// If user has a valid auth token, sync custom satellites to server
						if (unsynced.length > 0 && authToken) {
							for (const s of unsynced) {
								await fetch("/api/satellites", {
									method: "POST",
									headers: {
										"Content-Type": "application/json",
										Authorization: `Bearer ${authToken}`,
									},
									body: JSON.stringify(s),
								}).catch(() => {});
							}
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
	}, [authToken]);

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

	// Recalculate passes for configured prediction window with useMemo
	const passes = useMemo(() => {
		if (refreshKey < 0) return [];
		const now = new Date();
		return calculatePasses(satellites, location, now, timePeriodHours, 10);
	}, [satellites, location, refreshKey, timePeriodHours]);

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

	// Location saving handler
	const handleSaveLocation = (newLoc: ObserverLocation) => {
		setLocation(newLoc);
		try {
			localStorage.setItem(STORAGE_KEY_LOCATION, JSON.stringify(newLoc));
		} catch {
			// ignore
		}
	};

	// Auth token verification & save handler
	const handleSaveToken = async (candidate: string): Promise<boolean> => {
		try {
			const res = await fetch("/api/auth/verify", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${candidate}`,
				},
			});

			if (res.ok) {
				setAuthToken(candidate);
				setIsAuthorized(true);
				try {
					localStorage.setItem(STORAGE_KEY_AUTH_TOKEN, candidate);
				} catch {
					// ignore
				}
				setToast({
					type: "success",
					message: "Fleet access authorized! Full management unlocked.",
				});
				return true;
			}
		} catch (err) {
			console.error("Token verification failed:", err);
		}
		return false;
	};

	// Clear auth token (lock fleet)
	const handleClearToken = () => {
		setAuthToken("");
		setIsAuthorized(false);
		try {
			localStorage.removeItem(STORAGE_KEY_AUTH_TOKEN);
		} catch {
			// ignore
		}
		setToast({
			type: "info",
			message: "Fleet locked. Management capabilities returned to Read-Only mode.",
		});
	};

	// Add satellite with access-control check
	const handleAddSatellite = async (newSat: SatelliteInfo) => {
		if (!isAuthorized && !authToken) {
			setToast({
				type: "error",
				message: "Access Denied: Please enter a valid fleet access token to add satellites.",
			});
			setIsAccessModalOpen(true);
			return;
		}

		try {
			const res = await fetch("/api/satellites", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${authToken}`,
				},
				body: JSON.stringify(newSat),
			});

			if (res.status === 401) {
				setIsAuthorized(false);
				setToast({
					type: "error",
					message: "Access Denied: Invalid fleet token. Enter a valid token to add satellites.",
				});
				setIsAccessModalOpen(true);
				return;
			}

			if (!res.ok) {
				const errData = await res.json().catch(() => ({}));
				throw new Error(errData.error || "Failed to save satellite");
			}

			// Update state only on verified server success
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

			setToast({
				type: "success",
				message: `Satellite ${newSat.displayName} added to fleet!`,
			});
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Failed to persist satellite";
			setToast({ type: "error", message: msg });
		}
	};

	// Delete satellite with access-control check
	const handleDeleteSatellite = async (idOrNorad: string | number) => {
		const targetStr = idOrNorad.toString();

		if (!isAuthorized && !authToken) {
			setToast({
				type: "error",
				message: "Access Denied: Please enter a valid fleet access token to delete satellites.",
			});
			setIsAccessModalOpen(true);
			return;
		}

		try {
			const res = await fetch(`/api/satellites/${targetStr}`, {
				method: "DELETE",
				headers: {
					Authorization: `Bearer ${authToken}`,
				},
			});

			if (res.status === 401) {
				setIsAuthorized(false);
				setToast({
					type: "error",
					message: "Access Denied: Invalid fleet token. Enter a valid token to delete satellites.",
				});
				setIsAccessModalOpen(true);
				return;
			}

			if (!res.ok) {
				const errData = await res.json().catch(() => ({}));
				throw new Error(errData.error || "Failed to delete satellite");
			}

			// Update state only on verified server success
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

			setToast({
				type: "success",
				message: "Satellite removed from fleet.",
			});
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Failed to delete satellite";
			setToast({ type: "error", message: msg });
		}
	};

	// Reset fleet to default catalog with access-control check
	const handleResetFleet = async () => {
		if (!isAuthorized && !authToken) {
			setToast({
				type: "error",
				message: "Access Denied: Please enter a valid fleet access token to reset the fleet.",
			});
			setIsAccessModalOpen(true);
			return;
		}

		try {
			const res = await fetch("/api/satellites/reset", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${authToken}`,
				},
			});

			if (res.status === 401) {
				setIsAuthorized(false);
				setToast({
					type: "error",
					message: "Access Denied: Invalid fleet token. Enter a valid token to reset fleet.",
				});
				setIsAccessModalOpen(true);
				return;
			}

			if (res.ok) {
				const data = await res.json();
				if (Array.isArray(data.satellites)) {
					setSatellites(data.satellites);
					try {
						localStorage.removeItem(STORAGE_KEY_SATELLITES);
					} catch {
						// ignore
					}
					setToast({
						type: "success",
						message: "Fleet reset back to default catalog.",
					});
					return;
				}
			}
		} catch (err) {
			console.warn("Reset failed:", err);
			setToast({
				type: "error",
				message: "Failed to reset fleet.",
			});
		}
	};

	const handleSelectPassForRadar = useCallback((pass: SatellitePass) => {
		setSelectedPass(pass);
		navigateToTab("radar");
		const tabsEl = document.getElementById("main-nav-tabs");
		if (tabsEl) {
			tabsEl.scrollIntoView({ behavior: "smooth" });
		} else {
			window.scrollTo({ top: 0, behavior: "smooth" });
		}
	}, [navigateToTab]);

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

			{/* Floating Access / Action Toast Banner */}
			{toast && (
				<div className={`toast-banner toast-${toast.type}`}>
					<div className="toast-content">
						{toast.type === "success" && <Check size={18} className="toast-icon" />}
						{toast.type === "error" && <AlertCircle size={18} className="toast-icon" />}
						{toast.type === "info" && <ShieldCheck size={18} className="toast-icon" />}
						<span>{toast.message}</span>
					</div>
					<button className="toast-close-btn" onClick={() => setToast(null)} title="Dismiss">
						<X size={14} />
					</button>
				</div>
			)}

			{/* Main Mission Control Header */}
			<Header
				location={location}
				onOpenLocationModal={() => setIsLocationModalOpen(true)}
				onOpenAddSatelliteModal={() => setIsAddModalOpen(true)}
				onRefresh={recomputePasses}
				isRefreshing={isRefreshing}
				isAuthorized={isAuthorized}
				onOpenAccessModal={() => setIsAccessModalOpen(true)}
				timePeriodHours={timePeriodHours}
				onSelectTimePeriod={handleSelectTimePeriod}
				onNavigateHome={() => navigateToTab("hero")}
			/>

			{/* Main Dashboard Content */}
			<main className="main-content">
				{/* Dashboard Navigation Tabs */}
				<NavigationTabs
					activeTab={activeTab}
					onSelectTab={navigateToTab}
					passCount={passes.length}
					satelliteCount={satellites.length}
					hasActivePass={Boolean(activePass)}
				/>

				{/* Tab 1: Next Upcoming Pass (Hero View) */}
				{activeTab === "hero" && (
					<div className="hero-page-view">
						<PassCountdown
							nextPass={nextPass}
							activePass={activePass}
							liveTelemetry={activePass ? liveTelemetries[activePass.satelliteId] : null}
							onSelectPassForRadar={handleSelectPassForRadar}
							selectedTransmissionType={selectedTransmissionType}
							onSelectTransmissionType={setSelectedTransmissionType}
							timePeriodHours={timePeriodHours}
							onViewAllPasses={() => navigateToTab("passes")}
							passCount={passes.length}
						/>
					</div>
				)}

				{/* Tab 2: Configured Pass Schedule */}
				{activeTab === "passes" && (
					<PassList
						passes={passes}
						satellites={satellites}
						onSelectPassForRadar={handleSelectPassForRadar}
						selectedPassId={activeSelectedPass?.id}
						selectedTransmissionType={selectedTransmissionType}
						onSelectTransmissionType={setSelectedTransmissionType}
						timePeriodHours={timePeriodHours}
						onSelectTimePeriod={handleSelectTimePeriod}
					/>
				)}

				{/* Tab 3: Sky Radar & Polar Dome */}
				{activeTab === "radar" && (
					<SkyRadar
						passes={passes}
						selectedPass={activeSelectedPass}
						onSelectPass={setSelectedPass}
						liveTelemetries={liveTelemetries}
						satellites={satellites}
					/>
				)}

				{/* Tab 4: Tracked Fleet Specifications & Telemetry */}
				{activeTab === "fleet" && (
					<SatelliteFleet
						satellites={satellites}
						liveTelemetries={liveTelemetries}
						location={location}
						onOpenAddModal={() => setIsAddModalOpen(true)}
						onDeleteSatellite={handleDeleteSatellite}
						onResetFleet={handleResetFleet}
						isAuthorized={isAuthorized}
						onOpenAccessModal={() => setIsAccessModalOpen(true)}
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
				isAuthorized={isAuthorized}
				onOpenAccessModal={() => setIsAccessModalOpen(true)}
				existingSatellites={satellites}
			/>

			{/* Fleet Access Control Modal */}
			<FleetAccessModal
				isOpen={isAccessModalOpen}
				onClose={() => setIsAccessModalOpen(false)}
				authToken={authToken}
				isAuthorized={isAuthorized}
				onSaveToken={handleSaveToken}
				onClearToken={handleClearToken}
			/>
		</div>
	);
}

export default App;
