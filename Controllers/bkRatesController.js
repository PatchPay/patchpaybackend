const BkRates = require('../models/Bkrates');
const Amount = require('../models/Amount');

// Create a new BkRate entry
exports.createBkRate = async (req, res) => {
  const { code_transfer, amount, currency } = req.body;

  try {
    // Create a new BkRates entry
    const newBkRate = await BkRates.create({
      code_transfer,
      amount,
      currency
    });

    // Save the new BkRates entry to the database
    res.status(201).json({
      message: 'BkRate created successfully',
      newBkRate
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all BkRates entries
exports.getAllBkRates = async (req, res) => {
  try {
    // Retrieve all BkRates entries
    const bkRates = await BkRates.findAll({ include: [Amount] });
    res.status(200).json(bkRates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get a single BkRate entry by ID
exports.getBkRateById = async (req, res) => {
  const { id } = req.params;

  try {
    // Find the BkRate by ID with its related amount.
    const bkRate = await BkRates.findByPk(id, { include: [Amount] });
    if (!bkRate) {
      return res.status(404).json({ message: 'BkRate not found' });
    }
    res.status(200).json(bkRate);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update a BkRate entry by ID
exports.updateBkRate = async (req, res) => {
  const { id } = req.params;
  const { code_transfer, amount, currency } = req.body;

  try {
    // Update the BkRate entry by ID
    const updatedBkRate = await BkRates.findByPk(id);
    if (updatedBkRate) await updatedBkRate.update({
      code_transfer,
      amount,
      currency
    });

    if (!updatedBkRate) {
      return res.status(404).json({ message: 'BkRate not found' });
    }
    res.status(200).json({
      message: 'BkRate updated successfully',
      updatedBkRate
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete a BkRate entry by ID
exports.deleteBkRate = async (req, res) => {
  const { id } = req.params;

  try {
    // Delete the BkRate entry by ID
    const deletedBkRate = await BkRates.findByPk(id);
    if (deletedBkRate) await deletedBkRate.destroy();
    if (!deletedBkRate) {
      return res.status(404).json({ message: 'BkRate not found' });
    }
    res.status(200).json({
      message: 'BkRate deleted successfully',
      deletedBkRate
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
