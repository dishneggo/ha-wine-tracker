// Theme system: named themes × light/dark mode
var THEME_MODES = ['system', 'dark', 'light'];

// Theme definitions with preview colors [bg-dark, accent, gold]
var THEMES = [
  { key: 'homeassistant', colors: ['#111111', '#0080a6', '#ff9800'] },
  { key: 'classic',   colors: ['#1a0a0f', '#c0392b', '#d4a843'] },
  { key: 'vineyard',  colors: ['#0f1a12', '#3a863d', '#c9a84c'] },
  { key: 'champagne', colors: ['#1a1508', '#8c722a', '#d4a843'] },
  { key: 'slate',     colors: ['#12151c', '#4368f9', '#c9a84c'] },
  { key: 'burgundy',  colors: ['#180a1c', '#ab47bc', '#d4a843'] }
];

function getSystemPreference() {
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(mode) {
  var effective = mode === 'system' ? getSystemPreference() : mode;
  document.documentElement.classList.toggle('light', effective === 'light');
  if (typeof window._onThemeApplied === 'function') window._onThemeApplied();
}

function applyThemeName(name) {
  if (!name || name === 'classic') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', name);
  }
}

function setThemeName(name) {
  localStorage.setItem('wine-theme-name', name);
  applyThemeName(name);
  updateThemeDropdown();
}

function setThemeMode(mode) {
  localStorage.setItem('wine-theme', mode);
  applyTheme(mode);
  updateThemeSegmented();
}

function cycleTheme() {
  var current = localStorage.getItem('wine-theme') || 'system';
  var idx = THEME_MODES.indexOf(current);
  var next = THEME_MODES[(idx + 1) % THEME_MODES.length];
  setThemeMode(next);
}

function updateThemeSegmented() {
  var current = localStorage.getItem('wine-theme') || 'system';
  document.querySelectorAll('input[name="themeMode"]').forEach(function(r) {
    r.checked = (r.value === current);
  });
}

function updateThemeDropdown() {
  var current = localStorage.getItem('wine-theme-name') || 'homeassistant';
  // Update button display
  var btn = document.querySelector('.theme-dropdown-btn');
  if (btn) {
    var t = THEMES.find(function(t) { return t.key === current; }) || THEMES[0];
    var label = btn.querySelector('.dd-label');
    var dots = btn.querySelector('.theme-dots');
    if (label) label.textContent = getThemeLabel(current);
    if (dots) dots.innerHTML = t.colors.map(function(c) {
      return '<span class="theme-dot" style="background:' + c + '"></span>';
    }).join('');
  }
  // Update list items
  document.querySelectorAll('.theme-dropdown-item').forEach(function(item) {
    var isActive = item.dataset.theme === current;
    item.classList.toggle('active', isActive);
    var check = item.querySelector('.dd-check');
    if (check) check.style.display = isActive ? '' : 'none';
  });
}

function getThemeLabel(key) {
  // Try to get translated label from DOM data attribute, fallback to capitalized key
  var el = document.querySelector('[data-theme-labels]');
  if (el) {
    try {
      var labels = JSON.parse(el.dataset.themeLabels);
      if (labels[key]) return labels[key];
    } catch(e) {}
  }
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function toggleThemeDropdown(e) {
  if (e) e.stopPropagation();
  var dd = document.querySelector('.theme-dropdown');
  if (!dd) return;
  dd.classList.toggle('open');
  if (dd.classList.contains('open')) {
    var btn = dd.querySelector('.theme-dropdown-btn');
    var list = dd.querySelector('.theme-dropdown-list');
    if (btn && list) {
      var r = btn.getBoundingClientRect();
      list.style.top = (r.bottom + 4) + 'px';
      list.style.left = r.left + 'px';
      list.style.width = r.width + 'px';
    }
  }
}

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
  var dd = document.querySelector('.theme-dropdown');
  if (dd && !dd.contains(e.target)) dd.classList.remove('open');
});

// ── Chat recording toggle ────────────────────────────────────────────────────
function toggleChatRecording(enabled) {
  localStorage.setItem('chatRecording', enabled ? '1' : '0');
  if (typeof _updateChatHistoryButtons === 'function') _updateChatHistoryButtons();
}

function initChatRecordingToggle() {
  var el = document.getElementById('chatRecordingToggle');
  if (el) el.checked = localStorage.getItem('chatRecording') !== '0'; // default ON
  var el2 = document.getElementById('chatEditWinesToggle');
  if (el2) el2.checked = localStorage.getItem('chatEditWines') === '1'; // default OFF
}

