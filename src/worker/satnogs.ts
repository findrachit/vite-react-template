/**
 * SatNOGS DB REST API Integration
 * Documentation: https://db.satnogs.org/api/schema/docs/#/
 * 
 * Secure credential handling conforming to Cloudflare Workers standards:
 * 1. Primary standard: Environment secret binding via `env.SATNOGS_API_TOKEN`
 *    - Production: configured with `wrangler secret put SATNOGS_API_TOKEN`
 *    - Local development: loaded by Wrangler from git-ignored `.dev.vars`
 * 2. Secondary fallback: Dynamic KV storage via `env.SATELLITES_KV.get("satnogs:api_token")`
 *    - Allows authenticated runtime updates without redeployment
 * 
 * Never leaks the API token to client responses or logs.
 */

export const SATNOGS_API_BASE = "https://db.satnogs.org/api";
export const SATNOGS_KV_TOKEN_KEY = "satnogs:api_token";

export interface SatNOGSSatellite {
	sat_id: string;
	norad_cat_id: number;
	norad_follow_id?: number | null;
	name: string;
	names?: string;
	image?: string;
	status?: string;
	decayed?: string | null;
	launched?: string | null;
	deployed?: string | null;
	website?: string;
	operator?: string;
	countries?: string;
	citation?: string;
	is_frequency_violator?: boolean;
	reception_status?: string;
}

export interface SatNOGSTransmitter {
	uuid: string;
	description?: string;
	alive?: boolean;
	type?: string;
	uplink_low?: number | null;
	uplink_high?: number | null;
	uplink_drift?: number | null;
	uplink_drifted?: number | null;
	downlink_low?: number | null;
	downlink_high?: number | null;
	downlink_drift?: number | null;
	downlink_drifted?: number | null;
	mode?: string;
	mode_id?: number | null;
	uplink_mode?: string | null;
	invert?: boolean;
	baud?: number | null;
	sat_id?: string;
	norad_cat_id?: number;
	status?: string;
	updated?: string;
	citation?: string;
	service?: string;
}

export interface SatNOGSTle {
	tle0?: string;
	tle1: string;
	tle2: string;
	tle_source?: string;
	sat_id?: string;
	norad_cat_id: number;
	updated?: string;
}

export interface SatNOGSTelemetryFrame {
	norad_cat_id: number;
	transmitter?: string | null;
	app_source?: string;
	decoded?: string;
	frame?: string;
	observer?: string;
	timestamp?: string;
}

export interface SatNOGSTelemetryResponse {
	next?: string | null;
	previous?: string | null;
	results: SatNOGSTelemetryFrame[];
}

export interface FormattedTransmission {
	type: string;
	frequency: string;
	band?: string;
	description?: string;
	mode?: string;
	baud?: number;
	status?: string;
	uplink?: string;
	downlink?: string;
}

export interface EnrichedSatNOGSSatelliteInfo {
	noradId: number;
	satId: string;
	name: string;
	displayName: string;
	status?: string;
	launched?: string | null;
	decayed?: string | null;
	website?: string;
	operator?: string;
	countries?: string;
	imageUrl?: string;
	frequency?: string;
	transmissions: FormattedTransmission[];
	tleLine1?: string;
	tleLine2?: string;
	tleSource?: string;
	tleUpdated?: string;
	source: "satnogs";
}

/**
 * Retrieves the SatNOGS API token conforming to Cloudflare Worker standards:
 * 1. Checks Cloudflare Worker environment secret `SATNOGS_API_TOKEN`
 * 2. Falls back to Cloudflare Workers KV `satnogs:api_token`
 */
export async function getSatNOGSToken(env: Env): Promise<string | null> {
	// 1. Worker Environment Secret binding (wrangler secret / .dev.vars)
	const envToken = env.SATNOGS_API_TOKEN?.trim();
	if (envToken && envToken.length > 0) {
		return envToken;
	}

	// 2. Workers KV Namespace storage fallback
	if (env.SATELLITES_KV) {
		try {
			const kvToken = await env.SATELLITES_KV.get(SATNOGS_KV_TOKEN_KEY);
			if (kvToken && kvToken.trim().length > 0) {
				return kvToken.trim();
			}
		} catch (err) {
			console.error("Error reading SatNOGS token from KV:", err);
		}
	}

	return null;
}

/**
 * Converts frequency in Hz to formatted MHz string.
 */
export function formatFrequencyHz(hz?: number | null): string | null {
	if (typeof hz !== "number" || isNaN(hz) || hz <= 0) return null;
	const mhz = hz / 1e6;
	if (mhz >= 1000) {
		return `${mhz.toFixed(3)} MHz (${(mhz / 1000).toFixed(3)} GHz)`;
	}
	return `${mhz.toFixed(3)} MHz`;
}

