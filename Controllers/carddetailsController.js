import CardDetails from "../models/Carddetails"; // Assuming CardDetails model is located in '../models/carddetails'

// Create a new card detail entry
exports.createCardDetail = async (req, res) => {
  const { card_number, card_holder_name, expiry_date, cvv, billing_address } =
    req.body;

  try {
    // Create a new CardDetails entry
    const newCardDetail = new CardDetails({
      card_number,
      card_holder_name,
      expiry_date,
      cvv,
      billing_address,
    });

    // Save the new CardDetails entry to the database
    await newCardDetail.save();
    res.status(201).json({
      message: "Card details created successfully",
      newCardDetail,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all card details
exports.getAllCardDetails = async (req, res) => {
  try {
    // Retrieve all CardDetails entries
    const cardDetails = await CardDetails.find();
    res.status(200).json(cardDetails);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get a single card detail by ID
exports.getCardDetailById = async (req, res) => {
  const { id } = req.params;

  try {
    // Find the CardDetails entry by ID
    const cardDetail = await CardDetails.findById(id);
    if (!cardDetail) {
      return res.status(404).json({ message: "Card details not found" });
    }
    res.status(200).json(cardDetail);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update a card detail by ID
exports.updateCardDetail = async (req, res) => {
  const { id } = req.params;
  const { card_number, card_holder_name, expiry_date, cvv, billing_address } =
    req.body;

  try {
    // Update the CardDetails entry by ID
    const updatedCardDetail = await CardDetails.findByIdAndUpdate(
      id,
      {
        card_number,
        card_holder_name,
        expiry_date,
        cvv,
        billing_address,
      },
      { new: true },
    );

    if (!updatedCardDetail) {
      return res.status(404).json({ message: "Card details not found" });
    }
    res.status(200).json({
      message: "Card details updated successfully",
      updatedCardDetail,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete a card detail by ID
exports.deleteCardDetail = async (req, res) => {
  const { id } = req.params;

  try {
    // Delete the CardDetails entry by ID
    const deletedCardDetail = await CardDetails.findByIdAndDelete(id);
    if (!deletedCardDetail) {
      return res.status(404).json({ message: "Card details not found" });
    }
    res.status(200).json({
      message: "Card details deleted successfully",
      deletedCardDetail,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