function toggleChatEditWines(enabled) {
  localStorage.setItem('chatEditWines', enabled ? '1' : '0');
}

// ── Settings modal tabs ──────────────────────────────────────────────────────

function switchSettingsTab(name) {
  document.querySelectorAll('#settingsModal .settings-tab').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.tab === name);
  });
  document.querySelectorAll('#settingsModal .settings-section[data-settings-tab]').forEach(function(sec) {
    sec.style.display = sec.dataset.settingsTab === name ? '' : 'none';
  });
  try { localStorage.setItem('wineSettingsTab', name); } catch (e) {}
}

function initSettingsTabs() {
  var tabs = document.querySelectorAll('#settingsModal .settings-tab');
  if (!tabs.length) return;
  var saved = null;
  try { saved = localStorage.getItem('wineSettingsTab'); } catch (e) {}
  var valid = Array.prototype.some.call(tabs, function(b) { return b.dataset.tab === saved; });
  switchSettingsTab(valid ? saved : tabs[0].dataset.tab);
}

// ── AI settings (settings modal) ─────────────────────────────────────────────

var _aiSettings = null;

function _apiBase() {
  return window.INGRESS !== undefined ? window.INGRESS : _ingressPrefix();
}

function _aiStatus(msg, kind) {
  var el = document.getElementById('aiSettingsStatus');
  if (!el) return;
  el.textContent = msg || '';
  el.className = 'ai-status' + (kind ? ' ' + kind : '');
}

function _aiBusy(busy) {
  ['aiTestBtn', 'aiSaveBtn'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.disabled = busy;
  });
}

function aiSettingsLoad() {
  fetch(_apiBase() + '/api/ai-settings')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.ok) return;
      _aiSettings = data;
      document.getElementById('aiProviderSelect').value = data.settings.ai_provider || 'none';
      document.getElementById('aiChatModelInput').value = data.settings.chat_model || '';
      document.getElementById('aiHostInput').value = data.settings.ollama_host || '';
      aiSettingsProviderChanged();
    })
    .catch(function() {});
}

function aiSettingsProviderChanged() {
  var p = document.getElementById('aiProviderSelect').value;
  document.getElementById('aiProviderFields').style.display = p === 'none' ? 'none' : '';
  document.getElementById('aiTestBtn').style.display = p === 'none' ? 'none' : '';
  if (p === 'none' || !_aiSettings) return;
  document.getElementById('aiKeyRow').style.display = p === 'ollama' ? 'none' : '';
  document.getElementById('aiHostRow').style.display = p === 'ollama' ? '' : 'none';
  document.getElementById('aiModelInput').value = _aiSettings.settings[p + '_model'] || '';
  var keyInput = document.getElementById('aiApiKeyInput');
  keyInput.value = '';
  keyInput.placeholder = _aiSettings.keys[p + '_api_key'] ? T.ai_key_stored : T.ai_key_placeholder;
  _aiLoadModelList(p);
}

var _aiModelCache = {};
var _modelDdTarget = null;

function _aiSetModelButtons(hasModels) {
  ['aiModelDdBtn', 'aiChatModelDdBtn'].forEach(function(id) {
    var b = document.getElementById(id);
    if (b) b.style.display = hasModels ? '' : 'none';
  });
  ['aiModelInput', 'aiChatModelInput'].forEach(function(id) {
    var input = document.getElementById(id);
    if (input) input.readOnly = hasModels;
  });
}

function _aiLoadModelList(provider) {
  closeModelDd();
  if (_aiModelCache[provider]) {
    _aiSetModelButtons(_aiModelCache[provider].length > 0);
    return;
  }
  _aiSetModelButtons(false);
  fetch(_apiBase() + '/api/ai-settings/models?provider=' + encodeURIComponent(provider))
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.ok || !data.models) return;
      _aiModelCache[provider] = data.models;
      if (document.getElementById('aiProviderSelect').value === provider) {
        _aiSetModelButtons(data.models.length > 0);
      }
    })
    .catch(function() {});
}

