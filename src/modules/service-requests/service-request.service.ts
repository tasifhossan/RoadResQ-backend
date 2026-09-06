import { RequestStatus, Availability } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { CreateServiceRequestInput } from './service-request.validation.js';
import { generateInvoice } from '../invoices/invoice.service.js';

export interface NearbyMechanic {
  id: string;
  name: string;
  skills: string[];
  rating: number;
  distance: number;
}

const LEGAL_TRANSITIONS: Record<string, RequestStatus[]> = {
  [RequestStatus.EN_ROUTE]: [RequestStatus.ARRIVED, RequestStatus.CANCELLED],
  [RequestStatus.ARRIVED]: [RequestStatus.IN_PROGRESS, RequestStatus.CANCELLED],
  [RequestStatus.IN_PROGRESS]: [RequestStatus.COMPLETED, RequestStatus.CANCELLED],
  [RequestStatus.COMPLETED]: [],
  [RequestStatus.CANCELLED]: [],
};

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
 * Updates the service request status following strict state machine rules.
 * Handles mechanic availability, totalJobs increments, invoice generation, and AuditLog recording atomically.
 */
export const updateStatus = async (
  serviceRequestId: string,
  mechanicUserId: string,
  newStatus: RequestStatus,
  laborCost: number = 0
) => {
  return await prisma.$transaction(async (tx) => {
    // Row-level lock on ServiceRequest
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

    const currentStatus = request.status as RequestStatus;
    const allowedNextStatuses = LEGAL_TRANSITIONS[currentStatus] || [];

    if (!allowedNextStatuses.includes(newStatus)) {
      const err = new Error(
        `Cannot transition status from ${currentStatus} to ${newStatus}`
      ) as Error & { statusCode: number };
      err.statusCode = 400;
      throw err;
    }

    // Update status
    const updatedRequest = await tx.serviceRequest.update({
      where: { id: serviceRequestId },
      data: { status: newStatus },
    });

    // Handle side-effects on mechanic profile availability, job stats, and invoice generation
    let invoice;
    if (newStatus === RequestStatus.COMPLETED) {
      await tx.mechanicProfile.update({
        where: { userId: mechanicUserId },
        data: {
          availability: Availability.AVAILABLE,
          totalJobs: { increment: 1 },
        },
      });

      // Automatically generate invoice upon job completion
      invoice = await generateInvoice(serviceRequestId, laborCost, tx);
    } else if (
      newStatus === RequestStatus.CANCELLED &&
      ([RequestStatus.EN_ROUTE, RequestStatus.ARRIVED, RequestStatus.IN_PROGRESS] as RequestStatus[]).includes(
        currentStatus
      )
    ) {
      await tx.mechanicProfile.update({
        where: { userId: mechanicUserId },
        data: {
          availability: Availability.AVAILABLE,
        },
      });
    }

    // Log status transition to AuditLog
    await tx.auditLog.create({
      data: {
        actorId: mechanicUserId,
        action: 'STATUS_CHANGE',
        entityType: 'ServiceRequest',
        entityId: serviceRequestId,
        metadata: {
          from: currentStatus,
          to: newStatus,
        },
      },
    });

    return {
      serviceRequest: updatedRequest,
      ...(invoice ? { invoice } : {}),
    };
  });
};

/**
 * Logs spare parts used during a service request repair.
 * Only allowed when status is IN_PROGRESS. Atomic transaction ensures stock checks and price snapshotting.
 */
