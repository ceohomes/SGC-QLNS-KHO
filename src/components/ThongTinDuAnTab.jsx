import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Pencil, Check, X, GripVertical, Building, FolderPlus, Database, Copy, RefreshCw, ChevronDown, ChevronUp, AlertCircle, Terminal, Search } from 'lucide-react'
import CustomAlert from './CustomAlert'
import { supabase } from '../supabaseClient'

const SQL_CODE = `-- -------------------------------------------------------------
-- 1. TẠO BẢNG DANH SÁCH THỦ KHO (Để lưu trữ thông tin nhân sự và dự án liên kết)
-- Bảng này đã có sẵn trong hệ thống của bạn, dưới đây là định nghĩa để tham khảo 
-- và đảm bảo các trường đồng bộ chính xác:
-- -------------------------------------------------------------
-- CREATE TABLE IF NOT EXISTS danh_sach_thu_kho (
--     stt SERIAL,
--     ma_nv TEXT PRIMARY KEY,
--     ho_ten TEXT NOT NULL,
--     gioi_tinh TEXT,
--     ngay_sinh DATE,
--     tuoi INTEGER,
--     dien_thoai TEXT,
--     so_dien_thoai TEXT,
--     email TEXT,
--     email_cong_ty TEXT,
--     khoi_thi_cong TEXT,       -- Khối thi công (VD: CỌC KHOAN NHỒI) -> Sẽ tự động cập nhật khi kéo thả
--     ban_chuoi_khoi TEXT,      -- Tương tự khoi_thi_cong để đồng bộ
--     phong_vung_mien TEXT,
--     cccd TEXT,
--     que_quan TEXT,
--     ngay_vao_lam DATE,
--     so_nam_kinh_nghiem INTEGER,
--     trinh_do TEXT,
--     chuyen_nganh TEXT,
--     chuc_vu TEXT,
--     chuc_danh TEXT,
--     du_an TEXT,               -- Dự án phụ trách (VD: Test1) -> Khớp tên với dự án trong Kanban board
--     du_an_cong_trinh TEXT,    -- Tương tự du_an để đồng bộ song song
--     kho_phu_trach TEXT,
--     so_luong_kho_quan_ly INTEGER,
--     gia_tri_ton_kho_quan_ly NUMERIC,
--     loai_hop_dong TEXT,
--     ngay_het_han_hd DATE,
--     trang_thai TEXT,
--     luong_co_ban NUMERIC,
--     chung_chi_nghiep_vu_kho TEXT,
--     chung_chi_atld TEXT,
--     danh_gia TEXT,
--     danh_gia_hieu_suat TEXT,
--     so_dien_thoai_khan_cap TEXT,
--     ghi_chu TEXT
-- );

-- -------------------------------------------------------------
-- 2. TẠO BẢNG SGC_THONG_TIN_DU_AN_BLOCKS (Cấu hình Khối thi công)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sgc_thong_tin_du_an_blocks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    badge TEXT,
    color TEXT,
    bg_color TEXT,
    border_color TEXT,
    badge_bg TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------
-- 3. TẠO BẢNG SGC_THONG_TIN_DU_AN_PROJECTS (Cấu hình Dự án trong Khối)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sgc_thong_tin_du_an_projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    badge TEXT,
    block_id TEXT REFERENCES sgc_thong_tin_du_an_blocks(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bật Row Level Security (RLS) để bảo vệ bảng cấu hình
ALTER TABLE sgc_thong_tin_du_an_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgc_thong_tin_du_an_projects ENABLE ROW LEVEL SECURITY;

-- Tạo chính sách bảo mật cho phép đọc ghi công khai (Để app hoạt động mượt mà)
CREATE POLICY "Allow public read for blocks" ON sgc_thong_tin_du_an_blocks FOR SELECT USING (true);
CREATE POLICY "Allow public write for blocks" ON sgc_thong_tin_du_an_blocks FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read for projects" ON sgc_thong_tin_du_an_projects FOR SELECT USING (true);
CREATE POLICY "Allow public write for projects" ON sgc_thong_tin_du_an_projects FOR ALL USING (true) WITH CHECK (true);

-- -------------------------------------------------------------
-- 4. CHÈN DỮ LIỆU CẤU HÌNH BAN ĐẦU CHO CÁC KHỐI THI CÔNG
-- -------------------------------------------------------------
INSERT INTO sgc_thong_tin_du_an_blocks (id, name, badge, color, bg_color, border_color, badge_bg, sort_order) VALUES
('unassigned', 'KHỐI THI CÔNG CHƯA PHÂN BỔ', 'NO', '#64748b', '#f8fafc', '#cbd5e1', '#e2e8f0', 0),
('block2', 'CỌC KHOAN NHỒI', 'CKN', '#ef4444', '#fef2f2', '#fca5a5', '#fee2e2', 1),
('block3', 'TUYẾN HN - QN', 'ĐS. HN-QN', '#f97316', '#fff7ed', '#fdb374', '#ffedd5', 2),
('block4', 'TUYẾN BT - CG', 'ĐS. BT - CG', '#a855f7', '#faf5ff', '#d8b4fe', '#f3e8ff', 3),
('block5', 'SAN LẤP - HẠ TẦNG', 'SLHT', '#10b981', '#f0fdf4', '#86efac', '#dcfce7', 4)
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name, 
    badge = EXCLUDED.badge, 
    color = EXCLUDED.color, 
    bg_color = EXCLUDED.bg_color, 
    border_color = EXCLUDED.border_color, 
    badge_bg = EXCLUDED.badge_bg;

-- Chèn dữ liệu dự án mẫu ban đầu
INSERT INTO sgc_thong_tin_du_an_projects (id, name, badge, block_id, sort_order) VALUES
('p_ckn_1', 'Test1', 'CKN', 'block2', 0),
('p_ckn_2', 'Test2', 'CKN', 'block2', 1),
('p_hnqn_1', 'test1', 'ĐS. HN-QN', 'block3', 0),
('p_hnqn_2', 'test2', 'ĐS. HN-QN', 'block3', 1)
ON CONFLICT (id) DO NOTHING;`