function toggleModelDd(inputId, ev) {
  if (ev) ev.stopPropagation();
  var dd = document.getElementById('aiModelDd');
  if (!dd) return;
  if (_modelDdTarget === inputId && dd.style.display === 'block') { closeModelDd(); return; }
  var provider = document.getElementById('aiProviderSelect').value;
  var models = _aiModelCache[provider] || [];
  if (!models.length) { closeModelDd(); return; }
  _modelDdTarget = inputId;
  var input = document.getElementById(inputId);
  var current = input.value.trim();
  var html = '';
  if (models.length > 20) {
    html += '<input type="text" class="model-dd-filter" oninput="filterModelDd(this)" onclick="event.stopPropagation()">';
  }
  if (inputId === 'aiChatModelInput') {
    html += '<div class="model-dd-item' + (current === '' ? ' active' : '') + '" data-model="" tabindex="0" role="button">&mdash;</div>';
  }
  html += models.map(function(m) {
    var esc = m.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    return '<div class="model-dd-item' + (m === current ? ' active' : '') + '" data-model="' + esc + '" tabindex="0" role="button">' + esc + '</div>';
  }).join('');
  dd.innerHTML = html;
  var r = input.getBoundingClientRect();
  dd.style.display = 'block';
  dd.style.left = r.left + 'px';
  dd.style.width = r.width + 'px';
  var ddHeight = Math.min(260, dd.scrollHeight);
  var top = r.bottom + 4;
  if (top + ddHeight > window.innerHeight - 8) top = Math.max(8, r.top - ddHeight - 4);
  dd.style.top = top + 'px';
  var filter = dd.querySelector('.model-dd-filter');
  if (filter) filter.focus();
  var active = dd.querySelector('.model-dd-item.active');
  if (active) active.scrollIntoView({ block: 'center' });
}

function filterModelDd(filterInput) {
  var q = filterInput.value.trim().toLowerCase();
  document.querySelectorAll('#aiModelDd .model-dd-item').forEach(function(item) {
    item.style.display = !q || item.dataset.model.toLowerCase().indexOf(q) !== -1 ? '' : 'none';
  });
}

function closeModelDd() {
  var dd = document.getElementById('aiModelDd');
  if (dd) dd.style.display = 'none';
  _modelDdTarget = null;
}

document.addEventListener('click', function(e) {
  var dd = document.getElementById('aiModelDd');
  if (!dd || dd.style.display !== 'block') return;
  var item = e.target.closest('.model-dd-item');
  if (item && dd.contains(item)) {
    var input = document.getElementById(_modelDdTarget);
    if (input) input.value = item.dataset.model;
    closeModelDd();
    return;
  }
  if (!dd.contains(e.target)) closeModelDd();
});

window.addEventListener('scroll', function(e) {
  var dd = document.getElementById('aiModelDd');
  if (!dd || dd.style.display !== 'block') return;
  if (e.target === dd) return;
  closeModelDd();
}, true);

function aiSettingsSave(cb) {
  var p = document.getElementById('aiProviderSelect').value;
  var payload = {
    ai_provider: p,
    chat_model: document.getElementById('aiChatModelInput').value
  };
  if (p !== 'none') {
    payload[p + '_model'] = document.getElementById('aiModelInput').value;
    if (p === 'ollama') payload.ollama_host = document.getElementById('aiHostInput').value;
    var key = document.getElementById('aiApiKeyInput').value.trim();
    if (key) payload[p + '_api_key'] = key;
  }
  _aiStatus('…');
  _aiBusy(true);
  fetch(_apiBase() + '/api/ai-settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    body: JSON.stringify(payload)
  })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.ok) { _aiStatus(T.ai_save_failed, 'error'); _aiBusy(false); return; }
      if (payload[p + '_api_key']) delete _aiModelCache[p];
      document.getElementById('aiApiKeyInput').value = '';
      _aiStatus(T.ai_saved, 'ok');
      if (typeof cb === 'function') { cb(); return; }
      location.reload();
    })
    .catch(function() { _aiStatus(T.ai_save_failed, 'error'); _aiBusy(false); });
}

function aiSettingsTest() {
  aiSettingsSave(function() {
    _aiStatus(T.ai_testing);
    fetch(_apiBase() + '/api/ai-settings/test', {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        _aiStatus(data.ok ? T.ai_test_ok : T.ai_test_failed + ': ' + (data.error || ''),
                  data.ok ? 'ok' : 'error');
        _aiBusy(false);
      })
      .catch(function() { _aiStatus(T.ai_test_failed, 'error'); _aiBusy(false); });
  });
}

// ── Data: Export ──────────────────────────────────────────────────────────────

