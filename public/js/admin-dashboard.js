(() => {
  const api = window.TruConnectAPI;
  if (!document.querySelector('#admin-dashboard')) return;
  const status = document.querySelector('#admin-message');
  const pageSize = 20;
  const pages = { verification: 1, review: 1, report: 1, user: 1 };
  const button = (label, action, className = 'button button-small') => {
    const node = api.el('button', label, className);
    node.type = 'button';
    node.addEventListener('click', action);
    return node;
  };
  const cell = (row, value) => row.append(api.el('td', value));
  const clear = (id, colspan, message) => {
    const body = document.querySelector(`#${id}`);
    body.replaceChildren();
    const row = api.el('tr');
    const td = api.el('td', message);
    td.colSpan = colspan;
    row.append(td);
    body.append(row);
    return body;
  };
  const pagedEndpoint = (path, pageKey, statusFilter) => {
    const query = new URLSearchParams({ page: String(pages[pageKey]), limit: String(pageSize) });
    if (statusFilter && statusFilter !== 'all') query.set('status', statusFilter);
    return `${path}?${query.toString()}`;
  };
  function renderPagination(id, pageKey, meta, loadPage) {
    const container = document.querySelector(`#${id}`);
    container.replaceChildren();
    const first = meta.total ? (meta.page - 1) * meta.limit + 1 : 0;
    const last = Math.min(meta.page * meta.limit, meta.total);
    container.append(api.el('span', `Showing ${first}–${last} of ${meta.total}`));
    const previous = button('Previous', () => {
      pages[pageKey] -= 1;
      loadPage().catch((error) => api.message(status, error.message, true));
    }, 'button button-small button-outline');
    previous.disabled = meta.page <= 1;
    const next = button('Next', () => {
      pages[pageKey] += 1;
      loadPage().catch((error) => api.message(status, error.message, true));
    }, 'button button-small button-outline');
    next.disabled = meta.page * meta.limit >= meta.total;
    container.append(previous, next);
  }
  async function change(path, payload, successText) {
    try {
      await api.request(path, { method: 'PATCH', body: JSON.stringify(payload), csrf: true });
      api.message(status, successText);
      await refresh();
    } catch (error) {
      api.message(status, error.message, true);
    }
  }

  async function loadMetrics() {
    const { data } = await api.request('/api/v1/admin/metrics');
    const values = {
      'admin-users-count': data.users,
      'admin-workers-count': data.workers,
      'admin-verified-count': data.verifiedWorkers,
      'admin-pending-count': data.pendingVerifications,
      'admin-rejected-count': data.rejectedVerifications,
      'admin-reports-count': data.openReports,
    };
    Object.entries(values).forEach(([id, value]) => {
      const node = document.getElementById(id);
      if (node) node.textContent = String(value);
    });
  }

  async function loadVerifications() {
    const statusFilter = document.querySelector('#verification-status-filter').value;
    const { data, meta } = await api.request(pagedEndpoint('/api/v1/admin/verification-requests', 'verification', statusFilter));
    const emptyMessage = statusFilter === 'all' ? 'No verification requests yet.' : `No ${statusFilter} applications.`;
    const body = clear('verification-rows', 6, data.length ? '' : emptyMessage);
    renderPagination('verification-pagination', 'verification', meta, loadVerifications);
    if (!data.length) return;
    body.replaceChildren();
    data.forEach((request) => {
      const row = api.el('tr');
      cell(row, request.worker?.user?.fullName || 'Worker account');
      cell(row, request.worker?.user?.email || '');
      cell(row, new Date(request.createdAt).toLocaleDateString());
      cell(row, request.evidenceSummary || 'No summary provided');
      const docs = api.el('td');
      (request.documents || []).forEach((file, index) => {
        const link = api.el('a', `Document ${index + 1}`);
        link.href = file.downloadUrl;
        link.className = 'text-link';
        link.target = '_blank';
        link.rel = 'noopener';
        docs.append(link, globalThis.document.createTextNode(' '));
      });
      if (!request.documents?.length) docs.textContent = 'No documents';
      row.append(docs);
      const decision = api.el('td', undefined, 'action-cell');
      if (request.status === 'pending') {
        decision.append(button('Approve', () => change(`/api/v1/admin/verification-requests/${request._id}`, { status: 'approved' }, 'Verification approved.'), 'button button-small'));
        decision.append(button('Reject', () => {
          const reviewNote = window.prompt('Add a short reason for the decision (optional):') || '';
          change(`/api/v1/admin/verification-requests/${request._id}`, { status: 'rejected', reviewNote }, 'Verification rejected.');
        }, 'button button-small button-outline'));
      } else {
        decision.append(api.el('strong', request.status));
        if (request.reviewNote) decision.append(api.el('small', `Note: ${request.reviewNote}`));
        if (request.reviewedAt) decision.append(api.el('small', `Reviewed ${new Date(request.reviewedAt).toLocaleDateString()}`));
      }
      row.append(decision);
      body.append(row);
    });
  }

  async function loadReviews() {
    const statusFilter = document.querySelector('#review-status-filter').value;
    const { data, meta } = await api.request(pagedEndpoint('/api/v1/admin/reviews', 'review', statusFilter));
    const emptyMessage = statusFilter === 'all' ? 'No reviews yet.' : `No ${statusFilter} reviews.`;
    const body = clear('review-rows', 5, data.length ? '' : emptyMessage);
    renderPagination('review-pagination', 'review', meta, loadReviews);
    if (!data.length) return;
    body.replaceChildren();
    data.forEach((review) => {
      const row = api.el('tr');
      cell(row, review.customer?.fullName || 'Customer');
      cell(row, review.worker?.user?.fullName || 'Worker');
      cell(row, `${review.rating} / 5`);
      cell(row, review.body);
      const decision = api.el('td', undefined, 'action-cell');
      if (review.moderationStatus === 'pending') {
        ['approved', 'rejected', 'hidden'].forEach((nextStatus) => decision.append(button(nextStatus, () => change(`/api/v1/admin/reviews/${review._id}`, { moderationStatus: nextStatus }, `Review ${nextStatus}.`), 'button button-small button-outline')));
      } else {
        decision.append(api.el('strong', review.moderationStatus));
        if (review.moderatedAt) decision.append(api.el('small', `Reviewed ${new Date(review.moderatedAt).toLocaleDateString()}`));
      }
      row.append(decision);
      body.append(row);
    });
  }

  async function loadReports() {
    const statusFilter = document.querySelector('#report-status-filter').value;
    const { data, meta } = await api.request(pagedEndpoint('/api/v1/admin/reports', 'report', statusFilter));
    const emptyMessage = statusFilter === 'all' ? 'No reports yet.' : `No ${statusFilter} reports.`;
    const body = clear('report-rows', 6, data.length ? '' : emptyMessage);
    renderPagination('report-pagination', 'report', meta, loadReports);
    if (!data.length) return;
    body.replaceChildren();
    data.forEach((report) => {
      const row = api.el('tr');
      cell(row, report.targetUser?.fullName || 'Account');
      cell(row, report.reason);
      const details = api.el('td');
      details.append(api.el('p', report.details));
      if (report.resolutionNote) details.append(api.el('small', `Resolution: ${report.resolutionNote}`));
      row.append(details);
      cell(row, report.reporter?.fullName || 'Customer');
      cell(row, report.status);
      const actions = api.el('td', undefined, 'action-cell');
      if (['open', 'reviewing'].includes(report.status)) {
        if (report.status === 'open') {
          actions.append(button('Review', () => change(`/api/v1/admin/reports/${report._id}`, { status: 'reviewing' }, 'Report marked as reviewing.'), 'button button-small button-outline'));
        }
        actions.append(button('Resolve', () => {
          const resolutionNote = window.prompt('Add a resolution note (optional):') || '';
          change(`/api/v1/admin/reports/${report._id}`, { status: 'resolved', resolutionNote }, 'Report resolved.');
        }, 'button button-small'));
        actions.append(button('Dismiss', () => change(`/api/v1/admin/reports/${report._id}`, { status: 'dismissed' }, 'Report dismissed.'), 'button button-small button-outline'));
      } else {
        actions.append(api.el('span', 'Closed'));
      }
      row.append(actions);
      body.append(row);
    });
  }

  async function loadUsers() {
    const { data, meta } = await api.request(pagedEndpoint('/api/v1/admin/users', 'user'));
    const body = clear('user-rows', 5, data.length ? '' : 'No accounts yet.');
    renderPagination('user-pagination', 'user', meta, loadUsers);
    if (!data.length) return;
    body.replaceChildren();
    data.forEach((user) => {
      const row = api.el('tr');
      cell(row, user.fullName);
      cell(row, user.email);
      cell(row, user.role);
      cell(row, user.accountStatus);
      const actions = api.el('td', undefined, 'action-cell');
      const nextStatus = user.accountStatus === 'active' ? 'suspended' : 'active';
      actions.append(button(nextStatus === 'active' ? 'Reactivate' : 'Suspend', () => change(`/api/v1/admin/users/${user._id}/status`, { accountStatus: nextStatus }, `Account ${nextStatus}.`), 'button button-small button-outline'));
      row.append(actions);
      body.append(row);
    });
  }

  async function loadCategories() {
    const { data } = await api.request('/api/v1/admin/categories');
    const body = clear('category-rows', 3, data.length ? '' : 'No service categories.');
    if (!data.length) return;
    body.replaceChildren();
    data.forEach((category) => {
      const row = api.el('tr');
      cell(row, category.name);
      cell(row, category.slug);
      const actions = api.el('td', undefined, 'action-cell');
      actions.append(api.el('span', category.isActive ? 'Active' : 'Inactive'));
      actions.append(button(category.isActive ? 'Deactivate' : 'Activate', () => change(`/api/v1/admin/categories/${category._id}`, { isActive: !category.isActive }, 'Category updated.'), 'button button-small button-outline'));
      row.append(actions);
      body.append(row);
    });
  }

  async function loadActivity() {
    const { data } = await api.request('/api/v1/admin/activity');
    const list = document.querySelector('#activity-list');
    list.replaceChildren();
    if (!data.length) list.append(api.el('li', 'No recent activity yet.'));
    data.forEach((item) => list.append(api.el('li', `${item.kind}: ${item.subject} · ${item.status} · ${new Date(item.createdAt).toLocaleString()}`)));
  }

  async function refresh() {
    try {
      await Promise.all([loadMetrics(), loadVerifications(), loadReviews(), loadReports(), loadUsers(), loadCategories(), loadActivity()]);
      status.hidden = true;
    } catch (error) {
      api.message(status, error.message || 'Could not load admin data.', true);
    }
  }

  document.querySelector('#category-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const name = form.elements.name.value.trim();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    try {
      await api.request('/api/v1/admin/categories', { method: 'POST', body: JSON.stringify({ name, slug, description: form.elements.description.value }), csrf: true });
      form.reset();
      api.message(status, 'Service category added.');
      await refresh();
    } catch (error) {
      api.message(status, error.message, true);
    }
  });

  document.querySelector('#refresh-admin').addEventListener('click', refresh);
  document.querySelector('#verification-status-filter').addEventListener('change', () => {
    pages.verification = 1;
    loadVerifications().catch((error) => api.message(status, error.message || 'Could not load verification requests.', true));
  });
  document.querySelector('#review-status-filter').addEventListener('change', () => {
    pages.review = 1;
    loadReviews().catch((error) => api.message(status, error.message || 'Could not load reviews.', true));
  });
  document.querySelector('#report-status-filter').addEventListener('change', () => {
    pages.report = 1;
    loadReports().catch((error) => api.message(status, error.message || 'Could not load reports.', true));
  });
  refresh();
  window.addEventListener('hashchange', refresh);
})();
