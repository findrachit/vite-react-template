export interface SatelliteTransmission {
	type: string; // e.g., "GMSK Telemetry", "FM Voice", "SSTV", "APRS"
	frequency: string; // e.g., "437.350 MHz", "145.800 MHz"
	band?: string; // e.g., "UHF", "VHF"
	description?: string; // e.g., "4800 / 9600 bps USP Telemetry"
}

export interface SatelliteInfo {
	id: string;
	name: string;
	displayName: string;
	callsign?: string;
	noradId: number;
	designator?: string;
	category?: string;
	launchDate?: string;
	orbitType?: string;
	altitudeKm?: number;
	inclinationDeg?: number;
	periodMin?: number;
	frequency?: string;
	transmissions?: SatelliteTransmission[];
	description?: string;
	color: string;
	icon?: string;
	tleLine1: string;
	tleLine2: string;
}

export interface ObserverLocation {
	name: string;
	latitude: number;
	longitude: number;
	altitude: number; // km
	isGps?: boolean;
}

export interface PassPoint {
	time: Date;
	azimuth: number; // degrees 0-360
	elevation: number; // degrees
	rangeKm: number;
	isSunlit: boolean;
	sunElevation: number;
}

export type PassVisibility = "visible" | "daylight" | "shadow";
export type ElevationCategory = "high" | "medium" | "low";

export interface SatellitePass {
	id: string;
	satelliteId: string;
	satelliteName: string;
	satelliteDisplayName: string;
	satelliteColor: string;
	noradId: number;
	category?: string;
	frequency?: string;
	transmissions?: SatelliteTransmission[];
	startTime: Date;
	peakTime: Date;
	endTime: Date;
	durationSec: number;
	maxElevation: number; // peak elevation in degrees
	startAzimuth: number;
	startDirection: string;
	peakAzimuth: number;
	peakDirection: string;
	endAzimuth: number;
	endDirection: string;
	minRangeKm: number;
	visibility: PassVisibility;
	visibilityLabel: string;
	elevationCategory: ElevationCategory;
	points: PassPoint[];
}

export interface LiveTelemetry {
	satelliteId: string;
	time: Date;
	latitude: number;
	longitude: number;
	altitudeKm: number;
	velocityKmS: number;
	azimuthDeg: number;
	elevationDeg: number;
	rangeKm: number;
	direction: string;
	isOverhead: boolean;
	isSunlit: boolean;
	sunElevationDeg: number;
}
