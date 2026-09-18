import React, { useState, useEffect, useRef } from 'react'
import { 
  ZoomIn, ZoomOut, RotateCw, 
  Download, Printer, ExternalLink, Upload, RefreshCw, 
  FileText, AlertCircle, CheckCircle2, Sparkles, Eye,
  CloudUpload, ShieldAlert
} from 'lucide-react'
import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url'
import { blobToArrayBuffer, renderCandidateCvToCanvas, getCandidatePdf } from '../pdfStorage.js'
import { apiUrl } from '../apiBase'
import { supabase } from '../supabaseClient'

// Convert Blob / File to Base64
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    if (typeof blob === 'string') return resolve(blob)
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// Configure worker URL
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

// Subcomponent: Render an individual PDF page onto its own high-DPI canvas
function PdfPageItem({ pdfDoc, pageNum, zoom, rotation, registerCanvas }) {
  const canvasRef = useRef(null)
  const renderTaskRef = useRef(null)
  const [isRendering, setIsRendering] = useState(true)

  useEffect(() => {
    let active = true

    async function renderPage() {
      if (!pdfDoc || !canvasRef.current) return
      try {
        setIsRendering(true)
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel()
          } catch {
            // ignore
          }
        }

        const page = await pdfDoc.getPage(pageNum)
        if (!active) return

        const canvas = canvasRef.current
        if (!canvas) return
        const context = canvas.getContext('2d', { alpha: false })
        if (!context) return

        const pixelRatio = window.devicePixelRatio || 1
        const scaleFactor = (zoom / 100) * 1.35 * pixelRatio

        const viewport = page.getViewport({ scale: scaleFactor, rotation })

        canvas.width = viewport.width
        canvas.height = viewport.height
        canvas.style.width = `${viewport.width / pixelRatio}px`
        canvas.style.height = `${viewport.height / pixelRatio}px`

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        }

        const task = page.render(renderContext)
        renderTaskRef.current = task
        await task.promise

        if (active) {
          setIsRendering(false)
          if (registerCanvas) {
            registerCanvas(pageNum, canvas)
          }
        }
      } catch (err) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn(`Lỗi render trang ${pageNum}:`, err)
        }
      }
    }

    renderPage()

    return () => {
      active = false
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel()
        } catch {
          // ignore
        }
      }
    }
  }, [pdfDoc, pageNum, zoom, rotation])

  return (
    <div
      id={`pdf-page-${pageNum}`}
      style={{
        position: 'relative',
        borderRadius: 4,
        overflow: 'hidden',
        boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
        background: '#ffffff',
        lineHeight: 0,
        transition: 'transform 0.15s ease'
      }}
    >
      {/* Floating page label */}
      <div style={{
        position: 'absolute',
        top: 10,
        right: 12,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        color: '#ffffff',
        fontSize: 11,
        fontWeight: 700,
        padding: '2px 8px',
        borderRadius: 12,
        zIndex: 2,
        pointerEvents: 'none',
        boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
      }}>
        Trang {pageNum}
      </div>

      <canvas ref={canvasRef} style={{ display: 'block' }} />
    </div>
  )
}

