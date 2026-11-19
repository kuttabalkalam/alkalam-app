/* wa.js - Memanggil fungsi kirim-wa untuk notifikasi WhatsApp (Fonnte)
   Pemakaian: const r = await WA.kirim("pengajuan_baru", { pengajuan_id: 12 });
   r.ok = true jika terkirim. Jika gagal, r.pesan berisi alasannya. */
const WA = (() => {
  const URL_FN = "https://epynlmuqxumuwcjsrnsz.supabase.co/functions/v1/kirim-wa";

  async function kirim(event, payload = {}) {
    try {
      const { data: { session } } = await KUTTAB.sb.auth.getSession();
      if (!session) return { ok: false, pesan: "Sesi login habis. Muat ulang halaman." };

      const r = await fetch(URL_FN, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
        body: JSON.stringify({ event, ...payload })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return { ok: false, pesan: j.error || ("Server membalas HTTP " + r.status) };
      if ((j.terkirim ?? 0) === 0) return { ok: false, pesan: (j.gagal && j.gagal[0]) || "Tidak ada nomor tujuan yang valid" };
      return { ok: true, pesan: "", terkirim: j.terkirim };
    } catch (e) {
      return { ok: false, pesan: "Gagal menghubungi server: " + e.message };
    }
  }

  return { kirim };
})();
