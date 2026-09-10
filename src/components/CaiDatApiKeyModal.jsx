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
import { supabase } from '../supabaseClient'
import useEscapeKey from '../hooks/useEscapeKey'

// Tên bảng + id dòng lưu Gemini API Key trên Supabase
const SETTINGS_TABLE = 'sgc_cai_dat_api'
const GEMINI_KEY_ID = 'GEMINI_API_KEY'

// SQL schema for Supabase live persistence of the Gemini API Key.
// Chạy đoạn mã này trong SQL Editor của Supabase trước khi dùng tính năng "Cài đặt API Key".
// Lưu ý: bảng này KHÔNG bật Row Level Security (giống các bảng cấu hình khác của app như
// sgc_cai_dat_chuc_vu) để giao diện có thể đọc/ghi trực tiếp bằng Supabase anon key mà
// không cần chạy thêm server. Nếu bạn đã lỡ chạy phiên bản SQL cũ có bật RLS, hãy chạy lại
// đoạn dưới đây — dòng ALTER TABLE ... DISABLE ROW LEVEL SECURITY sẽ tắt nó đi.
export const SQL_CODE_CAI_DAT_API = `-- -------------------------------------------------------------
-- BẢNG LƯU TRỮ GEMINI API KEY (sgc_cai_dat_api)
-- Vui lòng chạy đoạn mã này trong SQL Editor của Supabase!
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sgc_cai_dat_api (
    id TEXT PRIMARY KEY,        -- Tên biến, VD: 'GEMINI_API_KEY'
    gia_tri TEXT,                -- Giá trị API Key
    ghi_chu TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tắt Row Level Security để giao diện (dùng Supabase anon key, giống các bảng
-- cấu hình khác trong app như sgc_cai_dat_chuc_vu) đọc/ghi trực tiếp được, không
-- cần server đứng giữa. Nếu bảng đã tồn tại và đang bật RLS, dòng này sẽ tắt nó đi.
ALTER TABLE sgc_cai_dat_api DISABLE ROW LEVEL SECURITY;

-- QUAN TRỌNG: Tắt RLS thôi CHƯA đủ — bảng tạo bằng SQL Editor mặc định KHÔNG cấp
-- quyền đọc/ghi cho vai trò anon/authenticated (khác với tạo bảng bằng Table Editor).
-- Nếu thiếu dòng này sẽ bị lỗi "permission denied" dù đã tắt RLS ở trên.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE sgc_cai_dat_api TO anon, authenticated;

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

function maskSecret(v) {
  if (!v) return ''
  if (v.length <= 8) return '••••••••'
  return `${v.slice(0, 4)}••••${v.slice(-4)}`
}

export default function CaiDatApiKeyModal({ isOpen, onClose }) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [configured, setConfigured] = useState(false)
  const [masked, setMasked] = useState('')
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
      const { data, error: dbError } = await supabase
        .from(SETTINGS_TABLE)
        .select('gia_tri')
        .eq('id', GEMINI_KEY_ID)
        .maybeSingle()

      if (dbError) throw dbError

      const currentValue = data?.gia_tri || ''
      setConfigured(Boolean(currentValue))
      setMasked(maskSecret(currentValue))
    } catch (err) {
      console.warn('Lỗi tải trạng thái Gemini API Key:', err)
      const msg = (err?.message || '').toLowerCase()
      if (msg.includes('does not exist') || msg.includes('could not find the table')) {
        setError(`Chưa có bảng "${SETTINGS_TABLE}" trên Supabase. Vui lòng chạy câu lệnh SQL bên dưới trước.`)
      } else {
        setError('Không thể kết nối Supabase để tải trạng thái cấu hình. Vui lòng kiểm tra lại kết nối Supabase.')
      }
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
      const { error: dbError } = await supabase
        .from(SETTINGS_TABLE)
        .upsert(
          { id: GEMINI_KEY_ID, gia_tri: value.trim(), updated_at: new Date().toISOString() },
          { onConflict: 'id' }
        )

      if (dbError) throw dbError

      setSuccess('Đã lưu Gemini API Key thành công lên Supabase!')
      setValue('')
      await loadStatus()
    } catch (err) {
      console.error('Lỗi khi lưu Gemini API Key:', err)
      const rawMsg = err?.message || ''
      const rawCode = err?.code ? ` [${err.code}]` : ''
      const rawDetails = err?.details ? ` — ${err.details}` : ''
      const rawHint = err?.hint ? ` (gợi ý: ${err.hint})` : ''
      const fullRaw = `${rawMsg}${rawCode}${rawDetails}${rawHint}`
      const msg = rawMsg.toLowerCase()

      if (msg.includes('does not exist') || msg.includes('could not find the table')) {
        setError(`Chưa có bảng "${SETTINGS_TABLE}" trên Supabase. Vui lòng chạy câu lệnh SQL bên dưới rồi thử lưu lại. Chi tiết lỗi gốc: ${fullRaw}`)
      } else if (msg.includes('row-level security') || msg.includes('permission denied')) {
        setError(`Supabase đang chặn ghi dữ liệu (RLS/quyền truy cập). Chi tiết lỗi gốc: ${fullRaw}`)
      } else {
        setError(fullRaw || 'Lưu Gemini API Key thất bại (không rõ nguyên nhân)')
      }
    } finally {
      setSaving(false)
      setTimeout(() => setSuccess(''), 4000)
    }
  }

  useEscapeKey(onClose, isOpen)

  if (!isOpen) return null

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

                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                  background: configured ? '#dcfce7' : '#fee2e2',
                  color: configured ? '#15803d' : '#b91c1c'
                }}>
                  {configured ? `Đã cấu hình (${masked})` : 'Chưa cấu hình'}
                </span>
              </div>

              <div style={{ position: 'relative' }}>
                <input
                  type={revealed ? 'text' : 'password'}
                  className="input"
                  value={value}
                  onChange={e => setValue(e.target.value)}
                  placeholder={configured ? 'Để trống nếu không muốn đổi giá trị hiện tại' : 'AIza...'}
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
            <span>Lưu trực tiếp vào Supabase, không lưu ở trình duyệt.</span>
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
