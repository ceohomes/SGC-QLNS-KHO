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
  Loader2,
  FolderGit2,
  ExternalLink,
  ShieldCheck
} from 'lucide-react'
import { supabase } from '../supabaseClient'
import useEscapeKey from '../hooks/useEscapeKey'
import { apiUrl } from '../apiBase'

// Tên bảng + id dòng lưu cấu hình trên Supabase
const SETTINGS_TABLE = 'sgc_cai_dat_api'
const GEMINI_KEY_ID = 'GEMINI_API_KEY'
const GITHUB_TOKEN_ID = 'GITHUB_TOKEN'
const GITHUB_REPO_ID = 'GITHUB_REPO'
const GITHUB_BRANCH_ID = 'GITHUB_BRANCH'
const GITHUB_FOLDER_ID = 'GITHUB_CV_FOLDER'

// SQL schema for Supabase live persistence of API keys and configs.
export const SQL_CODE_CAI_DAT_API = `-- -------------------------------------------------------------
-- BẢNG LƯU TRỮ CẤU HÌNH API & GITHUB (sgc_cai_dat_api)
-- Vui lòng chạy đoạn mã này trong SQL Editor của Supabase!
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sgc_cai_dat_api (
    id TEXT PRIMARY KEY,        -- Tên biến, VD: 'GEMINI_API_KEY', 'GITHUB_TOKEN'
    gia_tri TEXT,                -- Giá trị API Key / Token
    ghi_chu TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tắt Row Level Security để giao diện đọc/ghi trực tiếp được
ALTER TABLE sgc_cai_dat_api DISABLE ROW LEVEL SECURITY;

-- Cấp quyền đọc/ghi cho anon và authenticated
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
  const [activeTab, setActiveTab] = useState('gemini') // 'gemini' | 'github'
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testingGh, setTestingGh] = useState(false)
  const [ghTestResult, setGhTestResult] = useState(null)
  const [testingGemini, setTestingGemini] = useState(false)
  const [geminiTestResult, setGeminiTestResult] = useState(null)

  // Gemini state
  const [geminiConfigured, setGeminiConfigured] = useState(false)
  const [geminiMasked, setGeminiMasked] = useState('')
  const [geminiRawVal, setGeminiRawVal] = useState('')
  const [geminiValue, setGeminiValue] = useState('')
  const [geminiRevealed, setGeminiRevealed] = useState(false)

  // GitHub state
  const [ghTokenConfigured, setGhTokenConfigured] = useState(false)
  const [ghTokenMasked, setGhTokenMasked] = useState('')
  const [ghTokenRawVal, setGhTokenRawVal] = useState('')
  const [ghTokenValue, setGhTokenValue] = useState('')
  const [ghTokenRevealed, setGhTokenRevealed] = useState(false)
  const [ghRepo, setGhRepo] = useState('ceohomes/CV-TQT')
  const [ghBranch, setGhBranch] = useState('main')
  const [ghFolder, setGhFolder] = useState('cvs')

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showSql, setShowSql] = useState(false)
  const [showGhGuide, setShowGhGuide] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadAllSettings()
      setGeminiValue('')
      setGhTokenValue('')
      setError('')
      setSuccess('')
      setGhTestResult(null)
      setGeminiTestResult(null)
    }
  }, [isOpen])

  const loadAllSettings = async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error: dbError } = await supabase
        .from(SETTINGS_TABLE)
        .select('id, gia_tri')

      if (dbError) throw dbError

      const map = {}
      ;(data || []).forEach(row => {
        map[row.id] = row.gia_tri || ''
      })

      // Gemini
      const gemVal = map[GEMINI_KEY_ID] || ''
      setGeminiRawVal(gemVal)
      setGeminiConfigured(Boolean(gemVal))
      setGeminiMasked(maskSecret(gemVal))

      // GitHub
      const ghVal = map[GITHUB_TOKEN_ID] || ''
      setGhTokenRawVal(ghVal)
      setGhTokenConfigured(Boolean(ghVal))
      setGhTokenMasked(maskSecret(ghVal))
      if (map[GITHUB_REPO_ID]) setGhRepo(map[GITHUB_REPO_ID])
      if (map[GITHUB_BRANCH_ID]) setGhBranch(map[GITHUB_BRANCH_ID])
      if (map[GITHUB_FOLDER_ID]) setGhFolder(map[GITHUB_FOLDER_ID])
    } catch (err) {
      console.warn('Lỗi tải cấu hình từ Supabase:', err)
      const msg = (err?.message || '').toLowerCase()
      if (msg.includes('does not exist') || msg.includes('could not find the table')) {
        setError(`Chưa có bảng "${SETTINGS_TABLE}" trên Supabase. Vui lòng chạy câu lệnh SQL bên dưới trước.`)
      } else {
        setError('Không thể kết nối Supabase để tải cấu hình. Vui lòng kiểm tra lại kết nối mạng.')
      }
    } finally {
      setLoading(false)
    }
  }

  // Lưu cấu hình Gemini
  const handleSaveGemini = async (e) => {
    e?.preventDefault()
    setError('')
    setSuccess('')

    if (!geminiValue.trim()) {
      setError('Vui lòng nhập Gemini API Key trước khi lưu.')
      return
    }

    setSaving(true)
    try {
      const { error: dbError } = await supabase
        .from(SETTINGS_TABLE)
        .upsert(
          { id: GEMINI_KEY_ID, gia_tri: geminiValue.trim(), updated_at: new Date().toISOString() },
          { onConflict: 'id' }
        )

      if (dbError) throw dbError

      // Đồng bộ sang server nếu có Node server đang chạy
      try {
        await fetch(apiUrl('/api/settings'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ geminiApiKey: geminiValue.trim() })
        })
      } catch (_) {}

      setSuccess('Đã lưu Gemini API Key thành công lên Supabase!')
      setGeminiValue('')
      await loadAllSettings()
    } catch (err) {
      console.error('Lỗi khi lưu Gemini API Key:', err)
      setError(err?.message || 'Lưu Gemini API Key thất bại')
    } finally {
      setSaving(false)
      setTimeout(() => setSuccess(''), 4000)
    }
  }

  // Kiểm tra kết nối Gemini AI trực tiếp từ trình duyệt
  const handleTestGemini = async () => {
    setTestingGemini(true)
    setGeminiTestResult(null)
    setError('')

    const keyToTest = geminiValue.trim() || geminiRawVal || ''
    if (!keyToTest) {
      setError('Vui lòng nhập Gemini API Key để kiểm tra.')
      setTestingGemini(false)
      return
    }

    if (!keyToTest.startsWith('AIzaSy')) {
      setGeminiTestResult({
        success: false,
        message: `Khóa hiện tại không đúng định dạng! Khóa này bắt đầu bằng "${keyToTest.slice(0, 3)}...". Gemini API Key chuẩn từ Google AI Studio bắt buộc phải bắt đầu bằng "AIzaSy..." (39 ký tự). Chuỗi bắt đầu bằng "AQ." là token tài khoản tạm thời, Google sẽ báo lỗi 401 UNAUTHENTICATED.`
      })
      setTestingGemini(false)
      return
    }

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${keyToTest}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'ping' }] }]
        })
      })

      if (res.ok) {
        setGeminiTestResult({
          success: true,
          message: 'Kết nối Google Gemini AI (model gemini-3.6-flash) thành công! Khóa này hoàn toàn hợp lệ và hoạt động trên cả Cloudflare Pages.'
        })
      } else {
        const errJson = await res.json().catch(() => ({}))
        const msg = errJson.error?.message || `Mã lỗi HTTP ${res.status}`
        setGeminiTestResult({
          success: false,
          message: `Google Gemini API từ chối: ${msg}. Vui lòng tạo key mới tại aistudio.google.com/app/apikey.`
        })
      }
    } catch (err) {
      setGeminiTestResult({
        success: false,
        message: 'Không thể kết nối đến máy chủ Google Gemini: ' + (err.message || 'Lỗi mạng')
      })
    } finally {
      setTestingGemini(false)
    }
  }

  // Lưu cấu hình GitHub
  const handleSaveGithub = async (e) => {
    e?.preventDefault()
    setError('')
    setSuccess('')

    if (!ghTokenConfigured && !ghTokenValue.trim()) {
      setError('Vui lòng nhập GitHub Personal Access Token (PAT) trước khi lưu.')
      return
    }

    setSaving(true)
    try {
      const updates = [
        { id: GITHUB_REPO_ID, gia_tri: ghRepo.trim() || 'ceohomes/CV-TQT', updated_at: new Date().toISOString() },
        { id: GITHUB_BRANCH_ID, gia_tri: ghBranch.trim() || 'main', updated_at: new Date().toISOString() },
        { id: GITHUB_FOLDER_ID, gia_tri: ghFolder.trim() || 'cvs', updated_at: new Date().toISOString() }
      ]

      if (ghTokenValue.trim()) {
        updates.push({
          id: GITHUB_TOKEN_ID,
          gia_tri: ghTokenValue.trim(),
          updated_at: new Date().toISOString()
        })
      }

      for (const item of updates) {
        const { error: dbError } = await supabase
          .from(SETTINGS_TABLE)
          .upsert(item, { onConflict: 'id' })
        if (dbError) throw dbError
      }

      // Đồng bộ sang backend server
      try {
        await fetch(apiUrl('/api/settings'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            githubToken: ghTokenValue.trim() || undefined,
            githubRepo: ghRepo.trim(),
            githubBranch: ghBranch.trim(),
            githubFolder: ghFolder.trim()
          })
        })
      } catch (_) {}

      setSuccess('Đã lưu cấu hình kho GitHub CV thành công!')
      setGhTokenValue('')
      await loadAllSettings()
    } catch (err) {
      console.error('Lỗi khi lưu cấu hình GitHub:', err)
      setError(err?.message || 'Lưu cấu hình GitHub thất bại')
    } finally {
      setSaving(false)
      setTimeout(() => setSuccess(''), 4000)
    }
  }

  // Kiểm tra token GitHub
  const handleTestGithub = async () => {
    setTestingGh(true)
    setGhTestResult(null)
    setError('')

    try {
      const res = await fetch(apiUrl('/api/test-github-token'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: ghTokenValue.trim() || undefined,
          repo: ghRepo.trim()
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setGhTestResult({
          success: true,
          message: data.message,
          canPush: data.canPush,
          repo: data.repo
        })
      } else {
        setGhTestResult({
          success: false,
          message: data.error || 'Kiểm tra thất bại. Vui lòng kiểm tra lại Token và quyền hạn repo.'
        })
      }
    } catch (err) {
      // Fallback: Test client-side nếu server backend không phản hồi
      try {
        const activeToken = ghTokenValue.trim()
        if (!activeToken) {
          throw new Error('Vui lòng nhập Token trước khi bấm kiểm tra.')
        }
        const clientRes = await fetch(`https://api.github.com/repos/${ghRepo.trim()}`, {
          headers: {
            Authorization: `Bearer ${activeToken}`,
            Accept: 'application/vnd.github+json'
          }
        })
        if (clientRes.ok) {
          const rData = await clientRes.json()
          const canPush = Boolean(rData.permissions?.push || rData.permissions?.admin)
          setGhTestResult({
            success: true,
            canPush,
            message: canPush
              ? `Kết nối trực tiếp thành công! Token có quyền ghi vào ${rData.full_name}.`
              : `Kết nối được vào ${rData.full_name}, nhưng thiếu quyền ghi (push).`
          })
        } else {
          setGhTestResult({
            success: false,
            message: `GitHub trả về lỗi ${clientRes.status} (${clientRes.statusText}). Token không hợp lệ hoặc không có quyền truy cập kho.`
          })
        }
      } catch (clientErr) {
        setGhTestResult({
          success: false,
          message: clientErr.message || 'Không thể kết nối đến máy chủ GitHub để kiểm tra.'
        })
      }
    } finally {
      setTestingGh(false)
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
        maxWidth: 560,
        maxHeight: '92vh',
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
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>CÀI ĐẶT HỆ THỐNG & API</h3>
              <p style={{ margin: 0, fontSize: 12, opacity: 0.9, marginTop: 2 }}>
                Cấu hình Gemini AI quét CV và kho GitHub lưu trữ tệp CV gốc
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

        {/* Tab switcher */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc',
          padding: '4px 16px 0',
          gap: 6
        }}>
          <button
            type="button"
            onClick={() => { setActiveTab('gemini'); setError(''); setSuccess('') }}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '10px 16px',
              border: 'none',
              borderBottom: activeTab === 'gemini' ? '2.5px solid #0f58a7' : '2.5px solid transparent',
              background: 'none',
              color: activeTab === 'gemini' ? '#0f58a7' : '#64748b',
              fontWeight: activeTab === 'gemini' ? 700 : 600,
              fontSize: 13.5,
              cursor: 'pointer'
            }}
          >
            <Sparkles size={16} color={activeTab === 'gemini' ? '#0f58a7' : '#94a3b8'} />
            <span>Gemini AI (Quét CV)</span>
            <span style={{
              fontSize: 10.5, padding: '1px 6px', borderRadius: 10,
              background: geminiConfigured ? '#dcfce7' : '#fee2e2',
              color: geminiConfigured ? '#15803d' : '#b91c1c',
              fontWeight: 700
            }}>
              {geminiConfigured ? 'Đã bật' : 'Chưa có'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('github'); setError(''); setSuccess('') }}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '10px 16px',
              border: 'none',
              borderBottom: activeTab === 'github' ? '2.5px solid #0f58a7' : '2.5px solid transparent',
              background: 'none',
              color: activeTab === 'github' ? '#0f58a7' : '#64748b',
              fontWeight: activeTab === 'github' ? 700 : 600,
              fontSize: 13.5,
              cursor: 'pointer'
            }}
          >
            <FolderGit2 size={16} color={activeTab === 'github' ? '#0f58a7' : '#94a3b8'} />
            <span>Kho GitHub (Lưu CV gốc)</span>
            <span style={{
              fontSize: 10.5, padding: '1px 6px', borderRadius: 10,
              background: ghTokenConfigured ? '#dcfce7' : '#fee2e2',
              color: ghTokenConfigured ? '#15803d' : '#b91c1c',
              fontWeight: 700
            }}>
              {ghTokenConfigured ? 'Đã bật' : 'Chưa có Token'}
            </span>
          </button>
        </div>

        {/* Thông báo Thành công / Thất bại */}
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

        {/* Nội dung theo Tab */}
        <div style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', fontSize: 13, padding: '20px 0', justifyContent: 'center' }}>
              <Loader2 size={16} className="spin-icon" />
              <span>Đang tải thông tin cấu hình từ Supabase...</span>
            </div>
          ) : activeTab === 'gemini' ? (
            /* TAB 1: GEMINI API */
            <form onSubmit={handleSaveGemini} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={14} color="#0f58a7" />
                    <span>Gemini API Key</span>
                  </label>

                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                    background: geminiConfigured ? '#dcfce7' : '#fee2e2',
                    color: geminiConfigured ? '#15803d' : '#b91c1c'
                  }}>
                    {geminiConfigured ? `Đã cấu hình (${geminiMasked})` : 'Chưa cấu hình'}
                  </span>
                </div>

                <div style={{ position: 'relative' }}>
                  <input
                    type={geminiRevealed ? 'text' : 'password'}
                    value={geminiValue}
                    onChange={e => setGeminiValue(e.target.value)}
                    placeholder={geminiConfigured ? 'Để trống nếu không muốn đổi giá trị hiện tại' : 'AIzaSy...'}
                    style={{
                      width: '100%', height: 40, borderRadius: 8, fontSize: 13.5,
                      fontWeight: 600, paddingRight: 40, paddingLeft: 12,
                      border: '1px solid #cbd5e1', boxSizing: 'border-box'
                    }}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setGeminiRevealed(v => !v)}
                    style={{
                      position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: '#64748b',
                      display: 'flex', alignItems: 'center'
                    }}
                    title={geminiRevealed ? 'Ẩn giá trị' : 'Hiện giá trị'}
                  >
                    {geminiRevealed ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* Cảnh báo định dạng nếu key bắt đầu bằng AQ */}
                {geminiConfigured && geminiRawVal && !geminiRawVal.startsWith('AIzaSy') && (
                  <div style={{
                    marginTop: 10, padding: '8px 12px', background: '#fffbeb',
                    border: '1px solid #fde68a', borderRadius: 8, fontSize: 12,
                    color: '#92400e', lineHeight: 1.5
                  }}>
                    ⚠️ <b>Cảnh báo định dạng API Key:</b> Khóa hiện tại trên Supabase của bạn bắt đầu bằng <code>{geminiRawVal.slice(0, 3)}...</code>. Đây là mã token tài khoản tạm thời, không phải Gemini API Key. Khi gọi Google Gemini sẽ bị lỗi 401 UNAUTHENTICATED. Vui lòng lấy key chuẩn tại <b>aistudio.google.com/app/apikey</b> (bắt đầu bằng <code>AIzaSy...</code>, 39 ký tự) và dán vào đây để lưu lại.
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
                  <p style={{ margin: 0, fontSize: 11.5, color: '#64748b' }}>
                    Key chuẩn bắt đầu bằng <b>AIzaSy...</b>. Dùng để AI tự động trích xuất Họ tên, SĐT, Vị trí, Điểm đánh giá khi tải CV.
                  </p>

                  <button
                    type="button"
                    onClick={handleTestGemini}
                    disabled={testingGemini || (!geminiValue.trim() && !geminiConfigured)}
                    style={{
                      padding: '6px 12px', borderRadius: 6, border: '1px solid #0f58a7',
                      background: '#eff6ff', color: '#0f58a7', fontSize: 12, fontWeight: 700,
                      cursor: (testingGemini || (!geminiValue.trim() && !geminiConfigured)) ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6,
                      opacity: (testingGemini || (!geminiValue.trim() && !geminiConfigured)) ? 0.6 : 1
                    }}
                  >
                    {testingGemini ? <Loader2 size={13} className="spin-icon" /> : <Sparkles size={13} />}
                    <span>{testingGemini ? 'Đang kiểm tra...' : 'Kiểm tra kết nối Gemini AI'}</span>
                  </button>
                </div>

                {/* Kết quả kiểm tra Gemini */}
                {geminiTestResult && (
                  <div style={{
                    marginTop: 10, padding: '10px 12px', borderRadius: 8, fontSize: 12.5,
                    background: geminiTestResult.success ? '#ecfdf5' : '#fef2f2',
                    border: `1px solid ${geminiTestResult.success ? '#10b981' : '#f87171'}`,
                    color: geminiTestResult.success ? '#065f46' : '#991b1b',
                    display: 'flex', alignItems: 'flex-start', gap: 8
                  }}>
                    {geminiTestResult.success ? <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 2 }} /> : <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />}
                    <div style={{ flex: 1, lineHeight: 1.5 }}>
                      <b>{geminiTestResult.success ? 'KẾT NỐI GEMINI THÀNH CÔNG' : 'KẾT NỐI GEMINI THẤT BẠI'}</b>
                      <div style={{ marginTop: 2 }}>{geminiTestResult.message}</div>
                    </div>
                  </div>
                )}
              </div>

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
          ) : (
            /* TAB 2: GITHUB CV STORAGE */
            <form onSubmit={handleSaveGithub} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Giải thích tính năng */}
              <div style={{
                background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10,
                padding: '10px 14px', fontSize: 12, color: '#1e40af', lineHeight: 1.5
              }}>
                <b>💡 Tại sao cần GitHub Token?</b> Để ứng dụng tự động đẩy file PDF gốc lên kho <b>{ghRepo}</b> (thư mục <b>{ghFolder}</b>) và tạo đường link mở trực tiếp mà không bị lỗi 404, GitHub yêu cầu một mã <b>Personal Access Token</b> có quyền ghi (chọn quyền <b>repo</b>).
              </div>

              {/* GitHub Token Input */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <KeyRound size={14} color="#0f58a7" />
                    <span>GitHub Personal Access Token (PAT)</span>
                  </label>

                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                    background: ghTokenConfigured ? '#dcfce7' : '#fee2e2',
                    color: ghTokenConfigured ? '#15803d' : '#b91c1c'
                  }}>
                    {ghTokenConfigured ? `Đã có Token (${ghTokenMasked})` : 'Chưa cấu hình Token'}
                  </span>
                </div>

                <div style={{ position: 'relative' }}>
                  <input
                    type={ghTokenRevealed ? 'text' : 'password'}
                    value={ghTokenValue}
                    onChange={e => setGhTokenValue(e.target.value)}
                    placeholder={ghTokenConfigured ? 'Để trống nếu giữ nguyên mã Token hiện tại' : 'ghp_xxxxxxxxxxxxxxxxxxxx'}
                    style={{
                      width: '100%', height: 40, borderRadius: 8, fontSize: 13.5,
                      fontWeight: 600, paddingRight: 40, paddingLeft: 12,
                      border: '1px solid #cbd5e1', boxSizing: 'border-box'
                    }}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setGhTokenRevealed(v => !v)}
                    style={{
                      position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: '#64748b',
                      display: 'flex', alignItems: 'center'
                    }}
                    title={ghTokenRevealed ? 'Ẩn Token' : 'Hiện Token'}
                  >
                    {ghTokenRevealed ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* Nút test token */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={handleTestGithub}
                    disabled={testingGh || (!ghTokenConfigured && !ghTokenValue.trim())}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '5px 12px', borderRadius: 6,
                      background: '#0f58a7', color: '#ffffff',
                      border: 'none', fontSize: 12, fontWeight: 600,
                      cursor: (testingGh || (!ghTokenConfigured && !ghTokenValue.trim())) ? 'not-allowed' : 'pointer',
                      opacity: (testingGh || (!ghTokenConfigured && !ghTokenValue.trim())) ? 0.6 : 1
                    }}
                  >
                    {testingGh ? <Loader2 size={13} className="spin-icon" /> : <ShieldCheck size={13} />}
                    <span>{testingGh ? 'Đang kiểm tra kết nối...' : 'Kiểm tra quyền ghi vào kho'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowGhGuide(v => !v)}
                    style={{
                      background: 'none', border: 'none', color: '#0f58a7',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline'
                    }}
                  >
                    {showGhGuide ? 'Ẩn hướng dẫn tạo Token' : 'Xem cách lấy Token trên GitHub'}
                  </button>
                </div>

                {/* Kết quả kiểm tra */}
                {ghTestResult && (
                  <div style={{
                    marginTop: 10, padding: '8px 12px', borderRadius: 6, fontSize: 12,
                    background: ghTestResult.success && ghTestResult.canPush ? '#f0fdf4' : '#fef2f2',
                    border: `1px solid ${ghTestResult.success && ghTestResult.canPush ? '#86efac' : '#fca5a5'}`,
                    color: ghTestResult.success && ghTestResult.canPush ? '#15803d' : '#b91c1c'
                  }}>
                    {ghTestResult.message}
                  </div>
                )}
              </div>

              {/* Hướng dẫn tạo GitHub Token */}
              {showGhGuide && (
                <div style={{
                  background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 10,
                  padding: '12px 16px', fontSize: 12, color: '#334155', lineHeight: 1.6
                }}>
                  <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>5 BƯỚC TẠO GITHUB TOKEN (CHỈ MẤT 1 PHÚT):</span>
                    <a
                      href="https://github.com/settings/tokens/new"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#0f58a7', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: 11.5 }}
                    >
                      <span>Mở trang tạo Token</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                  <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <li>Đăng nhập GitHub tài khoản <b>ceohomes</b>, vào <b>Settings &rsaquo; Developer Settings &rsaquo; Personal Access Tokens &rsaquo; Tokens (classic)</b>.</li>
                    <li>Bấm nút <b>Generate new token (classic)</b>.</li>
                    <li>Ở ô <b>Note</b>: nhập <i>SGC-CV-Storage</i> (chọn Expiration ví dụ: <i>No expiration</i> hoặc <i>90 days</i>).</li>
                    <li><b>QUAN TRỌNG:</b> Tích chọn ô vuông <b><code>repo</code></b> (Full control of private/public repositories) để cho phép app lưu file PDF vào thư mục <code>cvs</code>.</li>
                    <li>Cuộn xuống dưới cùng bấm <b>Generate token</b>, copy mã <code>ghp_...</code> và dán vào ô bên trên.</li>
                  </ol>
                </div>
              )}

              {/* Thông tin Repository & Branch & Folder */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Kho lưu trữ (Repository)
                  </label>
                  <input
                    type="text"
                    value={ghRepo}
                    onChange={e => setGhRepo(e.target.value)}
                    placeholder="ceohomes/CV-TQT"
                    style={{ width: '100%', height: 36, borderRadius: 6, border: '1px solid #cbd5e1', padding: '0 10px', fontSize: 13 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Nhánh (Branch)
                  </label>
                  <input
                    type="text"
                    value={ghBranch}
                    onChange={e => setGhBranch(e.target.value)}
                    placeholder="main"
                    style={{ width: '100%', height: 36, borderRadius: 6, border: '1px solid #cbd5e1', padding: '0 10px', fontSize: 13 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                  Thư mục lưu trữ CV
                </label>
                <input
                  type="text"
                  value={ghFolder}
                  onChange={e => setGhFolder(e.target.value)}
                  placeholder="cvs"
                  style={{ width: '100%', height: 36, borderRadius: 6, border: '1px solid #cbd5e1', padding: '0 10px', fontSize: 13 }}
                />
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12
        }}>
          <div style={{ fontSize: 11.5, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Info size={13} />
            <span>Được lưu an toàn trực tiếp vào Supabase.</span>
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
              onClick={activeTab === 'gemini' ? handleSaveGemini : handleSaveGithub}
              disabled={saving || loading}
              style={{
                padding: '8px 18px', background: '#0f58a7', color: '#ffffff',
                border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13,
                cursor: (saving || loading) ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 6, opacity: (saving || loading) ? 0.7 : 1
              }}
            >
              {saving ? <Loader2 size={15} className="spin-icon" /> : <Check size={15} />}
              <span>{saving ? 'Đang lưu...' : (activeTab === 'gemini' ? 'Lưu Gemini API Key' : 'Lưu Cấu Hình GitHub')}</span>
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

