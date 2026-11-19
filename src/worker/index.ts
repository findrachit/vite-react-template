import { Hono } from "hono";
import { cors } from "hono/cors";
import defaultSatellites from "../data/satellites.json";
import {
	fetchComprehensiveSatNOGSInfo,
	fetchSatNOGSTransmitters,
	fetchSatNOGSTle,
	fetchSatNOGSTelemetry,
	formatSatNOGSTransmitters,
	SATNOGS_KV_TOKEN_KEY,
} from "./satnogs";

const app = new Hono<{ Bindings: Env }>();

const SATELLITES_KV_KEY = "satellites:list";
const AUTH_TOKEN_KV_KEY = "satellites:auth_token";
const MAX_FLEET_SIZE = 30;

const DEFAULT_SATELLITE_NORAD_IDS = new Set(defaultSatellites.map((s) => s.noradId));
const DEFAULT_SATELLITE_IDS = new Set(defaultSatellites.map((s) => s.id));

/**
 * Constant-time string equality check to prevent timing attacks.
 * Compares SHA-256 digests over fixed 32-byte buffers.
 */
async function timingSafeEqual(candidate: string, expected: string): Promise<boolean> {
	const enc = new TextEncoder();
	const [candDigest, expDigest] = await Promise.all([
		crypto.subtle.digest("SHA-256", enc.encode(candidate)),
		crypto.subtle.digest("SHA-256", enc.encode(expected)),
	]);

	const a = new Uint8Array(candDigest);
	const b = new Uint8Array(expDigest);
	let mismatch = 0;
	for (let i = 0; i < a.byteLength; i++) {
		mismatch |= a[i] ^ b[i];
	}
	return mismatch === 0;
}

interface SatelliteRecord {
	id: string;
	name: string;
	displayName: string;
	noradId: number;
	tleLine1: string;
	tleLine2: string;
	color: string;
	category?: string;
	callsign?: string;
	designator?: string;
	orbitType?: string;
	altitudeKm?: number;
	inclinationDeg?: number;
	periodMin?: number;
	frequency?: string;
	transmissions?: Array<{
		type: string;
		frequency: string;
		band?: string;
		description?: string;
	}>;
	description?: string;
	icon?: string;
}

