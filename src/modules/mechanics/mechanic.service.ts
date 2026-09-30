import { Availability, InvoiceStatus, RequestStatus, Prisma } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { UpdateLocationInput } from './mechanic.validation.js';

const formatMoney = (val: Prisma.Decimal | number | string | null | undefined): string => {
  if (val === null || val === undefined) return '0.00';
  const num = typeof val === 'number' ? val : parseFloat(val.toString());
  return isNaN(num) ? '0.00' : num.toFixed(2);
};

/**
 * Updates the availability status of the mechanic's profile.
 * Throws 404 if no MechanicProfile exists for the specified user.
 */
export const updateAvailability = async (userId: string, availability: Availability) => {
  const profile = await prisma.mechanicProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    const err = new Error('Mechanic profile not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  const updatedProfile = await prisma.mechanicProfile.update({
    where: { userId },
    data: { availability },
  });

  return updatedProfile;
};

/**
 * Updates current location (lat/lng) on MechanicProfile and logs a LocationUpdate record.
 * Uses a transaction to ensure atomicity.
 * Throws 404 if no MechanicProfile exists for the specified user.
 */
export const updateLocation = async (userId: string, data: UpdateLocationInput) => {
  const profile = await prisma.mechanicProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    const err = new Error('Mechanic profile not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  const [updatedProfile] = await prisma.$transaction([
    prisma.mechanicProfile.update({
      where: { userId },
      data: {
        currentLat: data.lat,
        currentLng: data.lng,
      },
    }),
    prisma.locationUpdate.create({
      data: {
        mechanicProfileId: profile.id,
        lat: data.lat,
        lng: data.lng,
      },
    }),
  ]);

  return updatedProfile;
};

/**
 * Retrieves the earnings summary for the authenticated mechanic.
 * Returns totals from paid invoices, pending amounts, job count, average rating, 6-month breakdown, and recent paid invoices.
 */
export const getEarningsSummary = async (userId: string) => {
  const profile = await prisma.mechanicProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    const err = new Error('Mechanic profile not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  // 1. Completed jobs count
  const completedJobsCount = await prisma.serviceRequest.count({
    where: {
      mechanicId: userId,
      status: RequestStatus.COMPLETED,
    },
  });

  // 2. Paid Invoices Totals (laborTotal, partsTotal, grandTotal)
  const paidInvoiceAgg = await prisma.invoice.aggregate({
    where: {
      status: InvoiceStatus.PAID,
      serviceRequest: {
        mechanicId: userId,
        status: RequestStatus.COMPLETED,
      },
    },
    _sum: {
      laborCost: true,
      partsCost: true,
      totalAmount: true,
    },
  });

  const totals = {
    laborTotal: formatMoney(paidInvoiceAgg._sum.laborCost),
    partsTotal: formatMoney(paidInvoiceAgg._sum.partsCost),
    grandTotal: formatMoney(paidInvoiceAgg._sum.totalAmount),
  };

  // 3. Pending Amount (COMPLETED jobs whose invoice is unpaid / PENDING)
  const pendingInvoiceAgg = await prisma.invoice.aggregate({
    where: {
      status: InvoiceStatus.PENDING,
      serviceRequest: {
        mechanicId: userId,
        status: RequestStatus.COMPLETED,
      },
    },
    _sum: {
      totalAmount: true,
    },
  });

  const pendingAmount = formatMoney(pendingInvoiceAgg._sum.totalAmount);

  // 4. Monthly breakdown for last 6 months (zero-filled)
  const rawMonthly = await prisma.$queryRaw<
    Array<{
      month: string;
      laborTotal: string | number;
      partsTotal: string | number;
      jobs: number | bigint;
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
      m.month,
      COALESCE(SUM(CASE WHEN sr."mechanicId" = ${userId} AND sr."status" = 'COMPLETED' THEN i."laborCost" ELSE 0 END), 0)::text AS "laborTotal",
      COALESCE(SUM(CASE WHEN sr."mechanicId" = ${userId} AND sr."status" = 'COMPLETED' THEN i."partsCost" ELSE 0 END), 0)::text AS "partsTotal",
      COUNT(DISTINCT CASE WHEN sr."mechanicId" = ${userId} AND sr."status" = 'COMPLETED' THEN sr.id ELSE NULL END)::int AS "jobs"
    FROM months m
    LEFT JOIN "Invoice" i ON to_char(date_trunc('month', i."createdAt"), 'YYYY-MM') = m.month AND i."status" = 'PAID'
    LEFT JOIN "ServiceRequest" sr ON i."serviceRequestId" = sr.id
    GROUP BY m.month, m.month_start
    ORDER BY m.month_start ASC;
  `;

  const monthly = rawMonthly.map((m) => ({
    month: m.month,
    laborTotal: formatMoney(m.laborTotal),
    partsTotal: formatMoney(m.partsTotal),
    jobs: Number(m.jobs),
  }));

  // 5. Recent paid invoices (last 10)
  const recentPaidInvoices = await prisma.invoice.findMany({
    where: {
      status: InvoiceStatus.PAID,
      serviceRequest: {
        mechanicId: userId,
        status: RequestStatus.COMPLETED,
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      payment: true,
    },
  });

  const recent = recentPaidInvoices.map((inv) => ({
    invoiceId: inv.id,
    serviceRequestId: inv.serviceRequestId,
    total: formatMoney(inv.totalAmount),
    paidAt: inv.payment?.paidAt || inv.updatedAt,
  }));

  return {
    totals,
    pendingAmount,
    completedJobs: completedJobsCount,
    averageRating: profile.rating,
    monthly,
    recent,
  };
};

export const MechanicService = {
  updateAvailability,
  updateLocation,
  getEarningsSummary,
};
