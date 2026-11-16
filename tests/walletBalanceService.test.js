const test = require("node:test");
const assert = require("node:assert/strict");
const Wallet = require("../models/Wallet");
const walletService = require("../services/wallet.service");

test("wallet credits update internal and available balances atomically", async () => {
  const originalLiteral = Wallet.sequelize.literal;
  const originalUpdate = Wallet.update;
  const originalFind = Wallet.findByPk;
  let updateArgs;
  try {
    Wallet.sequelize.literal = (sql) => sql;
    Wallet.update = async (...args) => { updateArgs = args; return [1, [{ id: 7 }]]; };
    await walletService.creditWallet({ walletId: 7, amount: "12.34", transaction: {} });
    assert.equal(updateArgs[0].balance, "balance + 12.34");
    assert.equal(updateArgs[0].availableBalance, "available_balance + 12.34");
  } finally {
    Wallet.sequelize.literal = originalLiteral;
    Wallet.update = originalUpdate;
    Wallet.findByPk = originalFind;
  }
});

test("wallet debits enforce internal funds and reduce both displayed balances", async () => {
  const originalLiteral = Wallet.sequelize.literal;
  const originalUpdate = Wallet.update;
  let updateArgs;
  try {
    Wallet.sequelize.literal = (sql) => sql;
    Wallet.update = async (...args) => { updateArgs = args; return [1, [{ id: 7 }]]; };
    await walletService.debitWallet({ walletId: 7, amount: "5.00", transaction: {} });
    assert.equal(updateArgs[0].balance, "balance - 5.00");
    assert.equal(updateArgs[0].availableBalance, "available_balance - 5.00");
    assert.equal(updateArgs[1].where.balance[require("sequelize").Op.gte], "5.00");
    assert.equal(updateArgs[1].where.availableBalance[require("sequelize").Op.gte], "5.00");
  } finally {
    Wallet.sequelize.literal = originalLiteral;
    Wallet.update = originalUpdate;
  }
});

test("refund credits restore internal funds without increasing available balance", async () => {
  const originalLiteral = Wallet.sequelize.literal;
  const originalUpdate = Wallet.update;
  let updateArgs;
  try {
    Wallet.sequelize.literal = (sql) => sql;
    Wallet.update = async (...args) => { updateArgs = args; return [1, [{ id: 7 }]]; };
    await walletService.creditWallet({ walletId: 7, amount: "2.50", transaction: {}, creditAvailable: false });
    assert.equal(updateArgs[0].balance, "balance + 2.50");
    assert.equal("availableBalance" in updateArgs[0], false);
  } finally {
    Wallet.sequelize.literal = originalLiteral;
    Wallet.update = originalUpdate;
  }
});