const DEFAULT_BLOCKS = [
  {
    id: 'unassigned',
    name: 'KHỐI THI CÔNG CHƯA PHÂN BỔ',
    badge: 'NO',
    color: '#64748b',
    bgColor: '#f8fafc',
    borderColor: '#cbd5e1',
    badgeBg: '#e2e8f0',
    projects: []
  },
  {
    id: 'block2',
    name: 'CỌC KHOAN NHỒI',
    badge: 'CKN',
    color: '#ef4444',
    bgColor: '#fef2f2',
    borderColor: '#fca5a5',
    badgeBg: '#fee2e2',
    projects: [
      { id: 'p_ckn_1', name: 'Test1', badge: 'CKN' },
      { id: 'p_ckn_2', name: 'Test2', badge: 'CKN' }
    ]
  },
  {
    id: 'block3',
    name: 'TUYẾN HN - QN',
    badge: 'ĐS. HN-QN',
    color: '#f97316',
    bgColor: '#fff7ed',
    borderColor: '#fdb374',
    badgeBg: '#ffedd5',
    projects: [
      { id: 'p_hnqn_1', name: 'test1', badge: 'ĐS. HN-QN' },
      { id: 'p_hnqn_2', name: 'test2', badge: 'ĐS. HN-QN' }
    ]
  },
  {
    id: 'block4',
    name: 'TUYẾN BT - CG',
    badge: 'ĐS. BT - CG',
    color: '#a855f7',
    bgColor: '#faf5ff',
    borderColor: '#d8b4fe',
    badgeBg: '#f3e8ff',
    projects: []
  },
  {
    id: 'block5',
    name: 'SAN LẤP - HẠ TẦNG',
    badge: 'SLHT',
    color: '#10b981',
    bgColor: '#f0fdf4',
    borderColor: '#4ade80',
    badgeBg: '#dcfce7',
    projects: []
  }
]

const COLOR_PRESETS = [
  { color: '#64748b', bgColor: '#f8fafc', borderColor: '#cbd5e1', badgeBg: '#e2e8f0', label: 'Xám' },
  { color: '#ef4444', bgColor: '#fef2f2', borderColor: '#fca5a5', badgeBg: '#fee2e2', label: 'Đỏ' },
  { color: '#f97316', bgColor: '#fff7ed', borderColor: '#fdb374', badgeBg: '#ffedd5', label: 'Cam' },
  { color: '#d97706', bgColor: '#fefbeb', borderColor: '#fcd34d', badgeBg: '#fef3c7', label: 'Vàng' },
  { color: '#10b981', bgColor: '#f0fdf4', borderColor: '#86efac', badgeBg: '#dcfce7', label: 'Xanh lá' },
  { color: '#0d9488', bgColor: '#f0fdfa', borderColor: '#99f6e4', badgeBg: '#ccfbf1', label: 'Xanh lục' },
  { color: '#0ea5e9', bgColor: '#f0f9ff', borderColor: '#7dd3fc', badgeBg: '#e0f2fe', label: 'Xanh dương' },
  { color: '#4f46e5', bgColor: '#f5f3ff', borderColor: '#c7d2fe', badgeBg: '#e0e7ff', label: 'Xanh chàm' },
  { color: '#a855f7', bgColor: '#faf5ff', borderColor: '#d8b4fe', badgeBg: '#f3e8ff', label: 'Tím' },
  { color: '#ec4899', bgColor: '#fdf2f8', borderColor: '#fbcfe8', badgeBg: '#fce7f3', label: 'Hồng' }
]

const getModernColors = (colorHex) => {
  const hex = (colorHex || '#64748b').toLowerCase()
  const found = COLOR_PRESETS.find(p => p.color.toLowerCase() === hex)
  if (found) {
    return {
      color: found.color,
      bgColor: found.bgColor,
      borderColor: found.borderColor
    }
  }
  if (hex === '#16a34a' || hex === '#10b981') {
    return {
      color: '#10b981',
      bgColor: '#f0fdf4',
      borderColor: '#86efac'
    }
  }
  if (hex === '#dc2626' || hex === '#ef4444') {
    return {
      color: '#ef4444',
      bgColor: '#fef2f2',
      borderColor: '#fca5a5'
    }
  }
  if (hex === '#ea580c' || hex === '#f97316') {
    return {
      color: '#f97316',
      bgColor: '#fff7ed',
      borderColor: '#fdb374'
    }
  }
  if (hex === '#9333ea' || hex === '#a855f7') {
    return {
      color: '#a855f7',
      bgColor: '#faf5ff',
      borderColor: '#d8b4fe'
    }
  }
  if (hex === '#0284c7' || hex === '#0ea5e9') {
    return {
      color: '#0ea5e9',
      bgColor: '#f0f9ff',
      borderColor: '#7dd3fc'
    }
  }
  return {
    color: colorHex || '#64748b',
    bgColor: colorHex === '#64748b' ? '#f8fafc' : (colorHex + '10'),
    borderColor: colorHex === '#64748b' ? '#cbd5e1' : colorHex
  }
}

