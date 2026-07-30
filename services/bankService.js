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

    const bankRecords = banks.map((bank) => {
      const bankCode = String(bank.bank_code || bank.code || bank.bankCode || "").trim();
      const bankName = String(bank.bank_name || bank.name || bank.bankName || "").trim();
      return { bankCode, name: bankName, country: bank.country || "NG", active: bank.isActive !== false, raw: bank, lastSyncedAt: new Date() };
    });

    if (bankRecords.length > 0) {
      await Promise.all(bankRecords.map((bank) => Bank.upsert(bank)));
    }

    return Bank.findAll();
  } catch (error) {
    console.error("Bank sync error:", error.response?.data || error.message || error);
    throw error;
  }
};

exports.getBanks = async ({ forceRefresh = false } = {}) => {
  const latestBank = await Bank.findOne({ order: [["lastSyncedAt", "DESC"]] });
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

  return Bank.findAll({ where: { active: true }, order: [["name", "ASC"]] });
};

exports.getBankByCode = async (bankCode) => {
  if (!bankCode) return null;
  return Bank.findOne({ where: { bankCode: String(bankCode).trim() } });
};
