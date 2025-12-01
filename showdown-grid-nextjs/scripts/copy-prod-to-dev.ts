#!/usr/bin/env tsx
/**
 * Script to copy data from production to development database
 *
 * Usage: tsx scripts/copy-prod-to-dev.ts
 *
 * Make sure you have:
 * 1. Production credentials set in environment variables
 * 2. Development credentials in .env.local
 */

import { createClient } from '@supabase/supabase-js';

// Production credentials (you'll need to provide these)
const PROD_URL = 'https://qljiwlpfbwqufmfkhzqz.supabase.co';
const PROD_SERVICE_ROLE_KEY = process.env.PROD_SUPABASE_SERVICE_ROLE_KEY;

// Development credentials (from .env.local)
const DEV_URL = 'https://lekvkhbohcarikblubuk.supabase.co';
const DEV_SERVICE_ROLE_KEY = process.env.DEV_SUPABASE_SERVICE_ROLE_KEY;

if (!PROD_SERVICE_ROLE_KEY || !DEV_SERVICE_ROLE_KEY) {
  console.error('❌ Missing service role keys!');
  console.error('Please set:');
  console.error('  PROD_SUPABASE_SERVICE_ROLE_KEY=<prod-service-role-key>');
  console.error('  DEV_SUPABASE_SERVICE_ROLE_KEY=<dev-service-role-key>');
  console.error('\nCurrent values:');
  console.error(`  PROD_SUPABASE_SERVICE_ROLE_KEY: ${PROD_SERVICE_ROLE_KEY ? `${PROD_SERVICE_ROLE_KEY.substring(0, 20)}...` : 'NOT SET'}`);
  console.error(`  DEV_SUPABASE_SERVICE_ROLE_KEY: ${DEV_SERVICE_ROLE_KEY ? `${DEV_SERVICE_ROLE_KEY.substring(0, 20)}...` : 'NOT SET'}`);
  process.exit(1);
}

console.log('🔑 Keys validated:');
console.log(`   PROD key: ${PROD_SERVICE_ROLE_KEY.substring(0, 20)}...`);
console.log(`   DEV key: ${DEV_SERVICE_ROLE_KEY.substring(0, 20)}...`);

const prodSupabase = createClient(PROD_URL, PROD_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});
const devSupabase = createClient(DEV_URL, DEV_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function copyTable(tableName: string, columns: string[]) {
  console.log(`\n📋 Copying ${tableName}...`);

  // Fetch from prod
  const { data: prodData, error: fetchError } = await prodSupabase
    .from(tableName)
    .select('*')
    .order('created_at', { ascending: true });

  if (fetchError) {
    console.error(`❌ Error fetching from prod ${tableName}:`, fetchError);
    return;
  }

  if (!prodData || prodData.length === 0) {
    console.log(`⚠️  No data found in prod ${tableName}`);
    return;
  }

  console.log(`   Found ${prodData.length} rows in prod`);

  // Insert into dev (batch by batch to avoid timeouts)
  const batchSize = 100;
  let successCount = 0;

  for (let i = 0; i < prodData.length; i += batchSize) {
    const batch = prodData.slice(i, i + batchSize);

    const { error: insertError } = await devSupabase
      .from(tableName)
      .insert(batch);

    if (insertError) {
      console.error(`❌ Error inserting batch ${i}-${i + batch.length} into dev ${tableName}:`, insertError);
    } else {
      successCount += batch.length;
      console.log(`   ✅ Inserted batch ${i}-${i + batch.length}`);
    }
  }

  console.log(`✅ Copied ${successCount}/${prodData.length} rows to dev ${tableName}`);
}

async function copyAuthUsers() {
  console.log('\n📋 Copying auth.users...');

  try {
    // Fetch users from prod using admin API
    const { data: prodUsers, error: fetchError } = await prodSupabase.auth.admin.listUsers();

    if (fetchError) {
      console.error('❌ Error fetching auth users from prod:', fetchError);
      return;
    }

    if (!prodUsers || prodUsers.users.length === 0) {
      console.log('⚠️  No auth users found in prod');
      return;
    }

    console.log(`   Found ${prodUsers.users.length} auth users in prod`);

    // Copy each user to dev
    let successCount = 0;
    for (const user of prodUsers.users) {
      // Create user in dev with same ID and email
      const { error: createError } = await devSupabase.auth.admin.createUser({
        email: user.email!,
        email_confirm: true,
        user_metadata: user.user_metadata,
        app_metadata: user.app_metadata,
      });

      if (createError) {
        // If user already exists, that's okay - skip it
        if (createError.message.includes('already registered')) {
          console.log(`   ⏭️  User ${user.email} already exists in dev, skipping`);
        } else {
          console.error(`   ❌ Error creating user ${user.email}:`, createError.message);
        }
      } else {
        successCount++;
        console.log(`   ✅ Created user ${user.email}`);
      }
    }

    console.log(`✅ Copied ${successCount}/${prodUsers.users.length} auth users to dev`);
  } catch (error) {
    console.error('❌ Error copying auth users:', error);
  }
}

async function main() {
  console.log('🚀 Starting data copy from PROD to DEV...\n');
  console.log(`   PROD: ${PROD_URL}`);
  console.log(`   DEV:  ${DEV_URL}\n`);

  try {
    // Copy in order to respect foreign key constraints
    // 0. auth.users (referenced by quizzes.user_id)
    await copyAuthUsers();

    // 1. quizzes (referenced by users.active_quiz_id and quiz_runs.quiz_id)
    await copyTable('quizzes', [
      'id', 'user_id', 'title', 'description', 'quiz_data',
      'is_public', 'theme', 'time_limit', 'created_at', 'updated_at'
    ]);

    // 2. users (references quizzes.id)
    await copyTable('users', [
      'user_id', 'active_quiz_id', 'created_at', 'updated_at'
    ]);

    // 3. quiz_runs (references quizzes.id and users.user_id)
    await copyTable('quiz_runs', [
      'id', 'quiz_id', 'user_id', 'started_at', 'ended_at',
      'duration_seconds', 'quiz_title', 'quiz_description',
      'quiz_theme', 'quiz_time_limit', 'final_state',
      'total_questions', 'answered_questions', 'team_results',
      'winning_team_name', 'winning_score', 'created_at'
    ]);

    console.log('\n✅ Data copy completed successfully!');
  } catch (error) {
    console.error('\n❌ Error during data copy:', error);
    process.exit(1);
  }
}

main();
