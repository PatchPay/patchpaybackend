const Bank = require("../models/Bank");
const squadService = require("./squad.service");

const BANK_LIST_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

/**
 * Sync bank list from SquadCo into the local DB.
 * This is the preferred source of truth for frontend bank dropdowns.
 */
exports.syncBanksFromSquad = async () => {
  try {
    const banksResponse = await squadService.getBanks();
    const banks = banksResponse?.data || [];
    if (!Array.isArray(banks) || banks.length === 0) {
      return [];
    }

    const bulkOps = banks.map((bank) => {
      const bankCode = String(bank.bank_code || bank.code || bank.bankCode || "").trim();
      const bankName = String(bank.bank_name || bank.name || bank.bankName || "").trim();
      return {
        updateOne: {
          filter: { bankCode },
          update: {
            $set: {
              bankCode,
              name: bankName,
              country: bank.country || "NG",
              active: bank.isActive !== false,
              raw: bank,
              lastSyncedAt: new Date(),
            },
          },
          upsert: true,
        },
      };
    });

    if (bulkOps.length > 0) {
      await Bank.bulkWrite(bulkOps, { ordered: false });
    }

    return await Bank.find({}).lean();
  } catch (error) {
    console.error("Bank sync error:", error.response?.data || error.message || error);
    throw error;
  }
};

exports.getBanks = async ({ forceRefresh = false } = {}) => {
  const latestBank = await Bank.findOne({}).sort({ lastSyncedAt: -1 });
  const shouldRefresh =
    forceRefresh ||
    !latestBank ||
    Date.now() - new Date(latestBank.lastSyncedAt).getTime() > BANK_LIST_TTL_MS;

  if (shouldRefresh) {
    try {
      await exports.syncBanksFromSquad();
    } catch (error) {
      console.warn("Failed to refresh bank list from Squad, falling back to cached banks.");
    }
  }

  return Bank.find({ active: true }).sort({ name: 1 }).lean();
};

exports.getBankByCode = async (bankCode) => {
  if (!bankCode) return null;
  return Bank.findOne({ bankCode: String(bankCode).trim() }).lean();
};
