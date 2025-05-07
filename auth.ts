import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser, InsertUser, insertUserSchema, loginSchema } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import crypto from "crypto";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Generate a random verification token
function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Create a verification URL
function getVerificationUrl(token: string): string {
  // Use the current hostname from environment or fallback to localhost
  const host = process.env.REPLIT_DEPLOYMENT_URL || process.env.BASE_URL || `http://localhost:5000`;
  // Return full verification URL with token
  return `${host}/verify-email?token=${token}`;
}

// Simulate sending an email verification (in a real app, this would use SendGrid)
function sendVerificationEmail(email: string, verificationUrl: string): void {
  // Enhanced console output for easier debugging
  console.log("=========== EMAIL VERIFICATION ==========");
  console.log(`TO: ${email}`);
  console.log(`SUBJECT: Verify your BetCode Marketplace account`);
  console.log(`CONTENT:`);
  console.log(`Hello,`);
  console.log(`Thank you for registering on BetCode Marketplace. Please verify your email address by clicking the link below:`);
  console.log(`${verificationUrl}`);
  console.log(`This link will expire in 24 hours.`);
  console.log(`If you did not sign up for BetCode Marketplace, please ignore this email.`);
  console.log(`Best regards,`);
  console.log(`The BetCode Marketplace Team`);
  console.log("========================================");
  
  // In a production environment, this would use a service like SendGrid:
  // const msg = {
  //   to: email,
  //   from: 'noreply@betcodemarketplace.com',
  //   subject: 'Verify your BetCode Marketplace account',
  //   text: `Please verify your email by clicking this link: ${verificationUrl}`,
  //   html: `<p>Please verify your email by clicking <a href="${verificationUrl}">this link</a>.</p>`,
  // };
  // sendgrid.send(msg);
}

