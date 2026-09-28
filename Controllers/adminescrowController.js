const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

/**
 * GET ALL ESCROWS
 * GET /api/admin/escrows
 */
const getAllEscrows = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit) || 20, 1),
      100
    );

    const skip = (page - 1) * limit;

    const { status, search } = req.query;

    const where = {};

    // Filter by escrow status
    if (status) {
      where.status = status;
    }

    // Search by escrow UPRN or description
    if (search) {
      where.OR = [
        {
          escrowUprn: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          description: {
            contains: search,
            mode: "insensitive",
          },
        },
      ];
    }

    const [escrows, total] = await Promise.all([
      prisma.escrow.findMany({
        where,
        skip,
        take: limit,

        orderBy: {
          createdAt: "desc",
        },

        include: {
          creator: {
            select: {
              id: true,
              firstName: true,
              surname: true,
              email: true,
              phoneNumber: true,
            },
          },

          recipient: {
            select: {
              id: true,
              firstName: true,
              surname: true,
              email: true,
              phoneNumber: true,
            },
          },
        },
      }),

      prisma.escrow.count({
        where,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      message: "Escrows fetched successfully",

      pagination: {
        page,
        limit,
        total,
        totalPages,
      },

      count: escrows.length,

      escrows,
    });
  } catch (error) {
    console.error("Admin get all escrows error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch escrows",
      error: error.message,
    });
  }
};

/**
 * GET SINGLE ESCROW
 * GET /api/admin/escrows/:id
 */
const getEscrowById = async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid escrow ID",
      });
    }

    const escrow = await prisma.escrow.findUnique({
      where: {
        id,
      },

      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            surname: true,
            email: true,
            phoneNumber: true,
          },
        },

        recipient: {
          select: {
            id: true,
            firstName: true,
            surname: true,
            email: true,
            phoneNumber: true,
          },
        },

        escrowTransactions: true,

        invoices: true,
      },
    });

    if (!escrow) {
      return res.status(404).json({
        success: false,
        message: "Escrow not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Escrow fetched successfully",
      escrow,
    });
  } catch (error) {
    console.error("Admin get escrow by ID error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch escrow",
      error: error.message,
    });
  }
};

/**
 * GET ESCROW STATS
 * GET /api/admin/escrows/stats
 */
const getEscrowStats = async (req, res) => {
  try {
    const [
      totalEscrows,
      createdEscrows,
      partiallyFundedEscrows,
      fundedEscrows,
      deliveredEscrows,
      receivedEscrows,
      releasedEscrows,
      refundedEscrows,
      disputedEscrows,
      cancelledEscrows,
    ] = await Promise.all([
      prisma.escrow.count(),

      prisma.escrow.count({
        where: {
          status: "CREATED",
        },
      }),

      prisma.escrow.count({
        where: {
          status: "PARTIALLY_FUNDED",
        },
      }),

      prisma.escrow.count({
        where: {
          status: "FUNDED",
        },
      }),

      prisma.escrow.count({
        where: {
          status: "DELIVERED",
        },
      }),

      prisma.escrow.count({
        where: {
          status: "RECEIVED",
        },
      }),

      prisma.escrow.count({
        where: {
          status: "RELEASED",
        },
      }),

      prisma.escrow.count({
        where: {
          status: "REFUNDED",
        },
      }),

      prisma.escrow.count({
        where: {
          status: "DISPUTED",
        },
      }),

      prisma.escrow.count({
        where: {
          status: "CANCELLED",
        },
      }),
    ]);

    const balanceResult = await prisma.escrow.aggregate({
      _sum: {
        currentBalance: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Escrow statistics fetched successfully",

      stats: {
        total: totalEscrows,

        created: createdEscrows,
        partiallyFunded: partiallyFundedEscrows,
        funded: fundedEscrows,
        delivered: deliveredEscrows,
        received: receivedEscrows,
        released: releasedEscrows,
        refunded: refundedEscrows,
        disputed: disputedEscrows,
        cancelled: cancelledEscrows,

        currentBalance: balanceResult._sum.currentBalance || 0,
      },
    });
  } catch (error) {
    console.error("Admin escrow stats error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch escrow statistics",
      error: error.message,
    });
  }
};

module.exports = {
  getAllEscrows,
  getEscrowById,
  getEscrowStats,
};