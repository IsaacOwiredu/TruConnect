const asyncHandler = require('../middleware/async-handler');
const { listActiveCategories } = require('../services/category.service');

const getCategories = asyncHandler(async (req, res) => {
  const categories = await listActiveCategories();
  res.json({ data: categories });
});

module.exports = { getCategories };
