const prisma = require("../lib/prisma");

/**
 * GET ALL USERS
 *
 * GET /api/admin/users
 */
const getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        firstName: true,
        middleName: true,
        surname: true,
        email: true,
        phoneNumber: true,
        country: true,
        accountType: true,
        statusClient: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      count: users.length,
      users,
    });
  } catch (error) {
    console.error("Get all users error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
};

/**
 * GET USER STATISTICS
 *
 * GET /api/admin/users/stats
 */
const getUserStats = async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      inactiveUsers,
      suspendedUsers,
    ] = await Promise.all([
      prisma.user.count(),

      prisma.user.count({
        where: {
          statusClient: "Active",
        },
      }),

      prisma.user.count({
        where: {
          statusClient: "Inactive",
        },
      }),

    //   prisma.user.count({
    //     where: {
    //       statusClient: "Suspended",
    //     },
    //   }),
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        total: totalUsers,
        active: activeUsers,
        inactive: inactiveUsers,
        suspended: suspendedUsers,
      },
    });
  } catch (error) {
    console.error("Get user stats error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch user statistics",
    });
  }
};

/**
 * GET SINGLE USER
 *
 * GET /api/admin/users/:id
 */
const getUserById = async (req, res) => {
  try {
    const userId = Number(req.params.id);

    if (!Number.isInteger(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        firstName: true,
        middleName: true,
        surname: true,
        email: true,
        phoneNumber: true,
        country: true,
        accountType: true,
        statusClient: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User fetched successfully",
      user,
    });
  } catch (error) {
    console.error("Get user by ID error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch user",
    });
  }
};

/**
 * SUSPEND USER
 *
 * PATCH /api/admin/users/:id/suspend
 */
const suspendUser = async (req, res) => {
  try {
    const userId = Number(req.params.id);

    if (!Number.isInteger(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        firstName: true,
        middleName: true,
        email: true,
        statusClient: true,
      },
    });

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (existingUser.statusClient === "Suspended") {
      return res.status(400).json({
        success: false,
        message: "User is already suspended",
      });
    }

    const user = await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        statusClient: "Suspended",
      },
      select: {
        id: true,
        firstName: true,
        middleName: true,
        email: true,
        statusClient: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: "User suspended successfully",
      user,
    });
  } catch (error) {
    console.error("Suspend user error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to suspend user",
    });
  }
};

/**
 * REINSTATE USER
 *
 * PATCH /api/admin/users/:id/reinstate
 */
const reinstateUser = async (req, res) => {
  try {
    const userId = Number(req.params.id);

    if (!Number.isInteger(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        statusClient: true,
      },
    });

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (existingUser.statusClient !== "Suspended") {
      return res.status(400).json({
        success: false,
        message: "User is not suspended",
      });
    }

    const user = await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        statusClient: "Active",
      },
      select: {
        id: true,
        firstName: true,
        middleName: true,
        email: true,
        statusClient: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: "User reinstated successfully",
      user,
    });
  } catch (error) {
    console.error("Reinstate user error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to reinstate user",
    });
  }
};

/**
 * DELETE USER
 *
 * DELETE /api/admin/users/:id
 */
const deleteUser = async (req, res) => {
  try {
    const userId = Number(req.params.id);

    if (!Number.isInteger(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        firstName: true,
        middleName: true,
        email: true,
      },
    });

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    await prisma.user.delete({
      where: {
        id: userId,
      },
    });

    return res.status(200).json({
      success: true,
      message: "User deleted successfully",
      deletedUserId: userId,
    });
  } catch (error) {
    console.error("Delete user error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete user",
    });
  }
};

module.exports = {
  getAllUsers,
  getUserStats,
  getUserById,
  suspendUser,
  reinstateUser,
  deleteUser,
};