/* Adds the CSRF token to every same-origin state-changing fetch().
 * Loaded in <head> before any other script, so all later fetch() calls
 * (39 call sites across templates and static JS) go through it.
 * The token comes from <meta name="csrf-token">. */
(function () {
  'use strict';
  var meta = document.querySelector('meta[name="csrf-token"]');
  var token = meta ? meta.getAttribute('content') : '';
  if (!token || !window.fetch) return;
  var SAFE = { GET: 1, HEAD: 1, OPTIONS: 1, TRACE: 1 };
  var origFetch = window.fetch.bind(window);

  function sameOrigin(url) {
    try {
      return new URL(url, window.location.href).origin === window.location.origin;
    } catch (e) {
      return false;
    }
  }

  window.fetch = function (input, init) {
    init = init || {};
    var isRequest = typeof Request !== 'undefined' && input instanceof Request;
    var method = (init.method || (isRequest ? input.method : 'GET') || 'GET').toUpperCase();
    var url = isRequest ? input.url : String(input);
    if (SAFE[method] || !sameOrigin(url)) {
      return origFetch(input, init);
    }
    var headers = new Headers(init.headers || (isRequest ? input.headers : undefined));
    if (!headers.has('X-CSRFToken')) headers.set('X-CSRFToken', token);
    var next = {};
    for (var k in init) {
      if (Object.prototype.hasOwnProperty.call(init, k)) next[k] = init[k];
    }
    next.headers = headers;
    return origFetch(input, next);
  };
  window.CSRF_TOKEN = token;
})();
