import React from 'react';
import StatusBar from '@/components/StatusBar/StatusBar';
import type { SidebarContext } from '@/stores/searchStore';
import styles from './AppShell.module.css';

interface AppShellProps {
  navbar: React.ReactNode;
  sidebar?: React.ReactNode;
  detail?: React.ReactNode;
  showDetail?: boolean;
  /** Current page context — used for context-aware StatusBar */
  context?: SidebarContext;
  /** Hides the navbar, sidebar, status bar and detail panel, leaving only
   * the page's own content — used for tree display mode. */
  minimal?: boolean;
  children: React.ReactNode;
}

const AppShell: React.FC<AppShellProps> = ({
  navbar,
  sidebar,
  detail,
  showDetail = false,
  context,
  minimal = false,
  children,
}) => {
  return (
    <div className={styles.shell}>
      {!minimal && navbar}
      <div className={styles.body}>
        {!minimal && sidebar}
        <div className={styles.mainWrapper}>
          <main className={styles.main}>{children}</main>
          {!minimal && <StatusBar context={context} />}
        </div>
        {!minimal && (
          <div
            className={
              showDetail && detail ? styles.detailPanel : styles.detailPanelHidden
            }
          >
            {detail}
          </div>
        )}
      </div>
    </div>
  );
};

export default AppShell;
