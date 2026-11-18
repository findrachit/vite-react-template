import type { IdealPassesSettings, SatellitePass, SkyDirection } from "../types";

export const STORAGE_KEY_IDEAL_PASSES = "astropass_ideal_passes";
export const STORAGE_KEY_IDEAL_PASSES_DIRECTIONS = "astropass_ideal_passes_directions";
export const STORAGE_KEY_IDEAL_PASSES_SETTINGS = "astropass_ideal_passes_settings";

export const DEFAULT_OVERHEAD_THRESHOLD = 60; // Max elevation (degrees) above which passes are considered overhead / zenith

export const ALL_SKY_DIRECTIONS: SkyDirection[] = [
	"eastern",
	"southern",
	"western",
	"northern",
];

export const SKY_DIRECTION_INFO: Record<
	SkyDirection,
	{
		label: string;
		shortLabel: string;
		azimuthRange: string;
		startDeg: number;
		endDeg: number;
		description: string;
		badgeClass: string;
	}
> = {
	eastern: {
		label: "Eastern Sky",
		shortLabel: "East",
		azimuthRange: "45° – 135°",
		startDeg: 45,
		endDeg: 135,
		description: "Facing sunrise / East horizon, rising or setting eastward",
		badgeClass: "badge-dir-east",
	},
	southern: {
		label: "Southern Sky",
		shortLabel: "South",
		azimuthRange: "135° – 225°",
		startDeg: 135,
		endDeg: 225,
		description: "Facing South, optimal for low/mid southern inclinations",
		badgeClass: "badge-dir-south",
	},
	western: {
		label: "Western Sky",
		shortLabel: "West",
		azimuthRange: "225° – 315°",
		startDeg: 225,
		endDeg: 315,
		description: "Facing sunset / West horizon, rising or setting westward",
		badgeClass: "badge-dir-west",
	},
	northern: {
		label: "Northern Sky",
		shortLabel: "North",
		azimuthRange: "315° – 45°",
		startDeg: 315,
		endDeg: 45,
		description: "Facing True North, polar orbiters crossing northward",
		badgeClass: "badge-dir-north",
	},
};

export const DEFAULT_IDEAL_PASSES_SETTINGS: IdealPassesSettings = {
	entireSky: true,
	directions: ["eastern", "southern", "western", "northern"],
	includeOverhead: true,
	maxElevationThreshold: DEFAULT_OVERHEAD_THRESHOLD,
};

export interface SkyPreset {
	id: string;
	title: string;
	subtitle: string;
	directions: SkyDirection[];
	includeOverhead: boolean;
	isDefault?: boolean;
}

export const SKY_PRESETS: SkyPreset[] = [
	{
		id: "entire-sky",
		title: "Entire Sky (Default)",
		subtitle: "Unobstructed 360° horizon & overhead zenith access",
		directions: ["eastern", "southern", "western", "northern"],
		includeOverhead: true,
		isDefault: true,
	},
	{
		id: "east-south-balconies",
		title: "East & South Balconies",
		subtitle: "Filters out West, North, and overhead passes blocked by building & ceiling",
		directions: ["eastern", "southern"],
		includeOverhead: false,
	},
	{
		id: "east-balcony",
		title: "East Balcony Only",
		subtitle: "Facing East (45° – 135°), excludes overhead ceiling passes",
		directions: ["eastern"],
		includeOverhead: false,
	},
	{
		id: "south-balcony",
		title: "South Balcony Only",
		subtitle: "Facing South (135° – 225°), excludes overhead ceiling passes",
		directions: ["southern"],
		includeOverhead: false,
	},
	{
		id: "west-balcony",
		title: "West Balcony Only",
		subtitle: "Facing West (225° – 315°), excludes overhead ceiling passes",
		directions: ["western"],
		includeOverhead: false,
	},
	{
		id: "north-balcony",
		title: "North Balcony Only",
		subtitle: "Facing North (315° – 45°), excludes overhead ceiling passes",
		directions: ["northern"],
		includeOverhead: false,
	},
];