function exportBackup() {
  var btn = document.getElementById('exportBackupBtn');
  if (btn) btn.disabled = true;
  fetch(_apiBase() + '/export')
    .then(function(r) {
      if (!r.ok) throw new Error('export failed');
      var dispo = r.headers.get('Content-Disposition') || '';
      var match = dispo.match(/filename="?([^";]+)"?/);
      var name = match ? match[1] : 'wine-tracker-export.zip';
      return r.blob().then(function(blob) { return { blob: blob, name: name }; });
    })
    .then(function(res) {
      var embedded = document.body.classList.contains('embedded');
      if (embedded && navigator.canShare) {
        var file = new File([res.blob], res.name, { type: 'application/zip' });
        if (navigator.canShare({ files: [file] })) {
          return navigator.share({ files: [file] }).catch(function() {});
        }
      }
      var url = URL.createObjectURL(res.blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = res.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function() { URL.revokeObjectURL(url); }, 10000);
    })
    .catch(function() { window.location.href = _apiBase() + '/export'; })
    .finally(function() { if (btn) btn.disabled = false; });
}

// ── Data: Import ──────────────────────────────────────────────────────────────
// Remember the token returned by /import/preview so confirmImport() can commit.
var _importToken = null;

function _ingressPrefix() {
  // Best-effort: reuse any ingress path already baked into links on the page.
  var anchor = document.querySelector('a[href*="/export"]');
  if (anchor) return anchor.getAttribute('href').replace(/\/export$/, '');
  return '';
}

function _showImportError(msg) {
  var el = document.getElementById('importError');
  if (!el) { appToast(msg, 'error'); return; }
  el.textContent = msg;
  el.style.display = 'block';
}

function _clearImportError() {
  var el = document.getElementById('importError');
  if (el) { el.textContent = ''; el.style.display = 'none'; }
}

function handleImportFile(input) {
  var file = input && input.files && input.files[0];
  if (!file) return;

  var fd = new FormData();
  fd.append('file', file);

  // Close settings, prepare preview modal.
  if (typeof closeModal === 'function') closeModal('settingsModal');
  _clearImportError();
  openModal('importPreviewModal');

  fetch(_ingressPrefix() + '/import/preview', {
      method: 'POST',
      body: fd,
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    })
    .then(function(r) { return r.json().then(function(j) { return { ok: r.ok, body: j }; }); })
    .then(function(res) {
      if (!res.ok || !res.body.ok) {
        _showImportError(res.body.error || 'Import fehlgeschlagen');
        return;
      }
      _importToken = res.body.token;
      _renderImportPreview(res.body);
    })
    .catch(function(err) {
      _showImportError(String(err));
    })
    .finally(function() { input.value = ''; });
}

function _renderImportPreview(data) {
  var c = data.counts || {};
  document.getElementById('importCountNew').textContent = c.new || 0;
  document.getElementById('importCountDup').textContent = c.duplicates || 0;
  document.getElementById('importCountTotal').textContent = c.total || 0;
  document.getElementById('importNewCountInline').textContent = c.new || 0;
  document.getElementById('importDupCountInline').textContent = c.duplicates || 0;

  var newList = document.getElementById('importNewList');
  newList.innerHTML = '';
  (data.new || []).forEach(function(item) {
    var li = document.createElement('li');
    li.textContent = item.label;
    newList.appendChild(li);
  });

  var dupList = document.getElementById('importDupList');
  dupList.innerHTML = '';
  (data.duplicates || []).forEach(function(item) {
    var li = document.createElement('li');
    li.textContent = item.label;
    dupList.appendChild(li);
  });

  // If no duplicates, hide strategy block (nothing to choose).
  var hasDups = (c.duplicates || 0) > 0;
  var block = document.getElementById('importStrategyBlock');
  if (block) block.style.display = hasDups ? '' : 'none';
}

function confirmImport() {
  if (!_importToken) {
    _showImportError('Kein Import vorbereitet');
    return;
  }
  var strategyEl = document.querySelector('input[name="importStrategy"]:checked');
  var strategy = strategyEl ? strategyEl.value : 'skip';

  var btn = document.getElementById('importConfirmBtn');
  if (btn) { btn.disabled = true; btn.textContent = '…'; }
  _clearImportError();

  fetch(_ingressPrefix() + '/import/commit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify({ token: _importToken, strategy: strategy }),
  })
    .then(function(r) { return r.json().then(function(j) { return { ok: r.ok, body: j }; }); })
    .then(function(res) {
      if (!res.ok || !res.body.ok) {
        _showImportError(res.body.error || 'Import fehlgeschlagen');
        return;
      }
      // Success - reload so the new wines appear.
      closeModal('importPreviewModal');
      location.reload();
    })
    .catch(function(err) { _showImportError(String(err)); })
    .finally(function() {
      if (btn) { btn.disabled = false; btn.textContent = btn.getAttribute('data-label') || 'Import'; }
    });
}

