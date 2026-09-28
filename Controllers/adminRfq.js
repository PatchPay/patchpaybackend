const prisma = require("../lib/prisma");

/**
 * ============================================
 * GET ALL RFQs / QUOTES
 * ============================================
 *
 * GET /api/admin/rfqs
 *
 * Admin can view every RFQ/quote on the platform.
 *
 * Optional query parameters:
 * ?page=1
 * ?limit=20
 * ?status=ACCEPTED
 * ?search=UPRN123
 */
const getAllRfqs = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(
      Math.max(Number(req.query.limit) || 20, 1),
      100
    );

    const skip = (page - 1) * limit;

    const { status, search } = req.query;

    const where = {};

    /**
     * Filter by RFQ status
     */
    if (status) {
      where.status = String(status);
    }

    /**
     * Search by reference
     *
     * Change `reference` below if your Quotes
     * model uses a different field name.
     */
    if (search) {
      where.reference = {
        contains: String(search),
        mode: "insensitive",
      };
    }

    const [quotes, total] = await Promise.all([
      prisma.quotes.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),

      prisma.quotes.count({
        where,
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: "RFQs fetched successfully",

      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },

      count: quotes.length,
      rfqs: quotes,
    });
  } catch (error) {
    console.error("Admin get all RFQs error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch RFQs",
    });
  }
};

/**
 * ============================================
 * GET SINGLE RFQ / QUOTE
 * ============================================
 *
 * GET /api/admin/rfqs/:id
 *
 * Admin can view the complete details
 * of a specific RFQ.
 */
const getRfqById = async (req, res) => {
  try {
    const quoteId = Number(req.params.id);

    if (!Number.isInteger(quoteId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid RFQ ID",
      });
    }

    const quote = await prisma.quotes.findUnique({
      where: {
        id: quoteId,
      },
    });

    if (!quote) {
      return res.status(404).json({
        success: false,
        message: "RFQ not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "RFQ fetched successfully",
      rfq: quote,
    });
  } catch (error) {
    console.error("Admin get RFQ by ID error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch RFQ",
    });
  }
};

/**
 * ============================================
 * GET RFQ STATISTICS
 * ============================================
 *
 * GET /api/admin/rfqs/stats
 *
 * Provides overview information for the
 * admin dashboard.
 */
const getRfqStats = async (req, res) => {
  try {
    const [
      totalRfqs,
      acceptedRfqs,
      rejectedRfqs,
    ] = await Promise.all([
      prisma.quotes.count(),

      prisma.quotes.count({
        where: {
          status: "ACCEPTED",
        },
      }),

      prisma.quotes.count({
        where: {
          status: "REJECTED",
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: "RFQ statistics fetched successfully",

      stats: {
        total: totalRfqs,
        accepted: acceptedRfqs,
        rejected: rejectedRfqs,
      },
    });
  } catch (error) {
    console.error("Admin RFQ statistics error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch RFQ statistics",
    });
  }
};

module.exports = {
  getAllRfqs,
  getRfqById,
  getRfqStats,
};