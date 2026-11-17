import type { SatelliteInfo } from "../types";

export interface KnownSatelliteMeta {
	category?: string;
	displayName?: string;
	color?: string;
	frequency?: string;
	transmissions?: SatelliteInfo["transmissions"];
}

export const KNOWN_METADATA: Record<number, KnownSatelliteMeta> = {
	// Hubble Space Telescope
	20580: {
		displayName: "HST (Hubble Space Telescope)",
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
	},
	// International Space Station
	25544: {
		displayName: "International Space Station",
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
	},
	// SO-50 (SaudiSat 1C)
	27607: {
		displayName: "SO-50 (SaudiSat 1C)",
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
	},
	// NOAA 19
	33591: {
		displayName: "NOAA 19 (Weather Satellite)",
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
	},
	// METEOR-M 2
	40069: {
		displayName: "Meteor M2",
		category: "Weather Satellite",
		color: "#f59e0b",
		frequency: "137.100 MHz (LRPT) / 137.900 MHz",
	},
	// NOAA 20 (JPSS-1)
	43013: {
		displayName: "NOAA 20 (JPSS-1)",
		category: "Earth Observation",
		color: "#06b6d4",
		frequency: "7812.000 MHz (HRD Telemetry)",
		transmissions: [
			{
				type: "HRD Telemetry",
				frequency: "7812.000 MHz",
				band: "X-Band",
				description: "High Rate Data Direct Broadcast",
			},
		],
	},
	// FOX-1B (RadFxSat / AO-91)
	43017: {
		displayName: "FOX-1B (RadFxSat / AO-91)",
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
	},
	// JO-97 (JY1Sat)
	43803: {
		displayName: "JO-97 (JY1Sat)",
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
	},
	// METEOR-M2 2
	44387: {
		displayName: "Meteor M2-2",
		category: "Weather Satellite",
		color: "#3b82f6",
		frequency: "137.100 MHz (LRPT) / 137.900 MHz",
	},
	// RS-44 (DOSAAF-85)
	44909: {
		displayName: "RS-44 (DOSAAF-85)",
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
	},
	// Tiangong Space Station
	48274: {
		displayName: "CSS (Tiangong Space Station)",
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
	},
	// JWST
	50463: {
		displayName: "James Webb Space Telescope (JWST)",
		category: "Deep Space Telescope",
		color: "#a855f7",
		frequency: "2270.500 MHz (S-Band Direct)",
	},
	// NOAA 21 (JPSS-2)
	54234: {
		displayName: "NOAA 21 (JPSS-2)",
		category: "Earth Observation",
		color: "#06b6d4",
		frequency: "7812.000 MHz (HRD Telemetry)",
	},
	// METEOR-M2 3
	57166: {
		displayName: "Meteor M2-3",
		category: "Weather Satellite",
		color: "#06b6d4",
		frequency: "137.100 MHz (LRPT) / 137.900 MHz",
	},
	// METEOR-M2 4
	59051: {
		displayName: "Meteor M2-4",
		category: "Weather Satellite",
		color: "#10b981",
		frequency: "137.100 MHz (LRPT) / 137.900 MHz",
	},
	// RS90S (Luča-1 / Luca)
	67287: {
		displayName: "Luca / Luča-1 (RS90S)",
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
	},
};
