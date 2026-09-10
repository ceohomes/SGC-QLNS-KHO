// Trích xuất thông tin ứng viên bằng luật (regex) khi không có Gemini API Key,
// hoặc dùng làm nền để Gemini bổ sung thêm. Port nguyên logic từ server.ts —
// thuần chuỗi/regex, không phụ thuộc Node, chạy được trên Cloudflare Workers.

export function extractCandidateName(fileName, text) {
  const lines = (text || "")
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  const blacklist = /curriculum|vitae|resume|thông tin|hồ sơ|mục tiêu|kinh nghiệm|học vấn|kỹ năng|chứng chỉ|cộng hòa|độc lập|hạnh phúc|quản lý|thủ kho|chuyên viên|giới thiệu|bảng điểm/i;

  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const line = lines[i];
    if (blacklist.test(line)) continue;
    if (/^[A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ][a-zà-ỹ]+(\s+[A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ][a-zà-ỹ]+){1,4}$/.test(line)) {
      return line;
    }
  }

  const nameLabelMatch = (text || "").match(/(?:họ\s*(?:và|&)?\s*tên|full\s*name|candidate\s*name)[\s:]*([A-ZÀ-Ỵ][a-zà-ỹ\s]+)/i);
  if (nameLabelMatch && nameLabelMatch[1] && nameLabelMatch[1].trim().length > 3) {
    return nameLabelMatch[1].trim();
  }

  let fn = fileName
    .replace(/\.[^/.]+$/, "")
    .replace(/^(cv|hoso|resume)[_\s-]?/i, "")
    .replace(/[_\s-]?(cv|resume|sgc)$/i, "")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (fn && fn.length > 2) {
    return fn
      .split(" ")
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }

  return "Ứng viên Thủ kho SGC";
}

