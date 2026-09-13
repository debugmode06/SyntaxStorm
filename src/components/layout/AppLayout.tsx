import React, { useState } from 'react';
import { User } from '../../types';
import { 
  Menu, X, LogOut, ChevronRight, Search, Bell, Settings as SettingsIcon, User as UserIcon
} from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

interface AppLayoutProps {
  user: User;
  roleLabel: 'ADMIN' | 'STUDENT';
  sidebarItems: NavItem[];
  activeItemId: string;
  onTabChange: (id: string) => void;
  onLogout: () => void;
  pageTitle: string;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  user,
  roleLabel,
  sidebarItems,
  activeItemId,
  onTabChange,
  onLogout,
  pageTitle,
  children
}) => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const userName = user?.name || (roleLabel === 'ADMIN' ? 'Dr. Evelyn Vance' : 'Student');
  const userRole = roleLabel === 'ADMIN' ? 'Administrator' : 'Student';

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex font-sans text-gray-900 antialiased selection:bg-blue-100 selection:text-blue-900">
      
      {/* Mobile Backdrop */}
      {mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 md:hidden animate-in fade-in"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 bg-white border-r border-gray-100 flex flex-col justify-between transition-all duration-300 ease-in-out shadow-xs ${
          collapsed ? 'w-[72px]' : 'w-[260px]'
        } ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div>
          {/* Brand Header */}
          <div className="h-[72px] px-5 border-b border-gray-100 flex items-center justify-between select-none">
            <div className={`flex items-center gap-3 overflow-hidden transition-all ${collapsed ? 'justify-center w-full' : ''}`}>
              <div className="w-8 h-8 shrink-0 rounded-xl bg-gray-900 flex items-center justify-center text-white shadow-sm font-black text-xs tracking-tighter">
                &lt;/&gt;
              </div>
              {!collapsed && (
                <div className="flex flex-col whitespace-nowrap">
                  <span className="font-extrabold text-[15px] tracking-tight text-gray-900 block leading-tight">
                    CodeArena
                  </span>
                  <span className="text-[9px] font-black uppercase tracking-widest text-blue-600 block leading-none mt-0.5">
                    {roleLabel}
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="md:hidden p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-xl"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="p-3 space-y-1 mt-2">
            {!collapsed && (
              <div className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-gray-400">
                {roleLabel === 'ADMIN' ? 'Admin Modules' : 'Student'}
              </div>
            )}
            
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeItemId === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onTabChange(item.id);
                    setMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center px-3 py-2.5 rounded-xl transition-all cursor-pointer text-left group ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                  } ${collapsed ? 'justify-center' : 'justify-between'}`}
                  title={collapsed ? item.label : undefined}
                >
                  <div className="flex items-center gap-3 relative">
                    <div className={`${isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-700'} transition-colors`}>
                      <Icon className="w-[18px] h-[18px]" strokeWidth={2.5} />
                    </div>
                    {!collapsed && <span className={`text-[13px] font-semibold ${isActive ? 'text-blue-700' : ''}`}>{item.label}</span>}
                  </div>
                  {!collapsed && isActive && <ChevronRight className="w-3.5 h-3.5 text-blue-400" />}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer Profile */}
        <div className="p-3 border-t border-gray-100 bg-white">
          <div className={`p-2 bg-gray-50 border border-gray-100 rounded-[14px] flex items-center ${collapsed ? 'justify-center' : 'gap-3'} relative group cursor-pointer`}
               onClick={() => { if(!collapsed) onLogout(); }}
               title={collapsed ? "Sign Out" : undefined}
          >
            <div className={`w-8 h-8 rounded-[10px] ${roleLabel === 'ADMIN' ? 'bg-indigo-600' : 'bg-blue-600'} text-white font-extrabold text-[11px] flex items-center justify-center shrink-0 shadow-sm`}>
              {userName.charAt(0).toUpperCase()}
            </div>
            
            {!collapsed && (
              <div className="overflow-hidden flex-1">
                <p className="text-xs font-bold text-gray-900 truncate leading-tight">
                  {userName}
                </p>
                <p className={`text-[10px] font-bold ${roleLabel === 'ADMIN' ? 'text-indigo-600' : 'text-blue-600'} block leading-tight mt-0.5`}>
                  {userRole}
                </p>
              </div>
            )}
            
            {!collapsed && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onLogout();
                }}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out ${collapsed ? 'md:pl-[72px]' : 'md:pl-[260px]'}`}>
        
        {/* Top Navbar */}
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-30 h-[72px] px-4 sm:px-6 flex items-center justify-between">
          
          {/* Left: Mobile Toggle & Page Title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>

            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden md:flex p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-colors"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="h-4 w-px bg-gray-200 hidden md:block mx-1"></div>

            <h1 className="text-[15px] font-bold text-gray-900 tracking-tight">
              {pageTitle}
            </h1>
          </div>

          {/* Right: Search, Notifications, Profile */}
          <div className="flex items-center gap-2 sm:gap-4">
            
            {/* Search - Visual Only */}
            <div className="hidden sm:flex items-center relative group">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 group-focus-within:text-blue-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Search..." 
                className="w-48 lg:w-64 pl-9 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-full text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400 font-medium"
              />
            </div>

            {/* Notifications */}
            <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-full transition-colors relative">
              <Bell className="w-4 h-4" />
            </button>

            <div className="h-5 w-px bg-gray-200"></div>

            {/* Profile Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 p-1 pr-2 rounded-full hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all cursor-pointer"
              >
                <div className={`w-7 h-7 rounded-full ${roleLabel === 'ADMIN' ? 'bg-indigo-600' : 'bg-blue-600'} text-white font-extrabold text-[10px] flex items-center justify-center shadow-sm`}>
                  {userName.charAt(0)}
                </div>
                <span className="hidden sm:block text-xs font-bold text-gray-700">{userName.split(' ')[0]}</span>
              </button>

              {profileDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProfileDropdownOpen(false)}></div>
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 py-1 z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="px-4 py-2.5 border-b border-gray-50">
                      <p className="text-xs font-extrabold text-gray-900 truncate">{userName}</p>
                      <p className="text-[10px] font-bold text-gray-400">{userRole}</p>
                    </div>
                    <div className="py-1">
                      <button className="w-full text-left px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-50 flex items-center gap-2 cursor-pointer transition-colors">
                        <UserIcon className="w-3.5 h-3.5" /> Profile
                      </button>
                      <button className="w-full text-left px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-50 flex items-center gap-2 cursor-pointer transition-colors">
                        <SettingsIcon className="w-3.5 h-3.5" /> Settings
                      </button>
                    </div>
                    <div className="border-t border-gray-50 py-1">
                      <button 
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          onLogout();
                        }}
                        className="w-full text-left px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5" /> Sign Out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
};
