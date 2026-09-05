import { RequestStatus } from '@prisma/client';
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

export const ServiceRequestService = {
  createServiceRequest,
  findNearbyMechanics,
};
