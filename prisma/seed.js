const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const defaults = [
  ["Personal", 1.5, 0, 1.5, 3, 5],
  ["Business", 1.5, 10, 4, 8, 10],
  ["NGO", 1.5, 10, 3, 6, 6],
  ["Government", 1.5, 5, 5, 10, 15],
];
async function main() {
  for (const [userType, baseRate, minTransaction, perCountry, perContinentCountries, acrossContinents] of defaults) {
    await prisma.rate.upsert({
      where: { userType },
      create: {
        userType, baseRate, minTransaction, perCountry, perContinentCountries, acrossContinents,
        bankPerCountryAmount: 0, bankPerCountryPercent: 0,
        bankPerContinentAmount: 0, bankPerContinentPercent: 0,
        bankAcrossContinentsAmount: 0, bankAcrossContinentsPercent: 0,
        exchangeRateSource: "Live exchange rate feed", exchangeRateMargin: 0, isActive: true,
        rate_international_squad: 0, rate_international_stripe: 0,
        rate_national_squad: 0, rate_national_stripe: 0,
      },
      update: {},
    });
  }
  console.log("Seed complete: default rate cards are present.");
}

main().finally(() => prisma.$disconnect());
