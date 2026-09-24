
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");

const generateAdminToken = (admin) => {
  return jwt.sign(
    {
      adminId: admin.id,
      email: admin.email,
      role: admin.role,
    },
    process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET,
    {
      expiresIn: process.env.ADMIN_JWT_EXPIRES_IN || "1d",
    }
  );
};

/**
 * REGISTER ADMIN
 */
const registerAdmin = async (req, res) => {
  try {
    const {
      firstName,
      middleName,
      email,
      password,
      role,
    } = req.body;

    // Validate required fields
    if (!firstName || !middleName || !email || !password) {
      return res.status(400).json({
        success: false,
        message:
          "First name, last name, email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if admin already exists
    const existingAdmin = await prisma.admin.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (existingAdmin) {
      return res.status(409).json({
        success: false,
        message: "An admin with this email already exists",
      });
    }

    // Validate role
    const allowedRoles = [
      "SUPER_ADMIN",
      "ADMIN",
      "OPERATIONS",
      "SUPPORT",
    ];

    const adminRole = role || "ADMIN";

    if (!allowedRoles.includes(adminRole)) {
      return res.status(400).json({
        success: false,
        message: "Invalid admin role",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create admin
    const admin = await prisma.admin.create({
      data: {
        firstName: firstName.trim(),
        middleName: middleName.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role: adminRole,
        status: "ACTIVE",
      },
      select: {
        id: true,
        firstName: true,
        middleName: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Admin registered successfully",
      admin,
    });
  } catch (error) {
    console.error("Register admin error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to register admin",
    });
  }
};

/**
 * LOGIN ADMIN
 */
const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const admin = await prisma.admin.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check account status
    if (admin.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Admin account is not active",
      });
    }

    // Compare password
    const passwordMatches = await bcrypt.compare(
      password,
      admin.password
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Generate token
    const token = generateAdminToken(admin);

    // Update last login
    await prisma.admin.update({
      where: {
        id: admin.id,
      },
      data: {
        lastLoginAt: new Date(),
      },
    });

    // Audit login
    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: "ADMIN_LOGIN",
        resource: "ADMIN",
        resourceId: String(admin.id),
        description: "Admin logged into the dashboard",
        ipAddress:
          req.ip ||
          req.headers["x-forwarded-for"] ||
          req.socket.remoteAddress ||
          null,
        metadata: {},
      },
    });

    return res.status(200).json({
      success: true,
      message: "Admin login successful",
      token,
      admin: {
        id: admin.id,
        firstName: admin.firstName,
        middleName: admin.middleName,
        email: admin.email,
        role: admin.role,
        status: admin.status,
      },
    });
  } catch (error) {
    console.error("Admin login error:", error);

    return res.status(500).json({
      success: false,
      message: "Admin login failed",
    });
  }
};

/**
 * GET CURRENT ADMIN
 */
const getCurrentAdmin = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      admin: req.admin,
    });
  } catch (error) {
    console.error("Get current admin error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get admin profile",
    });
  }
};

module.exports = {
  registerAdmin,
  loginAdmin,
  getCurrentAdmin,
};

