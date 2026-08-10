import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../contexts/AppContext';

interface SidebarProps {
  collapsed: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed }) => {
  const { appState, setActiveModule } = useAppContext();
  const [hideSyncMenu, setHideSyncMenu] = useState(false);

  useEffect(() => {
    import('@tauri-apps/api/core').then(({ invoke }) => {
      invoke<string>('get_sync_config_full').then((raw) => {
        try {
          const c = JSON.parse(raw);
          setHideSyncMenu(!!c.hide_sync_menu_in_other_apps);
        } catch {}
      });
    }).catch(() => {});
  }, []);

  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>(() => {
    const active = appState.activeModule;
    return {
      invoice: ['invoice', 'invoice-manager', 'invoice-insight', 'invoice-parent'].includes(active),
      'master-data-parent': ['pelanggan', 'services', 'master-data-parent'].includes(active)
    };
  });

  const menuItems = [
    { id: 'home' as const, label: 'Beranda', icon: '🏠' },
    { id: 'laporan-operasional' as const, label: 'Laporan Operasional', icon: '📈' },
    { id: 'invoice' as const, label: 'Invoice', icon: '🧾' },
    { id: 'master-data-parent' as const, label: 'Master Data', icon: '🗃️' },
  ];

  const bottomItems = [
    { id: 'settings-invoice' as const, label: 'Setelan Invoice', icon: '📄' },
    ...(!hideSyncMenu ? [{ id: 'settings-p2p' as const, label: 'Sinkronisasi', icon: '🔗' }] : []),
    { id: 'activity-log' as const, label: 'Activity Log', icon: '📋' },
  ];

  return (
    <div style={{ height: '100%', background: 'var(--bg-panel)', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column' }}>
      
      {/* Menu */}
      <nav style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        {menuItems.map((item) => {
          const isActive = item.id === 'invoice'
            ? (appState.activeModule === 'invoice' || appState.activeModule === 'invoice-manager' || appState.activeModule === 'invoice-insight' || appState.activeModule === 'invoice-parent')
            : item.id === 'master-data-parent'
            ? (
                appState.activeModule === 'pelanggan' ||
                appState.activeModule === 'services' ||
                appState.activeModule === 'master-data-parent'
              )
            : appState.activeModule === item.id;
          
          const isExpandable = item.id === 'invoice' || item.id === 'master-data-parent';
          const isExpanded = expandedMenus[item.id];
          const showInvoiceSubmenu = item.id === 'invoice' && isExpanded;
          const showMasterDataSubmenu = item.id === 'master-data-parent' && isExpanded;

          return (
            <div key={item.id}>
              <button
                style={{ 
                  width: '100%', 
                  padding: collapsed ? '12px' : '10px 12px', 
                  border: 'none', 
                  borderRadius: '8px',
                  background: isActive ? 'var(--accent)' : 'transparent', 
                  color: isActive ? '#ffffff' : 'var(--text-secondary)', 
                  textAlign: 'left', 
                  cursor: 'pointer', 
                  fontSize: '14px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: collapsed ? 'center' : 'space-between',
                  marginBottom: '4px',
                  fontWeight: isActive ? '600' : '400',
                  transition: 'all 0.15s ease'
                }}
                onClick={() => {
                  if (isExpandable) {
                    setExpandedMenus(prev => ({
                      ...prev,
                      [item.id]: !prev[item.id]
                    }));
                  }

                  if (item.id === 'invoice') {
                    setActiveModule('invoice-parent');
                  } else if (item.id === 'master-data-parent') {
                    setActiveModule('master-data-parent');
                  } else {
                    setActiveModule(item.id);
                  }
                }}
                onMouseOver={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'var(--bg-card)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: collapsed ? '0' : '12px' }}>
                  <span style={{ fontSize: '18px' }}>{item.icon}</span>
                  {!collapsed && <span>{item.label}</span>}
                </div>
                {!collapsed && isExpandable && (
                  <span style={{ 
                    fontSize: '9px', 
                    opacity: 0.7, 
                    transition: 'transform 0.2s', 
                    transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                    display: 'inline-block'
                  }}>
                    ▶
                  </span>
                )}
              </button>

              {showInvoiceSubmenu && (
                <div style={{ paddingLeft: collapsed ? '0' : '22px', display: 'flex', flexDirection: 'column', gap: '1px', marginBottom: '4px', marginTop: '1px' }}>
                  {[
                    { module: 'invoice' as const, label: 'Invoice Generator', icon: '✍️' },
                    { module: 'invoice-manager' as const, label: 'Manajemen Invoice', icon: '🗃️' },
                  ].map((sub) => {
                    const isSubActive = appState.activeModule === sub.module;
                    return (
                      <button
                        key={sub.module}
                        onClick={() => {
                          setActiveModule(sub.module);
                        }}
                        style={{
                          width: '100%',
                          padding: collapsed ? '8px 0' : '4px 8px',
                          border: 'none',
                          borderRadius: '6px',
                          background: isSubActive ? 'rgba(0, 0, 0, 0.05)' : 'transparent',
                          color: isSubActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                          textAlign: collapsed ? 'center' : 'left',
                          cursor: 'pointer',
                          fontSize: collapsed ? '16px' : '12px',
                          fontWeight: isSubActive ? '600' : '400',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: collapsed ? 'center' : 'flex-start',
                          gap: collapsed ? '0' : '8px',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseOver={(e) => {
                          if (!isSubActive) {
                            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.02)';
                            e.currentTarget.style.color = 'var(--text-primary)';
                          }
                        }}
                        onMouseOut={(e) => {
                          if (!isSubActive) {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'var(--text-secondary)';
                          }
                        }}
                      >
                        <span style={{ fontSize: '14px' }}>{sub.icon}</span>
                        {!collapsed && <span>{sub.label}</span>}
                      </button>
                    );
                  })}
                </div>
              )}

              {showMasterDataSubmenu && (
                <div style={{ paddingLeft: collapsed ? '0' : '22px', display: 'flex', flexDirection: 'column', gap: '1px', marginBottom: '4px', marginTop: '1px' }}>
                  {[
                    { module: 'pelanggan' as const, label: 'Pelanggan', icon: '👤' },
                    { module: 'services' as const, label: 'Layanan', icon: '🛠️' },
                  ].map((sub) => {
                    const isSubActive = appState.activeModule === sub.module;
                    return (
                      <button
                        key={sub.module}
                        onClick={() => {
                          setActiveModule(sub.module);
                        }}
                        style={{
                          width: '100%',
                          padding: collapsed ? '8px 0' : '4px 8px',
                          border: 'none',
                          borderRadius: '6px',
                          background: isSubActive ? 'rgba(0, 0, 0, 0.05)' : 'transparent',
                          color: isSubActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                          textAlign: collapsed ? 'center' : 'left',
                          cursor: 'pointer',
                          fontSize: collapsed ? '16px' : '12px',
                          fontWeight: isSubActive ? '600' : '400',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: collapsed ? 'center' : 'flex-start',
                          gap: collapsed ? '0' : '8px',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseOver={(e) => {
                          if (!isSubActive) {
                            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.02)';
                            e.currentTarget.style.color = 'var(--text-primary)';
                          }
                        }}
                        onMouseOut={(e) => {
                          if (!isSubActive) {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'var(--text-secondary)';
                          }
                        }}
                      >
                        <span style={{ fontSize: '14px' }}>{sub.icon}</span>
                        {!collapsed && <span>{sub.label}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      
      {/* Bottom Section */}
      <div style={{ padding: '8px', borderTop: '1px solid var(--border)' }}>
        {bottomItems.map((item) => {
          const isActive = appState.activeModule === item.id;
          return (
            <button
              key={item.id}
              style={{ 
                width: '100%', 
                padding: collapsed ? '12px' : '10px 12px', 
                border: 'none', 
                borderRadius: '8px',
                background: isActive ? 'var(--accent)' : 'transparent', 
                color: isActive ? '#ffffff' : 'var(--text-secondary)', 
                textAlign: 'left', 
                cursor: 'pointer', 
                fontSize: '14px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: collapsed ? '0' : '12px',
                marginBottom: '4px',
                fontWeight: isActive ? '600' : '400',
                transition: 'all 0.15s ease'
              }}
              onClick={() => setActiveModule(item.id)}
              onMouseOver={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'var(--bg-card)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              onMouseOut={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }
              }}
            >
              <span style={{ fontSize: '18px' }}>{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export { Sidebar };
export default Sidebar;
