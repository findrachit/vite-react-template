import { Hono } from "hono";
import { cors } from "hono/cors";
import defaultSatellites from "../data/satellites.json";

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

	// Strictly scoped record prevents mass assignment and prototype pollution
	const sanitizedRecord: SatelliteRecord = {
		id: satId,
		name,
		displayName,
		noradId,
		color,
		category,
		callsign,
		designator,
		orbitType,
		altitudeKm,
		inclinationDeg,
		periodMin,
		frequency,
		transmissions,
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
async function getSatellitesFleet(env: Env): Promise<SatelliteRecord[]> {
	if (!env.SATELLITES_KV) {
		return defaultSatellites as unknown as SatelliteRecord[];
	}

	try {
		const cached = await env.SATELLITES_KV.get<SatelliteRecord[]>(SATELLITES_KV_KEY, "json");
		if (cached && Array.isArray(cached) && cached.length > 0) {
			return cached;
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

	return c.json({ error: "Satellite TLE not found" }, 404);
});

// Lookup any satellite by NORAD catalog ID from CelesTrak
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

		if (!res.ok) {
			return c.json({ error: `Satellite ${noradId} not found on CelesTrak` }, 404);
		}
		const text = await res.text();
		const lines = text
			.split("\n")
			.map((l) => l.trim())
			.filter(Boolean);
		if (lines.length < 3 || !lines[1].startsWith("1 ") || !lines[2].startsWith("2 ")) {
			return c.json({ error: "Invalid TLE data returned" }, 400);
		}

		return c.json({
			noradId,
			name: lines[0],
			tleLine1: lines[1],
			tleLine2: lines[2],
			source: "celestrak",
		});
	} catch (e) {
		const message = e instanceof Error && e.name === "AbortError" ? "Lookup request timed out" : "Lookup failed";
		return c.json({ error: message }, 502);
	}
});

export default app;
