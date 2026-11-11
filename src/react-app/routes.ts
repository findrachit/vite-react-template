export type TabType = "hero" | "passes" | "radar" | "fleet";

export const ROUTE_PATHS: Record<TabType, string> = {
	hero: "/next-upcoming-pass",
	passes: "/upcoming-passes",
	radar: "/sky-radar-and-dome",
	fleet: "/tracked-fleet",
};

export const TAB_TITLES: Record<TabType, string> = {
	hero: "Next Upcoming Pass • AstroPass",
	passes: "Upcoming Passes • AstroPass",
	radar: "Sky Radar & Dome • AstroPass",
	fleet: "Tracked Fleet • AstroPass",
};

/**
 * Normalizes a pathname to one of the valid application tabs.
 * Supports exact paths as well as common aliases.
 */
export function resolveTabFromPath(pathname: string): TabType {
	const clean = pathname.trim().toLowerCase().replace(/\/+$/, "") || "/";

	switch (clean) {
		case "/next-upcoming-pass":
		case "/hero":
		case "/next-pass":
		case "/next":
			return "hero";

		case "/upcoming-passes":
		case "/passes":
		case "/schedule":
			return "passes";

		case "/sky-radar-and-dome":
		case "/sky-radar":
		case "/radar":
		case "/dome":
			return "radar";

		case "/tracked-fleet":
		case "/fleet":
		case "/satellites":
			return "fleet";

		case "/":
		default:
			// Default home route is the Next Upcoming Pass hero page
			return "hero";
	}
}

/**
 * Returns the URL path for a given tab.
 */
export function getRouteForTab(tab: TabType): string {
	return ROUTE_PATHS[tab];
}
