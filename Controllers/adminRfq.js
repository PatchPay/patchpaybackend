const prisma = require("../lib/prisma");

/**
 * GET ALL RFQs
 * GET /api/admin/rfqs
 *
 * Admin can see every RFQ on the platform.
 */
const getAllRfqs = async (req, res) => {
  try {
    const rfqs = await prisma.rFQ.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      message: "RFQs fetched successfully",
      count: rfqs.length,
      rfqs,
    });
  } catch (error) {
    console.error("Admin get all RFQs error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch RFQs",
    });
  }
};

module.exports = {
  getAllRfqs,
};