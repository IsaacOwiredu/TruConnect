(() => {
  const api = window.TruConnectAPI;
  const content = document.querySelector('#profile-content');
  if (!content) return;
  const status = document.querySelector('#profile-message');
  const id = new URLSearchParams(window.location.search).get('id');
  const initials = (name) => name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('');

  function renderReviews(reviews) {
    const list = document.querySelector('#profile-reviews');
    list.replaceChildren();
    if (!reviews.length) {
      list.append(api.el('p', 'No approved reviews yet. Be the first customer to share your experience.'));
      return;
    }
    reviews.forEach((review) => {
      const card = api.el('article', undefined, 'review-card');
      const header = api.el('div', undefined, 'review-card-heading');
      header.append(api.el('strong', review.customer?.fullName || 'Customer'));
      header.append(api.el('span', `★ ${review.rating} / 5`, 'rating'));
      card.append(header, api.el('p', review.body), api.el('small', new Date(review.createdAt).toLocaleDateString()));
      list.append(card);
    });
  }

  async function load() {
    if (!id) throw new Error('This professional profile link is missing its ID. Return to search and choose a profile.');
    const [{ data: worker }, reviewsResult] = await Promise.all([
      api.request(`/api/v1/workers/${encodeURIComponent(id)}`),
      api.request(`/api/v1/workers/${encodeURIComponent(id)}/reviews`).catch(() => ({ data: [] })),
    ]);
    const name = worker.fullName || 'Professional';
    document.title = `${name} — TruConnect`;
    document.querySelector('#profile-name').textContent = name;
    document.querySelector('#profile-initials').textContent = initials(name);
    const profilePhoto = document.querySelector('#profile-photo');
    if (worker.profileImagePath) {
      profilePhoto.src = worker.profileImagePath;
      profilePhoto.alt = `${name}'s profile picture`;
      profilePhoto.hidden = false;
      document.querySelector('#profile-initials').hidden = true;
    } else {
      profilePhoto.removeAttribute('src');
      profilePhoto.hidden = true;
      document.querySelector('#profile-initials').hidden = false;
    }
    document.querySelector('#profile-trade').textContent = (worker.categories || []).map((category) => category.name).join(' · ') || 'Service professional';
    const verified = worker.verificationStatus === 'verified';
    document.querySelector('#profile-verification').textContent = verified ? '✓ Verified professional' : 'Professional profile';
    document.querySelector('#profile-verification-detail').textContent = verified ? 'Verified by TruConnect' : 'Not yet verified';
    document.querySelector('#profile-tagline').textContent = `Professional services in ${worker.location?.city || 'Ghana'}`;
    document.querySelector('#profile-description').textContent = worker.description || 'This professional has not added a service description yet.';
    document.querySelector('#profile-experience').textContent = worker.experienceYears ? `${worker.experienceYears} years of experience` : 'Experience details not provided';
    document.querySelector('#profile-years').textContent = worker.experienceYears ? `${worker.experienceYears} years` : 'Not provided';
    document.querySelector('#profile-location').textContent = [worker.location?.city, worker.location?.region].filter(Boolean).join(', ') || 'Ghana';
    document.querySelector('#profile-availability').textContent = worker.availability === 'available' ? 'Available for work' : 'Currently unavailable';
    const skills = document.querySelector('#profile-skills');
    skills.replaceChildren();
    (worker.skills || []).forEach((skill) => skills.append(api.el('span', skill, 'skill-tag')));
    if (!(worker.skills || []).length) skills.append(api.el('span', 'Skills not added yet', 'muted'));

    const average = Number(worker.averageRating || 0);
    const ratingText = `${average ? `★ ${average.toFixed(1)}` : 'No ratings yet'} (${worker.reviewCount || 0} ${(worker.reviewCount || 0) === 1 ? 'review' : 'reviews'})`;
    document.querySelector('#profile-rating').textContent = ratingText;
    document.querySelector('#profile-review-heading').textContent = average ? `★ ${average.toFixed(1)}` : '';
    renderReviews(reviewsResult.data || []);

    const phone = String(worker.phone || '').trim();
    const phoneLink = document.querySelector('#phone-contact');
    if (phone && /^[+0-9\s().-]{7,30}$/.test(phone)) {
      phoneLink.href = `tel:${phone.replace(/[^+0-9]/g, '')}`;
      phoneLink.hidden = false;
    }
    const whatsapp = String(worker.whatsapp || '').trim();
    const whatsappLink = document.querySelector('#wa-contact');
    if (whatsapp && /^[+0-9\s().-]{7,30}$/.test(whatsapp)) {
      let number = whatsapp.replace(/\D/g, '');
      if (number.startsWith('0')) number = `233${number.slice(1)}`;
      whatsappLink.href = `https://wa.me/${number}`;
      whatsappLink.hidden = false;
    }
    document.querySelector('#contact-status').textContent = phone || whatsapp ? '' : 'This professional has not shared contact details yet.';

    try {
      const { data } = await api.request('/api/v1/auth/me');
      if (data.user.role === 'customer') document.querySelector('#customer-actions').hidden = false;
    } catch {
      // Public profile browsing does not require an account.
    }
    content.hidden = false;
    status.hidden = true;
  }

  async function handleForm(form, endpoint, payload, messageNode, success) {
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    messageNode.hidden = true;
    try {
      const { data } = await api.request(endpoint, { method: 'POST', body: JSON.stringify(payload), csrf: true });
      api.message(messageNode, success(data));
      form.reset();
    } catch (error) {
      api.message(messageNode, error.message, true);
    } finally {
      button.disabled = false;
    }
  }

  document.querySelector('#review-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    handleForm(form, `/api/v1/workers/${encodeURIComponent(id)}/reviews`, {
      rating: Number(form.elements.rating.value), body: form.elements.body.value,
    }, document.querySelector('#review-message'), () => 'Thanks. Your review is waiting for moderation before it appears publicly.');
  });
  document.querySelector('#report-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    handleForm(form, `/api/v1/workers/${encodeURIComponent(id)}/reports`, {
      reason: form.elements.reason.value, details: form.elements.details.value,
    }, document.querySelector('#report-message'), () => 'Your report has been sent to the TruConnect team.');
  });
  load().catch((error) => api.message(status, error.message || 'Could not load this professional profile.', true));
})();
