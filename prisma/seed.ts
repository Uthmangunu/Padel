import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const roster = [
  ["Youssef", 6],
  ["Saif", 6],
  ["Uthman", 6],
  ["Todimu", 6],
  ["Bubu", 6],
  ["Farouk", 6],
  ["Abdallah", 6],
  ["Walid", 6],
  ["Ommatta", 6],
  ["Murtala", 6],
  ["Jedy", 6],
  ["Safir", 6],
  ["Ebube", 6],
  ["Mukthar", 6],
  ["Dozie", 6],
  ["Safwaan", 6],
] as const;
async function main() {
  const list = await prisma.list.upsert({
    where: { id: "default-roster" },
    update: {},
    create: { id: "default-roster", name: "Friday Padel" },
  });
  for (const [name, rating] of roster)
    await prisma.player.upsert({
      where: { id: `seed-${name.toLowerCase()}` },
      update: { name, rating },
      create: {
        id: `seed-${name.toLowerCase()}`,
        listId: list.id,
        name,
        rating,
      },
    });
}
main().finally(() => prisma.$disconnect());
