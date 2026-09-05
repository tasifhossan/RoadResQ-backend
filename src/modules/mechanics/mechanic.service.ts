import { Availability } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { UpdateLocationInput } from './mechanic.validation.js';

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

export const MechanicService = {
  updateAvailability,
  updateLocation,
};
