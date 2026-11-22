(() => {
  const api = window.TruConnectAPI;
  const form = document.querySelector('#worker-profile-form');
  if (!form) return;

  const status = document.querySelector('#worker-profile-message');
  const photoForm = document.querySelector('#profile-image-form');
  const photoMessage = document.querySelector('#profile-image-message');
  const verificationForm = document.querySelector('#verification-form');
  const verificationMessage = document.querySelector('#verification-message');
  const verificationState = document.querySelector('#worker-verification-state');
  let profileId = '';

  const setValue = (name, value) => {
    if (form.elements[name]) form.elements[name].value = value ?? '';
  };

  async function loadProfile() {
    const [{ data: profile }, { data: categories }, { data: auth }] = await Promise.all([
      api.request('/api/v1/workers/me'),
      api.request('/api/v1/categories'),
      api.request('/api/v1/auth/me'),
    ]);
    profileId = profile._id;
    const name = document.querySelector('#dashboard-display-name');
    const greeting = document.querySelector('#dashboard-greeting');
    const initials = document.querySelector('#dashboard-initials');
    if (name) name.textContent = auth.user.fullName;
    if (greeting) greeting.textContent = `Welcome back, ${auth.user.fullName.split(/\s+/)[0]}`;
    if (initials) initials.textContent = auth.user.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

    const categorySelect = form.elements.categories;
    categorySelect.replaceChildren(...categories.map((category) => {
      const option = api.el('option', category.name);
      option.value = category._id;
      option.selected = profile.categories.some((item) => item._id === category._id);
      return option;
    }));
    setValue('skills', (profile.skills || []).join(', '));
    setValue('experienceYears', profile.experienceYears);
    setValue('description', profile.description);
    setValue('city', profile.location?.city);
    setValue('region', profile.location?.region);
    setValue('phone', profile.phone);
    setValue('whatsapp', profile.whatsapp);
    setValue('availability', profile.availability);
    verificationState.textContent = `Verification status: ${profile.verificationStatus}`;
    verificationState.dataset.status = profile.verificationStatus;
    document.querySelector('#worker-trade-label').textContent = profile.categories.map((item) => item.name).join(', ') || 'Add your service categories';
    document.querySelector('#public-profile-link').href = `/worker-profile.html?id=${encodeURIComponent(profileId)}`;
    const photoPreview = document.querySelector('#worker-photo-preview');
    if (profile.profileImagePath) {
      photoPreview.src = profile.profileImagePath;
      photoPreview.hidden = false;
    } else {
      photoPreview.removeAttribute('src');
      photoPreview.hidden = true;
    }
    const statusStat = document.querySelector('#worker-verification-stat');
    if (statusStat) statusStat.textContent = profile.verificationStatus;
    if (profile.verificationStatus === 'verified') {
      verificationForm.hidden = true;
      verificationMessage.hidden = false;
      verificationMessage.textContent = 'Your profile is verified.';
    } else {
      verificationForm.hidden = false;
      const note = document.querySelector('#verification-status-note');
      note.textContent = profile.verificationStatus === 'pending'
        ? 'Your application is being reviewed. You cannot submit another while it is pending.'
        : profile.verificationStatus === 'rejected'
          ? 'Your previous application was not approved. You can submit a new application with updated documents.'
          : 'Upload clear supporting documents. Only TruConnect administrators can access them.';
      if (profile.verificationStatus === 'pending') verificationForm.querySelector('button[type="submit"]').disabled = true;
      else verificationForm.querySelector('button[type="submit"]').disabled = false;
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    status.hidden = true;
    const selectedCategories = [...form.elements.categories.selectedOptions].map((option) => option.value);
    const payload = {
      categories: selectedCategories,
      skills: form.elements.skills.value.split(',').map((value) => value.trim()).filter(Boolean),
      experienceYears: Number(form.elements.experienceYears.value || 0),
      description: form.elements.description.value,
      location: { city: form.elements.city.value, region: form.elements.region.value },
      phone: form.elements.phone.value,
      whatsapp: form.elements.whatsapp.value,
      availability: form.elements.availability.value,
    };
    try {
      await api.request('/api/v1/workers/me', { method: 'PUT', body: JSON.stringify(payload), csrf: true });
      api.message(status, 'Your professional profile has been saved.');
      await loadProfile();
    } catch (error) {
      api.message(status, error.message, true);
    } finally {
      button.disabled = false;
    }
  });

  photoForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = photoForm.querySelector('button[type="submit"]');
    button.disabled = true;
    photoMessage.hidden = true;
    try {
      await api.request('/api/v1/workers/me/profile-image', { method: 'POST', body: new FormData(photoForm), csrf: true });
      api.message(photoMessage, 'Your profile picture was updated.');
      await loadProfile();
      photoForm.reset();
    } catch (error) {
      api.message(photoMessage, error.message, true);
    } finally {
      button.disabled = false;
    }
  });

  verificationForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = verificationForm.querySelector('button[type="submit"]');
    button.disabled = true;
    verificationMessage.hidden = true;
    try {
      const formData = new FormData(verificationForm);
      await api.request('/api/v1/workers/me/verification', { method: 'POST', body: formData, csrf: true });
      api.message(verificationMessage, 'Your verification documents were submitted securely for review.');
      verificationForm.reset();
      await loadProfile();
    } catch (error) {
      api.message(verificationMessage, error.message, true);
      button.disabled = false;
    }
  });

  loadProfile().catch((error) => {
    api.message(status, error.message || 'Could not load your profile.', true);
    if (error.status === 401 || error.status === 403) window.location.replace('/login.html');
  });
})();