export default function CandidatePdfViewer({
  candidate,
  pdfBlob,
  isLoading,
  onUploadNewPdf,
  onDownload,
  onPrint,
  onUpdateCandidate
}) {
  const [numPages, setNumPages] = useState(1)
  const [zoom, setZoom] = useState(100)
  const [rotation, setRotation] = useState(0)
  const [viewMode, setViewMode] = useState('canvas') // 'canvas' | 'embed' | 'digital'
  const [isRenderingPdf, setIsRenderingPdf] = useState(true)
  const [pdfDoc, setPdfDoc] = useState(null)
  const [renderError, setRenderError] = useState(null)
  const [fallbackImgUrl, setFallbackImgUrl] = useState(null)
  const [fallbackImgUrlP2, setFallbackImgUrlP2] = useState(null)

  const [uploadingToGh, setUploadingToGh] = useState(false)
  const [ghUploadError, setGhUploadError] = useState('')
  const [ghUploadSuccess, setGhUploadSuccess] = useState('')

  const fileInputRef = useRef(null)
  const containerRef = useRef(null)
  const pageCanvasesRef = useRef({})

  // Xác định CHÍNH XÁC tệp đã thực sự được lưu trên kho GitHub (ceohomes/CV-TQT/cvs) hay chưa
  // Tránh giả định mọi file .pdf đều là file đã có trên GitHub, dẫn tới sinh link 404
  const isGitHubBacked = Boolean(
    (candidate?.githubUrl && String(candidate.githubUrl).trim().length > 0) ||
    (candidate?.fileUrl && (String(candidate.fileUrl).includes('github') || String(candidate.fileUrl).includes('raw.githubusercontent.com'))) ||
    (candidate?.fileName && /^\d{13}_/.test(candidate.fileName))
  )

  const ghProxyUrl = (isGitHubBacked && candidate?.fileName)
    ? apiUrl(`/api/github-cv-file?file=${encodeURIComponent(candidate.fileName)}`)
    : ((isGitHubBacked && candidate?.fileUrl) ? apiUrl(`/api/github-cv-file?url=${encodeURIComponent(candidate.fileUrl)}`) : '')

  const ghRawUrl = (candidate?.fileUrl && candidate.fileUrl.includes('github'))
    ? candidate.fileUrl
    : (isGitHubBacked && candidate?.fileName ? `https://raw.githubusercontent.com/ceohomes/CV-TQT/main/cvs/${candidate.fileName}` : '')

  // Chỉ tạo link Web tới file trên GitHub khi file thực sự đã được commit lên GitHub
  const ghWebUrl = (candidate?.githubUrl && candidate.githubUrl.trim().length > 0)
    ? candidate.githubUrl
    : (isGitHubBacked && candidate?.fileName ? `https://github.com/ceohomes/CV-TQT/blob/main/cvs/${candidate.fileName}` : '')

  // Hàm thủ công hoặc tự động đẩy CV lên GitHub repo
  const handleUploadToGitHub = async () => {
    if (uploadingToGh) return
    setUploadingToGh(true)
    setGhUploadError('')
    setGhUploadSuccess('')

    try {
      let base64 = candidate?.fileDataUrl || ''
      if (!base64 && pdfBlob) {
        base64 = await blobToBase64(pdfBlob)
      }
      if (!base64 && candidate?.id) {
        base64 = (await getCandidatePdf(candidate.id)) || ''
      }

      if (!base64) {
        throw new Error('Không tìm thấy dữ liệu tệp PDF để đẩy lên GitHub. Vui lòng bấm "Chọn tệp" để tải tệp PDF.')
      }

      const res = await fetch(apiUrl('/api/upload-cv-github'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: candidate.fileName || 'CV_UngVien.pdf',
          base64Data: base64,
          candidateName: candidate.hoTen
        })
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        if (data.needsToken) {
          throw new Error('Chưa cấu hình GitHub Token! Vui lòng vào "Cài đặt Hệ thống & API" ở góc trên màn hình, mở tab "Kho GitHub" và nhập Personal Access Token có chọn quyền "repo".')
        }
        if (res.status === 401 || (data.details && data.details.includes('Bad credentials')) || (data.error && data.error.includes('401'))) {
          throw new Error('Token GitHub bị từ chối (401 Bad credentials)! Token này đã bị GitHub tự động thu hồi (do lộ ra ngoài) hoặc hết hạn. Vui lòng tạo Token mới trên GitHub và lưu vào "Cài đặt Hệ thống & API".')
        }
        throw new Error(data.error || 'Lỗi khi tải tệp lên kho GitHub.')
      }

      // Cập nhật thông tin ứng viên
      const updatedCandidate = {
        ...candidate,
        fileName: data.fileName,
        fileUrl: data.downloadUrl,
        githubUrl: data.htmlUrl,
        fileDataUrl: base64
      }

      if (candidate.id) {
        try {
          await supabase
            .from('sgc_ung_vien')
            .update({
              file_name: data.fileName,
              file_url: data.downloadUrl,
              github_url: data.htmlUrl,
              updated_at: new Date().toISOString()
            })
            .eq('id', candidate.id)
        } catch (dbErr) {
          console.warn('Lỗi cập nhật Supabase sau khi upload GitHub:', dbErr)
        }
      }

      if (onUpdateCandidate) {
        onUpdateCandidate(updatedCandidate)
      }

      setGhUploadSuccess('Đã lưu CV lên kho GitHub thành công!')
      setTimeout(() => setGhUploadSuccess(''), 5000)
    } catch (err) {
      console.error('Lỗi upload lên GitHub:', err)
      setGhUploadError(err.message || 'Không thể tải CV lên GitHub')
    } finally {
      setUploadingToGh(false)
    }
  }

  // 1. Tải và phân giải tệp PDF gốc từ GitHub (hoặc pdfBlob)
  // Ưu tiên TUYỆT ĐỐI theo yêu cầu: View này LUÔN LUÔN là file lưu trên GitHub
  useEffect(() => {
    let active = true
    setPdfDoc(null)
    setRenderError(null)
    pageCanvasesRef.current = {}
    setIsRenderingPdf(true)
    setFallbackImgUrl(null)
    setFallbackImgUrlP2(null)

    async function loadPdfDocument() {
      try {
        let arrayBuffer = null

        // 1. Ưu tiên số 1: Tải tệp thật từ GitHub qua API proxy nội bộ
        if (ghProxyUrl) {
          try {
            const resp = await fetch(ghProxyUrl)
            if (resp.ok) {
              const ab = await resp.arrayBuffer()
              if (ab && ab.byteLength > 200) {
                arrayBuffer = ab
              }
            }
          } catch (errProxy) {
            console.warn('Proxy fetch warning, fallback to raw:', errProxy)
          }
        }

        // 2. Ưu tiên số 2: Tải từ GitHub Raw URL nếu proxy không thành công
        if (!arrayBuffer && ghRawUrl) {
          try {
            const respRaw = await fetch(ghRawUrl)
            if (respRaw.ok) {
              const ab = await respRaw.arrayBuffer()
              if (ab && ab.byteLength > 200) {
                arrayBuffer = ab
              }
            }
          } catch (errRaw) {
            console.warn('Raw fetch warning:', errRaw)
          }
        }

        // 3. Ưu tiên số 3: Tải từ pdfBlob truyền từ component cha
        if (!arrayBuffer && pdfBlob) {
          arrayBuffer = await blobToArrayBuffer(pdfBlob)
        } else if (!arrayBuffer && candidate.fileDataUrl) {
          if (candidate.fileDataUrl.startsWith('data:image/')) {
            setFallbackImgUrl(candidate.fileDataUrl)
            setIsRenderingPdf(false)
            return
          }
          arrayBuffer = await blobToArrayBuffer(candidate.fileDataUrl)
        }

        if (!arrayBuffer) {
          if (active) {
            setIsRenderingPdf(false)
            // Trường hợp không có CV thì để trống, không tự động sinh hồ sơ giả lập
            setFallbackImgUrl(null)
            setFallbackImgUrlP2(null)
            setPdfDoc(null)
          }
          return
        }

        // Khởi tạo và nạp vào PDF.js
        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(arrayBuffer),
          cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/cmaps/',
          cMapPacked: true,
        })

        const doc = await loadingTask.promise
        if (active) {
          setPdfDoc(doc)
          setNumPages(doc.numPages || 1)
          setIsRenderingPdf(false)
        }
      } catch (err) {
        console.warn('Lỗi phân giải tệp PDF từ GitHub:', err)
        if (active) {
          setRenderError(err.message || 'Không thể hiển thị PDF qua PDF.js')
          setIsRenderingPdf(false)
        }
      }
    }

    loadPdfDocument()

    return () => {
      active = false
    }
  }, [candidate.id, candidate.fileName, candidate.fileUrl, ghProxyUrl, ghRawUrl, pdfBlob])

  // Print handler - in toàn bộ các trang PDF gốc đã render
  const handlePrint = () => {
    if (onPrint) {
      onPrint()
      return
    }

    const canvases = Object.values(pageCanvasesRef.current).filter(Boolean)
    if (canvases.length > 0) {
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        const pagesHtml = canvases.map(c => `
          <div style="page-break-after: always; display: flex; justify-content: center; margin-bottom: 20px;">
            <img src="${c.toDataURL('image/png')}" style="width: 100%; max-width: 210mm; height: auto; display: block;" />
          </div>
        `).join('')
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>In hồ sơ - ${candidate.hoTen}</title>
              <style>
                @page { size: A4; margin: 0; }
                body { margin: 0; padding: 0; background: #fff; }
              </style>
            </head>
            <body>
              ${pagesHtml}
            </body>
          </html>
        `)
        printWindow.document.close()
        printWindow.onload = () => {
          printWindow.print()
        }
        return
      }
    }

    if (ghProxyUrl) {
      const printWin = window.open(ghProxyUrl, '_blank')
      if (printWin) {
        printWin.onload = () => printWin.print()
        return
      }
    }

    if (pdfBlob) {
      const blobUrl = URL.createObjectURL(pdfBlob)
      const printWin = window.open(blobUrl, '_blank')
      if (printWin) {
        printWin.onload = () => printWin.print()
        return
      }
    }

    window.print()
  }

  // Open in new tab handler - Mở trực tiếp tệp gốc từ GitHub
  const handleOpenNewTab = () => {
    if (ghProxyUrl) {
      window.open(ghProxyUrl, '_blank')
      return
    }
    if (ghRawUrl) {
      window.open(ghRawUrl, '_blank')
      return
    }
    if (pdfBlob) {
      const url = URL.createObjectURL(pdfBlob)
      window.open(url, '_blank')
      return
    }
  }

  // Tải tệp PDF gốc từ GitHub về máy tính
  const handleDirectDownload = () => {
    if (onDownload) {
      onDownload()
      return
    }
    const downloadUrl = ghProxyUrl || ghRawUrl
    if (downloadUrl) {
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = candidate.fileName || `${candidate.hoTen}_CV.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      return
    }
    if (pdfBlob) {
      const url = URL.createObjectURL(pdfBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = candidate.fileName || `${candidate.hoTen}_CV.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const hasActualCv = Boolean(pdfDoc || fallbackImgUrl || pdfBlob || candidate.fileDataUrl)

  return (
    <div style={{
      flex: '1.2 1 0',
      minWidth: 460,
      display: 'flex',
      flexDirection: 'column',
      background: '#1e293b',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Top Toolbar */}
      <div style={{
        height: 52,
        background: '#0f172a',
        borderBottom: '1px solid #334155',
        padding: '0 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        color: '#e2e8f0',
        fontSize: 12,
        flexShrink: 0,
        gap: 8,
        overflowX: 'auto'
      }}>
        {/* Left: File Badge, Name & GitHub Storage Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{
            background: hasActualCv ? '#ef4444' : '#64748b', color: '#ffffff', padding: '3px 7px',
            borderRadius: 4, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.05em'
          }}>
            PDF
          </div>
          <span style={{ 
            fontWeight: 700, 
            color: hasActualCv ? '#f8fafc' : '#94a3b8', 
            whiteSpace: 'nowrap', 
            textOverflow: 'ellipsis', 
            overflow: 'hidden', 
            maxWidth: 190,
            fontSize: 12.5
          }} title={hasActualCv ? (candidate.fileName || 'CV.pdf') : 'Chưa có CV'}>
            {hasActualCv ? (candidate.fileName || 'CV.pdf') : '(Chưa có CV)'}
          </span>

          {/* GitHub Cloud Storage Indicator */}
          {hasActualCv && isGitHubBacked ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ 
                color: '#4ade80', 
                fontSize: 11, 
                background: 'rgba(34, 197, 94, 0.15)', 
                border: '1px solid rgba(34, 197, 94, 0.35)',
                padding: '2px 8px', 
                borderRadius: 4, 
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                whiteSpace: 'nowrap'
              }}>
                <span>🐙 File lưu trên GitHub</span>
              </span>
              {ghWebUrl && (
                <a
                  href={ghWebUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    color: '#38bdf8', fontSize: 11,
                    background: 'rgba(56, 189, 248, 0.12)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    padding: '2px 7px', borderRadius: 4,
                    fontWeight: 600, textDecoration: 'none',
                    whiteSpace: 'nowrap'
                  }}
                  title="Mở tệp CV trên kho GitHub (ceohomes/CV-TQT/cvs)"
                >
                  <span>Kho GitHub</span>
                  <ExternalLink size={10} />
                </a>
              )}
            </div>
          ) : hasActualCv ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ 
                color: '#f59e0b', 
                fontSize: 11, 
                background: 'rgba(245, 158, 11, 0.15)', 
                border: '1px solid rgba(245, 158, 11, 0.35)',
                padding: '2px 8px', 
                borderRadius: 4, 
                fontWeight: 600,
                whiteSpace: 'nowrap'
              }}>
                📁 Tệp cục bộ
              </span>
              <button
                type="button"
                onClick={handleUploadToGitHub}
                disabled={uploadingToGh}
                title="Tải tệp này lên kho GitHub ceohomes/CV-TQT để lưu trữ lâu dài"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  background: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: uploadingToGh ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                  opacity: uploadingToGh ? 0.7 : 1
                }}
              >
                {uploadingToGh ? <RefreshCw size={11} className="animate-spin" /> : <CloudUpload size={11} />}
                <span>{uploadingToGh ? 'Đang đẩy...' : 'Đẩy lên GitHub'}</span>
              </button>
            </div>
          ) : null}
        </div>

        {/* Thông báo kết quả upload GitHub nếu có */}
        {ghUploadSuccess && (
          <div style={{
            position: 'absolute', top: 52, left: 16, zIndex: 10,
            background: '#10b981', color: '#ffffff', padding: '6px 12px',
            borderRadius: 6, fontSize: 12, fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 6,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
          }}>
            <CheckCircle2 size={14} />
            <span>{ghUploadSuccess}</span>
          </div>
        )}

        {ghUploadError && (
          <div style={{
            position: 'absolute', top: 52, left: 16, zIndex: 10, maxWidth: 450,
            background: '#ef4444', color: '#ffffff', padding: '6px 12px',
            borderRadius: 6, fontSize: 12, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 6,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
          }}>
            <AlertCircle size={14} style={{ flexShrink: 0 }} />
            <span>{ghUploadError}</span>
            <button
              type="button"
              onClick={() => setGhUploadError('')}
              style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', padding: 0, marginLeft: 6, fontWeight: 800 }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Center: View Mode Switcher + Zoom & Rotate Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {hasActualCv && (
            <>
              {/* Zoom Buttons (only for canvas or digital mode) */}
              {viewMode !== 'embed' && (
                <div style={{ display: 'flex', alignItems: 'center', background: '#1e293b', borderRadius: 6, border: '1px solid #334155' }}>
                  <button
                    type="button"
                    onClick={() => setZoom(prev => Math.max(prev - 10, 60))}
                    title="Thu nhỏ"
                    style={{ background: 'none', border: 'none', color: '#94a3b8', padding: '4px 7px', cursor: 'pointer' }}
                  >
                    <ZoomOut size={13} />
                  </button>
                  <span 
                    onClick={() => setZoom(100)} 
                    title="Bấm để về 100%" 
                    style={{ fontSize: 11.5, fontWeight: 700, color: '#cbd5e1', minWidth: 38, textAlign: 'center', cursor: 'pointer' }}
                  >
                    {zoom}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoom(prev => Math.min(prev + 10, 160))}
                    title="Phóng to"
                    style={{ background: 'none', border: 'none', color: '#94a3b8', padding: '4px 7px', cursor: 'pointer' }}
                  >
                    <ZoomIn size={13} />
                  </button>
                </div>
              )}

              {/* Rotate Button */}
              {viewMode === 'canvas' && (
                <button
                  type="button"
                  onClick={() => setRotation(r => (r + 90) % 360)}
                  title="Xoay trang 90°"
                  style={{
                    background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1',
                    padding: '4px 8px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center'
                  }}
                >
                  <RotateCw size={13} />
                </button>
              )}
            </>
          )}
        </div>

        {/* Right: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {/* Upload new local PDF */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/*"
            onChange={onUploadNewPdf}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Chọn tệp PDF khác để tải lên và lưu vào GitHub"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: '#334155', border: '1px solid #475569',
              color: '#f1f5f9', padding: '5px 9px', borderRadius: 6,
              fontSize: 11.5, fontWeight: 600, cursor: 'pointer'
            }}
          >
            <Upload size={13} />
            <span style={{ display: 'inline' }}>Chọn tệp</span>
          </button>

          {hasActualCv && (
            <>
              {/* Open in new tab */}
              <button
                type="button"
                onClick={handleOpenNewTab}
                title="Mở toàn màn hình tệp gốc từ GitHub trong tab mới"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: '#334155', border: '1px solid #475569',
                  color: '#f1f5f9', padding: '5px 9px', borderRadius: 6,
                  fontSize: 11.5, fontWeight: 600, cursor: 'pointer'
                }}
              >
                <ExternalLink size={13} />
                <span>Tab mới</span>
              </button>

              {/* Print */}
              <button
                type="button"
                onClick={handlePrint}
                title="In / Xuất PDF tài liệu gốc"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: '#334155', border: '1px solid #475569',
                  color: '#f1f5f9', padding: '5px 9px', borderRadius: 6,
                  fontSize: 11.5, fontWeight: 600, cursor: 'pointer'
                }}
              >
                <Printer size={13} />
                <span>In</span>
              </button>

              {/* Download */}
              <button
                type="button"
                onClick={handleDirectDownload}
                title="Tải tệp PDF gốc lưu trên GitHub về máy"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: '#2563eb', border: 'none',
                  color: '#ffffff', padding: '5px 12px', borderRadius: 6,
                  fontSize: 11.5, fontWeight: 700, cursor: 'pointer'
                }}
              >
                <Download size={13} />
                <span>Tải về</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Viewport Content */}
      <div 
        ref={containerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'auto',
          background: '#334155',
          padding: viewMode === 'embed' ? 0 : '24px 16px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          position: 'relative'
        }}
      >
        {viewMode === 'embed' ? (
          /* ================= NATIVE BROWSER EMBEDDED IFRAME (DIRECT FROM GITHUB) ================= */
          <div style={{ width: '100%', height: '100%', minHeight: '100%', display: 'flex', flex: 1 }}>
            <iframe
              src={ghProxyUrl || ghRawUrl}
              title="Tệp PDF gốc lưu trên GitHub"
              style={{
                width: '100%',
                height: '100%',
                minHeight: 'calc(88vh - 120px)',
                border: 'none',
                background: '#1e293b'
              }}
            />
          </div>
        ) : (isLoading || isRenderingPdf) ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '120px 20px', color: '#94a3b8', gap: 16
          }}>
            <RefreshCw size={36} className="animate-spin" color="#10b981" />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 15.5, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>
                Đang nạp tệp PDF...
              </div>
            </div>
          </div>
        ) : !hasActualCv ? (
          /* Trường hợp không có CV thì để trống */
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            minHeight: 450,
            padding: '60px 24px',
            color: '#94a3b8',
            textAlign: 'center'
          }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(15, 23, 42, 0.4)',
              border: '1px dashed #64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16
            }}>
              <FileText size={26} color="#64748b" />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>
              Chưa có file CV đính kèm
            </div>
            <div style={{ fontSize: 12.5, color: '#94a3b8', maxWidth: 320, marginBottom: 20, lineHeight: 1.5 }}>
              Hồ sơ ứng viên này chưa có tệp CV đính kèm. Bạn có thể bấm nút bên dưới để chọn tải tệp PDF lên.
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 18px',
                borderRadius: 8,
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)'
              }}
            >
              <Upload size={14} />
              <span>Tải lên tệp CV (PDF)</span>
            </button>
          </div>
        ) : viewMode === 'digital' ? (
          /* ================= DIGITAL A4 VIEW ================= */
          <div style={{
            width: `${Math.min(zoom, 160)}%`,
            maxWidth: 820,
            background: '#ffffff',
            borderRadius: 6,
            boxShadow: '0 15px 35px rgba(0,0,0,0.45)',
            padding: '40px 48px',
            color: '#1e293b',
            fontFamily: "'Roboto', sans-serif",
            lineHeight: 1.6,
            margin: '0 auto'
          }}>
            {/* SGC Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderBottom: '2px solid #0f58a7', paddingBottom: 14, marginBottom: 20
            }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#0f58a7' }}>{candidate.hoTen.toUpperCase()}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#475569', marginTop: 2 }}>
                  VỊ TRÍ ỨNG TUYỂN: {candidate.chucVu.toUpperCase()}
                </div>
              </div>
              <div style={{
                background: '#0f58a7', color: '#ffffff', padding: '6px 14px', borderRadius: 6,
                fontSize: 12, fontWeight: 800, letterSpacing: '0.05em'
              }}>
                SGC GROUP
              </div>
            </div>

            {/* Contact Details 2-Column Grid */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12,
              background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8,
              padding: 16, marginBottom: 24, fontSize: 13.5
            }}>
              <div>Điện thoại: <b>{candidate.soDienThoai}</b></div>
              <div>Email: <b>{candidate.email}</b></div>
              <div>Ngày sinh: <b>{candidate.ngaySinh || '—'}</b> {(() => {
                const displayAge = candidate.tuoi || (() => {
                  if (!candidate.ngaySinh) return null
                  const parts = String(candidate.ngaySinh).trim().split(/[-/]/)
                  let birthYear = null
                  if (parts.length === 3) {
                    if (parts[2].length === 4) birthYear = parseInt(parts[2], 10)
                    else if (parts[0].length === 4) birthYear = parseInt(parts[0], 10)
                  } else if (parts[1] && parts[1].length === 4) {
                    birthYear = parseInt(parts[1], 10)
                  }
                  if (birthYear && !isNaN(birthYear)) return new Date().getFullYear() - birthYear
                  return null
                })()
                return displayAge ? `(${displayAge} tuổi)` : ''
              })()}</div>
              <div>Giới tính: <b>{candidate.gioiTinh || 'Nam'}</b></div>
              <div>Quê quán: <b>{candidate.queQuan || '—'}</b></div>
              <div>Địa chỉ: <b>{candidate.diaChi || '—'}</b></div>
            </div>

            {/* Section I */}
            <div style={{ marginBottom: 20 }}>
              <div style={{
                fontSize: 14.5, fontWeight: 800, color: '#0f58a7', borderBottom: '1px solid #cbd5e1',
                paddingBottom: 4, marginBottom: 8
              }}>
                I. MỤC TIÊU NGHỀ NGHIỆP
              </div>
              <p style={{ margin: 0, fontSize: 13.5, color: '#334155' }}>
                Ứng tuyển vị trí <b>{candidate.chucVu}</b> tại dự án <b>{candidate.duAn || 'Công trình xây dựng SGC'}</b>. 
                Mong muốn phát huy tối đa kinh nghiệm quản lý kho bãi công trình, kiểm soát hao hụt vật tư thép, xi măng, giàn giáo, tuân thủ tuyệt đối quy trình an toàn lao động và bảo đảm cấp phát tiến độ công trình.
              </p>
            </div>

            {/* Section II */}
            <div style={{ marginBottom: 20 }}>
              <div style={{
                fontSize: 14.5, fontWeight: 800, color: '#0f58a7', borderBottom: '1px solid #cbd5e1',
                paddingBottom: 4, marginBottom: 8
              }}>
                II. KINH NGHIỆM LÀM VIỆC & DỰ ÁN ĐÃ THAM GIA
              </div>
              <p style={{ margin: 0, fontSize: 13.5, color: '#334155' }}>
                {candidate.kinhNghiem || `Có ${candidate.soNamKinhNghiem} năm kinh nghiệm làm việc thực tế tại các công trình xây dựng, phụ trách kiểm soát xuất nhập tồn, đối soát vật tư với nhà cung cấp và đội thi công.`}
              </p>
            </div>

            {/* Section III */}
            <div style={{ marginBottom: 20 }}>
              <div style={{
                fontSize: 14.5, fontWeight: 800, color: '#0f58a7', borderBottom: '1px solid #cbd5e1',
                paddingBottom: 4, marginBottom: 8
              }}>
                III. TRÌNH ĐỘ HỌC VẤN & BẰNG CẤP CHUYÊN MÔN
              </div>
              <div style={{ fontSize: 13.5, color: '#334155', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div>• Trình độ: <b>{candidate.trinhDo}</b> - Chuyên ngành: <b>{candidate.chuyenNganh || 'Quản lý kho / Kế toán'}</b></div>
                <div>• Chứng chỉ nghiệp vụ: <b>{candidate.chungChi || 'Bằng chuyên ngành, ATLĐ Nhóm 3'}</b></div>
              </div>
            </div>

            {/* Section IV */}
            <div style={{ marginBottom: 20 }}>
              <div style={{
                fontSize: 14.5, fontWeight: 800, color: '#0f58a7', borderBottom: '1px solid #cbd5e1',
                paddingBottom: 4, marginBottom: 8
              }}>
                IV. KỸ NĂNG CHUYÊN MÔN
              </div>
              <p style={{ margin: 0, fontSize: 13.5, color: '#334155' }}>
                {candidate.kyNang || 'Phần mềm kế toán, Excel công trình, kiểm kê kho bãi, lái xe nâng, phân bổ vật tư.'}
              </p>
            </div>

            {/* Section V */}
            {candidate.aiDanhGia && (
              <div style={{ marginBottom: 20, background: '#f5f3ff', border: '1px solid #ddd6fe', padding: 14, borderRadius: 8 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: '#6d28d9', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={16} /> ĐÁNH GIÁ CỦA HỆ THỐNG (AI EVALUATION)
                </div>
                <div style={{ fontSize: 13, color: '#4c1d95' }}>
                  {candidate.aiDanhGia}
                </div>
              </div>
            )}

            {/* Footer */}
            <div style={{
              borderTop: '1px solid #e2e8f0', paddingTop: 14, marginTop: 30,
              fontSize: 11.5, color: '#94a3b8', textAlign: 'center'
            }}>
              Hồ sơ ứng viên tuyển dụng SGC Construction • Tệp: {candidate.fileName || 'CV.pdf'}
            </div>
          </div>
        ) : (
          /* ================= CANVAS PDF / HIGH-DPI VIEWER ================= */
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            width: '100%',
            minHeight: '100%'
          }}>
            {pdfDoc ? (
              /* Rendered via PDF.js - Hiển thị tất cả các trang theo dạng cuộn kéo từ trên xuống dưới */
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 20,
                width: '100%',
                paddingBottom: 40
              }}>
                {Array.from({ length: numPages }, (_, idx) => idx + 1).map(pageNum => (
                  <PdfPageItem
                    key={pageNum}
                    pdfDoc={pdfDoc}
                    pageNum={pageNum}
                    zoom={zoom}
                    rotation={rotation}
                    registerCanvas={(p, c) => {
                      pageCanvasesRef.current[p] = c
                    }}
                  />
                ))}
              </div>
            ) : fallbackImgUrl ? (
              /* Rendered via Direct High-Res Canvas CV Image (2 Pages) */
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 20,
                width: '100%',
                paddingBottom: 40
              }}>
                {/* Page 1 */}
                <div style={{
                  width: `${Math.min(zoom, 160)}%`,
                  maxWidth: 860,
                  borderRadius: 6,
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: '0 15px 35px rgba(0,0,0,0.5)',
                  background: '#ffffff',
                  lineHeight: 0,
                  transition: 'transform 0.15s ease'
                }}>
                  <div style={{
                    position: 'absolute',
                    top: 10,
                    right: 12,
                    background: 'rgba(15, 23, 42, 0.75)',
                    backdropFilter: 'blur(4px)',
                    color: '#ffffff',
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 12,
                    zIndex: 2,
                    pointerEvents: 'none',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
                  }}>
                    Trang 1
                  </div>
                  <img 
                    src={fallbackImgUrl} 
                    alt="CV Hồ sơ ứng viên - Trang 1"
                    style={{
                      width: '100%',
                      height: 'auto',
                      display: 'block',
                      transform: `rotate(${rotation}deg)`,
                      transition: 'transform 0.2s ease'
                    }}
                  />
                </div>

                {/* Page 2 */}
                {fallbackImgUrlP2 && (
                  <div style={{
                    width: `${Math.min(zoom, 160)}%`,
                    maxWidth: 860,
                    borderRadius: 6,
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: '0 15px 35px rgba(0,0,0,0.5)',
                    background: '#ffffff',
                    lineHeight: 0,
                    transition: 'transform 0.15s ease'
                  }}>
                    <div style={{
                      position: 'absolute',
                      top: 10,
                      right: 12,
                      background: 'rgba(15, 23, 42, 0.75)',
                      backdropFilter: 'blur(4px)',
                      color: '#ffffff',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 12,
                      zIndex: 2,
                      pointerEvents: 'none',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
                    }}>
                      Trang 2
                    </div>
                    <img 
                      src={fallbackImgUrlP2} 
                      alt="CV Hồ sơ ứng viên - Trang 2"
                      style={{
                        width: '100%',
                        height: 'auto',
                        display: 'block',
                        transform: `rotate(${rotation}deg)`,
                        transition: 'transform 0.2s ease'
                      }}
                    />
                  </div>
                )}
              </div>
            ) : (
              /* Fallback if no file */
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: 480, maxWidth: '90%', marginTop: 60,
                  border: '2px dashed #64748b', borderRadius: 14,
                  padding: '40px 24px', textAlign: 'center',
                  background: 'rgba(30, 41, 59, 0.6)', cursor: 'pointer'
                }}
              >
                <Upload size={36} color="#38bdf8" style={{ margin: '0 auto 12px' }} />
                <div style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc', marginBottom: 6 }}>
                  Chưa có tệp PDF gốc đính kèm cho hồ sơ này
                </div>
                <div style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 16 }}>
                  Bấm vào đây để chọn tải lên tệp PDF gốc của ứng viên ({candidate.fileName || 'CV.pdf'})
                </div>
                <button
                  type="button"
                  style={{
                    padding: '8px 18px', borderRadius: 8, border: 'none',
                    background: '#2563eb', color: '#ffffff', fontWeight: 700, fontSize: 13, cursor: 'pointer'
                  }}
                >
                  Chọn tệp PDF tải lên
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
