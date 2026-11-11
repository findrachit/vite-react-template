import React from "react";
import { Clock, Radio, Radar, Layers } from "lucide-react";
import { TabType, ROUTE_PATHS } from "../routes";

interface NavigationTabsProps {
	activeTab: TabType;
	onSelectTab: (tab: TabType) => void;
	passCount: number;
	satelliteCount: number;
	hasActivePass?: boolean;
}

export const NavigationTabs: React.FC<NavigationTabsProps> = ({
	activeTab,
	onSelectTab,
	passCount,
	satelliteCount,
	hasActivePass = false,
}) => {
	const handleTabClick = (e: React.MouseEvent<HTMLAnchorElement>, tab: TabType) => {
		// Allow normal browser new-tab behavior when modifier keys are pressed
		if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
			return;
		}
		e.preventDefault();
		onSelectTab(tab);
	};

	return (
		<nav className="section-tabs-bar" id="main-nav-tabs" aria-label="Dashboard Navigation">
			<div className="section-tabs-container" role="tablist">
				{/* 1. Next Upcoming Pass (Hero View) */}
				<a
					href={ROUTE_PATHS.hero}
					role="tab"
					aria-selected={activeTab === "hero"}
					className={`nav-tab-btn ${activeTab === "hero" ? "active" : ""}`}
					onClick={(e) => handleTabClick(e, "hero")}
				>
					<Clock size={16} />
					<span>Next Upcoming Pass</span>
					{hasActivePass ? (
						<span className="tab-badge tab-badge-live" title="Pass currently in progress">
							LIVE
						</span>
					) : (
						<span className="tab-badge">NEXT</span>
					)}
				</a>

				{/* 2. Upcoming Passes */}
				<a
					href={ROUTE_PATHS.passes}
					role="tab"
					aria-selected={activeTab === "passes"}
					className={`nav-tab-btn ${activeTab === "passes" ? "active" : ""}`}
					onClick={(e) => handleTabClick(e, "passes")}
				>
					<Radio size={16} />
					<span>Upcoming Passes</span>
					<span className="tab-badge">{passCount}</span>
				</a>

				{/* 3. Sky Radar & Dome */}
				<a
					href={ROUTE_PATHS.radar}
					role="tab"
					aria-selected={activeTab === "radar"}
					className={`nav-tab-btn ${activeTab === "radar" ? "active" : ""}`}
					onClick={(e) => handleTabClick(e, "radar")}
				>
					<Radar size={16} />
					<span>Sky Radar & Dome</span>
				</a>

				{/* 4. Tracked Fleet */}
				<a
					href={ROUTE_PATHS.fleet}
					role="tab"
					aria-selected={activeTab === "fleet"}
					className={`nav-tab-btn ${activeTab === "fleet" ? "active" : ""}`}
					onClick={(e) => handleTabClick(e, "fleet")}
				>
					<Layers size={16} />
					<span>Tracked Fleet</span>
					<span className="tab-badge">{satelliteCount}</span>
				</a>
			</div>
		</nav>
	);
};