/**
 * Returns which sky quadrant(s) correspond to a given azimuth in degrees [0, 360).
 * Handles boundary transitions (e.g. 45° NE bridges North and East).
 */
export function getAzimuthDirections(azimuthDeg: number): SkyDirection[] {
	const norm = ((azimuthDeg % 360) + 360) % 360;
	const matched: SkyDirection[] = [];

	// Northern: 315° to 45° (spans across 0° / 360°)
	if (norm >= 315 || norm <= 45) {
		matched.push("northern");
	}
	// Eastern: 45° to 135°
	if (norm >= 45 && norm <= 135) {
		matched.push("eastern");
	}
	// Southern: 135° to 225°
	if (norm >= 135 && norm <= 225) {
		matched.push("southern");
	}
	// Western: 225° to 315°
	if (norm >= 225 && norm <= 315) {
		matched.push("western");
	}

	return matched.length > 0 ? matched : ["northern"];
}

/**
 * Returns the primary cardinal direction for an azimuth angle.
 */
export function getAzimuthPrimaryDirection(azimuthDeg: number): SkyDirection {
	const norm = ((azimuthDeg % 360) + 360) % 360;
	if (norm >= 45 && norm < 135) return "eastern";
	if (norm >= 135 && norm < 225) return "southern";
	if (norm >= 225 && norm < 315) return "western";
	return "northern";
}

/**
 * Checks whether a pass exceeds the overhead elevation limit (e.g. >= 60°).
 */
export function isPassOverhead(
	pass: SatellitePass,
	threshold = DEFAULT_OVERHEAD_THRESHOLD
): boolean {
	return pass.maxElevation >= threshold;
}

/**
 * Returns the primary sky direction of the pass culmination (peak).
 */
export function getPassPrimaryDirection(pass: SatellitePass): SkyDirection {
	return getAzimuthPrimaryDirection(pass.peakAzimuth);
}

/**
 * Determines whether a satellite pass is an "Ideal pass" given observer sky access settings.
 */
export function isPassIdeal(
	pass: SatellitePass,
	settings: IdealPassesSettings
): boolean {
	// Entire sky allows all passes
	if (settings.entireSky) {
		return true;
	}

	const hasAllFourDirs = ALL_SKY_DIRECTIONS.every((d) =>
		settings.directions.includes(d)
	);

	if (hasAllFourDirs && settings.includeOverhead) {
		return true;
	}

	// 1. Overhead Check:
	// If overhead passes are disabled (e.g. balcony with roof/overhang ceiling),
	// passes exceeding the overhead threshold (default >= 60°) cannot be received.
	const overheadCutoff = settings.maxElevationThreshold ?? DEFAULT_OVERHEAD_THRESHOLD;
	const isOverhead = pass.maxElevation >= overheadCutoff;
	if (isOverhead && !settings.includeOverhead) {
		return false;
	}

	// 2. Directional Horizon Check:
	if (!settings.directions || settings.directions.length === 0) {
		return false;
	}

	// Primary match: pass culmination (peak azimuth)
	const peakDirs = getAzimuthDirections(pass.peakAzimuth);
	if (peakDirs.some((dir) => settings.directions.includes(dir))) {
		return true;
	}

	// Secondary match: pass trajectory points above 10° elevation
	// If satellite spends a substantial portion (>= 40%) in the visible balcony view
	if (pass.points && pass.points.length >= 3) {
		const highPoints = pass.points.filter((pt) => pt.elevation >= 10);
		if (highPoints.length >= 2) {
			const visiblePoints = highPoints.filter((pt) => {
				const ptDirs = getAzimuthDirections(pt.azimuth);
				return ptDirs.some((d) => settings.directions.includes(d));
			});
			if (visiblePoints.length / highPoints.length >= 0.4) {
				return true;
			}
		}
	}

	return false;
}

/**
 * Safely loads Ideal Passes settings from localStorage, supporting multiple legacy & object formats.
 */
