const express = require('express');
const cardDetailsController = require('../Controllers/carddetailsController');
const router = express.Router();

// Route to create new card details
router.post('/card-details', cardDetailsController.createCardDetail);

// Route to get all card details
router.get('/card-details', cardDetailsController.getAllCardDetails);

// Route to get a single card detail by ID
router.get('/card-details/:id', cardDetailsController.getCardDetailById);

// Route to update card details by ID
router.put('/card-details/:id', cardDetailsController.updateCardDetail);

// Route to delete card details by ID
router.delete('/card-details/:id', cardDetailsController.deleteCardDetail);

module.exports = router;
