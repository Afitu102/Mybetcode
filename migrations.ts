import { pool, db } from './db';
import { sql } from 'drizzle-orm';

/**
 * Apply database migrations
 */
export async function runMigrations() {
  try {
    console.log('Running database migrations...');
    
    // Add country column to users table
    await db.execute(sql`
      ALTER TABLE IF EXISTS users 
      ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'NG'
    `);
    console.log('✓ Added country column to users table');
    
    // Add country column to bet_codes table
    await db.execute(sql`
      ALTER TABLE IF EXISTS bet_codes 
      ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'NG'
    `);
    console.log('✓ Added country column to bet_codes table');
    
    // Add currency column to bet_codes table
    await db.execute(sql`
      ALTER TABLE IF EXISTS bet_codes 
      ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'NGN'
    `);
    console.log('✓ Added currency column to bet_codes table');
    
    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('Database migration failed:', error);
    throw error;
  }
}