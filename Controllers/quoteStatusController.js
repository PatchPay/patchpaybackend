import QuoteStatus from '../models/QuoteStatus';

// Create a new QuoteStatus
exports.createQuoteStatus = async (req, res) => {
  try {
    const quoteStatus = new QuoteStatus(req.body);
    await quoteStatus.save();
    res.status(201).json(quoteStatus);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all QuoteStatus entries
exports.getAllQuoteStatuses = async (req, res) => {
  try {
    const quoteStatuses = await QuoteStatus.find().populate('quote');
    res.status(200).json(quoteStatuses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get a single QuoteStatus by ID
exports.getQuoteStatusById = async (req, res) => {
  try {
    const quoteStatus = await QuoteStatus.findById(req.params.id).populate('quote');
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
    const quoteStatus = await QuoteStatus.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!quoteStatus) {
      return res.status(404).json({ message: 'QuoteStatus not found' });
    }
    res.status(200).json(quoteStatus);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
