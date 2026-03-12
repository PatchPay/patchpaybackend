import BkCommissions from '../models/Bkcommissions';

// Create a new BkCommission
exports.createBkCommission = async (req, res) => {
  try {
    const bkCommission = new BkCommissions(req.body);
    await bkCommission.save();
    res.status(201).json(bkCommission);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all BkCommissions
exports.getAllBkCommissions = async (req, res) => {
  try {
    const bkCommissions = await BkCommissions.find().populate('amount');
    res.status(200).json(bkCommissions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get a single BkCommission by ID
exports.getBkCommissionById = async (req, res) => {
  try {
    const bkCommission = await BkCommissions.findById(req.params.id).populate('amount');
    if (!bkCommission) {
      return res.status(404).json({ message: 'BkCommission not found' });
    }
    res.status(200).json(bkCommission);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update a BkCommission by ID
exports.updateBkCommission = async (req, res) => {
  try {
    const bkCommission = await BkCommissions.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!bkCommission) {
      return res.status(404).json({ message: 'BkCommission not found' });
    }
    res.status(200).json(bkCommission);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
