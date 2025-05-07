import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import crypto from "crypto";
import {
  insertBetCodeSchema,
  insertTransactionSchema,
  insertReviewSchema,
  insertMessageSchema,
  insertAdvertisementSchema,
  betPlatformSchema
} from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

export async function registerRoutes(app: Express): Promise<Server> {
  const { requireAuth, requireAdmin } = setupAuth(app);

  // Helper to handle validation errors
  const handleValidationError = (error: unknown, res: any) => {
    if (error instanceof ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ message: validationError.message });
    }
    throw error;
  };
  
  // Middleware to require admin token (separate from user auth)
  const requireAdminToken = (req: any, res: any, next: any) => {
    const adminToken = req.cookies.adminToken;
    if (!adminToken) {
      return res.status(401).json({ message: "Admin authentication required" });
    }
    // In a real app, you'd validate the token against a database or session store
    // For this demo, we just check if the token exists
    next();
  };

  // ADMIN DASHBOARD ROUTES (Separate admin system)
  // Admin login
  app.post("/api/admin/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      // In a real production app, you would store admin credentials securely
      // This is just for demonstration purposes
      if (username === "admin" && password === "admin123") {
        // Generate a secure token for the admin session
        const token = crypto.randomBytes(32).toString('hex');
        
        // Set the admin token in a cookie
        res.cookie('adminToken', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          maxAge: 24 * 60 * 60 * 1000, // 24 hours
        });
        
        return res.status(200).json({
          success: true,
          message: "Admin login successful"
        });
      }
      
      res.status(401).json({
        success: false,
        message: "Invalid admin credentials"
      });
    } catch (error) {
      console.error("Admin login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Admin logout
  app.post("/api/admin/logout", requireAdminToken, async (req, res) => {
    try {
      // Clear the admin token cookie
      res.clearCookie('adminToken');
      
      res.status(200).json({
        success: true,
        message: "Admin logout successful"
      });
    } catch (error) {
      console.error("Admin logout error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // ADMIN ROUTES
  // Admin: Get all users
  app.get("/api/admin/users", requireAdminToken, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error getting users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Admin: Update user
  app.patch("/api/admin/users/:id", requireAdminToken, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const updatedUser = await storage.updateUser(userId, req.body);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Admin: Get all bet codes
  app.get("/api/admin/betcodes", requireAdminToken, async (req, res) => {
    try {
      const betCodes = await storage.getBetCodes();
      res.json(betCodes);
    } catch (error) {
      console.error("Error getting bet codes:", error);
      res.status(500).json({ message: "Failed to fetch bet codes" });
    }
  });

  // Admin: Update bet code
  app.patch("/api/admin/betcodes/:id", requireAdminToken, async (req, res) => {
    try {
      const betCodeId = parseInt(req.params.id);
      const updatedBetCode = await storage.updateBetCode(betCodeId, req.body);
      
      if (!updatedBetCode) {
        return res.status(404).json({ message: "Bet code not found" });
      }
      
      res.json(updatedBetCode);
    } catch (error) {
      console.error("Error updating bet code:", error);
      res.status(500).json({ message: "Failed to update bet code" });
    }
  });

  // Admin: Get all transactions
  app.get("/api/admin/transactions", requireAdminToken, async (req, res) => {
    try {
      const transactions = await storage.getTransactions();
      res.json(transactions);
    } catch (error) {
      console.error("Error getting transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Admin: Update transaction (including payment to seller)
  app.patch("/api/admin/transactions/:id", requireAdminToken, async (req, res) => {
    try {
      const transactionId = parseInt(req.params.id);
      const transaction = await storage.getTransaction(transactionId);
      
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      
      // Update transaction status
      const updatedTransaction = await storage.updateTransaction(transactionId, {
        status: req.body.status,
        notes: req.body.notes,
        updatedAt: new Date()
      });
      
      // If marking as PAID_TO_SELLER, we need to update the seller's balance
      if (req.body.status === 'PAID_TO_SELLER' && transaction.sellerId) {
        const seller = await storage.getUser(transaction.sellerId);
        if (seller) {
          // Update seller's balance or payout record
          // This would depend on your specific implementation
          // For example, you might track payouts separately
          console.log(`Payout processed for seller ${seller.username}, amount: ${transaction.amount}`);
        }
      }
      
      res.json(updatedTransaction);
    } catch (error) {
      console.error("Error updating transaction:", error);
      res.status(500).json({ message: "Failed to update transaction" });
    }
  });

  // BET CODES ROUTES
  // Get all bet codes
  app.get("/api/betcodes", async (req, res) => {
    try {
      const { sellerId, platform, isActive, minPrice, maxPrice } = req.query;
      
      const params: any = {};
      
      if (sellerId) params.sellerId = parseInt(sellerId as string);
      if (platform) params.platform = platform;
      if (isActive !== undefined) params.isActive = isActive === 'true';
      if (minPrice) params.minPrice = parseFloat(minPrice as string);
      if (maxPrice) params.maxPrice = parseFloat(maxPrice as string);
      
      const betCodes = await storage.getBetCodes(Object.keys(params).length > 0 ? params : undefined);
      res.json(betCodes);
    } catch (error) {
      console.error("Error getting bet codes:", error);
      res.status(500).json({ message: "Failed to fetch bet codes" });
    }
  });

  // Get a specific bet code
  app.get("/api/betcodes/:id", async (req, res) => {
    try {
      const betCodeId = parseInt(req.params.id);
      const betCode = await storage.getBetCode(betCodeId);
      
      if (!betCode) {
        return res.status(404).json({ message: "Bet code not found" });
      }
      
      res.json(betCode);
    } catch (error) {
      console.error("Error getting bet code:", error);
      res.status(500).json({ message: "Failed to fetch bet code" });
    }
  });

  // Create a new bet code
  app.post("/api/betcodes", requireAuth, async (req, res) => {
    try {
      const betCodeData = insertBetCodeSchema.parse({
        ...req.body,
        sellerId: req.user.id,
      });
      
      const newBetCode = await storage.createBetCode(betCodeData);
      res.status(201).json(newBetCode);
    } catch (error) {
      handleValidationError(error, res);
    }
  });

  // Update a bet code
  app.patch("/api/betcodes/:id", requireAuth, async (req, res) => {
    try {
      const betCodeId = parseInt(req.params.id);
      const betCode = await storage.getBetCode(betCodeId);
      
      if (!betCode) {
        return res.status(404).json({ message: "Bet code not found" });
      }
      
      if (betCode.sellerId !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({ message: "Unauthorized to update this bet code" });
      }
      
      const updatedBetCode = await storage.updateBetCode(betCodeId, req.body);
      res.json(updatedBetCode);
    } catch (error) {
      console.error("Error updating bet code:", error);
      res.status(500).json({ message: "Failed to update bet code" });
    }
  });

  // Delete a bet code
  app.delete("/api/betcodes/:id", requireAuth, async (req, res) => {
    try {
      const betCodeId = parseInt(req.params.id);
      const betCode = await storage.getBetCode(betCodeId);
      
      if (!betCode) {
        return res.status(404).json({ message: "Bet code not found" });
      }
      
      if (betCode.sellerId !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({ message: "Unauthorized to delete this bet code" });
      }
      
      await storage.deleteBetCode(betCodeId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting bet code:", error);
      res.status(500).json({ message: "Failed to delete bet code" });
    }
  });

  // TRANSACTION ROUTES
  // Get transactions for the current user
  app.get("/api/transactions", requireAuth, async (req, res) => {
    try {
      const { type } = req.query;
      
      let params: any = {};
      
      if (type === 'purchases') {
        params.buyerId = req.user.id;
      } else if (type === 'sales') {
        params.sellerId = req.user.id;
      } else {
        // If no type specified, get both purchases and sales
        const purchases = await storage.getTransactions({ buyerId: req.user.id });
        const sales = await storage.getTransactions({ sellerId: req.user.id });
        return res.json([...purchases, ...sales]);
      }
      
      const transactions = await storage.getTransactions(params);
      res.json(transactions);
    } catch (error) {
      console.error("Error getting transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Create a transaction
  app.post("/api/transactions", requireAuth, async (req, res) => {
    try {
      const { betCodeId, flutterwaveRef } = insertTransactionSchema.parse(req.body);
      
      const betCode = await storage.getBetCode(betCodeId);
      if (!betCode) {
        return res.status(404).json({ message: "Bet code not found" });
      }
      
      if (betCode.sellerId === req.user.id) {
        return res.status(400).json({ message: "You cannot buy your own bet code" });
      }
      
      const serviceFee = 200; // ₦200 service fee
      const totalAmount = betCode.price + serviceFee;
      
      const transaction = await storage.createTransaction({
        buyerId: req.user.id,
        sellerId: betCode.sellerId,
        betCodeId,
        amount: totalAmount,
        flutterwaveRef,
        status: "completed", // For simplicity, marking as completed immediately
      });
      
      res.status(201).json(transaction);
    } catch (error) {
      handleValidationError(error, res);
    }
  });

  // Get a specific transaction
  app.get("/api/transactions/:id", requireAuth, async (req, res) => {
    try {
      const transactionId = parseInt(req.params.id);
      const transaction = await storage.getTransaction(transactionId);
      
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      
      // Only the buyer, seller, or admin can view a transaction
      if (transaction.buyerId !== req.user.id && 
          transaction.sellerId !== req.user.id && 
          !req.user.isAdmin) {
        return res.status(403).json({ message: "Unauthorized to view this transaction" });
      }
      
      res.json(transaction);
    } catch (error) {
      console.error("Error getting transaction:", error);
      res.status(500).json({ message: "Failed to fetch transaction" });
    }
  });

  // REVIEW ROUTES
  // Get reviews for a seller
  app.get("/api/sellers/:id/reviews", async (req, res) => {
    try {
      const sellerId = parseInt(req.params.id);
      const user = await storage.getUser(sellerId);
      
      if (!user) {
        return res.status(404).json({ message: "Seller not found" });
      }
      
      const reviews = await storage.getReviews({ sellerId });
      res.json(reviews);
    } catch (error) {
      console.error("Error getting reviews:", error);
      res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });

  // Create a review
  app.post("/api/reviews", requireAuth, async (req, res) => {
    try {
      const reviewData = insertReviewSchema.parse({
        ...req.body,
        reviewerId: req.user.id,
      });
      
      // Check if seller exists
      const seller = await storage.getUser(reviewData.sellerId);
      if (!seller) {
        return res.status(404).json({ message: "Seller not found" });
      }
      
      // If betCodeId is provided, check if it exists
      if (reviewData.betCodeId) {
        const betCode = await storage.getBetCode(reviewData.betCodeId);
        if (!betCode) {
          return res.status(404).json({ message: "Bet code not found" });
        }
        
        // Verify the reviewer has purchased this bet code
        const transactions = await storage.getTransactions({
          buyerId: req.user.id,
          betCodeId: reviewData.betCodeId,
          status: "completed"
        });
        
        if (transactions.length === 0) {
          return res.status(403).json({ message: "You can only review bet codes you've purchased" });
        }
      }
      
      const newReview = await storage.createReview(reviewData);
      res.status(201).json(newReview);
    } catch (error) {
      handleValidationError(error, res);
    }
  });

  // USER ROUTES
  // Update user profile
  app.patch("/api/users/profile", requireAuth, async (req, res) => {
    try {
      const allowedUpdates = ['fullName', 'bankDetails'];
      const updates: Record<string, any> = {};
      
      allowedUpdates.forEach(field => {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      });
      
      const updatedUser = await storage.updateUser(req.user.id, updates);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Remove password from response
      const { password, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Get seller profile
  app.get("/api/sellers/:id", async (req, res) => {
    try {
      const sellerId = parseInt(req.params.id);
      const user = await storage.getUser(sellerId);
      
      if (!user) {
        return res.status(404).json({ message: "Seller not found" });
      }
      
      // Get seller rating
      const rating = await storage.getSellerRating(sellerId);
      
      // Get active bet codes
      const betCodes = await storage.getBetCodes({ 
        sellerId, 
        isActive: true 
      });
      
      // Remove sensitive info
      const { password, bankDetails, isAdmin, ...sellerProfile } = user;
      
      res.json({
        ...sellerProfile,
        rating: rating.averageRating,
        totalReviews: rating.totalReviews,
        activeBetCodes: betCodes.length
      });
    } catch (error) {
      console.error("Error getting seller profile:", error);
      res.status(500).json({ message: "Failed to fetch seller profile" });
    }
  });

  // MESSAGES ROUTES
  // Get messages between two users
  app.get("/api/messages/:userId", requireAuth, async (req, res) => {
    try {
      const otherUserId = parseInt(req.params.userId);
      const currentUserId = req.user.id;
      
      // Get messages sent by current user to other user
      const sentMessages = await storage.getMessages({
        senderId: currentUserId,
        receiverId: otherUserId
      });
      
      // Get messages sent by other user to current user
      const receivedMessages = await storage.getMessages({
        senderId: otherUserId,
        receiverId: currentUserId
      });
      
      // Combine and sort by creation date
      const allMessages = [...sentMessages, ...receivedMessages]
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      
      res.json(allMessages);
    } catch (error) {
      console.error("Error getting messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // Send a message
  app.post("/api/messages", requireAuth, async (req, res) => {
    try {
      const messageData = insertMessageSchema.parse({
        ...req.body,
        senderId: req.user.id
      });
      
      // Check if receiver exists
      const receiver = await storage.getUser(messageData.receiverId);
      if (!receiver) {
        return res.status(404).json({ message: "Recipient not found" });
      }
      
      const newMessage = await storage.createMessage(messageData);
      res.status(201).json(newMessage);
    } catch (error) {
      handleValidationError(error, res);
    }
  });

  // Mark message as read
  app.patch("/api/messages/:id/read", requireAuth, async (req, res) => {
    try {
      const messageId = parseInt(req.params.id);
      const message = await storage.getMessage(messageId);
      
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }
      
      if (message.receiverId !== req.user.id) {
        return res.status(403).json({ message: "You can only mark messages sent to you as read" });
      }
      
      const updatedMessage = await storage.markMessageAsRead(messageId);
      res.json(updatedMessage);
    } catch (error) {
      console.error("Error marking message as read:", error);
      res.status(500).json({ message: "Failed to mark message as read" });
    }
  });

  // ADMIN ROUTES
  // Get all users (admin only)
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const users = Array.from(storage["users"].values())
        .map(({ password, ...user }) => user);
      res.json(users);
    } catch (error) {
      console.error("Error getting users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });
  
  // Get all bet codes (admin only)
  app.get("/api/admin/betcodes", requireAdmin, async (req, res) => {
    try {
      const betCodes = await storage.getBetCodes();
      res.json(betCodes);
    } catch (error) {
      console.error("Error getting bet codes:", error);
      res.status(500).json({ message: "Failed to fetch bet codes" });
    }
  });

  // Get all transactions (admin only)
  app.get("/api/admin/transactions", requireAdmin, async (req, res) => {
    try {
      const transactions = await storage.getTransactions();
      res.json(transactions);
    } catch (error) {
      console.error("Error getting transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // PLATFORM CONSTANTS
  app.get("/api/platforms", (req, res) => {
    try {
      res.json(betPlatformSchema.options);
    } catch (error) {
      console.error("Error getting platforms:", error);
      res.status(500).json({ message: "Failed to fetch platforms" });
    }
  });

  // ADVERTISEMENT ROUTES
  // Get active advertisements for user views
  app.get("/api/advertisements", async (req, res) => {
    try {
      const { placement, country } = req.query;
      
      const params: any = {
        isActive: true
      };
      
      if (placement) params.placement = placement as string;
      if (country) params.country = country as string;
      
      const advertisements = await storage.getAdvertisements(params);
      res.json(advertisements);
    } catch (error) {
      console.error("Error getting advertisements:", error);
      res.status(500).json({ message: "Failed to fetch advertisements" });
    }
  });

  // ADMIN ADVERTISEMENT ROUTES
  // Admin: Get all advertisements
  app.get("/api/admin/advertisements", requireAdmin, async (req, res) => {
    try {
      const advertisements = await storage.getAdvertisements();
      res.json(advertisements);
    } catch (error) {
      console.error("Error getting advertisements:", error);
      res.status(500).json({ message: "Failed to fetch advertisements" });
    }
  });

  // Admin: Get a specific advertisement
  app.get("/api/admin/advertisements/:id", requireAdmin, async (req, res) => {
    try {
      const advertisementId = parseInt(req.params.id);
      const advertisement = await storage.getAdvertisement(advertisementId);
      
      if (!advertisement) {
        return res.status(404).json({ message: "Advertisement not found" });
      }
      
      res.json(advertisement);
    } catch (error) {
      console.error("Error getting advertisement:", error);
      res.status(500).json({ message: "Failed to fetch advertisement" });
    }
  });

  // Admin: Create a new advertisement
  app.post("/api/admin/advertisements", requireAdmin, async (req, res) => {
    try {
      const advertisementData = insertAdvertisementSchema.parse(req.body);
      
      const newAdvertisement = await storage.createAdvertisement(advertisementData);
      res.status(201).json(newAdvertisement);
    } catch (error) {
      handleValidationError(error, res);
    }
  });

  // Admin: Update an advertisement
  app.patch("/api/admin/advertisements/:id", requireAdmin, async (req, res) => {
    try {
      const advertisementId = parseInt(req.params.id);
      const advertisement = await storage.getAdvertisement(advertisementId);
      
      if (!advertisement) {
        return res.status(404).json({ message: "Advertisement not found" });
      }
      
      const updatedAdvertisement = await storage.updateAdvertisement(advertisementId, req.body);
      res.json(updatedAdvertisement);
    } catch (error) {
      console.error("Error updating advertisement:", error);
      res.status(500).json({ message: "Failed to update advertisement" });
    }
  });

  // Admin: Delete an advertisement
  app.delete("/api/admin/advertisements/:id", requireAdmin, async (req, res) => {
    try {
      const advertisementId = parseInt(req.params.id);
      const advertisement = await storage.getAdvertisement(advertisementId);
      
      if (!advertisement) {
        return res.status(404).json({ message: "Advertisement not found" });
      }
      
      await storage.deleteAdvertisement(advertisementId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting advertisement:", error);
      res.status(500).json({ message: "Failed to delete advertisement" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
