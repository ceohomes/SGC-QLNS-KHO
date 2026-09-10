import React, { useState, useEffect } from 'react'
import {
  KeyRound,
  X,
  Check,
  CheckCircle2,
  AlertTriangle,
  Info,
  Eye,
  EyeOff,
  Sparkles,
  Loader2
} from 'lucide-react'

// SQL schema for Supabase live persistence of the Gemini API Key.
// Chạy đoạn mã này trong SQL Editor của Supabase trước khi dùng tính năng "Cài đặt API Key".
export const SQL_CODE_CAI_DAT_API = `-- -------------------------------------------------------------
-- BẢNG LƯU TRỮ GEMINI API KEY (sgc_cai_dat_api)
-- Vui lòng chạy đoạn mã này trong SQL Editor của Supabase!
-- Bảng này CHỈ được đọc/ghi bởi server (Service Role Key), KHÔNG cấp quyền
-- cho anon/authenticated key để đảm bảo API Key không bị lộ ra trình duyệt.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sgc_cai_dat_api (
    id TEXT PRIMARY KEY,        -- Tên biến, VD: 'GEMINI_API_KEY'
    gia_tri TEXT,                -- Giá trị API Key
    ghi_chu TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bật Row Level Security và KHÔNG tạo policy nào cho anon/authenticated
-- => chỉ Service Role Key (dùng ở server) mới đọc/ghi được bảng này.
ALTER TABLE sgc_cai_dat_api ENABLE ROW LEVEL SECURITY;

-- Tự động cập nhật updated_at mỗi khi có thay đổi
CREATE OR REPLACE FUNCTION sgc_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sgc_cai_dat_api_updated_at ON sgc_cai_dat_api;
CREATE TRIGGER trg_sgc_cai_dat_api_updated_at
BEFORE UPDATE ON sgc_cai_dat_api
FOR EACH ROW EXECUTE FUNCTION sgc_set_updated_at();
`

