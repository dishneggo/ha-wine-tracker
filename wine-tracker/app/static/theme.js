// Theme system: named themes × light/dark mode
var THEME_MODES = ['system', 'dark', 'light'];

// Theme definitions with preview colors [bg-dark, accent, gold]
var THEMES = [
  { key: 'homeassistant', colors: ['#111111', '#009ac7', '#ff9800'] },
  { key: 'classic',   colors: ['#1a0a0f', '#c0392b', '#d4a843'] },
  { key: 'vineyard',  colors: ['#0f1a12', '#4caf50', '#c9a84c'] },
  { key: 'champagne', colors: ['#1a1508', '#c9a84c', '#d4a843'] },
  { key: 'slate',     colors: ['#12151c', '#5c7cfa', '#c9a84c'] },
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

// ── AI settings (settings modal) ─────────────────────────────────────────────

var _aiSettings = null;

function _apiBase() {
  return window.INGRESS !== undefined ? window.INGRESS : _ingressPrefix();
}

function _aiStatus(msg) {
  var el = document.getElementById('aiSettingsStatus');
  if (el) el.textContent = msg || '';
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
  if (p === 'none' || !_aiSettings) return;
  document.getElementById('aiKeyRow').style.display = p === 'ollama' ? 'none' : '';
  document.getElementById('aiHostRow').style.display = p === 'ollama' ? '' : 'none';
  document.getElementById('aiModelInput').value = _aiSettings.settings[p + '_model'] || '';
  var keyInput = document.getElementById('aiApiKeyInput');
  keyInput.value = '';
  keyInput.placeholder = _aiSettings.keys[p + '_api_key'] ? T.ai_key_stored : T.ai_key_placeholder;
}

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
  fetch(_apiBase() + '/api/ai-settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    body: JSON.stringify(payload)
  })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.ok) { _aiStatus(T.ai_save_failed); return; }
      document.getElementById('aiApiKeyInput').value = '';
      _aiStatus(T.ai_saved);
      if (typeof cb === 'function') { cb(); return; }
      location.reload();
    })
    .catch(function() { _aiStatus(T.ai_save_failed); });
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
        _aiStatus(data.ok ? T.ai_test_ok : T.ai_test_failed + ': ' + (data.error || ''));
      })
      .catch(function() { _aiStatus(T.ai_test_failed); });
  });
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
  if (!el) { alert(msg); return; }
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

// OS theme change listener
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function() {
  if ((localStorage.getItem('wine-theme') || 'system') === 'system') applyTheme('system');
});

// Initialize UI controls when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  updateThemeSegmented();
  updateThemeDropdown();
  if (document.getElementById('aiProviderSelect')) aiSettingsLoad();
});
