import { PrismaClient, Role, Availability, RequestStatus, RequestPriority, InvoiceStatus, PaymentStatus, Prisma } from '@prisma/client';
import { hashPassword } from '../src/utils/hashPassword.js';

const prisma = new PrismaClient();

async function main() {
  console.log('--- STARTING IDEMPOTENT DATABASE SEEDING ---');

  const demoPassword = process.env.DEMO_PASSWORD;
  if (!demoPassword) {
    throw new Error('DEMO_PASSWORD environment variable is required to run the seed script.');
  }

  const passwordHash = await hashPassword(demoPassword);

  // 1. Seed Admin User
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@roadresq-demo.com' },
    update: {
      name: 'Demo Admin',
      role: Role.ADMIN,
      phone: '+8801700000001',
    },
    create: {
      name: 'Demo Admin',
      email: 'admin@roadresq-demo.com',
      password: passwordHash,
      role: Role.ADMIN,
      phone: '+8801700000001',
    },
  });
  console.log(`✅ Admin user seeded: ${adminUser.email}`);

  // 2. Seed Customer User
  const customerUser = await prisma.user.upsert({
    where: { email: 'customer@roadresq-demo.com' },
    update: {
      name: 'Demo Customer',
      role: Role.CUSTOMER,
      phone: '+8801700000002',
    },
    create: {
      name: 'Demo Customer',
      email: 'customer@roadresq-demo.com',
      password: passwordHash,
      role: Role.CUSTOMER,
      phone: '+8801700000002',
    },
  });
  console.log(`✅ Customer user seeded: ${customerUser.email}`);

  // Seed Customer Vehicles
  const vehicle1 = await prisma.vehicle.findFirst({
    where: { customerId: customerUser.id, plateNumber: 'DHAKA-METRO-KA-112233' },
  });
  const v1 = vehicle1
    ? vehicle1
    : await prisma.vehicle.create({
        data: {
          customerId: customerUser.id,
          make: 'Toyota',
          model: 'Corolla 2022',
          plateNumber: 'DHAKA-METRO-KA-112233',
        },
      });

  const vehicle2 = await prisma.vehicle.findFirst({
    where: { customerId: customerUser.id, plateNumber: 'DHAKA-METRO-GA-445566' },
  });
  const v2 = vehicle2
    ? vehicle2
    : await prisma.vehicle.create({
        data: {
          customerId: customerUser.id,
          make: 'Honda',
          model: 'Civic 2021',
          plateNumber: 'DHAKA-METRO-GA-445566',
        },
      });
  console.log(`✅ Customer vehicles seeded: ${v1.make} ${v1.model} & ${v2.make} ${v2.model}`);

  // 3. Seed Mechanic User & Profile
  const mechanicUser = await prisma.user.upsert({
    where: { email: 'mechanic@roadresq-demo.com' },
    update: {
      name: 'Demo Mechanic',
      role: Role.MECHANIC,
      phone: '+8801700000003',
    },
    create: {
      name: 'Demo Mechanic',
      email: 'mechanic@roadresq-demo.com',
      password: passwordHash,
      role: Role.MECHANIC,
      phone: '+8801700000003',
    },
  });

  const mechanicProfile = await prisma.mechanicProfile.upsert({
    where: { userId: mechanicUser.id },
    update: {
      availability: Availability.AVAILABLE,
      currentLat: 23.8103,
      currentLng: 90.4125,
      skills: ['Engine Repair', 'Brake Service', 'Tire Change', 'Battery Jumpstart'],
    },
    create: {
      userId: mechanicUser.id,
      availability: Availability.AVAILABLE,
      currentLat: 23.8103,
      currentLng: 90.4125,
      skills: ['Engine Repair', 'Brake Service', 'Tire Change', 'Battery Jumpstart'],
      rating: 5.0,
      totalJobs: 2,
    },
  });
  console.log(`✅ Mechanic profile seeded: ${mechanicUser.email} (Dhaka: 23.8103, 90.4125)`);

  // 4. Seed Global Spare Parts Catalog
  const catalogPartsData = [
    { name: 'Heavy Duty 12V Battery' },
    { name: 'Brake Pad Set (Front)' },
    { name: 'Synthetic Engine Oil 5L' },
    { name: 'Spark Plug Set (4-Pack)' },
    { name: 'All-Season Tire 205/55R16' },
  ];

  const catalogParts: Record<string, any> = {};
  for (const partData of catalogPartsData) {
    let part = await prisma.sparePart.findFirst({
      where: { name: partData.name, isGlobal: true, deletedAt: null },
    });
    if (!part) {
      part = await prisma.sparePart.create({
        data: {
          name: partData.name,
          isGlobal: true,
          createdByMechanicId: null,
        },
      });
    }
    catalogParts[partData.name] = part;
  }
  console.log(`✅ Global spare parts catalog seeded: ${Object.keys(catalogParts).length} items`);

  // 5. Seed Mechanic Inventory (including low stock item stock <= 5)
  const inventoryItemsData = [
    { name: 'Heavy Duty 12V Battery', price: 120.0, stock: 3 }, // Low stock item (<= LOW_STOCK_THRESHOLD = 5)
    { name: 'Brake Pad Set (Front)', price: 65.0, stock: 15 },
    { name: 'Synthetic Engine Oil 5L', price: 45.0, stock: 25 },
    { name: 'Spark Plug Set (4-Pack)', price: 35.0, stock: 10 },
    { name: 'All-Season Tire 205/55R16', price: 95.0, stock: 8 },
  ];

  for (const item of inventoryItemsData) {
    const sparePart = catalogParts[item.name];
    if (sparePart) {
      await prisma.mechanicInventory.upsert({
        where: {
          mechanicProfileId_sparePartId: {
            mechanicProfileId: mechanicProfile.id,
            sparePartId: sparePart.id,
          },
        },
        update: {
          price: new Prisma.Decimal(item.price),
          stock: item.stock,
        },
        create: {
          mechanicProfileId: mechanicProfile.id,
          sparePartId: sparePart.id,
          price: new Prisma.Decimal(item.price),
          stock: item.stock,
        },
      });
    }
  }
  console.log(`✅ Mechanic inventory seeded (1 low-stock item with stock=3)`);

  // 6. Seed 5 Service Requests with dates spread over the last ~10 weeks
  const now = new Date();
  const date1 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);  // ~1 week ago
  const date2 = new Date(now.getTime() - 17 * 24 * 60 * 60 * 1000); // ~2.5 weeks ago
  const date3 = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000); // ~4.5 weeks ago
  const date4 = new Date(now.getTime() - 49 * 24 * 60 * 60 * 1000); // ~7 weeks ago
  const date5 = new Date(now.getTime() - 66 * 24 * 60 * 60 * 1000); // ~9.5 weeks ago

  // Service Request 1: PENDING
  const req1 = await prisma.serviceRequest.upsert({
    where: { id: 'demo-req-pending-001' },
    update: {
      status: RequestStatus.PENDING,
      priority: RequestPriority.NORMAL,
      createdAt: date1,
    },
    create: {
      id: 'demo-req-pending-001',
      customerId: customerUser.id,
      vehicleId: v1.id,
      description: 'Engine stalls unexpectedly during morning cold starts',
      lat: 23.8103,
      lng: 90.4125,
      status: RequestStatus.PENDING,
      priority: RequestPriority.NORMAL,
      createdAt: date1,
    },
  });

  // Service Request 2: ASSIGNED
  const req2 = await prisma.serviceRequest.upsert({
    where: { id: 'demo-req-assigned-002' },
    update: {
      status: RequestStatus.ASSIGNED,
      priority: RequestPriority.HIGH,
      createdAt: date2,
    },
    create: {
      id: 'demo-req-assigned-002',
      customerId: customerUser.id,
      mechanicId: mechanicUser.id,
      vehicleId: v2.id,
      description: 'Brake pedal feels soft and spongy, needs urgent inspection',
      lat: 23.8120,
      lng: 90.4140,
      status: RequestStatus.ASSIGNED,
      priority: RequestPriority.HIGH,
      createdAt: date2,
    },
  });

  // Service Request 3: IN_PROGRESS
  const req3 = await prisma.serviceRequest.upsert({
    where: { id: 'demo-req-inprogress-003' },
    update: {
      status: RequestStatus.IN_PROGRESS,
      priority: RequestPriority.EMERGENCY,
      createdAt: date3,
    },
    create: {
      id: 'demo-req-inprogress-003',
      customerId: customerUser.id,
      mechanicId: mechanicUser.id,
      vehicleId: v1.id,
      description: 'Flat tire on highway shoulder near Gulshan circle',
      lat: 23.7925,
      lng: 90.4078,
      status: RequestStatus.IN_PROGRESS,
      priority: RequestPriority.EMERGENCY,
      createdAt: date3,
    },
  });

  // Service Request 4: COMPLETED & PAID (with Invoice, Payment & Review)
  const req4 = await prisma.serviceRequest.upsert({
    where: { id: 'demo-req-completed-paid-004' },
    update: {
      status: RequestStatus.COMPLETED,
      priority: RequestPriority.NORMAL,
      createdAt: date4,
    },
    create: {
      id: 'demo-req-completed-paid-004',
      customerId: customerUser.id,
      mechanicId: mechanicUser.id,
      vehicleId: v1.id,
      description: 'Battery completely drained overnight, vehicle will not crank',
      lat: 23.8050,
      lng: 90.4150,
      status: RequestStatus.COMPLETED,
      priority: RequestPriority.NORMAL,
      createdAt: date4,
    },
  });

  // ServiceRequestPart for req4
  const batteryPart = catalogParts['Heavy Duty 12V Battery'];
  const existingPart4 = await prisma.serviceRequestPart.findFirst({
    where: { serviceRequestId: req4.id, sparePartId: batteryPart.id },
  });
  if (!existingPart4) {
    await prisma.serviceRequestPart.create({
      data: {
        serviceRequestId: req4.id,
        sparePartId: batteryPart.id,
        quantity: 1,
        priceAtUse: new Prisma.Decimal(120.0),
        createdAt: date4,
      },
    });
  }

  // Invoice for req4
  const inv4 = await prisma.invoice.upsert({
    where: { serviceRequestId: req4.id },
    update: {
      status: InvoiceStatus.PAID,
      createdAt: date4,
    },
    create: {
      id: 'demo-inv-completed-paid-004',
      serviceRequestId: req4.id,
      laborCost: new Prisma.Decimal(50.0),
      partsCost: new Prisma.Decimal(120.0),
      totalAmount: new Prisma.Decimal(170.0),
      status: InvoiceStatus.PAID,
      createdAt: date4,
    },
  });

  // Payment for inv4
  await prisma.payment.upsert({
    where: { invoiceId: inv4.id },
    update: {
      status: PaymentStatus.COMPLETED,
      paidAt: date4,
    },
    create: {
      id: 'demo-pay-completed-paid-004',
      invoiceId: inv4.id,
      gateway: 'SSLCOMMERZ',
      transactionId: 'SSL_DEMO_SEED_001',
      amount: new Prisma.Decimal(170.0),
      status: PaymentStatus.COMPLETED,
      paidAt: date4,
      createdAt: date4,
    },
  });

  // Review for req4
  await prisma.review.upsert({
    where: { serviceRequestId: req4.id },
    update: {
      rating: 5,
      comment: 'Super fast response and excellent battery replacement service!',
    },
    create: {
      id: 'demo-rev-completed-paid-004',
      serviceRequestId: req4.id,
      customerId: customerUser.id,
      rating: 5,
      comment: 'Super fast response and excellent battery replacement service!',
      createdAt: date4,
    },
  });

  // Service Request 5: COMPLETED & UNPAID (with Invoice)
  const req5 = await prisma.serviceRequest.upsert({
    where: { id: 'demo-req-completed-unpaid-005' },
    update: {
      status: RequestStatus.COMPLETED,
      priority: RequestPriority.HIGH,
      createdAt: date5,
    },
    create: {
      id: 'demo-req-completed-unpaid-005',
      customerId: customerUser.id,
      mechanicId: mechanicUser.id,
      vehicleId: v2.id,
      description: 'Engine overheating warning and squeaking brake noise',
      lat: 23.7750,
      lng: 90.3800,
      status: RequestStatus.COMPLETED,
      priority: RequestPriority.HIGH,
      createdAt: date5,
    },
  });

  // ServiceRequestParts for req5
  const brakePart = catalogParts['Brake Pad Set (Front)'];
  const oilPart = catalogParts['Synthetic Engine Oil 5L'];

  const existingPart5a = await prisma.serviceRequestPart.findFirst({
    where: { serviceRequestId: req5.id, sparePartId: brakePart.id },
  });
  if (!existingPart5a) {
    await prisma.serviceRequestPart.create({
      data: {
        serviceRequestId: req5.id,
        sparePartId: brakePart.id,
        quantity: 1,
        priceAtUse: new Prisma.Decimal(65.0),
        createdAt: date5,
      },
    });
  }

  const existingPart5b = await prisma.serviceRequestPart.findFirst({
    where: { serviceRequestId: req5.id, sparePartId: oilPart.id },
  });
  if (!existingPart5b) {
    await prisma.serviceRequestPart.create({
      data: {
        serviceRequestId: req5.id,
        sparePartId: oilPart.id,
        quantity: 1,
        priceAtUse: new Prisma.Decimal(45.0),
        createdAt: date5,
      },
    });
  }

  // Invoice for req5
  await prisma.invoice.upsert({
    where: { serviceRequestId: req5.id },
    update: {
      status: InvoiceStatus.PENDING,
      createdAt: date5,
    },
    create: {
      id: 'demo-inv-completed-unpaid-005',
      serviceRequestId: req5.id,
      laborCost: new Prisma.Decimal(60.0),
      partsCost: new Prisma.Decimal(110.0),
      totalAmount: new Prisma.Decimal(170.0),
      status: InvoiceStatus.PENDING,
      createdAt: date5,
    },
  });

  console.log(`✅ 5 Service Requests seeded across last 10 weeks (PENDING, ASSIGNED, IN_PROGRESS, 2x COMPLETED)`);

  // 7. Update Mechanic Rating and Job Counters
  const reviewStats = await prisma.review.aggregate({
    where: { serviceRequest: { mechanicId: mechanicUser.id } },
    _avg: { rating: true },
    _count: { rating: true },
  });

  const completedCount = await prisma.serviceRequest.count({
    where: { mechanicId: mechanicUser.id, status: RequestStatus.COMPLETED },
  });

  await prisma.mechanicProfile.update({
    where: { id: mechanicProfile.id },
    data: {
      rating: reviewStats._avg.rating || 5.0,
      totalJobs: completedCount,
    },
  });
  console.log(`✅ Recalculated mechanic profile metrics (rating: ${reviewStats._avg.rating || 5.0}, totalJobs: ${completedCount})`);

  // 8. Log Audit Entry for Database Seeding
  await prisma.auditLog.create({
    data: {
      actorId: adminUser.id,
      action: 'DATABASE_SEED',
      entityType: 'System',
      entityId: 'seed-task',
      metadata: {
        timestamp: new Date().toISOString(),
        demoAccounts: ['admin@roadresq-demo.com', 'customer@roadresq-demo.com', 'mechanic@roadresq-demo.com'],
      },
    },
  });
  console.log(`✅ Seed execution logged to AuditLog`);

  console.log('\n--- SEEDING COMPLETED SUCCESSFULLY ---');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