var PREF_KEYS = ['wine-theme', 'wine-theme-name', 'wineViewMode', 'wineTableSortCol',
                 'wineTableSortAsc', 'wine-show-empty', 'wine-advanced-filter-default',
                 'chatEditWines', 'chatRecording'];
var _prefSyncTimer = null;

function _collectPrefs() {
  var prefs = {};
  PREF_KEYS.forEach(function(k) {
    var v = localStorage.getItem(k);
    if (v !== null) prefs[k] = v;
  });
  return prefs;
}

function _schedulePrefSync() {
  clearTimeout(_prefSyncTimer);
  _prefSyncTimer = setTimeout(function() {
    fetch((window.INGRESS !== undefined ? window.INGRESS : _ingressPrefix()) + '/api/prefs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify(_collectPrefs()),
      keepalive: true
    }).catch(function() {});
  }, 400);
}

(function() {
  var origSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function(k, v) {
    origSetItem(k, v);
    if (PREF_KEYS.indexOf(k) !== -1) _schedulePrefSync();
  };
  var origRemoveItem = localStorage.removeItem.bind(localStorage);
  localStorage.removeItem = function(k) {
    origRemoveItem(k);
    if (PREF_KEYS.indexOf(k) !== -1) _schedulePrefSync();
  };
  if (window._serverPrefsEmpty === true && Object.keys(_collectPrefs()).length) {
    document.addEventListener('DOMContentLoaded', _schedulePrefSync);
  }
})();

// Apply theme name on load (mode is handled by inline script + OS listener)
(function() {
  var name = localStorage.getItem('wine-theme-name') || 'homeassistant';
  applyThemeName(name);
})();

// ── Shared toast (pages without their own qtyUndoToast host) ─────────────────
var _appToastTimer = null;
function appToast(message, kind) {
  if (kind === 'error' && typeof showErrorToast === 'function' && document.getElementById('qtyUndoToast')) { showErrorToast(message); return; }
  var el = document.getElementById('appToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'appToast';
    el.className = 'qty-undo-toast';
    el.style.display = 'none';
    el.innerHTML = '<span></span>';
    document.body.appendChild(el);
  }
  el.querySelector('span').textContent = message;
  el.classList.toggle('error', kind === 'error');
  el.style.display = 'flex';
  el.style.opacity = '1';
  clearTimeout(_appToastTimer);
  _appToastTimer = setTimeout(function() {
    el.style.opacity = '0';
    setTimeout(function() { el.style.display = 'none'; }, 400);
  }, kind === 'error' ? 4000 : 2500);
}

// ── Shared confirm dialog (replaces native confirm, blocked in HA ingress) ───
var _appConfirmResolve = null;
function _ensureAppConfirm() {
  var el = document.getElementById('appConfirmDialog');
  if (el) return el;
  el = document.createElement('div');
  el.className = 'modal-overlay app-confirm-overlay';
  el.id = 'appConfirmDialog';
  el.innerHTML = '<div class="modal" style="max-width:360px">' +
    '<div class="app-confirm-body" id="appConfirmMsg"></div>' +
    '<div class="delete-confirm-actions">' +
    '<button type="button" class="btn-cancel" id="appConfirmCancel"></button>' +
    '<button type="button" class="btn-delete" id="appConfirmOk"></button>' +
    '</div></div>';
  document.body.appendChild(el);
  el.addEventListener('click', function(e) { if (e.target === el) _appConfirmClose(false); });
  el.querySelector('#appConfirmCancel').addEventListener('click', function() { _appConfirmClose(false); });
  el.querySelector('#appConfirmOk').addEventListener('click', function() { _appConfirmClose(true); });
  return el;
}
function _appConfirmClose(result) {
  var el = document.getElementById('appConfirmDialog');
  if (el) el.classList.remove('open');
  var resolve = _appConfirmResolve;
  _appConfirmResolve = null;
  if (_appConfirmReturnFocus && _appConfirmReturnFocus.focus) {
    try { _appConfirmReturnFocus.focus(); } catch (e) {}
  }
  _appConfirmReturnFocus = null;
  if (resolve) resolve(result);
}
var _appConfirmReturnFocus = null;
function appConfirm(message, opts) {
  opts = opts || {};
  var el = _ensureAppConfirm();
  var tr = window.T || {};
  if (_appConfirmResolve) _appConfirmClose(false);
  _appConfirmReturnFocus = document.activeElement;
  el.querySelector('#appConfirmMsg').textContent = message;
  el.querySelector('#appConfirmCancel').textContent = opts.cancelLabel || tr.btn_cancel || 'Cancel';
  var ok = el.querySelector('#appConfirmOk');
  ok.textContent = opts.okLabel || 'OK';
  return new Promise(function(resolve) {
    _appConfirmResolve = resolve;
    el.classList.add('open');
    setTimeout(function() { try { ok.focus(); } catch (e) {} }, 50);
  });
}

