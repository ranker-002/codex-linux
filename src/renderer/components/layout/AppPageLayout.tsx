import React from 'react';

interface AppPageLayoutProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  rightPanel?: React.ReactNode;
  bottomBar?: React.ReactNode;
  children: React.ReactNode;
  contentClassName?: string;
}

export const AppPageLayout: React.FC<AppPageLayoutProps> = ({
  title,
  subtitle,
  actions,
  rightPanel,
  bottomBar,
  children,
  contentClassName = '',
}) => {
  return (
    <div className="page-layout">
      <div className="page-layout-main">
        <div className="page-layout-header">
          <div className="page-layout-header-copy">
            <h2 className="page-layout-title">{title}</h2>
            {subtitle && <p className="page-layout-subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="page-layout-actions">{actions}</div>}
        </div>

        <div className={`page-layout-content ${contentClassName}`.trim()}>{children}</div>

        {bottomBar && <div className="page-layout-bottom">{bottomBar}</div>}
      </div>

      {rightPanel && <aside className="page-layout-right">{rightPanel}</aside>}
    </div>
  );
};

export default AppPageLayout;
