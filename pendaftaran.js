const SUPABASE_URL = "https://epynlmuqxumuwcjsrnsz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Oq_to1zgHLnachvWYLV_yA_DoOTGI3s";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

const TIPE = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };
const MAKS = 2 * 1024 * 1024;
const PEKERJAAN = ["PNS / ASN", "Karyawan Swasta", "Wirausaha / Dagang", "Pekerja Lepas / Freelance", "Tidak Bekerja"];
const PENGHASILAN = ["Tidak Ada", "s/d 3 juta", "s/d 5 juta", "s/d 10 juta", "s/d 15 juta", ">20 juta"];

// Wilayah dari berkas wilayah.json di repositori. Default: Banten, Kota Tangerang Selatan
const DEF_PROV = "36";
const DEF_KOTA = "3674";
const LAIN = "__lain";
const LEVEL = [["prov", "Provinsi"], ["kota", "Kota/Kabupaten"], ["kec", "Kecamatan"], ["desa", "Desa/Kelurahan"]];
const ANAK = { prov: "kota", kota: "kec", kec: "desa" };
const URUT = ["prov", "kota", "kec", "desa"];
const NAMA = { prov: "provinsi", kota: "kota/kabupaten", kec: "kecamatan", desa: "desa/kelurahan" };
const KOSONG = { prov: "-- pilih provinsi --", kota: "-- pilih kota/kabupaten --", kec: "-- pilih kecamatan --", desa: "-- pilih desa/kelurahan --" };
const LAIN_OK = { prov: false, kota: false, kec: true, desa: true };

let PENDAFTARAN_BUKA = false;
let CACHE = null;

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const val = id => $(id).value.trim();
const upper = s => (s || "").trim().toUpperCase();
const titleCase = s => (s || "").trim().toLowerCase().replace(/(^|\s)\S/g, m => m.toUpperCase());
const digits = s => (s || "").replace(/\D/g, "");
const pesan = t => { $("pesan").textContent = t; };
const status = t => { $("status").textContent = t; };

function normHp(v) {
  let b = digits(v);
  if (b.startsWith("0")) b = "62" + b.slice(1);
  return /^62[0-9]{8,13}$/.test(b) ? b : null;
}

function isiSelect(id, list) {
  $(id).innerHTML = `<option value="">-- pilih --</option>` + list.map(x => `<option value="${x}">${x}</option>`).join("");
}

function cekBerkas(f) {
  if (!f) return "Unggah bukti transfer terlebih dahulu.";
  if (!TIPE[f.type]) return "Bukti transfer harus berupa JPG, PNG, atau PDF.";
  if (f.size > MAKS) return "Ukuran bukti transfer maksimal 2 MB.";
  return null;
}

async function unggahBukti(f) {
  const path = "pending/" + crypto.randomUUID() + "/bukti." + TIPE[f.type];
  const { error } = await sb.storage.from("bukti-bayar").upload(path, f, { contentType: f.type, upsert: false });
  if (error) throw new Error("Gagal mengunggah bukti transfer. Periksa koneksi lalu coba lagi.");
  return path;
}

// ===== Wilayah =====
async function muatWilayah() {
  if (!CACHE) {
    const r = await fetch("wilayah.json?v=1");
    if (!r.ok) throw new Error("gagal");
    CACHE = await r.json();
  }
  return CACHE;
}

async function ambilList(lv, id) {
  const d = await muatWilayah();
  if (lv === "prov") return d.provinsi;
  if (lv === "kota") return d.kota[id] || [];
  if (lv === "kec") return d.kecamatan[id] || [];
  return d.desa[id] || [];
}

function blokWilayah(p) {
  return `<div class="form-row">${LEVEL.map(([lv, label]) => `
      <div class="col-md-6 form-group">
        <label class="small mb-1">${label} *</label>
        <select id="${p}_${lv}" class="form-control" disabled><option value="">Memuat...</option></select>
        <input id="${p}_${lv}_lain" class="form-control mt-1 d-none" placeholder="Tulis ${label.toLowerCase()}">
      </div>`).join("")}</div>
    <div class="small text-danger d-none" id="${p}_err">
      Daftar wilayah belum bisa dimuat. <a href="#" id="${p}_retry">Muat ulang</a>.
    </div>`;
}

const opsi = (list, kosong, lain) =>
  `<option value="">${kosong}</option>` +
  list.map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join("") +
  (lain ? `<option value="${LAIN}">Lainnya (ketik manual)</option>` : "");

const setLain = (p, lv, on) => $(p + "_" + lv + "_lain").classList.toggle("d-none", !on);