// ── Shared close behavior: one layer per ESC, overlay click closes itself ────
function closeTopLayer() {
  var nav = document.getElementById('navMenu');
  if (nav && nav.classList.contains('open')) { nav.classList.remove('open'); return true; }
  var themeDd = document.querySelector('.theme-dropdown.open');
  if (themeDd) { themeDd.classList.remove('open'); return true; }
  var modelDd = document.getElementById('aiModelDd');
  if (modelDd && modelDd.style.display === 'block') { closeModelDd(); return true; }
  var filterDd = document.getElementById('filterDropdown');
  if (filterDd && filterDd.classList.contains('open')) { filterDd.classList.remove('open'); return true; }
  var qtyPop = document.getElementById('qtyPopover');
  if (qtyPop && qtyPop.style.display === 'flex') {
    if (typeof closeQtyPopover === 'function') closeQtyPopover(); else qtyPop.style.display = 'none';
    return true;
  }
  var reloadPop = document.getElementById('reloadPopover');
  if (reloadPop && reloadPop.style.display !== 'none') {
    if (typeof closeReloadPopover === 'function') closeReloadPopover();
    return true;
  }
  var lb = document.getElementById('lightbox');
  if (lb && lb.classList.contains('open')) {
    if (typeof closeLightbox === 'function') closeLightbox(); else lb.classList.remove('open');
    return true;
  }
  var confirmDlg = document.getElementById('appConfirmDialog');
  if (confirmDlg && confirmDlg.classList.contains('open')) { _appConfirmClose(false); return true; }
  var nameDlg = document.getElementById('advFilterNameDialog');
  if (nameDlg && nameDlg.classList.contains('open')) {
    if (window.AdvancedFilter && AdvancedFilter.closeNameDialog) AdvancedFilter.closeNameDialog();
    else nameDlg.classList.remove('open');
    return true;
  }
  var overlays = document.querySelectorAll('.modal-overlay.open');
  for (var i = overlays.length - 1; i >= 0; i--) {
    var el = overlays[i];
    if (el.id === 'advFilterNameDialog' || el.id === 'appConfirmDialog') continue;
    if (el.id === 'wineModal' && typeof tryCloseWineModal === 'function') tryCloseWineModal();
    else if (el.id === 'advancedFilterModal' && window.AdvancedFilter) AdvancedFilter.closeModal();
    else el.classList.remove('open');
    return true;
  }
  return false;
}
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Escape') return;
  if (closeTopLayer()) e.preventDefault();
});
document.addEventListener('click', function(e) {
  var el = e.target;
  if (!el.classList || !el.classList.contains('modal-overlay') || !el.classList.contains('open')) return;
  if (el.id === 'wineModal' || el.id === 'advFilterNameDialog' || el.id === 'appConfirmDialog') return;
  if (el.id === 'advancedFilterModal' && window.AdvancedFilter) { AdvancedFilter.closeModal(); return; }
  el.classList.remove('open');
});

// Keyboard activation for non-native click targets (tabindex="0" + onclick)
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  var el = e.target;
  if (!el || !el.getAttribute || el.getAttribute('tabindex') !== '0') return;
  if (!el.hasAttribute('onclick') && el.getAttribute('role') !== 'button') return;
  if (el.matches('button, a, input, select, textarea, label')) return;
  e.preventDefault();
  el.click();
});

// OS theme change listener
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function() {
  if ((localStorage.getItem('wine-theme') || 'system') === 'system') applyTheme('system');
});

// Initialize UI controls when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  updateThemeSegmented();
  updateThemeDropdown();
  initSettingsTabs();
  if (document.getElementById('aiProviderSelect')) aiSettingsLoad();
  ['aiModelInput', 'aiChatModelInput'].forEach(function(id) {
    var input = document.getElementById(id);
    if (input) input.addEventListener('click', function(e) {
      if (input.readOnly) toggleModelDd(id, e);
    });
  });
});
