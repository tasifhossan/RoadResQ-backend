import { Availability, InvoiceStatus, Prisma, RequestStatus, Role } from '@prisma/client';
import { prisma } from '../../config/db.js';

export const getAllUsers = async (
  page: number = 1,
  limit: number = 10,
  roleFilter?: Role
) => {
  const skip = (page - 1) * limit;

  const whereClause: Prisma.UserWhereInput = roleFilter ? { role: roleFilter } : {};

  const selectFields = {
    id: true,
    name: true,
    email: true,
    role: true,
    phone: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    mechanicProfile: true,
  };

  const [total, result] = await Promise.all([
    prisma.user.count({ where: whereClause }),
    prisma.user.findMany({
      where: whereClause,
      select: selectFields,
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

export const updateUserRole = async (
  targetUserId: string,
  newRole: Role,
  adminUserId: string
) => {
  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
  });

  if (!user) {
    const err = new Error('User not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  const previousRole = user.role;

  if (previousRole === newRole) {
    return user;
  }

  // If demoting FROM MECHANIC, verify no active service requests exist
  if (previousRole === Role.MECHANIC && newRole !== Role.MECHANIC) {
    const activeJobCount = await prisma.serviceRequest.count({
      where: {
        mechanicId: targetUserId,
        status: {
          in: [
            RequestStatus.ASSIGNED,
            RequestStatus.EN_ROUTE,
            RequestStatus.ARRIVED,
            RequestStatus.IN_PROGRESS,
          ],
        },
      },
    });

    if (activeJobCount > 0) {
      const err = new Error(
        'Cannot change role: Mechanic currently has active service requests'
      ) as Error & { statusCode: number };
      err.statusCode = 400;
      throw err;
    }
  }

  // If promoting TO MECHANIC, create MechanicProfile if missing
  if (newRole === Role.MECHANIC) {
    const existingProfile = await prisma.mechanicProfile.findUnique({
      where: { userId: targetUserId },
    });

    if (!existingProfile) {
      await prisma.mechanicProfile.create({
        data: {
          userId: targetUserId,
          availability: Availability.OFFLINE,
          skills: [],
          rating: 0,
          totalJobs: 0,
        },
      });
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id: targetUserId },
    data: { role: newRole },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
      mechanicProfile: true,
    },
  });

  // Log role update to AuditLog
  await prisma.auditLog.create({
    data: {
      actorId: adminUserId,
      action: 'UPDATE_USER_ROLE',
      entityType: 'User',
      entityId: targetUserId,
      metadata: {
        from: previousRole,
        to: newRole,
      },
    },
  });

  return updatedUser;
};

export const deactivateUser = async (
  targetUserId: string,
  adminUserId: string
) => {
  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
  });

  if (!user) {
    const err = new Error('User not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  if (user.deletedAt !== null) {
    return user;
  }

  // Active-job check: don't deactivate a mechanic mid-job
  if (user.role === Role.MECHANIC) {
    const activeJobCount = await prisma.serviceRequest.count({
      where: {
        mechanicId: targetUserId,
        status: {
          in: [
            RequestStatus.ASSIGNED,
            RequestStatus.EN_ROUTE,
            RequestStatus.ARRIVED,
            RequestStatus.IN_PROGRESS,
          ],
        },
      },
    });

    if (activeJobCount > 0) {
      const err = new Error(
        'Cannot deactivate user: Mechanic currently has active service requests'
      ) as Error & { statusCode: number };
      err.statusCode = 400;
      throw err;
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id: targetUserId },
    data: { deletedAt: new Date() },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
    },
  });

  // Log deactivation to AuditLog
  await prisma.auditLog.create({
    data: {
      actorId: adminUserId,
      action: 'DEACTIVATE_USER',
      entityType: 'User',
      entityId: targetUserId,
      metadata: {
        email: user.email,
        role: user.role,
      },
    },
  });

  return updatedUser;
};

export const reactivateUser = async (
  targetUserId: string,
  adminUserId: string
) => {
  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
  });

  if (!user) {
    const err = new Error('User not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  if (user.deletedAt === null) {
    return user;
  }

  const updatedUser = await prisma.user.update({
    where: { id: targetUserId },
    data: { deletedAt: null },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
    },
  });

  // Log reactivation to AuditLog
  await prisma.auditLog.create({
    data: {
      actorId: adminUserId,
      action: 'REACTIVATE_USER',
      entityType: 'User',
      entityId: targetUserId,
      metadata: {
        email: user.email,
        role: user.role,
      },
    },
  });

  return updatedUser;
};

export const getDashboardStats = async () => {
  const [totalUsers, customersCount, mechanicsCount, adminsCount] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: Role.CUSTOMER } }),
    prisma.user.count({ where: { role: Role.MECHANIC } }),
    prisma.user.count({ where: { role: Role.ADMIN } }),
  ]);

  const requestStatusCounts = await prisma.serviceRequest.groupBy({
    by: ['status'],
    _count: { status: true },
  });

  const requestsByStatus = Object.values(RequestStatus).reduce((acc, status) => {
    const found = requestStatusCounts.find((item) => item.status === status);
    acc[status] = found ? found._count.status : 0;
    return acc;
  }, {} as Record<string, number>);

  const completedJobsCount = requestsByStatus[RequestStatus.COMPLETED] || 0;

  const totalRevenueAggregate = await prisma.invoice.aggregate({
    where: { status: InvoiceStatus.PAID },
    _sum: { totalAmount: true },
  });

  const totalRevenue = totalRevenueAggregate._sum.totalAmount
    ? totalRevenueAggregate._sum.totalAmount.toString()
    : '0.00';

  return {
    users: {
      total: totalUsers,
      customers: customersCount,
      mechanics: mechanicsCount,
      admins: adminsCount,
    },
    serviceRequests: {
      total: Object.values(requestsByStatus).reduce((a, b) => a + b, 0),
      byStatus: requestsByStatus,
      completedJobs: completedJobsCount,
    },
    revenue: {
      totalPaidAmount: totalRevenue,
    },
  };
};

export const getAuditLogs = async (
  page: number = 1,
  limit: number = 10,
  entityTypeFilter?: string,
  actionFilter?: string
) => {
  const skip = (page - 1) * limit;

  const whereClause: Prisma.AuditLogWhereInput = {
    ...(entityTypeFilter ? { entityType: entityTypeFilter } : {}),
    ...(actionFilter ? { action: actionFilter } : {}),
  };

  const [total, result] = await Promise.all([
    prisma.auditLog.count({ where: whereClause }),
    prisma.auditLog.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
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

export const AdminService = {
  getAllUsers,
  updateUserRole,
  deactivateUser,
  reactivateUser,
  getDashboardStats,
  getAuditLogs,
};
