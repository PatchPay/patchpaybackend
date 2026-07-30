const QuoteStatus = require('../models/Bkquotes');
const Quote = require('../models/Quote');

// Create a new QuoteStatus
exports.createQuoteStatus = async (req, res) => {
  try {
    const quoteStatus = await QuoteStatus.create(req.body);
    res.status(201).json(quoteStatus);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all QuoteStatus entries
exports.getAllQuoteStatuses = async (req, res) => {
  try {
    const quoteStatuses = await QuoteStatus.findAll({ include: [Quote] });
    res.status(200).json(quoteStatuses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get a single QuoteStatus by ID
exports.getQuoteStatusById = async (req, res) => {
  try {
    const quoteStatus = await QuoteStatus.findByPk(req.params.id, { include: [Quote] });
    if (!quoteStatus) {
      return res.status(404).json({ message: 'QuoteStatus not found' });
    }
    res.status(200).json(quoteStatus);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update QuoteStatus by ID
exports.updateQuoteStatus = async (req, res) => {
  try {
    const quoteStatus = await QuoteStatus.findByPk(req.params.id);
    if (quoteStatus) await quoteStatus.update(req.body);
    if (!quoteStatus) {
      return res.status(404).json({ message: 'QuoteStatus not found' });
    }
    res.status(200).json(quoteStatus);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
