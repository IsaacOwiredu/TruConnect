(() => {
  const list = document.querySelector('#customer-review-list');
  if (!list) return;
  const api = window.TruConnectAPI;
  const status = document.querySelector('#customer-review-message');
  api.request('/api/v1/customer/reviews').then(({ data }) => {
    list.replaceChildren();
    if (!data.length) {
      api.message(status, 'You have not submitted any reviews yet. Browse professionals and leave a review after working with one.');
      return;
    }
    status.hidden = true;
    data.forEach((review) => {
      const card = api.el('article', undefined, 'review-card');
      const heading = api.el('div', undefined, 'review-card-heading');
      heading.append(api.el('strong', review.workerName));
      heading.append(api.el('span', `★ ${review.rating} / 5 · ${review.status}`, 'rating'));
      card.append(heading, api.el('p', review.body), api.el('small', new Date(review.createdAt).toLocaleDateString()));
      if (review.workerId) {
        const link = api.el('a', 'View professional');
        link.className = 'text-link';
        link.href = `/worker-profile.html?id=${encodeURIComponent(review.workerId)}`;
        card.append(link);
      }
      list.append(card);
    });
  }).catch((error) => api.message(status, error.message || 'Could not load your reviews.', true));
})();
