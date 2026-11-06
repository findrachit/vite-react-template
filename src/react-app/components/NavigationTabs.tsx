import React from "react";
import { Radio, Radar, Layers } from "lucide-react";

interface NavigationTabsProps {
	activeTab: "passes" | "radar" | "fleet";
	onSelectTab: (tab: "passes" | "radar" | "fleet") => void;
	passCount: number;
	satelliteCount: number;
}

export const NavigationTabs: React.FC<NavigationTabsProps> = ({
	activeTab,
	onSelectTab,
	passCount,
	satelliteCount,
}) => {
	return (
		<nav className="section-tabs-bar" id="main-nav-tabs" aria-label="Dashboard Navigation">
			<div className="section-tabs-container" role="tablist">
				<button
					role="tab"
					aria-selected={activeTab === "passes"}
					className={`nav-tab-btn ${activeTab === "passes" ? "active" : ""}`}
					onClick={() => onSelectTab("passes")}
				>
					<Radio size={16} />
					<span>Upcoming Passes</span>
					<span className="tab-badge">{passCount}</span>
				</button>
				<button
					role="tab"
					aria-selected={activeTab === "radar"}
					className={`nav-tab-btn ${activeTab === "radar" ? "active" : ""}`}
					onClick={() => onSelectTab("radar")}
				>
					<Radar size={16} />
					<span>Sky Radar & Dome</span>
				</button>
				<button
					role="tab"
					aria-selected={activeTab === "fleet"}
					className={`nav-tab-btn ${activeTab === "fleet" ? "active" : ""}`}
					onClick={() => onSelectTab("fleet")}
				>
					<Layers size={16} />
					<span>Tracked Fleet</span>
					<span className="tab-badge">{satelliteCount}</span>
				</button>
			</div>
		</nav>
	);
};
