import React, { useState, useRef } from 'react'
import { LayoutDashboard, Users, Building, Building2, ClipboardList } from 'lucide-react'

const NAV_GROUPS = [
  {
    label: 'Tổng quan',
    items: [
      { id: 'dashboard', label: 'Dashboard tổng quan', icon: <LayoutDashboard /> },
    ]
  },
  {
    label: 'Nhân sự thủ kho',
    items: [
      { id: 'danhsach', label: 'Danh sách thủ kho', icon: <Users /> },
      { id: 'thongtinduan', label: 'Thông tin dự án', icon: <Building /> },
      { id: 'duan', label: 'Thống kê theo dự án', icon: <Building2 /> },
      { id: 'dinhbien', label: 'Định biên nhân sự', icon: <ClipboardList /> },
    ]
  },
]

export default function Sidebar({ tab, setTab, counts, isPinned, setIsPinned }) {
  const [isOpen, setIsOpen] = useState(false)
  const timerRef = useRef(null)

  const handleMouseEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setIsOpen(true)
  }
  const handleMouseLeave = () => {
    if (isPinned) return
    timerRef.current = setTimeout(() => setIsOpen(false), 250)
  }
  const togglePin = () => {
    setIsPinned(!isPinned)
  }

  const visible = isOpen || isPinned

  return (
    <>
      {/* Hover trigger strip */}
      <div
        onMouseEnter={handleMouseEnter}
        style={{ position: 'fixed', left: 0, top: 64, bottom: 0, width: 14, zIndex: 199 }}
      />

      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          position: 'fixed', left: 0, top: 64, bottom: 0, width: 270, zIndex: 200,
          background: '#00086a',
          boxShadow: visible ? '6px 0 30px rgba(10,25,49,0.3)' : 'none',
          transform: visible ? 'translateX(0)' : 'translateX(-270px)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex', flexDirection: 'column',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)'
        }}
      >
        <div style={{
          padding: '24px 24px 20px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.03)'
        }}>
          <span style={{
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14,
            color: '#ffffff', letterSpacing: '0.08em', textTransform: 'uppercase',
            textShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}>
            Quản lý Nhân Sự
          </span>
          <button
            onClick={togglePin}
            title={isPinned ? 'Bỏ ghim menu' : 'Ghim menu'}
            style={{
              background: isPinned ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              border: isPinned ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
              color: isPinned ? '#ffffff' : '#93c5fd',
              cursor: 'pointer', padding: '6px 8px', borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill={isPinned ? '#ffffff' : 'none'} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="17" x2="12" y2="22"></line>
              <path d="M5 17h14v-1.76a2 2 0 0 0-.44-1.24l-2.78-3.5A2 2 0 0 1 15 9.24V5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v4.24c0 .43-.14.85-.4 1.18l-2.78 3.5a2 2 0 0 0-.44 1.24z"></path>
            </svg>
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 28 }}>
          {NAV_GROUPS.map(group => (
            <div key={group.label} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{
                fontSize: 10.5, fontWeight: 700, color: '#93c5fd', letterSpacing: '0.12em',
                paddingLeft: 12, marginBottom: 4, textTransform: 'uppercase',
                display: 'flex', alignItems: 'center', gap: 8, opacity: 0.85
               }}>
                <span>{group.label}</span>
                <div style={{ flex: 1, height: 1, background: 'rgba(255, 255, 255, 0.08)' }} />
              </div>
              {group.items.map(item => {
                const isSelected = tab === item.id
                const count = counts?.[item.id]
                return (
                  <button
                    key={item.id}
                    onClick={() => { setTab(item.id); if (!isPinned) setIsOpen(false) }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
                      padding: '13px 16px', borderRadius: 12, fontSize: 15.5,
                      fontWeight: isSelected ? 700 : 500,
                      color: isSelected ? '#ffffff' : '#cbd5e1',
                      background: isSelected ? 'linear-gradient(135deg, #0f58a7 0%, #1b6ef3 100%)' : 'transparent',
                      border: 'none', cursor: 'pointer', transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: isSelected ? '0 4px 16px rgba(11, 87, 208, 0.35)' : 'none',
                      position: 'relative'
                    }}
                    onMouseOver={(e) => { if (!isSelected) { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'; e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.transform = 'translateX(6px)' } }}
                    onMouseOut={(e) => { if (!isSelected) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#cbd5e1'; e.currentTarget.style.transform = 'none' } }}
                  >
                    {isSelected && (
                      <div style={{
                        position: 'absolute', left: 0, top: '25%', bottom: '25%', width: 4,
                        background: '#ffffff', borderRadius: '0 4px 4px 0'
                      }} />
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22 }}>
                        {React.cloneElement(item.icon, { size: 18, strokeWidth: isSelected ? 2.5 : 2, color: isSelected ? '#ffffff' : '#93c5fd' })}
                      </div>
                      <span style={{ letterSpacing: '0.01em' }}>{item.label}</span>
                    </div>
                    {count != null && count > 0 && (
                      <span style={{
                        background: isSelected ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.12)',
                        color: '#ffffff',
                        border: isSelected ? 'none' : '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 700
                      }}>
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: 11, color: '#93c5fd', opacity: 0.7 }}>
          SGC © 2026 · Quản lý Thủ kho Dự án
        </div>
      </div>

      {/* Small persistent handle when closed & unpinned */}
      {!visible && (
        <div
          onMouseEnter={handleMouseEnter}
          style={{
            position: 'fixed', left: 0, top: 90, width: 6, height: 60, borderRadius: '0 6px 6px 0',
            background: 'linear-gradient(180deg, #0f58a7, #0c4685)', zIndex: 199, opacity: 0.6
          }}
        />
      )}
    </>
  )
}