function resetDari(p, lv) {
  URUT.slice(URUT.indexOf(lv)).forEach(x => {
    const sel = $(p + "_" + x);
    const induk = URUT[URUT.indexOf(x) - 1];
    sel.innerHTML = `<option value="">-- pilih ${NAMA[induk] || "provinsi"} dulu --</option>`;
    sel.value = "";
    sel.disabled = true;
    setLain(p, x, false);
  });
}

async function isiLevel(p, lv, id, kosong) {
  const sel = $(p + "_" + lv);
  sel.disabled = true;
  sel.innerHTML = '<option value="">Memuat...</option>';
  try {
    const list = await ambilList(lv, id);
    sel.innerHTML = opsi(list, kosong, LAIN_OK[lv]);
    sel.disabled = false;
    $(p + "_err").classList.add("d-none");
    return true;
  } catch (e) {
    sel.innerHTML = '<option value="">-- gagal memuat --</option>' +
      (LAIN_OK[lv] ? `<option value="${LAIN}">Lainnya (ketik manual)</option>` : "");
    sel.disabled = false;
    $(p + "_err").classList.remove("d-none");
    return false;
  }
}

async function muatKota(p, provId) {
  resetDari(p, "kota");
  if (provId) await isiLevel(p, "kota", provId, KOSONG.kota);
}

async function muatKec(p, kotaId) {
  resetDari(p, "kec");
  if (kotaId) await isiLevel(p, "kec", kotaId, KOSONG.kec);
}

function manualDesa(p) {
  const sel = $(p + "_desa");
  sel.innerHTML = `<option value="${LAIN}">Lainnya (ketik manual)</option>`;
  sel.value = LAIN;
  sel.disabled = true;
  setLain(p, "desa", true);
}

async function muatDesa(p, kecId) {
  resetDari(p, "desa");
  if (!kecId) return;
  if (kecId === LAIN) return manualDesa(p);
  await isiLevel(p, "desa", kecId, KOSONG.desa);
}

async function initWilayah(p) {
  const ok = await isiLevel(p, "prov", "", KOSONG.prov);
  if (!ok) return;
  $(p + "_prov").value = DEF_PROV;
  await muatKota(p, DEF_PROV);
  if ($(p + "_kota").querySelector(`option[value="${DEF_KOTA}"]`)) {
    $(p + "_kota").value = DEF_KOTA;
    await muatKec(p, DEF_KOTA);
  }
}

function pasangWilayah(p) {
  $(p + "_retry").onclick = e => { e.preventDefault(); initWilayah(p); };
  $(p + "_prov").onchange = () => muatKota(p, $(p + "_prov").value);
  $(p + "_kota").onchange = () => muatKec(p, $(p + "_kota").value);
  $(p + "_kec").onchange = () => {
    const v = $(p + "_kec").value;
    setLain(p, "kec", v === LAIN);
    muatDesa(p, v);
  };
  $(p + "_desa").onchange = () => setLain(p, "desa", $(p + "_desa").value === LAIN);
}

function namaPilih(p, lv) {
  const sel = $(p + "_" + lv);
  if (sel.value === LAIN) return val(p + "_" + lv + "_lain");
  return sel.value ? sel.selectedOptions[0].textContent.trim() : "";
}

function wilayahDari(p) {
  return { kec: namaPilih(p, "kec"), desa: namaPilih(p, "desa") };
}

// ===== Form =====
function atursama() {
  const beda = $("sama").value === "tidak";
  $("kkBox").classList.toggle("d-none", !beda);
  ["alamat_kk", "rt_kk", "rw_kk", "kode_pos"].forEach(id => $(id).required = beda);
}

function cekJenis() {
  const tutup = $("jenis_pendaftaran").value === "Siswa Baru" && !PENDAFTARAN_BUKA;
  $("tutup").textContent = "Pendaftaran siswa baru belum dibuka. Jika ananda pindahan, pilih jenis Pindahan, atau hubungi admin.";
  $("tutup").classList.toggle("d-none", !tutup);
  $("btnKirim").disabled = tutup;
}

async function init() {
  isiSelect("pekerjaan_ayah", PEKERJAAN);
  isiSelect("pekerjaan_ibu", PEKERJAAN);
  isiSelect("penghasilan_ayah", PENGHASILAN);
  isiSelect("penghasilan_ibu", PENGHASILAN);

  $("sama").onchange = atursama;
  atursama();

  $("domWil").innerHTML = blokWilayah("dom");
  $("kkWil").innerHTML = blokWilayah("kk");
  pasangWilayah("dom");
  pasangWilayah("kk");
  initWilayah("dom");
  initWilayah("kk");

  $("anak_ke").onchange = () => $("anak_ke_lain").classList.toggle("d-none", $("anak_ke").value !== "lainnya");
  $("jenis_pendaftaran").onchange = cekJenis;

  const [b, t] = await Promise.all([sb.rpc("pendaftaran_buka"), sb.rpc("tahun_pendaftaran")]);
  PENDAFTARAN_BUKA = b.data === true && !!t.data;
  if (t.data) $("tahunLabel").textContent = "Tahun ajaran " + t.data.replace("-", "/");
  cekJenis();
}

