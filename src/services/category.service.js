const { ServiceCategory } = require('../models');

function listActiveCategories() {
  return ServiceCategory.find({ isActive: true })
    .select('name slug description icon')
    .sort({ sortOrder: 1, name: 1 })
    .lean()
    .exec();
}

module.exports = { listActiveCategories };
