/* ui.js - Kuttab Al-Kalam
   Layout AdminLTE 3, pengecekan akses, dan notifikasi (SweetAlert2).
   Kunci Supabase hanya ada di file ini. */
const KUTTAB = (() => {
  const SUPABASE_URL = "https://epynlmuqxumuwcjsrnsz.supabase.co";
  const SUPABASE_KEY = "sb_publishable_Oq_to1zgHLnachvWYLV_yA_DoOTGI3s";
  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  const WARNA_TOMBOL = "#1a1a1a";

  // Daftar menu. roles = peran yang boleh melihat. quranSaja = hanya guru yang punya mapel Quran.
  const MENU = [
    { key: "dashboard", label: "Beranda", href: "dashboard.html", icon: "fa-home", roles: ["admin","kepala","staf","guru"] },
    { key: "data-siswa", label: "Data Siswa", href: "data-siswa.html", icon: "fa-user-graduate", roles: ["admin","kepala","staf","guru"] },
    { key: "input-nilai", label: "Input Nilai", href: "input-nilai.html", icon: "fa-pen", roles: ["admin","guru"] },
    { key: "rapor", label: "Rapor", href: "rapor.html", icon: "fa-file-alt", roles: ["admin","kepala","guru"] },
    { key: "jurnal-tahsin", label: "Jurnal Tahsin", href: "jurnal-tahsin.html", icon: "fa-book-open", roles: ["admin","guru"] },
    { key: "jurnal-grafik", label: "Grafik Jurnal", href: "jurnal-grafik.html", icon: "fa-chart-line", roles: ["admin","kepala","guru"] },
    { key: "rkk", label: "RKK", href: "rkk.html", icon: "fa-clipboard-list", roles: ["admin","kepala","guru"] },
    { key: "rkk-cetak", label: "Cetak RKK", href: "rkk-cetak.html", icon: "fa-print", roles: ["admin","kepala","guru"] },
    { key: "pengajuan-jilid", label: "Pengajuan Ujian Jilid", href: "pengajuan-jilid.html", icon: "fa-certificate", roles: ["admin","kepala","guru"], quranSaja: true },
    /*{ key: "profil", label: "Profil", href: "profil.html", icon: "fa-user-cog", roles: ["admin","kepala","staf","guru"] }*/
  ];

  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const Toast = Swal.mixin({
    toast: true, position: "top-end", showConfirmButton: false,
    timer: 2500, timerProgressBar: true
  });

  function toast(teks, tipe = "success") {
    Toast.fire({ icon: tipe, title: teks });
  }

  // Terjemahan pesan teknis dari database menjadi kalimat yang mudah dipahami
  const PETA_ERROR = [
    [/row-level security/i, "Anda tidak punya akses untuk menyimpan data ini."],
    [/duplicate key|already exists/i, "Data serupa sudah ada."],
    [/Invalid login credentials/i, "Email atau password salah."],
    [/violates not-null/i, "Ada isian wajib yang belum diisi."],
    [/invalid input syntax|out of range|violates check/i, "Ada isian yang formatnya tidak sesuai."]
  ];

  function pesanError(err) {
    const m = String((err && err.message) || err || "");
    for (const [re, teks] of PETA_ERROR) if (re.test(m)) return teks;
    if (/^Hanya |tidak terdaftar|tidak berhak/i.test(m)) return m;
    console.error(err);
    return "Terjadi kesalahan. Coba lagi, atau hubungi admin.";
  }

  function gagal(err) {
    Swal.fire({ icon: "error", title: "Gagal", text: pesanError(err), confirmButtonColor: WARNA_TOMBOL, confirmButtonText: "Mengerti" });
  }

  function peringatan(teks) {
    Swal.fire({ icon: "warning", title: "Perhatian", text: teks, confirmButtonColor: WARNA_TOMBOL, confirmButtonText: "Mengerti" });
  }

  async function konfirmasi(judul, teks) {
    const r = await Swal.fire({
      icon: "question", title: judul, text: teks, showCancelButton: true,
      confirmButtonText: "Ya", cancelButtonText: "Batal",
      confirmButtonColor: WARNA_TOMBOL, cancelButtonColor: "#6c757d"
    });
    return r.isConfirmed;
  }

  function tanpaAkses(teks) {
    document.body.innerHTML = `
      <div class="container py-5 text-center">
        <div class="card p-4">
          <h5>${esc(teks)}</h5>
          <div><a class="btn btn-kuning mt-3" href="login.html">Masuk ulang</a></div>
        </div>
      </div>`;
    document.body.style.background = "#e6f4fb";
  }

  async function halaman({ aktif = "", judul, roles = null, render }) {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { location.href = "login.html"; return; }

    const { data: me, error } = await sb.from("pegawai")
      .select("id, nama_lengkap, peran").eq("auth_user_id", session.user.id).maybeSingle();
    if (error) return tanpaAkses("Gagal memuat akun: " + error.message);
    if (!me) return tanpaAkses("Akun " + session.user.email + " belum terhubung ke data pegawai.");
    if (roles && !roles.includes(me.peran)) return tanpaAkses("Halaman ini tidak tersedia untuk akun Anda.");

    const { data: sem } = await sb.from("semester")
      .select("id, nomor, tahun_ajaran_id, tahun_ajaran:tahun_ajaran_id(kode)")
      .eq("aktif", true).maybeSingle();

    let punyaQuran = false;
    if (me.peran === "guru") {
      const { data: pm } = await sb.from("penugasan_mapel")
        .select("mapel:mapel_id(kode)").eq("pegawai_id", me.id);
      punyaQuran = (pm || []).some(x => ["tilawah","tahfidz","kitabah"].includes(x.mapel?.kode));
    }
    const menu = MENU.filter(m =>
      m.roles.includes(me.peran) && (!m.quranSaja || me.peran !== "guru" || punyaQuran));

    const sebutan = sem && sem.tahun_ajaran
      ? "TA " + esc(sem.tahun_ajaran.kode) + " · Semester " + (sem.nomor === 1 ? "Ganjil" : "Genap")
      : "Belum ada semester aktif";

    document.body.className = "hold-transition sidebar-mini";
    document.body.innerHTML = `
      <div class="wrapper">
        <nav class="main-header navbar navbar-expand navbar-dark">
          <ul class="navbar-nav">
            <li class="nav-item">
              <a class="nav-link" data-widget="pushmenu" href="#" role="button"><i class="fas fa-bars"></i></a>
            </li>
          </ul>
            <ul class="navbar-nav ml-auto align-items-center">
            <li class="nav-item">
              <a class="nav-link d-flex align-items-center btn btn-outline-primary" href="profil.html" title="Profil saya">
                <span class="profil-ikon mr-2"><i class="fas fa-user-circle"></i></span>
                <span class="d-none d-sm-inline">${esc(me.nama_lengkap)}</span>
              </a>
            </li>
            <li class="nav-item"><a class="nav-link" href="#" id="btnKeluar" title="Keluar"><i class="fas fa-sign-out-alt"></i></a></li>
          </ul>
        </nav>

        <aside class="main-sidebar sidebar-dark-warning elevation-4">
          <a href="dashboard.html" class="brand-link">
            <img src="logo.png" alt="" class="brand-image img-circle elevation-2" style="opacity:.95">
            <span class="brand-text">Kuttab Al-Kalam</span>
          </a>
          <div class="sidebar">
            <nav class="mt-2">
              <ul class="nav nav-pills nav-sidebar flex-column" role="menu">
                ${menu.map(m => `
                  <li class="nav-item">
                    <a href="${m.href}" class="nav-link ${m.key === aktif ? "active" : ""}">
                      <i class="nav-icon fas ${m.icon}"></i><p>${esc(m.label)}</p>
                    </a>
                  </li>`).join("")}
              </ul>
            </nav>
          </div>
        </aside>

        <div class="content-wrapper">
          <div class="content-header">
            <div class="container-fluid">
              <h1 class="m-0">${esc(judul)}</h1>
              <small class="text-muted" id="subjudul">${sebutan}</small>
            </div>
          </div>
          <section class="content">
            <div class="container-fluid" id="konten"></div>
          </section>
        </div>

        <footer class="main-footer">
          <small>Kuttab Al-Kalam · ${esc(me.nama_lengkap)}</small>
        </footer>
      </div>`;

    document.getElementById("btnKeluar").onclick = async e => {
      e.preventDefault();
      await sb.auth.signOut();
      location.href = "login.html";
    };

    await render({
      sb, me, sem, menu, aktif,
      konten: document.getElementById("konten"),
      toast, gagal, peringatan, konfirmasi, esc
    });
  }

  return { sb, MENU, esc, toast, gagal, peringatan, konfirmasi, halaman };
})();