/**
 * Determines radio band based on frequency in Hz.
 */
export function getBandFromFrequency(hz?: number | null): string | undefined {
	if (typeof hz !== "number" || isNaN(hz) || hz <= 0) return undefined;
	const mhz = hz / 1e6;
	if (mhz >= 3 && mhz < 30) return "HF";
	if (mhz >= 30 && mhz < 300) return "VHF";
	if (mhz >= 300 && mhz < 1000) return "UHF";
	if (mhz >= 1000 && mhz < 2000) return "L-Band";
	if (mhz >= 2000 && mhz < 4000) return "S-Band";
	if (mhz >= 4000 && mhz < 8000) return "C-Band";
	if (mhz >= 8000 && mhz < 12000) return "X-Band";
	if (mhz >= 12000 && mhz < 18000) return "Ku-Band";
	if (mhz >= 18000 && mhz < 27000) return "K-Band";
	if (mhz >= 27000 && mhz < 40000) return "Ka-Band";
	return undefined;
}

/**
 * Formats a list of raw SatNOGS transmitters into clean, user-friendly transmission objects.
 */
export function formatSatNOGSTransmitters(transmitters: SatNOGSTransmitter[]): FormattedTransmission[] {
	if (!Array.isArray(transmitters)) return [];

	return transmitters
		.filter((t) => t && (t.downlink_low || t.uplink_low || t.description))
		.map((t) => {
			const downHz = t.downlink_low || t.downlink_high;
			const upHz = t.uplink_low || t.uplink_high;
			const downStr = formatFrequencyHz(downHz);
			const upStr = formatFrequencyHz(upHz);

			let freqDisplay = "";
			if (downStr && upStr && downStr !== upStr) {
				freqDisplay = `${downStr} (Down) / ${upStr} (Up)`;
			} else if (downStr) {
				freqDisplay = downStr;
			} else if (upStr) {
				freqDisplay = `${upStr} (Up)`;
			} else {
				freqDisplay = "Frequency TBD";
			}

			const band = getBandFromFrequency(downHz || upHz);
			const type = t.type || (t.mode ? `${t.mode} Downlink` : "Transmitter");

			let desc = t.description?.trim() || "";
			if (t.service && t.service !== "Unknown") {
				desc = desc ? `${desc} [${t.service}]` : `[${t.service}]`;
			}
			if (t.baud) {
				desc = desc ? `${desc} (${t.baud} baud)` : `${t.baud} baud`;
			}

			return {
				type,
				frequency: freqDisplay,
				band,
				description: desc || undefined,
				mode: t.mode || undefined,
				baud: t.baud || undefined,
				status: t.status || (t.alive ? "active" : undefined),
				uplink: upStr || undefined,
				downlink: downStr || undefined,
			};
		});
}

/**
 * Securely calls SatNOGS DB REST API endpoint with timeout and optional token authorization.
 */
export async function satnogsFetch(
	endpoint: string,
	env: Env,
	params: Record<string, string> = {},
	timeoutMs = 6000
): Promise<Response> {
	const token = await getSatNOGSToken(env);

	const url = new URL(`${SATNOGS_API_BASE}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`);
	url.searchParams.set("format", "json");
	for (const [key, value] of Object.entries(params)) {
		url.searchParams.set(key, value);
	}

	const headers: Record<string, string> = {
		Accept: "application/json",
		"User-Agent": "AstroPass/1.0 (+https://github.com/satnogs)",
	};

	// SatNOGS DB expects token authentication in the format: `Token <key>`
	if (token) {
		headers["Authorization"] = `Token ${token}`;
	}

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

	try {
		return await fetch(url.toString(), {
			signal: controller.signal,
			headers,
		});
	} finally {
		clearTimeout(timeoutId);
	}
}

/**
 * Fetches satellite metadata from SatNOGS DB by NORAD catalog ID.
 */
export async function fetchSatNOGSSatelliteRecord(
	noradId: number,
	env: Env
): Promise<SatNOGSSatellite | null> {
	try {
		const res = await satnogsFetch("/satellites/", env, {
			norad_cat_id: noradId.toString(),
		});

		if (!res.ok) {
			console.warn(`SatNOGS satellites query failed with status: ${res.status}`);
			return null;
		}

		const data = (await res.json()) as SatNOGSSatellite[];
		if (Array.isArray(data) && data.length > 0) {
			return data[0];
		}
		return null;
	} catch (err) {
		console.warn(`SatNOGS satellite fetch error for NORAD ${noradId}:`, err);
		return null;
	}
}

/**
 * Fetches RF transmitters for a satellite from SatNOGS DB by NORAD catalog ID.
 */
