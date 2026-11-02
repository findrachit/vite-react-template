import { Hono } from "hono";
import { cors } from "hono/cors";
import defaultSatellites from "../data/satellites.json";

const app = new Hono<{ Bindings: Env }>();

const SATELLITES_KV_KEY = "satellites:list";

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
		storage: c.env.SATELLITES_KV ? "Cloudflare Workers KV" : "static-fallback",
		timestamp: new Date().toISOString(),
		satelliteCount: sats.length,
	});
});

// Get configured satellites list from KV
app.get("/api/satellites", async (c) => {
	const sats = await getSatellitesFleet(c.env);
	return c.json(sats);
});

// Add or update satellite in KV
app.post("/api/satellites", async (c) => {
	try {
		const body = await c.req.json();
		if (!body || !body.noradId || !body.tleLine1 || !body.tleLine2) {
			return c.json({ error: "Missing required fields (noradId, tleLine1, tleLine2)" }, 400);
		}

		const currentFleet = await getSatellitesFleet(c.env);
		const newSat: SatelliteRecord = {
			id: body.id || `sat-${body.noradId}-${Date.now()}`,
			name: body.name || `Satellite ${body.noradId}`,
			displayName: body.displayName || body.name || `Satellite ${body.noradId}`,
			noradId: parseInt(body.noradId, 10),
			color: body.color || "#38bdf8",
			category: body.category || "Tracked Asset",
			callsign: body.callsign,
			designator: body.designator,
			orbitType: body.orbitType || "Low Earth Orbit (LEO)",
			altitudeKm: body.altitudeKm,
			inclinationDeg: body.inclinationDeg,
			periodMin: body.periodMin,
			frequency: body.frequency,
			transmissions: body.transmissions,
			description: body.description || `Satellite tracked via NORAD catalog ID ${body.noradId}`,
			icon: body.icon || "satellite",
			tleLine1: body.tleLine1.trim(),
			tleLine2: body.tleLine2.trim(),
		};

		const existingIndex = currentFleet.findIndex(
			(s) => s.noradId === newSat.noradId || s.id === newSat.id
		);

		let updatedFleet: SatelliteRecord[];
		if (existingIndex >= 0) {
			updatedFleet = [...currentFleet];
			updatedFleet[existingIndex] = { ...updatedFleet[existingIndex], ...newSat };
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

// Delete satellite from KV
app.delete("/api/satellites/:idOrNorad", async (c) => {
	const param = c.req.param("idOrNorad");
	try {
		const currentFleet = await getSatellitesFleet(c.env);
		const updatedFleet = currentFleet.filter(
			(s) => s.id !== param && s.noradId.toString() !== param
		);

		if (c.env.SATELLITES_KV) {
			await c.env.SATELLITES_KV.put(SATELLITES_KV_KEY, JSON.stringify(updatedFleet));
		}

		return c.json({
			success: true,
			removed: param,
			total: updatedFleet.length,
		});
	} catch (e) {
		const message = e instanceof Error ? e.message : "Failed to delete satellite";
		return c.json({ error: message }, 500);
	}
});

// Reset KV back to default initial seed
app.post("/api/satellites/reset", async (c) => {
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
	const noradId = c.req.param("noradId");

	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 4000);

		const res = await fetch(
			`https://celestrak.org/NORAD/elements/gp.php?CATNR=${noradId}&FORMAT=TLE`,
			{
				signal: controller.signal,
				headers: { "User-Agent": "AstroPass/1.0" },
			}
		);
		clearTimeout(timeoutId);

		if (res.ok) {
			const text = await res.text();
			const lines = text
				.split("\n")
				.map((l) => l.trim())
				.filter(Boolean);
			if (lines.length >= 3 && lines[1].startsWith("1 ") && lines[2].startsWith("2 ")) {
				const freshTle = {
					noradId: parseInt(noradId, 10),
					name: lines[0],
					tleLine1: lines[1],
					tleLine2: lines[2],
					source: "celestrak-live",
					fetchedAt: new Date().toISOString(),
				};

				// Cache live TLE in KV for 24 hours
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

	// Try KV TLE cache
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
	const localSat = fleet.find((s) => s.noradId.toString() === noradId);

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
	const noradId = c.req.param("noradId");
	try {
		const res = await fetch(
			`https://celestrak.org/NORAD/elements/gp.php?CATNR=${noradId}&FORMAT=TLE`,
			{ headers: { "User-Agent": "AstroPass/1.0" } }
		);
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
			noradId: parseInt(noradId, 10),
			name: lines[0],
			tleLine1: lines[1],
			tleLine2: lines[2],
			source: "celestrak",
		});
	} catch (e) {
		const message = e instanceof Error ? e.message : "Lookup failed";
		return c.json({ error: message }, 500);
	}
});

export default app;
