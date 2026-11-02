import React, { useState } from 'react';
import { TabType } from './Navigation';
import { TabContextMenu } from './TabContextMenu';

interface ContextMenuWrapperProps {
  route: string;
  title: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  onSelectTab?: (route: TabType) => void;
  className?: string;
}

export const ContextMenuWrapper: React.FC<ContextMenuWrapperProps> = ({
  route,
  title,
  children,
  icon,
  onSelectTab,
  className = 'inline-block'
}) => {
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);

  // تطبيع المسار (مثل تحويل debts إلى customers)
  const normalizedRoute = (route === 'debts' ? 'customers' : route) as TabType;

  return (
    <>
      <div
        className={className}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setMenuPos({ x: e.clientX, y: e.clientY });
        }}
        title="انقر بالزر الأيمن (Right-Click) للفتح في نافذة مستقلة نظيفة أو إنشاء اختصار على سطح المكتب"
      >
        {children}
      </div>

      {menuPos && (
        <TabContextMenu
          x={menuPos.x}
          y={menuPos.y}
          tabId={normalizedRoute}
          tabLabel={title}
          tabIcon={icon}
          onClose={() => setMenuPos(null)}
          onSelectTab={(t) => {
            if (onSelectTab) onSelectTab(t);
            setMenuPos(null);
          }}
        />
      )}
    </>
  );
};
export default ContextMenuWrapper;
