import { Hono } from "hono";
import { cors } from "hono/cors";
import defaultSatellites from "../data/satellites.json";

const app = new Hono<{ Bindings: Env }>();

app.use("*", cors());

// Health check / API status
app.get("/api/", (c) => {
	return c.json({
		status: "online",
		service: "AstroPass Satellite Telemetry Engine",
		timestamp: new Date().toISOString(),
		satelliteCount: defaultSatellites.length,
	});
});

// Get configured satellites list
app.get("/api/satellites", (c) => {
	return c.json(defaultSatellites);
});

// Fetch fresh TLE from CelesTrak with fallback to local cached TLE
app.get("/api/tle/:noradId", async (c) => {
	const noradId = c.req.param("noradId");
	const localSat = defaultSatellites.find((s) => s.noradId.toString() === noradId);

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
				return c.json({
					noradId: parseInt(noradId, 10),
					name: lines[0],
					tleLine1: lines[1],
					tleLine2: lines[2],
					source: "celestrak-live",
					fetchedAt: new Date().toISOString(),
				});
			}
		}
	} catch {
		// Network or timeout failure, fall back to cached data
	}

	if (localSat) {
		return c.json({
			noradId: localSat.noradId,
			name: localSat.name,
			tleLine1: localSat.tleLine1,
			tleLine2: localSat.tleLine2,
			source: "local-cache",
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
