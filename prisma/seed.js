const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// The application has no required roles, admin account, or configuration records.
// This intentional no-op keeps `prisma db seed` safe and ready for future required data.
async function main() {
  console.log("Seed complete: no required default records were found.");
}

main().finally(() => prisma.$disconnect());
