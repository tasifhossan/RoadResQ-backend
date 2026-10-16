import { Availability, Prisma, RequestStatus, Role } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { buildPaginatedResponse } from '../../utils/pagination.js';
import {
  GetPublicMechanicsQueryInput,
  GetPublicReviewsQueryInput,
  MECHANIC_SKILLS,
} from './public.validation.js';

/**
 * Formats a user's full name into first name plus last initial.
 * Example: "Mohammad Rafiqul Islam" -> "Mohammad I.", "Alice" -> "Alice"
 */
export const formatReviewerName = (fullName: string | null | undefined): string => {
  if (!fullName) return 'Anonymous';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0];
  }
  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${firstName} ${lastInitial}.`;
};

/**
 * Truncates a bio string to at most 160 characters.
 */
export const truncateBio = (bio: string | null | undefined): string | null => {
  if (!bio) return null;
  if (bio.length <= 160) return bio;
  return bio.substring(0, 160);
};

export interface PublicMechanicListItem {
  id: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  city: string | null;
  skills: string[];
  rating: number;
  totalJobs: number;
  yearsExperience: number | null;
  availability: Availability;
}

/**
 * Retrieves public mechanics list with search, filter, sorting, and aggregate facets.
 * Excludes all sensitive data (passwords, tokens, email, phone, exact coordinates).
 */
export const getPublicMechanics = async (options: GetPublicMechanicsQueryInput) => {
  const page = options.page ?? 1;
  const limit = options.limit ?? 12;
  const skip = (page - 1) * limit;
  const sortBy = options.sortBy ?? 'rating';
  const sortOrder = options.sortOrder ?? 'desc';

  const baseWhere: Prisma.MechanicProfileWhereInput = {
    user: {
      role: Role.MECHANIC,
      deletedAt: null,
    },
    ...(options.availability ? { availability: options.availability } : {}),
    ...(options.minRating !== undefined ? { rating: { gte: options.minRating } } : {}),
    ...(options.minJobs !== undefined ? { totalJobs: { gte: options.minJobs } } : {}),
    ...(options.skill ? { skills: { has: options.skill } } : {}),
  };

  if (options.search) {
    const term = options.search.trim();
    const matchingSkills = MECHANIC_SKILLS.filter((s) =>
      s.toLowerCase().includes(term.toLowerCase())
    );

    baseWhere.OR = [
      { user: { name: { contains: term, mode: 'insensitive' } } },
      { city: { contains: term, mode: 'insensitive' } },
      ...(matchingSkills.length > 0
        ? [{ skills: { hasSome: matchingSkills } }]
        : [{ skills: { has: term } }]),
    ];
  }

  let orderBy: Prisma.MechanicProfileOrderByWithRelationInput;
  if (sortBy === 'newest') {
    orderBy = { user: { createdAt: sortOrder } };
  } else if (sortBy === 'yearsExperience') {
    orderBy = { yearsExperience: sortOrder };
  } else if (sortBy === 'totalJobs') {
    orderBy = { totalJobs: sortOrder };
  } else {
    orderBy = { rating: sortOrder };
  }

  const [total, profiles, allActiveProfiles] = await Promise.all([
    prisma.mechanicProfile.count({ where: baseWhere }),
    prisma.mechanicProfile.findMany({
      where: baseWhere,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            createdAt: true,
          },
        },
      },
      skip,
      take: limit,
      orderBy,
    }),
    prisma.mechanicProfile.findMany({
      where: {
        user: {
          role: Role.MECHANIC,
          deletedAt: null,
        },
      },
      select: {
        skills: true,
        city: true,
      },
    }),
  ]);

  const items: PublicMechanicListItem[] = profiles.map((p) => ({
    id: p.user.id,
    name: p.user.name,
    avatarUrl: p.avatarUrl,
    bio: truncateBio(p.bio),
    city: p.city,
    skills: p.skills,
    rating: p.rating,
    totalJobs: p.totalJobs,
    yearsExperience: p.yearsExperience,
    availability: p.availability,
  }));

  const skillCounts: Record<string, number> = {};
  const cityCounts: Record<string, number> = {};

  for (const m of allActiveProfiles) {
    if (Array.isArray(m.skills)) {
      for (const skill of m.skills) {
        if (skill) {
          skillCounts[skill] = (skillCounts[skill] || 0) + 1;
        }
      }
    }
    if (m.city && m.city.trim()) {
      const city = m.city.trim();
      cityCounts[city] = (cityCounts[city] || 0) + 1;
    }
  }

  const skillsFacet = Object.entries(skillCounts)
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));

  const citiesFacet = Object.entries(cityCounts)
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));

  const paginated = buildPaginatedResponse(items, total, page, limit);

  return {
    ...paginated,
    facets: {
      skills: skillsFacet,
      cities: citiesFacet,
    },
  };
};

/**
 * Retrieves full public mechanic profile by id, rating summary, latest 10 reviews, and related mechanics.
 * Returns 404 for unknown, deleted, or non-mechanic ids.
 */
export const getPublicMechanicById = async (id: string) => {
  let user = await prisma.user.findFirst({
    where: {
      id,
      role: Role.MECHANIC,
      deletedAt: null,
    },
    include: {
      mechanicProfile: true,
    },
  });

  if (!user) {
    const profile = await prisma.mechanicProfile.findUnique({
      where: { id },
      include: {
        user: true,
      },
    });
    if (profile && profile.user.role === Role.MECHANIC && profile.user.deletedAt === null) {
      user = {
        ...profile.user,
        mechanicProfile: profile,
      };
    }
  }

  if (!user || !user.mechanicProfile) {
    const err = new Error('Mechanic not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  const mechanicUserId = user.id;
  const profile = user.mechanicProfile;

  const [allReviews, latestReviews] = await Promise.all([
    prisma.review.findMany({
      where: {
        serviceRequest: {
          mechanicId: mechanicUserId,
        },
      },
      select: {
        rating: true,
      },
    }),
    prisma.review.findMany({
      where: {
        serviceRequest: {
          mechanicId: mechanicUserId,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
      include: {
        customer: {
          select: {
            name: true,
          },
        },
      },
    }),
  ]);

  const count = allReviews.length;
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  for (const r of allReviews) {
    sum += r.rating;
    if (r.rating >= 1 && r.rating <= 5) {
      distribution[r.rating] = (distribution[r.rating] || 0) + 1;
    }
  }
  const average = count > 0 ? Number((sum / count).toFixed(2)) : profile.rating;

  const ratingSummary = {
    average,
    count,
    distribution,
  };

  const reviews = latestReviews.map((r) => ({
    rating: r.rating,
    comment: r.comment,
    createdAt: r.createdAt.toISOString(),
    reviewerName: formatReviewerName(r.customer?.name),
  }));

  let relatedProfiles: Array<any> = [];
  if (profile.skills && profile.skills.length > 0) {
    relatedProfiles = await prisma.mechanicProfile.findMany({
      where: {
        userId: { not: mechanicUserId },
        user: {
          role: Role.MECHANIC,
          deletedAt: null,
        },
        skills: {
          hasSome: profile.skills,
        },
      },
      take: 4,
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        rating: 'desc',
      },
    });
  }

  const related: PublicMechanicListItem[] = relatedProfiles.map((p) => ({
    id: p.user.id,
    name: p.user.name,
    avatarUrl: p.avatarUrl,
    bio: truncateBio(p.bio),
    city: p.city,
    skills: p.skills,
    rating: p.rating,
    totalJobs: p.totalJobs,
    yearsExperience: p.yearsExperience,
    availability: p.availability,
  }));

  return {
    id: user.id,
    name: user.name,
    avatarUrl: profile.avatarUrl,
    bio: profile.bio,
    city: profile.city,
    skills: profile.skills,
    rating: profile.rating,
    totalJobs: profile.totalJobs,
    yearsExperience: profile.yearsExperience,
    availability: profile.availability,
    memberSince: user.createdAt.toISOString(),
    ratingSummary,
    reviews,
    related,
  };
};

/**
 * Computes live aggregates from the database.
 * No hardcoded numbers.
 */
export const getPublicStats = async () => {
  const [
    completedJobs,
    totalRequests,
    totalMechanics,
    availableNow,
    totalCustomers,
    reviewCount,
    reviewAvg,
  ] = await Promise.all([
    prisma.serviceRequest.count({
      where: { status: RequestStatus.COMPLETED },
    }),
    prisma.serviceRequest.count(),
    prisma.user.count({
      where: { role: Role.MECHANIC, deletedAt: null },
    }),
    prisma.mechanicProfile.count({
      where: {
        availability: Availability.AVAILABLE,
        user: { role: Role.MECHANIC, deletedAt: null },
      },
    }),
    prisma.user.count({
      where: { role: Role.CUSTOMER, deletedAt: null },
    }),
    prisma.review.count(),
    prisma.review.aggregate({
      _avg: { rating: true },
    }),
  ]);

  const rawAvg = reviewAvg._avg.rating ?? 0;
  const averageRating = Number(rawAvg.toFixed(2));

  return {
    completedJobs,
    totalRequests,
    mechanics: {
      total: totalMechanics,
      availableNow,
    },
    customers: totalCustomers,
    reviews: {
      count: reviewCount,
      averageRating,
    },
  };
};

/**
 * Retrieves latest reviews with comment length >= 20 characters.
 */
export const getPublicReviews = async (options: GetPublicReviewsQueryInput) => {
  const limit = options.limit ?? 6;

  interface RawReviewRow {
    id: string;
    rating: number;
    comment: string;
    createdAt: Date;
    customerName: string;
    mechanicId: string;
    mechanicName: string;
  }

  const rows = await prisma.$queryRaw<RawReviewRow[]>`
    SELECT 
      r."id",
      r."rating",
      r."comment",
      r."createdAt",
      c."name" AS "customerName",
      m."id" AS "mechanicId",
      m."name" AS "mechanicName"
    FROM "Review" r
    JOIN "User" c ON r."customerId" = c."id"
    JOIN "ServiceRequest" sr ON r."serviceRequestId" = sr."id"
    JOIN "User" m ON sr."mechanicId" = m."id"
    WHERE r."comment" IS NOT NULL AND LENGTH(TRIM(r."comment")) >= 20
    ORDER BY r."createdAt" DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    rating: row.rating,
    comment: row.comment,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : new Date(row.createdAt).toISOString(),
    reviewerName: formatReviewerName(row.customerName),
    mechanic: {
      id: row.mechanicId,
      name: row.mechanicName,
    },
  }));
};

export const PublicService = {
  getPublicMechanics,
  getPublicMechanicById,
  getPublicStats,
  getPublicReviews,
};
