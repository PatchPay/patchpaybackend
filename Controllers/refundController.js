import Refund from '../models/refund.js';

// Create a refund request
exports.createRefund = async (req, res) => {
  const { payment, amount, reason } = req.body;

  try {
    const newRefund = new Refund({
      payment,
      amount,
      reason,
      status: 'Requested'
    });

    await newRefund.save();
    res.status(201).json({
      message: 'Refund requested successfully',
      newRefund
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all refund requests
exports.getAllRefunds = async (req, res) => {
  try {
    const refunds = await Refund.find().populate('payment').populate('amount');
    res.status(200).json(refunds);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get refund by ID
exports.getRefundById = async (req, res) => {
  try {
    const refund = await Refund.findById(req.params.id).populate('payment').populate('amount');
    if (!refund) {
      return res.status(404).json({ message: 'Refund not found' });
    }
    res.status(200).json(refund);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update refund status by ID
exports.updateRefundStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const refund = await Refund.findByIdAndUpdate(id, { status }, { new: true });
    if (!refund) {
      return res.status(404).json({ message: 'Refund not found' });
    }
    res.status(200).json({
      message: 'Refund status updated successfully',
      refund
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
