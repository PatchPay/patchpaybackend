import Balance from '../models/balance.js';

// Create a new balance
exports.createBalance = async (req, res) => {
  try {
    const balance = new Balance(req.body);
    await balance.save();
    res.status(201).json(balance);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all balances
exports.getAllBalances = async (req, res) => {
  try {
    const balances = await Balance.find().populate('balance').populate('available_balance').populate('user');
    res.status(200).json(balances);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get a single balance by ID
exports.getBalanceById = async (req, res) => {
  try {
    const balance = await Balance.findById(req.params.id).populate('balance').populate('available_balance').populate('user');
    if (!balance) {
      return res.status(404).json({ message: 'Balance not found' });
    }
    res.status(200).json(balance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update a balance by ID
exports.updateBalance = async (req, res) => {
  try {
    const balance = await Balance.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!balance) {
      return res.status(404).json({ message: 'Balance not found' });
    }
    res.status(200).json(balance);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
