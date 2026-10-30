import * as sat from "satellite.js";
import type {
	SatelliteInfo,
	ObserverLocation,
	SatellitePass,
	PassPoint,
	LiveTelemetry,
	PassVisibility,
	ElevationCategory,
	SatelliteTransmission,
} from "../types";

export function rad2deg(rad: number): number {
	return rad * (180 / Math.PI);
}

export function deg2rad(deg: number): number {
	return deg * (Math.PI / 180);
}

export function getJulianDate(date: Date): number {
	return date.getTime() / 86400000 + 2440587.5;
}

export function getSunEci(date: Date): { x: number; y: number; z: number } {
	const jd = getJulianDate(date);
	const tut1 = (jd - 2451545.0) / 36525.0;
	const meanlong = (280.46 + 36000.77 * tut1) % 360;
	let meananomaly = ((357.5277233 + 35999.05034 * tut1) * (Math.PI / 180)) % (2 * Math.PI);
	if (meananomaly < 0) meananomaly += 2 * Math.PI;

	const eclplong =
		(((meanlong +
			1.914666471 * Math.sin(meananomaly) +
			0.019994643 * Math.sin(2 * meananomaly)) %
			360) *
			(Math.PI / 180));
	const obliquity = (23.439291 - 0.0130042 * tut1) * (Math.PI / 180);

	const magr =
		(1.000140612 -
			0.016708617 * Math.cos(meananomaly) -
			0.000139589 * Math.cos(2 * meananomaly)) *
		149597870.7; // km

	return {
		x: magr * Math.cos(eclplong),
		y: magr * Math.cos(obliquity) * Math.sin(eclplong),
		z: magr * Math.sin(obliquity) * Math.sin(eclplong),
	};
}

export function isSatelliteSunlit(
	satPosKm: { x: number; y: number; z: number },
	sunEciKm: { x: number; y: number; z: number }
): boolean {
	const sunMag = Math.sqrt(
		sunEciKm.x * sunEciKm.x + sunEciKm.y * sunEciKm.y + sunEciKm.z * sunEciKm.z
	);
	const sunUx = sunEciKm.x / sunMag;
	const sunUy = sunEciKm.y / sunMag;
	const sunUz = sunEciKm.z / sunMag;

	const dot = satPosKm.x * sunUx + satPosKm.y * sunUy + satPosKm.z * sunUz;
	if (dot > 0) return true; // on day side of Earth

	const satMagSq = satPosKm.x * satPosKm.x + satPosKm.y * satPosKm.y + satPosKm.z * satPosKm.z;
	const perpDistSq = satMagSq - dot * dot;
	const earthRadiusSq = 6378.137 * 6378.137;

	return perpDistSq > earthRadiusSq;
}

const COMPASS_DIRECTIONS = [
	"N",
	"NNE",
	"NE",
	"ENE",
	"E",
	"ESE",
	"SE",
	"SSE",
	"S",
	"SSW",
	"SW",
	"WSW",
	"W",
	"WNW",
	"NW",
	"NNW",
];

export function azimuthToDirection(deg: number): string {
	const normalized = ((deg % 360) + 360) % 360;
	const index = Math.round(normalized / 22.5) % 16;
	return COMPASS_DIRECTIONS[index];
}

export function formatDegrees(deg: number, decimals = 1): string {
	return `${deg.toFixed(decimals)}°`;
}