// Curated prominent spacecraft for instant, high-quality substring matching & enrichment
const CURATED_SATELLITES: Array<{
	noradId: number;
	name: string;
	displayName: string;
	aliases?: string[];
	category: string;
	color: string;
	frequency?: string;
	transmissions?: SatelliteRecord["transmissions"];
	tleLine1: string;
	tleLine2: string;
}> = [
	{
		noradId: 20580,
		name: "HST",
		displayName: "HST (Hubble Space Telescope)",
		aliases: ["hubble", "hst", "telescope"],
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
		tleLine1: "1 20580U 90037B   26312.93854003  .00007990  00000+0  24186-3 0  9998",
		tleLine2: "2 20580  28.4712 170.1484 0001948 333.7369  26.3128 15.32230830810785",
	},
	{
		noradId: 25544,
		name: "ISS (ZARYA)",
		displayName: "International Space Station",
		aliases: ["iss", "zarya", "space station"],
		category: "Space Station",
		color: "#38bdf8",
		frequency: "145.800 MHz (FM Voice) / 437.550 MHz (SSTV) / 145.825 MHz (APRS) / 437.525 MHz",
		transmissions: [
			{
				type: "FM Voice",
				frequency: "145.800 MHz",
				band: "VHF",
				description: "Amateur Radio Crew Contact / Voice Downlink",
			},
			{
				type: "SSTV",
				frequency: "437.550 MHz",
				band: "UHF",
				description: "Slow-Scan TV (ARISS Event Downlink, Robot 36 mode)",
			},
			{
				type: "SSTV (VHF)",
				frequency: "145.800 MHz",
				band: "VHF",
				description: "Slow-Scan TV (ARISS Event Downlink, PD120 mode)",
			},
			{
				type: "APRS",
				frequency: "145.825 MHz",
				band: "VHF",
				description: "AX.25 Packet Radio Digipeater (1200 bps)",
			},
			{
				type: "Crossband Repeater",
				frequency: "437.525 MHz",
				band: "UHF",
				description: "FM Voice Crossband Repeater Downlink",
			},
		],
		tleLine1: "1 25544U 98067A   26312.88495931  .00008565  00000+0  16189-3 0  9992",
		tleLine2: "2 25544  51.6321 304.0500 0007248   4.0569 356.0477 15.49264925594183",
	},
	{
		noradId: 27607,
		name: "SAUDISAT 1C (SO-50)",
		displayName: "SO-50 (SaudiSat 1C)",
		aliases: ["so-50", "so50", "saudisat", "saudisat 1c"],
		category: "Amateur Radio / FM Repeater",
		color: "#f97316",
		frequency: "436.795 MHz (FM Downlink) / 145.850 MHz (FM Uplink)",
		transmissions: [
			{
				type: "FM Voice",
				frequency: "436.795 MHz",
				band: "UHF",
				description: "FM Voice Repeater Downlink (Uplink: 145.850 MHz with 67.0 Hz PL)",
			},
			{
				type: "FM Uplink",
				frequency: "145.850 MHz",
				band: "VHF",
				description: "Repeater Uplink (Requires 67.0 Hz PL tone; 74.4 Hz tone 2-sec arming)",
			},
		],
		tleLine1: "1 27607U 02058C   26320.87505036  .00001222  00000+0  16110-3 0  9992",
		tleLine2: "2 27607  64.5537  16.4743 0067773 234.2374 125.2419 14.83346806287109",
	},
	{
		noradId: 33591,
		name: "NOAA 19",
		displayName: "NOAA 19 (Weather Satellite)",
		aliases: ["noaa", "weather"],
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
		tleLine1: "1 33591U 09005A   26312.90995994  .00000049  00000+0  45534-4 0  9994",
		tleLine2: "2 33591  98.7799  18.5373 0010964 209.1028 150.9538 14.17809471345258",
	},
	{
		noradId: 40069,
		name: "METEOR-M 2",
		displayName: "Meteor M2",
		aliases: ["meteor", "weather"],
		category: "Weather Satellite",
		color: "#f59e0b",
		frequency: "137.100 MHz (LRPT) / 137.900 MHz",
		tleLine1: "1 40069U 14037A   26312.30261802  .00000187  00000+0  10472-3 0  9992",
		tleLine2: "2 40069  98.5323 283.0810 0005678 350.2970   9.8097 14.21497266639794",
	},
	{
		noradId: 43013,
		name: "NOAA 20 (JPSS-1)",
		displayName: "NOAA 20 (JPSS-1)",
		aliases: ["noaa", "jpss"],
		category: "Earth Observation",
		color: "#06b6d4",
		frequency: "7812.000 MHz (HRD Telemetry)",
		tleLine1: "1 43013U 17073A   26312.93854003  .00000020  00000+0  15037-3 0  9998",
		tleLine2: "2 43013  98.7845  65.9575 0004954 203.4444 156.6552 14.94528538 75500",
	},
	{
		noradId: 43017,
		name: "RADFXSAT (FOX-1B)",
		displayName: "FOX-1B (RadFxSat / AO-91)",
		aliases: ["fox-1b", "fox1b", "radfxsat", "ao-91", "ao91"],
		category: "Amateur Radio / FM Repeater",
		color: "#ec4899",
		frequency: "145.960 MHz (FM Downlink) / 435.250 MHz (FM Uplink)",
		transmissions: [
			{
				type: "FM Voice",
				frequency: "145.960 MHz",
				band: "VHF",
				description: "FM Voice Repeater Downlink & DUV High-Speed Telemetry",
			},
			{
				type: "FM Uplink",
				frequency: "435.250 MHz",
				band: "UHF",
				description: "Repeater Uplink (Requires 67.0 Hz PL tone)",
			},
		],
		tleLine1: "1 43017U 17073E   26321.10625487  .00008440  00000+0  35067-3 0  9999",
		tleLine2: "2 43017  97.4448 185.1960 0145067 158.9397 201.7894 15.14869907488526",
	},
	{
		noradId: 43803,
		name: "JY1SAT (JO-97)",
		displayName: "JO-97 (JY1Sat)",
		aliases: ["jo-97", "jo97", "jy1sat", "jy1-sat"],
		category: "Amateur Radio / Transponder",
		color: "#14b8a6",
		frequency: "145.855-145.875 MHz (Transponder Downlink) / 145.840 MHz (SSDV/SSTV)",
		transmissions: [
			{
				type: "Linear Transponder",
				frequency: "145.855-145.875 MHz",
				band: "VHF",
				description: "SSB/CW Inverting Transponder Downlink (Uplink: 435.100-435.120 MHz UHF)",
			},
			{
				type: "SSTV",
				frequency: "145.840 MHz",
				band: "VHF",
				description: "SSDV Images & Slow-Scan TV Downlink / 1200 bps BPSK Telemetry",
			},
		],
		tleLine1: "1 43803U 18099AX  26320.41430596  .00019937  00000+0  52682-3 0  9994",
		tleLine2: "2 43803  97.3942  24.1112 0006557  86.2933 273.9062 15.38445440436997",
	},
	{
		noradId: 44387,
		name: "METEOR-M2 2",
		displayName: "Meteor M2-2",
		aliases: ["meteor", "weather"],
		category: "Weather Satellite",
		color: "#3b82f6",
		frequency: "137.100 MHz (LRPT) / 137.900 MHz",
		tleLine1: "1 44387U 19038A   26312.31788851  .00000314  00000+0  15542-3 0  9999",
		tleLine2: "2 44387  98.9291 301.8398 0001187  12.9114 347.2094 14.24399741381817",
	},
	{
		noradId: 44909,
		name: "RS-44",
		displayName: "RS-44 (DOSAAF-85)",
		aliases: ["rs-44", "rs44", "dosaaf-85", "dosaaf"],
		category: "Amateur Radio / Transponder",
		color: "#8b5cf6",
		frequency: "435.610-435.670 MHz (Inverting Downlink) / 435.605 MHz (CW Beacon)",
		transmissions: [
			{
				type: "Linear Transponder",
				frequency: "435.610-435.670 MHz",
				band: "UHF",
				description: "SSB/CW Inverting Transponder Downlink (Uplink: 145.935-145.995 MHz VHF)",
			},
			{
				type: "CW Beacon",
				frequency: "435.605 MHz",
				band: "UHF",
				description: "CW Telemetry Beacon",
			},
		],
		tleLine1: "1 44909U 19096E   26321.15977578  .00000029  00000+0  66696-4 0  9991",
		tleLine2: "2 44909  82.5223 238.0418 0218011 146.4562 215.0566 12.79749982321916",
	},
	{
		noradId: 48274,
		name: "CSS (TIANHE)",
		displayName: "CSS (Tiangong Space Station)",
		aliases: ["tiangong", "css", "tianhe"],
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
		tleLine1: "1 48274U 21035A   26312.93676257  .00024984  00000+0  28547-3 0  9990",
		tleLine2: "2 48274  41.4672 162.4421 0004603 278.9725  81.0593 15.61583706315775",
	},
	{
		noradId: 50463,
		name: "JWST",
		displayName: "James Webb Space Telescope (JWST)",
		aliases: ["webb", "jwst", "telescope"],
		category: "Deep Space Telescope",
		color: "#a855f7",
		frequency: "2270.500 MHz (S-Band Direct)",
		tleLine1: "1 50463U 21130A   26312.00000000  .00000000  00000+0  00000+0 0  9999",
		tleLine2: "2 50463   0.0000   0.0000 0000000   0.0000   0.0000  0.00000000    01",
	},
	{
		noradId: 54234,
		name: "NOAA 21 (JPSS-2)",
		displayName: "NOAA 21 (JPSS-2)",
		aliases: ["noaa", "jpss"],
		category: "Earth Observation",
		color: "#06b6d4",
		frequency: "7812.000 MHz (HRD Telemetry)",
		tleLine1: "1 54234U 22150A   26312.85843543 -.00000024  00000+0  14156-3 0  9991",
		tleLine2: "2 54234 101.9991 327.1368 0008856 281.6311 252.0302 12.53207475377641",
	},
	{
		noradId: 57166,
		name: "METEOR-M2 3",
		displayName: "Meteor M2-3",
		aliases: ["meteor", "weather"],
		category: "Weather Satellite",
		color: "#06b6d4",
		frequency: "137.100 MHz (LRPT) / 137.900 MHz",
		tleLine1: "1 57166U 23091A   26312.34646257  .00000008  00000+0  22250-4 0  9993",
		tleLine2: "2 57166  98.5908   4.2391 0005038 107.7515 252.4214 14.24055830175035",
	},
	{
		noradId: 59051,
		name: "METEOR-M2 4",
		displayName: "Meteor M2-4",
		aliases: ["meteor", "weather"],
		category: "Weather Satellite",
		color: "#10b981",
		frequency: "137.100 MHz (LRPT) / 137.900 MHz",
		tleLine1: "1 59051U 24039A   26312.31350663  .00000017  00000+0  27133-4 0  9996",
		tleLine2: "2 59051  98.7230 269.9338 0008039 109.5265 250.6782 14.22442546139758",
	},
	{
		noradId: 67287,
		name: "LUCA (RS90S)",
		displayName: "Luca / Luča-1 (RS90S)",
		aliases: ["rs90s", "rs-90s", "luca", "luca-1", "luča-1", "luča"],
		category: "CubeSat / Amateur Radio",
		color: "#06b6d4",
		frequency: "437.180 MHz (GMSK Telemetry & SSTV Images)",
		transmissions: [
			{
				type: "GMSK Telemetry",
				frequency: "437.180 MHz",
				band: "UHF",
				description: "2400 / 4800 / 9600 bps USP Telemetry & Sensor Beacon",
			},
			{
				type: "SSTV",
				frequency: "437.180 MHz",
				band: "UHF",
				description: "Slow-Scan TV Image Downlink (Robot 36 mode)",
			},
		],
		tleLine1: "1 67287U 25313AR  26320.93526266  .00008935  00000+0  34078-3 0  9995",
		tleLine2: "2 67287  97.3799  34.0450 0009279 167.4413 192.7059 15.26871893 49269",
	},
];

