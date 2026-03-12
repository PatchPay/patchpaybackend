const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const { searchUser, createRFQ, sendInvitation, getQuotes, cancelQuote, acceptQuote, rejectQuote, getQuoteById } = require('../controllers/rfqController');

// Search for users
router.get('/users/search', authenticateToken, searchUser);

// Create a new RFQ
router.post('/create', authenticateToken, createRFQ);

// Send invitation
router.post('/invite', authenticateToken, sendInvitation);

// Get quotes for the authenticated user
router.get('/quotes', authenticateToken, getQuotes);

// Get a single quote by ID
router.get('/quotes/:quoteId', authenticateToken, getQuoteById);

// Cancel a quote
router.put('/quotes/:quoteId/cancel', authenticateToken, cancelQuote);

// Accept quote
router.put('/quotes/:quoteId/accept', authenticateToken, acceptQuote);

// Reject quote
router.put('/quotes/:quoteId/reject', authenticateToken, rejectQuote);

module.exports = router; 