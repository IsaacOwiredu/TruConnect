const express = require('express');
const requireDatabase = require('../middleware/require-database');
const { getCategories } = require('../controllers/category.controller');

const router = express.Router();

router.get('/', requireDatabase, getCategories);

module.exports = router;
