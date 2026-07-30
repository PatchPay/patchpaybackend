import Addresses from "../models/Addresses"; // Assuming Addresses model is stored in '../models/Addresses'

// Create a new address
exports.createAddress = async (req, res) => {
  const { user, addresses } = req.body;

  try {
    // Create a new address entry
    const newAddress = await Addresses.create({
      user,
      addresses,
    });

    // Save the new address entry to the database
    res.status(201).json({
      message: "Address added successfully",
      newAddress,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all addresses linked to users
exports.getAllAddresses = async (req, res) => {
  try {
    // Retrieve all address entries with their related user.
    const addresses = await Addresses.findAll({ include: [{ association: "User" }] });
    res.status(200).json(addresses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get addresses of a single user by user ID
exports.getAddressesByUserId = async (req, res) => {
  const { userId } = req.params;

  try {
    // Find addresses for the specified user
    const addresses = await Addresses.findAll({ where: { user: userId }, include: [{ association: "User" }] });
    if (!addresses || addresses.length === 0) {
      return res
        .status(404)
        .json({ message: "No addresses found for this user" });
    }
    res.status(200).json(addresses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update an address by ID
exports.updateAddress = async (req, res) => {
  const { addressId } = req.params;
  const { addresses } = req.body;

  try {
    // Update the specified address entry
    const updatedAddress = await Addresses.findByPk(addressId);
    if (updatedAddress) await updatedAddress.update({ addresses });
    if (!updatedAddress) {
      return res.status(404).json({ message: "Address not found" });
    }
    res.status(200).json({
      message: "Address updated successfully",
      updatedAddress,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete an address by ID
exports.deleteAddress = async (req, res) => {
  const { addressId } = req.params;

  try {
    // Delete the specified address entry
    const deletedAddress = await Addresses.findByPk(addressId);
    if (deletedAddress) await deletedAddress.destroy();
    if (!deletedAddress) {
      return res.status(404).json({ message: "Address not found" });
    }
    res.status(200).json({
      message: "Address deleted successfully",
      deletedAddress,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
