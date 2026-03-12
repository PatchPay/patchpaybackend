import Quote from '../models/Quote.js';

// Create a new quote
exports.createQuote = async (req, res) => {
  try {
    const quote = new Quote(req.body);
    await quote.save();
    res.status(201).json(quote);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all quotes
exports.getAllQuotes = async (req, res) => {
  try {
    const quotes = await Quote.find().populate('amount').populate('total').populate('user').populate('destinatary_user');
    res.status(200).json(quotes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get a single quote by ID
exports.getQuoteById = async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.id).populate('amount').populate('total').populate('user').populate('destinatary_user');
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
    const quote = await Quote.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!quote) {
      return res.status(404).json({ message: 'Quote not found' });
    }
    res.status(200).json(quote);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
