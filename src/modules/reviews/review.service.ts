import { RequestStatus, Role } from '@prisma/client';
import { prisma } from '../../config/db.js';

export interface CreateReviewData {
  rating: number;
  comment?: string;
}

const createReview = async (
  serviceRequestId: string,
  customerId: string,
  data: CreateReviewData
) => {
  // 1. Verify service request ownership
  const serviceRequest = await prisma.serviceRequest.findUnique({
    where: { id: serviceRequestId },
  });

  if (!serviceRequest || serviceRequest.customerId !== customerId) {
    const err = new Error('Service request not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  // 2. Verify status is COMPLETED
  if (serviceRequest.status !== RequestStatus.COMPLETED) {
    const err = new Error(
      'Cannot review a service request that is not completed'
    ) as Error & { statusCode: number };
    err.statusCode = 400;
    throw err;
  }

  // 3. Verify a review doesn't already exist for this service request
  const existingReview = await prisma.review.findUnique({
    where: { serviceRequestId },
  });

  if (existingReview) {
    const err = new Error(
      'A review already exists for this service request'
    ) as Error & { statusCode: number };
    err.statusCode = 400;
    throw err;
  }

  // 4. Create review row & update mechanic profile rating
  try {
    const review = await prisma.review.create({
      data: {
        serviceRequestId,
        customerId,
        rating: data.rating,
        comment: data.comment || null,
      },
      include: {
        customer: {
          select: { id: true, name: true, email: true },
        },
        serviceRequest: {
          select: { id: true, description: true, status: true, mechanicId: true },
        },
      },
    });

    // Update mechanic rating if assigned
    if (serviceRequest.mechanicId) {
      const agg = await prisma.review.aggregate({
        where: {
          serviceRequest: {
            mechanicId: serviceRequest.mechanicId,
          },
        },
        _avg: {
          rating: true,
        },
      });

      const rawAvg = agg._avg.rating ?? 0;
      const newRating = Math.round(rawAvg * 10) / 10;

      await prisma.mechanicProfile.update({
        where: { userId: serviceRequest.mechanicId },
        data: { rating: newRating },
      });
    }

    return review;
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    ) {
      const error = new Error(
        'A review already exists for this service request'
      ) as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }
    throw err;
  }
};

const getMechanicReviews = async (
  mechanicUserId: string,
  page: number,
  limit: number
) => {
  const mechanic = await prisma.user.findFirst({
    where: {
      id: mechanicUserId,
      role: Role.MECHANIC,
      deletedAt: null,
    },
  });

  if (!mechanic) {
    const err = new Error('Mechanic not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  const skip = (page - 1) * limit;

  const [total, reviews] = await Promise.all([
    prisma.review.count({
      where: {
        serviceRequest: {
          mechanicId: mechanicUserId,
        },
      },
    }),
    prisma.review.findMany({
      where: {
        serviceRequest: {
          mechanicId: mechanicUserId,
        },
      },
      include: {
        customer: {
          select: { id: true, name: true, email: true },
        },
        serviceRequest: {
          select: { id: true, description: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    data: reviews,
  };
};

const getReviewByServiceRequest = async (
  serviceRequestId: string,
  requestingUserId: string,
  requestingRole: string
) => {
  const review = await prisma.review.findUnique({
    where: { serviceRequestId },
    include: {
      customer: {
        select: { id: true, name: true, email: true },
      },
      serviceRequest: {
        select: { id: true, customerId: true, mechanicId: true, description: true, status: true },
      },
    },
  });

  if (!review) {
    const err = new Error('Review not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  const isCustomer = review.customerId === requestingUserId;
  const isMechanic = review.serviceRequest.mechanicId === requestingUserId;
  const isAdmin = requestingRole === Role.ADMIN;

  if (!isCustomer && !isMechanic && !isAdmin) {
    const err = new Error('Review not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  return review;
};

export const ReviewService = {
  createReview,
  getMechanicReviews,
  getReviewByServiceRequest,
};
