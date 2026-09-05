import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db.js';

export const createSparePart = async (data: { name: string }) => {
  const sparePart = await prisma.sparePart.create({
    data: {
      name: data.name,
      isGlobal: true,
      createdByMechanicId: null,
    },
  });

  return sparePart;
};

export const getAllSpareParts = async (
  page: number = 1,
  limit: number = 10,
  search?: string
) => {
  const skip = (page - 1) * limit;

  const whereClause: Prisma.SparePartWhereInput = {
    isGlobal: true,
    deletedAt: null,
    ...(search
      ? {
          name: {
            contains: search,
            mode: 'insensitive' as Prisma.QueryMode,
          },
        }
      : {}),
  };

  const [total, result] = await Promise.all([
    prisma.sparePart.count({ where: whereClause }),
    prisma.sparePart.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    result,
  };
};

export const getSparePartById = async (id: string) => {
  const sparePart = await prisma.sparePart.findFirst({
    where: {
      id,
      deletedAt: null,
    },
  });

  if (!sparePart) {
    const err = new Error('Spare part not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  return sparePart;
};

export const updateSparePart = async (id: string, data: { name: string }) => {
  await getSparePartById(id);

  const updatedSparePart = await prisma.sparePart.update({
    where: { id },
    data: {
      name: data.name,
    },
  });

  return updatedSparePart;
};

export const softDeleteSparePart = async (id: string) => {
  await getSparePartById(id);

  const deletedSparePart = await prisma.sparePart.update({
    where: { id },
    data: {
      deletedAt: new Date(),
    },
  });

  return deletedSparePart;
};

export const SparePartService = {
  createSparePart,
  getAllSpareParts,
  getSparePartById,
  updateSparePart,
  softDeleteSparePart,
};
