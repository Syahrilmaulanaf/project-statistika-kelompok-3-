/* =========================================================
   app.js — Skrip bersama StatKit
   Dimuat di statistika.html & probabilitas.html (defer).
   Berisi:
     1. Utilitas (window.App) untuk dipakai statistika.js / probalitas.js
     2. Wiring UI umum: navigasi aktif, tab mode input, sub-nav
        probabilitas, toggle P(A∩B), penghitung jumlah data.
   Semua wiring bersifat idempoten (aman bila skrip lain
   juga mengatur elemen yang sama) dan memeriksa keberadaan
   elemen terlebih dahulu.
   ========================================================= */
(function () {
    'use strict';

    /* ---------- Helper DOM ---------- */
    const $ = (sel, root) => (root || document).querySelector(sel);
    const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

    /* ---------- Parsing angka ---------- */

    /**
     * Ubah teks menjadi angka. Mendukung desimal koma (0,3) atau titik (0.3),
     * serta pemisah ribuan (1.234,5 atau 1,234.5). Mengembalikan NaN bila tidak valid.
     */
    function parseNumber(text) {
        if (typeof text === 'number') return text;
        let s = String(text == null ? '' : text).trim().replace(/\s+/g, '');
        if (s === '') return NaN;
        s = s.replace(/%$/, '');
        if (!/^[+-]?[\d.,]+$/.test(s)) return NaN;

        const lastDot = s.lastIndexOf('.');
        const lastComma = s.lastIndexOf(',');

        if (lastDot !== -1 && lastComma !== -1) {
            // Pemisah yang muncul terakhir dianggap desimal
            if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
            else s = s.replace(/,/g, '');
        } else if (lastComma !== -1) {
            // Hanya koma: satu koma = desimal, banyak koma = ribuan
            s = (s.match(/,/g).length === 1) ? s.replace(',', '.') : s.replace(/,/g, '');
        } else if (lastDot !== -1 && s.match(/\./g).length > 1) {
            s = s.replace(/\./g, '');
        }
        const n = Number(s);
        return Number.isFinite(n) ? n : NaN;
    }

    /**
     * Ubah teks berisi banyak angka menjadi array.
     * Pemisah: spasi, tab, baris baru, titik koma, atau koma.
     * Catatan: token tunggal berbentuk "2,4" (satu koma di antara digit,
     * tanpa spasi) dibaca sebagai desimal 2,4. Gunakan "2, 4" atau "2;4"
     * bila maksudnya dua angka.
     * @returns {{values:number[], invalid:string[]}}
     */
    function parseList(text) {
        const values = [];
        const invalid = [];
        const tokens = String(text || '').split(/[\s;]+/).filter(Boolean);

        tokens.forEach(function (tok) {
            const commas = (tok.match(/,/g) || []).length;
            let parts;
            if (commas === 0) parts = [tok];
            else if (commas === 1 && /^[+-]?\d[\d.]*,\d+$/.test(tok)) parts = [tok]; // desimal koma
            else parts = tok.split(',');

            parts.filter(Boolean).forEach(function (p) {
                const n = parseNumber(p);
                if (Number.isNaN(n)) invalid.push(p);
                else values.push(n);
            });
        });
        return { values: values, invalid: invalid };
    }

    /**
     * Parse isi file CSV: abaikan baris header (baris yang tidak berisi angka sama sekali),
     * pemisah koma / titik koma / tab, desimal titik atau koma.
     * Bila ada beberapa kolom, semua sel numerik diambil.
     */
    function parseCSV(text) {
        const values = [];
        const invalid = [];
        const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/);

        lines.forEach(function (line, idx) {
            if (!line.trim()) return;
            // Tentukan pemisah kolom
            let cells;
            if (line.indexOf(';') !== -1) cells = line.split(';');
            else if (line.indexOf('\t') !== -1) cells = line.split('\t');
            else {
                // Koma bisa desimal (3,5) atau pemisah (3,5,7). Satu koma di antara
                // digit tanpa spasi dianggap desimal bila hanya ada satu kolom.
                cells = /^\s*[+-]?\d[\d.]*,\d+\s*$/.test(line) ? [line] : line.split(',');
            }
            const nums = [];
            let hasText = false;
            cells.forEach(function (c) {
                c = c.trim().replace(/^"|"$/g, '');
                if (c === '') return;
                const n = parseNumber(c);
                if (Number.isNaN(n)) hasText = true;
                else nums.push(n);
            });
            if (nums.length === 0 && hasText) {
                if (idx > 0 && values.length > 0) invalid.push(line.trim()); // bukan header
                return; // baris header → diabaikan
            }
            nums.forEach(function (n) { values.push(n); });
        });
        return { values: values, invalid: invalid };
    }

    /* ---------- Format tampilan (locale Indonesia) ---------- */

    /** Format angka: 1.234,56. Default maksimal 4 desimal. */
    function fmt(n, digits) {
        if (n === null || n === undefined || Number.isNaN(n)) return '–';
        if (!Number.isFinite(n)) return n > 0 ? '∞' : '−∞';
        const d = (digits === undefined) ? 4 : digits;
        const rounded = Math.abs(n) < 1e-12 ? 0 : n;
        return rounded.toLocaleString('id-ID', {
            minimumFractionDigits: 0,
            maximumFractionDigits: d
        });
    }

    /** Format peluang (0–1) dengan 4 desimal, mis. 0,3000 → "0,3". */
    function fmtProb(p, digits) {
        return fmt(p, digits === undefined ? 4 : digits);
    }

    /** Format persen dari nilai 0–1, mis. 0,3897 → "38,97%". */
    function fmtPct(p, digits) {
        if (p === null || p === undefined || Number.isNaN(p)) return '–';
        return fmt(p * 100, digits === undefined ? 2 : digits) + '%';
    }

    /* ---------- Alert ---------- */

    function showAlert(el, message) {
        if (typeof el === 'string') el = document.getElementById(el);
        if (!el) return;
        el.textContent = message;
        el.hidden = false;
    }

    function hideAlert(el) {
        if (typeof el === 'string') el = document.getElementById(el);
        if (!el) return;
        el.textContent = '';
        el.hidden = true;
    }

    /* ---------- Clipboard & unduh ---------- */

    function copyText(text) {
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text);
        }
        return new Promise(function (resolve, reject) {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.setAttribute('readonly', '');
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            try {
                document.execCommand('copy') ? resolve() : reject(new Error('copy gagal'));
            } catch (e) {
                reject(e);
            } finally {
                document.body.removeChild(ta);
            }
        });
    }

    function downloadFile(filename, content, mime) {
        const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 0);
    }

    /** Escape sel CSV. */
    function csvCell(v) {
        const s = String(v == null ? '' : v);
        return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }

    /** Ubah <table> menjadi teks CSV (pemisah titik koma, cocok untuk Excel locale ID). */
    function tableToCSV(table, sep) {
        sep = sep || ';';
        return $$('tr', table).map(function (tr) {
            return $$('th,td', tr).map(function (c) {
                return csvCell(c.textContent.trim());
            }).join(sep);
        }).join('\r\n');
    }

    /** Ubah <table> menjadi teks bertab (untuk ditempel ke Excel/Word). */
    function tableToTSV(table) {
        return $$('tr', table).map(function (tr) {
            return $$('th,td', tr).map(function (c) {
                return c.textContent.trim().replace(/\s+/g, ' ');
            }).join('\t');
        }).join('\n');
    }

    /** Notifikasi singkat pada tombol (mis. "Tersalin!"). */
    function flashButton(btn, text, ms) {
        if (!btn) return;
        const old = btn.textContent;
        btn.textContent = text;
        btn.disabled = true;
        setTimeout(function () {
            btn.textContent = old;
            btn.disabled = false;
        }, ms || 1200);
    }

    /* ---------- Tab generik ---------- */

    /**
     * Hubungkan sekelompok tombol tab. onSelect(button) dipanggil saat dipilih.
     * Mengatur aria-selected & kelas .is-active.
     */
    function setupTabs(buttons, onSelect) {
        function select(btn) {
            buttons.forEach(function (b) {
                const on = (b === btn);
                b.setAttribute('aria-selected', on ? 'true' : 'false');
                b.classList.toggle('is-active', on);
                b.tabIndex = on ? 0 : -1;
            });
            if (onSelect) onSelect(btn);
        }
        buttons.forEach(function (btn, i) {
            btn.addEventListener('click', function () { select(btn); });
            btn.addEventListener('keydown', function (e) {
                let next = null;
                if (e.key === 'ArrowRight') next = buttons[(i + 1) % buttons.length];
                if (e.key === 'ArrowLeft') next = buttons[(i - 1 + buttons.length) % buttons.length];
                if (next) { e.preventDefault(); next.focus(); select(next); }
            });
        });
        const initial = buttons.find(function (b) { return b.getAttribute('aria-selected') === 'true'; }) || buttons[0];
        if (initial) select(initial);
        return select;
    }

    /* ---------- Ekspor ke window ---------- */
    window.App = {
        $: $, $$: $$,
        parseNumber: parseNumber,
        parseList: parseList,
        parseCSV: parseCSV,
        fmt: fmt,
        fmtProb: fmtProb,
        fmtPct: fmtPct,
        showAlert: showAlert,
        hideAlert: hideAlert,
        copyText: copyText,
        downloadFile: downloadFile,
        tableToCSV: tableToCSV,
        tableToTSV: tableToTSV,
        flashButton: flashButton,
        setupTabs: setupTabs
    };

    /* =========================================================
       Wiring UI umum
       ========================================================= */

    /** Tandai link navigasi sesuai halaman aktif. */
    function initNav() {
        const current = (location.pathname.split('/').pop() || 'statistika.html').toLowerCase();
        $$('.main-nav a').forEach(function (a) {
            const href = (a.getAttribute('href') || '').toLowerCase();
            if (href === current) a.setAttribute('aria-current', 'page');
            else a.removeAttribute('aria-current');
        });
    }

    /** Statistika: tab Input manual ⇄ Upload CSV. */
    function initModeInput() {
        const tabManual = $('#tab-manual');
        const tabCsv = $('#tab-csv');
        const manual = $('#manual-area');
        const csv = $('#upload-csv-area');
        if (!tabManual || !tabCsv || !manual || !csv) return;

        setupTabs([tabManual, tabCsv], function (btn) {
            const isManual = (btn === tabManual);
            manual.hidden = !isManual;
            csv.hidden = isManual;
            document.dispatchEvent(new CustomEvent('app:modechange', {
                detail: { mode: isManual ? 'manual' : 'csv' }
            }));
        });
    }

    /** Statistika: tampilkan jumlah data yang terbaca pada textarea. */
    function initDataCounter() {
        const ta = $('#textarea-data');
        const info = $('#info-count');
        if (!ta || !info) return;

        function update() {
            const r = parseList(ta.value);
            let msg = r.values.length + ' data';
            if (r.invalid.length) msg += ' · ' + r.invalid.length + ' nilai tidak valid diabaikan';
            info.textContent = msg;
        }
        ta.addEventListener('input', update);
        update();
    }

    /** Statistika: tampilkan nama file CSV yang dipilih. */
    function initCsvFilename() {
        const input = $('#input-csv');
        const label = $('#csv-filename');
        if (!input || !label) return;
        input.addEventListener('change', function () {
            label.textContent = input.files && input.files[0] ? input.files[0].name : '';
        });
    }

    /** Probabilitas: submenu Dasar / Bayes / Distribusi. */
    function initSubNav() {
        const buttons = $$('.sub-nav [data-sub]');
        if (!buttons.length) return;

        const panels = {};
        buttons.forEach(function (b) {
            panels[b.dataset.sub] = document.getElementById('panel-' + b.dataset.sub);
        });

        const select = setupTabs(buttons, function (btn) {
            Object.keys(panels).forEach(function (key) {
                if (panels[key]) panels[key].hidden = (key !== btn.dataset.sub);
            });
            document.dispatchEvent(new CustomEvent('app:subchange', {
                detail: { sub: btn.dataset.sub }
            }));
        });

        // Dukungan hash: probabilitas.html#bayes
        function fromHash() {
            const key = location.hash.replace('#', '');
            const target = buttons.find(function (b) { return b.dataset.sub === key; });
            if (target) select(target);
        }
        window.addEventListener('hashchange', fromHash);
        fromHash();

        buttons.forEach(function (b) {
            b.addEventListener('click', function () {
                if (history.replaceState) history.replaceState(null, '', '#' + b.dataset.sub);
            });
        });
    }

    /** Probabilitas dasar: input P(A∩B) hanya tampil untuk opsi "diketahui". */
    function initRelasiToggle() {
        const sel = $('#select-relasi');
        const wrap = $('#wrapper-pab');
        if (!sel || !wrap) return;
        function update() { wrap.hidden = (sel.value !== 'custom'); }
        sel.addEventListener('change', update);
        update();
    }

    /** Hapus pesan alert saat pengguna mengubah input. */
    function initAlertAutoClear() {
        $$('.alert').forEach(function (alertEl) {
            const scope = alertEl.closest('form, section, .card');
            if (!scope) return;
            scope.addEventListener('input', function () { hideAlert(alertEl); });
        });
    }

    function init() {
        initNav();
        initModeInput();
        initDataCounter();
        initCsvFilename();
        initSubNav();
        initRelasiToggle();
        initAlertAutoClear();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();