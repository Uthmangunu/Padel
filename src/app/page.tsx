import { prisma } from "@/lib/prisma";import { PadelApp } from "@/components/padel-app";
export default async function Home(){let lists:Awaited<ReturnType<typeof prisma.list.findMany>>=[];try{lists=await prisma.list.findMany({orderBy:{createdAt:"asc"}})}catch{}return <PadelApp initialLists={lists.map(l=>({id:l.id,name:l.name}))}/>}
