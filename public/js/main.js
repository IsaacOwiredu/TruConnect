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
  for (const field of ['q', 'location', 'category']) {
    if (params.has(field) && filterForm.elements[field]) {
      filterForm.elements[field].value = params.get(field);
    }
  }

  const runFilters = () => {
    const query = filterForm.elements.q.value.trim().toLowerCase();
    const location = filterForm.elements.location.value;
    const category = filterForm.elements.category.value;
    const verified = filterForm.elements.verified.checked;
    let count = 0;

    document.querySelectorAll('.worker-card').forEach((card) => {
      const text = `${card.dataset.name} ${card.dataset.skills}`;
      const matches = (!query || text.includes(query))
        && (!location || card.dataset.location === location)
        && (!category || card.dataset.category === category)
        && (!verified || card.dataset.verified === 'true');
      card.hidden = !matches;
      if (matches) count += 1;
    });

    document.querySelector('#result-count').textContent = String(count);
    document.querySelector('#empty-state').hidden = count !== 0;
  };

  filterForm.addEventListener('submit', (event) => {
    event.preventDefault();
    runFilters();
  });
  filterForm.querySelectorAll('select,input').forEach((field) => {
    field.addEventListener('change', runFilters);
  });
  runFilters();
}

const registrationForm = document.querySelector('.auth-card .local-form');
if (registrationForm && window.location.pathname.endsWith('/register.html')) {
  const requestedRole = new URLSearchParams(window.location.search).get('role');
  if (requestedRole === 'worker') {
    const workerOption = registrationForm.querySelector('input[name="role"][value="worker"]');
    if (workerOption) workerOption.checked = true;
  }
}

document.querySelectorAll('.local-form').forEach((form) => {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const message = form.querySelector('.form-message');
    if (message) {
      message.textContent = 'This form is a preview and is not connected to account services yet.';
      message.hidden = false;
    }
  });
});

document.querySelectorAll('[data-demo-message]').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    window.alert(link.dataset.demoMessage);
  });
});
