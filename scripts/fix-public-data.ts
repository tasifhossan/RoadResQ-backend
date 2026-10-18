import { PrismaClient, Availability, RequestStatus } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

// Haversine distance in kilometers
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 32-bit FNV-1a hash for deterministic assignment
function stringHash(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

// Review comments pool (25 to 140 chars, no emoji, roadside situations, Bangladeshi context)
export const REVIEW_COMMENTS_5_STAR = [
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

export const REVIEW_COMMENTS_4_STAR = [
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

export const REVIEW_COMMENTS_3_STAR = [
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

export const RATING_PATTERN = [5, 4, 5, 4, 3, 5, 5, 4, 4, 5, 3, 5];

export async function fixPublicData() {
  console.log('=== FIXING PUBLIC DEMO DATA ===\n');

  // 1. LEGACY ACCOUNTS
  console.log('--- 1. Auditing and Soft-Deleting Legacy Accounts ---');
  const cutoff = new Date('2026-10-16T00:00:00Z');

  const legacyCandidates = await prisma.user.findMany({
    where: {
      NOT: {
        email: {
          endsWith: '@roadresq-demo.com',
          mode: 'insensitive',
        },
      },
      createdAt: {
        lt: cutoff,
      },
    },
    include: {
      mechanicRequests: {
        where: {
          status: {
            in: [
              RequestStatus.ASSIGNED,
              RequestStatus.EN_ROUTE,
              RequestStatus.ARRIVED,
              RequestStatus.IN_PROGRESS,
            ],
          },
        },
      },
    },
  });

  console.log(`Found ${legacyCandidates.length} legacy accounts created before 2026-10-16T00:00:00Z:`);
  for (const u of legacyCandidates) {
    console.log(` - [${u.role}] ${u.name} <${u.email}> (ID: ${u.id}, Created: ${u.createdAt.toISOString()}, Deleted: ${u.deletedAt?.toISOString() || 'Active'})`);
  }

  let softDeletedCount = 0;
  for (const u of legacyCandidates) {
    if (u.role === 'MECHANIC' && u.mechanicRequests.length > 0) {
      console.log(` ⚠️ SKIPPING MECHANIC ${u.email}: has ${u.mechanicRequests.length} active request(s).`);
      continue;
    }

    // Soft delete user if not already soft deleted
    if (!u.deletedAt) {
      await prisma.user.update({
        where: { id: u.id },
        data: { deletedAt: new Date() },
      });
      softDeletedCount++;
    }

    if (u.role === 'MECHANIC') {
      await prisma.mechanicProfile.updateMany({
        where: { userId: u.id },
        data: { availability: Availability.OFFLINE },
      });
    }

    // Always delete refresh tokens to revoke sessions
    const deletedTokens = await prisma.refreshToken.deleteMany({
      where: { userId: u.id },
    });
    if (deletedTokens.count > 0) {
      console.log(`   Revoked ${deletedTokens.count} refresh token(s) for ${u.email}`);
    }
  }
  console.log(`✅ Soft-deleted ${softDeletedCount} legacy user(s) and cleared active refresh tokens.\n`);

  // 2. REVIEWS CREATED BY THE SEED
  console.log('--- 2. Updating Seeded Reviews with Varied Roadside Comments ---');
  const demoReviews = await prisma.review.findMany({
    where: {
      customer: {
        email: {
          endsWith: '@roadresq-demo.com',
          mode: 'insensitive',
        },
      },
    },
    include: {
      serviceRequest: {
        select: {
          id: true,
          mechanicId: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Found ${demoReviews.length} seeded reviews from demo customers.`);

  // Group by mechanic to ensure no two reviews of the same mechanic share text
  const reviewsByMechanic = new Map<string, typeof demoReviews>();
  for (const rev of demoReviews) {
    const mechId = rev.serviceRequest.mechanicId || 'unknown';
    if (!reviewsByMechanic.has(mechId)) {
      reviewsByMechanic.set(mechId, []);
    }
    reviewsByMechanic.get(mechId)!.push(rev);
  }

  let updatedReviewsCount = 0;
  for (const [mechId, mReviews] of reviewsByMechanic.entries()) {
    const usedComments = new Set<string>();

    for (let i = 0; i < mReviews.length; i++) {
      const rev = mReviews[i];
      const h = stringHash(rev.id);

      // Deterministic rating skewed towards 4 and 5 with some 3s (average ~4.3)
      const rating = RATING_PATTERN[(h + i) % RATING_PATTERN.length];

      // Select pool based on rating
      const pool =
        rating === 5
          ? REVIEW_COMMENTS_5_STAR
          : rating === 4
          ? REVIEW_COMMENTS_4_STAR
          : REVIEW_COMMENTS_3_STAR;

      // Find first unused comment for this mechanic
      let chosenComment = '';
      for (let offset = 0; offset < pool.length; offset++) {
        const candidate = pool[(h + offset) % pool.length];
        if (!usedComments.has(candidate)) {
          chosenComment = candidate;
          break;
        }
      }
      if (!chosenComment) {
        chosenComment = pool[h % pool.length];
      }
      usedComments.add(chosenComment);

      // Vary createdAt times within the day
      const updatedDate = new Date(rev.createdAt);
      const hour = 8 + (h % 12); // between 8 AM and 7 PM
      const minute = stringHash(rev.id + ':min') % 60;
      const second = stringHash(rev.id + ':sec') % 60;
      updatedDate.setUTCHours(hour, minute, second, h % 1000);

      await prisma.review.update({
        where: { id: rev.id },
        data: {
          rating,
          comment: chosenComment,
          createdAt: updatedDate,
        },
      });

      updatedReviewsCount++;
    }
  }
  console.log(`✅ Varied ${updatedReviewsCount} seeded demo reviews across ${reviewsByMechanic.size} mechanics.\n`);

  // 3. AVAILABILITY RULES (Only Demo Mechanic AVAILABLE within 60 km of Dhaka)
  console.log('--- 3. Enforcing Availability Rules & Proximity to Dhaka ---');
  const dhakaLat = 23.8103;
  const dhakaLng = 90.4125;

  const activeMechanics = await prisma.mechanicProfile.findMany({
    where: {
      user: {
        deletedAt: null,
      },
    },
    include: {
      user: true,
    },
  });

  for (const m of activeMechanics) {
    const isDemoMechanic = m.user.email.toLowerCase() === 'mechanic@roadresq-demo.com';
    const dist =
      m.currentLat && m.currentLng
        ? haversineKm(dhakaLat, dhakaLng, m.currentLat, m.currentLng)
        : null;

    let targetAvailability = m.availability;

    if (dist !== null && dist <= 60) {
      if (isDemoMechanic) {
        targetAvailability = Availability.AVAILABLE;
      } else {
        // Gazipur, Narayanganj, or any other within 60 km
        if (m.city && m.city.toLowerCase().includes('gazipur')) {
          targetAvailability = Availability.BUSY;
        } else if (m.city && m.city.toLowerCase().includes('narayanganj')) {
          targetAvailability = Availability.OFFLINE;
        } else {
          targetAvailability = Availability.BUSY;
        }
      }
    } else {
      // Outside 60 km: ensure variety
      if (m.city) {
        const cityLower = m.city.toLowerCase();
        if (cityLower.includes('chattogram')) targetAvailability = Availability.OFFLINE;
        else if (cityLower.includes('sylhet')) targetAvailability = Availability.BUSY;
        else if (cityLower.includes('rajshahi')) targetAvailability = Availability.AVAILABLE;
        else if (cityLower.includes('khulna')) targetAvailability = Availability.BUSY;
        else if (cityLower.includes('cumilla')) targetAvailability = Availability.OFFLINE;
        else if (cityLower.includes('rangpur')) targetAvailability = Availability.AVAILABLE;
        else if (cityLower.includes('barishal')) targetAvailability = Availability.BUSY;
        else if (cityLower.includes('mymensingh')) targetAvailability = Availability.OFFLINE;
        else if (cityLower.includes('bogura')) targetAvailability = Availability.AVAILABLE;
        else if (cityLower.includes("cox's bazar")) targetAvailability = Availability.AVAILABLE;
        else if (cityLower.includes('kushtia')) targetAvailability = Availability.BUSY;
      }
    }

    if (m.availability !== targetAvailability) {
      await prisma.mechanicProfile.update({
        where: { userId: m.userId },
        data: { availability: targetAvailability },
      });
      console.log(`   Updated availability for ${m.user.name} (${m.city || 'No City'}, dist: ${dist?.toFixed(1)} km) -> ${targetAvailability}`);
    }
  }
  console.log(`✅ Availability rules verified across ${activeMechanics.length} active mechanics.\n`);

  // 4. BACKFILL MISSING MECHANIC PROFILE FIELDS
  console.log('--- 4. Backfilling Missing Profile Fields for Active Mechanics ---');
  let backfilledCount = 0;
  for (const m of activeMechanics) {
    const updates: any = {};

    if (!m.bio || m.bio.trim() === '') {
      updates.bio = `Experienced automotive technician specializing in emergency roadside repairs, vehicle diagnostics, and preventative servicing in ${m.city || 'Dhaka'}.`;
    }
    if (!m.city || m.city.trim() === '') {
      updates.city = 'Dhaka';
    }
    if (!m.avatarUrl || m.avatarUrl.trim() === '') {
      updates.avatarUrl = `https://api.dicebear.com/10.x/open-peeps/png?seed=${encodeURIComponent(m.user.name)}`;
    }
    if (!m.skills || m.skills.length < 2) {
      updates.skills = ['Engine', 'Brakes', 'Battery Jumpstart'];
    }
    if (m.yearsExperience === null || m.yearsExperience === undefined) {
      updates.yearsExperience = 5;
    }

    if (Object.keys(updates).length > 0) {
      await prisma.mechanicProfile.update({
        where: { userId: m.userId },
        data: updates,
      });
      backfilledCount++;
      console.log(`   Backfilled fields for ${m.user.name}: ${Object.keys(updates).join(', ')}`);
    }
  }
  console.log(`✅ Backfilled profile fields for ${backfilledCount} mechanic(s).\n`);

  // 5. RECOMPUTE RATINGS AND TOTAL JOBS FOR EVERY ACTIVE MECHANIC
  console.log('--- 5. Recomputing Ratings and Completed Jobs for All Active Mechanics ---');
  const allCurrentActive = await prisma.mechanicProfile.findMany({
    where: {
      user: {
        deletedAt: null,
      },
    },
    include: {
      user: true,
    },
  });

  for (const m of allCurrentActive) {
    const completedCount = await prisma.serviceRequest.count({
      where: {
        mechanicId: m.userId,
        status: RequestStatus.COMPLETED,
      },
    });

    const reviewStats = await prisma.review.aggregate({
      where: {
        serviceRequest: {
          mechanicId: m.userId,
        },
      },
      _avg: { rating: true },
      _count: { rating: true },
    });

    // Rating = average rounded to 1 decimal, or 0 if no reviews
    const finalRating =
      reviewStats._count.rating > 0 && reviewStats._avg.rating !== null
        ? Math.round(reviewStats._avg.rating * 10) / 10
        : 0;

    await prisma.mechanicProfile.update({
      where: { userId: m.userId },
      data: {
        totalJobs: completedCount,
        rating: finalRating,
      },
    });

    console.log(`   ${m.user.name} (${m.city}): ${completedCount} completed jobs, ${reviewStats._count.rating} reviews, rating = ${finalRating}`);
  }
  console.log(`✅ Recomputed ratings and totalJobs for all ${allCurrentActive.length} active mechanics.\n`);

  console.log('🎉 ALL DATA FIXES COMPLETED SUCCESSFULLY! 🎉');
}

fixPublicData()
  .catch((e) => {
    console.error('❌ Error executing fixPublicData:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
