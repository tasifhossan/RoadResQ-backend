import {
  Availability,
  InvoiceStatus,
  PaymentStatus,
  Prisma,
  RequestPriority,
  RequestStatus,
  Role,
} from '@prisma/client';
import { prisma } from '../../config/db.js';
import { buildPaginatedResponse } from '../../utils/pagination.js';
import { LOW_STOCK_THRESHOLD } from '../mechanic-inventory/mechanic-inventory.service.js';
import {
  GetUsersQueryInput,
  GetAuditLogsQueryInput,
  GetServiceRequestsQueryInput,
  GetPaymentsQueryInput,
} from './admin.validation.js';

export const getAllUsers = async (options: Partial<GetUsersQueryInput> = {}) => {
  const page = options.page ?? 1;
  const limit = options.limit ?? 10;
  const skip = (page - 1) * limit;
  const sortBy = options.sortBy ?? 'createdAt';
  const sortOrder = options.sortOrder ?? 'desc';

  const whereClause: Prisma.UserWhereInput = {
    ...(options.role ? { role: options.role } : {}),
    ...(options.isActive === true
      ? { deletedAt: null }
      : options.isActive === false
      ? { deletedAt: { not: null } }
      : {}),
    ...(options.search
      ? {
          OR: [
            { name: { contains: options.search, mode: 'insensitive' } },
            { email: { contains: options.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

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
      orderBy: { [sortBy]: sortOrder },
    }),
  ]);

  return buildPaginatedResponse(result, total, page, limit);
};

export const DEMO_EMAIL_DOMAIN = '@roadresq-demo.com';

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

  if (user.email.toLowerCase().endsWith(DEMO_EMAIL_DOMAIN)) {
    const err = new Error('Demo accounts are protected') as Error & { statusCode: number };
    err.statusCode = 409;
    throw err;
  }

  if (targetUserId === adminUserId) {
    const err = new Error('Admins cannot change their own role') as Error & { statusCode: number };
    err.statusCode = 400;
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

  if (user.email.toLowerCase().endsWith(DEMO_EMAIL_DOMAIN)) {
    const err = new Error('Demo accounts are protected') as Error & { statusCode: number };
    err.statusCode = 409;
    throw err;
  }

  if (targetUserId === adminUserId) {
    const err = new Error('Admins cannot deactivate their own account') as Error & { statusCode: number };
    err.statusCode = 400;
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

  // 1. requestsOverTime: last 14 days [{ date: 'YYYY-MM-DD', count }], zero-filled
  const rawRequestsOverTime = await prisma.$queryRaw<
    Array<{
      date: string;
      count: number | bigint;
    }>
  >`
    WITH days AS (
      SELECT to_char(d, 'YYYY-MM-DD') AS date,
             d::date AS day_start
      FROM generate_series(
        CURRENT_DATE - INTERVAL '13 days',
        CURRENT_DATE,
        INTERVAL '1 day'
      ) AS d
    )
    SELECT 
      days.date,
      COUNT(sr.id)::int AS count
    FROM days
    LEFT JOIN "ServiceRequest" sr ON to_char(sr."createdAt", 'YYYY-MM-DD') = days.date
    GROUP BY days.date, days.day_start
    ORDER BY days.day_start ASC;
  `;

  const requestsOverTime = rawRequestsOverTime.map((r) => ({
    date: r.date,
    count: Number(r.count),
  }));

  // 2. revenueByMonth: last 6 months [{ month: 'YYYY-MM', amount }], zero-filled, from PAID payments only
  const rawRevenueByMonth = await prisma.$queryRaw<
    Array<{
      month: string;
      amount: string | number;
    }>
  >`
    WITH months AS (
      SELECT to_char(date_trunc('month', m), 'YYYY-MM') AS month,
             date_trunc('month', m) AS month_start
      FROM generate_series(
        date_trunc('month', CURRENT_DATE) - INTERVAL '5 months',
        date_trunc('month', CURRENT_DATE),
        INTERVAL '1 month'
      ) AS m
    )
    SELECT 
      months.month,
      COALESCE(SUM(i."totalAmount"), 0)::text AS amount
    FROM months
    LEFT JOIN "Invoice" i ON to_char(date_trunc('month', i."createdAt"), 'YYYY-MM') = months.month AND i."status" = 'PAID'
    GROUP BY months.month, months.month_start
    ORDER BY months.month_start ASC;
  `;

  const revenueByMonth = rawRevenueByMonth.map((m) => {
    const num = typeof m.amount === 'number' ? m.amount : parseFloat(m.amount.toString());
    return {
      month: m.month,
      amount: isNaN(num) ? '0.00' : num.toFixed(2),
    };
  });

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
    requestsOverTime,
    revenueByMonth,
  };
};

export const getAuditLogs = async (options: Partial<GetAuditLogsQueryInput> = {}) => {
  const page = options.page ?? 1;
  const limit = options.limit ?? 10;
  const skip = (page - 1) * limit;

  const whereClause: Prisma.AuditLogWhereInput = {
    ...(options.entityType ? { entityType: options.entityType } : {}),
    ...(options.action ? { action: options.action } : {}),
    ...(options.from || options.to
      ? {
          createdAt: {
            ...(options.from ? { gte: new Date(options.from) } : {}),
            ...(options.to ? { lte: new Date(options.to) } : {}),
          },
        }
      : {}),
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

  return buildPaginatedResponse(result, total, page, limit);
};

export const getServiceRequests = async (
  options: Partial<GetServiceRequestsQueryInput> = {}
) => {
  const page = options.page ?? 1;
  const limit = options.limit ?? 10;
  const skip = (page - 1) * limit;
  const sortBy = options.sortBy ?? 'createdAt';
  const sortOrder = options.sortOrder ?? 'desc';

  const whereClause: Prisma.ServiceRequestWhereInput = {
    ...(options.status ? { status: options.status } : {}),
    ...(options.priority ? { priority: options.priority } : {}),
    ...(options.from || options.to
      ? {
          createdAt: {
            ...(options.from ? { gte: new Date(options.from) } : {}),
            ...(options.to ? { lte: new Date(options.to) } : {}),
          },
        }
      : {}),
    ...(options.search && options.search.trim()
      ? {
          OR: [
            { customer: { name: { contains: options.search.trim(), mode: 'insensitive' } } },
            { mechanic: { name: { contains: options.search.trim(), mode: 'insensitive' } } },
            { vehicle: { plateNumber: { contains: options.search.trim(), mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [total, rawRequests] = await Promise.all([
    prisma.serviceRequest.count({ where: whereClause }),
    prisma.serviceRequest.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      select: {
        id: true,
        status: true,
        priority: true,
        createdAt: true,
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
        mechanic: {
          select: {
            id: true,
            name: true,
          },
        },
        vehicle: {
          select: {
            make: true,
            model: true,
            plateNumber: true,
          },
        },
      },
    }),
  ]);

  const items = rawRequests.map((r) => ({
    id: r.id,
    status: r.status,
    priority: r.priority,
    createdAt: r.createdAt,
    customer: {
      id: r.customer.id,
      name: r.customer.name,
    },
    mechanic: r.mechanic
      ? {
          id: r.mechanic.id,
          name: r.mechanic.name,
        }
      : null,
    vehicle: r.vehicle
      ? {
          make: r.vehicle.make,
          model: r.vehicle.model,
          plateNumber: r.vehicle.plateNumber,
        }
      : null,
  }));

  return buildPaginatedResponse(items, total, page, limit);
};

export const getPayments = async (
  options: Partial<GetPaymentsQueryInput> = {}
) => {
  const page = options.page ?? 1;
  const limit = options.limit ?? 10;
  const skip = (page - 1) * limit;
  const sortBy = options.sortBy ?? 'createdAt';
  const sortOrder = options.sortOrder ?? 'desc';

  const whereClause: Prisma.PaymentWhereInput = {
    ...(options.status ? { status: options.status } : {}),
    ...(options.from || options.to
      ? {
          createdAt: {
            ...(options.from ? { gte: new Date(options.from) } : {}),
            ...(options.to ? { lte: new Date(options.to) } : {}),
          },
        }
      : {}),
  };

  const [total, rawPayments] = await Promise.all([
    prisma.payment.count({ where: whereClause }),
    prisma.payment.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      select: {
        id: true,
        amount: true,
        status: true,
        paidAt: true,
        createdAt: true,
        invoice: {
          select: {
            id: true,
            totalAmount: true,
            serviceRequest: {
              select: {
                id: true,
                customer: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  const items = rawPayments.map((p) => ({
    id: p.id,
    amount: p.amount,
    status: p.status,
    paidAt: p.paidAt,
    createdAt: p.createdAt,
    invoice: {
      id: p.invoice.id,
      total: p.invoice.totalAmount,
    },
    serviceRequest: {
      id: p.invoice.serviceRequest.id,
    },
    customer: {
      name: p.invoice.serviceRequest.customer.name,
    },
  }));

  return buildPaginatedResponse(items, total, page, limit);
};

export const getInsights = async () => {
  const now = new Date();
  const last14DaysStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const previous14DaysStart = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
  const hours24Ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const hours48Ago = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  // 1. Requests metrics
  const [
    reqLast14,
    reqPrev14,
    completedLast14,
    cancelledLast14,
  ] = await Promise.all([
    prisma.serviceRequest.count({
      where: { createdAt: { gte: last14DaysStart, lte: now } },
    }),
    prisma.serviceRequest.count({
      where: { createdAt: { gte: previous14DaysStart, lt: last14DaysStart } },
    }),
    prisma.serviceRequest.count({
      where: {
        createdAt: { gte: last14DaysStart, lte: now },
        status: RequestStatus.COMPLETED,
      },
    }),
    prisma.serviceRequest.count({
      where: {
        createdAt: { gte: last14DaysStart, lte: now },
        status: RequestStatus.CANCELLED,
      },
    }),
  ]);

  const changePct =
    reqPrev14 === 0
      ? reqLast14 > 0
        ? 100
        : 0
      : Number((((reqLast14 - reqPrev14) / reqPrev14) * 100).toFixed(2));

  const completionRate =
    reqLast14 === 0 ? 0 : Number((completedLast14 / reqLast14).toFixed(2));
  const cancellationRate =
    reqLast14 === 0 ? 0 : Number((cancelledLast14 / reqLast14).toFixed(2));

  // 2. Revenue metrics from PAID payments
  const [revLast14Aggregate, revPrev14Aggregate] = await Promise.all([
    prisma.payment.aggregate({
      where: {
        status: PaymentStatus.COMPLETED,
        createdAt: { gte: last14DaysStart, lte: now },
      },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: {
        status: PaymentStatus.COMPLETED,
        createdAt: { gte: previous14DaysStart, lt: last14DaysStart },
      },
      _sum: { amount: true },
    }),
  ]);

  const revenueLast14 = (
    revLast14Aggregate._sum.amount ? Number(revLast14Aggregate._sum.amount) : 0
  ).toFixed(2);
  const revenuePrev14 = (
    revPrev14Aggregate._sum.amount ? Number(revPrev14Aggregate._sum.amount) : 0
  ).toFixed(2);

  // 3. Rating metrics
  const [ratLast14Aggregate, ratPrev14Aggregate] = await Promise.all([
    prisma.review.aggregate({
      where: { createdAt: { gte: last14DaysStart, lte: now } },
      _avg: { rating: true },
    }),
    prisma.review.aggregate({
      where: { createdAt: { gte: previous14DaysStart, lt: last14DaysStart } },
      _avg: { rating: true },
    }),
  ]);

  const ratingLast14 =
    ratLast14Aggregate._avg.rating !== null
      ? Number(ratLast14Aggregate._avg.rating.toFixed(2))
      : null;
  const ratingPrev14 =
    ratPrev14Aggregate._avg.rating !== null
      ? Number(ratPrev14Aggregate._avg.rating.toFixed(2))
      : null;

  // 4. Daily requests & anomalies (30 days zero-filled)
  const rawDailyRequests = await prisma.$queryRaw<
    Array<{
      date: string;
      count: number | bigint;
    }>
  >`
    WITH days AS (
      SELECT to_char(d, 'YYYY-MM-DD') AS date,
             d::date AS day_start
      FROM generate_series(
        CURRENT_DATE - INTERVAL '29 days',
        CURRENT_DATE,
        INTERVAL '1 day'
      ) AS d
    )
    SELECT 
      days.date,
      COUNT(sr.id)::int AS count
    FROM days
    LEFT JOIN "ServiceRequest" sr ON to_char(sr."createdAt", 'YYYY-MM-DD') = days.date
    GROUP BY days.date, days.day_start
    ORDER BY days.day_start ASC;
  `;

  const dailyRequests = rawDailyRequests.map((r) => ({
    date: r.date,
    count: Number(r.count),
  }));

  const n = dailyRequests.length;
  const sumCounts = dailyRequests.reduce((acc, d) => acc + d.count, 0);
  const mean = n > 0 ? sumCounts / n : 0;
  const variance =
    n > 0
      ? dailyRequests.reduce((acc, d) => acc + Math.pow(d.count - mean, 2), 0) / n
      : 0;
  const stdDev = Math.sqrt(variance);

  const anomalies: Array<{ date: string; count: number; zScore: number }> = [];
  if (stdDev > 0) {
    for (const d of dailyRequests) {
      if (d.count >= 3) {
        const z = (d.count - mean) / stdDev;
        if (z >= 2) {
          anomalies.push({
            date: d.date,
            count: d.count,
            zScore: Number(z.toFixed(2)),
          });
        }
      }
    }
  }

  // 5. Stuck requests
  const [
    assignedCount,
    assignedOldest,
    openCount,
    openOldest,
    inProgressCount,
    inProgressOldest,
  ] = await Promise.all([
    prisma.serviceRequest.count({
      where: {
        status: RequestStatus.ASSIGNED,
        updatedAt: { lte: hours24Ago },
      },
    }),
    prisma.serviceRequest.findFirst({
      where: {
        status: RequestStatus.ASSIGNED,
        updatedAt: { lte: hours24Ago },
      },
      orderBy: { updatedAt: 'asc' },
      select: { updatedAt: true },
    }),
    prisma.serviceRequest.count({
      where: {
        status: { in: [RequestStatus.PENDING, RequestStatus.SEARCHING] },
        updatedAt: { lte: hours24Ago },
      },
    }),
    prisma.serviceRequest.findFirst({
      where: {
        status: { in: [RequestStatus.PENDING, RequestStatus.SEARCHING] },
        updatedAt: { lte: hours24Ago },
      },
      orderBy: { updatedAt: 'asc' },
      select: { updatedAt: true },
    }),
    prisma.serviceRequest.count({
      where: {
        status: RequestStatus.IN_PROGRESS,
        updatedAt: { lte: hours48Ago },
      },
    }),
    prisma.serviceRequest.findFirst({
      where: {
        status: RequestStatus.IN_PROGRESS,
        updatedAt: { lte: hours48Ago },
      },
      orderBy: { updatedAt: 'asc' },
      select: { updatedAt: true },
    }),
  ]);

  // 6. Unpaid invoices for COMPLETED requests
  const unpaidInvoicesList = await prisma.invoice.findMany({
    where: {
      serviceRequest: { status: RequestStatus.COMPLETED },
      status: { not: InvoiceStatus.PAID },
    },
    select: { totalAmount: true },
  });

  const unpaidCount = unpaidInvoicesList.length;
  const unpaidTotalAmount = unpaidInvoicesList
    .reduce((sum, inv) => sum + Number(inv.totalAmount), 0)
    .toFixed(2);

  // 7. Mechanics
  const [
    availableMechanics,
    busyMechanics,
    offlineMechanics,
    topByCompleted30dRaw,
    lowRatedRaw,
  ] = await Promise.all([
    prisma.mechanicProfile.count({
      where: {
        availability: Availability.AVAILABLE,
        user: { deletedAt: null },
      },
    }),
    prisma.mechanicProfile.count({
      where: {
        availability: Availability.BUSY,
        user: { deletedAt: null },
      },
    }),
    prisma.mechanicProfile.count({
      where: {
        availability: Availability.OFFLINE,
        user: { deletedAt: null },
      },
    }),
    prisma.$queryRaw<Array<{ name: string; completed: number | bigint }>>`
      SELECT 
        u.name,
        COUNT(sr.id)::int AS completed
      FROM "ServiceRequest" sr
      JOIN "User" u ON u.id = sr."mechanicId"
      WHERE sr.status = 'COMPLETED'
        AND sr."createdAt" >= NOW() - INTERVAL '30 days'
        AND u."deletedAt" IS NULL
      GROUP BY u.id, u.name
      ORDER BY completed DESC
      LIMIT 3;
    `,
    prisma.$queryRaw<
      Array<{
        name: string;
        averageRating: number | string;
        reviewCount: number | bigint;
      }>
    >`
      SELECT 
        u.name,
        ROUND(AVG(r.rating)::numeric, 2)::float AS "averageRating",
        COUNT(r.id)::int AS "reviewCount"
      FROM "Review" r
      JOIN "ServiceRequest" sr ON sr.id = r."serviceRequestId"
      JOIN "User" u ON u.id = sr."mechanicId"
      WHERE u."deletedAt" IS NULL
      GROUP BY u.id, u.name
      HAVING COUNT(r.id) >= 3 AND AVG(r.rating) < 3.5
      ORDER BY "averageRating" ASC;
    `,
  ]);

  const topByCompleted30d = topByCompleted30dRaw.map((m) => ({
    name: m.name,
    completed: Number(m.completed),
  }));

  const lowRated = lowRatedRaw.map((m) => ({
    name: m.name,
    averageRating: Number(m.averageRating),
    reviewCount: Number(m.reviewCount),
  }));

  // 8. Open requests by priority
  const openRequestsByPriority = await prisma.serviceRequest.groupBy({
    by: ['priority'],
    where: {
      status: { notIn: [RequestStatus.COMPLETED, RequestStatus.CANCELLED] },
    },
    _count: { priority: true },
  });

  const openByPriority = Object.values(RequestPriority).reduce(
    (acc, priority) => {
      const found = openRequestsByPriority.find((item) => item.priority === priority);
      acc[priority] = found ? found._count.priority : 0;
      return acc;
    },
    {} as Record<RequestPriority, number>
  );

  // 9. Low stock items
  const lowStockItems = await prisma.mechanicInventory.count({
    where: { stock: { lte: LOW_STOCK_THRESHOLD } },
  });

  return {
    generatedAt: now.toISOString(),
    requests: {
      last14Days: reqLast14,
      previous14Days: reqPrev14,
      changePct,
      completionRate,
      cancellationRate,
    },
    revenue: {
      last14Days: revenueLast14,
      previous14Days: revenuePrev14,
    },
    rating: {
      last14Days: ratingLast14,
      previous14Days: ratingPrev14,
    },
    dailyRequests,
    anomalies,
    stuck: {
      assignedOver24h: {
        count: assignedCount,
        oldestAt: assignedOldest?.updatedAt ? assignedOldest.updatedAt.toISOString() : null,
      },
      openOver24h: {
        count: openCount,
        oldestAt: openOldest?.updatedAt ? openOldest.updatedAt.toISOString() : null,
      },
      inProgressOver48h: {
        count: inProgressCount,
        oldestAt: inProgressOldest?.updatedAt ? inProgressOldest.updatedAt.toISOString() : null,
      },
    },
    unpaidInvoices: {
      count: unpaidCount,
      totalAmount: unpaidTotalAmount,
    },
    mechanics: {
      available: availableMechanics,
      busy: busyMechanics,
      offline: offlineMechanics,
      topByCompleted30d,
      lowRated,
    },
    openByPriority,
    lowStockItems,
  };
};

export const AdminService = {
  getAllUsers,
  updateUserRole,
  deactivateUser,
  reactivateUser,
  getDashboardStats,
  getInsights,
  getAuditLogs,
  getServiceRequests,
  getPayments,
};
