import Amount from '../models/amount.js';

// Create a new amount
exports.createAmount = async (req, res) => {
  try {
    const amount = new Amount(req.body);
    await amount.save();
    res.status(201).json(amount);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all amounts
exports.getAllAmounts = async (req, res) => {
  try {
    const amounts = await Amount.find();
    res.status(200).json(amounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get a single amount by ID
exports.getAmountById = async (req, res) => {
  try {
    const amount = await Amount.findById(req.params.id);
    if (!amount) {
      return res.status(404).json({ message: 'Amount not found' });
    }
    res.status(200).json(amount);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update an amount by ID
exports.updateAmount = async (req, res) => {
  try {
    const amount = await Amount.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!amount) {
      return res.status(404).json({ message: 'Amount not found' });
    }
    res.status(200).json(amount);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
