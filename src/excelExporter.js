import ExcelJS from 'exceljs'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const parts = String(dateStr).split('-')
  if (parts.length !== 3) return dateStr
  const [y, m, d] = parts
  return `${d}/${m}/${y}`
}

export async function exportThuKhoExcel(data) {
  if (!data || data.length === 0) return;

  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('DS Thủ kho SGC');

    worksheet.columns = [
      { header: 'STT', key: 'stt', width: 8 },
      { header: 'Khối thi công', key: 'banChuoiKhoi', width: 24 },
      { header: 'Dự án / Công trình', key: 'duAn', width: 36 },
      { header: 'Mã NV', key: 'maNV', width: 14 },
      { header: 'Họ và tên', key: 'hoTen', width: 26 },
      { header: 'Chức danh', key: 'chucVu', width: 20 },
      { header: 'Điện thoại di động', key: 'soDienThoai', width: 20 },
      { header: 'Email công ty', key: 'emailCongTy', width: 28 },
      { header: 'Ngày sinh', key: 'ngaySinh', width: 16 },
      { header: 'Trình độ', key: 'trinhDo', width: 18 },
      { header: 'Trạng thái', key: 'trangThai', width: 20 },
      { header: 'Đánh giá', key: 'danhGiaHieuSuat', width: 16 }
    ];

    data.forEach((item) => {
      worksheet.addRow({
        stt: item.stt,
        banChuoiKhoi: item.banChuoiKhoi,
        duAn: item.duAn,
        maNV: item.maNV,
        hoTen: item.hoTen,
        chucVu: item.chucVu,
        soDienThoai: item.soDienThoai,
        emailCongTy: item.emailCongTy,
        ngaySinh: formatDate(item.ngaySinh),
        trinhDo: item.trinhDo,
        trangThai: item.trangThai,
        danhGiaHieuSuat: item.danhGiaHieuSuat
      });
    });

    // Set autofilter on the header row
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: worksheet.columns.length }
    };

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.height = 32;
    headerRow.eachCell((cell) => {
      cell.font = {
        name: 'Arial',
        size: 11,
        bold: true,
        color: { argb: 'FFFFFF' }
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '0F58A7' } // SGC Blue: #0f58a7
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true
      };
      cell.border = {
        top: { style: 'thin', color: { argb: '1062B8' } },
        left: { style: 'thin', color: { argb: '1062B8' } },
        bottom: { style: 'medium', color: { argb: '0c4685' } },
        right: { style: 'thin', color: { argb: '1062B8' } }
      };
    });

    // Style data rows
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header row to preserve its styles
      row.height = 25;
      const isEven = rowNumber % 2 === 0;
      const defaultBg = isEven ? 'F8FAFC' : 'FFFFFF';
      
      row.eachCell((cell, colNumber) => {
        const headerKey = worksheet.columns[colNumber - 1].key;
        let fontColor = '1B1919';
        let isBold = false;
        let cellBg = defaultBg;
        let borderTopColor = 'E2E8F0';
        let borderBottomColor = 'E2E8F0';
        let borderLeftColor = 'CBD5E1';
        let borderRightColor = 'CBD5E1';
        
        if (headerKey === 'maNV') {
          fontColor = '0F58A7'; // SGC Primary Blue
          isBold = true;
        } else if (headerKey === 'hoTen') {
          isBold = true;
        } else if (headerKey === 'chucVu') {
          const val = cell.value ? String(cell.value).trim() : '';
          if (val === 'Thủ kho trưởng' || val === 'Thủ kho trưởng hiện trường' || val === 'Thủ kho nhập liệu') {
            cellBg = 'EFF6FF';
            fontColor = '1D4ED8';
            borderLeftColor = 'BFDBFE';
            borderRightColor = 'BFDBFE';
          } else if (val === 'Thủ kho' || val === 'Thủ kho hiện trường') {
            cellBg = 'F5F3FF';
            fontColor = '6D28D9';
            borderLeftColor = 'DDD6FE';
            borderRightColor = 'DDD6FE';
          } else if (val === 'Trưởng nhóm kho' || val === 'Trưởng nhóm kho dự án' || val === 'Trưởng nhóm Kho') {
            cellBg = 'ECFDF5';
            fontColor = '047857';
            borderLeftColor = 'A7F3D0';
            borderRightColor = 'A7F3D0';
          } else if (val) {
            cellBg = 'F8FAFC';
            fontColor = '475569';
            borderLeftColor = 'E2E8F0';
            borderRightColor = 'E2E8F0';
          }
        } else if (headerKey === 'trangThai') {
          const val = cell.value ? String(cell.value).trim() : '';
          if (val === 'Đang làm việc') {
            cellBg = 'ECFDF5';
            fontColor = '065F46';
            borderLeftColor = 'A7F3D0';
            borderRightColor = 'A7F3D0';
          } else if (val === 'Nghỉ phép') {
            cellBg = 'FFFBEB';
            fontColor = '92400E';
            borderLeftColor = 'FDE68A';
            borderRightColor = 'FDE68A';
          } else if (val === 'Đã nghỉ việc') {
            cellBg = 'F8FAFC';
            fontColor = '475569';
            borderLeftColor = 'E2E8F0';
            borderRightColor = 'E2E8F0';
          } else if (val) {
            cellBg = 'F8FAFC';
            fontColor = '475569';
            borderLeftColor = 'E2E8F0';
            borderRightColor = 'E2E8F0';
          }
        } else if (headerKey === 'danhGiaHieuSuat') {
          const val = cell.value ? String(cell.value).trim() : '';
          if (val === 'Xuất sắc') {
            cellBg = 'ECFDF5';
            fontColor = '065F46';
            borderLeftColor = 'A7F3D0';
            borderRightColor = 'A7F3D0';
          } else if (val === 'Tốt') {
            cellBg = 'EFF6FF';
            fontColor = '1D4ED8';
            borderLeftColor = 'BFDBFE';
            borderRightColor = 'BFDBFE';
          } else if (val === 'Khá') {
            cellBg = 'FFFBEB';
            fontColor = '92400E';
            borderLeftColor = 'FDE68A';
            borderRightColor = 'FDE68A';
          } else if (val) {
            cellBg = 'F8FAFC';
            fontColor = '475569';
            borderLeftColor = 'E2E8F0';
            borderRightColor = 'E2E8F0';
          }
        }

        cell.font = {
          name: 'Arial',
          size: 10,
          bold: isBold,
          color: { argb: fontColor }
        };
        
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: cellBg }
        };
        
        // Alignment
        if (['stt', 'maNV', 'chucVu', 'soDienThoai', 'ngaySinh', 'trangThai', 'danhGiaHieuSuat'].includes(headerKey)) {
          cell.alignment = {
            vertical: 'middle',
            horizontal: 'center'
          };
        } else {
          cell.alignment = {
            vertical: 'middle',
            horizontal: 'left'
          };
        }
        
        cell.border = {
          top: { style: 'thin', color: { argb: borderTopColor } },
          left: { style: 'thin', color: { argb: borderLeftColor } },
          bottom: { style: 'thin', color: { argb: borderBottomColor } },
          right: { style: 'thin', color: { argb: borderRightColor } }
        };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'Danh_Sach_Thu_Kho_SGC_Export.xlsx';
    anchor.click();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Lỗi khi xuất tệp Excel:', err);
  }
}

