import React, { useState, useRef, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { PanelKanan } from './PanelKanan';
import { Toast, ConfirmDialog } from '@pubhub/shared-ui';
import { useAppContext } from '../../contexts/AppContext';
// Modul CRM & Manajemen Kontak Pelanggan
import PenulisManager from '../data-master/PenulisManager';
import PenerbitManager from '../data-master/PenerbitManager';
import NaskahOrdersManager from '../data-master/NaskahOrdersManager';
import ActivityLog from '../data-master/ActivityLog';
import ServiceManager from '../data-master/ServiceManager';
import LegalitasManager from '../data-master/LegalitasManager';

// Modul Produksi (Workflow)
import PekerjaanSaya from '../produksi/PekerjaanSaya';
import ProduksiBoard from '../produksi/ProduksiBoard';
import ProduksiList from '../produksi/ProduksiList';
import ProduksiKendala from '../produksi/ProduksiKendala';
import ProduksiApproval from '../produksi/ProduksiApproval';
import ProduksiTimeline from '../produksi/ProduksiTimeline';
import TaskFormPage from '../produksi/TaskFormPage';
import LaporanOperasional from '../laporan/LaporanOperasional';
import DashboardProduksi from '../produksi/DashboardProduksi';
import DashboardMasterData from '../data-master/DashboardMasterData';
import HomeDashboard from '../home/HomeDashboard';

// Modul Auth Lokal
import { useAuth } from '../../contexts/AuthContext';
import LoginPage from '../auth/LoginPage';
import { SyncConnectionPanel } from '@pubhub/shared-ui/src/shared/SyncConnectionPanel';

const MainLayout = () => {
  const { appState, rightPanelVisible, toast, confirmOptions, hideConfirm } = useAppContext();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [rightPanelWidth, setRightPanelWidth] = useState(450);
  const [isDragging, setIsDragging] = useState(false);
  const [fileSearchQuery, setFileSearchQuery] = useState('');
  const [isSessionRunning, setIsSessionRunning] = useState<boolean | null>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startXRef.current = e.clientX;
    startWidthRef.current = rightPanelWidth;
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      const deltaX = startXRef.current - e.clientX;
      const newWidth = startWidthRef.current + deltaX;
      setRightPanelWidth(Math.max(300, Math.min(600, newWidth)));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('mouseleave', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mouseleave', handleMouseUp);
    };
  }, [isDragging]);

  useEffect(() => {
    setFileSearchQuery('');
  }, [appState.activeModule]);

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };


  const renderSettingsModule = (title: string, icon: string, component: React.ReactNode) => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-dark)', color: 'var(--text-primary)' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-panel)',
          height: 44,
          boxSizing: 'border-box',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>{icon}</span>
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{title}</span>
          </div>
        </div>
        <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
          {component}
        </div>
      </div>
    );
  };

  const renderModule = () => {
    switch (appState.activeModule) {
      case 'home':
        return <HomeDashboard />;
      case 'pekerjaan-saya':
        return <PekerjaanSaya searchQuery={fileSearchQuery} />;
      case 'produksi-parent':
        return <DashboardProduksi />;
      case 'master-data-parent':
        return <DashboardMasterData />;
      case 'produksi-board':
        return <ProduksiBoard searchQuery={fileSearchQuery} />;
      case 'produksi-list':
        return <ProduksiList searchQuery={fileSearchQuery} />;
      case 'produksi-kendala':
        return <ProduksiKendala searchQuery={fileSearchQuery} />;
      case 'produksi-approval':
        return <ProduksiApproval searchQuery={fileSearchQuery} />;
      case 'produksi-timeline':
        return <ProduksiTimeline searchQuery={fileSearchQuery} />;
      case 'laporan-operasional':
        return <LaporanOperasional />;
      case 'kontak':
      case 'penulis':
        return <PenulisManager searchQuery={fileSearchQuery} />;
      case 'penerbit':
        return <PenerbitManager searchQuery={fileSearchQuery} />;
      case 'naskah':
        return <NaskahOrdersManager searchQuery={fileSearchQuery} />;
      case 'legalitas':
        return <LegalitasManager searchQuery={fileSearchQuery} />;
      case 'services':
        return <ServiceManager searchQuery={fileSearchQuery} />;
      case 'activity-log':
        return <ActivityLog />;
      case 'tambah-tugas':
      case 'edit-tugas':
        return <TaskFormPage />;
      case 'settings-p2p':
        return renderSettingsModule('Sinkronisasi', '🔗', <SyncConnectionPanel />);
      default:
        return <HomeDashboard />;
    }
  };

  return (
    <div className="main-layout" style={{ flexDirection: 'column' }}>
      <TopBar 
        onToggleSidebar={toggleSidebar} 
        sidebarCollapsed={sidebarCollapsed} 
        activeModule={appState.activeModule}
        searchQuery={fileSearchQuery}
        onSearchChange={setFileSearchQuery}
        onSessionChange={setIsSessionRunning}
      />

      {isSessionRunning === false && (
        <div style={{
          background: '#fef3c7',
          borderBottom: '1px solid #f59e0b',
          color: '#b45309',
          padding: '8px 16px',
          fontSize: '12px',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          justifyContent: 'center',
          userSelect: 'none',
          zIndex: 10,
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
          flexShrink: 0
        }}>
          <span>⚠️</span>
          <span><strong>Mode Baca-Saja:</strong> Silakan klik tombol <strong style={{ color: 'var(--accent, #c01c1c)' }}>"Mulai Kerja"</strong> di kanan atas untuk mengaktifkan pengisian form dan tombol aksi.</span>
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div style={{ width: sidebarCollapsed ? '60px' : '260px', flexShrink: 0, position: 'relative', height: '100%', transition: 'width 0.3s ease' }}>
          <Sidebar collapsed={sidebarCollapsed} />
        </div>

        <div className="main-content">
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden', height: '100%' }}>
            <div className={`module-area ${isSessionRunning === false ? 'session-locked' : ''}`}>
              {renderModule()}
            </div>

            {rightPanelVisible && (
              <div 
                className={isSessionRunning === false ? 'session-locked' : ''}
                style={{ 
                  width: `${rightPanelWidth}px`, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  background: 'var(--bg-panel)', 
                  position: 'relative',
                  height: '100%'
                }}
              >
                <div 
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: '6px',
                    cursor: 'col-resize',
                    background: isDragging ? 'var(--accent)' : 'transparent',
                    zIndex: 10,
                    transition: 'background 0.15s ease'
                  }}
                  onMouseDown={handleMouseDown}
                />
                <PanelKanan />
              </div>
            )}
          </div>
        </div>
      </div>
      <Toast toast={toast} />
      <ConfirmDialog confirmOptions={confirmOptions} hideConfirm={hideConfirm} />
    </div>
  );
};

const MainLayoutInner = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-dark)', color: 'var(--text-secondary)', fontSize: '14px' }}>
        Memuat aplikasi...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <MainLayout />;
};

export { MainLayout, MainLayoutInner };
export default MainLayoutInner;