/**
 * Validates NORAD Two-Line Element (TLE) syntax and catalog number alignment.
 */
function validateTleLines(
	tleLine1: string,
	tleLine2: string,
	expectedNoradId: number
): { valid: boolean; error?: string } {
	const l1 = tleLine1.trim();
	const l2 = tleLine2.trim();

	if (!l1.startsWith("1 ") || l1.length < 60 || l1.length > 75) {
		return { valid: false, error: "Invalid TLE Line 1: Must start with '1 ' and follow NORAD 69-character format." };
	}

	if (!l2.startsWith("2 ") || l2.length < 60 || l2.length > 75) {
		return { valid: false, error: "Invalid TLE Line 2: Must start with '2 ' and follow NORAD 69-character format." };
	}

	// Validate NORAD catalog numbers from columns 3-7 (0-indexed 2 to 7)
	const l1Norad = parseInt(l1.substring(2, 7).trim(), 10);
	if (!isNaN(l1Norad) && l1Norad !== expectedNoradId) {
		return {
			valid: false,
			error: `TLE Line 1 catalog number (${l1Norad}) does not match noradId (${expectedNoradId}).`,
		};
	}

	const l2Norad = parseInt(l2.substring(2, 7).trim(), 10);
	if (!isNaN(l2Norad) && l2Norad !== expectedNoradId) {
		return {
			valid: false,
			error: `TLE Line 2 catalog number (${l2Norad}) does not match noradId (${expectedNoradId}).`,
		};
	}

	return { valid: true };
}

/**
 * Sanitizes and validates satellite mutation payloads against schema rules.
 * Prevents mass assignment (BOPA) and verifies immutability of default satellites (BOLA).
 */
function sanitizeAndValidateSatelliteInput(
	rawBody: unknown
): { valid: true; data: SatelliteRecord } | { valid: false; error: string; statusCode: 400 | 403 } {
	if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
		return { valid: false, error: "Invalid JSON payload: Must be a JSON object", statusCode: 400 };
	}

	const body = rawBody as Record<string, unknown>;

	// 1. Validate noradId
	if (body.noradId === undefined || body.noradId === null) {
		return { valid: false, error: "Missing required field: noradId", statusCode: 400 };
	}
	const noradStr = String(body.noradId).trim();
	if (!/^\d{1,7}$/.test(noradStr)) {
		return { valid: false, error: "Field 'noradId' must be an integer between 1 and 9999999", statusCode: 400 };
	}
	const noradId = parseInt(noradStr, 10);
	if (noradId < 1 || noradId > 9999999) {
		return { valid: false, error: "Field 'noradId' must be between 1 and 9999999", statusCode: 400 };
	}

	// 2. Validate id (if provided)
	let satId = `sat-${noradId}-${Date.now()}`;
	if (typeof body.id === "string" && body.id.trim().length > 0) {
		const trimmedId = body.id.trim();
		if (!/^[a-zA-Z0-9_-]{1,64}$/.test(trimmedId)) {
			return {
				valid: false,
				error: "Field 'id' contains invalid characters. Use alphanumeric, dashes, or underscores (max 64 chars)",
				statusCode: 400,
			};
		}
		satId = trimmedId;
	}

	// VULN-03 BOLA check: Prevent modifying or overwriting default/core catalog satellites
	if (DEFAULT_SATELLITE_NORAD_IDS.has(noradId) || DEFAULT_SATELLITE_IDS.has(satId)) {
		return {
			valid: false,
			error: "Forbidden: Default catalog satellites are immutable and cannot be modified or overwritten.",
			statusCode: 403,
		};
	}

	// 3. Validate name
	if (typeof body.name !== "string" || body.name.trim().length === 0) {
		return { valid: false, error: "Field 'name' is required and must be a non-empty string", statusCode: 400 };
	}
	const name = body.name.trim().slice(0, 100);

	// 4. Validate displayName
	const displayName =
		typeof body.displayName === "string" && body.displayName.trim().length > 0
			? body.displayName.trim().slice(0, 100)
			: name;

	// 5. Validate TLE lines
	if (typeof body.tleLine1 !== "string" || typeof body.tleLine2 !== "string") {
		return { valid: false, error: "Missing required fields: tleLine1 and tleLine2 must be strings", statusCode: 400 };
	}
	const tleValidation = validateTleLines(body.tleLine1, body.tleLine2, noradId);
	if (!tleValidation.valid) {
		return { valid: false, error: tleValidation.error!, statusCode: 400 };
	}

	// 6. Validate color
	let color = "#38bdf8";
	if (typeof body.color === "string" && /^#[0-9a-fA-F]{6}$/.test(body.color.trim())) {
		color = body.color.trim();
	}

	// 7. Optional text fields
	const category = typeof body.category === "string" ? body.category.trim().slice(0, 50) : "Tracked Asset";
	const callsign = typeof body.callsign === "string" ? body.callsign.trim().slice(0, 50) : undefined;
	const designator = typeof body.designator === "string" ? body.designator.trim().slice(0, 50) : undefined;
	const orbitType = typeof body.orbitType === "string" ? body.orbitType.trim().slice(0, 50) : "Low Earth Orbit (LEO)";
	const frequency = typeof body.frequency === "string" ? body.frequency.trim().slice(0, 100) : undefined;
	const description =
		typeof body.description === "string"
			? body.description.trim().slice(0, 1000)
			: `Satellite tracked via NORAD catalog ID ${noradId}`;
	const icon =
		typeof body.icon === "string" && /^[a-zA-Z0-9_-]{1,30}$/.test(body.icon.trim())
			? body.icon.trim()
			: "satellite";

	// 8. Numeric orbital fields
	const altitudeKm =
		typeof body.altitudeKm === "number" && Number.isFinite(body.altitudeKm) && body.altitudeKm >= 0
			? body.altitudeKm
			: undefined;
	const inclinationDeg =
		typeof body.inclinationDeg === "number" && Number.isFinite(body.inclinationDeg)
			? body.inclinationDeg
			: undefined;
	const periodMin =
		typeof body.periodMin === "number" && Number.isFinite(body.periodMin) && body.periodMin > 0
			? body.periodMin
			: undefined;

	// 9. Transmissions array
	let transmissions: SatelliteRecord["transmissions"] = undefined;
	if (Array.isArray(body.transmissions)) {
		transmissions = [];
		for (const tx of body.transmissions.slice(0, 10)) {
			if (tx && typeof tx === "object" && typeof tx.type === "string" && typeof tx.frequency === "string") {
				transmissions.push({
					type: tx.type.trim().slice(0, 50),
					frequency: tx.frequency.trim().slice(0, 50),
					band: typeof tx.band === "string" ? tx.band.trim().slice(0, 50) : undefined,
					description: typeof tx.description === "string" ? tx.description.trim().slice(0, 200) : undefined,
				});
			}
		}
	}

	// Fallback to curated metadata if category, frequency, or transmissions are omitted
	const curatedMatch = CURATED_SATELLITES.find((c) => c.noradId === noradId);
	const finalCategory = category !== "Tracked Asset" ? category : (curatedMatch?.category || category);
	const finalFrequency = frequency || curatedMatch?.frequency;
	const finalTransmissions = transmissions && transmissions.length > 0 ? transmissions : curatedMatch?.transmissions;
	const finalDisplayName = displayName === name && curatedMatch?.displayName ? curatedMatch.displayName : displayName;
	if (color === "#38bdf8" && curatedMatch?.color) {
		color = curatedMatch.color;
	}

	// Strictly scoped record prevents mass assignment and prototype pollution
	const sanitizedRecord: SatelliteRecord = {
		id: satId,
		name,
		displayName: finalDisplayName,
		noradId,
		color,
		category: finalCategory,
		callsign,
		designator,
		orbitType,
		altitudeKm,
		inclinationDeg,
		periodMin,
		frequency: finalFrequency,
		transmissions: finalTransmissions,
		description,
		icon,
		tleLine1: body.tleLine1.trim(),
		tleLine2: body.tleLine2.trim(),
	};

	return { valid: true, data: sanitizedRecord };
}

