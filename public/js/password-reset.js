(() => {
  const api = window.TruConnectAPI;
  const requestForm = document.querySelector('#password-reset-request-form');
  if (requestForm) {
    const message = document.querySelector('#password-reset-request-message');
    requestForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = requestForm.querySelector('button[type="submit"]');
      button.disabled = true;
      message.hidden = true;
      try {
        const email = requestForm.elements.email.value.trim();
        await api.request('/api/v1/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email }),
          csrf: true,
        });
        api.message(message, 'If an active account exists for that email, a reset link will be sent.');
        requestForm.reset();
      } catch (error) {
        api.message(message, error.message || 'Could not request a password reset.', true);
      } finally {
        button.disabled = false;
      }
    });
  }

  const resetForm = document.querySelector('#password-reset-form');
  if (!resetForm) return;
  const message = document.querySelector('#password-reset-message');
  const token = new URLSearchParams(window.location.search).get('token') || '';
  const button = resetForm.querySelector('button[type="submit"]');
  if (!token) {
    api.message(message, 'This reset link is missing its token. Request a new link.', true);
    button.disabled = true;
    return;
  }

  resetForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (resetForm.elements.password.value !== resetForm.elements.confirmPassword.value) {
      api.message(message, 'The passwords do not match.', true);
      return;
    }
    button.disabled = true;
    message.hidden = true;
    try {
      const password = resetForm.elements.password.value;
      const { data } = await api.request('/api/v1/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
        csrf: true,
      });
      api.message(message, data.message || 'Your password has been updated.');
      resetForm.reset();
    } catch (error) {
      api.message(message, error.message || 'Could not update your password.', true);
    } finally {
      button.disabled = false;
    }
  });
})();