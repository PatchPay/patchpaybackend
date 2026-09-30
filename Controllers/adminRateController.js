const prisma = require("../lib/prisma");

const TYPES = [
  "Personal",
  "Business",
  "NGO",
  "Government",
  "Government Org",
];

const NUMERIC_FIELDS = [
  "baseRate",
  "minTransaction",
  "perCountry",
  "perContinentCountries",
  "acrossContinents",
  "bankPerCountryAmount",
  "bankPerCountryPercent",
  "bankPerContinentAmount",
  "bankPerContinentPercent",
  "bankAcrossContinentsAmount",
  "bankAcrossContinentsPercent",
  "exchangeRateMargin",
];

const FIELDS = new Set([
  ...NUMERIC_FIELDS,
  "userType",
  "exchangeRateSource",
  "isActive",
]);

const TYPE_DB = {
  "Government Org": "Government",
};

const TYPE_API = {
  Government: "Government Org",
};

const toApi = (rate) =>
  rate && {
    ...rate,

    userType: TYPE_API[rate.userType] || rate.userType,

    bankCharges: {
      perCountry: {
        amount: rate.bankPerCountryAmount,
        percent: rate.bankPerCountryPercent,
      },

      perContinentCountries: {
        amount: rate.bankPerContinentAmount,
        percent: rate.bankPerContinentPercent,
      },

      acrossContinents: {
        amount: rate.bankAcrossContinentsAmount,
        percent: rate.bankAcrossContinentsPercent,
      },
    },

    exchangeRate: {
      source: rate.exchangeRateSource,
      margin: rate.exchangeRateMargin,
    },
  };

function parseBody(body, partial) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Invalid rate values");
  }

  const input = { ...body };
  const bank = input.bankCharges;

  if (bank && typeof bank === "object") {
    for (const [key, prefix] of [
      ["perCountry", "bankPerCountry"],
      ["perContinentCountries", "bankPerContinent"],
      ["acrossContinents", "bankAcrossContinents"],
    ]) {
      if (bank[key] && typeof bank[key] === "object") {
        if (bank[key].amount !== undefined) {
          input[`${prefix}Amount`] = bank[key].amount;
        }

        if (bank[key].percent !== undefined) {
          input[`${prefix}Percent`] = bank[key].percent;
        }
      }
    }

    delete input.bankCharges;
  }

  if (input.exchangeRate && typeof input.exchangeRate === "object") {
    if (input.exchangeRate.source !== undefined) {
      input.exchangeRateSource = input.exchangeRate.source;
    }

    if (input.exchangeRate.margin !== undefined) {
      input.exchangeRateMargin = input.exchangeRate.margin;
    }

    delete input.exchangeRate;
  }

  const data = {};

  for (const [key, value] of Object.entries(input)) {
    if (!FIELDS.has(key)) {
      throw new Error(`Invalid rate field: ${key}`);
    }

    if (key === "userType") {
      if (typeof value !== "string" || !TYPES.includes(value)) {
        throw new Error("Invalid customer type");
      }

      data.userType = TYPE_DB[value] || value;
    } else if (NUMERIC_FIELDS.includes(key)) {
      if (
        value === null ||
        value === "" ||
        typeof value === "boolean" ||
        !Number.isFinite(Number(value)) ||
        Number(value) < 0
      ) {
        throw new Error("Invalid rate values");
      }

      data[key] = Number(value);
    } else if (key === "isActive") {
      if (typeof value !== "boolean") {
        throw new Error("Invalid rate values");
      }

      data[key] = value;
    } else if (key === "exchangeRateSource") {
      if (typeof value !== "string" || !value.trim()) {
        throw new Error("Invalid rate values");
      }

      data[key] = value.trim();
    }
  }

  if (!partial && !data.userType) {
    throw new Error("Invalid customer type");
  }

  return data;
}

const idFrom = (raw) =>
  /^\d+$/.test(raw) && Number(raw) > 0 ? Number(raw) : null;

const fail = (res, status, message) =>
  res.status(status).json({
    success: false,
    message,
  });

exports.getRates = async (req, res) => {
  try {
    const rates = await prisma.rate.findMany({
      orderBy: {
        id: "asc",
      },
    });

    return res.json({
      success: true,
      rates: rates.map(toApi),
    });
  } catch (e) {
    console.error("Get rates failed:", e);

    return fail(res, 500, "Failed to fetch rates");
  }
};

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
      rate: toApi(rate),
    });
  } catch (e) {
    console.error("Get rate failed:", e);

    return fail(res, 500, "Failed to fetch rate");
  }
};

exports.createRate = async (req, res) => {
  let data;

  try {
    data = parseBody(req.body, false);
  } catch (e) {
    return fail(res, 400, e.message);
  }

  try {
    const rate = await prisma.rate.create({
      data: {
        ...data,
        rate_international_squad: 0,
        rate_international_stripe: 0,
        rate_national_squad: 0,
        rate_national_stripe: 0,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Rate created successfully",
      rate: toApi(rate),
    });
  } catch (e) {
    console.error("Create rate failed:", e);

    if (e.code === "P2002") {
      return fail(
        res,
        409,
        "A rate configuration already exists for this customer type"
      );
    }

    return fail(res, 500, "Failed to create rate");
  }
};

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
      rate: toApi(rate),
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
        "A rate configuration already exists for this customer type"
      );
    }

    return fail(res, 500, "Failed to update rate");
  }
};

exports.deleteRate = async (req, res) => {
  const id = idFrom(req.params.id);

  if (!id) {
    return fail(res, 400, "Invalid rate ID");
  }

  try {
    await prisma.rate.update({
      where: {
        id,
      },
      data: {
        isActive: false,
      },
    });

    return res.json({
      success: true,
      message: "Rate deleted successfully",
    });
  } catch (e) {
    console.error("Deactivate rate failed:", e);

    if (e.code === "P2025") {
      return fail(res, 404, "Rate not found");
    }

    return fail(res, 500, "Failed to deactivate rate");
  }
};