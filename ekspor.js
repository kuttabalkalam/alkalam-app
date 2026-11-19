/* ekspor.js - Ekspor tabel ke CSV, Excel (.xls), atau PDF
   Pemakaian: EKSPOR.unduh("Judul", elemenTabel, "nama-file") */
const EKSPOR = (() => {
  const LIB = {
    xlsx: "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
    jspdf: "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js",
    autotable: "https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js"
  };
  const sudah = {};

  function muatScript(src) {
    return new Promise((ok, gagal) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = ok;
      s.onerror = () => gagal(new Error("Gagal memuat pustaka ekspor. Periksa koneksi internet."));
      document.head.appendChild(s);
    });
  }

  function muat(k) {
    if (!sudah[k]) sudah[k] = muatScript(LIB[k]);
    return sudah[k];
  }

  const bersih = s => String(s ?? "").replace(/\s+/g, " ").trim();

  // Nilai satu sel: select = opsi terpilih, checkbox = Ya/Tidak, input = nilainya, tombol = kosong
  function nilaiSel(td) {
    const sel = td.querySelector("select");
    if (sel) return bersih(sel.selectedOptions[0] ? sel.selectedOptions[0].textContent : "");
    const cb = td.querySelector('input[type="checkbox"]');
    if (cb) return cb.checked ? "Ya" : "Tidak";
    const inp = td.querySelector("input");
    if (inp) return bersih(inp.value);
    if (td.querySelector("button")) return "";
    return bersih(td.textContent);
  }

  // Membaca header dan isi tabel. Kolom Aksi dan kolom centang dilewati.
  function dariTabel(tbl) {
    const ths = [...tbl.querySelectorAll("thead th")];
    const lewati = ths.map(th => {
      const teks = bersih(th.textContent);
      return teks === "" || teks === "Aksi" || th.querySelector('input[type="checkbox"]') !== null;
    });
    const head = ths.filter((_, i) => !lewati[i]).map(th => bersih(th.textContent));
    const rows = [...tbl.querySelectorAll("tbody tr")].map(tr =>
      [...tr.querySelectorAll("td")].filter((_, i) => !lewati[i]).map(td => nilaiSel(td)));
    return { head, rows };
  }

  const kutip = v => {
    const s = v == null ? "" : String(v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };

  function unduhCsv(head, rows, namaFile) {
    const isi = [head, ...rows].map(r => r.map(kutip).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + isi], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = namaFile + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function unduhXls(head, rows, namaFile) {
    await muat("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([head, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, namaFile + ".xls", { bookType: "biff8" });
  }

  async function unduhPdf(judul, head, rows, namaFile) {
    await muat("jspdf");
    await muat("autotable");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFontSize(12);
    doc.text(judul, 14, 14);
    doc.autoTable({
      head: [head],
      body: rows,
      startY: 20,
      margin: { left: 10, right: 10 },
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [26, 26, 26], textColor: [242, 201, 76] }
    });
    doc.save(namaFile + ".pdf");
  }

  async function unduh(judul, tbl, namaFile) {
    if (!tbl) {
      return Swal.fire({ icon: "warning", title: "Belum ada tabel", text: "Tampilkan data terlebih dahulu." });
    }
    const { head, rows } = dariTabel(tbl);
    if (!rows.length) {
      return Swal.fire({ icon: "info", title: "Tidak ada data", text: "Tabel masih kosong." });
    }

    const pilihan = await Swal.fire({
      title: "Ekspor " + judul,
      input: "radio",
      inputOptions: { csv: "CSV (.csv)", xls: "Excel (.xls)", pdf: "PDF (.pdf)" },
      inputValue: "csv",
      showCancelButton: true,
      confirmButtonText: "Unduh",
      cancelButtonText: "Batal",
      confirmButtonColor: "#1a1a1a"
    });
    if (!pilihan.isConfirmed) return;

    try {
      if (pilihan.value === "csv") unduhCsv(head, rows, namaFile);
      else if (pilihan.value === "xls") await unduhXls(head, rows, namaFile);
      else await unduhPdf(judul, head, rows, namaFile);
    } catch (e) {
      Swal.fire({ icon: "error", title: "Gagal mengekspor", text: e.message });
    }
  }

  return { unduh, dariTabel };
})();