/**
 * Retrieves the fleet auth token from Cloudflare Workers KV or environment bindings.
 * Fails closed (returns null) if no token is configured.
 */
async function getFleetAuthToken(env: Env): Promise<string | null> {
	if (env.SATELLITES_KV) {
		try {
			const existingToken = await env.SATELLITES_KV.get(AUTH_TOKEN_KV_KEY);
			if (existingToken && existingToken.trim().length > 0) {
				return existingToken.trim();
			}
		} catch (err) {
			console.error("KV auth token read error:", err);
		}
	}

	const envToken = ((env as unknown as Record<string, unknown>).FLEET_AUTH_TOKEN as string | undefined)?.trim();
	if (envToken && envToken.length > 0) {
		return envToken;
	}

	return null;
}

/**
 * Extracts candidate auth token from request headers:
 * - Authorization: Bearer <token>
 * - X-Auth-Token: <token>
 *
 * Query parameters and request bodies are rejected to prevent credential leakage (VULN-07).
 */
function extractToken(c: {
	req: {
		header: (name: string) => string | undefined;
	};
}): string | null {
	const authHeader = c.req.header("Authorization");
	if (authHeader) {
		const match = authHeader.match(/^Bearer\s+(.+)$/i);
		if (match) return match[1].trim();
		return authHeader.trim();
	}

	const xAuthToken = c.req.header("X-Auth-Token");
	if (xAuthToken) {
		return xAuthToken.trim();
	}

	return null;
}

/**
 * Validates request token against the token stored in Cloudflare Workers KV or environment.
 * Performs constant-time comparison to prevent timing side channels.
 */
async function isAuthorized(
	c: {
		req: {
			header: (name: string) => string | undefined;
		};
		env: Env;
	}
): Promise<boolean> {
	const expected = await getFleetAuthToken(c.env);
	if (!expected) {
		// Fail closed: No valid access token configured
		return false;
	}
	const candidate = extractToken(c);
	if (!candidate) return false;
	return timingSafeEqual(candidate, expected);
}

/**
 * Retrieves the satellite fleet from Cloudflare Workers KV.
 * If KV is uninitialized / empty, it self-seeds with defaultSatellites.
 */
async function getSatellitesFleet(env?: Env): Promise<SatelliteRecord[]> {
	if (!env || !env.SATELLITES_KV) {
		return defaultSatellites as unknown as SatelliteRecord[];
	}

	try {
		const cached = await env.SATELLITES_KV.get<SatelliteRecord[]>(SATELLITES_KV_KEY, "json");
		if (cached && Array.isArray(cached) && cached.length > 0) {
			const enriched = cached.map((sat) => {
				const defaultMatch = defaultSatellites.find((d) => d.id === sat.id || d.noradId === sat.noradId);
				if (defaultMatch) {
					return {
						...sat,
						frequency: defaultMatch.frequency,
						transmissions: defaultMatch.transmissions,
					};
				}
				const curated = CURATED_SATELLITES.find((c) => c.noradId === sat.noradId);
				if (curated && (!sat.transmissions || sat.transmissions.length === 0)) {
					return {
						...sat,
						displayName: sat.displayName && !sat.displayName.startsWith("Satellite ") ? sat.displayName : curated.displayName,
						category: sat.category && sat.category !== "Tracked Asset" ? sat.category : curated.category,
						color: sat.color || curated.color,
						frequency: sat.frequency || curated.frequency,
						transmissions: curated.transmissions,
					};
				}
				return sat;
			});
			return enriched;
		}

		// Self-seed KV with default satellites on initial access
		await env.SATELLITES_KV.put(
			SATELLITES_KV_KEY,
			JSON.stringify(defaultSatellites)
		);
	} catch (err) {
		console.error("KV read/seed error:", err);
	}

	return defaultSatellites as unknown as SatelliteRecord[];
}

app.use("*", cors());

// Health check / API status
app.get("/api/", async (c) => {
	const sats = await getSatellitesFleet(c.env);
	return c.json({
		status: "online",
		service: "AstroPass Satellite Telemetry Engine",
		accessControl: "Fleet Auth Token",
		timestamp: new Date().toISOString(),
		satelliteCount: sats.length,
	});
});

// Access control status
app.get("/api/auth/status", async (c) => {
	const token = await getFleetAuthToken(c.env);
	return c.json({
		status: token ? "active" : "unconfigured",
		authRequired: true,
	});
});

// Verify if a token is valid
app.post("/api/auth/verify", async (c) => {
	const authorized = await isAuthorized(c);
	if (!authorized) {
		return c.json(
			{
				valid: false,
				error: "Invalid or missing access token",
			},
			401
		);
	}

	return c.json({
		valid: true,
		message: "Fleet access token verified",
	});
});

// Get configured satellites list from KV (public read-only)
app.get("/api/satellites", async (c) => {
	const sats = await getSatellitesFleet(c.env);
	return c.json(sats);
});

