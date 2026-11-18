/* =====================================================================
 * statistika.js  —  SEMUA KODE HALAMAN STATISTIKA (Soal 1)
 * ---------------------------------------------------------------------
 * File ini berdiri sendiri dan TIDAK membutuhkan app.js.
 *   BAGIAN 1 : logika perhitungan   -> objek `Statistik`   (tanpa menyentuh HTML)
 *   BAGIAN 2 : penghubung ke HTML   -> function initStatistik()
 *   BAGIAN 3 : jalan otomatis di statistika.html
 * ===================================================================== */

/* =====================================================================
 * BAGIAN 1 — LOGIKA PERHITUNGAN
 * ===================================================================== */
const Statistik = (() => {
  'use strict';

  /* ===================================================================
   * 1. MEMBACA DATA
   * =================================================================== */

  // Angka valid: -12, 3.5, .5, 5., 1e3 (desimal memakai titik)
  const POLA_ANGKA = /^[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/;

  // Ubah teks menjadi angka; kembalikan null kalau bukan angka.
  function keAngka(teks) {
    const t = String(teks).trim().replace(/^["']|["']$/g, '').trim();
    if (!POLA_ANGKA.test(t)) return null;
    const x = Number(t);
    return Number.isFinite(x) ? x : null;
  }

  /* Input manual.
   * Pemisah yang dikenali: spasi, baris baru, titik koma, dan koma.
   * Aturan koma (supaya "3,5" tidak salah dibaca):
   *   - "2, 4, 4"   atau "2,4,4,5"  -> koma = pemisah   (2 | 4 | 4 ...)
   *   - "3,5  4,25" atau "3,5"      -> koma = desimal   (3.5 | 4.25)
   *   - ada titik koma (;)          -> koma selalu desimal
   */
  function bacaManual(teks) {
    const mentah = String(teks).replace(/\r/g, '');
    const potongan = mentah.split(/[;\s]+/).filter((t) => t !== '');
    const adaTitikKoma = mentah.indexOf(';') !== -1;
    const komaPemisah =
      !adaTitikKoma &&
      potongan.some((t) => /^,|,$/.test(t) || (t.match(/,/g) || []).length >= 2);

    const angka = [];
    let diabaikan = 0;
    potongan.forEach((t) => {
      const bagian = komaPemisah ? t.split(',') : [t.replace(',', '.')];
      bagian.forEach((b) => {
        if (b === '') return;
        const x = keAngka(b);
        if (x === null) diabaikan++;
        else angka.push(x);
      });
    });
    return { angka, diabaikan };
  }

  // Memecah satu baris CSV sambil menghormati tanda kutip ("3,5" tetap satu sel).
  function pecahBaris(baris, pemisah) {
    const hasil = [];
    let sel = '';
    let dalamKutip = false;
    for (let i = 0; i < baris.length; i++) {
      const c = baris[i];
      if (c === '"') dalamKutip = !dalamKutip;
      else if (!dalamKutip && (c === pemisah || c === '\t')) {
        hasil.push(sel);
        sel = '';
      } else sel += c;
    }
    hasil.push(sel);
    return hasil;
  }

  /* File CSV.
   * Pemisah: titik koma (;) kalau ada, selain itu koma.
   * Desimal: titik atau koma. Sel non-angka (header/teks) diabaikan.
   */
  function bacaCSV(teks) {
    const isi = String(teks).replace(/^\uFEFF/, '').replace(/\r/g, '');
    const pemisah = isi.indexOf(';') !== -1 ? ';' : ',';
    const angka = [];
    let diabaikan = 0;
    isi.split('\n').forEach((baris) => {
      if (baris.trim() === '') return;
      pecahBaris(baris, pemisah).forEach((sel) => {
        const s = sel.trim();
        if (s === '') return;
        const x = keAngka(s.replace(',', '.'));
        if (x === null) diabaikan++;
        else angka.push(x);
      });
    });
    return { angka, diabaikan };
  }

  /* ===================================================================
   * 2. ALAT HITUNG DASAR
   * =================================================================== */

  // Penjumlahan teliti (Neumaier) supaya 0,1 + 0,2 tidak menghasilkan 0,30000000000000004.
  function jumlahkan(arr) {
    let s = 0;
    let c = 0;
    for (let i = 0; i < arr.length; i++) {
      const x = arr[i];
      const t = s + x;
      if (Math.abs(s) >= Math.abs(x)) c += s - t + x;
      else c += x - t + s;
      s = t;
    }
    return s + c;
  }

  // Median dari data yang SUDAH terurut.
  function medianDari(s) {
    const n = s.length;
    if (n === 0) return null;
    const m = Math.floor(n / 2);
    return n % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  // Modus: nilai dengan frekuensi tertinggi. Bisa lebih dari satu (bimodal/multimodal).
  // "Tidak ada modus" jika semua nilai muncul sama banyak (termasuk semuanya hanya 1 kali).
  function cariModus(s) {
    const frek = new Map();
    let maks = 0;
    s.forEach((x) => {
      const f = (frek.get(x) || 0) + 1;
      frek.set(x, f);
      if (f > maks) maks = f;
    });
    const nilai = [];
    let semuaSama = true;
    frek.forEach((f, x) => {
      if (f === maks) nilai.push(x);
      else semuaSama = false;
    });
    const ada = maks > 1 && !(frek.size > 1 && semuaSama);
    return {
      ada,
      nilai: ada ? nilai : [],
      frekuensi: ada ? maks : 0,
      banyak: ada ? nilai.length : 0,
    };
  }

  /* ===================================================================
   * 3. KUARTIL (3 metode)
   *  - 'linear' : interpolasi linear, sama dengan QUARTILE.INC di Excel
   *  - 'halves' : median dua belahan (median tidak ikut dihitung jika n ganjil)
   *  - 'letak'  : letak i(n+1)/4 dengan interpolasi (buku statistika Indonesia)
   * =================================================================== */
  function persenLinear(s, p) {
    const h = (s.length - 1) * p;
    const lo = Math.floor(h);
    const f = h - lo;
    return lo + 1 < s.length ? s[lo] + f * (s[lo + 1] - s[lo]) : s[lo];
  }

  function persenLetak(s, p) {
    const n = s.length;
    const pos = p * (n + 1); // posisi 1-based
    if (pos <= 1) return s[0];
    if (pos >= n) return s[n - 1];
    const lo = Math.floor(pos);
    return s[lo - 1] + (pos - lo) * (s[lo] - s[lo - 1]);
  }

  function kuartil(s, metode) {
    const n = s.length;
    if (n === 1) return { q1: s[0], q3: s[0] };
    if (metode === 'halves') {
      const m = Math.floor(n / 2);
      const bawah = s.slice(0, m);
      const atas = s.slice(n % 2 ? m + 1 : m);
      return { q1: medianDari(bawah), q3: medianDari(atas) };
    }
    if (metode === 'letak') return { q1: persenLetak(s, 0.25), q3: persenLetak(s, 0.75) };
    return { q1: persenLinear(s, 0.25), q3: persenLinear(s, 0.75) };
  }

  /* ===================================================================
   * 4. FUNGSI UTAMA: SEMUA 14 UKURAN SEKALIGUS
   *   data : array angka
   *   opsi : { jenis: 'sample' | 'population', kuartil: 'linear' | 'halves' | 'letak' }
   * =================================================================== */
  function hitungStatistik(data, opsi = {}) {
    const jenis = opsi.jenis === 'population' ? 'population' : 'sample';
    const metode = opsi.kuartil || 'linear';
    const s = data.slice().sort((a, b) => a - b);
    const n = s.length;
    if (n === 0) return null;

    const jumlah = jumlahkan(s);
    const mean = jumlah / n;

    // Varians: jumlah kuadrat selisih terhadap mean, dibagi n (populasi) atau n-1 (sampel)
    const ssd = jumlahkan(s.map((x) => (x - mean) ** 2));
    const variansPopulasi = ssd / n;
    const variansSampel = n > 1 ? ssd / (n - 1) : null; // tidak terdefinisi untuk n = 1
    const sdPopulasi = Math.sqrt(variansPopulasi);
    const sdSampel = variansSampel === null ? null : Math.sqrt(variansSampel);

    const { q1, q3 } = kuartil(s, metode);
    const iqr = q3 - q1;
    const pagarBawah = q1 - 1.5 * iqr;
    const pagarAtas = q3 + 1.5 * iqr;
    const outlier = s.filter((x) => x < pagarBawah || x > pagarAtas);

    return {
      n,
      jumlah,
      mean,
      median: medianDari(s),
      modus: cariModus(s),
      min: s[0],
      max: s[n - 1],
      range: s[n - 1] - s[0],
      jenis,
      varians: jenis === 'sample' ? variansSampel : variansPopulasi,
      sd: jenis === 'sample' ? sdSampel : sdPopulasi,
      variansSampel,
      variansPopulasi,
      sdSampel,
      sdPopulasi,
      q1,
      q3,
      iqr,
      pagarBawah,
      pagarAtas,
      outlier,
      metodeKuartil: metode,
      terurut: s,
    };
  }

  /* ===================================================================
   * 5. DATA UNTUK GRAFIK
   * =================================================================== */

  // Pembulatan "enak dilihat" ke atas: 1, 2, 2.5, 5, 10 x 10^k
  function langkahBagus(mentah) {
    const p = Math.pow(10, Math.floor(Math.log10(mentah)));
    const f = mentah / p;
    const nf = f <= 1 + 1e-9 ? 1 : f <= 2 + 1e-9 ? 2 : f <= 2.5 + 1e-9 ? 2.5 : f <= 5 + 1e-9 ? 5 : 10;
    return Number((nf * p).toPrecision(12));
  }

  const bulatkan = (x) => Number(x.toPrecision(12));

  /* Histogram: jumlah kelas dari aturan Sturges (k = 1 + log2 n),
   * lebar kelas = range/k lalu dibulatkan ke atas ke angka yang rapi.
   * Kelas berbentuk [bawah, atas) -- batas bawah ikut, batas atas tidak. */
  function buatHistogram(terurut) {
    const n = terurut.length;
    const min = terurut[0];
    const max = terurut[n - 1];
    if (min === max) {
      return { batas: [min - 0.5, min + 0.5], frekuensi: [n], lebar: 1, kelasSturges: 1 };
    }
    const kelasSturges = Math.ceil(Math.log2(n) + 1);
    const lebar = langkahBagus((max - min) / kelasSturges);
    const awal = Math.floor(min / lebar + 1e-9) * lebar;

    const batas = [bulatkan(awal)];
    let i = 0;
    while (batas[batas.length - 1] <= max) {
      i++;
      batas.push(bulatkan(awal + i * lebar));
    }
    const frekuensi = new Array(batas.length - 1).fill(0);
    terurut.forEach((x) => {
      let idx = Math.floor((x - awal) / lebar + 1e-9);
      if (idx < 0) idx = 0;
      if (idx > frekuensi.length - 1) idx = frekuensi.length - 1;
      frekuensi[idx]++;
    });
    return { batas, frekuensi, lebar, kelasSturges };
  }

  // Boxplot: kumis berujung di data terjauh yang masih berada di dalam pagar.
  function dataBoxplot(h) {
    const s = h.terurut;
    let kumisBawah = s[0];
    let kumisAtas = s[s.length - 1];
    for (let i = 0; i < s.length; i++) {
      if (s[i] >= h.pagarBawah) {
        kumisBawah = s[i];
        break;
      }
    }
    for (let i = s.length - 1; i >= 0; i--) {
      if (s[i] <= h.pagarAtas) {
        kumisAtas = s[i];
        break;
      }
    }
    return {
      kumisBawah,
      kumisAtas,
      q1: h.q1,
      median: h.median,
      q3: h.q3,
      mean: h.mean,
      outlier: h.outlier,
    };
  }

  /* ===================================================================
   * 6. FORMAT ANGKA (tampilan Indonesia: 1.234,56)
   * =================================================================== */
  const pemformatBawaan =
    typeof Intl !== 'undefined' ? new Intl.NumberFormat('id-ID', { maximumFractionDigits: 4 }) : null;

  function formatAngka(x, desimalMaks) {
    if (typeof x !== 'number' || !Number.isFinite(x)) return '–';
    if (x === 0) x = 0; // ubah -0 menjadi 0
    if (x !== 0 && Math.abs(x) < 0.0001) return x.toExponential(2).replace('.', ',');
    let pemformat = pemformatBawaan;
    if (desimalMaks !== undefined && typeof Intl !== 'undefined') {
      pemformat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: desimalMaks });
    }
    return pemformat ? pemformat.format(x) : String(x).replace('.', ',');
  }

  return {
    bacaManual,
    bacaCSV,
    hitungStatistik,
    buatHistogram,
    dataBoxplot,
    langkahBagus,
    formatAngka,
  };
})();


/* =====================================================================
 * BAGIAN 2 — PENGHUBUNG KE statistika.html
 * ===================================================================== */
function initStatistik() {
  const S = Statistik; // objek dari statistika.js
  const $ = (id) => document.getElementById(id);
  const teks = (id, nilai) => {
    const e = $(id);
    if (e) e.textContent = nilai;
  };

  const ID_HASIL = [
    'res-n', 'res-sum', 'res-mean', 'res-median', 'res-mode', 'res-min', 'res-max',
    'res-range', 'res-var', 'res-sd', 'res-q1', 'res-q3', 'res-iqr', 'res-outlier',
    'kpi-n', 'kpi-sum', 'kpi-mean', 'kpi-median', 'kpi-mode',
    'badge-iqr', 'fence-low', 'fence-high', 'outlier-list',
  ];

  /* ---------- keadaan (state) ---------- */
  let mode = 'manual';       // 'manual' | 'csv'
  let tampilan = 'hist';     // 'hist' | 'box'
  let dataCSV = null;        // { angka, diabaikan } hasil baca file
  let dataTerakhir = null;   // data yang terakhir dihitung (untuk hitung ulang saat opsi diganti)
  let hasil = null;          // hasil hitung terakhir

  /* ---------- pesan (alert) ---------- */
  function tampilkanPesan(pesan, jenis) {
    const e = $('alert-area');
    if (!e) return;
    if (!pesan) {
      e.textContent = '';
      e.hidden = true;
      return;
    }
    e.textContent = pesan;
    e.dataset.jenis = jenis || 'info';
    e.hidden = false;
  }

  /* ---------- pembacaan input ---------- */
  function jenisData() {
    const r = document.querySelector('input[name="calc-type"]:checked');
    return r ? r.value : 'sample';
  }

  function opsiHitung() {
    return { jenis: jenisData(), kuartil: $('select-kuartil').value };
  }

  function perbaruiJumlah() {
    const d = S.bacaManual($('textarea-data').value);
    let t = d.angka.length + ' data';
    if (d.diabaikan) t += ' (' + d.diabaikan + ' nilai non-angka diabaikan)';
    teks('info-count', t);
  }

  function perbaruiLabel() {
    const label = jenisData() === 'sample' ? 'sampel' : 'populasi';
    teks('lbl-var', label);
    teks('lbl-sd', label);
  }

  /* ---------- menyusun 14 baris hasil ---------- */
  function susunBaris(h) {
    const f = S.formatAngka;
    const sampel = h.jenis === 'sample';
    const label = sampel ? 'sampel' : 'populasi';
    const tidakAda = 'Tidak terdefinisi (n = 1)';

    const teksModus = h.modus.ada
      ? h.modus.nilai.map((x) => f(x)).join(', ') + ' (muncul ' + h.modus.frekuensi + '×)'
      : 'Tidak ada modus';
    const teksOutlier = h.outlier.length
      ? 'Ada ' + h.outlier.length + ' outlier: ' + h.outlier.map((x) => f(x)).join(', ')
      : 'Tidak ada outlier';

    return [
      { id: 'res-n',       no: 1,  nama: 'Jumlah data (n)',                  notasi: 'n',   nilai: f(h.n) },
      { id: 'res-sum',     no: 2,  nama: 'Total nilai (Σx)',                 notasi: 'Σx',  nilai: f(h.jumlah) },
      { id: 'res-mean',    no: 3,  nama: 'Mean (rata-rata)',                 notasi: 'x̄',   nilai: f(h.mean) },
      { id: 'res-median',  no: 4,  nama: 'Median',                           notasi: 'Me',  nilai: f(h.median) },
      { id: 'res-mode',    no: 5,  nama: 'Modus',                            notasi: 'Mo',  nilai: teksModus },
      { id: 'res-min',     no: 6,  nama: 'Nilai minimum',                    notasi: 'min', nilai: f(h.min) },
      { id: 'res-max',     no: 7,  nama: 'Nilai maksimum',                   notasi: 'max', nilai: f(h.max) },
      { id: 'res-range',   no: 8,  nama: 'Range (jangkauan)',                notasi: 'R',   nilai: f(h.range) },
      { id: 'res-var',     no: 9,  nama: 'Varians (' + label + ')',          notasi: sampel ? 's²' : 'σ²', nilai: h.varians === null ? tidakAda : f(h.varians) },
      { id: 'res-sd',      no: 10, nama: 'Standar deviasi (' + label + ')',  notasi: sampel ? 's' : 'σ',   nilai: h.sd === null ? tidakAda : f(h.sd) },
      { id: 'res-q1',      no: 11, nama: 'Kuartil 1 (Q1)',                   notasi: 'Q1',  nilai: f(h.q1) },
      { id: 'res-q3',      no: 12, nama: 'Kuartil 3 (Q3)',                   notasi: 'Q3',  nilai: f(h.q3) },
      { id: 'res-iqr',     no: 13, nama: 'Interquartile Range (IQR)',        notasi: 'IQR', nilai: f(h.iqr) },
      { id: 'res-outlier', no: 14, nama: 'Deteksi outlier',                  notasi: '1,5×IQR', nilai: teksOutlier },
    ];
  }

  /* ---------- menampilkan hasil ---------- */
  function tampilkanHasil() {
    const f = S.formatAngka;
    const baris = susunBaris(hasil);
    baris.forEach((b) => teks(b.id, b.nilai));
    const nilai = (id) => baris.find((b) => b.id === id).nilai;

    teks('kpi-n', nilai('res-n'));
    teks('kpi-sum', nilai('res-sum'));
    teks('kpi-mean', nilai('res-mean'));
    teks('kpi-median', nilai('res-median'));
    teks('kpi-mode', nilai('res-mode'));

    teks('badge-iqr', f(hasil.iqr));
    teks('fence-low', f(hasil.pagarBawah));
    teks('fence-high', f(hasil.pagarAtas));
    teks('outlier-list', hasil.outlier.length ? hasil.outlier.map((x) => f(x)).join(', ') : 'Tidak ada');
    perbaruiLabel();
  }

  function kosongkanHasil() {
    ID_HASIL.forEach((id) => teks(id, '–'));
    perbaruiLabel();
    const svg = $('chart-svg');
    if (svg) while (svg.firstChild) svg.removeChild(svg.firstChild);
    teks('chart-note', '');
  }

  /* =================================================================
   * GRAFIK (SVG digambar manual, tanpa library)
   * ================================================================= */
  const NS = 'http://www.w3.org/2000/svg';
  const W = 640;
  const H = 260;
  const M = { kiri: 48, kanan: 16, atas: 20, bawah: 44 };
  const WARNA = '#3b82f6';
  const WARNA_OUTLIER = '#ef4444';

  function elemen(nama, atribut, isi) {
    const e = document.createElementNS(NS, nama);
    Object.keys(atribut || {}).forEach((k) => e.setAttribute(k, atribut[k]));
    if (isi !== undefined && isi !== null) e.textContent = isi;
    return e;
  }

  function garis(svg, x1, y1, x2, y2, atribut) {
    svg.appendChild(
      elemen('line', Object.assign({ x1, y1, x2, y2, stroke: 'currentColor', 'stroke-opacity': '0.35' }, atribut || {}))
    );
  }

  function label(svg, x, y, isi, atribut) {
    svg.appendChild(
      elemen('text', Object.assign({ x, y, fill: 'currentColor', 'font-size': '11', 'text-anchor': 'middle' }, atribut || {}), isi)
    );
  }

  function gambarGrafik() {
    const svg = $('chart-svg');
    if (!svg || !hasil) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    if (tampilan === 'hist') gambarHistogram(svg);
    else gambarBoxplot(svg);
  }

  function gambarHistogram(svg) {
    const f = S.formatAngka;
    const h = S.buatHistogram(hasil.terurut);
    const lebarArea = W - M.kiri - M.kanan;
    const tinggiArea = H - M.atas - M.bawah;
    const y0 = M.atas + tinggiArea;
    const jumlahKelas = h.frekuensi.length;

    // Skala sumbu Y (bilangan bulat)
    const fMaks = Math.max.apply(null, h.frekuensi);
    const langkahY = Math.max(1, Math.ceil(S.langkahBagus(fMaks / 5)));
    const yMaks = Math.ceil(fMaks / langkahY) * langkahY;
    for (let v = 0; v <= yMaks; v += langkahY) {
      const y = y0 - (v / yMaks) * tinggiArea;
      garis(svg, M.kiri, y, W - M.kanan, y, { 'stroke-opacity': v === 0 ? '0.6' : '0.15' });
      label(svg, M.kiri - 6, y + 4, String(v), { 'text-anchor': 'end' });
    }
    garis(svg, M.kiri, M.atas, M.kiri, y0, { 'stroke-opacity': '0.6' });

    // Batang
    const lb = lebarArea / jumlahKelas;
    h.frekuensi.forEach((fr, i) => {
      const tinggi = (fr / yMaks) * tinggiArea;
      const x = M.kiri + i * lb;
      if (fr > 0) {
        svg.appendChild(
          elemen('rect', { x: x + 1, y: y0 - tinggi, width: Math.max(lb - 2, 1), height: tinggi, fill: WARNA, 'fill-opacity': '0.85' })
        );
        if (lb >= 18) label(svg, x + lb / 2, y0 - tinggi - 4, String(fr));
      }
    });

    // Label batas kelas di sumbu X
    const lompat = Math.ceil(h.batas.length / 10);
    h.batas.forEach((b, i) => {
      if (i % lompat === 0 || i === h.batas.length - 1) {
        label(svg, M.kiri + i * lb, y0 + 16, f(b, 2));
      }
    });
    label(svg, M.kiri + lebarArea / 2, H - 6, 'Nilai data');
    label(svg, 12, M.atas + tinggiArea / 2, 'Frekuensi', {
      transform: 'rotate(-90 12 ' + (M.atas + tinggiArea / 2) + ')',
    });

    teks(
      'chart-note',
      'Histogram: ' + jumlahKelas + ' kelas, lebar kelas ' + f(h.lebar, 4) +
        ' (jumlah kelas awal dari aturan Sturges = ' + h.kelasSturges + ', lebar dibulatkan). ' +
        'Batas bawah kelas ikut dihitung, batas atas tidak.'
    );
  }

  function gambarBoxplot(svg) {
    const f = S.formatAngka;
    const b = S.dataBoxplot(hasil);
    const lebarArea = W - M.kiri - M.kanan;
    const tinggiArea = H - M.atas - M.bawah;
    const y0 = M.atas + tinggiArea;
    const yTengah = M.atas + tinggiArea / 2;

    let lo = hasil.min;
    let hi = hasil.max;
    if (lo === hi) {
      lo -= 1;
      hi += 1;
    }
    const pad = (hi - lo) * 0.05;
    lo -= pad;
    hi += pad;
    const x = (v) => M.kiri + ((v - lo) / (hi - lo)) * lebarArea;

    // Sumbu X dengan tanda
    garis(svg, M.kiri, y0, W - M.kanan, y0, { 'stroke-opacity': '0.6' });
    const langkah = S.langkahBagus((hi - lo) / 6);
    for (let i = Math.ceil(lo / langkah - 1e-9); i * langkah <= hi + 1e-9; i++) {
      const v = Number((i * langkah).toPrecision(12));
      garis(svg, x(v), y0, x(v), y0 + 5, { 'stroke-opacity': '0.6' });
      label(svg, x(v), y0 + 18, f(v, 2));
    }
    label(svg, M.kiri + lebarArea / 2, H - 6, 'Nilai data');

    // Kumis
    garis(svg, x(b.kumisBawah), yTengah, x(b.q1), yTengah, { 'stroke-opacity': '1', 'stroke-width': '2' });
    garis(svg, x(b.q3), yTengah, x(b.kumisAtas), yTengah, { 'stroke-opacity': '1', 'stroke-width': '2' });
    garis(svg, x(b.kumisBawah), yTengah - 12, x(b.kumisBawah), yTengah + 12, { 'stroke-opacity': '1', 'stroke-width': '2' });
    garis(svg, x(b.kumisAtas), yTengah - 12, x(b.kumisAtas), yTengah + 12, { 'stroke-opacity': '1', 'stroke-width': '2' });

    // Kotak Q1–Q3 dan garis median
    svg.appendChild(
      elemen('rect', {
        x: x(b.q1), y: yTengah - 30, width: Math.max(x(b.q3) - x(b.q1), 1), height: 60,
        fill: WARNA, 'fill-opacity': '0.25', stroke: WARNA, 'stroke-width': '2',
      })
    );
    garis(svg, x(b.median), yTengah - 30, x(b.median), yTengah + 30, { stroke: WARNA, 'stroke-opacity': '1', 'stroke-width': '4' });

    // Mean (belah ketupat)
    const mx = x(b.mean);
    svg.appendChild(
      elemen('polygon', {
        points: [mx + ',' + (yTengah - 7), (mx + 7) + ',' + yTengah, mx + ',' + (yTengah + 7), (mx - 7) + ',' + yTengah].join(' '),
        fill: 'currentColor', 'fill-opacity': '0.8',
      })
    );

    // Outlier
    b.outlier.forEach((o) => {
      svg.appendChild(elemen('circle', { cx: x(o), cy: yTengah, r: 4.5, fill: WARNA_OUTLIER }));
    });

    teks(
      'chart-note',
      'Boxplot: Q1 = ' + f(b.q1) + ', median = ' + f(b.median) + ', Q3 = ' + f(b.q3) +
        '; kumis dari ' + f(b.kumisBawah) + ' sampai ' + f(b.kumisAtas) +
        '. Garis tebal = median, belah ketupat = mean, titik merah = outlier (' + b.outlier.length + ').'
    );
  }

  /* =================================================================
   * AKSI TOMBOL
   * ================================================================= */
  function ambilData() {
    if (mode === 'csv') {
      if (!dataCSV) return { angka: [], diabaikan: 0, galat: 'Belum ada file CSV yang dipilih.' };
      return dataCSV;
    }
    return S.bacaManual($('textarea-data').value);
  }

  function hitung() {
    const d = ambilData();
    if (d.galat) {
      tampilkanPesan(d.galat, 'galat');
      return;
    }
    if (d.angka.length === 0) {
      tampilkanPesan('Tidak ada angka valid yang bisa dihitung. Periksa kembali data yang dimasukkan.', 'galat');
      return;
    }
    dataTerakhir = d.angka;
    hasil = S.hitungStatistik(dataTerakhir, opsiHitung());
    tampilkanHasil();
    gambarGrafik();

    const catatan = [];
    if (d.diabaikan) catatan.push(d.diabaikan + ' nilai non-angka diabaikan.');
    if (hasil.n === 1 && hasil.jenis === 'sample') {
      catatan.push('Hanya ada 1 data, jadi varians dan standar deviasi sampel tidak terdefinisi.');
    }
    tampilkanPesan(catatan.join(' '), 'info');
  }

  // Dipanggil saat jenis data / metode kuartil diganti setelah ada hasil.
  function hitungUlang() {
    perbaruiLabel();
    if (!dataTerakhir) return;
    hasil = S.hitungStatistik(dataTerakhir, opsiHitung());
    tampilkanHasil();
    gambarGrafik();
  }

  function reset() {
    $('textarea-data').value = '';
    $('input-csv').value = '';
    teks('csv-filename', '');
    const radioSampel = document.querySelector('input[name="calc-type"][value="sample"]');
    if (radioSampel) radioSampel.checked = true;
    $('select-kuartil').value = 'linear';
    dataCSV = null;
    dataTerakhir = null;
    hasil = null;
    tampilkanPesan('');
    kosongkanHasil();
    perbaruiJumlah();
  }

  function pilihMode(m) {
    mode = m;
    $('tab-manual').setAttribute('aria-selected', String(m === 'manual'));
    $('tab-csv').setAttribute('aria-selected', String(m === 'csv'));
    $('manual-area').hidden = m !== 'manual';
    $('upload-csv-area').hidden = m !== 'csv';
  }

  function pilihTampilan(v) {
    tampilan = v;
    $('view-hist').setAttribute('aria-selected', String(v === 'hist'));
    $('view-box').setAttribute('aria-selected', String(v === 'box'));
    gambarGrafik();
  }

  /* ---------- baca file CSV ---------- */
  function bacaFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) {
      dataCSV = null;
      teks('csv-filename', '');
      return;
    }
    const pembaca = new FileReader();
    pembaca.onload = () => {
      const d = S.bacaCSV(String(pembaca.result));
      dataCSV = { angka: d.angka, diabaikan: d.diabaikan };
      let t = file.name + ' — ' + d.angka.length + ' angka terbaca';
      if (d.diabaikan) t += ', ' + d.diabaikan + ' sel non-angka diabaikan (header/teks)';
      teks('csv-filename', t);
      tampilkanPesan('');
    };
    pembaca.onerror = () => {
      dataCSV = null;
      tampilkanPesan('Gagal membaca file. Coba pilih ulang filenya.', 'galat');
    };
    pembaca.readAsText(file);
  }

  /* ---------- salin tabel & ekspor CSV ---------- */
  function isiTabel() {
    return [['No.', 'Ukuran statistik', 'Notasi', 'Hasil']].concat(
      susunBaris(hasil).map((b) => [b.no, b.nama, b.notasi, b.nilai])
    );
  }

  function salinCadangan(isi, berhasil) {
    const ta = document.createElement('textarea');
    ta.value = isi;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (err) {
      ok = false;
    }
    document.body.removeChild(ta);
    if (ok) berhasil();
    else tampilkanPesan('Gagal menyalin otomatis. Blok tabelnya lalu tekan Ctrl+C.', 'galat');
  }

  function salinTabel() {
    if (!hasil) {
      tampilkanPesan('Belum ada hasil. Tekan Hitung dulu.', 'galat');
      return;
    }
    const isi = isiTabel().map((baris) => baris.join('\t')).join('\n');
    const tombol = $('btn-copy-table');
    const asli = tombol.textContent;
    const berhasil = () => {
      tombol.textContent = 'Tersalin ✓';
      setTimeout(() => { tombol.textContent = asli; }, 1500);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(isi).then(berhasil, () => salinCadangan(isi, berhasil));
    } else {
      salinCadangan(isi, berhasil);
    }
  }

  function eksporCSV() {
    if (!hasil) {
      tampilkanPesan('Belum ada hasil. Tekan Hitung dulu.', 'galat');
      return;
    }
    // Pemisah titik koma + desimal koma, supaya terbuka rapi di Excel versi Indonesia.
    const kutip = (c) => '"' + String(c).replace(/"/g, '""') + '"';
    const isi = isiTabel().map((baris) => baris.map(kutip).join(';')).join('\r\n');
    const blob = new Blob(['\uFEFF' + isi], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hasil-statistika.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ---------- pasang semua pendengar (event listener) ---------- */
  $('btn-hitung').addEventListener('click', hitung);
  $('btn-reset').addEventListener('click', reset);
  // Data contoh diambil dari isi awal <textarea> di HTML (defaultValue), bukan dari JS.
  $('btn-sample').addEventListener('click', () => {
    const contoh = $('textarea-data').defaultValue.trim();
    if (!contoh) {
      tampilkanPesan('Data contoh belum disediakan di HTML.', 'galat');
      return;
    }
    $('textarea-data').value = contoh;
    tampilkanPesan('');
    perbaruiJumlah();
  });
  $('textarea-data').addEventListener('input', perbaruiJumlah);
  $('tab-manual').addEventListener('click', () => pilihMode('manual'));
  $('tab-csv').addEventListener('click', () => pilihMode('csv'));
  $('input-csv').addEventListener('change', bacaFile);
  $('view-hist').addEventListener('click', () => pilihTampilan('hist'));
  $('view-box').addEventListener('click', () => pilihTampilan('box'));
  $('select-kuartil').addEventListener('change', hitungUlang);
  document.querySelectorAll('input[name="calc-type"]').forEach((r) => r.addEventListener('change', hitungUlang));
  $('btn-copy-table').addEventListener('click', salinTabel);
  $('btn-export-csv').addEventListener('click', eksporCSV);

  /* ---------- keadaan awal halaman ---------- */
  pilihMode('manual');
  perbaruiJumlah();
  perbaruiLabel();
}


/* =====================================================================
 * BAGIAN 3 — JALAN OTOMATIS
 * Hanya aktif di halaman yang punya tombol Hitung statistika.
 * ===================================================================== */
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('btn-hitung')) initStatistik();
  });
}

// Supaya bisa diuji lewat Node.js. Di browser, baris ini diabaikan.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Statistik;
}