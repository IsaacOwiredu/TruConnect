const menuButton = document.querySelector('.menu-toggle');
const siteNavigation = document.querySelector('.main-nav');
const dashboardSidebar = document.querySelector('.dash-sidebar');

menuButton?.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  if (siteNavigation) siteNavigation.classList.toggle('open', open);
  if (dashboardSidebar) dashboardSidebar.classList.toggle('open', open);
});

document.querySelectorAll('.password-toggle').forEach((toggle) => {
  toggle.addEventListener('click', () => {
    const input = toggle.parentElement.querySelector('input');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    toggle.textContent = show ? 'Hide' : 'Show';
    toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });
});

const filterForm = document.querySelector('#worker-filters');
if (filterForm) {
  const params = new URLSearchParams(window.location.search);
  for (const field of ['q', 'location', 'category', 'minRating']) {
    if (params.has(field) && filterForm.elements[field]) {
      filterForm.elements[field].value = params.get(field);
    }
  }
  let currentPage = 1;
  const workerGrid = document.querySelector('#worker-grid');
  const resultsMessage = document.querySelector('#results-message');
  const emptyState = document.querySelector('#empty-state');
  const resultCount = document.querySelector('#result-count');
  const pageStatus = document.querySelector('#page-status');
  const previousButton = document.querySelector('#previous-page');
  const nextButton = document.querySelector('#next-page');
  const pageSize = 12;
  const photoClasses = ['photo-one', 'photo-two', 'photo-three', 'photo-four', 'photo-five', 'photo-six'];

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  function renderWorker(worker, index) {
    const profileUrl = `/worker-profile.html?id=${encodeURIComponent(worker._id)}`;
    const card = element('article', 'worker-card');
    const photo = element('a', `worker-photo ${photoClasses[index % photoClasses.length]}`);
    photo.href = profileUrl;
    photo.setAttribute('aria-label', `View ${worker.fullName}'s profile`);
    const initials = worker.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('');
    photo.append(element('span', '', initials));
    const available = element('span', 'available-pill');
    const dot = element('i');
    available.append(dot, document.createTextNode(worker.availability === 'available' ? ' Available' : ' Unavailable'));
    photo.append(available);
    card.append(photo);

    const info = element('div', 'worker-info');
    const title = element('div', 'worker-title');
    const heading = element('h2');
    const nameLink = element('a', '', worker.fullName);
    nameLink.href = profileUrl;
    heading.append(nameLink);
    title.append(heading);
    if (worker.verificationStatus === 'verified') title.append(element('span', 'verified-badge', '✓'));
    info.append(title);

    const firstCategory = worker.categories?.[0]?.name || 'Service professional';
    const city = worker.location?.city || 'Ghana';
    const trade = element('p', 'worker-trade', `${firstCategory} · ${city}`);
    info.append(trade);
    const rating = element('p', 'rating');
    rating.append(element('span', '', '★'), document.createTextNode(` ${worker.averageRating ? worker.averageRating.toFixed(1) : 'New'} `));
    rating.append(element('small', '', `(${worker.reviewCount} ${worker.reviewCount === 1 ? 'review' : 'reviews'})`));
    info.append(rating);

    const bottom = element('div', 'card-bottom');
    bottom.append(element('span', '', (worker.skills || []).slice(0, 2).join(' · ') || 'View skills and experience'));
    const viewLink = element('a', '', 'View profile');
    viewLink.href = profileUrl;
    viewLink.append(document.createTextNode(' '), element('b', '', '↗'));
    bottom.append(viewLink);
    info.append(bottom);
    card.append(info);
    return card;
  }

  async function loadCategories() {
    const select = filterForm.elements.category;
    try {
      const response = await fetch('/api/v1/categories');
      if (!response.ok) return;
      const { data } = await response.json();
      for (const category of data) {
        const option = document.createElement('option');
        option.value = category.slug;
        option.textContent = category.name;
        select.append(option);
      }
      const legacyCategory = params.get('category');
      if (legacyCategory && !select.value) {
        const matching = data.find((category) => category.name.toLowerCase() === legacyCategory.toLowerCase());
        if (matching) select.value = matching.slug;
      }
    } catch {
      // The results request below will show the database connection state.
    }
  }

  async function loadWorkers() {
    const searchParams = new URLSearchParams({ page: String(currentPage), limit: String(pageSize), sort: document.querySelector('#sort-workers').value });
    const fields = {
      q: filterForm.elements.q.value.trim(),
      location: filterForm.elements.location.value,
      category: filterForm.elements.category.value,
      minRating: filterForm.elements.minRating.value,
    };
    for (const [key, value] of Object.entries(fields)) if (value) searchParams.set(key, value);
    if (filterForm.elements.verified.checked) searchParams.set('verified', 'true');
    resultsMessage.hidden = false;
    resultsMessage.textContent = 'Loading professionals…';
    emptyState.hidden = true;
    workerGrid.replaceChildren();
    try {
      const response = await fetch(`/api/v1/workers?${searchParams}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || 'Could not load professionals.');
      resultCount.textContent = String(result.meta.total);
      resultsMessage.hidden = true;
      const fragment = document.createDocumentFragment();
      result.data.forEach((worker, index) => fragment.append(renderWorker(worker, index)));
      workerGrid.append(fragment);
      emptyState.hidden = result.data.length !== 0;
      pageStatus.textContent = `Page ${currentPage}`;
      previousButton.disabled = currentPage <= 1;
      nextButton.disabled = currentPage * pageSize >= result.meta.total;
    } catch (error) {
      resultsMessage.textContent = error.message;
      resultCount.textContent = '0';
      previousButton.disabled = true;
      nextButton.disabled = true;
    }
  }

  filterForm.addEventListener('submit', (event) => {
    event.preventDefault();
    currentPage = 1;
    loadWorkers();
  });
  filterForm.querySelectorAll('select,input[type="checkbox"]').forEach((field) => field.addEventListener('change', () => { currentPage = 1; loadWorkers(); }));
  document.querySelector('#sort-workers').addEventListener('change', () => { currentPage = 1; loadWorkers(); });
  previousButton.addEventListener('click', () => { currentPage -= 1; loadWorkers(); });
  nextButton.addEventListener('click', () => { currentPage += 1; loadWorkers(); });
  loadCategories().then(loadWorkers);
}

const registrationForm = document.querySelector('.auth-card .local-form');
if (registrationForm && window.location.pathname.endsWith('/register.html')) {
  const roleOptions = registrationForm.querySelectorAll('input[name="role"]');
  const locationField = registrationForm.elements.location;
  const updateLocationRequirement = () => {
    locationField.required = registrationForm.elements.role.value === 'worker';
  };
  roleOptions.forEach((option) => option.addEventListener('change', updateLocationRequirement));

  const requestedRole = new URLSearchParams(window.location.search).get('role');
  if (requestedRole === 'worker') {
    const workerOption = registrationForm.querySelector('input[name="role"][value="worker"]');
    if (workerOption) workerOption.checked = true;
  }
  updateLocationRequirement();
}

document.querySelectorAll('.local-form').forEach((form) => {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = form.querySelector('.form-message');
    const submitButton = form.querySelector('[type="submit"]');
    const isRegistration = window.location.pathname.endsWith('/register.html');
    const values = new FormData(form);
    const payload = isRegistration
      ? {
        fullName: values.get('fullName'),
        email: values.get('email'),
        password: values.get('password'),
        role: values.get('role'),
        location: values.get('location'),
      }
      : { email: values.get('email'), password: values.get('password') };

    const showMessage = (text) => {
      if (!message) return;
      message.textContent = text;
      message.hidden = false;
    };

    if (message) message.hidden = true;
    if (submitButton) submitButton.disabled = true;
    try {
      const csrfResponse = await fetch('/api/v1/auth/csrf', { credentials: 'same-origin' });
      const csrfResult = await csrfResponse.json();
      if (!csrfResponse.ok) throw new Error(csrfResult.error?.message || 'Account services are unavailable.');

      const response = await fetch(`/api/v1/auth/${isRegistration ? 'register' : 'login'}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfResult.data.csrfToken,
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || 'We could not sign you in. Please try again.');

      const destinations = {
        customer: '/dashboard-customer.html',
        worker: '/dashboard-worker.html',
        admin: '/dashboard-admin.html',
      };
      window.location.assign(destinations[result.data.user.role] || '/');
    } catch (error) {
      showMessage(error.message || 'Could not reach the account service. Please try again.');
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
});

document.querySelectorAll('[data-logout]').forEach((link) => {
  link.addEventListener('click', async (event) => {
    event.preventDefault();
    try {
      const csrfResponse = await fetch('/api/v1/auth/csrf', { credentials: 'same-origin' });
      const csrfResult = await csrfResponse.json();
      if (!csrfResponse.ok) throw new Error(csrfResult.error?.message || 'Could not end your session.');
      const response = await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'X-CSRF-Token': csrfResult.data.csrfToken },
      });
      if (!response.ok) throw new Error('Could not end your session. Please try again.');
      window.location.assign('/login.html');
    } catch (error) {
      window.alert(error.message);
    }
  });
});

if (document.querySelector('.dashboard-body')) {
  fetch('/api/v1/auth/me', { credentials: 'same-origin' })
    .then(async (response) => {
      if (!response.ok) throw new Error('Session expired. Please log in again.');
      return response.json();
    })
    .then(({ data }) => {
      const user = data.user;
      const displayName = document.querySelector('#dashboard-display-name');
      const greeting = document.querySelector('#dashboard-greeting');
      const initials = document.querySelector('#dashboard-initials');
      if (displayName) displayName.textContent = user.fullName;
      if (greeting) greeting.textContent = `Welcome back, ${user.fullName.split(' ')[0]}`;
      if (initials) {
        initials.textContent = user.fullName
          .split(/\s+/)
          .slice(0, 2)
          .map((part) => part.charAt(0).toUpperCase())
          .join('');
      }
    })
    .catch(() => window.location.replace('/login.html'));
}

document.querySelectorAll('[data-demo-message]').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    window.alert(link.dataset.demoMessage);
  });
});
