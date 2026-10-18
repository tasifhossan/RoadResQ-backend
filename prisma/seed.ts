import { PrismaClient, Role, Availability, RequestStatus, RequestPriority, InvoiceStatus, PaymentStatus, Prisma } from '@prisma/client';
import { hashPassword } from '../src/utils/hashPassword.js';

const prisma = new PrismaClient();

function stringHash(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

const REVIEW_COMMENTS_5_STAR = [
  'Rescued me near Mohakhali flyover within 20 minutes. Battery swapped and alternator checked properly.',
  'Rapid response on Dhaka-Mymensingh highway. Fixed the punctured tire and balanced it on the spot.',
  'Outstanding towing service during heavy rain in Dhanmondi. Handled my low sedan with great care.',
  'Key got locked inside my car near Gulshan 2. He unlocked the driver door in minutes without a scratch.',
  'Engine overheated near airport road. Quickly diagnosed the broken radiator hose and topped up coolant.',
  'Emergency fuel delivery arrived fast near Banani. Primed the diesel pump cleanly and got me rolling.',
  'Brake caliper seized on the highway. Expertly freed the pads and tested stopping power before leaving.',
  'Late night jumpstart in Uttara sector 7. Extremely professional mechanic with heavy duty jumper cables.',
  'Punctured front tire replaced swiftly on Mirpur road. Honest pricing and polite behavior throughout.',
  'Fast recovery truck dispatched near Bijoy Sarani. Secured vehicle chassis firmly and towed safely.',
  'Alternator failed near Tejgaon. Tested charging voltage thoroughly and got the car running in no time.',
  'Starter motor clicked repeatedly in Motijheel. Technician tapped and cleaned terminals immediately.',
  'Expert clutch cable adjustment on the highway. Smooth shifting restored without needing a flatbed.',
  'Fuel pump fuse blew during peak traffic. Located the short circuit and replaced the fuse swiftly.',
];

const REVIEW_COMMENTS_4_STAR = [
  'Good experience near Farmgate. Arrived in 30 minutes and jumpstarted the dead battery without delay.',
  'Fixed the flat tire efficiently on Kuril flyover. Carried proper hydraulic jack and tightened wheel nuts.',
  'Prompt emergency fuel delivery near Rampura. Slightly delayed by traffic but polite and got me moving.',
  'Clean towing service to the workshop from Kanchpur bridge. Took good precautions with the front bumper.',
  'Resolved the brake squeal roadside near Shyamoli. Realigned the brake pads and verified fluid levels.',
  'Engine belt slipped near Kakrail. Re-tensioned the serpentine belt reliably. Good diagnostic equipment.',
  'Unlocked car trunk near Bashundhara gate safely. Took about 25 minutes to arrive but solved the problem.',
  'Replaced blown radiator cap after engine stalled near Agargaon. Very knowledgeable and polite technician.',
  'Battery voltage check and terminal cleaning done well in Badda. Reliable roadside assistance service.',
  'Quick spare tire swap on Airport road. Efficient mechanic though dispatch confirmation took some time.',
  'Towing truck arrived within 40 minutes near Sayedabad. Smooth loading and safe transport to my garage.',
];

const REVIEW_COMMENTS_3_STAR = [
  'Arrived late due to gridlock near Malibagh but got the battery jumpstarted successfully in the end.',
  'Tire changed properly on Gabtoli highway, though the wait time was longer than originally estimated.',
  'Fuel delivered as promised near Jatrabari. Service was acceptable but labor charge felt slightly high.',
  'Tow truck took nearly an hour to reach Mirpur 10. Once there, the vehicle was loaded without incident.',
  'Fixed brake pedal stiffness roadside. Work was fine but mechanic did not carry spare brake fluid.',
  'Jumpstart got the engine turning again. Good service though communication during dispatch was slow.',
  'Lockout resolved without window damage, but had to wait 50 minutes on the roadside in Moghbazar.',
  'Engine coolant leak patched temporarily to reach home. Recommended follow-up workshop repair needed.',
  'Spare wheel fitted roadside near Postogola. Job done correctly but mechanic arrived without an air pump.',
];

const RATING_PATTERN = [5, 4, 5, 4, 3, 5, 5, 4, 4, 5, 3, 5];

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
      deletedAt: null,
      password: passwordHash,
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
      deletedAt: null,
      password: passwordHash,
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
      deletedAt: null,
      password: passwordHash,
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
      skills: ['Engine Repair', 'Brake Service', 'Tire Change', 'Battery Jumpstart', 'Engine', 'Brakes', 'Tire', 'Battery'],
      bio: 'Master technician with over 10 years of expertise diagnosing automotive failures across Dhaka. Dedicated to fast roadside recovery, preventative tuning, and trustworthy diagnostics.',
      avatarUrl: `https://api.dicebear.com/10.x/open-peeps/png?seed=${encodeURIComponent('Demo Mechanic')}`,
      city: 'Dhaka',
      yearsExperience: 10,
    },
    create: {
      userId: mechanicUser.id,
      availability: Availability.AVAILABLE,
      currentLat: 23.8103,
      currentLng: 90.4125,
      skills: ['Engine Repair', 'Brake Service', 'Tire Change', 'Battery Jumpstart', 'Engine', 'Brakes', 'Tire', 'Battery'],
      rating: 0,
      totalJobs: 0,
      bio: 'Master technician with over 10 years of expertise diagnosing automotive failures across Dhaka. Dedicated to fast roadside recovery, preventative tuning, and trustworthy diagnostics.',
      avatarUrl: `https://api.dicebear.com/10.x/open-peeps/png?seed=${encodeURIComponent('Demo Mechanic')}`,
      city: 'Dhaka',
      yearsExperience: 10,
    },
  });
  console.log(`✅ Mechanic profile seeded: ${mechanicUser.email} (Dhaka: 23.8103, 90.4125)`);

  // 3b. Seed 13 Additional Bangladeshi Demo Mechanics (14 total)
  const additionalMechanicsData = [
    {
      email: 'mechanic-2@roadresq-demo.com',
      name: 'Mohammad Rafiqul Islam',
      phone: '+8801810000001',
      city: 'Chattogram',
      currentLat: 22.3569,
      currentLng: 91.7832,
      availability: Availability.OFFLINE,
      skills: ['Engine', 'Brakes', 'Transmission'],
      yearsExperience: 12,
      bio: 'Senior automotive technician with over 12 years of expertise across diesel and petrol engines in Chattogram port area. Specializes in heavy-duty transmission overhauls and emergency roadside repairs.',
    },
    {
      email: 'mechanic-3@roadresq-demo.com',
      name: 'Tanvir Ahmed Chowdhury',
      phone: '+8801810000002',
      city: 'Sylhet',
      currentLat: 24.8949,
      currentLng: 91.8687,
      availability: Availability.BUSY,
      skills: ['Battery', 'Electrical', 'AC'],
      yearsExperience: 8,
      bio: 'Specialist in European auto electrical systems and precision climate control diagnostics in Sylhet. Known for reliable alternator repairs and modern hybrid car battery troubleshooting.',
    },
    {
      email: 'mechanic-4@roadresq-demo.com',
      name: 'Kamrul Hasan Mollah',
      phone: '+8801810000003',
      city: 'Rajshahi',
      currentLat: 24.3745,
      currentLng: 88.6042,
      availability: Availability.AVAILABLE,
      skills: ['Tire', 'Brakes', 'Towing'],
      yearsExperience: 6,
      bio: 'Fast roadside recovery expert serving the Rajshahi highway corridors with prompt response times. Skilled in pneumatic brake adjustments, wheel alignment, and heavy towing services.',
    },
    {
      email: 'mechanic-5@roadresq-demo.com',
      name: 'Mehedi Hasan Bappi',
      phone: '+8801810000004',
      city: 'Khulna',
      currentLat: 22.8456,
      currentLng: 89.5403,
      availability: Availability.BUSY,
      skills: ['Engine', 'Fuel Delivery', 'Battery'],
      yearsExperience: 11,
      bio: 'Experienced engine specialist operating out of Khulna industrial and residential zones. Provides on-the-spot fuel delivery, dead-battery jumpstarts, and complete computerized engine scans.',
    },
    {
      email: 'mechanic-6@roadresq-demo.com',
      name: 'Shahidul Alam',
      phone: '+8801810000005',
      city: 'Cumilla',
      currentLat: 23.4607,
      currentLng: 91.1809,
      availability: Availability.OFFLINE,
      skills: ['Towing', 'Lockout', 'Tire'],
      yearsExperience: 9,
      bio: 'Dedicated roadside assistance master technician covering the Dhaka-Chittagong highway near Cumilla. Proficient in non-destructive vehicle lockout entry and on-site tire balancing.',
    },
    {
      email: 'mechanic-7@roadresq-demo.com',
      name: 'Arifur Rahman',
      phone: '+8801810000006',
      city: 'Rangpur',
      currentLat: 25.7439,
      currentLng: 89.2752,
      availability: Availability.AVAILABLE,
      skills: ['Electrical', 'AC', 'Engine'],
      yearsExperience: 7,
      bio: 'Certified auto electrician serving Rangpur division with cutting-edge scanning tools. Experienced in repairing faulty wiring harnesses, ECU reprogramming, and AC compressor rebuilds.',
    },
    {
      email: 'mechanic-8@roadresq-demo.com',
      name: 'Nazmul Huda',
      phone: '+8801810000007',
      city: 'Barishal',
      currentLat: 22.7010,
      currentLng: 90.3535,
      availability: Availability.BUSY,
      skills: ['Brakes', 'Transmission', 'Battery'],
      yearsExperience: 14,
      bio: 'Veteran mechanic with fourteen years serving southern coastal transit fleets in Barishal. Master of automatic gearbox maintenance, hydraulic ABS brake servicing, and deep-cycle battery testing.',
    },
    {
      email: 'mechanic-9@roadresq-demo.com',
      name: 'Ashraful Haque',
      phone: '+8801810000008',
      city: 'Mymensingh',
      currentLat: 24.7471,
      currentLng: 90.4203,
      availability: Availability.OFFLINE,
      skills: ['Tire', 'Towing', 'Lockout'],
      yearsExperience: 5,
      bio: 'Rapid emergency responder specializing in flat tire mobile replacement and lockouts in Mymensingh. Committed to safe vehicle towing and round-the-clock driver assistance.',
    },
    {
      email: 'mechanic-10@roadresq-demo.com',
      name: 'Zahidul Islam',
      phone: '+8801810000009',
      city: 'Bogura',
      currentLat: 24.8465,
      currentLng: 89.3777,
      availability: Availability.AVAILABLE,
      skills: ['Fuel Delivery', 'Battery', 'Engine'],
      yearsExperience: 10,
      bio: 'Key transit corridor automotive engineer operating near the Bogura northern highway hub. Expert in emergency fuel system priming, starter motor repairs, and cooling system restorations.',
    },
    {
      email: 'mechanic-11@roadresq-demo.com',
      name: 'Mahmudur Rahman',
      phone: '+8801810000010',
      city: 'Gazipur',
      currentLat: 23.9999,
      currentLng: 90.4203,
      availability: Availability.BUSY,
      skills: ['Electrical', 'Brakes', 'AC'],
      yearsExperience: 13,
      bio: 'Highly rated mechanical engineer handling high-mileage delivery vans and personal sedans in Gazipur. Known for meticulous brake rotor resurfacing and precision automotive air conditioning repair.',
    },
    {
      email: 'mechanic-12@roadresq-demo.com',
      name: 'Anisur Rahman Khan',
      phone: '+8801810000011',
      city: 'Narayanganj',
      currentLat: 23.6238,
      currentLng: 90.5000,
      availability: Availability.OFFLINE,
      skills: ['Transmission', 'Engine', 'Tire'],
      yearsExperience: 8,
      bio: 'Skilled workshop manager and mobile mechanic serving Narayanganj river port district. Specializes in manual clutch replacements, engine valve timing, and rapid roadside puncture repairs.',
    },
    {
      email: 'mechanic-13@roadresq-demo.com',
      name: 'Farhad Hossain',
      phone: '+8801810000012',
      city: 'Cox\'s Bazar',
      currentLat: 21.4272,
      currentLng: 92.0058,
      availability: Availability.AVAILABLE,
      skills: ['Towing', 'Battery', 'Lockout'],
      yearsExperience: 6,
      bio: 'Tourist highway roadside assistance specialist based along the Marine Drive in Cox\'s Bazar. Delivers high-speed towing, jumpstarting, and key retrieval services under tough coastal conditions.',
    },
    {
      email: 'mechanic-14@roadresq-demo.com',
      name: 'Saiful Islam',
      phone: '+8801810000013',
      city: 'Kushtia',
      currentLat: 23.9013,
      currentLng: 89.1205,
      availability: Availability.BUSY,
      skills: ['Engine', 'Electrical', 'AC'],
      yearsExperience: 15,
      bio: 'Fifteen-year master mechanic trusted by local transport operators across Kushtia and Pabna districts. Renowned for rebuilding cylinder heads, diagnosing tricky electrical shorts, and AC servicing.',
    },
  ];

  const additionalMechanicUsers: Array<{ user: any; profile: any }> = [];
  for (const mData of additionalMechanicsData) {
    const user = await prisma.user.upsert({
      where: { email: mData.email },
      update: {
        name: mData.name,
        role: Role.MECHANIC,
        phone: mData.phone,
        deletedAt: null,
        password: passwordHash,
      },
      create: {
        name: mData.name,
        email: mData.email,
        password: passwordHash,
        role: Role.MECHANIC,
        phone: mData.phone,
      },
    });

    const profile = await prisma.mechanicProfile.upsert({
      where: { userId: user.id },
      update: {
        availability: mData.availability,
        currentLat: mData.currentLat,
        currentLng: mData.currentLng,
        skills: mData.skills,
        city: mData.city,
        yearsExperience: mData.yearsExperience,
        bio: mData.bio,
        avatarUrl: `https://api.dicebear.com/10.x/open-peeps/png?seed=${encodeURIComponent(mData.name)}`,
      },
      create: {
        userId: user.id,
        availability: mData.availability,
        currentLat: mData.currentLat,
        currentLng: mData.currentLng,
        skills: mData.skills,
        city: mData.city,
        yearsExperience: mData.yearsExperience,
        bio: mData.bio,
        avatarUrl: `https://api.dicebear.com/10.x/open-peeps/png?seed=${encodeURIComponent(mData.name)}`,
        rating: 0,
        totalJobs: 0,
      },
    });

    additionalMechanicUsers.push({ user, profile });
  }
  console.log(`✅ Seeded ${additionalMechanicsData.length} additional demo mechanics across Bangladesh`);

  // 3c. Seed 10 Extra Demo Customers
  const additionalCustomersData = [
    { email: 'customer-1@roadresq-demo.com', name: 'Sultana Razia', phone: '+8801720000001', make: 'Toyota', model: 'Allion 2019', plate: 'DHAKA-METRO-KA-801111' },
    { email: 'customer-2@roadresq-demo.com', name: 'Tariqul Islam', phone: '+8801720000002', make: 'Honda', model: 'Grace Hybrid', plate: 'DHAKA-METRO-GA-802222' },
    { email: 'customer-3@roadresq-demo.com', name: 'Farhana Yasmin', phone: '+8801720000003', make: 'Nissan', model: 'X-Trail 2020', plate: 'DHAKA-METRO-CHA-803333' },
    { email: 'customer-4@roadresq-demo.com', name: 'Imran Kabir', phone: '+8801720000004', make: 'Toyota', model: 'Axio 2018', plate: 'DHAKA-METRO-KA-804444' },
    { email: 'customer-5@roadresq-demo.com', name: 'Nasrin Akter', phone: '+8801720000005', make: 'Hyundai', model: 'Tucson 2021', plate: 'DHAKA-METRO-GHA-805555' },
    { email: 'customer-6@roadresq-demo.com', name: 'Sabbir Hossain', phone: '+8801720000006', make: 'Mitsubishi', model: 'Outlander', plate: 'DHAKA-METRO-JA-806666' },
    { email: 'customer-7@roadresq-demo.com', name: 'Nusrat Jahan', phone: '+8801720000007', make: 'Suzuki', model: 'Swift 2020', plate: 'DHAKA-METRO-KHA-807777' },
    { email: 'customer-8@roadresq-demo.com', name: 'Rashedul Karim', phone: '+8801720000008', make: 'Toyota', model: 'Prius 2019', plate: 'DHAKA-METRO-GA-808888' },
    { email: 'customer-9@roadresq-demo.com', name: 'Farzana Haque', phone: '+8801720000009', make: 'Kia', model: 'Sportage 2022', plate: 'DHAKA-METRO-CHA-809999' },
    { email: 'customer-10@roadresq-demo.com', name: 'Mustafizur Rahman', phone: '+8801720000010', make: 'Mazda', model: 'CX-5 2021', plate: 'DHAKA-METRO-DA-810000' },
  ];

  const seededCustomers: Array<{ user: any; vehicle: any }> = [];
  for (const cData of additionalCustomersData) {
    const cUser = await prisma.user.upsert({
      where: { email: cData.email },
      update: {
        name: cData.name,
        role: Role.CUSTOMER,
        phone: cData.phone,
        deletedAt: null,
        password: passwordHash,
      },
      create: {
        name: cData.name,
        email: cData.email,
        password: passwordHash,
        role: Role.CUSTOMER,
        phone: cData.phone,
      },
    });

    let cVeh = await prisma.vehicle.findFirst({
      where: { customerId: cUser.id, plateNumber: cData.plate },
    });
    if (!cVeh) {
      cVeh = await prisma.vehicle.create({
        data: {
          customerId: cUser.id,
          make: cData.make,
          model: cData.model,
          plateNumber: cData.plate,
        },
      });
    }
    seededCustomers.push({ user: cUser, vehicle: cVeh });
  }
  console.log(`✅ Seeded ${additionalCustomersData.length} additional demo customers with vehicles`);

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
    { name: 'Heavy Duty 12V Battery', price: 120.0, stock: 3 },
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

  // 6b. Seed 3 to 5 COMPLETED and PAID requests each for the first 10 mechanics with varied reviews
  const first10Mechanics = [
    { user: mechanicUser, profile: mechanicProfile },
    ...additionalMechanicUsers.slice(0, 9),
  ];

  const sparePartKeys = Object.keys(catalogParts);

  for (let mIdx = 0; mIdx < first10Mechanics.length; mIdx++) {
    const { user: mUser } = first10Mechanics[mIdx];
    const numJobs = 3 + (mIdx % 3); // 3, 4, or 5 jobs per mechanic
    const usedComments = new Set<string>();

    for (let j = 0; j < numJobs; j++) {
      const customerIdx = (mIdx * 3 + j) % seededCustomers.length;
      const { user: cUser, vehicle: cVeh } = seededCustomers[customerIdx];
      const reqId = `demo-req-mech-${mIdx + 1}-job-${j + 1}`;
      const invId = `demo-inv-mech-${mIdx + 1}-job-${j + 1}`;
      const payId = `demo-pay-mech-${mIdx + 1}-job-${j + 1}`;
      const revId = `demo-rev-mech-${mIdx + 1}-job-${j + 1}`;
      const h = stringHash(revId);

      // Spread dates across the last ~12 weeks (between 3 and 84 days ago)
      const daysAgo = Math.floor(3 + ((mIdx * 8 + j * 5) % 80));
      const reqDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

      // Vary createdAt times within the day
      const hour = 8 + (h % 12);
      const minute = stringHash(revId + ':min') % 60;
      const second = stringHash(revId + ':sec') % 60;
      reqDate.setUTCHours(hour, minute, second, h % 1000);

      const partKey = sparePartKeys[(mIdx + j) % sparePartKeys.length];
      const part = catalogParts[partKey];
      const laborCost = new Prisma.Decimal(40 + (j * 15));
      const partsCost = new Prisma.Decimal(50 + (j * 20));
      const totalAmount = new Prisma.Decimal(laborCost.toNumber() + partsCost.toNumber());

      // Deterministic rating skewed towards 4 and 5 with some 3s (average ~4.3)
      const rating = RATING_PATTERN[(h + j) % RATING_PATTERN.length];

      // Select pool based on rating
      const pool =
        rating === 5
          ? REVIEW_COMMENTS_5_STAR
          : rating === 4
          ? REVIEW_COMMENTS_4_STAR
          : REVIEW_COMMENTS_3_STAR;

      // Ensure no two reviews of the same mechanic share text
      let comment = '';
      for (let offset = 0; offset < pool.length; offset++) {
        const candidate = pool[(h + offset) % pool.length];
        if (!usedComments.has(candidate)) {
          comment = candidate;
          break;
        }
      }
      if (!comment) {
        comment = pool[h % pool.length];
      }
      usedComments.add(comment);

      await prisma.serviceRequest.upsert({
        where: { id: reqId },
        update: {
          status: RequestStatus.COMPLETED,
          priority: RequestPriority.NORMAL,
          createdAt: reqDate,
        },
        create: {
          id: reqId,
          customerId: cUser.id,
          mechanicId: mUser.id,
          vehicleId: cVeh.id,
          description: `Roadside breakdown service for ${cVeh.make} ${cVeh.model}: ${comment.substring(0, 45)}...`,
          lat: 23.8103 + (mIdx * 0.05),
          lng: 90.4125 + (j * 0.05),
          status: RequestStatus.COMPLETED,
          priority: RequestPriority.NORMAL,
          createdAt: reqDate,
        },
      });

      const existingPart = await prisma.serviceRequestPart.findFirst({
        where: { serviceRequestId: reqId, sparePartId: part.id },
      });
      if (!existingPart) {
        await prisma.serviceRequestPart.create({
          data: {
            serviceRequestId: reqId,
            sparePartId: part.id,
            quantity: 1,
            priceAtUse: partsCost,
            createdAt: reqDate,
          },
        });
      }

      const inv = await prisma.invoice.upsert({
        where: { serviceRequestId: reqId },
        update: {
          status: InvoiceStatus.PAID,
          createdAt: reqDate,
        },
        create: {
          id: invId,
          serviceRequestId: reqId,
          laborCost,
          partsCost,
          totalAmount,
          status: InvoiceStatus.PAID,
          createdAt: reqDate,
        },
      });

      await prisma.payment.upsert({
        where: { invoiceId: inv.id },
        update: {
          status: PaymentStatus.COMPLETED,
          paidAt: reqDate,
        },
        create: {
          id: payId,
          invoiceId: inv.id,
          gateway: 'SSLCOMMERZ',
          transactionId: `SSL_DEMO_SEED_M${mIdx + 1}_J${j + 1}`,
          amount: totalAmount,
          status: PaymentStatus.COMPLETED,
          paidAt: reqDate,
          createdAt: reqDate,
        },
      });

      await prisma.review.upsert({
        where: { serviceRequestId: reqId },
        update: {
          rating,
          comment,
          createdAt: reqDate,
        },
        create: {
          id: revId,
          serviceRequestId: reqId,
          customerId: cUser.id,
          rating,
          comment,
          createdAt: reqDate,
        },
      });

      // Audit log entry for completed request
      const existingAudit = await prisma.auditLog.findFirst({
        where: { action: 'SERVICE_REQUEST_COMPLETED', entityId: reqId },
      });
      if (!existingAudit) {
        await prisma.auditLog.create({
          data: {
            actorId: mUser.id,
            action: 'SERVICE_REQUEST_COMPLETED',
            entityType: 'ServiceRequest',
            entityId: reqId,
            metadata: {
              completedAt: reqDate.toISOString(),
              totalAmount: totalAmount.toString(),
            },
            createdAt: reqDate,
          },
        });
      }
    }
  }
  console.log(`✅ Seeded completed & paid requests with reviews for first 10 mechanics`);

  // 7. Recalculate Rating and Job Counters for ALL mechanics
  const allMechanicUsers = [mechanicUser, ...additionalMechanicUsers.map((m) => m.user)];
  for (const mUser of allMechanicUsers) {
    const reviewStats = await prisma.review.aggregate({
      where: { serviceRequest: { mechanicId: mUser.id } },
      _avg: { rating: true },
      _count: { rating: true },
    });

    const completedCount = await prisma.serviceRequest.count({
      where: { mechanicId: mUser.id, status: RequestStatus.COMPLETED },
    });

    const finalRating =
      reviewStats._count.rating > 0 && reviewStats._avg.rating !== null
        ? Math.round(reviewStats._avg.rating * 10) / 10
        : 0;

    await prisma.mechanicProfile.update({
      where: { userId: mUser.id },
      data: {
        rating: finalRating,
        totalJobs: completedCount,
      },
    });
  }
  console.log(`✅ Recalculated ratings and job counts for all ${allMechanicUsers.length} mechanics`);

  // 7b. Legacy accounts cleanup (soft-delete accounts before 2026-10-16T00:00:00Z without active requests)
  const legacyCutoff = new Date('2026-10-16T00:00:00Z');
  const legacyUsers = await prisma.user.findMany({
    where: {
      NOT: {
        email: { endsWith: '@roadresq-demo.com', mode: 'insensitive' },
      },
      createdAt: { lt: legacyCutoff },
      deletedAt: null,
    },
    include: {
      mechanicRequests: {
        where: {
          status: { in: [RequestStatus.ASSIGNED, RequestStatus.EN_ROUTE, RequestStatus.ARRIVED, RequestStatus.IN_PROGRESS] },
        },
      },
    },
  });

  for (const lu of legacyUsers) {
    if (lu.role === Role.MECHANIC && lu.mechanicRequests.length > 0) continue;
    await prisma.user.update({
      where: { id: lu.id },
      data: { deletedAt: new Date() },
    });
    if (lu.role === Role.MECHANIC) {
      await prisma.mechanicProfile.updateMany({
        where: { userId: lu.id },
        data: { availability: Availability.OFFLINE },
      });
    }
    await prisma.refreshToken.deleteMany({ where: { userId: lu.id } });
  }
  if (legacyUsers.length > 0) {
    console.log(`✅ Cleaned up ${legacyUsers.length} legacy account(s)`);
  }

  // 8. Log Audit Entry for Database Seeding
  await prisma.auditLog.create({
    data: {
      actorId: adminUser.id,
      action: 'DATABASE_SEED',
      entityType: 'System',
      entityId: 'seed-task',
      metadata: {
        timestamp: new Date().toISOString(),
        demoAccounts: [
          'admin@roadresq-demo.com',
          'customer@roadresq-demo.com',
          'mechanic@roadresq-demo.com',
          ...additionalMechanicsData.map((m) => m.email),
          ...additionalCustomersData.map((c) => c.email),
        ],
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
