# AstroPass — Satellite Pass Tracker & Ground Station

A modern space-themed satellite pass predictor built with **React 19**, **Vite 7**, **Hono**, and **Cloudflare Workers**. AstroPass computes high-precision orbital pass times and look angles over your ground station from the current moment through the next 48 hours (2 days), with real-time telemetry, visual pass classification, and a polar sky radar.

## ✨ Features

- 🛰️ **48-Hour Pass Prediction**: Calculates satellite acquisition (AOS), culmination (Max Elevation), and loss of signal (LOS) over the user's current location from current time until the next 2 days.
- 📋 **Maintained Satellite List (`src/data/satellites.json`)**: Preconfigured with:
  1. **International Space Station (ISS)** (NORAD ID: `25544`)
  2. **SakhaCube-Cholbon (RS18S)** (NORAD ID: `67290`)
- 📍 **Ground Station Location**: Auto-detects device GPS location with high precision, or select from global presets (London, Yakutsk, New York, Tokyo, etc.) or custom coordinates.
- 🌌 **Modern Space & Satellite Theme**:
  - Cosmic starfield canvas with twinkling stars and subtle nebulae
  - Mission control aerospace HUD with live UTC & Local time telemetry
  - Immediate pass countdown timer and live overhead tracking
  - Visual elevation arc gauges and trajectory path arrows
  - Pass visibility indicators: **Visible to Naked Eye**, **Daytime Radio**, **Earth Shadow**
- 🎯 **Interactive Polar Sky Radar**: Local horizon sky dome showing trajectory arcs, AOS/LOS points, live satellite positions, and flight path simulation.
- 📡 **Live Telemetry & Fleet Specs**: Real-time altitude, velocity, sub-satellite coordinates, downlink frequencies (e.g. 145.800 MHz FM / 437.350 MHz SSTV), and Two-Line Element (TLE) inspection.
- ➕ **Dynamic Satellite Tracker**: Search and track any satellite by NORAD catalog ID with live TLE lookup from CelesTrak.
- 🔐 **Access-Controlled Fleet Management**:
  - Additions and deletions to the satellite fleet are access-controlled via a token stored in **Cloudflare Workers KV** (`satellites:auth_token`) or environment secret (`FLEET_AUTH_TOKEN`).
  - Protects against unauthorized public modifications on the internet while enabling secure team access.
  - In-browser verification, token masking, and logout.
  - Maximum fleet capacity is capped at 30 satellites.

## 🔐 Fleet Access Control (Workers KV)

Modifications to the orbital fleet (`POST /api/satellites`, `DELETE /api/satellites/:id`, and `POST /api/satellites/reset`) require a valid access token stored in Cloudflare Workers KV or environment secret (maximum fleet limit: 30 satellites):

- **KV Namespace Binding**: `SATELLITES_KV`
- **KV Token Key**: `satellites:auth_token`
- **Environment Secret**: `FLEET_AUTH_TOKEN`

### Ways to Authenticate:
1. **UI Access Control Modal**: Click **"Read-Only"** or **"Fleet Access"** in the navigation header or fleet view to enter/manage the token. Tokens are shared securely offline and saved to browser storage.
2. **API Headers**: Send requests with `Authorization: Bearer <token>` or `X-Auth-Token: <token>`. Query parameter authentication is rejected to prevent credential leakage.

### Setting or Rotating the Token in Cloudflare KV:
- **Via Cloudflare Dashboard**:
  Navigate to **Workers & Pages** > your worker > **KV** > `SATELLITES_KV` and update key `satellites:auth_token`.
- **Via Wrangler CLI**:
  ```bash
  npx wrangler kv key put --binding SATELLITES_KV "satellites:auth_token" "your-secret-key"
  ```
- **Via Environment Secret**:
  ```bash
  npx wrangler secret put FLEET_AUTH_TOKEN
  ```

## 🛰️ Tracked Satellites List (`satellites.json`)

Satellites are configured in [`src/data/satellites.json`](src/data/satellites.json) and also served statically at [`public/satellites.json`](public/satellites.json):

```json
[
  {
    "id": "iss",
    "name": "ISS (ZARYA)",
    "displayName": "International Space Station",
    "noradId": 25544,
    "frequency": "145.800 MHz (FM Voice) / 145.825 MHz (APRS) / 437.525 MHz",
    "tleLine1": "...",
    "tleLine2": "..."
  },
  {
    "id": "sakhacube",
    "name": "SAKHACUBE-CHOLBON (RS18S)",
    "displayName": "SakhaCube-Cholbon",
    "noradId": 67290,
    "frequency": "437.350 MHz (GMSK Telemetry & SSTV Images)",
    "tleLine1": "...",
    "tleLine2": "..."
  }
]
```

## 🚀 Getting Started

### Development

```bash
npm install
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173).

### Build & Verification

```bash
npm run build    # Compiles TypeScript and builds Vite client + Cloudflare Worker
npm run check    # Full typecheck, build, and Cloudflare dry-run deploy
npm run lint     # Runs ESLint checks
```

## 🛠️ Tech Stack

- **React 19 & TypeScript**: Component architecture & high-performance UI
- **Vite 7**: Fast bundling & HMR
- **Hono**: Edge API framework running on Cloudflare Workers
- **satellite.js & SGP4**: Real-time orbital propagation and coordinate transforms
- **Lucide Icons**: Aerospace UI iconography
