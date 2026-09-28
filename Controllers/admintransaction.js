const prisma = require("../lib/prisma");

/**
 * GET ALL PLATFORM TRANSACTIONS
 * GET /api/admin/transactions
 */
const getAllTransactions = async (req, res) => {
  try {
    const transactions = await prisma.transaction.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      message: "All transactions fetched successfully",
      count: transactions.length,
      transactions,
    });
  } catch (error) {
    console.error("Admin get all transactions error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch transactions",
    });
  }
};

module.exports = {
  getAllTransactions,
};