// Add or update satellite in KV (access-controlled)
app.post("/api/satellites", async (c) => {
	try {
		const authorized = await isAuthorized(c);
		if (!authorized) {
			return c.json(
				{
					error: "Unauthorized: Valid access token required to add or modify satellites in the fleet",
					authRequired: true,
				},
				401
			);
		}

		let body: unknown;
		try {
			body = await c.req.json();
		} catch {
			return c.json({ error: "Invalid JSON payload" }, 400);
		}

		const validation = sanitizeAndValidateSatelliteInput(body);
		if (!validation.valid) {
			return c.json({ error: validation.error }, validation.statusCode);
		}

		const newSat = validation.data;
		const currentFleet = await getSatellitesFleet(c.env);

		const existingIndex = currentFleet.findIndex(
			(s) => s.noradId === newSat.noradId || s.id === newSat.id
		);

		if (existingIndex < 0 && currentFleet.length >= MAX_FLEET_SIZE) {
			return c.json(
				{ error: `Fleet size limit reached (maximum ${MAX_FLEET_SIZE} satellites allowed)` },
				400
			);
		}

		let updatedFleet: SatelliteRecord[];
		if (existingIndex >= 0) {
			updatedFleet = [...currentFleet];
			updatedFleet[existingIndex] = newSat;
		} else {
			updatedFleet = [...currentFleet, newSat];
		}

		if (c.env.SATELLITES_KV) {
			await c.env.SATELLITES_KV.put(SATELLITES_KV_KEY, JSON.stringify(updatedFleet));
		}

		return c.json({
			success: true,
			satellite: newSat,
			total: updatedFleet.length,
		});
	} catch (e) {
		const message = e instanceof Error ? e.message : "Failed to save satellite";
		return c.json({ error: message }, 500);
	}
});

// Delete satellite from KV (access-controlled)
app.delete("/api/satellites/:idOrNorad", async (c) => {
	const authorized = await isAuthorized(c);
	if (!authorized) {
		return c.json(
			{
				error: "Unauthorized: Valid access token required to delete satellites from the fleet",
				authRequired: true,
			},
			401
		);
	}

	const param = c.req.param("idOrNorad");
	if (!param || !/^[a-zA-Z0-9_-]{1,64}$/.test(param)) {
		return c.json({ error: "Invalid satellite identifier" }, 400);
	}

	// VULN-03: Default catalog satellite protection
	const isDefaultSat =
		DEFAULT_SATELLITE_IDS.has(param) ||
		defaultSatellites.some((s) => s.noradId.toString() === param);
	if (isDefaultSat) {
		return c.json(
			{
				error: "Forbidden: Default catalog satellites cannot be deleted from the fleet",
			},
			403
		);
	}

	try {
		const currentFleet = await getSatellitesFleet(c.env);
		const targetIndex = currentFleet.findIndex(
			(s) => s.id === param || s.noradId.toString() === param
		);

		if (targetIndex === -1) {
			return c.json({ error: "Satellite not found in fleet" }, 404);
		}

		const removedSat = currentFleet[targetIndex];
		const updatedFleet = currentFleet.filter((_, idx) => idx !== targetIndex);

		if (c.env.SATELLITES_KV) {
			await c.env.SATELLITES_KV.put(SATELLITES_KV_KEY, JSON.stringify(updatedFleet));
		}

		return c.json({
			success: true,
			removed: removedSat.id,
			noradId: removedSat.noradId,
			total: updatedFleet.length,
		});
	} catch (e) {
		const message = e instanceof Error ? e.message : "Failed to delete satellite";
		return c.json({ error: message }, 500);
	}
});

// Reset KV back to default initial seed (access-controlled)
app.post("/api/satellites/reset", async (c) => {
	const authorized = await isAuthorized(c);
	if (!authorized) {
		return c.json(
			{
				error: "Unauthorized: Valid access token required to reset the satellite fleet",
				authRequired: true,
			},
			401
		);
	}

	try {
		if (c.env.SATELLITES_KV) {
			await c.env.SATELLITES_KV.put(SATELLITES_KV_KEY, JSON.stringify(defaultSatellites));
		}
		return c.json({
			success: true,
			satellites: defaultSatellites,
			total: defaultSatellites.length,
		});
	} catch (e) {
		const message = e instanceof Error ? e.message : "Failed to reset satellites";
		return c.json({ error: message }, 500);
	}
});

// Fetch fresh TLE from CelesTrak with fallback to KV cache & catalog
app.get("/api/tle/:noradId", async (c) => {
	const noradParam = c.req.param("noradId");

	// VULN-05: Strict numeric validation
	if (!noradParam || !/^\d{1,7}$/.test(noradParam)) {
		return c.json({ error: "Invalid NORAD catalog ID. Must be 1-7 numeric digits." }, 400);
	}
	const noradId = parseInt(noradParam, 10);
	if (noradId < 1 || noradId > 9999999) {
		return c.json({ error: "NORAD ID out of valid range" }, 400);
	}

	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 4000);

		const upstreamUrl = new URL("https://celestrak.org/NORAD/elements/gp.php");
		upstreamUrl.searchParams.set("CATNR", noradId.toString());
		upstreamUrl.searchParams.set("FORMAT", "TLE");

		const res = await fetch(upstreamUrl.toString(), {
			signal: controller.signal,
			headers: { "User-Agent": "AstroPass/1.0" },
		});
		clearTimeout(timeoutId);

		if (res.ok) {
			const text = await res.text();
			const lines = text
				.split("\n")
				.map((l) => l.trim())
				.filter(Boolean);
			if (lines.length >= 3 && lines[1].startsWith("1 ") && lines[2].startsWith("2 ")) {
				const freshTle = {
					noradId,
					name: lines[0],
					tleLine1: lines[1],
					tleLine2: lines[2],
					source: "celestrak-live",
					fetchedAt: new Date().toISOString(),
				};

				// Cache live TLE in KV for 24 hours under sanitized numeric key
				if (c.env.SATELLITES_KV) {
					c.executionCtx.waitUntil(
						c.env.SATELLITES_KV.put(`tle:${noradId}`, JSON.stringify(freshTle), {
							expirationTtl: 86400,
						})
					);
				}

				return c.json(freshTle);
			}
		}
	} catch {
		// Network or timeout failure, fall back to cached data
	}

	// Try KV TLE cache with sanitized key
	if (c.env.SATELLITES_KV) {
		try {
			const cached = await c.env.SATELLITES_KV.get(`tle:${noradId}`, "json");
			if (cached) {
				return c.json({ ...(cached as object), source: "kv-cache" });
			}
		} catch {
			// ignore KV error
		}
	}

	// Try fleet catalog in KV or default
	const fleet = await getSatellitesFleet(c.env);
	const localSat = fleet.find((s) => s.noradId === noradId);

	if (localSat) {
		return c.json({
			noradId: localSat.noradId,
			name: localSat.name,
			tleLine1: localSat.tleLine1,
			tleLine2: localSat.tleLine2,
			source: "kv-catalog",
			fetchedAt: new Date().toISOString(),
		});
	}

	// Try SatNOGS DB for live TLE fallback
	try {
		const satnogsTle = await fetchSatNOGSTle(noradId, c.env);
		if (satnogsTle?.tle1 && satnogsTle?.tle2) {
			const freshTle = {
				noradId,
				name: satnogsTle.tle0 ? satnogsTle.tle0.replace(/^0\s+/, "") : `Satellite ${noradId}`,
				tleLine1: satnogsTle.tle1,
				tleLine2: satnogsTle.tle2,
				source: "satnogs-db",
				fetchedAt: new Date().toISOString(),
			};
			if (c.env.SATELLITES_KV) {
				c.executionCtx.waitUntil(
					c.env.SATELLITES_KV.put(`tle:${noradId}`, JSON.stringify(freshTle), {
						expirationTtl: 86400,
					})
				);
			}
			return c.json(freshTle);
		}
	} catch (err) {
		console.warn("SatNOGS TLE query fallback error:", err);
	}

	return c.json({ error: "Satellite TLE not found" }, 404);
});

