import React from 'react';
import { RotateCcw, LogOut, User } from 'lucide-react';
import type { AuthUser } from '../../shared/types.js';

interface HeaderProps {
  hasResults: boolean;
  onClear: () => void;
  currentUser?: AuthUser | null;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  hasResults,
  onClear,
  currentUser,
  onLogout,
}) => {
  return (
    <header className="app-header">
      <div className="brand-wrapper">
        <img
          src="/icons/icon-32.png"
          alt="HireFlow Logo"
          className="brand-logo-img"
        />
        <div className="brand-text">
          <h1>HireFlow</h1>
          <span className="brand-tagline">LinkedIn AI Job Matcher</span>
        </div>
      </div>

      <div className="header-actions-group">
        {currentUser && (
          <div className="header-user-tag" title={`Logged in as ${currentUser.email}`}>
            <User size={11} color="var(--accent-mint)" />
            <span className="header-user-email">
              {currentUser.email.length > 18
                ? `${currentUser.email.slice(0, 16)}...`
                : currentUser.email}
            </span>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="header-logout-btn"
                title="Log out of HireFlow"
              >
                <LogOut size={11} />
              </button>
            )}
          </div>
        )}

        {hasResults && (
          <button
            onClick={onClear}
            title="Clear saved results"
            className="header-action-btn"
          >
            <RotateCcw size={12} />
            Clear
          </button>
        )}
      </div>
    </header>
  );
};