export default function ThongTinDuAnTab({ data = [], onReload }) {
  const [blocks, setBlocks] = useState([])
  const [originalBlocks, setOriginalBlocks] = useState([])
  const [successToast, setSuccessToast] = useState(null)
  const [alertConfig, setAlertConfig] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  
  // Supabase states
  const [useSupabase, setUseSupabase] = useState(false)
  const [supabaseLoading, setSupabaseLoading] = useState(false)
  const [showSqlConfig, setShowSqlConfig] = useState(false)
  const [copiedSql, setCopiedSql] = useState(false)

  const showAlert = (message, severity = 'info', title = 'Thông báo') => {
    setAlertConfig({ type: 'alert', message, severity, title })
  }

  const showConfirm = (message, onConfirm, onCancel, title = 'Xác nhận', severity = 'info') => {
    setAlertConfig({ type: 'confirm', message, onConfirm, onCancel, title, severity })
  }
  
  // Drag and drop helper states
  const [draggedBlockIndex, setDraggedBlockIndex] = useState(null)
  const [draggedProject, setDraggedProject] = useState(null) // { sourceBlockId, projectIndex }
  const [dropOverBlockId, setDropOverBlockId] = useState(null)

  // Edit states
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false)
  const [editingBlock, setEditingBlock] = useState(null) // block or null for new
  const [blockName, setBlockName] = useState('')
  const [blockBadge, setBlockBadge] = useState('')
  const [selectedColorIndex, setSelectedColorIndex] = useState(0)

  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState(null) // { blockId, projectIndex, project }
  const [projectName, setProjectName] = useState('')
  const [targetBlockId, setTargetBlockId] = useState('')

  // Load from Supabase on mount with LocalStorage fallback
  const loadFromSupabase = async () => {
    try {
      setSupabaseLoading(true)
      const { data: dbBlocks, error: blocksErr } = await supabase
        .from('sgc_thong_tin_du_an_blocks')
        .select('*')
        .order('sort_order', { ascending: true })

      if (blocksErr) throw blocksErr

      const { data: dbProjects, error: projsErr } = await supabase
        .from('sgc_thong_tin_du_an_projects')
        .select('*')
        .order('sort_order', { ascending: true })

      if (projsErr) throw projsErr

      if (dbBlocks && dbBlocks.length > 0) {
        const formattedBlocks = dbBlocks.map(b => {
          const blockProjs = (dbProjects || [])
            .filter(p => p.block_id === b.id)
            .map(p => ({
              id: p.id,
              name: p.name,
              badge: p.badge
            }))
          return {
            id: b.id,
            name: b.name,
            badge: b.badge,
            color: b.color,
            bgColor: b.bg_color,
            borderColor: b.border_color,
            badgeBg: b.badge_bg,
            projects: blockProjs
          }
        })

        setBlocks(formattedBlocks)
        setOriginalBlocks(JSON.parse(JSON.stringify(formattedBlocks)))
        setUseSupabase(true)
      } else {
        throw new Error('No data in Supabase blocks table')
      }
    } catch (err) {
      console.warn('Dùng LocalStorage làm phương án dự phòng do bảng Supabase chưa được thiết lập:', err.message)
      setUseSupabase(false)
      const saved = localStorage.getItem('sgc_thong_tin_du_an_config')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          setBlocks(parsed)
          setOriginalBlocks(JSON.parse(saved))
        } catch (e) {
          setBlocks(DEFAULT_BLOCKS)
          setOriginalBlocks(JSON.parse(JSON.stringify(DEFAULT_BLOCKS)))
        }
      } else {
        setBlocks(DEFAULT_BLOCKS)
        setOriginalBlocks(JSON.parse(JSON.stringify(DEFAULT_BLOCKS)))
      }
    } finally {
      setSupabaseLoading(false)
    }
  }

  useEffect(() => {
    loadFromSupabase()
  }, [])

  // Auto-hide toast after 3s
  useEffect(() => {
    if (successToast) {
      const t = setTimeout(() => setSuccessToast(null), 3000)
      return () => clearTimeout(t)
    }
  }, [successToast])

  // Tự động đồng bộ / phân bổ các dự án từ DANH SÁCH THỦ KHO nếu chưa nằm trong khối thi công nào
  useEffect(() => {
    // Chỉ tự động phân bổ nếu cấu hình hiện tại đang đồng bộ với cấu hình gốc (để tránh xung đột khi người dùng đang chỉnh sửa/đổi tên dự án)
    if (JSON.stringify(blocks) !== JSON.stringify(originalBlocks)) {
      return
    }

    if (data && data.length > 0 && blocks && blocks.length > 0) {
      // 1. Thu thập tất cả tên Dự án / Công trình duy nhất từ Danh sách thủ kho
      const uniqueProjectNames = Array.from(new Set(
        data.map(item => item.duAn ? item.duAn.trim() : '').filter(Boolean)
      ))

      // 2. Thu thập các tên dự án hiện đang có ở toàn bộ các cột Kanban board
      const existingNames = new Set()
      blocks.forEach(b => {
        if (b.projects) {
          b.projects.forEach(p => {
            if (p.name) {
              existingNames.add(p.name.trim().toLowerCase())
            }
          })
        }
      })

      // 3. Tìm ra các dự án chưa được phân bổ
      const missingProjects = uniqueProjectNames.filter(
        name => !existingNames.has(name.toLowerCase())
      )

      if (missingProjects.length > 0) {
        console.log('Tự động phát hiện các Dự án / Công trình chưa phân bổ:', missingProjects)

        // Mặc định phân bổ vào khối có ID là 'unassigned' (Khối thi công chưa phân bổ)
        const targetBlockId = blocks.some(b => b.id === 'unassigned') ? 'unassigned' : blocks[0].id

        const updatedBlocks = blocks.map(b => {
          if (b.id === targetBlockId) {
            const newProjects = [
              ...(b.projects || []),
              ...missingProjects.map((name, idx) => ({
                id: `p_auto_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 5)}`,
                name: name,
                badge: b.badge || 'NO'
              }))
            ]
            return { ...b, projects: newProjects }
          }
          return b
        })

        setBlocks(updatedBlocks)
        setOriginalBlocks(JSON.parse(JSON.stringify(updatedBlocks))) // Giữ nguyên trạng thái đồng bộ ban đầu
        // Đồng bộ tự động lên Supabase / LocalStorage
        syncStateToSupabase(updatedBlocks, true)
      }
    }
  }, [data, blocks, originalBlocks])

  // Realtime Supabase Sync helper
  const syncStateToSupabase = (updatedBlocks, isAuto = false) => {
    // Luôn lưu trữ offline vào LocalStorage để tránh mất dữ liệu
    localStorage.setItem('sgc_thong_tin_du_an_config', JSON.stringify(updatedBlocks))
  }

  // --- ACTIONS ---

  // Save Configuration (Force Sync manually)
  const handleSaveConfig = async () => {
    try {
      setSupabaseLoading(true)

      // Kiểm tra trùng tên dự án và tự động gộp lại (Chỉ áp dụng trong cùng 1 khối thi công)
      let hasDuplicates = false
      const duplicateNames = []

      const mergedBlocksToSave = blocks.map(b => {
        const seenNamesInBlock = new Set()
        const uniqueProjects = []
        const projs = b.projects || []
        projs.forEach(p => {
          const nameTrimmed = (p.name || '').trim()
          const nameLower = nameTrimmed.toLowerCase()
          if (nameLower) {
            if (seenNamesInBlock.has(nameLower)) {
              hasDuplicates = true
              if (!duplicateNames.includes(nameTrimmed)) {
                duplicateNames.push(`${nameTrimmed} (${b.name})`)
              }
            } else {
              seenNamesInBlock.add(nameLower)
              uniqueProjects.push(p)
            }
          } else {
            uniqueProjects.push(p)
          }
        })
        return {
          ...b,
          projects: uniqueProjects
        }
      })

      if (hasDuplicates) {
        setBlocks(mergedBlocksToSave)
        const msg = `Hệ thống phát hiện các Dự án trùng tên: "${duplicateNames.join(', ')}". Đã tự động gộp các dự án trùng tên này và lưu cấu hình thành công!`
        showAlert(msg, 'warning', 'Tự động gộp dự án')
      }

      // Luôn lưu trữ offline vào LocalStorage để tránh mất dữ liệu
      localStorage.setItem('sgc_thong_tin_du_an_config', JSON.stringify(mergedBlocksToSave))

      if (!useSupabase) {
        setSuccessToast('Đã lưu cấu hình cục bộ vào Trình duyệt!')
        setOriginalBlocks(JSON.parse(JSON.stringify(mergedBlocksToSave)))
        setSupabaseLoading(false)
        return
      }

      // 1. Đồng bộ blocks lên sgc_thong_tin_du_an_blocks
      const dbBlocks = mergedBlocksToSave.map((b, idx) => ({
        id: b.id,
        name: b.name,
        badge: b.badge,
        color: b.color,
        bg_color: b.bgColor,
        border_color: b.borderColor,
        badge_bg: b.badgeBg,
        sort_order: idx
      }))

      const { error: blockErr } = await supabase
        .from('sgc_thong_tin_du_an_blocks')
        .upsert(dbBlocks, { onConflict: 'id' })

      if (blockErr) throw blockErr

      // 2. Đồng bộ projects lên sgc_thong_tin_du_an_projects
      const dbProjects = []
      mergedBlocksToSave.forEach(b => {
        if (b.projects && b.projects.length > 0) {
          b.projects.forEach((p, idx) => {
            dbProjects.push({
              id: p.id,
              name: p.name,
              badge: p.badge,
              block_id: b.id,
              sort_order: idx
            })
          })
        }
      })

      // Xóa tất cả các dự án cũ trên Supabase để ghi đè thứ tự mới
      const { error: deleteErr } = await supabase
        .from('sgc_thong_tin_du_an_projects')
        .delete()
        .neq('id', 'dummy_nonexistent_id')

      if (deleteErr) throw deleteErr

      // Chèn tập dự án mới nếu có
      if (dbProjects.length > 0) {
        const { error: insertErr } = await supabase
          .from('sgc_thong_tin_du_an_projects')
          .insert(dbProjects)
        if (insertErr) throw insertErr
      }

      // 3. Đồng bộ lên danh_sach_thu_kho (nhân sự/kho)
      // Tìm sự khác biệt giữa originalBlocks và blocks để thực hiện cập nhật
      const originalProjectsList = []
      originalBlocks.forEach(b => {
        (b.projects || []).forEach(p => {
          originalProjectsList.push({
            id: p.id,
            name: p.name,
            blockId: b.id,
            blockName: b.name
          })
        })
      })

      const newProjectsList = []
      mergedBlocksToSave.forEach(b => {
        (b.projects || []).forEach(p => {
          newProjectsList.push({
            id: p.id,
            name: p.name,
            blockId: b.id,
            blockName: b.name
          })
        })
      })

      // Đồng bộ trực tiếp, an toàn từng dòng lên danh_sach_thu_kho dựa trên mã nhân viên
      const { data: dbRows, error: fetchErr } = await supabase
        .from('danh_sach_thu_kho')
        .select('*')
      if (fetchErr) throw fetchErr

      if (dbRows && dbRows.length > 0) {
        for (const row of dbRows) {
          const currentProjName = (row.du_an_cong_trinh || row.du_an || '').trim()
          if (!currentProjName) continue

          const matchedOrig = originalProjectsList.find(o => 
            (o.name || '').trim().toLowerCase() === currentProjName.toLowerCase()
          )

          const updatePayload = {}

          if (matchedOrig) {
            const matchedNew = newProjectsList.find(n => n.id === matchedOrig.id)
            if (!matchedNew) {
              // Dự án bị xóa khỏi cấu hình -> Đưa thủ kho về trạng thái chưa phân bổ
              if ('khoi_thi_cong' in row) updatePayload.khoi_thi_cong = 'KHỐI THI CÔNG CHƯA PHÂN BỔ'
              if ('ban_chuoi_khoi' in row) updatePayload.ban_chuoi_khoi = 'KHỐI THI CÔNG CHƯA PHÂN BỔ'
              if ('du_an' in row) updatePayload.du_an = ''
              if ('du_an_cong_trinh' in row) updatePayload.du_an_cong_trinh = ''
            } else {
              // Dự án bị đổi tên
              if ((matchedOrig.name || '').trim().toLowerCase() !== (matchedNew.name || '').trim().toLowerCase()) {
                if ('du_an' in row) updatePayload.du_an = matchedNew.name
                if ('du_an_cong_trinh' in row) updatePayload.du_an_cong_trinh = matchedNew.name
              }
              // Dự án di chuyển khối hoặc khối đổi tên
              if ((matchedOrig.blockName || '').trim().toLowerCase() !== (matchedNew.blockName || '').trim().toLowerCase()) {
                if ('khoi_thi_cong' in row) updatePayload.khoi_thi_cong = matchedNew.blockName
                if ('ban_chuoi_khoi' in row) updatePayload.ban_chuoi_khoi = matchedNew.blockName
              }
            }
          } else {
            // Nếu không khớp dự án cũ theo ID, thử khớp theo tên hiện tại với dự án mới
            const matchedNewByName = newProjectsList.find(n =>
              (n.name || '').trim().toLowerCase() === currentProjName.toLowerCase()
            )
            if (matchedNewByName) {
              const currentBlockName = (row.khoi_thi_cong || row.ban_chuoi_khoi || '').trim()
              if (matchedNewByName.blockName && currentBlockName.toLowerCase() !== matchedNewByName.blockName.toLowerCase()) {
                if ('khoi_thi_cong' in row) updatePayload.khoi_thi_cong = matchedNewByName.blockName
                if ('ban_chuoi_khoi' in row) updatePayload.ban_chuoi_khoi = matchedNewByName.blockName
              }
            }
          }

          if (Object.keys(updatePayload).length > 0) {
            console.log(`Đang tự động cập nhật đồng bộ cho thủ kho ${row.ho_ten || row.ma_nv}:`, updatePayload)
            const { error: updateErr } = await supabase
              .from('danh_sach_thu_kho')
              .update(updatePayload)
              .eq('ma_nv', row.ma_nv)
            if (updateErr) throw updateErr
          }
        }
      }

      // Lưu lại trạng thái originalBlocks mới
      setOriginalBlocks(JSON.parse(JSON.stringify(mergedBlocksToSave)))

      // Kích hoạt reload ở App.jsx để cập nhật danh sách thủ kho
      if (onReload) {
        await onReload()
      }

      setSuccessToast('Đồng bộ dữ liệu và lưu cấu hình lên Supabase thành công!')
      if (!hasDuplicates) {
        showAlert('Đồng bộ dữ liệu và cấu hình dự án lên Supabase đám mây thành công!', 'success', 'ĐÃ ĐỒNG BỘ')
      }
    } catch (err) {
      console.error('Lỗi khi lưu đồng bộ lên Supabase:', err)
      setSuccessToast('Có lỗi xảy ra khi lưu lên Supabase!')
      showAlert('Lỗi đồng bộ lên Supabase: ' + (err.message || err), 'error', 'LỖI ĐỒNG BỘ')
    } finally {
      setSupabaseLoading(false)
    }
  }

  // Cancel Configuration
  const handleCancelConfig = () => {
    setBlocks(JSON.parse(JSON.stringify(originalBlocks)))
    setSuccessToast('Đã khôi phục về cấu hình lưu trữ gần nhất.')
  }

  // Block Modal Add/Edit Confirm
  const handleBlockSubmit = async (e) => {
    e.preventDefault()
    if (!blockName.trim()) return

    const colorConfig = COLOR_PRESETS[selectedColorIndex]
    let updatedBlocks = []

    if (editingBlock) {
      // Edit
      updatedBlocks = blocks.map(b => b.id === editingBlock.id ? {
        ...b,
        name: blockName.toUpperCase(),
        badge: blockBadge || 'DA',
        color: colorConfig.color,
        bgColor: colorConfig.bgColor,
        borderColor: colorConfig.borderColor,
        badgeBg: colorConfig.badgeBg
      } : b)
    } else {
      // Add new
      const newBlock = {
        id: 'block_' + Date.now(),
        name: blockName.toUpperCase(),
        badge: blockBadge || 'DA',
        color: colorConfig.color,
        bgColor: colorConfig.bgColor,
        borderColor: colorConfig.borderColor,
        badgeBg: colorConfig.badgeBg,
        projects: []
      }
      updatedBlocks = [...blocks, newBlock]
    }

    setBlocks(updatedBlocks)
    await syncStateToSupabase(updatedBlocks)

    setIsBlockModalOpen(false)
    setEditingBlock(null)
    setBlockName('')
    setBlockBadge('')
  }

  // Delete Block
  const handleDeleteBlock = (blockId) => {
    const block = blocks.find(b => b.id === blockId)
    if (!block) return

    const message = `Xóa khối thi công:\n${block.name}\nToàn bộ thông tin liên quan đến khối thi công này và các dự án bên trong sẽ bị gỡ bỏ.\nHành động này không thể hoàn tác.`

    showConfirm(
      message,
      async () => {
        const updatedBlocks = blocks.filter(b => b.id !== blockId)
        setBlocks(updatedBlocks)
        await syncStateToSupabase(updatedBlocks)
      },
      () => {},
      'XÁC NHẬN XÓA KHỐI THI CÔNG',
      'error'
    )
  }

  // Open Edit Block
  const openEditBlock = (block) => {
    setEditingBlock(block)
    setBlockName(block.name)
    setBlockBadge(block.badge)
    const idx = COLOR_PRESETS.findIndex(c => c.color === block.color)
    setSelectedColorIndex(idx !== -1 ? idx : 0)
    setIsBlockModalOpen(true)
  }

  // Open Add Block
  const openAddBlock = () => {
    setEditingBlock(null)
    setBlockName('')
    setBlockBadge('')
    setSelectedColorIndex(0)
    setIsBlockModalOpen(true)
  }

  // Project Modal Add/Edit Confirm
  const handleProjectSubmit = async (e) => {
    e.preventDefault()
    if (!projectName.trim()) return

    let updatedBlocks = []
    if (editingProject) {
      // Edit project
      const { blockId, projectIndex, project } = editingProject
      const oldName = project?.name
      const newName = projectName.trim()

      updatedBlocks = blocks.map(b => {
        if (b.id === blockId) {
          const updatedProjects = [...b.projects]
          updatedProjects[projectIndex] = {
            ...updatedProjects[projectIndex],
            name: newName
          }
          return { ...b, projects: updatedProjects }
        }
        return b
      })
    } else {
      // Add new project
      const parentBlock = blocks.find(b => b.id === targetBlockId)
      const newProj = {
        id: 'proj_' + Date.now(),
        name: projectName.trim(),
        badge: parentBlock ? parentBlock.badge : 'DA'
      }

      updatedBlocks = blocks.map(b => {
        if (b.id === targetBlockId) {
          return { ...b, projects: [...b.projects, newProj] }
        }
        return b
      })
    }

    setBlocks(updatedBlocks)
    syncStateToSupabase(updatedBlocks)

    setIsProjectModalOpen(false)
    setEditingProject(null)
    setProjectName('')
  }

  // Open Add Project
  const openAddProject = (blockId) => {
    setEditingProject(null)
    setTargetBlockId(blockId)
    setProjectName('')
    setIsProjectModalOpen(true)
  }

  // Open Edit Project
  const openEditProject = (blockId, projectIndex, project) => {
    setEditingProject({ blockId, projectIndex, project })
    setProjectName(project.name)
    setIsProjectModalOpen(true)
  }

  // Delete Project
  const handleDeleteProject = (blockId, projectIndex) => {
    const block = blocks.find(b => b.id === blockId)
    const project = block?.projects[projectIndex]
    if (!project) return

    const message = `Xóa dự án:\n${project.name}\nToàn bộ thông tin liên quan đến dự án này và các khối lượng của dự án sẽ bị gỡ bỏ khỏi khối.\nHành động này không thể hoàn tác.`

    showConfirm(
      message,
      async () => {
        const updatedBlocks = blocks.map(b => {
          if (b.id === blockId) {
            const filtered = b.projects.filter((_, idx) => idx !== projectIndex)
            return { ...b, projects: filtered }
          }
          return b
        })
        setBlocks(updatedBlocks)
        syncStateToSupabase(updatedBlocks)
      },
      () => {},
      'XÁC NHẬN XÓA DỰ ÁN',
      'error'
    )
  }


  // --- HTML5 DRAG & DROP HANDLERS ---

  // 1. Column Drag and Drop
  const handleColumnDragStart = (e, index) => {
    setDraggedBlockIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    // For firefox support
    e.dataTransfer.setData('text/plain', 'column_' + index)
  }

  const handleColumnDragOver = (e, targetIndex) => {
    e.preventDefault()
    if (draggedBlockIndex === null || draggedBlockIndex === targetIndex) return

    const updatedBlocks = [...blocks]
    const [draggedItem] = updatedBlocks.splice(draggedBlockIndex, 1)
    updatedBlocks.splice(targetIndex, 0, draggedItem)
    
    setDraggedBlockIndex(targetIndex)
    setBlocks(updatedBlocks)
  }

  const handleColumnDragEnd = () => {
    setDraggedBlockIndex(null)
    syncStateToSupabase(blocks)
  }

  // 2. Project Card Drag and Drop
  const handleProjDragStart = (e, blockId, projectIndex, project) => {
    e.stopPropagation()
    setDraggedProject({ sourceBlockId: blockId, projectIndex, project })
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', 'project_' + project.id)
  }

  const handleProjDragOver = (e, blockId) => {
    e.preventDefault()
    if (!draggedProject) return
    if (dropOverBlockId !== blockId) {
      setDropOverBlockId(blockId)
    }
  }

  const handleProjDrop = async (e, destBlockId, destIndex = null) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!draggedProject) return

    const { sourceBlockId, projectIndex, project } = draggedProject
    
    // If dropped in the exact same spot, do nothing
    if (sourceBlockId === destBlockId && (destIndex === projectIndex || destIndex === projectIndex + 1)) {
      setDraggedProject(null)
      setDropOverBlockId(null)
      return
    }

    const targetBlock = blocks.find(b => b.id === destBlockId)
    if (!targetBlock) return

    // 1. Remove from source
    const updated = blocks.map(b => {
      if (b.id === sourceBlockId) {
        const projs = b.projects.filter((_, idx) => idx !== projectIndex)
        return { ...b, projects: projs }
      }
      return b
    })

    // 2. Add to destination
    const finalBlocks = updated.map(b => {
      if (b.id === destBlockId) {
        const projs = [...b.projects]
        const updatedProj = { ...project, badge: b.badge } // Update project badge to match new column badge
        
        if (destIndex === null) {
          projs.push(updatedProj)
        } else {
          projs.splice(destIndex, 0, updatedProj)
        }
        return { ...b, projects: projs }
      }
      return b
    })

    setBlocks(finalBlocks)
    syncStateToSupabase(finalBlocks)

    setDraggedProject(null)
    setDropOverBlockId(null)
  }

  return (
    <div style={{ fontFamily: '"Roboto", sans-serif', padding: '24px', display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box', overflow: 'hidden', flex: 1, position: 'relative' }}>
      
      {/* Dynamic Toast Success */}
      {successToast && (
        <div style={{
          position: 'absolute', top: 20, right: 24, zIndex: 1000,
          background: '#dcfce7', color: '#15803d', padding: '12px 20px',
          borderRadius: 8, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
          display: 'flex', alignItems: 'center', gap: 10,
          border: '1px solid #bbf7d0', animation: 'fade-in 0.3s ease-out'
        }}>
          <Check size={18} />
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>{successToast}</span>
        </div>
      )}

      {/* Header Board Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
          <div style={{ textAlign: 'left' }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Building size={20} style={{ color: '#0f58a7' }} />
              <span>THIẾT LẬP KHỐI THI CÔNG & DỰ ÁN</span>
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
              Kéo thả tiêu đề cột để thay đổi thứ tự khối. Kéo thả thẻ dự án để di chuyển giữa các khối.
            </p>
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '280px', minWidth: '200px' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, color: '#64748b', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Tìm tên dự án..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                fontSize: 13,
                fontWeight: 600,
                color: '#1e293b',
                background: '#ffffff',
                border: '1.5px solid #cbd5e1',
                borderRadius: '8px',
                outline: 'none',
                transition: 'all 0.15s ease',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#0f58a7'
                e.target.style.boxShadow = '0 0 0 3px rgba(15, 88, 167, 0.15)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#cbd5e1'
                e.target.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: 10,
                  background: 'none',
                  border: 'none',
                  padding: 4,
                  cursor: 'pointer',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Supabase Connection State and Config Trigger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {useSupabase ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0',
              padding: '6px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 700
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 6px #10b981' }} />
              <Database size={14} />
              <span>Supabase: Đã kết nối</span>
            </div>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa',
              padding: '6px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 700
            }}>
              <AlertCircle size={14} style={{ color: '#ea580c' }} />
              <span>Lưu cục bộ (Trình duyệt)</span>
            </div>
          )}
        </div>
      </div>

      {/* SQL Setup Panel */}
      {showSqlConfig && (
        <div style={{
          background: '#0f172a', color: '#e2e8f0', padding: 20, borderRadius: 16,
          marginBottom: 20, border: '1px solid #1e293b', textAlign: 'left',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Database size={18} style={{ color: '#38bdf8' }} />
              <span style={{ fontWeight: 800, fontSize: 14, color: '#f8fafc', letterSpacing: '0.01em' }}>
                CẤU HÌNH BẢNG THÔNG TIN DỰ ÁN TRÊN SUPABASE
              </span>
            </div>
            
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={loadFromSupabase}
                disabled={supabaseLoading}
                style={{
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                  color: '#ffffff', padding: '6px 12px', borderRadius: 6, fontSize: 12,
                  fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                }}
              >
                <RefreshCw size={12} className={supabaseLoading ? 'spin' : ''} />
                <span>Kiểm tra lại kết nối</span>
              </button>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(SQL_CODE);
                  setCopiedSql(true);
                  setTimeout(() => setCopiedSql(false), 2000);
                }}
                style={{
                  background: copiedSql ? '#10b981' : '#38bdf8',
                  border: 'none', color: '#0f172a', padding: '6px 12px', borderRadius: 6,
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                }}
              >
                <Copy size={12} />
                <span>{copiedSql ? 'Đã sao chép!' : 'Sao chép mã SQL'}</span>
              </button>
            </div>
          </div>

          <p style={{ margin: '0 0 12px 0', fontSize: 12.5, color: '#94a3b8', lineHeight: 1.4 }}>
            Để đồng bộ tự động dữ liệu kéo thả trực tiếp lên đám mây, vui lòng truy cập vào 
            <strong style={{ color: '#38bdf8' }}> SQL Editor</strong> trên trang quản trị Supabase của bạn, dán đoạn mã bên dưới và nhấn <strong style={{ color: '#38bdf8' }}>Run</strong>. 
            Hệ thống sẽ tự động thiết lập các bảng và chính sách bảo mật phù hợp cho Tab thông tin phân bổ dự án.
          </p>

          <pre style={{
            margin: 0, padding: 14, background: '#020617', borderRadius: 8,
            overflowX: 'auto', fontSize: 11.5, fontFamily: 'monospace', color: '#38bdf8',
            maxHeight: 180, border: '1px solid #1e293b'
          }}>
            <code>{SQL_CODE}</code>
          </pre>
        </div>
      )}

      {/* Kanban Board Container */}
      <div style={{
        display: 'flex', gap: 16, overflowX: 'auto', flex: 1, paddingBottom: 16,
        alignItems: 'flex-start', minHeight: 0
      }}>
        {blocks.map((block, idx) => {
          const isOver = dropOverBlockId === block.id
          const colors = getModernColors(block.color)
          const filteredProjects = (block.projects || []).filter(p => 
            !searchQuery || (p.name && p.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
          )
          return (
            <div
              key={block.id}
              onDragOver={(e) => handleProjDragOver(e, block.id)}
              onDrop={(e) => handleProjDrop(e, block.id)}
              style={{
                width: 290, flexShrink: 0,
                borderRadius: '24px', border: `2px solid ${colors.borderColor}`,
                boxShadow: 'none',
                display: 'flex', flexDirection: 'column', maxHeight: '100%',
                transition: 'all 0.2s ease',
                backgroundColor: colors.bgColor,
                outline: isOver ? `2.5px solid ${colors.color}` : 'none',
                transform: draggedBlockIndex === idx ? 'scale(0.98)' : 'none',
                opacity: draggedBlockIndex === idx ? 0.7 : 1
              }}
            >
              {/* Column Header */}
              <div 
                draggable
                onDragStart={(e) => handleColumnDragStart(e, idx)}
                onDragOver={(e) => handleColumnDragOver(e, idx)}
                onDragEnd={handleColumnDragEnd}
                style={{
                  padding: '16px 18px',
                  background: colors.bgColor, borderTopLeftRadius: '22px', borderTopRightRadius: '22px',
                  cursor: 'grab', display: 'flex', flexDirection: 'column', gap: 8
                }}
              >
                {/* Header Top: Badge & Actions */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                    <GripVertical size={14} style={{ color: colors.color, cursor: 'grab', opacity: 0.6, flexShrink: 0 }} />
                    <span style={{
                      background: colors.color, color: '#ffffff',
                      fontFamily: '"Roboto", sans-serif',
                      fontSize: 12, fontWeight: 800, padding: '3px 10px',
                      borderRadius: '8px', letterSpacing: '0.02em',
                      flexShrink: 0
                    }}>
                      {block.badge}
                    </span>
                    <h3 style={{
                      margin: 0, fontSize: 13, fontWeight: 800, color: '#0050b3',
                      fontFamily: '"Roboto", sans-serif',
                      textAlign: 'left', textTransform: 'uppercase', lineHeight: 1.3,
                      letterSpacing: '0.02em',
                      flex: 1,
                      minWidth: 0
                    }}>
                      {block.name}
                    </h3>
                  </div>
                  
                  {/* Actions: Edit, Delete */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <button 
                      onClick={() => openEditBlock(block)}
                      title="Sửa cột"
                      style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: '#64748b' }}
                      onMouseOver={(e) => e.currentTarget.style.color = '#0050b3'}
                      onMouseOut={(e) => e.currentTarget.style.color = '#64748b'}
                    >
                      <Pencil size={13} />
                    </button>
                    {block.id !== 'unassigned' && (
                      <button 
                        onClick={() => handleDeleteBlock(block.id)}
                        title="Xóa cột"
                        style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: '#64748b' }}
                        onMouseOver={(e) => e.currentTarget.style.color = '#ef4444'}
                        onMouseOut={(e) => e.currentTarget.style.color = '#64748b'}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Header Bottom: Stats */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, fontSize: 11,
                  fontFamily: '"Roboto", sans-serif',
                  color: '#94a3b8', fontWeight: 700, letterSpacing: '0.02em'
                }}>
                  <span>{searchQuery ? `${filteredProjects.length}/${block.projects.length}` : block.projects.length} DỰ ÁN</span>
                  <span style={{ opacity: 0.5 }}>•</span>
                  <span style={{ color: '#cbd5e1', fontWeight: 500, fontStyle: 'italic' }}>Kéo tiêu đề để đổi vị trí</span>
                </div>
              </div>

              {/* Separator line with gaps */}
              <div style={{ height: '1.5px', backgroundColor: colors.borderColor, margin: '0 18px', opacity: 0.8 }} />

              {/* Column Body: Project List */}
              <div style={{
                padding: '14px', overflowY: 'auto', display: 'flex',
                flexDirection: 'column', gap: 10, flex: 1, minHeight: 120
              }}>
                {filteredProjects.length === 0 ? (
                  <div style={{
                    padding: '36px 12px', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', color: '#94a3b8', fontSize: 13,
                    fontFamily: '"Roboto", sans-serif',
                    fontWeight: 600, background: 'transparent', textAlign: 'center'
                  }}>
                    {searchQuery ? 'Không tìm thấy dự án phù hợp' : 'Kéo dự án vào đây'}
                  </div>
                ) : (
                  filteredProjects.map((proj) => {
                    const originalIndex = block.projects.findIndex(p => p.id === proj.id)
                    return (
                      <div
                        key={proj.id}
                        draggable
                        onDragStart={(e) => handleProjDragStart(e, block.id, originalIndex, proj)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleProjDrop(e, block.id, originalIndex)}
                        style={{
                          padding: '11px 14px', background: '#ffffff', borderRadius: '12px',
                          border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center',
                          justifyContent: 'space-between', cursor: 'grab',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.01)',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.borderColor = colors.borderColor
                          e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.04)'
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.borderColor = '#e2e8f0'
                          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.01)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                          <GripVertical size={13} style={{ color: '#94a3b8', cursor: 'grab', flexShrink: 0, opacity: 0.7 }} />
                          <span style={{
                            background: colors.color, color: '#ffffff',
                            fontFamily: '"Roboto", sans-serif',
                            fontSize: 11, fontWeight: 800, padding: '2px 7px',
                            borderRadius: '6px', flexShrink: 0
                          }}>
                            {block.badge}
                          </span>
                          <strong style={{
                            fontFamily: '"Roboto", sans-serif',
                            fontSize: 12.5, color: '#334155', fontWeight: 600,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            textAlign: 'left'
                          }}>
                            {proj.name}
                          </strong>
                        </div>

                        {/* Project actions */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 4, flexShrink: 0 }}>
                          <button
                            onClick={() => openEditProject(block.id, originalIndex, proj)}
                            style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: '#94a3b8' }}
                            onMouseOver={(e) => e.currentTarget.style.color = '#0050b3'}
                            onMouseOut={(e) => e.currentTarget.style.color = '#94a3b8'}
                          >
                            <Pencil size={11} />
                          </button>
                          <button
                            onClick={() => handleDeleteProject(block.id, originalIndex)}
                            style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: '#94a3b8' }}
                            onMouseOver={(e) => e.currentTarget.style.color = '#ef4444'}
                            onMouseOut={(e) => e.currentTarget.style.color = '#94a3b8'}
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Column Footer */}
              <div style={{ padding: '8px 18px 18px', background: 'transparent' }}>
                <button
                  onClick={() => openAddProject(block.id)}
                  style={{
                    width: '100%', padding: '8px 0', background: 'none',
                    border: 'none', color: '#475569',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 6,
                    transition: 'all 0.2s', outline: 'none'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.color = colors.color
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.color = '#475569'
                  }}
                >
                  <Plus size={15} />
                  <span>Thêm dự án</span>
                </button>
              </div>
            </div>
          )
        })}

        {/* Add New Block Button Card */}
        <button
          onClick={openAddBlock}
          style={{
            width: 290, height: 120, flexShrink: 0, background: '#ffffff',
            border: '2px dashed #cbd5e1', borderRadius: '24px', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 8, transition: 'all 0.2s',
            boxShadow: 'none'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.borderColor = '#0050b3'
            e.currentTarget.style.background = '#f8fafc'
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.borderColor = '#cbd5e1'
            e.currentTarget.style.background = '#ffffff'
          }}
        >
          <div style={{
            background: '#eff6ff', color: '#0050b3', padding: 8, borderRadius: '50%'
          }}>
            <Plus size={18} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>Thêm khối mới</span>
        </button>
      </div>

      {/* Bottom Sticky Action Bar */}
      {(() => {
        const hasChanges = JSON.stringify(blocks) !== JSON.stringify(originalBlocks)
        return (
          <div style={{
            marginTop: 16, borderTop: '1px solid #e2e8f0', paddingTop: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'transparent'
          }}>
            {/* Left Side: Sync Status message */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {hasChanges ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ea580c', fontSize: 13, fontWeight: 600 }}>
                  <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#f97316' }} />
                  <span>Phát hiện thay đổi cấu hình mới chưa lưu. Vui lòng bấm "Lưu cấu hình" để đồng bộ lên Supabase.</span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#16a34a', fontSize: 13, fontWeight: 600 }}>
                  <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
                  <span>Cấu hình hiện tại đã được đồng bộ hoàn toàn với Supabase (Không có thay đổi mới).</span>
                </div>
              )}
            </div>

            {/* Right Side: Actions */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={handleCancelConfig}
                disabled={!hasChanges}
                style={{
                  background: 'none', border: 'none', color: hasChanges ? '#64748b' : '#cbd5e1', cursor: hasChanges ? 'pointer' : 'not-allowed',
                  padding: '8px 20px', fontSize: 13.5, fontWeight: 700, borderRadius: 8,
                  transition: 'background-color 0.2s',
                  opacity: hasChanges ? 1 : 0.6
                }}
                onMouseOver={(e) => {
                  if (hasChanges) e.currentTarget.style.backgroundColor = '#f1f5f9'
                }}
                onMouseOut={(e) => {
                  if (hasChanges) e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleSaveConfig}
                disabled={!hasChanges || supabaseLoading}
                style={{
                  background: hasChanges ? '#0f58a7' : '#cbd5e1',
                  color: hasChanges ? '#ffffff' : '#94a3b8',
                  border: 'none',
                  padding: '8px 24px', fontSize: 13.5, fontWeight: 700, borderRadius: 8,
                  cursor: (hasChanges && !supabaseLoading) ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', gap: 8,
                  boxShadow: hasChanges ? '0 4px 6px -1px rgba(15,88,167,0.2)' : 'none',
                  transition: 'all 0.15s ease'
                }}
                onMouseOver={(e) => {
                  if (hasChanges && !supabaseLoading) e.currentTarget.style.background = '#0050b3'
                }}
                onMouseOut={(e) => {
                  if (hasChanges && !supabaseLoading) e.currentTarget.style.background = '#0f58a7'
                }}
              >
                {supabaseLoading ? (
                  <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <Check size={16} />
                )}
                <span>{supabaseLoading ? 'Đang đồng bộ...' : 'Lưu cấu hình'}</span>
              </button>
            </div>
          </div>
        )
      })()}

      {/* --- MODAL 1: ADD/EDIT BLOCK --- */}
      {isBlockModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 1000,
          backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16
        }}>
          <div style={{
            background: '#ffffff', borderRadius: 12, width: '100%', maxWidth: 420,
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
            overflow: 'hidden', textAlign: 'left'
          }}>
            <div style={{
              background: '#0f58a7', padding: '16px 20px', color: '#ffffff',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>
                {editingBlock ? 'SỬA KHỐI THI CÔNG' : 'THÊM KHỐI THI CÔNG MỚI'}
              </h4>
              <button 
                onClick={() => setIsBlockModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleBlockSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>
                  Tên khối thi công *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Vd: CỌC KHOAN NHỒI"
                  value={blockName}
                  onChange={(e) => setBlockName(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 12px', fontSize: 13.5, borderRadius: 6,
                    border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>
                  Mã nhãn đại diện (Badge)
                </label>
                <input
                  type="text"
                  placeholder="Vd: CKN"
                  value={blockBadge}
                  onChange={(e) => setBlockBadge(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 12px', fontSize: 13.5, borderRadius: 6,
                    border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>
                  Màu sắc đại diện
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {COLOR_PRESETS.map((preset, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setSelectedColorIndex(index)}
                      style={{
                        padding: '6px 8px', borderRadius: 6, border: selectedColorIndex === index ? `2px solid ${preset.color}` : '1px solid #e2e8f0',
                        background: preset.bgColor, color: preset.color, fontSize: 11.5, fontWeight: 700,
                        cursor: 'pointer', textAlign: 'center'
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setIsBlockModalOpen(false)}
                  style={{
                    background: 'none', border: '1px solid #cbd5e1', color: '#475569',
                    padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  style={{
                    background: '#0f58a7', color: '#ffffff', border: 'none',
                    padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  Xác nhận
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: ADD/EDIT PROJECT --- */}
      {isProjectModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 1000,
          backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16
        }}>
          <div style={{
            background: '#ffffff', borderRadius: 12, width: '100%', maxWidth: 400,
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
            overflow: 'hidden', textAlign: 'left'
          }}>
            <div style={{
              background: '#0f58a7', padding: '16px 20px', color: '#ffffff',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>
                {editingProject ? 'SỬA TÊN DỰ ÁN' : 'THÊM DỰ ÁN MỚI'}
              </h4>
              <button 
                onClick={() => setIsProjectModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleProjectSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>
                  Tên Dự án / Công trình *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Vd: Tuyến 1, test2..."
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 12px', fontSize: 13.5, borderRadius: 6,
                    border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setIsProjectModalOpen(false)}
                  style={{
                    background: 'none', border: '1px solid #cbd5e1', color: '#475569',
                    padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  style={{
                    background: '#0f58a7', color: '#ffffff', border: 'none',
                    padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  Xác nhận
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {alertConfig && (
        <CustomAlert
          type={alertConfig.type}
          title={alertConfig.title}
          message={alertConfig.message}
          severity={alertConfig.severity}
          onConfirm={() => {
            if (alertConfig.onConfirm) alertConfig.onConfirm()
            setAlertConfig(null)
          }}
          onCancel={() => {
            if (alertConfig.onCancel) alertConfig.onCancel()
            setAlertConfig(null)
          }}
        />
      )}

    </div>
  )
}
