import { RequestStatus, Availability } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { CreateServiceRequestInput } from './service-request.validation.js';

export interface NearbyMechanic {
  id: string;
  name: string;
  skills: string[];
  rating: number;
  distance: number;
}

/**
 * Creates a new service request for a customer.
 * If vehicleId is provided, validates ownership and non-deleted status (returns 404 if invalid).
 */
export const createServiceRequest = async (
  customerId: string,
  data: CreateServiceRequestInput
) => {
  if (data.vehicleId) {
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: data.vehicleId,
        customerId,
        deletedAt: null,
      },
    });

    if (!vehicle) {
      const err = new Error('Vehicle not found') as Error & { statusCode: number };
      err.statusCode = 404;
      throw err;
    }
  }

  const serviceRequest = await prisma.serviceRequest.create({
    data: {
      customerId,
      description: data.description,
      lat: data.lat,
      lng: data.lng,
      vehicleId: data.vehicleId || null,
      priority: data.priority,
      status: RequestStatus.PENDING,
    },
  });

  return serviceRequest;
};

/**
 * Finds available mechanics near the specified coordinates within radiusKm.
 * Uses Haversine formula via raw SQL for high performance.
 * Does not expose mechanics' exact lat/lng for privacy.
 */
export const findNearbyMechanics = async (
  lat: number,
  lng: number,
  radiusKm: number
): Promise<NearbyMechanic[]> => {
  const mechanics = await prisma.$queryRaw<NearbyMechanic[]>`
    SELECT 
      mp."id" AS id,
      u."name" AS name,
      mp."skills" AS skills,
      mp."rating" AS rating,
      (
        6371 * 2 * ASIN(
          SQRT(
            POWER(SIN(RADIANS((${lat} - mp."currentLat") / 2)), 2) +
            COS(RADIANS(${lat})) * COS(RADIANS(mp."currentLat")) *
            POWER(SIN(RADIANS((${lng} - mp."currentLng") / 2)), 2)
          )
        )
      ) AS distance
    FROM "MechanicProfile" mp
    JOIN "User" u ON mp."userId" = u."id"
    WHERE mp."availability"::text = 'AVAILABLE'
      AND mp."currentLat" IS NOT NULL
      AND mp."currentLng" IS NOT NULL
      AND (
        6371 * 2 * ASIN(
          SQRT(
            POWER(SIN(RADIANS((${lat} - mp."currentLat") / 2)), 2) +
            COS(RADIANS(${lat})) * COS(RADIANS(mp."currentLat")) *
            POWER(SIN(RADIANS((${lng} - mp."currentLng") / 2)), 2)
          )
        )
      ) <= ${radiusKm}
    ORDER BY distance ASC
  `;

  return mechanics.map((m) => ({
    id: m.id,
    name: m.name,
    skills: m.skills,
    rating: Number(m.rating),
    distance: Number(m.distance),
  }));
};

/**
 * Assigns a specific mechanic to a PENDING service request in a transaction-safe manner.
 * Uses pessimistic row locking (FOR UPDATE) to prevent race conditions.
 */
