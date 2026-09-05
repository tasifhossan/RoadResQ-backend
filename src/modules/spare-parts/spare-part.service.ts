import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db.js';

export const createSparePart = async (data: {
  name: string;
  price: number;
  stock: number;
}) => {
  const sparePart = await prisma.sparePart.create({
    data: {
      name: data.name,
      price: new Prisma.Decimal(data.price),
      stock: data.stock,
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

export const updateSparePart = async (
  id: string,
  data: {
    name?: string;
    price?: number;
    stock?: number;
  }
) => {
  await getSparePartById(id);

  const updatedSparePart = await prisma.sparePart.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.price !== undefined && { price: new Prisma.Decimal(data.price) }),
      ...(data.stock !== undefined && { stock: data.stock }),
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

export const restockSparePart = async (
  sparePartId: string,
  quantity: number,
  mechanicUserId: string
) => {
  await getSparePartById(sparePartId);

  const updatedSparePart = await prisma.sparePart.update({
    where: { id: sparePartId },
    data: {
      stock: {
        increment: quantity,
      },
    },
  });

  // Log restocking action to AuditLog
  await prisma.auditLog.create({
    data: {
      actorId: mechanicUserId,
      action: 'RESTOCK',
      entityType: 'SparePart',
      entityId: sparePartId,
      metadata: {
        quantityAdded: quantity,
        newStock: updatedSparePart.stock,
      },
    },
  });

  return updatedSparePart;
};

export const SparePartService = {
  createSparePart,
  getAllSpareParts,
  getSparePartById,
  updateSparePart,
  softDeleteSparePart,
  restockSparePart,
};
