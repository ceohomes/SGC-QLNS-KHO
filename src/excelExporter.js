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

// Chuyển mã màu hex dạng webapp (#RRGGBB hoặc RRGGBB) sang định dạng ARGB dùng cho ExcelJS
function toArgb(hex, fallback) {
  if (!hex) return fallback;
  const clean = String(hex).trim().replace('#', '').toUpperCase();
  if (clean.length === 6) return clean;
  if (clean.length === 3) return clean.split('').map(c => c + c).join('');
  return fallback;
}

// Xuất Excel danh sách Định biên dạng cây có thể thu gọn/mở rộng (Excel Group/Outline):
// Mỗi Dự án (khối) là 1 dòng chính (cấp 0) -> mỗi Ngăn kho là 1 dòng chính con (cấp 1) -> mỗi thủ kho là 1 dòng chi tiết (cấp 2)
// blocksData: [{ name: 'Tên Dự án', projects: [{ name: 'Tên Ngăn kho', staff: [{ maNV, hoTen, chucVu, soDienThoai }] }] }]
export async function exportDinhBienTheoNganKho(blocksData) {
  if (!blocksData || blocksData.length === 0) return;

  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Định biên theo Ngăn kho');

    // Cho phép nút thu gọn (-) hiển thị ở dòng cha (phía trên nhóm chi tiết) thay vì phía dưới
    worksheet.properties.outlineProperties = { summaryBelow: false, summaryRight: false };

    worksheet.columns = [
      { header: 'STT', key: 'stt', width: 8 },
      { header: 'Dự án / Ngăn kho / Thủ kho', key: 'label', width: 42 },
      { header: 'Mã NV', key: 'maNV', width: 14 },
      { header: 'Họ và tên', key: 'hoTen', width: 26 },
      { header: 'Chức danh', key: 'chucVu', width: 22 },
      { header: 'Điện thoại di động', key: 'soDienThoai', width: 20 }
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.height = 32;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0F58A7' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: '1062B8' } },
        left: { style: 'thin', color: { argb: '1062B8' } },
        bottom: { style: 'medium', color: { argb: '0c4685' } },
        right: { style: 'thin', color: { argb: '1062B8' } }
      };
    });

    let staffCounter = 0;

    blocksData.forEach((block) => {
      // Dòng chính: Dự án (khối) - cấp 0, luôn hiển thị (không thu gọn dòng này)
      const totalStaffInBlock = block.projects.reduce((s, p) => s + (p.staff ? p.staff.length : 0), 0);
      const blockRow = worksheet.addRow({
        stt: '',
        label: `${block.name} (${block.projects.length} ngăn kho · ${totalStaffInBlock} thủ kho)`,
        maNV: '', hoTen: '', chucVu: '', soDienThoai: ''
      });
      blockRow.outlineLevel = 0;
      blockRow.height = 26;
      const blockBg = toArgb(block.badgeBg, '0F58A7');
      const blockFont = toArgb(block.color, 'FFFFFF');
      blockRow.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: blockFont } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: blockBg } };
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      });

      block.projects.forEach((project) => {
        const staffList = project.staff || [];
        // Dòng chính: Ngăn kho - cấp 1 (thuộc nhóm của dòng Dự án phía trên, sẽ ẩn/hiện cùng nhóm)
        const projectRow = worksheet.addRow({
          stt: '',
          label: `      ${project.name} (${staffList.length} thủ kho)`,
          maNV: '', hoTen: '', chucVu: '', soDienThoai: ''
        });
        projectRow.outlineLevel = 1;
        projectRow.height = 23;
        projectRow.eachCell((cell) => {
          cell.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: '0F58A7' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EFF6FF' } };
          cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        });

        if (staffList.length === 0) {
          const emptyRow = worksheet.addRow({
            stt: '', label: '            Chưa có thủ kho', maNV: '', hoTen: '', chucVu: '', soDienThoai: ''
          });
          emptyRow.outlineLevel = 2;
          emptyRow.height = 20;
          emptyRow.eachCell((cell) => {
            cell.font = { name: 'Arial', size: 10, italic: true, color: { argb: '94A3B8' } };
            cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
          });
        } else {
          staffList.forEach((tk) => {
            staffCounter++;
            const staffRow = worksheet.addRow({
              stt: staffCounter,
              label: `            ${tk.hoTen || ''}`,
              maNV: tk.maNV || '',
              hoTen: tk.hoTen || '',
              chucVu: tk.chucVu || '',
              soDienThoai: tk.soDienThoai || ''
            });
            staffRow.outlineLevel = 2;
            staffRow.height = 20;
            staffRow.eachCell((cell, colNumber) => {
              const headerKey = worksheet.columns[colNumber - 1].key;
              cell.font = {
                name: 'Arial', size: 10,
                bold: headerKey === 'maNV' || headerKey === 'hoTen',
                color: { argb: headerKey === 'maNV' ? '0F58A7' : '1B1919' }
              };
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: staffCounter % 2 === 0 ? 'F8FAFC' : 'FFFFFF' } };
              cell.alignment = {
                vertical: 'middle',
                horizontal: ['stt', 'maNV', 'chucVu', 'soDienThoai'].includes(headerKey) ? 'center' : 'left',
                wrapText: true
              };
              cell.border = {
                top: { style: 'thin', color: { argb: 'E2E8F0' } },
                left: { style: 'thin', color: { argb: 'CBD5E1' } },
                bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
                right: { style: 'thin', color: { argb: 'CBD5E1' } }
              };
            });
          });
        }
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'Dinh_Bien_Theo_Ngan_Kho_SGC_Export.xlsx';
    anchor.click();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Lỗi khi xuất tệp Excel định biên theo ngăn kho:', err);
  }
}

