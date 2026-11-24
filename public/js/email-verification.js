(() => {
  const api = window.TruConnectAPI;
  const message = document.querySelector('#email-verification-message');
  const token = new URLSearchParams(window.location.search).get('token') || '';
  if (!token) {
    api.message(message, 'This confirmation link is missing its token. Create your account again to receive a new link.', true);
    return;
  }

  api.request('/api/v1/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
    csrf: true,
  }).then(({ data }) => {
    api.message(message, data.message || 'Your email address is confirmed. You can now log in.');
  }).catch((error) => {
    api.message(message, error.message || 'Could not confirm your email address.', true);
  });
})();
