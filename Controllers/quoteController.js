const Quote = require('../models/Quote');

// Create a new quote
exports.createQuote = async (req, res) => {
  try {
    const quote = await Quote.create(req.body);
    res.status(201).json(quote);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all quotes
exports.getAllQuotes = async (req, res) => {
  try {
    const quotes = await Quote.findAll();
    res.status(200).json(quotes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get a single quote by ID
exports.getQuoteById = async (req, res) => {
  try {
    const quote = await Quote.findByPk(req.params.id);
    if (!quote) {
      return res.status(404).json({ message: 'Quote not found' });
    }
    res.status(200).json(quote);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update a quote by ID
exports.updateQuote = async (req, res) => {
  try {
    const quote = await Quote.findByPk(req.params.id);
    if (quote) await quote.update(req.body);
    if (!quote) {
      return res.status(404).json({ message: 'Quote not found' });
    }
    res.status(200).json(quote);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
