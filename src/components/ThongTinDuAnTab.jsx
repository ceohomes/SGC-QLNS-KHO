import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Pencil, Check, X, GripVertical, Building, FolderPlus } from 'lucide-react'
import CustomAlert from './CustomAlert'

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
    color: '#dc2626',
    bgColor: '#fff5f5',
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
    color: '#ea580c',
    bgColor: '#fffaf5',
    borderColor: '#fdba74',
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
    color: '#9333ea',
    bgColor: '#faf5ff',
    borderColor: '#d8b4fe',
    badgeBg: '#f3e8ff',
    projects: []
  },
  {
    id: 'block5',
    name: 'SAN LẤP - HẠ TẦNG',
    badge: 'SLHT',
    color: '#16a34a',
    bgColor: '#f0fdf4',
    borderColor: '#86efac',
    badgeBg: '#dcfce7',
    projects: []
  }
]

const COLOR_PRESETS = [
  { color: '#64748b', bgColor: '#f8fafc', borderColor: '#cbd5e1', badgeBg: '#e2e8f0', label: 'Xám' },
  { color: '#dc2626', bgColor: '#fff5f5', borderColor: '#fca5a5', badgeBg: '#fee2e2', label: 'Đỏ' },
  { color: '#ea580c', bgColor: '#fffaf5', borderColor: '#fdba74', badgeBg: '#ffedd5', label: 'Cam' },
  { color: '#9333ea', bgColor: '#faf5ff', borderColor: '#d8b4fe', badgeBg: '#f3e8ff', label: 'Tím' },
  { color: '#16a34a', bgColor: '#f0fdf4', borderColor: '#86efac', badgeBg: '#dcfce7', label: 'Xanh lá' },
  { color: '#0284c7', bgColor: '#f0f9ff', borderColor: '#bae6fd', badgeBg: '#e0f2fe', label: 'Xanh dương' }
]

