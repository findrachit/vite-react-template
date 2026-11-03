import React, { useState } from "react";
import {
	X,
	Lock,
	ShieldCheck,
	KeyRound,
	Eye,
	EyeOff,
	Copy,
	Check,
	AlertCircle,
	Share2,
	RefreshCw,
	LogOut,
} from "lucide-react";

interface FleetAccessModalProps {
	isOpen: boolean;
	onClose: () => void;
	authToken: string;
	isAuthorized: boolean;
	onSaveToken: (token: string) => Promise<boolean>;
	onClearToken: () => void;
	onRotateToken: (newToken: string) => Promise<{ success: boolean; message?: string; error?: string }>;
}

export const FleetAccessModal: React.FC<FleetAccessModalProps> = ({
	isOpen,
	onClose,
	authToken,
	isAuthorized,
	onSaveToken,
	onClearToken,
	onRotateToken,
}) => {
	const [inputToken, setInputToken] = useState(authToken || "");
	const [showToken, setShowToken] = useState(false);
	const [isVerifying, setIsVerifying] = useState(false);
	const [statusMessage, setStatusMessage] = useState<{
		type: "error" | "success";
		text: string;
	} | null>(null);

	// Share link state
	const [copiedShareLink, setCopiedShareLink] = useState(false);
	const [copiedToken, setCopiedToken] = useState(false);

	// Token rotation state
	const [showRotateForm, setShowRotateForm] = useState(false);
	const [newTokenInput, setNewTokenInput] = useState("");
	const [isRotating, setIsRotating] = useState(false);

	if (!isOpen) return null;

	const handleAuthenticate = async (e: React.FormEvent) => {
		e.preventDefault();
		const trimmed = inputToken.trim();
		if (!trimmed) {
			setStatusMessage({ type: "error", text: "Please enter an access token." });
			return;
		}

		setIsVerifying(true);
		setStatusMessage(null);

		const success = await onSaveToken(trimmed);
		setIsVerifying(false);

		if (success) {
			setStatusMessage({
				type: "success",
				text: "Access token verified! Fleet management unlocked.",
			});
		} else {
			setStatusMessage({
				type: "error",
				text: "Invalid access token. Please verify the token and try again.",
			});
		}
	};

	const getShareableUrl = () => {
		if (typeof window === "undefined") return "";
		const currentOrigin = window.location.origin;
		const pathname = window.location.pathname;
		return `${currentOrigin}${pathname}?token=${encodeURIComponent(authToken)}`;
	};

	const handleCopyShareLink = async () => {
		try {
			await navigator.clipboard.writeText(getShareableUrl());
			setCopiedShareLink(true);
			setTimeout(() => setCopiedShareLink(false), 2500);
		} catch {
			// fallback
		}
	};

	const handleCopyToken = async () => {
		try {
			await navigator.clipboard.writeText(authToken);
			setCopiedToken(true);
			setTimeout(() => setCopiedToken(false), 2500);
		} catch {
			// fallback
		}
	};

	const handleRotateTokenSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const trimmed = newTokenInput.trim();
		if (trimmed.length < 6) {
			setStatusMessage({
				type: "error",
				text: "New token must be at least 6 characters long.",
			});
			return;
		}

		setIsRotating(true);
		setStatusMessage(null);

		const res = await onRotateToken(trimmed);
		setIsRotating(false);

		if (res.success) {
			setInputToken(trimmed);
			setNewTokenInput("");
			setShowRotateForm(false);
			setStatusMessage({
				type: "success",
				text: res.message || "Fleet access token successfully updated!",
			});
		} else {
			setStatusMessage({
				type: "error",
				text: res.error || "Failed to update token.",
			});
		}
	};

	return (
		<div className="modal-backdrop" onClick={onClose}>
			<div className="modal-card" onClick={(e) => e.stopPropagation()}>
				<div className="modal-header">
					<div className="flex-align-gap">
						{isAuthorized ? (
							<ShieldCheck className="icon-emerald" size={22} />
						) : (
							<Lock className="icon-cyan" size={22} />
						)}
						<div>
							<h2 className="modal-title">Fleet Access Control</h2>
							<div className="modal-subhead">
								{isAuthorized
									? "Authorized • Full Fleet Management"
									: "Read-Only Mode • Authentication Required"}
							</div>
						</div>
					</div>
					<button className="close-btn" onClick={onClose} title="Close">
						<X size={18} />
					</button>
				</div>

				<div className="modal-body">
					{isAuthorized ? (
						<div className="auth-authorized-view">
							{/* Active Access Badge */}
							<div className="auth-status-card authorized-box">
								<div className="status-indicator-row">
									<span className="status-dot-active" />
									<span className="status-title-text">Full Fleet Management Authorized</span>
								</div>
								<p className="auth-desc-text">
									Your browser is authenticated with a valid fleet access token.
									You have permission to add, modify, and delete satellites from the live fleet.
								</p>

								{/* Token Display */}
								<div className="token-reveal-row">
									<div className="token-display-box">
										<KeyRound size={14} className="icon-cyan" />
										<span className="token-font">
											{showToken
												? authToken
												: "•".repeat(Math.max(12, Math.min(authToken.length, 24)))}
										</span>
									</div>
									<div className="token-actions-row">
										<button
											type="button"
											className="icon-action-btn"
											onClick={() => setShowToken(!showToken)}
											title={showToken ? "Hide token" : "Show token"}
										>
											{showToken ? <EyeOff size={15} /> : <Eye size={15} />}
										</button>
										<button
											type="button"
											className="icon-action-btn"
											onClick={handleCopyToken}
											title="Copy token to clipboard"
										>
											{copiedToken ? <Check size={15} className="text-emerald" /> : <Copy size={15} />}
										</button>
									</div>
								</div>
							</div>

							{/* Controlled & Shareable Access Link Section */}
							<div className="shareable-section">
								<div className="section-label">
									<Share2 size={15} className="icon-cyan" />
									<span>Shareable Access Link</span>
								</div>
								<p className="share-desc">
									Share this URL with trusted teammates or ground station operators to grant them instant access to manage the satellite fleet.
								</p>
								<div className="share-link-box">
									<input
										type="text"
										readOnly
										value={getShareableUrl()}
										className="input-field font-mono text-sm"
										onClick={(e) => (e.target as HTMLInputElement).select()}
									/>
									<button
										type="button"
										className="btn-accent btn-copy-link"
										onClick={handleCopyShareLink}
									>
										{copiedShareLink ? (
											<>
												<Check size={14} />
												<span>Copied!</span>
											</>
										) : (
											<>
												<Copy size={14} />
												<span>Copy Link</span>
											</>
										)}
									</button>
								</div>
							</div>

							{/* Token Rotation Option */}
							<div className="rotate-section">
								<button
									type="button"
									className="btn-text-toggle"
									onClick={() => setShowRotateForm(!showRotateForm)}
								>
									<RefreshCw size={14} />
									<span>{showRotateForm ? "Cancel Token Update" : "Update Fleet Access Token"}</span>
								</button>

								{showRotateForm && (
									<form onSubmit={handleRotateTokenSubmit} className="rotate-form">
										<div className="form-group">
											<label>New Secret Token (min 6 characters)</label>
											<input
												type="text"
												value={newTokenInput}
												onChange={(e) => setNewTokenInput(e.target.value)}
												placeholder="Enter new secret key..."
												className="input-field font-mono"
												required
											/>
										</div>
										<button
											type="submit"
											className="btn-accent"
											disabled={isRotating}
										>
											<RefreshCw size={14} className={isRotating ? "spin" : ""} />
											<span>{isRotating ? "Updating..." : "Save New Token"}</span>
										</button>
									</form>
								)}
							</div>

							{/* Status feedback */}
							{statusMessage && (
								<div
									className={`alert-box ${
										statusMessage.type === "error" ? "alert-warning" : "alert-success"
									}`}
								>
									{statusMessage.type === "error" ? (
										<AlertCircle size={16} />
									) : (
										<Check size={16} />
									)}
									<span>{statusMessage.text}</span>
								</div>
							)}

							{/* Modal footer actions */}
							<div className="modal-actions-between">
								<button
									type="button"
									className="btn-danger-outline"
									onClick={() => {
										onClearToken();
										onClose();
									}}
									title="Clear token and lock fleet"
								>
									<LogOut size={14} />
									<span>Lock Fleet (Logout)</span>
								</button>

								<button type="button" className="btn-secondary" onClick={onClose}>
									Done
								</button>
							</div>
						</div>
					) : (
						/* Unauthorized / Login Form */
						<form onSubmit={handleAuthenticate} className="auth-form">
							<p className="modal-desc">
								Additions and deletions to the satellite fleet are access-controlled to prevent unauthorized modifications while enabling controlled, shareable team access.
							</p>

							<div className="form-group">
								<label>Fleet Access Token</label>
								<div className="token-input-wrapper">
									<input
										type={showToken ? "text" : "password"}
										value={inputToken}
										onChange={(e) => setInputToken(e.target.value)}
										placeholder="Enter fleet access token..."
										className="input-field font-mono"
										autoFocus
										required
									/>
									<button
										type="button"
										className="token-toggle-btn"
										onClick={() => setShowToken(!showToken)}
										tabIndex={-1}
									>
										{showToken ? <EyeOff size={15} /> : <Eye size={15} />}
									</button>
								</div>
							</div>

							{statusMessage && (
								<div
									className={`alert-box ${
										statusMessage.type === "error" ? "alert-warning" : "alert-success"
									}`}
								>
									{statusMessage.type === "error" ? (
										<AlertCircle size={16} />
									) : (
										<Check size={16} />
									)}
									<span>{statusMessage.text}</span>
								</div>
							)}

							<div className="modal-actions">
								<button type="button" className="btn-secondary" onClick={onClose}>
									Cancel
								</button>
								<button type="submit" className="btn-accent" disabled={isVerifying}>
									<KeyRound size={16} />
									<span>{isVerifying ? "Verifying..." : "Verify & Unlock"}</span>
								</button>
							</div>
						</form>
					)}
				</div>
			</div>
		</div>
	);
};
