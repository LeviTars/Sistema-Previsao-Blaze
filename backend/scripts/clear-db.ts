import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Limpando o banco de dados (tabela rolls)...');
  
  try {
    const deleted = await prisma.roll.deleteMany({});
    console.log(`✅ Sucesso! ${deleted.count} rodadas foram removidas.`);
  } catch (error) {
    console.error('❌ Erro ao limpar o banco:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