export function loadIdealPassesSettings(): IdealPassesSettings {
	if (typeof window === "undefined" || !window.localStorage) {
		return { ...DEFAULT_IDEAL_PASSES_SETTINGS };
	}

	try {
		// Priority 1: Primary storage key
		const storage = window.localStorage;
		const raw =
			storage.getItem(STORAGE_KEY_IDEAL_PASSES) ||
			storage.getItem(STORAGE_KEY_IDEAL_PASSES_SETTINGS) ||
			storage.getItem(STORAGE_KEY_IDEAL_PASSES_DIRECTIONS);

		if (!raw) {
			return { ...DEFAULT_IDEAL_PASSES_SETTINGS };
		}

		const parsed = JSON.parse(raw);

		// Format A: Full Object
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			const directions: SkyDirection[] = Array.isArray(parsed.directions)
				? parsed.directions.filter((d: string): d is SkyDirection =>
						ALL_SKY_DIRECTIONS.includes(d as SkyDirection)
				  )
				: [...DEFAULT_IDEAL_PASSES_SETTINGS.directions];

			const entireSky =
				typeof parsed.entireSky === "boolean"
					? parsed.entireSky
					: directions.length === 4;

			const includeOverhead =
				typeof parsed.includeOverhead === "boolean"
					? parsed.includeOverhead
					: entireSky;

			const maxElevationThreshold =
				typeof parsed.maxElevationThreshold === "number" &&
				parsed.maxElevationThreshold >= 30 &&
				parsed.maxElevationThreshold <= 90
					? parsed.maxElevationThreshold
					: DEFAULT_OVERHEAD_THRESHOLD;

			return {
				entireSky,
				directions: directions.length > 0 ? directions : [...ALL_SKY_DIRECTIONS],
				includeOverhead,
				maxElevationThreshold,
			};
		}

		// Format B: Array of direction strings, e.g. ["eastern", "southern"]
		if (Array.isArray(parsed)) {
			const rawList = parsed.map((s) => String(s).toLowerCase().trim());
			if (rawList.includes("all") || rawList.includes("entire") || rawList.includes("entire_sky")) {
				return { ...DEFAULT_IDEAL_PASSES_SETTINGS };
			}

			const validDirs = rawList.filter((d): d is SkyDirection =>
				ALL_SKY_DIRECTIONS.includes(d as SkyDirection)
			);

			const hasAll = ALL_SKY_DIRECTIONS.every((d) => validDirs.includes(d));
			const includeOverhead = hasAll || rawList.includes("overhead");

			return {
				entireSky: hasAll && includeOverhead,
				directions: validDirs.length > 0 ? validDirs : [...ALL_SKY_DIRECTIONS],
				includeOverhead,
				maxElevationThreshold: DEFAULT_OVERHEAD_THRESHOLD,
			};
		}
	} catch (e) {
		console.warn("Could not load Ideal Passes settings from localStorage:", e);
	}

	return { ...DEFAULT_IDEAL_PASSES_SETTINGS };
}

/**
 * Safely persists Ideal Passes settings to localStorage.
 */
export function saveIdealPassesSettings(settings: IdealPassesSettings): void {
	if (typeof window === "undefined" || !window.localStorage) return;
	try {
		const storage = window.localStorage;
		storage.setItem(STORAGE_KEY_IDEAL_PASSES, JSON.stringify(settings));
		storage.setItem(
			STORAGE_KEY_IDEAL_PASSES_DIRECTIONS,
			JSON.stringify(settings.directions)
		);
	} catch (e) {
		console.warn("Could not save Ideal Passes settings to localStorage:", e);
	}
}

/**
 * Returns a human-friendly string summarizing the active sky access configuration.
 */
export function formatSkyAccessSummary(settings: IdealPassesSettings): string {
	if (settings.entireSky) {
		return "Entire Sky";
	}

	const hasAllDirs = ALL_SKY_DIRECTIONS.every((d) =>
		settings.directions.includes(d)
	);

	if (hasAllDirs && !settings.includeOverhead) {
		return "All Horizons (No Overhead)";
	}

	if (settings.directions.length === 0) {
		return "None Selected";
	}

	const names = settings.directions.map(
		(d) => SKY_DIRECTION_INFO[d]?.shortLabel || d
	);

	const joined = names.join(" & ");
	return settings.includeOverhead ? joined : `${joined} (Balcony)`;
}