// Search satellites by name with fast substring matching and multi-provider fallback
app.get("/api/lookup/search", async (c) => {
	const query = (c.req.query("name") || c.req.query("q") || "").trim();

	if (!query) {
		return c.json({ error: "Missing search query parameter ('name' or 'q')" }, 400);
	}

	if (query.length < 2 || query.length > 60) {
		return c.json({ error: "Search query must be between 2 and 60 characters" }, 400);
	}

	if (!/^[a-zA-Z0-9\s\-_.()]+$/.test(query)) {
		return c.json({ error: "Search query contains invalid characters" }, 400);
	}

	const normalizedQuery = query.toLowerCase();

	const resultsMap = new Map<
		number,
		{
			noradId: number;
			name: string;
			displayName: string;
			tleLine1: string;
			tleLine2: string;
			category?: string;
			frequency?: string;
			transmissions?: SatelliteRecord["transmissions"];
			color?: string;
			source: "catalog" | "celestrak" | "tle-api";
		}
	>();

	// 1. Prepare search terms with alias expansions (e.g. Hubble -> HST, Tiangong -> CSS)
	const queriesToTry = [query];
	const aliasMap: Record<string, string[]> = {
		hubble: ["HST"],
		tiangong: ["CSS"],
		iss: ["ISS (ZARYA)"],
		webb: ["JWST"],
		"so-50": ["SAUDISAT 1C (SO-50)", "27607"],
		so50: ["SAUDISAT 1C (SO-50)", "27607"],
		"fox-1b": ["RADFXSAT (FOX-1B)", "43017"],
		fox1b: ["RADFXSAT (FOX-1B)", "43017"],
		radfxsat: ["RADFXSAT (FOX-1B)", "43017"],
		"jo-97": ["JY1SAT (JO-97)", "43803"],
		jo97: ["JY1SAT (JO-97)", "43803"],
		jy1sat: ["JY1SAT (JO-97)", "43803"],
		"rs-44": ["RS-44", "44909"],
		rs44: ["RS-44", "44909"],
		rs90s: ["LUCA (RS90S)", "67287"],
		"rs-90s": ["LUCA (RS90S)", "67287"],
		luca: ["LUCA (RS90S)", "67287"],
	};

	for (const [key, aliases] of Object.entries(aliasMap)) {
		if (normalizedQuery.includes(key)) {
			for (const a of aliases) {
				if (!queriesToTry.includes(a)) {
					queriesToTry.push(a);
				}
			}
		}
	}

	// Helper to check substring match
	const matchesQuery = (text?: string, aliases?: string[]): boolean => {
		if (!text) return false;
		const lower = text.toLowerCase();
		if (lower.includes(normalizedQuery)) return true;
		for (const q of queriesToTry) {
			if (lower.includes(q.toLowerCase())) return true;
		}
		if (aliases) {
			for (const a of aliases) {
				if (a.toLowerCase().includes(normalizedQuery)) return true;
			}
		}
		return false;
	};

	// 2. Check curated prominent satellites (instant match)
	for (const cur of CURATED_SATELLITES) {
		if (
			matchesQuery(cur.name, cur.aliases) ||
			matchesQuery(cur.displayName, cur.aliases) ||
			cur.noradId.toString() === query
		) {
			resultsMap.set(cur.noradId, {
				noradId: cur.noradId,
				name: cur.name,
				displayName: cur.displayName,
				tleLine1: cur.tleLine1,
				tleLine2: cur.tleLine2,
				category: cur.category,
				frequency: cur.frequency,
				transmissions: cur.transmissions,
				color: cur.color,
				source: "catalog",
			});
		}
	}

	// 3. Check local fleet in KV/storage
	try {
		const localFleet = await getSatellitesFleet(c.env);
		for (const s of localFleet) {
			if (
				matchesQuery(s.name) ||
				matchesQuery(s.displayName) ||
				s.noradId.toString() === query
			) {
				if (!resultsMap.has(s.noradId)) {
					resultsMap.set(s.noradId, {
						noradId: s.noradId,
						name: s.name,
						displayName: s.displayName || s.name,
						tleLine1: s.tleLine1,
						tleLine2: s.tleLine2,
						category: s.category,
						frequency: s.frequency,
						transmissions: s.transmissions,
						color: s.color,
						source: "catalog",
					});
				}
			}
		}
	} catch (err) {
		console.warn("Error querying local fleet for search:", err);
	}

	// 4. Query fast REST TLE API (substring search across all tracked orbital objects)
	await Promise.allSettled(
		queriesToTry.map(async (searchTerm) => {
			try {
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), 4000);

				const url = new URL("https://tle.ivanstanojevic.me/api/tle/");
				url.searchParams.set("search", searchTerm);
				url.searchParams.set("page-size", "30");

				const res = await fetch(url.toString(), {
					signal: controller.signal,
					headers: {
						"User-Agent": "AstroPass/1.0",
						Accept: "application/json",
					},
				});
				clearTimeout(timeoutId);

				if (res.ok) {
					const data = (await res.json()) as {
						member?: Array<{
							satelliteId: number;
							name: string;
							line1: string;
							line2: string;
						}>;
					};

					if (Array.isArray(data.member)) {
						for (const item of data.member) {
							if (item.satelliteId && item.name && item.line1 && item.line2) {
								if (!resultsMap.has(item.satelliteId)) {
									// Enrich with curated metadata if available
									const curated = CURATED_SATELLITES.find((c) => c.noradId === item.satelliteId);

									resultsMap.set(item.satelliteId, {
										noradId: item.satelliteId,
										name: item.name.trim(),
										displayName: curated?.displayName || item.name.trim(),
										category: curated?.category,
										frequency: curated?.frequency,
										transmissions: curated?.transmissions,
										color: curated?.color,
										tleLine1: item.line1.trim(),
										tleLine2: item.line2.trim(),
										source: "tle-api",
									});
								}
							}
						}
					}
				}
			} catch (err) {
				console.warn("TLE API search error for term:", searchTerm, err);
			}
		})
	);

	// 5. Fallback to CelesTrak if TLE API didn't return matches
	if (resultsMap.size === 0) {
		for (const q of queriesToTry) {
			if (resultsMap.size >= 25) break;

			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 4500);

			try {
				const upstreamUrl = new URL("https://celestrak.org/NORAD/elements/gp.php");
				upstreamUrl.searchParams.set("NAME", q);
				upstreamUrl.searchParams.set("FORMAT", "TLE");

				const res = await fetch(upstreamUrl.toString(), {
					signal: controller.signal,
					headers: { "User-Agent": "AstroPass/1.0" },
				});

				if (res.ok) {
					const text = await res.text();
					const lines = text
						.split("\n")
						.map((l) => l.trim())
						.filter(Boolean);

					for (let i = 0; i < lines.length - 1; i++) {
						if (lines[i].startsWith("1 ") && lines[i + 1]?.startsWith("2 ") && i > 0) {
							const satName = lines[i - 1].trim();
							const tleLine1 = lines[i].trim();
							const tleLine2 = lines[i + 1].trim();
							const noradId = parseInt(tleLine1.substring(2, 7).trim(), 10);

							if (!isNaN(noradId) && !resultsMap.has(noradId)) {
								const curated = CURATED_SATELLITES.find((c) => c.noradId === noradId);
								resultsMap.set(noradId, {
									noradId,
									name: satName,
									displayName: curated?.displayName || satName,
									category: curated?.category,
									frequency: curated?.frequency,
									transmissions: curated?.transmissions,
									color: curated?.color,
									tleLine1,
									tleLine2,
									source: "celestrak",
								});
							}
							i += 1;
						}
						if (resultsMap.size >= 30) break;
					}
				}
			} catch (e) {
				console.warn("CelesTrak name search fallback timeout/error:", q, e);
			} finally {
				clearTimeout(timeoutId);
			}
		}
	}

	// 6. If query is purely numeric (NORAD ID) and not found yet, also try CATNR
	if (/^\d{1,7}$/.test(query) && resultsMap.size === 0) {
		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 4000);
			const catRes = await fetch(
				`https://celestrak.org/NORAD/elements/gp.php?CATNR=${query}&FORMAT=TLE`,
				{
					signal: controller.signal,
					headers: { "User-Agent": "AstroPass/1.0" },
				}
			);
			clearTimeout(timeoutId);
			if (catRes.ok) {
				const text = await catRes.text();
				const lines = text
					.split("\n")
					.map((l) => l.trim())
					.filter(Boolean);
				if (lines.length >= 3 && lines[1].startsWith("1 ") && lines[2].startsWith("2 ")) {
					const noradId = parseInt(query, 10);
					const curated = CURATED_SATELLITES.find((c) => c.noradId === noradId);
					resultsMap.set(noradId, {
						noradId,
						name: lines[0],
						displayName: curated?.displayName || lines[0],
						category: curated?.category,
						frequency: curated?.frequency,
						transmissions: curated?.transmissions,
						color: curated?.color,
						tleLine1: lines[1],
						tleLine2: lines[2],
						source: "celestrak",
					});
				}
			}
		} catch {
			// ignore
		}
	}

	// Sort results: Put active satellites with rich metadata or shorter names first
	const results = Array.from(resultsMap.values())
		.sort((a, b) => {
			const aIsDebris = a.name.includes("DEB") || (a.displayName && a.displayName.includes("DEB"));
			const bIsDebris = b.name.includes("DEB") || (b.displayName && b.displayName.includes("DEB"));
			if (aIsDebris !== bIsDebris) return aIsDebris ? 1 : -1;
			return a.noradId - b.noradId;
		})
		.slice(0, 35);

	return c.json({
		query,
		count: results.length,
		results,
	});
});