export default function CaiDatApiKeyModal({ isOpen, onClose }) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null) // dữ liệu trả về từ GET /api/settings
  const [value, setValue] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showSql, setShowSql] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadStatus()
      setValue('')
      setError('')
      setSuccess('')
    }
  }, [isOpen])

  const loadStatus = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/settings')
      if (!res.ok) throw new Error('Không thể tải trạng thái cấu hình từ server')
      const data = await res.json()
      setStatus(data)
    } catch (err) {
      console.warn('Lỗi tải cấu hình API:', err)
      setError('Không thể kết nối tới server để tải trạng thái cấu hình. Vui lòng kiểm tra server đang chạy.')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!value.trim()) {
      setError('Vui lòng nhập Gemini API Key trước khi lưu.')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geminiApiKey: value.trim() })
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Lưu Gemini API Key thất bại')
      }
      setSuccess('Đã lưu Gemini API Key thành công! Hệ thống sẽ áp dụng ngay cho lượt quét CV tiếp theo.')
      setValue('')
      await loadStatus()
    } catch (err) {
      setError(err.message || 'Lưu Gemini API Key thất bại')
    } finally {
      setSaving(false)
      setTimeout(() => setSuccess(''), 4000)
    }
  }

  if (!isOpen) return null

  const geminiStatus = status?.geminiApiKey

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: 16,
        width: '100%',
        maxWidth: 520,
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden',
        border: '1px solid #cbd5e1'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          background: 'linear-gradient(135deg, #0f58a7 0%, #1e40af 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: 'rgba(255, 255, 255, 0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <KeyRound size={20} style={{ color: '#ffffff' }} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>CÀI ĐẶT API KEY</h3>
              <p style={{ margin: 0, fontSize: 12, opacity: 0.9, marginTop: 2 }}>
                Gemini API Key dùng để AI quét và phân tích CV
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', color: '#ffffff',
              cursor: 'pointer', padding: 6, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {success && (
          <div style={{
            margin: '12px 20px 0', padding: '10px 14px', background: '#ecfdf5',
            border: '1px solid #10b981', borderRadius: 8, color: '#047857',
            fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8
          }}>
            <CheckCircle2 size={16} />
            <span>{success}</span>
          </div>
        )}

        {error && (
          <div style={{
            margin: '12px 20px 0', padding: '10px 14px', background: '#fef2f2',
            border: '1px solid #f87171', borderRadius: 8, color: '#b91c1c',
            fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8
          }}>
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {status && !status.storageEnabled && (
          <div style={{
            margin: '12px 20px 0', padding: '10px 14px', background: '#fffbeb',
            border: '1px solid #f59e0b', borderRadius: 8, color: '#92400e',
            fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'flex-start', gap: 8
          }}>
            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              Server chưa cấu hình biến môi trường <code>SUPABASE_SERVICE_ROLE_KEY</code> nên chưa thể lưu Gemini API Key qua giao diện này.
              Hãy chạy câu lệnh SQL bên dưới để tạo bảng, sau đó thêm <code>SUPABASE_URL</code> và <code>SUPABASE_SERVICE_ROLE_KEY</code>
              (lấy trong Supabase → Project Settings → API) vào file <code>.env</code> của server rồi khởi động lại.
            </span>
          </div>
        )}

        {/* Content */}
        <form onSubmit={handleSave} style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', fontSize: 13, padding: '20px 0', justifyContent: 'center' }}>
              <Loader2 size={16} className="spin-icon" />
              <span>Đang tải trạng thái cấu hình...</span>
            </div>
          ) : (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={14} color="#0f58a7" />
                  <span>Gemini API Key</span>
                </label>

                {geminiStatus && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                    background: geminiStatus.configured ? '#dcfce7' : '#fee2e2',
                    color: geminiStatus.configured ? '#15803d' : '#b91c1c'
                  }}>
                    {geminiStatus.configured ? `Đã cấu hình (${geminiStatus.masked})` : 'Chưa cấu hình'}
                  </span>
                )}
              </div>

              <div style={{ position: 'relative' }}>
                <input
                  type={revealed ? 'text' : 'password'}
                  className="input"
                  value={value}
                  onChange={e => setValue(e.target.value)}
                  placeholder={geminiStatus?.configured ? 'Để trống nếu không muốn đổi giá trị hiện tại' : 'AIza...'}
                  style={{ width: '100%', height: 40, borderRadius: 8, fontSize: 13.5, fontWeight: 600, paddingRight: 40, boxSizing: 'border-box' }}
                  autoComplete="off"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setRevealed(v => !v)}
                  style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: '#64748b',
                    display: 'flex', alignItems: 'center'
                  }}
                  title={revealed ? 'Ẩn giá trị' : 'Hiện giá trị'}
                >
                  {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <p style={{ margin: '6px 0 0', fontSize: 11.5, color: '#64748b' }}>
                Dùng để AI tự động đọc và trích xuất thông tin từ CV (PDF / Word). Lấy tại Google AI Studio.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowSql(v => !v)}
            style={{
              alignSelf: 'flex-start', background: 'none', border: 'none', color: '#0f58a7',
              fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            <Info size={14} />
            <span>{showSql ? 'Ẩn câu lệnh SQL tạo bảng Supabase' : 'Xem câu lệnh SQL tạo bảng Supabase'}</span>
          </button>

          {showSql && (
            <pre style={{
              margin: 0, padding: 12, background: '#0f172a', color: '#e2e8f0',
              borderRadius: 8, fontSize: 11.5, lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre'
            }}>{SQL_CODE_CAI_DAT_API}</pre>
          )}
        </form>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12
        }}>
          <div style={{ fontSize: 11.5, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Info size={13} />
            <span>Giá trị được lưu trực tiếp trên server (Supabase), không lưu ở trình duyệt.</span>
          </div>

          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px', background: '#e2e8f0', color: '#334155',
                border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer'
              }}
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              style={{
                padding: '8px 18px', background: '#0f58a7', color: '#ffffff',
                border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13,
                cursor: (saving || loading) ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 6, opacity: (saving || loading) ? 0.7 : 1
              }}
            >
              {saving ? <Loader2 size={15} className="spin-icon" /> : <Check size={15} />}
              <span>{saving ? 'Đang lưu...' : 'Lưu API Key'}</span>
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .spin-icon { animation: sgc-spin 0.8s linear infinite; }
        @keyframes sgc-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
