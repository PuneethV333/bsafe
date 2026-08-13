import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { AlertStatus } from '../src/generated/prisma/enums';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  // Idempotent: wipe in FK order, then re-seed.
  await prisma.activityLog.deleteMany();
  await prisma.alertLocation.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.emergencyContact.deleteMany();
  await prisma.user.deleteMany();

  const t0 = new Date('2026-08-13T08:00:00Z');

  const priya = await prisma.user.create({
    data: {
      firebaseUid: 'firebase-uid-priya-demo',
      name: 'Priya Sharma',
      email: 'priya@example.com',
      phone: '+919876543210',
      contacts: {
        create: [
          {
            name: 'Sunita Sharma',
            phone: '+919812345001',
            email: 'sunita.mum@example.com',
            relationship: 'Mother',
          },
          { name: 'Rahul Sharma', phone: '+919812345002', relationship: 'Brother' },
          {
            name: 'Meera Iyer',
            phone: '+919812345003',
            email: 'meera.iyer@example.com',
            relationship: 'Friend',
          },
          { name: 'Vikram Rao', email: 'vikram.rao@example.com', relationship: 'Colleague' },
          { name: 'Ananya Das', phone: '+919812345005', relationship: 'Friend' },
        ],
      },
    },
  });

  const arjun = await prisma.user.create({
    data: {
      firebaseUid: 'firebase-uid-arjun-demo',
      name: 'Arjun Mehta',
      email: 'arjun@example.com',
      phone: '+919811223344',
      contacts: {
        create: [
          {
            name: 'Kavya Mehta',
            phone: '+919811998877',
            email: 'kavya.mehta@example.com',
            relationship: 'Sister',
          },
        ],
      },
    },
  });

  // Priya — resolved alert with a short movement trail (Indiranagar, Bangalore).
  const resolvedAlert = await prisma.alert.create({
    data: {
      userId: priya.id,
      status: AlertStatus.resolved,
      triggeredAt: t0,
      resolvedAt: new Date(t0.getTime() + 42 * 60 * 1000),
    },
  });
  const base = { latitude: 12.9719, longitude: 77.6412 };
  const priyaLocations = [];
  for (let i = 0; i < 5; i++) {
    priyaLocations.push(
      await prisma.alertLocation.create({
        data: {
          alertId: resolvedAlert.id,
          latitude: base.latitude + i * 0.0004,
          longitude: base.longitude + i * 0.0003,
          accuracy: 12 + i,
          recordedAt: new Date(t0.getTime() + i * 15 * 1000),
        },
      }),
    );
  }
  await prisma.alert.update({
    data: { lastLocationId: priyaLocations[priyaLocations.length - 1].id },
    where: { id: resolvedAlert.id },
  });
  await prisma.activityLog.createMany({
    data: [
      { alertId: resolvedAlert.id, eventType: 'alert_triggered', actor: priya.name, timestamp: t0 },
      {
        alertId: resolvedAlert.id,
        eventType: 'location_updated',
        actor: priya.name,
        timestamp: new Date(t0.getTime() + 15 * 1000),
      },
      {
        alertId: resolvedAlert.id,
        eventType: 'location_updated',
        actor: priya.name,
        timestamp: new Date(t0.getTime() + 30 * 1000),
      },
      {
        alertId: resolvedAlert.id,
        eventType: 'alert_acknowledged',
        actor: 'Sunita Sharma',
        timestamp: new Date(t0.getTime() + 5 * 60 * 1000),
      },
      {
        alertId: resolvedAlert.id,
        eventType: 'alert_resolved',
        actor: priya.name,
        timestamp: new Date(t0.getTime() + 42 * 60 * 1000),
      },
    ],
  });

  // Priya — acknowledged (active) alert.
  const pendingAlert = await prisma.alert.create({
    data: {
      userId: priya.id,
      status: AlertStatus.acknowledged,
      triggeredAt: new Date(t0.getTime() + 60 * 60 * 1000),
    },
  });
  const pendingLocations = [];
  for (let i = 0; i < 3; i++) {
    pendingLocations.push(
      await prisma.alertLocation.create({
        data: {
          alertId: pendingAlert.id,
          latitude: 12.9719 - i * 0.0003,
          longitude: 77.6412 + i * 0.0002,
          accuracy: 10,
          recordedAt: new Date(t0.getTime() + 60 * 60 * 1000 + i * 15 * 1000),
        },
      }),
    );
  }
  await prisma.alert.update({
    data: { lastLocationId: pendingLocations[pendingLocations.length - 1].id },
    where: { id: pendingAlert.id },
  });
  await prisma.activityLog.createMany({
    data: [
      {
        alertId: pendingAlert.id,
        eventType: 'alert_triggered',
        actor: priya.name,
        timestamp: new Date(t0.getTime() + 60 * 60 * 1000),
      },
      {
        alertId: pendingAlert.id,
        eventType: 'alert_acknowledged',
        actor: 'Meera Iyer',
        timestamp: new Date(t0.getTime() + 65 * 60 * 1000),
      },
    ],
  });

  // Arjun — sent (fresh) alert, no ack/resolve yet.
  const freshAlert = await prisma.alert.create({
    data: {
      userId: arjun.id,
      status: AlertStatus.sent,
      triggeredAt: new Date(t0.getTime() + 90 * 60 * 1000),
    },
  });
  const freshLocations = [];
  for (let i = 0; i < 2; i++) {
    freshLocations.push(
      await prisma.alertLocation.create({
        data: {
          alertId: freshAlert.id,
          latitude: 12.9352 + i * 0.0002,
          longitude: 77.6245 + i * 0.0002,
          accuracy: 8,
          recordedAt: new Date(t0.getTime() + 90 * 60 * 1000 + i * 15 * 1000),
        },
      }),
    );
  }
  await prisma.alert.update({
    data: { lastLocationId: freshLocations[freshLocations.length - 1].id },
    where: { id: freshAlert.id },
  });
  await prisma.activityLog.create({
    data: {
      alertId: freshAlert.id,
      eventType: 'alert_triggered',
      actor: arjun.name,
      timestamp: new Date(t0.getTime() + 90 * 60 * 1000),
    },
  });

  const summary = {
    users: await prisma.user.count(),
    contacts: await prisma.emergencyContact.count(),
    alerts: await prisma.alert.count(),
    locations: await prisma.alertLocation.count(),
    activityLogs: await prisma.activityLog.count(),
  };
  console.log('Seeded:', summary);
}

void main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
