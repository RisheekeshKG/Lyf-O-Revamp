import React, { memo, useMemo } from "react";
import {
  Settings,
  Search,
  HomeIcon,
  Inbox,
  Briefcase,
  ShoppingCart,
  MessageCircle,
} from "lucide-react";

interface SidebarItemProps {
  icon: React.ReactNode;
  text: string;
  badge?: string;
  active?: boolean;
  onClick?: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = memo(
  ({ icon, text, badge, active, onClick }) => (
    <div
      onClick={onClick}
      className={`flex justify-between items-center px-3 py-2 rounded-md cursor-pointer select-none transition-colors ${
        active ? "bg-[#2b2b2b] text-white" : "hover:bg-[#2b2b2b]"
      }`}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm truncate">{text}</span>
      </div>
      {badge && (
        <span className="text-xs bg-blue-700 px-1.5 py-0.5 rounded-md">
          {badge}
        </span>
      )}
    </div>
  )
);

SidebarItem.displayName = "SidebarItem";

interface SidebarProps {
  dataFiles: Array<{ name: string; file: string; data: any }>;
  activeIndex: number;
  activeView: "data" | "chat";
  onFileSelect: (index: number) => void;
  onViewChange: (view: "data" | "chat") => void;
}

export const Sidebar: React.FC<SidebarProps> = memo(
  ({ dataFiles, activeIndex, activeView, onFileSelect, onViewChange }) => {
    // ✅ useMemo to avoid re-rendering entire sidebar when dataFiles updates
    const privateItems = useMemo(
      () =>
        dataFiles.map((f, idx) => (
          <SidebarItem
            key={f.file}
            icon={<Briefcase size={18} />}
            text={f.name}
            active={idx === activeIndex && activeView === "data"}
            onClick={() => onFileSelect(idx)}
          />
        )),
      [dataFiles, activeIndex, activeView, onFileSelect]
    );

    return (
      <aside className="w-60 bg-[#1f1f1f] border-r border-gray-700 flex flex-col justify-between">
        <div>
          <div className="p-4 text-lg font-semibold truncate">
            Risheekesh K G&apos;s Space
          </div>

          <nav className="flex flex-col gap-1 px-3 overflow-y-auto">
            {/* Static Items */}
            <SidebarItem icon={<Search size={18} />} text="Search" />
            <SidebarItem icon={<HomeIcon size={18} />} text="Home" />
            <SidebarItem
              icon={<MessageCircle size={18} />}
              text="AI Chat"
              active={activeView === "chat"}
              onClick={() => onViewChange("chat")}
            />
            <SidebarItem icon={<Inbox size={18} />} text="Inbox" />

            {/* Private Section */}
            <div className="pt-3 text-xs text-gray-400 uppercase">Private</div>
            {privateItems}

            {/* Shared Section */}
            <div className="pt-3 text-xs text-gray-400 uppercase">Shared</div>
            <SidebarItem
              icon={<ShoppingCart size={18} />}
              text="Shared Resources"
            />
          </nav>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-700">
          <SidebarItem icon={<Settings size={18} />} text="Settings" />
        </div>
      </aside>
    );
  }
);

Sidebar.displayName = "Sidebar";
