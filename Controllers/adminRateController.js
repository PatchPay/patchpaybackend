
const prisma = require("../lib/prisma");

// Fields that actually exist in the Rate Prisma model
const RATE_FIELDS = [
  "rate_international_squad",
  "rate_international_stripe",
  "rate_national_squad",
  "rate_national_stripe",
];

const fail = (res, status, message) => {
  return res.status(status).json({
    success: false,
    message,
  });
};

const idFrom = (raw) => {
  return /^\d+$/.test(String(raw)) && Number(raw) > 0
    ? Number(raw)
    : null;
};

/**
 * Validate and normalize rate input.
 *
 * Expected body:
 * {
 *   rate_international_squad: 2.5,
 *   rate_international_stripe: 2.7,
 *   rate_national_squad: 1.5,
 *   rate_national_stripe: 1.7
 * }
 */
function parseBody(body, partial = false) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Invalid rate values");
  }

  const data = {};

  for (const [key, value] of Object.entries(body)) {
    // Reject fields that do not exist in the Prisma Rate model
    if (!RATE_FIELDS.includes(key)) {
      throw new Error(`Invalid rate field: ${key}`);
    }

    // Validate numeric values
    if (
      value === null ||
      value === "" ||
      typeof value === "boolean" ||
      !Number.isFinite(Number(value)) ||
      Number(value) < 0
    ) {
      throw new Error(`Invalid value for ${key}`);
    }

    data[key] = Number(value);
  }

  // For creation, require all four rate values
  if (!partial) {
    for (const field of RATE_FIELDS) {
      if (data[field] === undefined) {
        throw new Error(`${field} is required`);
      }
    }
  }

  return data;
}

/**
 * GET ALL RATES
 * GET /api/admin/rates
 */
exports.getRates = async (req, res) => {
  try {
    const rates = await prisma.rate.findMany({
      orderBy: {
        id: "asc",
      },
    });

    return res.json({
      success: true,
      rates,
    });
  } catch (e) {
    console.error("Get rates failed:", e);

    return fail(res, 500, "Failed to fetch rates");
  }
};

/**
 * GET RATE BY ID
 * GET /api/admin/rates/:id
 */
exports.getRateById = async (req, res) => {
  const id = idFrom(req.params.id);

  if (!id) {
    return fail(res, 400, "Invalid rate ID");
  }

  try {
    const rate = await prisma.rate.findUnique({
      where: {
        id,
      },
    });

    if (!rate) {
      return fail(res, 404, "Rate not found");
    }

    return res.json({
      success: true,
      rate,
    });
  } catch (e) {
    console.error("Get rate failed:", e);

    return fail(res, 500, "Failed to fetch rate");
  }
};

/**
 * CREATE RATE
 * POST /api/admin/rates
 */
exports.createRate = async (req, res) => {
  let data;

  try {
    data = parseBody(req.body, false);
  } catch (e) {
    return fail(res, 400, e.message);
  }

  try {
    const rate = await prisma.rate.create({
      data,
    });

    return res.status(201).json({
      success: true,
      message: "Rate created successfully",
      rate,
    });
  } catch (e) {
    console.error("Create rate failed:", e);

    if (e.code === "P2002") {
      return fail(
        res,
        409,
        "A rate configuration already exists"
      );
    }

    return fail(res, 500, "Failed to create rate");
  }
};

/**
 * UPDATE RATE
 * PATCH /api/admin/rates/:id
 */
exports.updateRate = async (req, res) => {
  const id = idFrom(req.params.id);

  if (!id) {
    return fail(res, 400, "Invalid rate ID");
  }

  let data;

  try {
    data = parseBody(req.body, true);
  } catch (e) {
    return fail(res, 400, e.message);
  }

  if (!Object.keys(data).length) {
    return fail(res, 400, "No valid rate values provided");
  }

  try {
    const rate = await prisma.rate.update({
      where: {
        id,
      },
      data,
    });

    return res.json({
      success: true,
      message: "Rate updated successfully",
      rate,
    });
  } catch (e) {
    console.error("Update rate failed:", e);

    if (e.code === "P2025") {
      return fail(res, 404, "Rate not found");
    }

    if (e.code === "P2002") {
      return fail(
        res,
        409,
        "A rate configuration already exists"
      );
    }

    return fail(res, 500, "Failed to update rate");
  }
};

/**
 * DELETE RATE
 * DELETE /api/admin/rates/:id
 *
 * The current Rate model does not have an isActive field,
 * so this performs a real database delete.
 */
exports.deleteRate = async (req, res) => {
  const id = idFrom(req.params.id);

  if (!id) {
    return fail(res, 400, "Invalid rate ID");
  }

  try {
    await prisma.rate.delete({
      where: {
        id,
      },
    });

    return res.json({
      success: true,
      message: "Rate deleted successfully",
    });
  } catch (e) {
    console.error("Delete rate failed:", e);

    if (e.code === "P2025") {
      return fail(res, 404, "Rate not found");
    }

    return fail(res, 500, "Failed to delete rate");
  }
};