export const assignMechanic = async (
  serviceRequestId: string,
  customerId: string,
  targetMechanicId: string
) => {
  return await prisma.$transaction(async (tx) => {
    // Row-level lock on ServiceRequest to prevent race conditions
    const requests = await tx.$queryRaw<
      Array<{ id: string; status: string; customerId: string }>
    >`
      SELECT "id", "status"::text AS "status", "customerId"
      FROM "ServiceRequest"
      WHERE "id" = ${serviceRequestId}
      FOR UPDATE
    `;

    const request = requests[0];
    if (!request || request.customerId !== customerId) {
      const err = new Error('Service request not found') as Error & { statusCode: number };
      err.statusCode = 404;
      throw err;
    }

    if (request.status !== RequestStatus.PENDING) {
      const err = new Error('Service request is no longer pending assignment') as Error & {
        statusCode: number;
      };
      err.statusCode = 409;
      throw err;
    }

    // Target mechanic can be specified by MechanicProfile ID or User ID
    const mechanicProfile = await tx.mechanicProfile.findFirst({
      where: {
        OR: [{ id: targetMechanicId }, { userId: targetMechanicId }],
      },
      include: { user: true },
    });

    if (!mechanicProfile || mechanicProfile.user.role !== 'MECHANIC') {
      const err = new Error('Mechanic not found') as Error & { statusCode: number };
      err.statusCode = 404;
      throw err;
    }

    if (mechanicProfile.availability !== Availability.AVAILABLE) {
      const err = new Error('Selected mechanic is not currently available') as Error & {
        statusCode: number;
      };
      err.statusCode = 409;
      throw err;
    }

    // Check if mechanic already has a pending invitation (ASSIGNED) or active assignment
    const existingActiveRequest = await tx.serviceRequest.findFirst({
      where: {
        mechanicId: mechanicProfile.userId,
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

    if (existingActiveRequest) {
      const err = new Error(
        'Mechanic already has a pending invitation or active assignment'
      ) as Error & { statusCode: number };
      err.statusCode = 409;
      throw err;
    }

    const updatedRequest = await tx.serviceRequest.update({
      where: { id: serviceRequestId },
      data: {
        mechanicId: mechanicProfile.userId,
        status: RequestStatus.ASSIGNED,
      },
    });

    return updatedRequest;
  });
};

/**
 * Allows the assigned mechanic to accept a service request.
 * Sets request status to EN_ROUTE and mechanic profile availability to BUSY atomically.
 */
export const acceptAssignment = async (
  serviceRequestId: string,
  mechanicUserId: string
) => {
  return await prisma.$transaction(async (tx) => {
    // Row-level lock on ServiceRequest to prevent double-acceptance or race conditions
    const requests = await tx.$queryRaw<
      Array<{ id: string; status: string; mechanicId: string | null }>
    >`
      SELECT "id", "status"::text AS "status", "mechanicId"
      FROM "ServiceRequest"
      WHERE "id" = ${serviceRequestId}
      FOR UPDATE
    `;

    const request = requests[0];
    if (!request) {
      const err = new Error('Service request not found') as Error & { statusCode: number };
      err.statusCode = 404;
      throw err;
    }

    if (request.mechanicId !== mechanicUserId) {
      const err = new Error('You are not assigned to this service request') as Error & {
        statusCode: number;
      };
      err.statusCode = 409;
      throw err;
    }

    if (request.status !== RequestStatus.ASSIGNED) {
      const err = new Error(
        `Service request cannot be accepted in current status (${request.status})`
      ) as Error & { statusCode: number };
      err.statusCode = 409;
      throw err;
    }

    // Re-verify mechanic availability inside transaction before accepting
    const mechanicProfile = await tx.mechanicProfile.findUnique({
      where: { userId: mechanicUserId },
    });

    if (!mechanicProfile || mechanicProfile.availability !== Availability.AVAILABLE) {
      const err = new Error(
        'Mechanic is no longer available or is currently busy on another job'
      ) as Error & { statusCode: number };
      err.statusCode = 409;
      throw err;
    }

    // Update ServiceRequest status to EN_ROUTE
    const updatedRequest = await tx.serviceRequest.update({
      where: { id: serviceRequestId },
      data: {
        status: RequestStatus.EN_ROUTE,
      },
    });

    // Update MechanicProfile availability to BUSY
    await tx.mechanicProfile.update({
      where: { userId: mechanicUserId },
      data: {
        availability: Availability.BUSY,
      },
    });

    return updatedRequest;
  });
};

/**
 * Retrieves paginated service requests created by the specified customer.
 */
export const getMyServiceRequests = async (
  customerId: string,
  page: number = 1,
  limit: number = 10
) => {
  const skip = (page - 1) * limit;

  const [total, serviceRequests] = await Promise.all([
    prisma.serviceRequest.count({ where: { customerId } }),
    prisma.serviceRequest.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        vehicle: true,
        mechanic: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
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
    serviceRequests,
  };
};

/**
 * Retrieves paginated service requests assigned to the specified mechanic.
 */
export const getAssignedServiceRequests = async (
  mechanicUserId: string,
  page: number = 1,
  limit: number = 10
) => {
  const skip = (page - 1) * limit;

  const [total, serviceRequests] = await Promise.all([
    prisma.serviceRequest.count({ where: { mechanicId: mechanicUserId } }),
    prisma.serviceRequest.findMany({
      where: { mechanicId: mechanicUserId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        vehicle: true,
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
    serviceRequests,
  };
};

export const ServiceRequestService = {
  createServiceRequest,
  findNearbyMechanics,
  assignMechanic,
  acceptAssignment,
  getMyServiceRequests,
  getAssignedServiceRequests,
};
