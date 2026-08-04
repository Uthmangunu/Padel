import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const roster = [
  ["Youssef", 9.5],
  ["Saif", 9],
  ["Uthman", 8.5],
  ["Todimu", 8],
  ["Bubu", 8],
  ["Farouk", 8],
  ["Abdallah", 7.5],
  ["Walid", 7],
  ["Ommatta", 7],
  ["Murtala", 7],
  ["Jedy", 6.5],
  ["Safir", 6],
  ["Ebube", 5.5],
  ["Mukthar", 3.5],
  ["Dozie", 3.5],
  ["Safwaan", 3],
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
