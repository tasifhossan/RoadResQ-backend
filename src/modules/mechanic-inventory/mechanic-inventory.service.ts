import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db.js';

export const addInventoryItem = async (
  mechanicUserId: string,
  data: {
    sparePartId?: string;
    name?: string;
    price: number;
    stock: number;
  }
) => {
  const mechanicProfile = await prisma.mechanicProfile.findUnique({
    where: { userId: mechanicUserId },
  });

  if (!mechanicProfile) {
    const err = new Error('Mechanic profile not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  // Case A: Adding existing global catalog part to mechanic's inventory
  if (data.sparePartId) {
    const catalogPart = await prisma.sparePart.findFirst({
      where: {
        id: data.sparePartId,
        isGlobal: true,
        deletedAt: null,
      },
    });

    if (!catalogPart) {
      const err = new Error('Global catalog spare part not found') as Error & {
        statusCode: number;
      };
      err.statusCode = 404;
      throw err;
    }

    const existingInventory = await prisma.mechanicInventory.findUnique({
      where: {
        mechanicProfileId_sparePartId: {
          mechanicProfileId: mechanicProfile.id,
          sparePartId: data.sparePartId,
        },
      },
    });

    if (existingInventory) {
      const err = new Error(
        'Spare part already exists in your inventory. Use update or restock instead.'
      ) as Error & { statusCode: number };
      err.statusCode = 409;
      throw err;
    }

    const inventoryItem = await prisma.mechanicInventory.create({
      data: {
        mechanicProfileId: mechanicProfile.id,
        sparePartId: data.sparePartId,
        price: new Prisma.Decimal(data.price),
        stock: data.stock,
      },
      include: { sparePart: true },
    });

    return inventoryItem;
  }

  // Case B: Creating a brand-new custom spare part AND mechanic inventory row in one transaction
  const inventoryItem = await prisma.$transaction(async (tx) => {
    const customSparePart = await tx.sparePart.create({
      data: {
        name: data.name!,
        isGlobal: false,
        createdByMechanicId: mechanicUserId,
      },
    });

    return tx.mechanicInventory.create({
      data: {
        mechanicProfileId: mechanicProfile.id,
        sparePartId: customSparePart.id,
        price: new Prisma.Decimal(data.price),
        stock: data.stock,
      },
      include: { sparePart: true },
    });
  });

  return inventoryItem;
};

export const getMyInventory = async (
  mechanicUserId: string,
  page: number = 1,
  limit: number = 10
) => {
  const mechanicProfile = await prisma.mechanicProfile.findUnique({
    where: { userId: mechanicUserId },
  });

  if (!mechanicProfile) {
    const err = new Error('Mechanic profile not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  const skip = (page - 1) * limit;

  const whereClause: Prisma.MechanicInventoryWhereInput = {
    mechanicProfileId: mechanicProfile.id,
    sparePart: {
      deletedAt: null,
    },
  };

  const [total, result] = await Promise.all([
    prisma.mechanicInventory.count({ where: whereClause }),
    prisma.mechanicInventory.findMany({
      where: whereClause,
      include: { sparePart: true },
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

export const updateInventoryItem = async (
  mechanicUserId: string,
  sparePartId: string,
  data: {
    name?: string;
    price?: number;
    stock?: number;
  }
) => {
  const mechanicProfile = await prisma.mechanicProfile.findUnique({
    where: { userId: mechanicUserId },
  });

  if (!mechanicProfile) {
    const err = new Error('Mechanic profile not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  const inventoryItem = await prisma.mechanicInventory.findUnique({
    where: {
      mechanicProfileId_sparePartId: {
        mechanicProfileId: mechanicProfile.id,
        sparePartId,
      },
    },
    include: { sparePart: true },
  });

  if (!inventoryItem) {
    const err = new Error('Inventory item not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  if (data.name !== undefined) {
    if (
      inventoryItem.sparePart.isGlobal ||
      inventoryItem.sparePart.createdByMechanicId !== mechanicUserId
    ) {
      const err = new Error(
        'Cannot rename a global catalog spare part. You can only rename your own custom parts.'
      ) as Error & { statusCode: number };
      err.statusCode = 403;
      throw err;
    }

    await prisma.sparePart.update({
      where: { id: sparePartId },
      data: { name: data.name },
    });
  }

  const updatedInventory = await prisma.mechanicInventory.update({
    where: { id: inventoryItem.id },
    data: {
      ...(data.price !== undefined && { price: new Prisma.Decimal(data.price) }),
      ...(data.stock !== undefined && { stock: data.stock }),
    },
    include: { sparePart: true },
  });

  return updatedInventory;
};

export const restockInventoryItem = async (
  mechanicUserId: string,
  sparePartId: string,
  quantity: number
) => {
  const mechanicProfile = await prisma.mechanicProfile.findUnique({
    where: { userId: mechanicUserId },
  });

  if (!mechanicProfile) {
    const err = new Error('Mechanic profile not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  const inventoryItem = await prisma.mechanicInventory.findUnique({
    where: {
      mechanicProfileId_sparePartId: {
        mechanicProfileId: mechanicProfile.id,
        sparePartId,
      },
    },
  });

  if (!inventoryItem) {
    const err = new Error('Inventory item not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  const updatedInventory = await prisma.mechanicInventory.update({
    where: { id: inventoryItem.id },
    data: {
      stock: {
        increment: quantity,
      },
    },
    include: { sparePart: true },
  });

  // Log restock action to AuditLog
  await prisma.auditLog.create({
    data: {
      actorId: mechanicUserId,
      action: 'RESTOCK',
      entityType: 'MechanicInventory',
      entityId: updatedInventory.id,
      metadata: {
        sparePartId,
        quantityAdded: quantity,
        newStock: updatedInventory.stock,
      },
    },
  });

  return updatedInventory;
};

export const removeInventoryItem = async (
  mechanicUserId: string,
  sparePartId: string
) => {
  const mechanicProfile = await prisma.mechanicProfile.findUnique({
    where: { userId: mechanicUserId },
  });

  if (!mechanicProfile) {
    const err = new Error('Mechanic profile not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  const inventoryItem = await prisma.mechanicInventory.findUnique({
    where: {
      mechanicProfileId_sparePartId: {
        mechanicProfileId: mechanicProfile.id,
        sparePartId,
      },
    },
    include: { sparePart: true },
  });

  if (!inventoryItem) {
    const err = new Error('Inventory item not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  await prisma.mechanicInventory.delete({
    where: { id: inventoryItem.id },
  });

  // If this is a custom part created by this mechanic, and no other mechanic references it, soft-delete the SparePart
  if (
    !inventoryItem.sparePart.isGlobal &&
    inventoryItem.sparePart.createdByMechanicId === mechanicUserId
  ) {
    const remainingUsages = await prisma.mechanicInventory.count({
      where: { sparePartId },
    });

    if (remainingUsages === 0) {
      await prisma.sparePart.update({
        where: { id: sparePartId },
        data: { deletedAt: new Date() },
      });
    }
  }

  return { message: 'Inventory item removed successfully' };
};

export const MechanicInventoryService = {
  addInventoryItem,
  getMyInventory,
  updateInventoryItem,
  restockInventoryItem,
  removeInventoryItem,
};