// Lookup any satellite by NORAD catalog ID with CelesTrak and SatNOGS DB integration
app.get("/api/lookup/:noradId", async (c) => {
	const noradParam = c.req.param("noradId");

	// VULN-05: Strict numeric validation
	if (!noradParam || !/^\d{1,7}$/.test(noradParam)) {
		return c.json({ error: "Invalid NORAD catalog ID. Must be 1-7 numeric digits." }, 400);
	}
	const noradId = parseInt(noradParam, 10);
	if (noradId < 1 || noradId > 9999999) {
		return c.json({ error: "NORAD ID out of valid range" }, 400);
	}

	// Concurrently query SatNOGS DB for transmitter details, status, operator, and TLE
	const satnogsPromise = fetchComprehensiveSatNOGSInfo(noradId, c.env).catch(() => null);

	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 5000);

		const upstreamUrl = new URL("https://celestrak.org/NORAD/elements/gp.php");
		upstreamUrl.searchParams.set("CATNR", noradId.toString());
		upstreamUrl.searchParams.set("FORMAT", "TLE");

		const res = await fetch(upstreamUrl.toString(), {
			signal: controller.signal,
			headers: { "User-Agent": "AstroPass/1.0" },
		});
		clearTimeout(timeoutId);

		const satnogsData = await satnogsPromise;

		if (res.ok) {
			const text = await res.text();
			const lines = text
				.split("\n")
				.map((l) => l.trim())
				.filter(Boolean);
			if (lines.length >= 3 && lines[1].startsWith("1 ") && lines[2].startsWith("2 ")) {
				return c.json({
					noradId,
					name: lines[0],
					displayName: satnogsData?.displayName || lines[0],
					tleLine1: lines[1],
					tleLine2: lines[2],
					source: "celestrak",
					satnogs: satnogsData || undefined,
					frequency: satnogsData?.frequency,
					transmissions: satnogsData?.transmissions,
					operator: satnogsData?.operator,
					status: satnogsData?.status,
					imageUrl: satnogsData?.imageUrl,
				});
			}
		}

		// If CelesTrak fails or returns 404, fallback to SatNOGS DB TLE if available
		if (satnogsData && satnogsData.tleLine1 && satnogsData.tleLine2) {
			return c.json({
				noradId,
				name: satnogsData.name,
				displayName: satnogsData.displayName,
				tleLine1: satnogsData.tleLine1,
				tleLine2: satnogsData.tleLine2,
				source: "satnogs",
				satnogs: satnogsData,
				frequency: satnogsData.frequency,
				transmissions: satnogsData.transmissions,
				operator: satnogsData.operator,
				status: satnogsData.status,
				imageUrl: satnogsData.imageUrl,
			});
		}

		return c.json({ error: `Satellite ${noradId} not found on CelesTrak or SatNOGS DB` }, 404);
	} catch (e) {
		const satnogsData = await satnogsPromise;
		if (satnogsData && satnogsData.tleLine1 && satnogsData.tleLine2) {
			return c.json({
				noradId,
				name: satnogsData.name,
				displayName: satnogsData.displayName,
				tleLine1: satnogsData.tleLine1,
				tleLine2: satnogsData.tleLine2,
				source: "satnogs",
				satnogs: satnogsData,
				frequency: satnogsData.frequency,
				transmissions: satnogsData.transmissions,
				operator: satnogsData.operator,
				status: satnogsData.status,
				imageUrl: satnogsData.imageUrl,
			});
		}
		const message = e instanceof Error && e.name === "AbortError" ? "Lookup request timed out" : "Lookup failed";
		return c.json({ error: message }, 502);
	}
});