$("formDaftar").addEventListener("submit", async e => {
  e.preventDefault();
  if ($("website").value) return;
  pesan("");

  if (!$("formDaftar").checkValidity()) { $("formDaftar").reportValidity(); return; }

  const nik = digits(val("nik")), nikAyah = digits(val("nik_ayah")), nikIbu = digits(val("nik_ibu"));
  if (nik.length !== 16) return pesan("NIK santri harus 16 digit angka.");
  if (nikAyah.length !== 16 || nikIbu.length !== 16) return pesan("NIK ayah dan ibu harus 16 digit angka.");

  const hpAyah = normHp(val("hp_ayah")), hpIbu = normHp(val("hp_ibu"));
  if (!hpAyah) return pesan("Nomor HP ayah tidak valid. Contoh: 081234567890");
  if (!hpIbu) return pesan("Nomor HP ibu tidak valid. Contoh: 081234567890");

  const anak = $("anak_ke").value === "lainnya" ? val("anak_ke_lain") : $("anak_ke").value;
  if (!/^\d{1,2}$/.test(anak)) return pesan("Pilih anak ke. Jika lainnya, isi dengan angka.");

  const dom = wilayahDari("dom");
  if (!dom.kec || !dom.desa) return pesan("Pilih kecamatan dan desa/kelurahan domisili.");

  const sama = $("sama").value === "ya";
  const kk = sama ? null : wilayahDari("kk");
  if (kk && (!kk.kec || !kk.desa)) return pesan("Pilih kecamatan dan desa/kelurahan sesuai KK.");

  const waliTelp = digits(val("wali_telp"));
  if (waliTelp && !/^\d{8,15}$/.test(waliTelp)) return pesan("No. telp wali tidak valid.");

  const f = $("bukti").files[0];
  const errBerkas = cekBerkas(f);
  if (errBerkas) return pesan(errBerkas);

  $("btnKirim").disabled = true;
  try {
    status("Mengunggah bukti transfer...");
    const buktiPath = await unggahBukti(f);

    status("Menyimpan data pendaftaran...");
    const { error } = await sb.rpc("daftar_umum", {
      p: {
        nama_lengkap: titleCase(val("nama_lengkap")),
        jenis_kelamin: $("jenis_kelamin").value,
        jenis_pendaftaran: $("jenis_pendaftaran").value,
        nik,
        nisn: val("nisn") || null,
        no_registrasi_akta: val("akta"),
        nama_panggilan: val("panggilan"),
        tempat_lahir: upper(val("tempat_lahir")),
        tanggal_lahir: $("tanggal_lahir").value,
        anak_ke: anak,
        status_dalam_keluarga: $("status_keluarga").value,
        sekolah_asal: val("sekolah_asal") || null,
        alamat: upper(val("alamat")),
        alamat_dom_rt: val("alamat_dom_rt"),
        alamat_dom_rw: val("alamat_dom_rw"),
        alamat_dom_desa: upper(dom.desa),
        alamat_dom_kecamatan: upper(dom.kec),
        alamat_dom_kodepos: val("alamat_dom_kodepos"),
        alamat_sama: sama,
        alamat_kk: sama ? null : upper(val("alamat_kk")),
        rt_kk: sama ? null : val("rt_kk"),
        rw_kk: sama ? null : val("rw_kk"),
        kode_pos: sama ? null : val("kode_pos"),
        desa_kelurahan: sama ? null : upper(kk.desa),
        kecamatan: sama ? null : upper(kk.kec),
        nama_ayah: upper(val("nama_ayah")),
        nik_ayah: nikAyah,
        hp_ayah: hpAyah,
        pekerjaan_ayah: $("pekerjaan_ayah").value,
        penghasilan_ayah: $("penghasilan_ayah").value,
        nama_ibu: upper(val("nama_ibu")),
        nik_ibu: nikIbu,
        hp_ibu: hpIbu,
        pekerjaan_ibu: $("pekerjaan_ibu").value,
        penghasilan_ibu: $("penghasilan_ibu").value,
        email_ortu: val("email_ortu"),
        wali_nama: val("wali_nama") || null,
        wali_alamat: val("wali_alamat") || null,
        wali_telp: waliTelp || null,
        wali_pekerjaan: val("wali_pekerjaan") || null,
        bukti_path: buktiPath
      }
    });
    if (error) throw new Error(error.message);

    $("formDaftar").classList.add("d-none");
    $("sukses").classList.remove("d-none");
    window.scrollTo(0, 0);
  } catch (err) {
    pesan(err.message);
  } finally {
    status("");
    cekJenis();
  }
});

init();
