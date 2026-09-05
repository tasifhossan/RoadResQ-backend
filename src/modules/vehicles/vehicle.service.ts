import { prisma } from '../../config/db.js';
import { CreateVehicleInput, UpdateVehicleInput } from './vehicle.validation.js';

/**
 * Creates a new vehicle record owned by the specified customer.
 */
export const createVehicle = async (ownerId: string, data: CreateVehicleInput) => {
  const vehicle = await prisma.vehicle.create({
    data: {
      customerId: ownerId,
      make: data.make,
      model: data.model,
      plateNumber: data.plateNumber,
    },
  });

  return vehicle;
};

/**
 * Retrieves all active (non-soft-deleted) vehicles owned by the specified customer.
 */
export const getMyVehicles = async (ownerId: string) => {
  const vehicles = await prisma.vehicle.findMany({
    where: {
      customerId: ownerId,
      deletedAt: null,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return vehicles;
};

/**
 * Retrieves a single active vehicle by ID for the specified customer.
 * Throws 404 if not found or if owned by another customer.
 */
export const getVehicleById = async (ownerId: string, vehicleId: string) => {
  const vehicle = await prisma.vehicle.findFirst({
    where: {
      id: vehicleId,
      customerId: ownerId,
      deletedAt: null,
    },
  });

  if (!vehicle) {
    const err = new Error('Vehicle not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  return vehicle;
};

/**
 * Updates an active vehicle owned by the specified customer.
 * Throws 404 if not found or if owned by another customer.
 */
export const updateVehicle = async (
  ownerId: string,
  vehicleId: string,
  data: UpdateVehicleInput
) => {
  // Ensure vehicle exists and belongs to ownerId
  await getVehicleById(ownerId, vehicleId);

  const updatedVehicle = await prisma.vehicle.update({
    where: { id: vehicleId },
    data,
  });

  return updatedVehicle;
};

/**
 * Soft-deletes a vehicle owned by the specified customer.
 * Sets deletedAt timestamp instead of removing row.
 * Throws 404 if not found or if owned by another customer.
 */
export const softDeleteVehicle = async (ownerId: string, vehicleId: string) => {
  // Ensure vehicle exists and belongs to ownerId
  await getVehicleById(ownerId, vehicleId);

  const deletedVehicle = await prisma.vehicle.update({
    where: { id: vehicleId },
    data: {
      deletedAt: new Date(),
    },
  });

  return deletedVehicle;
};

export const VehicleService = {
  createVehicle,
  getMyVehicles,
  getVehicleById,
  updateVehicle,
  softDeleteVehicle,
};