// ==========================================
// SatNOGS DB REST API Endpoints
// ==========================================

// SatNOGS DB status check (never leaks the token)
app.get("/api/satnogs/status", async (c) => {
	const envToken = c.env.SATNOGS_API_TOKEN?.trim();
	let kvToken: string | null = null;
	if (c.env.SATELLITES_KV) {
		try {
			kvToken = await c.env.SATELLITES_KV.get(SATNOGS_KV_TOKEN_KEY);
		} catch {
			// ignore
		}
	}

	const hasEnvToken = !!(envToken && envToken.length > 0);
	const hasKvToken = !!(kvToken && kvToken.trim().length > 0);
	const isConfigured = hasEnvToken || hasKvToken;

	return c.json({
		status: "online",
		configured: isConfigured,
		source: hasEnvToken ? "env" : hasKvToken ? "kv" : "unconfigured",
		apiBase: "https://db.satnogs.org/api",
		endpoints: {
			satellite: "/api/satnogs/satellite/:noradId",
			transmitters: "/api/satnogs/transmitters/:noradId",
			tle: "/api/satnogs/tle/:noradId",
			telemetry: "/api/satnogs/telemetry/:noradId",
		},
	});
});

// SatNOGS DB: Full enriched satellite information by NORAD catalog ID
app.get("/api/satnogs/satellite/:noradId", async (c) => {
	const noradParam = c.req.param("noradId");
	if (!noradParam || !/^\d{1,7}$/.test(noradParam)) {
		return c.json({ error: "Invalid NORAD catalog ID. Must be 1-7 numeric digits." }, 400);
	}
	const noradId = parseInt(noradParam, 10);

	// Check KV cache first (1 hour cache)
	if (c.env.SATELLITES_KV) {
		try {
			const cached = await c.env.SATELLITES_KV.get(`satnogs:sat:${noradId}`, "json");
			if (cached) {
				return c.json(cached);
			}
		} catch {
			// ignore
		}
	}

	const info = await fetchComprehensiveSatNOGSInfo(noradId, c.env);
	if (!info) {
		return c.json({ error: `Satellite ${noradId} not found in SatNOGS DB` }, 404);
	}

	// Cache in KV
	if (c.env.SATELLITES_KV) {
		c.executionCtx.waitUntil(
			c.env.SATELLITES_KV.put(`satnogs:sat:${noradId}`, JSON.stringify(info), {
				expirationTtl: 3600,
			})
		);
	}

	return c.json(info);
});

// SatNOGS DB: Transmitters and RF communication specifications by NORAD ID
app.get("/api/satnogs/transmitters/:noradId", async (c) => {
	const noradParam = c.req.param("noradId");
	if (!noradParam || !/^\d{1,7}$/.test(noradParam)) {
		return c.json({ error: "Invalid NORAD catalog ID. Must be 1-7 numeric digits." }, 400);
	}
	const noradId = parseInt(noradParam, 10);

	const rawTransmitters = await fetchSatNOGSTransmitters(noradId, c.env);
	const formatted = formatSatNOGSTransmitters(rawTransmitters);

	return c.json({
		noradId,
		count: formatted.length,
		transmissions: formatted,
		raw: rawTransmitters,
	});
});

// SatNOGS DB: Latest Two-Line Element (TLE) set by NORAD ID
app.get("/api/satnogs/tle/:noradId", async (c) => {
	const noradParam = c.req.param("noradId");
	if (!noradParam || !/^\d{1,7}$/.test(noradParam)) {
		return c.json({ error: "Invalid NORAD catalog ID. Must be 1-7 numeric digits." }, 400);
	}
	const noradId = parseInt(noradParam, 10);

	const tle = await fetchSatNOGSTle(noradId, c.env);
	if (!tle) {
		return c.json({ error: `TLE for satellite ${noradId} not found in SatNOGS DB` }, 404);
	}

	return c.json(tle);
});

// SatNOGS DB: Telemetry observations by NORAD ID
app.get("/api/satnogs/telemetry/:noradId", async (c) => {
	const noradParam = c.req.param("noradId");
	if (!noradParam || !/^\d{1,7}$/.test(noradParam)) {
		return c.json({ error: "Invalid NORAD catalog ID. Must be 1-7 numeric digits." }, 400);
	}
	const noradId = parseInt(noradParam, 10);
	const limitParam = c.req.query("limit");
	const limit = limitParam && /^\d+$/.test(limitParam) ? Math.min(parseInt(limitParam, 10), 50) : 10;

	const telemetry = await fetchSatNOGSTelemetry(noradId, c.env, limit);
	return c.json({
		noradId,
		count: telemetry.length,
		frames: telemetry,
	});
});

// SatNOGS DB: Secure token configuration in Workers KV (admin/authorized)
app.post("/api/satnogs/token", async (c) => {
	const authorized = await isAuthorized(c);
	if (!authorized) {
		return c.json({ error: "Unauthorized. Valid fleet access token required." }, 401);
	}

	if (!c.env.SATELLITES_KV) {
		return c.json({ error: "KV storage is not bound to this Worker." }, 500);
	}

	let body: { token?: unknown };
	try {
		body = await c.req.json();
	} catch {
		return c.json({ error: "Invalid JSON body" }, 400);
	}

	const rawToken = typeof body.token === "string" ? body.token.trim() : "";
	if (!rawToken || rawToken.length < 16 || rawToken.length > 128) {
		return c.json({ error: "Token must be a non-empty string between 16 and 128 characters." }, 400);
	}

	if (!/^[a-zA-Z0-9_\-]+$/.test(rawToken)) {
		return c.json({ error: "Token contains invalid characters." }, 400);
	}

	await c.env.SATELLITES_KV.put(SATNOGS_KV_TOKEN_KEY, rawToken);

	return c.json({
		success: true,
		message: "SatNOGS API token securely configured in Workers KV.",
		source: "kv",
	});
});

// SatNOGS DB: Remove token from Workers KV (admin/authorized)
app.delete("/api/satnogs/token", async (c) => {
	const authorized = await isAuthorized(c);
	if (!authorized) {
		return c.json({ error: "Unauthorized. Valid fleet access token required." }, 401);
	}

	if (!c.env.SATELLITES_KV) {
		return c.json({ error: "KV storage is not bound to this Worker." }, 500);
	}

	await c.env.SATELLITES_KV.delete(SATNOGS_KV_TOKEN_KEY);

	return c.json({
		success: true,
		message: "SatNOGS API token removed from Workers KV.",
	});
});

export default app;
