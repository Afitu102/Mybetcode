import { pgTable, text, serial, integer, boolean, timestamp, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User model
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name"),
  country: text("country").default("NG").notNull(), // Default to Nigeria
  isAdmin: boolean("is_admin").default(false).notNull(),
  isEmailVerified: boolean("is_email_verified").default(false).notNull(),
  verificationToken: text("verification_token"),
  verificationTokenExpiry: timestamp("verification_token_expiry"),
  bankDetails: jsonb("bank_details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// BetCode model
export const betCodes = pgTable("bet_codes", {
  id: serial("id").primaryKey(),
  sellerId: integer("seller_id").notNull().references(() => users.id),
  country: text("country").default("NG").notNull(), // Default to Nigeria
  platform: text("platform").notNull(),
  code: text("code").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  price: real("price").notNull(),
  currency: text("currency").default("NGN").notNull(), // Default to Nigerian Naira
  validUntil: timestamp("valid_until").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Transaction model
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  buyerId: integer("buyer_id").notNull().references(() => users.id),
  sellerId: integer("seller_id").notNull().references(() => users.id),
  betCodeId: integer("bet_code_id").notNull().references(() => betCodes.id),
  amount: real("amount").notNull(),
  flutterwaveRef: text("flutterwave_ref"),
  status: text("status").notNull(), // 'pending', 'completed', 'failed', 'paid_to_seller'
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at"),
});

// Review model
export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  sellerId: integer("seller_id").notNull().references(() => users.id),
  reviewerId: integer("reviewer_id").notNull().references(() => users.id),
  betCodeId: integer("bet_code_id").references(() => betCodes.id),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Message model
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").notNull().references(() => users.id),
  receiverId: integer("receiver_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Advertisement model - admin controlled
export const advertisements = pgTable("advertisements", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  imageUrl: text("image_url"),
  linkUrl: text("link_url").notNull(),
  actionText: text("action_text").default("Learn More"),
  placement: text("placement").notNull(), // 'homepage', 'dashboard', 'browse', 'all'
  country: text("country"), // Optional - if null, show to all countries
  priority: integer("priority").default(5).notNull(), // Higher number = higher priority
  isActive: boolean("is_active").default(true).notNull(),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at"),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  isAdmin: true,
  isEmailVerified: true,
  verificationToken: true,
  verificationTokenExpiry: true,
  createdAt: true,
});

export const insertBetCodeSchema = createInsertSchema(betCodes).omit({
  id: true,
  createdAt: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReviewSchema = createInsertSchema(reviews).omit({
  id: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  isRead: true,
  createdAt: true,
});

export const insertAdvertisementSchema = createInsertSchema(advertisements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Authentication schemas
export const loginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// Country and currency information
export const COUNTRIES = [
  { 
    code: "NG", 
    name: "Nigeria", 
    currency: "NGN", 
    symbol: "₦",
    serviceFee: 200 
  },
  { 
    code: "GH", 
    name: "Ghana", 
    currency: "GHS", 
    symbol: "₵",
    serviceFee: 17 // ~200 NGN in GHS
  },
  { 
    code: "ZA", 
    name: "South Africa", 
    currency: "ZAR", 
    symbol: "R",
    serviceFee: 45 // ~200 NGN in ZAR
  }
] as const;

// Platform types by country
export const BET_PLATFORMS = [
  // Nigerian Platforms
  "Bet9ja",
  "SportyBet",
  "BetBonanza",
  "BetKing",
  "NairaBet",
  "MerryBet",
  "1960Bet",
  "AccessBet",
  // Ghanaian Platforms
  "Betway Ghana",
  "Betpawa Ghana",
  "1xBet Ghana",
  "Melbet Ghana",
  "Betyetu Ghana",
  // South African Platforms
  "Betway SA",
  "Hollywoodbets",
  "Supabets",
  "Sportingbet",
  "Sunbet",
  "Gbets"
] as const;

export const betPlatformSchema = z.enum(BET_PLATFORMS);

export const countrySchema = z.enum(COUNTRIES.map(c => c.code) as [string, ...string[]]);
export type Country = z.infer<typeof countrySchema>;

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type BetCode = typeof betCodes.$inferSelect;
export type InsertBetCode = z.infer<typeof insertBetCodeSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Review = typeof reviews.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Advertisement = typeof advertisements.$inferSelect;
export type InsertAdvertisement = z.infer<typeof insertAdvertisementSchema>;
export type LoginCredentials = z.infer<typeof loginSchema>;
export type BetPlatform = z.infer<typeof betPlatformSchema>;
