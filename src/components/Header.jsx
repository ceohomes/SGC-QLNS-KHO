import React from 'react'
import { RefreshCw, Database, User as UserIconLucide } from 'lucide-react'

const TAB_TITLES = {
  dashboard: 'SGC | QUẢN LÝ NHÂN SỰ THỦ KHO',
  danhsach: 'SGC | DANH SÁCH THỦ KHO',
  thongtinduan: 'SGC | THÔNG TIN DỰ ÁN',
  duan: 'SGC | THỐNG KÊ THEO DỰ ÁN',
}

export default function Header({ activeTab, onRefresh, lastUpdated, dbStatus }) {
  const [refreshing, setRefreshing] = React.useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    await new Promise(r => setTimeout(r, 500))
    onRefresh && onRefresh()
    setRefreshing(false)
  }

  return (
    <header style={{
      background: 'linear-gradient(135deg, #0c4685 0%, #0f58a7 60%, #1b6ef3 100%)',
      padding: '0 24px',
      height: 64,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxShadow: '0 4px 20px rgba(11,87,208,0.18)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      flexShrink: 0
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 36, height: 36, background: '#ffffff',
          borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 3px 12px rgba(11,87,208,0.15)',
        }}>
          <span style={{ color: '#0f58a7', fontWeight: 900, fontSize: 14, letterSpacing: '0.02em' }}>SGC</span>
        </div>
        <div style={{ color: '#ffffff', fontWeight: 800, fontSize: 18, letterSpacing: '0.03em' }}>
          {TAB_TITLES[activeTab] || 'SGC | QUẢN LÝ NHÂN SỰ THỦ KHO'}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={handleRefresh}
          title="Làm mới dữ liệu"
          style={{
            display: 'flex', alignItems: 'center',
            background: 'rgba(255, 255, 255, 0.12)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: 6, padding: '4px 10px', color: '#ffffff',
            fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
            cursor: 'pointer', transition: 'all 0.15s ease', height: 28, boxSizing: 'border-box'
          }}
          onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)' }}
          onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)' }}
        >
          <RefreshCw size={12} style={{ marginRight: 5, color: '#dbeafe', animation: refreshing ? 'spin 0.6s linear infinite' : 'none' }} />
          <span>{refreshing ? 'Đang tải...' : 'Làm mới'}</span>
        </button>

        <div title="Trạng thái kết nối dữ liệu Supabase" style={{
          display: 'flex', alignItems: 'center',
          background: dbStatus === 'connected' ? 'rgba(16, 185, 129, 0.25)' :
                      dbStatus === 'empty' ? 'rgba(245, 158, 11, 0.25)' :
                      dbStatus === 'error' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(251, 191, 36, 0.25)',
          border: dbStatus === 'connected' ? '1px solid #10b981' :
                  dbStatus === 'empty' ? '1px solid #f59e0b' :
                  dbStatus === 'error' ? '1px solid #ef4444' : '1px solid #fbbf24',
          borderRadius: 6, padding: '4px 10px', color: '#ffffff',
          fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', height: 28, boxSizing: 'border-box'
        }}>
          <Database size={13} style={{ 
            marginRight: 5, 
            color: dbStatus === 'connected' ? '#34d399' :
                   dbStatus === 'empty' ? '#fbbf24' :
                   dbStatus === 'error' ? '#f87171' : '#fef08a'
          }} />
          <span>
            {dbStatus === 'connected' ? 'Supabase: Connected' :
             dbStatus === 'empty' ? 'Supabase: Trống' :
             dbStatus === 'error' ? 'Supabase: Lỗi' : 'Supabase: Loading...'}
          </span>
          <span style={{ 
            width: 6, height: 6, borderRadius: '50%', 
            background: dbStatus === 'connected' ? '#10b981' :
                        dbStatus === 'empty' ? '#f59e0b' :
                        dbStatus === 'error' ? '#ef4444' : '#fbbf24', 
            marginLeft: 6, 
            boxShadow: dbStatus === 'connected' ? '0 0 8px #10b981' :
                       dbStatus === 'empty' ? '0 0 8px #f59e0b' :
                       dbStatus === 'error' ? '0 0 8px #ef4444' : '0 0 8px #fbbf24',
            animation: dbStatus === 'loading' ? 'pulse 1s infinite alternate' : 'none'
          }} />
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 6, padding: '4px 10px', color: '#ffffff', fontSize: 12, fontWeight: 600,
          height: 28, boxSizing: 'border-box'
        }}>
          <UserIconLucide size={12} style={{ color: '#c7d2fe' }} />
          <span>Quản trị viên</span>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 6, padding: '4px 12px', color: '#ffffff', fontSize: 13, fontWeight: 600,
          letterSpacing: '0.03em'
        }}>
          v1.0.0
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </header>
  )
}
