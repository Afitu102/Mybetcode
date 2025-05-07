import { 
  users, type User, type InsertUser,
  betCodes, type BetCode, type InsertBetCode,
  transactions, type Transaction, type InsertTransaction,
  reviews, type Review, type InsertReview,
  messages, type Message, type InsertMessage,
  advertisements, type Advertisement, type InsertAdvertisement
} from "@shared/schema";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { db } from "./db";
import { eq, and, gte, lte, desc, isNull, isNotNull, or } from "drizzle-orm";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByVerificationToken(token: string): Promise<User[]>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<User>): Promise<User | undefined>;
  
  // BetCode operations
  getBetCode(id: number): Promise<BetCode | undefined>;
  getBetCodes(params?: { 
    sellerId?: number; 
    platform?: string; 
    isActive?: boolean;
    minPrice?: number;
    maxPrice?: number;
  }): Promise<BetCode[]>;
  createBetCode(betCode: InsertBetCode): Promise<BetCode>;
  updateBetCode(id: number, betCode: Partial<BetCode>): Promise<BetCode | undefined>;
  deleteBetCode(id: number): Promise<boolean>;
  
  // Transaction operations
  getTransaction(id: number): Promise<Transaction | undefined>;
  getTransactions(params?: { 
    buyerId?: number;
    sellerId?: number;
    betCodeId?: number;
    status?: string;
  }): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransaction(id: number, transaction: Partial<Transaction>): Promise<Transaction | undefined>;
  
  // Review operations
  getReview(id: number): Promise<Review | undefined>;
  getReviews(params?: {
    sellerId?: number;
    reviewerId?: number;
    betCodeId?: number;
  }): Promise<Review[]>;
  createReview(review: InsertReview): Promise<Review>;
  
  // Message operations
  getMessage(id: number): Promise<Message | undefined>;
  getMessages(params: {
    senderId?: number;
    receiverId?: number;
  }): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  markMessageAsRead(id: number): Promise<Message | undefined>;
  
  // Seller stats
  getSellerRating(sellerId: number): Promise<{ 
    averageRating: number; 
    totalReviews: number; 
  }>;
  
  // Advertisement operations
  getAdvertisement(id: number): Promise<Advertisement | undefined>;
  getAdvertisements(params?: {
    placement?: string;
    country?: string;
    isActive?: boolean;
  }): Promise<Advertisement[]>;
  createAdvertisement(advertisement: InsertAdvertisement): Promise<Advertisement>;
  updateAdvertisement(id: number, advertisement: Partial<Advertisement>): Promise<Advertisement | undefined>;
  deleteAdvertisement(id: number): Promise<boolean>;
  
  // Session store
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));
    return user;
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));
    return user;
  }

  async getUserByVerificationToken(token: string): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(eq(users.verificationToken, token));
  }
  
  async getAllUsers(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .orderBy(users.username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        ...insertUser,
        isAdmin: false,
      })
      .returning();
    return user;
  }
  
  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }
  
  // BetCode operations
  async getBetCode(id: number): Promise<BetCode | undefined> {
    const [betCode] = await db
      .select()
      .from(betCodes)
      .where(eq(betCodes.id, id));
    return betCode;
  }
  
  async getBetCodes(params?: { 
    sellerId?: number; 
    platform?: string; 
    isActive?: boolean;
    minPrice?: number;
    maxPrice?: number;
  }): Promise<BetCode[]> {
    let query = db.select().from(betCodes);
    
    if (params) {
      const conditions = [];
      
      if (params.sellerId !== undefined) {
        conditions.push(eq(betCodes.sellerId, params.sellerId));
      }
      
      if (params.platform !== undefined) {
        conditions.push(eq(betCodes.platform, params.platform));
      }
      
      if (params.isActive !== undefined) {
        conditions.push(eq(betCodes.isActive, params.isActive));
      }
      
      if (params.minPrice !== undefined) {
        conditions.push(gte(betCodes.price, params.minPrice));
      }
      
      if (params.maxPrice !== undefined) {
        conditions.push(lte(betCodes.price, params.maxPrice));
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
    }
    
    return await query.orderBy(desc(betCodes.createdAt));
  }
  
  async createBetCode(insertBetCode: InsertBetCode): Promise<BetCode> {
    const [betCode] = await db
      .insert(betCodes)
      .values(insertBetCode)
      .returning();
    return betCode;
  }
  
  async updateBetCode(id: number, betCodeData: Partial<BetCode>): Promise<BetCode | undefined> {
    const [updatedBetCode] = await db
      .update(betCodes)
      .set(betCodeData)
      .where(eq(betCodes.id, id))
      .returning();
    return updatedBetCode;
  }
  
  async deleteBetCode(id: number): Promise<boolean> {
    const result = await db
      .delete(betCodes)
      .where(eq(betCodes.id, id))
      .returning({ id: betCodes.id });
    return result.length > 0;
  }
  
  // Transaction operations
  async getTransaction(id: number): Promise<Transaction | undefined> {
    const [transaction] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, id));
    return transaction;
  }
  
  async getTransactions(params?: { 
    buyerId?: number;
    sellerId?: number;
    betCodeId?: number;
    status?: string;
  }): Promise<Transaction[]> {
    let query = db.select().from(transactions);
    
    if (params) {
      const conditions = [];
      
      if (params.buyerId !== undefined) {
        conditions.push(eq(transactions.buyerId, params.buyerId));
      }
      
      if (params.sellerId !== undefined) {
        conditions.push(eq(transactions.sellerId, params.sellerId));
      }
      
      if (params.betCodeId !== undefined) {
        conditions.push(eq(transactions.betCodeId, params.betCodeId));
      }
      
      if (params.status !== undefined) {
        conditions.push(eq(transactions.status, params.status));
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
    }
    
    return await query.orderBy(desc(transactions.createdAt));
  }
  
  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const [transaction] = await db
      .insert(transactions)
      .values(insertTransaction)
      .returning();
    return transaction;
  }
  
  async updateTransaction(id: number, transactionData: Partial<Transaction>): Promise<Transaction | undefined> {
    const [updatedTransaction] = await db
      .update(transactions)
      .set(transactionData)
      .where(eq(transactions.id, id))
      .returning();
    return updatedTransaction;
  }
  
  // Review operations
  async getReview(id: number): Promise<Review | undefined> {
    const [review] = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, id));
    return review;
  }
  
  async getReviews(params?: {
    sellerId?: number;
    reviewerId?: number;
    betCodeId?: number;
  }): Promise<Review[]> {
    let query = db.select().from(reviews);
    
    if (params) {
      const conditions = [];
      
      if (params.sellerId !== undefined) {
        conditions.push(eq(reviews.sellerId, params.sellerId));
      }
      
      if (params.reviewerId !== undefined) {
        conditions.push(eq(reviews.reviewerId, params.reviewerId));
      }
      
      if (params.betCodeId !== undefined) {
        conditions.push(eq(reviews.betCodeId, params.betCodeId));
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
    }
    
    return await query.orderBy(desc(reviews.createdAt));
  }
  
  async createReview(insertReview: InsertReview): Promise<Review> {
    const [review] = await db
      .insert(reviews)
      .values(insertReview)
      .returning();
    return review;
  }
  
  // Message operations
  async getMessage(id: number): Promise<Message | undefined> {
    const [message] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, id));
    return message;
  }
  
  async getMessages(params: {
    senderId?: number;
    receiverId?: number;
  }): Promise<Message[]> {
    let query = db.select().from(messages);
    
    const conditions = [];
    
    if (params.senderId !== undefined) {
      conditions.push(eq(messages.senderId, params.senderId));
    }
    
    if (params.receiverId !== undefined) {
      conditions.push(eq(messages.receiverId, params.receiverId));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    return await query.orderBy(desc(messages.createdAt));
  }
  
  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const [message] = await db
      .insert(messages)
      .values({
        ...insertMessage,
        isRead: false,
      })
      .returning();
    return message;
  }
  
  async markMessageAsRead(id: number): Promise<Message | undefined> {
    const [updatedMessage] = await db
      .update(messages)
      .set({ isRead: true })
      .where(eq(messages.id, id))
      .returning();
    return updatedMessage;
  }
  
  // Seller stats
  async getSellerRating(sellerId: number): Promise<{ 
    averageRating: number; 
    totalReviews: number; 
  }> {
    const sellerReviews = await this.getReviews({ sellerId });
    
    if (sellerReviews.length === 0) {
      return { averageRating: 0, totalReviews: 0 };
    }
    
    const totalRating = sellerReviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / sellerReviews.length;
    
    return {
      averageRating,
      totalReviews: sellerReviews.length
    };
  }
  
  // Advertisement operations
  async getAdvertisement(id: number): Promise<Advertisement | undefined> {
    const [ad] = await db
      .select()
      .from(advertisements)
      .where(eq(advertisements.id, id));
    return ad;
  }
  
  async getAdvertisements(params?: {
    placement?: string;
    country?: string;
    isActive?: boolean;
  }): Promise<Advertisement[]> {
    let query = db.select().from(advertisements);
    
    if (params) {
      const conditions = [];
      
      if (params.placement !== undefined) {
        conditions.push(eq(advertisements.placement, params.placement));
      }
      
      if (params.country !== undefined) {
        conditions.push(
          or(
            eq(advertisements.country, params.country),
            isNull(advertisements.country)
          )
        );
      }
      
      if (params.isActive !== undefined) {
        conditions.push(eq(advertisements.isActive, params.isActive));
      }
      
      // Only show ads that are active and within date range (if specified)
      if (params.isActive === true) {
        const currentDate = new Date();
        
        conditions.push(
          or(
            isNull(advertisements.startDate),
            lte(advertisements.startDate, currentDate)
          )
        );
        
        conditions.push(
          or(
            isNull(advertisements.endDate),
            gte(advertisements.endDate, currentDate)
          )
        );
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
    }
    
    return await query.orderBy(desc(advertisements.priority));
  }
  
  async createAdvertisement(insertAd: InsertAdvertisement): Promise<Advertisement> {
    const [ad] = await db
      .insert(advertisements)
      .values(insertAd)
      .returning();
    return ad;
  }
  
  async updateAdvertisement(id: number, adData: Partial<Advertisement>): Promise<Advertisement | undefined> {
    const [updatedAd] = await db
      .update(advertisements)
      .set({
        ...adData,
        updatedAt: new Date()
      })
      .where(eq(advertisements.id, id))
      .returning();
    return updatedAd;
  }
  
  async deleteAdvertisement(id: number): Promise<boolean> {
    const result = await db
      .delete(advertisements)
      .where(eq(advertisements.id, id))
      .returning({ id: advertisements.id });
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