export function formatDuration(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	if (m === 0) return `${s}s`;
	return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export function getSunElevation(date: Date, observer: ObserverLocation): number {
	try {
		const sunEci = getSunEci(date);
		const gmst = sat.gstime(date);
		const sunEcf = sat.eciToEcf(sunEci, gmst);
		const obsGd = {
			latitude: sat.degreesToRadians(observer.latitude),
			longitude: sat.degreesToRadians(observer.longitude),
			height: observer.altitude || 0.05,
		};
		const sunLook = sat.ecfToLookAngles(obsGd, sunEcf);
		return rad2deg(sunLook.elevation);
	} catch {
		return 0;
	}
}

export function calculateLiveTelemetry(
	satellite: SatelliteInfo,
	observer: ObserverLocation,
	date: Date = new Date()
): LiveTelemetry | null {
	try {
		const satrec = sat.twoline2satrec(satellite.tleLine1, satellite.tleLine2);
		const posVel = sat.propagate(satrec, date);

		if (!posVel || !posVel.position || typeof posVel.position === "boolean") {
			return null;
		}

		const gmst = sat.gstime(date);
		const geodetic = sat.eciToGeodetic(posVel.position, gmst);
		const posEcf = sat.eciToEcf(posVel.position, gmst);

		const obsGd = {
			latitude: sat.degreesToRadians(observer.latitude),
			longitude: sat.degreesToRadians(observer.longitude),
			height: observer.altitude || 0.05,
		};
		const lookAngles = sat.ecfToLookAngles(obsGd, posEcf);

		const elevationDeg = rad2deg(lookAngles.elevation);
		const azimuthDeg = rad2deg(lookAngles.azimuth);

		let velocityKmS = 7.6;
		if (posVel.velocity && typeof posVel.velocity !== "boolean") {
			velocityKmS = Math.sqrt(
				posVel.velocity.x * posVel.velocity.x +
					posVel.velocity.y * posVel.velocity.y +
					posVel.velocity.z * posVel.velocity.z
			);
		}

		const sunEci = getSunEci(date);
		const isSunlit = isSatelliteSunlit(posVel.position, sunEci);
		const sunElevationDeg = getSunElevation(date, observer);

		return {
			satelliteId: satellite.id,
			time: date,
			latitude: sat.degreesLat(geodetic.latitude),
			longitude: sat.degreesLong(geodetic.longitude),
			altitudeKm: geodetic.height,
			velocityKmS,
			azimuthDeg,
			elevationDeg,
			rangeKm: lookAngles.rangeSat,
			direction: azimuthToDirection(azimuthDeg),
			isOverhead: elevationDeg > 0,
			isSunlit,
			sunElevationDeg,
		};
	} catch (e) {
		console.error("Telemetry calculation error:", e);
		return null;
	}
}

export function calculatePasses(
	satellites: SatelliteInfo[],
	observer: ObserverLocation,
	startTime: Date = new Date(),
	durationHours = 48,
	minPeakElevation = 10
): SatellitePass[] {
	const allPasses: SatellitePass[] = [];
	const startMs = startTime.getTime();
	const endMs = startMs + durationHours * 3600 * 1000;
	const stepMs = 30 * 1000; // 30 second step

	const obsGd = {
		latitude: sat.degreesToRadians(observer.latitude),
		longitude: sat.degreesToRadians(observer.longitude),
		height: observer.altitude || 0.05,
	};

	for (const satellite of satellites) {
		try {
			const satrec = sat.twoline2satrec(satellite.tleLine1, satellite.tleLine2);

			let inPass = false;
			let currentPoints: PassPoint[] = [];
			let riseTime: Date | null = null;
			let maxEl = -90;
			let maxElTime: Date | null = null;
			let maxElAz = 0;
			let minRange = Infinity;
			let passSunlitCount = 0;
			let passNightCount = 0;

			for (let t = startMs; t <= endMs; t += stepMs) {
				const date = new Date(t);
				const posVel = sat.propagate(satrec, date);

				if (!posVel || !posVel.position || typeof posVel.position === "boolean") {
					continue;
				}

				const gmst = sat.gstime(date);
				const posEcf = sat.eciToEcf(posVel.position, gmst);
				const look = sat.ecfToLookAngles(obsGd, posEcf);
				const elevationDeg = rad2deg(look.elevation);
				const azimuthDeg = rad2deg(look.azimuth);

				if (elevationDeg > 0) {
					const sunEci = getSunEci(date);
					const isSunlit = isSatelliteSunlit(posVel.position, sunEci);
					const sunEl = getSunElevation(date, observer);

					if (isSunlit) passSunlitCount++;
					if (sunEl < -6) passNightCount++;

					const point: PassPoint = {
						time: date,
						azimuth: azimuthDeg,
						elevation: elevationDeg,
						rangeKm: look.rangeSat,
						isSunlit,
						sunElevation: sunEl,
					};

					if (!inPass) {
						inPass = true;
						riseTime = date;
						maxEl = elevationDeg;
						maxElTime = date;
						maxElAz = azimuthDeg;
						minRange = look.rangeSat;
						currentPoints = [point];
					} else {
						currentPoints.push(point);
						if (elevationDeg > maxEl) {
							maxEl = elevationDeg;
							maxElTime = date;
							maxElAz = azimuthDeg;
							minRange = look.rangeSat;
						}
					}
				} else {
					if (inPass && riseTime && maxElTime) {
						inPass = false;
						const setTime = date;
						const durationSec = Math.round((setTime.getTime() - riseTime.getTime()) / 1000);

						if (maxEl >= minPeakElevation && currentPoints.length >= 2) {
							const startPoint = currentPoints[0];
							const endPoint = currentPoints[currentPoints.length - 1];

							let visibility: PassVisibility = "daylight";
							let visibilityLabel = "Daytime Radio Pass";

							const isMostlyNight = passNightCount >= currentPoints.length * 0.4;
							const isMostlySunlit = passSunlitCount >= currentPoints.length * 0.4;

							if (isMostlyNight && isMostlySunlit) {
								visibility = "visible";
								visibilityLabel = "Visible to Naked Eye";
							} else if (isMostlyNight && !isMostlySunlit) {
								visibility = "shadow";
								visibilityLabel = "Night Shadow (RF Only)";
							}

							let elevationCategory: ElevationCategory = "low";
							if (maxEl >= 50) {
								elevationCategory = "high";
							} else if (maxEl >= 25) {
								elevationCategory = "medium";
							}

							allPasses.push({
								id: `${satellite.id}-${riseTime.getTime()}`,
								satelliteId: satellite.id,
								satelliteName: satellite.name,
								satelliteDisplayName: satellite.displayName || satellite.name,
								satelliteColor: satellite.color || "#38bdf8",
								noradId: satellite.noradId,
								category: satellite.category,
								frequency: satellite.frequency,
								transmissions: satellite.transmissions,
								startTime: riseTime,
								peakTime: maxElTime,
								endTime: setTime,
								durationSec,
								maxElevation: Math.round(maxEl * 10) / 10,
								startAzimuth: Math.round(startPoint.azimuth * 10) / 10,
								startDirection: azimuthToDirection(startPoint.azimuth),
								peakAzimuth: Math.round(maxElAz * 10) / 10,
								peakDirection: azimuthToDirection(maxElAz),
								endAzimuth: Math.round(endPoint.azimuth * 10) / 10,
								endDirection: azimuthToDirection(endPoint.azimuth),
								minRangeKm: Math.round(minRange),
								visibility,
								visibilityLabel,
								elevationCategory,
								points: currentPoints,
							});
						}

						currentPoints = [];
						riseTime = null;
						maxEl = -90;
						maxElTime = null;
						passSunlitCount = 0;
						passNightCount = 0;
					}
				}
			}
		} catch (err) {
			console.error(`Error calculating passes for ${satellite.name}:`, err);
		}
	}

	return allPasses.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}

/**
 * Extracts or parses structured transmissions for any satellite or pass.
 * Falls back to parsing legacy frequency strings if structured transmissions aren't directly provided.
 */
export function getSatelliteTransmissions(
	item?: {
		transmissions?: SatelliteTransmission[];
		frequency?: string;
	} | null
): SatelliteTransmission[] {
	if (!item) return [];
	if (Array.isArray(item.transmissions) && item.transmissions.length > 0) {
		return item.transmissions;
	}

	const freqStr = item.frequency?.trim();
	if (!freqStr) {
		return [{ type: "Beacon", frequency: "Unspecified" }];
	}

	// Parse fallback strings
	const results: SatelliteTransmission[] = [];
	const segments = freqStr.split("/").map((s) => s.trim()).filter(Boolean);

	for (const segment of segments) {
		const freqMatch = segment.match(/(\d+(?:\.\d+)?\s*(?:MHz|GHz|kHz))/i);
		const freq = freqMatch ? freqMatch[1] : segment;
		const descMatch = segment.match(/\(([^)]+)\)/);
		const desc = descMatch ? descMatch[1].trim() : "";

		const lowerDesc = desc.toLowerCase();
		if (lowerDesc.includes("gmsk") && lowerDesc.includes("sstv")) {
			results.push({
				type: "GMSK Telemetry",
				frequency: freq,
				band: freq.includes("43") ? "UHF" : freq.includes("14") ? "VHF" : undefined,
				description: "GMSK Telemetry & Sensor Beacon",
			});
			results.push({
				type: "SSTV",
				frequency: freq,
				band: freq.includes("43") ? "UHF" : freq.includes("14") ? "VHF" : undefined,
				description: "Slow-Scan TV Image Downlink",
			});
		} else if (desc) {
			let type = desc;
			if (lowerDesc.includes("gmsk")) type = "GMSK Telemetry";
			else if (lowerDesc.includes("sstv")) type = "SSTV";
			else if (lowerDesc.includes("fm voice") || lowerDesc.includes("voice")) type = "FM Voice";
			else if (lowerDesc.includes("aprs")) type = "APRS";
			else if (lowerDesc.includes("repeater")) type = "Crossband Repeater";

			results.push({
				type,
				frequency: freq,
				band: freq.includes("43") ? "UHF" : freq.includes("14") ? "VHF" : undefined,
				description: desc,
			});
		} else {
			results.push({
				type: freq.includes("43") ? "UHF Downlink" : freq.includes("14") ? "VHF Downlink" : "Downlink",
				frequency: freq,
			});
		}
	}

	return results.length > 0 ? results : [{ type: "Telemetry", frequency: freqStr }];
}

/**
 * Checks whether a list of transmissions contains the requested transmission type.
 */
export function matchesTransmissionType(
	transmissions: SatelliteTransmission[],
	selectedType: string
): boolean {
	if (!selectedType || selectedType === "all") return true;
	const normTarget = selectedType.trim().toLowerCase();
	return transmissions.some((t) => {
		const normType = t.type.trim().toLowerCase();
		return normType === normTarget || normType.includes(normTarget) || normTarget.includes(normType);
	});
}

/**
 * Returns the matching transmission from a list based on chosen type, or defaults to the first one.
 */
export function getActiveTransmission(
	transmissions: SatelliteTransmission[],
	selectedType?: string
): SatelliteTransmission | undefined {
	if (!transmissions || transmissions.length === 0) return undefined;
	if (!selectedType || selectedType === "all") return transmissions[0];
	const normTarget = selectedType.trim().toLowerCase();
	const match = transmissions.find((t) => {
		const normType = t.type.trim().toLowerCase();
		return normType === normTarget || normType.includes(normTarget) || normTarget.includes(normType);
	});
	return match || transmissions[0];
}
