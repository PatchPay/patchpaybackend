const express = require('express');
const totalController = require('../Controllers/totalController');
const router = express.Router();

// Route to create a new total
router.post('/totals', totalController.createTotal);

// Route to get all totals
router.get('/totals', totalController.getAllTotals);

// Route to get a single total by ID
router.get('/totals/:id', totalController.getTotalById);

// Route to update a total by ID
router.put('/totals/:id', totalController.updateTotal);

// Route to delete a total by ID
router.delete('/totals/:id', totalController.deleteTotal);

module.exports = router;
