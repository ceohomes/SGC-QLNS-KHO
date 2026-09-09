import React from 'react'
import EditModal from './EditModal.jsx'

export default function DetailModal({ row, onClose, onEdit, onSave, onDelete, showConfirm, blocksConfig }) {
  return (
    <EditModal
      row={row}
      onClose={onClose}
      onSave={onSave || (async () => onClose && onClose())}
      onDelete={onDelete}
      showConfirm={showConfirm}
      blocksConfig={blocksConfig}
    />
  )
}