export async function fetchSatNOGSTransmitters(
	noradId: number,
	env: Env
): Promise<SatNOGSTransmitter[]> {
	try {
		const res = await satnogsFetch("/transmitters/", env, {
			satellite__norad_cat_id: noradId.toString(),
		});

		if (!res.ok) {
			console.warn(`SatNOGS transmitters query failed with status: ${res.status}`);
			return [];
		}

		const data = (await res.json()) as SatNOGSTransmitter[];
		return Array.isArray(data) ? data : [];
	} catch (err) {
		console.warn(`SatNOGS transmitters fetch error for NORAD ${noradId}:`, err);
		return [];
	}
}

/**
 * Fetches latest Two-Line Element (TLE) set from SatNOGS DB by NORAD catalog ID.
 */
export async function fetchSatNOGSTle(
	noradId: number,
	env: Env
): Promise<SatNOGSTle | null> {
	try {
		const res = await satnogsFetch("/tle/", env, {
			norad_cat_id: noradId.toString(),
		});

		if (!res.ok) {
			console.warn(`SatNOGS TLE query failed with status: ${res.status}`);
			return null;
		}

		const data = (await res.json()) as SatNOGSTle[];
		if (Array.isArray(data) && data.length > 0) {
			return data[0];
		}
		return null;
	} catch (err) {
		console.warn(`SatNOGS TLE fetch error for NORAD ${noradId}:`, err);
		return null;
	}
}

/**
 * Fetches recent telemetry observations from SatNOGS DB.
 */
export async function fetchSatNOGSTelemetry(
	noradId: number,
	env: Env,
	limit = 10
): Promise<SatNOGSTelemetryFrame[]> {
	try {
		const res = await satnogsFetch("/telemetry/", env, {
			satellite: noradId.toString(),
		});

		if (!res.ok) {
			console.warn(`SatNOGS telemetry query failed with status: ${res.status}`);
			return [];
		}

		const data = (await res.json()) as SatNOGSTelemetryResponse | SatNOGSTelemetryFrame[];
		if (Array.isArray(data)) {
			return data.slice(0, limit);
		}
		if (data && Array.isArray(data.results)) {
			return data.results.slice(0, limit);
		}
		return [];
	} catch (err) {
		console.warn(`SatNOGS telemetry fetch error for NORAD ${noradId}:`, err);
		return [];
	}
}

/**
 * Fetches comprehensive enriched satellite profile from SatNOGS DB:
 * combines satellite metadata, transmitters, and latest TLE into a unified record.
 */
export async function fetchComprehensiveSatNOGSInfo(
	noradId: number,
	env: Env
): Promise<EnrichedSatNOGSSatelliteInfo | null> {
	// Query satellite info, transmitters, and TLE concurrently for performance
	const [satelliteResult, transmittersResult, tleResult] = await Promise.allSettled([
		fetchSatNOGSSatelliteRecord(noradId, env),
		fetchSatNOGSTransmitters(noradId, env),
		fetchSatNOGSTle(noradId, env),
	]);

	const satellite = satelliteResult.status === "fulfilled" ? satelliteResult.value : null;
	const transmitters = transmittersResult.status === "fulfilled" ? transmittersResult.value : [];
	const tle = tleResult.status === "fulfilled" ? tleResult.value : null;

	if (!satellite && transmitters.length === 0 && !tle) {
		return null;
	}

	const formattedTransmissions = formatSatNOGSTransmitters(transmitters);

	// Primary frequency string: take the first active or prominent transmission
	const primaryTransmission = formattedTransmissions.find((t) => t.status === "active") || formattedTransmissions[0];
	const frequency = primaryTransmission
		? `${primaryTransmission.frequency}${primaryTransmission.type ? ` (${primaryTransmission.type})` : ""}`
		: undefined;

	let imageUrl: string | undefined = undefined;
	if (satellite?.image) {
		if (satellite.image.startsWith("http://") || satellite.image.startsWith("https://")) {
			imageUrl = satellite.image;
		} else {
			imageUrl = `https://db-satnogs.freetls.fastly.net/media/${satellite.image}`;
		}
	}

	const name = satellite?.name?.trim() || `Satellite ${noradId}`;
	const altNames = satellite?.names?.trim();
	const displayName = altNames && altNames !== name ? `${name} (${altNames})` : name;

	return {
		noradId,
		satId: satellite?.sat_id || `satnogs-${noradId}`,
		name,
		displayName,
		status: satellite?.status || "in orbit",
		launched: satellite?.launched || null,
		decayed: satellite?.decayed || null,
		website: satellite?.website || undefined,
		operator: satellite?.operator !== "None" ? satellite?.operator : undefined,
		countries: satellite?.countries || undefined,
		imageUrl,
		frequency,
		transmissions: formattedTransmissions,
		tleLine1: tle?.tle1,
		tleLine2: tle?.tle2,
		tleSource: tle?.tle_source,
		tleUpdated: tle?.updated,
		source: "satnogs",
	};
}
