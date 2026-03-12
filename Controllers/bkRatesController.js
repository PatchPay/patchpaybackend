import BkRates from '../models/bkrates'; 

// Create a new BkRate entry
exports.createBkRate = async (req, res) => {
  const { code_transfer, amount, currency } = req.body;

  try {
    // Create a new BkRates entry
    const newBkRate = new BkRates({
      code_transfer,
      amount,
      currency
    });

    // Save the new BkRates entry to the database
    await newBkRate.save();
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
    const bkRates = await BkRates.find().populate('amount');
    res.status(200).json(bkRates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get a single BkRate entry by ID
exports.getBkRateById = async (req, res) => {
  const { id } = req.params;

  try {
    // Find the BkRate by ID and populate the 'amount' field
    const bkRate = await BkRates.findById(id).populate('amount');
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
    const updatedBkRate = await BkRates.findByIdAndUpdate(id, {
      code_transfer,
      amount,
      currency
    }, { new: true });

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
    const deletedBkRate = await BkRates.findByIdAndDelete(id);
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
