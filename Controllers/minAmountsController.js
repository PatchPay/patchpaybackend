const MinAmount = require('../models/MinAmount'); // Fixed model name to match file

// Create a new MinAmount entry
exports.createMinAmount = async (req, res) => {
  const { squad, stripe, currency } = req.body;

  try {
    // Create a new MinAmount entry
    const newMinAmount = new MinAmount({
      squad,
      stripe,
      currency
    });

    // Save the new MinAmount entry to the database
    await newMinAmount.save();
    res.status(201).json({
      message: 'MinAmount created successfully',
      newMinAmount
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all MinAmount entries
exports.getAllMinAmounts = async (req, res) => {
  try {
    // Retrieve all MinAmount entries
    const minAmounts = await MinAmount.find();
    res.status(200).json(minAmounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get a single MinAmount entry by ID
exports.getMinAmountById = async (req, res) => {
  const { id } = req.params;

  try {
    // Find the MinAmount entry by ID
    const minAmount = await MinAmount.findById(id);
    if (!minAmount) {
      return res.status(404).json({ message: 'MinAmount not found' });
    }
    res.status(200).json(minAmount);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update a MinAmount entry by ID
exports.updateMinAmount = async (req, res) => {
  const { id } = req.params;
  const { squad, stripe, currency } = req.body;

  try {
    // Update the MinAmount entry by ID
    const updatedMinAmount = await MinAmount.findByIdAndUpdate(id, {
      squad,
      stripe,
      currency
    }, { new: true });

    if (!updatedMinAmount) {
      return res.status(404).json({ message: 'MinAmount not found' });
    }
    res.status(200).json({
      message: 'MinAmount updated successfully',
      updatedMinAmount
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete a MinAmount entry by ID
exports.deleteMinAmount = async (req, res) => {
  const { id } = req.params;

  try {
    // Delete the MinAmount entry by ID
    const deletedMinAmount = await MinAmount.findByIdAndDelete(id);
    if (!deletedMinAmount) {
      return res.status(404).json({ message: 'MinAmount not found' });
    }
    res.status(200).json({
      message: 'MinAmount deleted successfully',
      deletedMinAmount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
