const BkCommissions = require('../models/Bkcommision');
const Amount = require('../models/Amount');

// Create a new BkCommission
exports.createBkCommission = async (req, res) => {
  try {
    const bkCommission = await BkCommissions.create(req.body);
    res.status(201).json(bkCommission);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all BkCommissions
exports.getAllBkCommissions = async (req, res) => {
  try {
    const bkCommissions = await BkCommissions.findAll({ include: [Amount] });
    res.status(200).json(bkCommissions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get a single BkCommission by ID
exports.getBkCommissionById = async (req, res) => {
  try {
    const bkCommission = await BkCommissions.findByPk(req.params.id, { include: [Amount] });
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
    const bkCommission = await BkCommissions.findByPk(req.params.id);
    if (bkCommission) await bkCommission.update(req.body);
    if (!bkCommission) {
      return res.status(404).json({ message: 'BkCommission not found' });
    }
    res.status(200).json(bkCommission);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
