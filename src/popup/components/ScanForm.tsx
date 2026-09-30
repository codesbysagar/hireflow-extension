import React, { useState } from 'react';
import { Play, Sparkles } from 'lucide-react';
import {
  PREDEFINED_TARGET_OPTIONS,
  MAX_TARGET_POSTS,
  MIN_TARGET_POSTS,
} from '../../shared/constants.js';
import { validateTargetCount } from '../../shared/utils.js';

interface ScanFormProps {
  initialCount: number;
  activeQuery?: string;
  onStart: (count: number, andAnalyze?: boolean) => void;
  disabled?: boolean;
}

export const ScanForm: React.FC<ScanFormProps> = ({
  initialCount,
  activeQuery,
  onStart,
  disabled = false,
}) => {
  const isPredefined = PREDEFINED_TARGET_OPTIONS.includes(
    initialCount as (typeof PREDEFINED_TARGET_OPTIONS)[number]
  );

  const [selectedOption, setSelectedOption] = useState<string>(
    isPredefined ? String(initialCount) : 'custom'
  );
  const [customValue, setCustomValue] = useState<string>(
    isPredefined ? '20' : String(initialCount)
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSelect = (option: string) => {
    setSelectedOption(option);
    setValidationError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled) return;

    let target = 10;
    if (selectedOption === 'custom') {
      const parsed = parseInt(customValue, 10);
      const validation = validateTargetCount(parsed, MIN_TARGET_POSTS, MAX_TARGET_POSTS);
      if (!validation.isValid) {
        setValidationError(validation.error || 'Invalid number');
        return;
      }
      target = validation.value;
    } else {
      target = parseInt(selectedOption, 10);
    }

    onStart(target);
  };

  return (
    <form onSubmit={handleSubmit} className="panel-card">
      <div>
        <span className="section-label">Posts with contact email to find</span>
        {activeQuery && (
          <div
            style={{
              fontSize: '11px',
              color: 'var(--accent-mint)',
              marginTop: '2px',
              fontWeight: 500,
            }}
          >
            Target Query: "{activeQuery}"
          </div>
        )}
      </div>

      <div className="quantity-grid">
        {PREDEFINED_TARGET_OPTIONS.map((val) => (
          <button
            key={val}
            type="button"
            className={`qty-btn ${selectedOption === String(val) ? 'active' : ''}`}
            onClick={() => handleSelect(String(val))}
            disabled={disabled}
          >
            {val}
          </button>
        ))}

        <button
          type="button"
          className={`qty-btn ${selectedOption === 'custom' ? 'active' : ''}`}
          onClick={() => handleSelect('custom')}
          disabled={disabled}
        >
          Custom
        </button>
      </div>

      {selectedOption === 'custom' && (
        <div className="custom-qty-wrapper">
          <input
            type="number"
            min={MIN_TARGET_POSTS}
            max={MAX_TARGET_POSTS}
            value={customValue}
            onChange={(e) => {
              setCustomValue(e.target.value);
              setValidationError(null);
            }}
            placeholder={`Enter count (${MIN_TARGET_POSTS}-${MAX_TARGET_POSTS})`}
            className="custom-qty-input"
            autoFocus
          />
          {validationError && (
            <span className="input-error-text">{validationError}</span>
          )}
        </div>
      )}

      <div className="scan-actions-group">
        <button
          type="button"
          onClick={() => {
            let target = 10;
            if (selectedOption === 'custom') {
              const parsed = parseInt(customValue, 10);
              const validation = validateTargetCount(parsed, MIN_TARGET_POSTS, MAX_TARGET_POSTS);
              if (!validation.isValid) {
                setValidationError(validation.error || 'Invalid number');
                return;
              }
              target = validation.value;
            } else {
              target = parseInt(selectedOption, 10);
            }
            onStart(target, true);
          }}
          className="btn-primary"
          style={{ width: '100%', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
          disabled={disabled || Boolean(validationError)}
        >
          <Sparkles size={14} color="#f0fdf4" />
          Scrape & Analyze
        </button>

        <button
          type="submit"
          className="btn-secondary"
          style={{ width: '100%' }}
          disabled={disabled || Boolean(validationError)}
        >
          <Play size={13} fill="currentColor" />
          Scrape Only
        </button>
      </div>

      <div className="helper-note">
        <Sparkles size={11} color="var(--accent-mint)" />
        AI evaluates candidate-job fit, score, and recruiter emails automatically.
      </div>
    </form>
  );
};
