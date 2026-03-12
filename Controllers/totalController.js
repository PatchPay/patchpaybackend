import Total from '../models/total'; // Assuming the Total model is located in '../models/total'

// Create a new total entry
exports.createTotal = async (req, res) => {
  const { value, currency } = req.body;

  try {
    // Create a new Total entry
    const newTotal = new Total({
      value,
      currency
    });

    // Save the new total entry to the database
    await newTotal.save();
    res.status(201).json({
      message: 'Total created successfully',
      newTotal
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all total entries
exports.getAllTotals = async (req, res) => {
  try {
    // Retrieve all total entries
    const totals = await Total.find();
    res.status(200).json(totals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get a single total entry by ID
exports.getTotalById = async (req, res) => {
  const { id } = req.params;

  try {
    // Find the Total entry by ID
    const total = await Total.findById(id);
    if (!total) {
      return res.status(404).json({ message: 'Total not found' });
    }
    res.status(200).json(total);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update a total entry by ID
exports.updateTotal = async (req, res) => {
  const { id } = req.params;
  const { value, currency } = req.body;

  try {
    // Update the total entry by ID
    const updatedTotal = await Total.findByIdAndUpdate(id, { value, currency }, { new: true });
    if (!updatedTotal) {
      return res.status(404).json({ message: 'Total not found' });
    }
    res.status(200).json({
      message: 'Total updated successfully',
      updatedTotal
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete a total entry by ID
exports.deleteTotal = async (req, res) => {
  const { id } = req.params;

  try {
    // Delete the total entry by ID
    const deletedTotal = await Total.findByIdAndDelete(id);
    if (!deletedTotal) {
      return res.status(404).json({ message: 'Total not found' });
    }
    res.status(200).json({
      message: 'Total deleted successfully',
      deletedTotal
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
