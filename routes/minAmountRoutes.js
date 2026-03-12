const { Router } = require('express');
const minAmountsController = require('../Controllers/minAmountsController');

const router = Router();

// Route to create a new MinAmount
router.post('/minamounts', minAmountsController.createMinAmount);

// Route to get all MinAmounts
router.get('/minamounts', minAmountsController.getAllMinAmounts);

// Route to get a single MinAmount by ID
router.get('/minamounts/:id', minAmountsController.getMinAmountById);

// Route to update a MinAmount by ID
router.put('/minamounts/:id', minAmountsController.updateMinAmount);

// Route to delete a MinAmount by ID
router.delete('/minamounts/:id', minAmountsController.deleteMinAmount);

module.exports = router;  
