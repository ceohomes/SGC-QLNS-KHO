import React from 'react'
import { AlertCircle, CheckCircle, Info, AlertTriangle, X, Trash2 } from 'lucide-react'

export default function CustomAlert({ type = 'alert', title, message, severity = 'info', onConfirm, onCancel }) {
  const getIcon = () => {
    switch (severity) {
      case 'success':
        return <CheckCircle size={18} style={{ color: '#ffffff' }} />
      case 'warning':
        return <AlertTriangle size={18} style={{ color: '#ffffff' }} />
      case 'error':
        return <Trash2 size={18} style={{ color: '#ffffff' }} />
      default:
        return <Info size={18} style={{ color: '#ffffff' }} />
    }
  }

  const getHeaderBg = () => {
    switch (severity) {
      case 'success':
        return '#10b981' // Vibrant green
      case 'warning':
        return '#f59e0b' // Vibrant orange/amber
      case 'error':
        return '#e11d48' // Vibrant pinkish-red (rose-600)
      default:
        return '#0f58a7' // SGC Primary Blue
    }
  }

  const getConfirmBtnBg = () => {
    return getHeaderBg()
  }

  const getConfirmBtnHoverBg = () => {
    switch (severity) {
      case 'success':
        return '#059669' // emerald-600
      case 'warning':
        return '#d97706' // amber-600
      case 'error':
        return '#be123c' // rose-700
      default:
        return '#0c4685' // darker blue
    }
  }

  const renderContent = () => {
    if (typeof message !== 'string') {
      return message
    }

    const lines = message.split('\n').map(l => l.trim()).filter(Boolean)

    // Check if it's a deletion or error confirmation that matches our gorgeous structured format
    if (severity === 'error' && lines.length >= 2) {
      const label = lines[0]
      const entity = lines[1]
      const desc = lines[2] || 'Toàn bộ thông tin liên quan sẽ bị gỡ bỏ.'
      const warning = lines[3] || 'Hành động này không thể hoàn tác.'

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: '"Roboto", sans-serif' }}>
          {/* Label */}
          <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
            {label}
          </div>
          {/* Entity Name */}
          <div style={{ 
            fontSize: 22, 
            fontWeight: 800, 
            color: '#e11d48', // Crimson/rose color for deleted item
            lineHeight: 1.25,
            letterSpacing: '-0.01em'
          }}>
            {entity}
          </div>
          {/* Description */}
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.55, fontWeight: 500, marginTop: 4 }}>
            {desc}
          </div>
          {/* Warning (italicized) */}
          {warning && (
            <div style={{ 
              fontSize: 12, 
              color: '#94a3b8', 
              fontStyle: 'italic', 
              fontWeight: 500,
              marginTop: 6
            }}>
              {warning}
            </div>
          )}
        </div>
      )
    }

    // Default multi-line or single-line rendering
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontFamily: '"Roboto", sans-serif' }}>
        {lines.map((line, idx) => {
          const isHeading = idx === 0 && line.length < 50
          const isWarning = line.toLowerCase().includes('không thể hoàn tác') || line.toLowerCase().includes('lưu ý')
          return (
            <div 
              key={idx} 
              style={{ 
                fontSize: isHeading ? 14.5 : 13, 
                fontWeight: isHeading ? 700 : 500,
                color: isWarning ? '#94a3b8' : isHeading ? '#1e293b' : '#475569',
                fontStyle: isWarning ? 'italic' : 'normal',
                lineHeight: 1.5
              }}
            >
              {line}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.45)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: 16
    }}>
      <div style={{
        width: 440,
        maxWidth: '100%',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
        backgroundColor: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '"Roboto", sans-serif'
      }}>
        {/* Banner with icon */}
        <div style={{
          backgroundColor: getHeaderBg(),
          padding: '18px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          position: 'relative'
        }}>
          {/* Icon Badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 30,
            height: 30,
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            flexShrink: 0
          }}>
            {getIcon()}
          </div>
          
          <div style={{ textAlign: 'left', flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: '#ffffff', letterSpacing: '0.04em' }}>
              {title ? title.toUpperCase() : 'THÔNG BÁO'}
            </h3>
          </div>

          {/* Close button X */}
          <button 
            onClick={onCancel || onConfirm}
            style={{
              background: 'none',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0.75,
              transition: 'opacity 0.15s',
              outline: 'none'
            }}
            onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
            onMouseOut={(e) => e.currentTarget.style.opacity = '0.75'}
          >
            <X size={16} />
          </button>
        </div>

        {/* Message body */}
        <div style={{ 
          padding: '24px 28px 20px 28px', 
          backgroundColor: '#ffffff'
        }}>
          {renderContent()}
        </div>

        {/* Actions bar */}
        <div style={{
          padding: '0 28px 24px 28px',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 12,
          backgroundColor: '#ffffff'
        }}>
          {type === 'confirm' && (
            <button
              onClick={onCancel}
              style={{
                padding: '9px 24px',
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 10,
                border: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                color: '#475569',
                cursor: 'pointer',
                transition: 'all 0.15s ease-in-out',
                outline: 'none',
                minWidth: 90
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#f8fafc'
                e.currentTarget.style.borderColor = '#cbd5e1'
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#ffffff'
                e.currentTarget.style.borderColor = '#e2e8f0'
              }}
            >
              Hủy
            </button>
          )}
          <button
            onClick={onConfirm}
            style={{
              padding: '9px 24px',
              fontSize: 13,
              fontWeight: 700,
              borderRadius: 10,
              border: 'none',
              backgroundColor: getConfirmBtnBg(),
              color: '#ffffff',
              cursor: 'pointer',
              transition: 'all 0.15s ease-in-out',
              outline: 'none',
              minWidth: 100,
              boxShadow: `0 4px 12px ${severity === 'error' ? 'rgba(225, 29, 72, 0.2)' : 'rgba(15, 88, 167, 0.15)'}`
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = getConfirmBtnHoverBg()
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = getConfirmBtnBg()
            }}
          >
            {type === 'confirm' && severity === 'error' ? 'Xác nhận xóa' : 'Đồng ý'}
          </button>
        </div>
      </div>
    </div>
  )
}

