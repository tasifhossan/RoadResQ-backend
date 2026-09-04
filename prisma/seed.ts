import { PrismaClient, Role, Availability } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clean existing data
  await prisma.auditLog.deleteMany();
  await prisma.review.deleteMany();
  await prisma.locationUpdate.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.serviceRequestPart.deleteMany();
  await prisma.sparePart.deleteMany();
  await prisma.serviceRequest.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.mechanicProfile.deleteMany();
  await prisma.user.deleteMany();

  // 1. Admin User
  const admin = await prisma.user.create({
    data: {
      name: 'System Admin',
      email: 'admin@roadresq.com',
      password: '$2b$10$hashedpasswordplaceholderforadmin',
      role: Role.ADMIN,
      phone: '+18005550199',
    },
  });

  console.log(`Created admin user: ${admin.email}`);

  // 2. Mechanic Users with MechanicProfiles
  const mechanic1 = await prisma.user.create({
    data: {
      name: 'Alex Miller',
      email: 'alex.mechanic@roadresq.com',
      password: '$2b$10$hashedpasswordplaceholderformechanic1',
      role: Role.MECHANIC,
      phone: '+18005550101',
      mechanicProfile: {
        create: {
          skills: ['Engine Repair', 'Brake Service', 'Tire Change'],
          currentLat: 40.7128,
          currentLng: -74.006,
          availability: Availability.AVAILABLE,
          rating: 4.8,
          totalJobs: 24,
        },
      },
    },
  });

  const mechanic2 = await prisma.user.create({
    data: {
      name: 'Sarah Connor',
      email: 'sarah.mechanic@roadresq.com',
      password: '$2b$10$hashedpasswordplaceholderformechanic2',
      role: Role.MECHANIC,
      phone: '+18005550102',
      mechanicProfile: {
        create: {
          skills: ['Battery Jumpstart', 'Electrical Diagnostics', 'Fuel Delivery'],
          currentLat: 40.7306,
          currentLng: -73.9352,
          availability: Availability.AVAILABLE,
          rating: 4.9,
          totalJobs: 42,
        },
      },
    },
  });

  const mechanic3 = await prisma.user.create({
    data: {
      name: 'David Vance',
      email: 'david.mechanic@roadresq.com',
      password: '$2b$10$hashedpasswordplaceholderformechanic3',
      role: Role.MECHANIC,
      phone: '+18005550103',
      mechanicProfile: {
        create: {
          skills: ['Transmission', 'Towing Assistance', 'Lockout Service'],
          currentLat: 40.6782,
          currentLng: -73.9442,
          availability: Availability.BUSY,
          rating: 4.6,
          totalJobs: 15,
        },
      },
    },
  });

  console.log('Created mechanic users:', mechanic1.email, mechanic2.email, mechanic3.email);

  // 3. Customer Users with Vehicles
  const customer1 = await prisma.user.create({
    data: {
      name: 'John Doe',
      email: 'john.doe@gmail.com',
      password: '$2b$10$hashedpasswordplaceholderforcustomer1',
      role: Role.CUSTOMER,
      phone: '+18005550201',
      vehicles: {
        create: {
          make: 'Toyota',
          model: 'Camry 2021',
          plateNumber: 'ABC-1234',
        },
      },
    },
  });

  const customer2 = await prisma.user.create({
    data: {
      name: 'Emily Watson',
      email: 'emily.watson@gmail.com',
      password: '$2b$10$hashedpasswordplaceholderforcustomer2',
      role: Role.CUSTOMER,
      phone: '+18005550202',
      vehicles: {
        create: {
          make: 'Honda',
          model: 'Civic 2019',
          plateNumber: 'XYZ-5678',
        },
      },
    },
  });

  console.log('Created customer users with vehicles:', customer1.email, customer2.email);

  // 4. Spare Parts
  const parts = await Promise.all([
    prisma.sparePart.create({
      data: { name: 'Heavy Duty 12V Battery', price: 120.00, stock: 15 },
    }),
    prisma.sparePart.create({
      data: { name: 'Brake Pad Set (Front)', price: 65.50, stock: 30 },
    }),
    prisma.sparePart.create({
      data: { name: 'Synthetic Engine Oil 5L', price: 45.00, stock: 50 },
    }),
    prisma.sparePart.create({
      data: { name: 'All-Season Tire 205/55R16', price: 95.00, stock: 20 },
    }),
    prisma.sparePart.create({
      data: { name: 'Serpentine Belt', price: 28.75, stock: 25 },
    }),
  ]);

  console.log(`Created ${parts.length} spare parts`);
  console.log('Database seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
