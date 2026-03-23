/**
 * DANGER: This script permanently deletes ALL data from production.
 * - Truncates all PostgreSQL tables
 * - Deletes all Firebase Auth users
 *
 * Usage: npx tsx scripts/nuke-all-data.ts
 */

import { PrismaClient } from '@prisma/client';
import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

function initFirebase(): admin.app.App {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON not found in .env');
  }
  const serviceAccount = JSON.parse(serviceAccountJson);
  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

async function deleteAllPostgresData() {
  console.log('\n=== DELETING ALL POSTGRESQL DATA ===\n');

  // Truncate all tables with CASCADE (order doesn't matter with CASCADE)
  const tables = [
    'questions',
    'quizzes',
    'flashcards',
    'flashcard_sets',
    'documents',
    'daily_usage',
    'proof_checks',
    'feed_reactions',
    'feed_comments',
    'feed_posts',
    'chat_reactions',
    'chat_messages',
    'league_members',
    'leagues',
    'study_sessions',
    'subjects',
    'user_achievements',
    'push_tokens',
    'profiles',
  ];

  for (const table of tables) {
    const result = await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE "${table}" CASCADE`,
    );
    console.log(`  Truncated: ${table}`);
  }

  console.log('\nAll PostgreSQL tables truncated successfully.');
}

async function deleteAllFirebaseUsers() {
  console.log('\n=== DELETING ALL FIREBASE AUTH USERS ===\n');

  const auth = admin.auth();
  let deletedCount = 0;
  let nextPageToken: string | undefined;

  do {
    const listResult = await auth.listUsers(1000, nextPageToken);

    if (listResult.users.length === 0) {
      break;
    }

    const uids = listResult.users.map((u) => u.uid);
    const deleteResult = await auth.deleteUsers(uids);

    deletedCount += deleteResult.successCount;
    if (deleteResult.failureCount > 0) {
      console.warn(
        `  Warning: ${deleteResult.failureCount} users failed to delete`,
      );
      deleteResult.errors.forEach((e) =>
        console.warn(`    - ${e.error.message}`),
      );
    }

    console.log(
      `  Deleted batch: ${deleteResult.successCount} users (total: ${deletedCount})`,
    );

    nextPageToken = listResult.pageToken;
  } while (nextPageToken);

  console.log(`\nAll Firebase users deleted. Total: ${deletedCount}`);
}

async function main() {
  console.log('==========================================');
  console.log('  NUKING ALL DATA FROM PRODUCTION');
  console.log('  Project: quibly-70e89');
  console.log('==========================================');

  try {
    const app = initFirebase();

    await deleteAllPostgresData();
    await deleteAllFirebaseUsers();

    console.log('\n=== DONE ===');
    console.log('All users, quizzes, flashcards, and related data deleted.');
  } catch (error) {
    console.error('\nError:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