export const addPartsUsed = async (
  serviceRequestId: string,
  mechanicUserId: string,
  parts: Array<{ sparePartId: string; quantity: number }>
) => {
  return await prisma.$transaction(async (tx) => {
    const request = await tx.serviceRequest.findUnique({
      where: { id: serviceRequestId },
    });

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

    if (request.status !== RequestStatus.IN_PROGRESS) {
      const err = new Error(
        `Spare parts can only be added when request status is IN_PROGRESS (current status: ${request.status})`
      ) as Error & { statusCode: number };
      err.statusCode = 400;
      throw err;
    }

    const mechanicProfile = await tx.mechanicProfile.findUnique({
      where: { userId: mechanicUserId },
    });

    if (!mechanicProfile) {
      const err = new Error('Mechanic profile not found') as Error & { statusCode: number };
      err.statusCode = 404;
      throw err;
    }

    // Step 1: Pre-verify all spare parts exist in this mechanic's inventory and have sufficient stock
    const sparePartsToProcess = [];
    for (const item of parts) {
      const inventoryItem = await tx.mechanicInventory.findUnique({
        where: {
          mechanicProfileId_sparePartId: {
            mechanicProfileId: mechanicProfile.id,
            sparePartId: item.sparePartId,
          },
        },
        include: { sparePart: true },
      });

      if (!inventoryItem || inventoryItem.sparePart.deletedAt !== null) {
        const err = new Error(
          `Spare part is not in your inventory: ${item.sparePartId}`
        ) as Error & { statusCode: number };
        err.statusCode = 400;
        throw err;
      }

      if (inventoryItem.stock < item.quantity) {
        const err = new Error(
          `Insufficient stock for spare part '${inventoryItem.sparePart.name}'. Requested: ${item.quantity}, Available: ${inventoryItem.stock}`
        ) as Error & { statusCode: number };
        err.statusCode = 400;
        throw err;
      }

      sparePartsToProcess.push({ inventoryItem, quantity: item.quantity });
    }

    // Step 2: Decrement mechanic inventory stock and create ServiceRequestPart records with priceAtUse snapshot
    const createdParts = [];
    for (const item of sparePartsToProcess) {
      await tx.mechanicInventory.update({
        where: { id: item.inventoryItem.id },
        data: {
          stock: { decrement: item.quantity },
        },
      });

      const requestPart = await tx.serviceRequestPart.create({
        data: {
          serviceRequestId,
          sparePartId: item.inventoryItem.sparePartId,
          quantity: item.quantity,
          priceAtUse: item.inventoryItem.price,
        },
      });

      createdParts.push(requestPart);
    }

    return createdParts;
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

/**
 * Adds damage photos / images to a pending service request owned by customerId.
 * Verifies request existence and customer ownership (returns 404 on mismatch).
 * Verifies status is PENDING (returns 400 if not pending).
 */
export const addServiceRequestImages = async (
  serviceRequestId: string,
  customerId: string,
  uploadedFiles: Express.Multer.File[]
) => {
  const serviceRequest = await prisma.serviceRequest.findFirst({
    where: {
      id: serviceRequestId,
      customerId,
    },
  });

  if (!serviceRequest) {
    const err = new Error('Service request not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  if (serviceRequest.status !== RequestStatus.PENDING) {
    const err = new Error(
      'Damage photos can only be added while the service request is PENDING'
    ) as Error & { statusCode: number };
    err.statusCode = 400;
    throw err;
  }

  const imageData = uploadedFiles.map((file) => {
    const fileObj = file as unknown as Record<string, string>;
    const url = fileObj.path || fileObj.secure_url || fileObj.url || '';
    const publicId = fileObj.filename || fileObj.public_id || '';
    return {
      serviceRequestId,
      url,
      publicId,
    };
  });

  await prisma.serviceRequestImage.createMany({
    data: imageData,
  });

  const createdImages = await prisma.serviceRequestImage.findMany({
    where: { serviceRequestId },
    orderBy: { uploadedAt: 'asc' },
  });

  return createdImages;
};

/**
 * Retrieves images for a service request with ownership authorization.
 * Customer owner, assigned mechanic, or ADMIN can view images.
 * Throws 404 if request not found or unauthorized (existence-leak protection).
 */
export const getServiceRequestImages = async (
  serviceRequestId: string,
  requestingUserId: string,
  requestingRole: string
) => {
  const serviceRequest = await prisma.serviceRequest.findUnique({
    where: { id: serviceRequestId },
    include: {
      images: {
        orderBy: { uploadedAt: 'asc' },
      },
    },
  });

  if (!serviceRequest) {
    const err = new Error('Service request not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  const isCustomerOwner = serviceRequest.customerId === requestingUserId;
  const isAssignedMechanic = serviceRequest.mechanicId === requestingUserId;
  const isAdmin = requestingRole === 'ADMIN';

  if (!isCustomerOwner && !isAssignedMechanic && !isAdmin) {
    const err = new Error('Service request not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  return serviceRequest.images;
};

export const ServiceRequestService = {
  createServiceRequest,
  findNearbyMechanics,
  assignMechanic,
  acceptAssignment,
  updateStatus,
  addPartsUsed,
  getMyServiceRequests,
  getAssignedServiceRequests,
  addServiceRequestImages,
  getServiceRequestImages,
};

