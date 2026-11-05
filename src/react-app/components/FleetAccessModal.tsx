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
	LogOut,
} from "lucide-react";

interface FleetAccessModalProps {
	isOpen: boolean;
	onClose: () => void;
	authToken: string;
	isAuthorized: boolean;
	onSaveToken: (token: string) => Promise<boolean>;
	onClearToken: () => void;
}

export const FleetAccessModal: React.FC<FleetAccessModalProps> = ({
	isOpen,
	onClose,
	authToken,
	isAuthorized,
	onSaveToken,
	onClearToken,
}) => {
	const [inputToken, setInputToken] = useState(authToken || "");
	const [showToken, setShowToken] = useState(false);
	const [isVerifying, setIsVerifying] = useState(false);
	const [statusMessage, setStatusMessage] = useState<{
		type: "error" | "success";
		text: string;
	} | null>(null);

	const [copiedToken, setCopiedToken] = useState(false);

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

	const handleCopyToken = async () => {
		try {
			await navigator.clipboard.writeText(authToken);
			setCopiedToken(true);
			setTimeout(() => setCopiedToken(false), 2500);
		} catch {
			// fallback
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

							{/* Token Management Info */}
							<div className="rotate-section">
								<div className="token-manage-note">
									<ShieldCheck size={14} className="icon-cyan" />
									<span>
										To grant access to teammates, share the access token securely offline. Fleet credentials and rotation are managed via the Cloudflare dashboard.
									</span>
								</div>
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
								Additions and deletions to the satellite fleet are access-controlled to prevent unauthorized modifications while enabling secure team management.
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