export function setupAuth(app: Express) {
  const sessionSecret = process.env.SESSION_SECRET || "betcode-marketplace-secret";
  
  const sessionSettings: session.SessionOptions = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      secure: process.env.NODE_ENV === 'production',
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false, { message: "Invalid username or password" });
        } else {
          return done(null, user);
        }
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Register a new user
  app.post("/api/register", async (req, res, next) => {
    try {
      // Validate request body
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user exists
      const existingUserByUsername = await storage.getUserByUsername(userData.username);
      if (existingUserByUsername) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      const existingUserByEmail = await storage.getUserByEmail(userData.email);
      if (existingUserByEmail) {
        return res.status(400).json({ message: "Email already exists" });
      }

      // Generate verification token
      const verificationToken = generateVerificationToken();
      const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Create user with hashed password and verification token
      const user = await storage.createUser({
        ...userData,
        password: await hashPassword(userData.password),
      });

      // Update user with verification token
      await storage.updateUser(user.id, {
        verificationToken,
        verificationTokenExpiry,
        isEmailVerified: false
      });

      // Send verification email
      const verificationUrl = getVerificationUrl(verificationToken);
      sendVerificationEmail(user.email, verificationUrl);

      // Remove password from response
      const { password, ...userWithoutPassword } = user;

      // Log in the user
      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json({
          ...userWithoutPassword,
          message: "Account created successfully. Please check your email to verify your account."
        });
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      next(error);
    }
  });

  // Login
  app.post("/api/login", (req, res, next) => {
    try {
      // Validate request body
      loginSchema.parse(req.body);
      
      passport.authenticate("local", (err: Error, user: SelectUser | false, info: { message: string }) => {
        if (err) return next(err);
        if (!user) return res.status(401).json({ message: info.message || "Invalid credentials" });
        
        req.login(user, (err) => {
          if (err) return next(err);
          
          // Remove password from response
          const { password, ...userWithoutPassword } = user;
          res.status(200).json(userWithoutPassword);
        });
      })(req, res, next);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      next(error);
    }
  });

  // Logout
  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy((err) => {
        if (err) return next(err);
        res.sendStatus(200);
      });
    });
  });

  // Get current user
  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    // Remove password from response
    const { password, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
  });

  // Request new verification email
  app.post("/api/resend-verification", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "You must be logged in to request a verification email" });
      }
      
      const user = req.user;
      
      // Check if email is already verified
      if (user.isEmailVerified) {
        return res.status(400).json({ message: "Your email is already verified" });
      }
      
      // Generate new verification token
      const verificationToken = generateVerificationToken();
      const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      // Update user with new verification token
      await storage.updateUser(user.id, {
        verificationToken,
        verificationTokenExpiry
      });
      
      // Send verification email
      const verificationUrl = getVerificationUrl(verificationToken);
      sendVerificationEmail(user.email, verificationUrl);
      
      res.status(200).json({ message: "Verification email sent successfully. Please check your inbox." });
    } catch (error) {
      next(error);
    }
  });
  
  // Email verification route
  app.get("/verify-email", async (req, res) => {
    try {
      const { token } = req.query;
      
      if (!token || typeof token !== 'string') {
        return res.status(400).send(`
          <html>
            <head>
              <title>Email Verification Failed</title>
              <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                .error { color: #e53e3e; }
                a { color: #3182ce; text-decoration: none; }
              </style>
            </head>
            <body>
              <h1 class="error">Invalid Verification Link</h1>
              <p>The verification link you clicked is invalid or has expired.</p>
              <p><a href="/">Return to Home Page</a></p>
            </body>
          </html>
        `);
      }

      // Find user with this token
      const users = await storage.getUserByVerificationToken(token);
      
      if (!users || users.length === 0) {
        return res.status(404).send(`
          <html>
            <head>
              <title>Email Verification Failed</title>
              <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                .error { color: #e53e3e; }
                a { color: #3182ce; text-decoration: none; }
              </style>
            </head>
            <body>
              <h1 class="error">Invalid Verification Link</h1>
              <p>The verification link you clicked is invalid or has expired.</p>
              <p><a href="/">Return to Home Page</a></p>
            </body>
          </html>
        `);
      }

      const user = users[0];
      
      // Check if token has expired
      if (user.verificationTokenExpiry && new Date(user.verificationTokenExpiry) < new Date()) {
        return res.status(400).send(`
          <html>
            <head>
              <title>Email Verification Failed</title>
              <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                .error { color: #e53e3e; }
                a { color: #3182ce; text-decoration: none; }
              </style>
            </head>
            <body>
              <h1 class="error">Verification Link Expired</h1>
              <p>The verification link has expired. Please request a new one.</p>
              <p><a href="/">Return to Home Page</a></p>
            </body>
          </html>
        `);
      }

      // Verify the user's email
      await storage.updateUser(user.id, {
        isEmailVerified: true,
        verificationToken: null,
        verificationTokenExpiry: null
      });

      // Return success page
      res.status(200).send(`
        <html>
          <head>
            <title>Email Verified Successfully</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              .success { color: #38a169; }
              a { color: #3182ce; text-decoration: none; }
            </style>
          </head>
          <body>
            <h1 class="success">Email Verified Successfully!</h1>
            <p>Your email has been verified. You can now enjoy full access to BetCode Marketplace.</p>
            <p><a href="/dashboard">Go to Dashboard</a></p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Email verification error:", error);
      res.status(500).send(`
        <html>
          <head>
            <title>Email Verification Error</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              .error { color: #e53e3e; }
              a { color: #3182ce; text-decoration: none; }
            </style>
          </head>
          <body>
            <h1 class="error">Verification Error</h1>
            <p>An error occurred during email verification. Please try again later.</p>
            <p><a href="/">Return to Home Page</a></p>
          </body>
        </html>
      `);
    }
  });

  // Auth middleware
  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  };

  // Admin middleware
  const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated() || !req.user.isAdmin) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };

  return { requireAuth, requireAdmin };
}
