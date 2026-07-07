import React from 'react'

export default function StatCard({ icon, label, value, sub, color = 'var(--primary)', trend }) {
  return (
    <div className="stat-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          {React.cloneElement(icon, { size: 20, color })}
        </div>
        {trend && (
          <span style={{
            fontSize: 12, fontWeight: 700,
            color: trend.direction === 'up' ? 'var(--success)' : trend.direction === 'down' ? 'var(--danger)' : 'var(--text-light)'
          }}>
            {trend.direction === 'up' ? '▲' : trend.direction === 'down' ? '▼' : ''} {trend.text}
          </span>
        )}
      </div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>{value}</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500, marginTop: 2 }}>{label}</div>
      </div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{sub}</div>}
    </div>
  )
}
