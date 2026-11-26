import React from 'react';
import styles from './DisplayModeBar.module.css';

interface DisplayModeBarProps {
  depth: number;
  onDepthChange: (depth: number) => void;
  /** Fixed depth choices, rendered as a select. Omit to get a 1-10 range slider. */
  depthOptions?: number[];
  onZoomIn: () => void;
  onZoomOut: () => void;
  /** Optional zoom percentage, shown between the +/- buttons. */
  zoomLabel?: string;
  onExit: () => void;
}

/**
 * The only chrome visible in tree display mode: depth and zoom, nothing
 * else. Everything that would normally surround the canvas — navbar,
 * toolbar, detail panel — is hidden by the caller while this is shown.
 */
const DisplayModeBar: React.FC<DisplayModeBarProps> = ({
  depth,
  onDepthChange,
  depthOptions,
  onZoomIn,
  onZoomOut,
  zoomLabel,
  onExit,
}) => {
  return (
    <div className={styles.bar}>
      <label className={styles.depthControl}>
        <span>Depth</span>
        {depthOptions ? (
          <select
            value={depth}
            aria-label="Tree depth"
            onChange={(e) => onDepthChange(Number(e.target.value))}
          >
            {depthOptions.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        ) : (
          <>
            <input
              type="range"
              min={1}
              max={10}
              value={depth}
              aria-label="Tree depth"
              onChange={(e) => onDepthChange(Number(e.target.value))}
            />
            <span>{depth}</span>
          </>
        )}
      </label>

      <div className={styles.separator} />

      <div className={styles.zoomGroup}>
        <button className={styles.zoomBtn} onClick={onZoomOut} aria-label="Zoom out">
          −
        </button>
        {zoomLabel && <span>{zoomLabel}</span>}
        <button className={styles.zoomBtn} onClick={onZoomIn} aria-label="Zoom in">
          +
        </button>
      </div>

      <div className={styles.separator} />

      <button className={styles.exitBtn} onClick={onExit}>
        Exit Display Mode
      </button>
    </div>
  );
};

export default DisplayModeBar;
