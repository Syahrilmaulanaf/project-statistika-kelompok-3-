(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const parse = (id, label) => {
    const raw = $(id)?.value?.trim().replace(',', '.');
    const value = Number(raw);
    if (raw === '' || !Number.isFinite(value)) throw new Error(`${label} harus berupa angka yang valid.`);
    return value;
  };
  const probability = (id, label) => {
    const value = parse(id, label);
    if (value < 0 || value > 1) throw new Error(`${label} harus berada di antara 0 dan 1.`);
    return value;
  };
  const percent = (id, label) => {
    const value = parse(id, label);
    if (value < 0 || value > 100) throw new Error(`${label} harus berada di antara 0 dan 100%.`);
    return value / 100;
  };
  const fmt = (value, digits = 6) => Number(value.toFixed(digits)).toLocaleString('id-ID', { maximumFractionDigits: digits });
  const showError = (id, message = '') => {
    const node = $(id);
    if (!node) return;
    node.textContent = message;
    node.hidden = !message;
  };
  const output = (id, value) => { if ($(id)) $(id).textContent = value; };
  const resetOutputs = (ids, dash = '–') => ids.forEach((id) => output(id, dash));
  const runSafely = (alertId, callback) => {
    showError(alertId);
    try { callback(); } catch (error) { showError(alertId, error.message || 'Terjadi kesalahan perhitungan.'); }
  };

  // Navigasi panel probabilitas
  document.querySelectorAll('[data-sub]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.sub;
      document.querySelectorAll('[data-sub]').forEach((tab) => tab.setAttribute('aria-selected', String(tab === button)));
      ['dasar', 'bayes', 'distribusi'].forEach((name) => {
        const panel = $(`panel-${name}`);
        if (panel) panel.hidden = name !== target;
      });
    });
  });

  const relation = $('select-relasi');
  relation?.addEventListener('change', () => { if ($('wrapper-pab')) $('wrapper-pab').hidden = relation.value !== 'custom'; });
  relation?.dispatchEvent(new Event('change'));

  $('form-dasar')?.addEventListener('submit', (event) => {
    event.preventDefault();
    runSafely('alert-prob', () => {
      const pa = probability('input-pa', 'P(A)');
      const pb = probability('input-pb', 'P(B)');
      let intersection;
      if (relation.value === 'exclusive') intersection = 0;
      else if (relation.value === 'independent') intersection = pa * pb;
      else intersection = probability('input-pab', 'P(A∩B)');
      if (intersection > Math.min(pa, pb)) throw new Error('P(A∩B) tidak boleh melebihi P(A) atau P(B).');
      const union = pa + pb - intersection;
      if (union > 1 + 1e-12) throw new Error('Kombinasi peluang menghasilkan P(A∪B) lebih dari 1. Periksa hubungan kejadian.');
      output('prob-pa', fmt(pa)); output('prob-pac', fmt(1 - pa));
      output('prob-pb', fmt(pb)); output('prob-pbc', fmt(1 - pb));
      output('prob-union', fmt(union)); output('prob-inter', fmt(intersection));
      output('chip-lepas', `Saling lepas: ${intersection === 0 ? 'Ya' : 'Tidak'}`);
      output('chip-independen', `Independen: ${Math.abs(intersection - pa * pb) < 1e-10 ? 'Ya' : 'Tidak'}`);
      output('formula-walkthrough', `P(A∪B) = P(A) + P(B) − P(A∩B)\n= ${fmt(pa)} + ${fmt(pb)} − ${fmt(intersection)}\n= ${fmt(union)}`);
    });
  });
  $('btn-reset-prob')?.addEventListener('click', () => {
    $('form-dasar')?.reset(); relation?.dispatchEvent(new Event('change')); showError('alert-prob');
    resetOutputs(['prob-pa','prob-pac','prob-pb','prob-pbc','prob-union','prob-inter','chip-lepas','chip-independen','formula-walkthrough']);
  });

  $('btn-cond')?.addEventListener('click', () => runSafely('alert-cond', () => {
    const joint = probability('input-cond-ab', 'P(A∩B)');
    const pb = probability('input-cond-b', 'P(B)');
    if (pb === 0) throw new Error('P(B) harus lebih besar dari 0 untuk menghitung P(A|B).');
    const result = joint / pb;
    if (result > 1) throw new Error('P(A∩B) tidak boleh lebih besar dari P(B).');
    output('res-cond', fmt(result));
    output('cond-interpretasi', `Jika B terjadi, peluang A terjadi adalah ${fmt(result)} (${fmt(result * 100, 2)}%).`);
  }));

  $('form-bayes')?.addEventListener('submit', (event) => {
    event.preventDefault();
    runSafely('alert-bayes', () => {
      const prevalence = percent('input-prevalensi', 'Prevalensi');
      const sensitivity = percent('input-sensitivitas', 'Sensitivitas');
      const fpr = percent('input-fpr', 'False positive');
      const pFlag = sensitivity * prevalence + fpr * (1 - prevalence);
      if (pFlag === 0) throw new Error('Peluang email ditandai adalah 0, sehingga posterior tidak dapat dihitung.');
      const posterior = sensitivity * prevalence / pFlag;
      output('bayes-pflag', `${fmt(pFlag * 100, 2)}%`);
      output('bayes-posterior', `${fmt(posterior * 100, 2)}%`);
      const tpShare = posterior * 100;
      const fpShare = (1 - posterior) * 100;
      $('bar-tp').style.width = `${tpShare}%`; $('bar-fp').style.width = `${fpShare}%`;
      output('bar-tp', `Phishing benar ${fmt(tpShare, 2)}%`); output('bar-fp', `Email normal ${fmt(fpShare, 2)}%`);
      output('bayes-interpretasi', `Dari email yang ditandai, sekitar ${fmt(posterior * 100, 2)}% benar-benar phishing.`);
    });
  });
  $('btn-reset-bayes')?.addEventListener('click', () => {
    $('form-bayes')?.reset(); showError('alert-bayes');
    resetOutputs(['bayes-pflag','bayes-posterior']);
    $('bar-tp').style.width = '50%'; $('bar-fp').style.width = '50%'; output('bar-tp', '–'); output('bar-fp', '–');
    output('bayes-interpretasi', 'Tekan Analisis Bayes untuk melihat interpretasi hasil.');
  });

  const integer = (id, label, min = 0) => {
    const value = parse(id, label);
    if (!Number.isInteger(value) || value < min) throw new Error(`${label} harus berupa bilangan bulat minimal ${min}.`);
    return value;
  };
  const logFactorial = (n) => { let sum = 0; for (let i = 2; i <= n; i++) sum += Math.log(i); return sum; };
  const binomialPmf = (n, k, p) => {
    if (k > n) return 0;
    if (p === 0) return k === 0 ? 1 : 0;
    if (p === 1) return k === n ? 1 : 0;
    const log = logFactorial(n) - logFactorial(k) - logFactorial(n-k) + k*Math.log(p) + (n-k)*Math.log1p(-p);
    return Math.exp(log);
  };
  $('btn-bin')?.addEventListener('click', () => runSafely('alert-bin', () => {
    const n = integer('input-bin-n', 'n');
    const p = probability('input-bin-p', 'p');
    const k = integer('input-bin-k', 'k');
    if (n > 10000) throw new Error('n terlalu besar (maksimal 10000).');
    const exact = binomialPmf(n, k, p);
    let cumulative = 0;
    for (let i = 0; i <= Math.min(k, n); i++) cumulative += binomialPmf(n, i, p);
    output('res-bin-eq', fmt(exact)); output('res-bin-le', fmt(Math.min(1, cumulative)));
  }));

  const poissonPmf = (lambda, k) => lambda === 0 ? (k === 0 ? 1 : 0) : Math.exp(-lambda + k*Math.log(lambda) - logFactorial(k));
  $('btn-poi')?.addEventListener('click', () => runSafely('alert-poi', () => {
    const lambda = parse('input-poi-l', 'λ');
    const k = integer('input-poi-k', 'k');
    if (lambda < 0 || lambda > 10000) throw new Error('λ harus berada di antara 0 dan 10000.');
    if (k > 10000) throw new Error('k terlalu besar (maksimal 10000).');
    const exact = poissonPmf(lambda, k);
    let cumulative = 0;
    for (let i = 0; i <= k; i++) cumulative += poissonPmf(lambda, i);
    output('res-poi-eq', fmt(exact)); output('res-poi-le', fmt(Math.min(1, cumulative)));
  }));
})();
