(function attachTruConnectApi() {
  async function parseResponse(response) {
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(result.error?.message || 'The request could not be completed.');
      error.status = response.status;
      throw error;
    }
    return result;
  }

  async function csrfToken() {
    const result = await parseResponse(await fetch('/api/v1/auth/csrf', { credentials: 'same-origin' }));
    return result.data.csrfToken;
  }

  async function request(url, options = {}) {
    const headers = new Headers(options.headers || {});
    const isForm = options.body instanceof FormData;
    if (options.body && !isForm && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    if (options.csrf) headers.set('X-CSRF-Token', await csrfToken());
    const { csrf, ...fetchOptions } = options;
    return parseResponse(await fetch(url, { ...fetchOptions, headers, credentials: 'same-origin' }));
  }

  function message(node, text, isError = false) {
    if (!node) return;
    node.textContent = text;
    node.hidden = false;
    node.classList.toggle('is-error', isError);
    node.classList.toggle('is-success', !isError);
  }

  function el(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined && text !== null) node.textContent = String(text);
    if (className) node.className = className;
    return node;
  }

  window.TruConnectAPI = { el, message, request };
}());