export default function ThongTinDuAnTab() {
  const [blocks, setBlocks] = useState([])
  const [originalBlocks, setOriginalBlocks] = useState([])
  const [successToast, setSuccessToast] = useState(null)
  const [alertConfig, setAlertConfig] = useState(null)

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

  // Load from LocalStorage or default
  useEffect(() => {
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
  }, [])

  // Auto-hide toast after 3s
  useEffect(() => {
    if (successToast) {
      const t = setTimeout(() => setSuccessToast(null), 3000)
      return () => clearTimeout(t)
    }
  }, [successToast])

  // --- ACTIONS ---

  // Save Configuration
  const handleSaveConfig = () => {
    localStorage.setItem('sgc_thong_tin_du_an_config', JSON.stringify(blocks))
    setOriginalBlocks(JSON.parse(JSON.stringify(blocks)))
    setSuccessToast('Đã lưu cấu hình phân bổ dự án thành công!')
  }

  // Cancel Configuration
  const handleCancelConfig = () => {
    setBlocks(JSON.parse(JSON.stringify(originalBlocks)))
    setSuccessToast('Đã khôi phục về cấu hình lưu trữ gần nhất.')
  }

  // Block Modal Add/Edit Confirm
  const handleBlockSubmit = (e) => {
    e.preventDefault()
    if (!blockName.trim()) return

    const colorConfig = COLOR_PRESETS[selectedColorIndex]

    if (editingBlock) {
      // Edit
      setBlocks(prev => prev.map(b => b.id === editingBlock.id ? {
        ...b,
        name: blockName.toUpperCase(),
        badge: blockBadge || 'DA',
        color: colorConfig.color,
        bgColor: colorConfig.bgColor,
        borderColor: colorConfig.borderColor,
        badgeBg: colorConfig.badgeBg
      } : b))
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
      setBlocks(prev => [...prev, newBlock])
    }

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
      () => {
        setBlocks(prev => prev.filter(b => b.id !== blockId))
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
  const handleProjectSubmit = (e) => {
    e.preventDefault()
    if (!projectName.trim()) return

    if (editingProject) {
      // Edit project
      const { blockId, projectIndex } = editingProject
      setBlocks(prev => prev.map(b => {
        if (b.id === blockId) {
          const updatedProjects = [...b.projects]
          updatedProjects[projectIndex] = {
            ...updatedProjects[projectIndex],
            name: projectName
          }
          return { ...b, projects: updatedProjects }
        }
        return b
      }))
    } else {
      // Add new project
      const parentBlock = blocks.find(b => b.id === targetBlockId)
      const newProj = {
        id: 'proj_' + Date.now(),
        name: projectName,
        badge: parentBlock ? parentBlock.badge : 'DA'
      }

      setBlocks(prev => prev.map(b => {
        if (b.id === targetBlockId) {
          return { ...b, projects: [...b.projects, newProj] }
        }
        return b
      }))
    }

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
      () => {
        setBlocks(prev => prev.map(b => {
          if (b.id === blockId) {
            const filtered = b.projects.filter((_, idx) => idx !== projectIndex)
            return { ...b, projects: filtered }
          }
          return b
        }))
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

  const handleProjDrop = (e, destBlockId, destIndex = null) => {
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

    setBlocks(prev => {
      // 1. Remove from source
      const updated = prev.map(b => {
        if (b.id === sourceBlockId) {
          const projs = b.projects.filter((_, idx) => idx !== projectIndex)
          return { ...b, projects: projs }
        }
        return b
      })

      // 2. Add to destination
      return updated.map(b => {
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
    })

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ textAlign: 'left' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building size={20} style={{ color: '#0f58a7' }} />
            <span>THIẾT LẬP KHỐI THI CÔNG & DỰ ÁN</span>
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
            Kéo thả tiêu đề cột để thay đổi thứ tự khối. Kéo thả thẻ dự án để di chuyển giữa các khối.
          </p>
        </div>
      </div>

      {/* Kanban Board Container */}
      <div style={{
        display: 'flex', gap: 16, overflowX: 'auto', flex: 1, paddingBottom: 16,
        alignItems: 'flex-start', minHeight: 0
      }}>
        {blocks.map((block, idx) => {
          const isOver = dropOverBlockId === block.id
          return (
            <div
              key={block.id}
              onDragOver={(e) => handleProjDragOver(e, block.id)}
              onDrop={(e) => handleProjDrop(e, block.id)}
              style={{
                width: 280, flexShrink: 0,
                borderRadius: 12, border: `1px solid ${block.borderColor}`,
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)',
                display: 'flex', flexDirection: 'column', maxHeight: '100%',
                transition: 'all 0.2s ease',
                backgroundColor: block.bgColor,
                outline: isOver ? `2px solid ${block.color}` : 'none',
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
                  padding: '12px 14px', borderBottom: `1px solid ${block.borderColor}`,
                  background: block.bgColor, borderTopLeftRadius: 11, borderTopRightRadius: 11,
                  cursor: 'grab', display: 'flex', flexDirection: 'column', gap: 6
                }}
              >
                {/* Header Top: Badge & Actions */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <GripVertical size={14} style={{ color: block.color, cursor: 'grab', opacity: 0.6 }} />
                    <span style={{
                      background: block.color, color: '#ffffff',
                      fontFamily: '"Roboto", sans-serif',
                      fontSize: 12, fontWeight: 800, padding: '2.5px 8px',
                      borderRadius: 4, letterSpacing: '0.02em'
                    }}>
                      {block.badge}
                    </span>
                  </div>
                  
                  {/* Actions: Edit, Delete */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button 
                      onClick={() => openEditBlock(block)}
                      title="Sửa cột"
                      style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: '#64748b' }}
                      onMouseOver={(e) => e.currentTarget.style.color = '#0f58a7'}
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

                {/* Header Mid: Title */}
                <h3 style={{
                  margin: 0, fontSize: 13, fontWeight: 800, color: '#1e293b',
                  fontFamily: '"Roboto", sans-serif',
                  textAlign: 'left', textTransform: 'uppercase', lineHeight: 1.3
                }}>
                  {block.name}
                </h3>

                {/* Header Bottom: Stats */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, fontSize: 11,
                  fontFamily: '"Roboto", sans-serif',
                  color: '#64748b', fontWeight: 600
                }}>
                  <span>{block.projects.length} DỰ ÁN</span>
                  <span>•</span>
                  <span>Kéo tiêu đề để đổi vị trí</span>
                </div>
              </div>

              {/* Column Body: Project List */}
              <div style={{
                padding: '12px', overflowY: 'auto', display: 'flex',
                flexDirection: 'column', gap: 8, flex: 1, minHeight: 120
              }}>
                {block.projects.length === 0 ? (
                  <div style={{
                    border: '1.5px dashed rgba(148, 163, 184, 0.5)', borderRadius: 8,
                    padding: '24px 12px', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', color: '#64748b', fontSize: 12,
                    fontFamily: '"Roboto", sans-serif',
                    fontWeight: 600, background: 'rgba(255, 255, 255, 0.45)'
                  }}>
                    Kéo dự án vào đây
                  </div>
                ) : (
                  block.projects.map((proj, pIdx) => (
                    <div
                      key={proj.id}
                      draggable
                      onDragStart={(e) => handleProjDragStart(e, block.id, pIdx, proj)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleProjDrop(e, block.id, pIdx)}
                      style={{
                        padding: '10px 12px', background: '#ffffff', borderRadius: 8,
                        border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between', cursor: 'grab',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.borderColor = block.borderColor
                        e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05)'
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.borderColor = '#e2e8f0'
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                        <GripVertical size={13} style={{ color: '#94a3b8', cursor: 'grab', flexShrink: 0 }} />
                        <span style={{
                          background: block.color, color: '#ffffff',
                          fontFamily: '"Roboto", sans-serif',
                          fontSize: 12, fontWeight: 800, padding: '2px 6px',
                          borderRadius: 3, flexShrink: 0
                        }}>
                          {block.badge}
                        </span>
                        <strong style={{
                          fontFamily: '"Roboto", sans-serif',
                          fontSize: 12, color: '#334155', fontWeight: 600,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          textAlign: 'left'
                        }}>
                          {proj.name}
                        </strong>
                      </div>

                      {/* Project actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 4, flexShrink: 0 }}>
                        <button
                          onClick={() => openEditProject(block.id, pIdx, proj)}
                          style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: '#94a3b8' }}
                          onMouseOver={(e) => e.currentTarget.style.color = '#0f58a7'}
                          onMouseOut={(e) => e.currentTarget.style.color = '#94a3b8'}
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          onClick={() => handleDeleteProject(block.id, pIdx)}
                          style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: '#94a3b8' }}
                          onMouseOver={(e) => e.currentTarget.style.color = '#ef4444'}
                          onMouseOut={(e) => e.currentTarget.style.color = '#94a3b8'}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Column Footer */}
              <div style={{ padding: '8px 12px 12px', borderTop: '1px solid #f1f5f9' }}>
                <button
                  onClick={() => openAddProject(block.id)}
                  style={{
                    width: '100%', padding: '6px 12px', background: 'none',
                    border: '1px dashed #cbd5e1', borderRadius: 6, color: '#64748b',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    transition: 'all 0.15s'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = block.bgColor
                    e.currentTarget.style.borderColor = block.borderColor
                    e.currentTarget.style.color = block.color
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'none'
                    e.currentTarget.style.borderColor = '#cbd5e1'
                    e.currentTarget.style.color = '#64748b'
                  }}
                >
                  <Plus size={13} />
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
            width: 280, height: 110, flexShrink: 0, background: '#ffffff',
            border: '2px dashed #cbd5e1', borderRadius: 12, cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 8, transition: 'all 0.2s',
            boxShadow: 'none'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.borderColor = '#0f58a7'
            e.currentTarget.style.background = '#f0f4f9'
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.borderColor = '#cbd5e1'
            e.currentTarget.style.background = '#ffffff'
          }}
        >
          <div style={{
            background: '#eff6ff', color: '#0f58a7', padding: 8, borderRadius: '50%'
          }}>
            <Plus size={18} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>Thêm khối mới</span>
        </button>
      </div>

      {/* Bottom Sticky Action Bar */}
      <div style={{
        marginTop: 16, borderTop: '1px solid #e2e8f0', paddingTop: 16,
        display: 'flex', justifyContent: 'flex-end', gap: 12, background: 'transparent'
      }}>
        <button
          onClick={handleCancelConfig}
          style={{
            background: 'none', border: 'none', color: '#64748b', cursor: 'pointer',
            padding: '8px 20px', fontSize: 13.5, fontWeight: 700, borderRadius: 8,
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          Hủy bỏ
        </button>
        <button
          onClick={handleSaveConfig}
          style={{
            background: '#3b82f6', color: '#ffffff', border: 'none',
            padding: '8px 24px', fontSize: 13.5, fontWeight: 700, borderRadius: 8,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
            boxShadow: '0 4px 6px -1px rgba(59,130,246,0.2)'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = '#2563eb'}
          onMouseOut={(e) => e.currentTarget.style.background = '#3b82f6'}
        >
          <Check size={16} />
          <span>Lưu cấu hình</span>
        </button>
      </div>

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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
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