export function fallbackHeuristicExtract(text, fileName) {
  const clean = text || "";

  const phoneMatch = clean.match(/(?:(?:\+84|0)[\s.-]?[35789][0-9\s.-]{7,13}[0-9])\b/);
  let soDienThoai = "";
  if (phoneMatch) {
    const rawDigits = phoneMatch[0].replace(/[\s.-]/g, "");
    if (rawDigits.length === 10) {
      soDienThoai = rawDigits.replace(/(\d{4})(\d{3})(\d{3})/, "$1 $2 $3");
    } else {
      soDienThoai = phoneMatch[0].trim();
    }
  }

  const emailMatch = clean.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i);
  const email = emailMatch ? emailMatch[0].trim() : "";

  const hoTen = extractCandidateName(fileName, clean);

  let ngaySinh = "";
  const dobMatch = clean.match(/(?:ngày sinh|năm sinh|dob|sinh ngày|sinh\s*:?)[\s:]*([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{4}|[0-9]{4})/i);
  if (dobMatch) {
    ngaySinh = dobMatch[1].replace(/-/g, "/");
  } else {
    const generalDateMatch = clean.slice(0, 1000).match(/\b([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})\b/);
    if (generalDateMatch) {
      ngaySinh = generalDateMatch[1];
    }
  }

  let diaChi = "";
  const addrMatch = clean.match(/(?:địa chỉ|thường trú|tạm trú|nơi ở)[\s:]*([^\n\r]+)/i);
  if (addrMatch) {
    diaChi = addrMatch[1].trim();
  } else {
    const vnAddrMatch = clean.match(/(?:thôn|xóm|số|ngõ|ngách|đường|xã|phường|quận|huyện)[^,\n]+(?:,\s*[^,\n]+){1,3}/i);
    if (vnAddrMatch) {
      diaChi = vnAddrMatch[0].trim();
    }
  }

  let soNamKinhNghiem = 1;
  const expMatch = clean.match(/([0-9]+)\s*(?:năm|nam)\s*(?:kinh nghiệm|kn)/i);
  if (expMatch) {
    soNamKinhNghiem = parseInt(expMatch[1], 10);
  } else {
    const yearMatches = Array.from(clean.matchAll(/\b(201\d|202\d)\b/g)).map(m => parseInt(m[1], 10));
    if (yearMatches.length >= 2) {
      const minYear = Math.min(...yearMatches);
      const maxYear = Math.max(...yearMatches);
      const span = maxYear - minYear;
      if (span > 0 && span <= 20) {
        soNamKinhNghiem = Math.min(span, 10);
      }
    }
  }

  const cccdMatch = clean.match(/\b(0[0-9]{11}|[0-9]{9})\b/);
  const cccd = cccdMatch ? cccdMatch[0] : "";

  let trinhDo = "Trung cấp";
  if (/thạc sĩ|thac si|master/i.test(clean)) {
    trinhDo = "Thạc sĩ";
  } else if (/tiến sĩ|tien si|phd/i.test(clean)) {
    trinhDo = "Tiến sĩ";
  } else if (/đại học|dai hoc|cử nhân|cu nhan|bachelor/i.test(clean)) {
    trinhDo = "Đại học";
  } else if (/cao đẳng|cao dang/i.test(clean)) {
    trinhDo = "Cao đẳng";
  }

  let chuyenNganh = "Quản trị kho vận / Xây dựng";
  if (/kế toán|ke toan/i.test(clean)) {
    chuyenNganh = "Kế toán / Quản lý vật tư";
  } else if (/tài chính|tai chinh/i.test(clean)) {
    chuyenNganh = "Tài chính - Ngân hàng";
  } else if (/xây dựng|xay dung/i.test(clean)) {
    chuyenNganh = "Kỹ thuật Xây dựng";
  } else if (/logistics|xuất nhập khẩu/i.test(clean)) {
    chuyenNganh = "Logistics & Chuỗi cung ứng";
  }

  let chucVu = "Thủ kho";
  if (/trưởng nhóm|truong nhom/i.test(clean)) {
    chucVu = "Trưởng nhóm kho dự án";
  } else if (/hiện trường|hien truong/i.test(clean)) {
    chucVu = "Thủ kho hiện trường";
  } else if (/nhập liệu|nhap lieu/i.test(clean)) {
    chucVu = "Thủ kho nhập liệu";
  } else if (/phụ kho|phu kho/i.test(clean)) {
    chucVu = "Phụ kho";
  }

  const isFemale = /\bnữ\b|nu\b|female/i.test(clean);
  const gioiTinh = isFemale ? "Nữ" : "Nam";

  const skillsList = [];
  if (/sap\b/i.test(clean)) skillsList.push("SAP");
  if (/excel/i.test(clean)) skillsList.push("Excel");
  if (/kiểm kê|kiem ke/i.test(clean)) skillsList.push("Kiểm kê kho bãi");
  if (/nhập xuất tồn|nhap xuat ton/i.test(clean)) skillsList.push("Quản lý xuất nhập tồn");
  if (/pr|po|migo/i.test(clean)) skillsList.push("PR, PO, Migo");
  if (/xe nâng/i.test(clean)) skillsList.push("Lái xe nâng");
  if (skillsList.length === 0) {
    skillsList.push("Excel", "Quản lý kho bãi", "Kiểm đếm hàng hóa");
  }

  let kinhNghiem = "Có kinh nghiệm thực tế quản lý vật tư, theo dõi xuất nhập tồn và đối chiếu số liệu kho.";
  const knBlock = clean.match(/(?:kinh nghiệm làm việc|kinh nghiệm|quá trình làm việc)[\s:]*([\s\S]{50,400}?)(?=\n\s*(?:học vấn|kỹ năng|mục tiêu|$))/i);
  if (knBlock && knBlock[1]) {
    kinhNghiem = knBlock[1].replace(/\r?\n+/g, " ").trim().slice(0, 350);
  }

  return {
    hoTen: hoTen || "Ứng viên Thủ kho SGC",
    soDienThoai,
    email,
    ngaySinh,
    gioiTinh,
    cccd,
    queQuan: "",
    diaChi,
    chucVu,
    duAn: "",
    trinhDo,
    chuyenNganh,
    soNamKinhNghiem,
    kinhNghiem,
    kyNang: skillsList.join(", "),
    chungChi: "Chứng chỉ ATLĐ",
    aiDanhGia: `Ứng viên có trình độ ${trinhDo} (${chuyenNganh}), có ${soNamKinhNghiem} năm kinh nghiệm thực tế trong công tác quản lý kho và vật tư, phù hợp phỏng vấn vị trí ${chucVu}.`,
    diemPhuHop: 8.5,
    isParsedWithAI: false
  };
}
