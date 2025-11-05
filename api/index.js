// api/index.js
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const path = require("path");
const Assignment = require("../models/Assignment");
const User = require("../models/User");
const methodOverride = require("method-override");
const passport = require("passport");
const { Strategy: GoogleStrategy } = require("passport-google-oauth20");
const serverless = require("serverless-http");

const app = express();

// Middleware
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(methodOverride("_method"));

// EJS setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));

// Public and Uploads (uploads work locally only)
app.use(express.static(path.join(__dirname, "../public")));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// ===== MongoDB Atlas Connection =====
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Atlas Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err.message));

// ===== Sessions =====
app.set("trust proxy", 1);
app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: "sessions",
    }),
    cookie: {
      secure: true,
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

// ===== Passport Config =====
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ googleId: profile.id });
        if (!user) {
          user = await User.create({
            googleId: profile.id,
            name: profile.displayName,
            email: profile.emails[0].value,
            isAdmin: false,
          });
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

// ===== Multer for Uploads =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// ===== Middlewares =====
function isAuthenticated(req, res, next) {
  if (req.session.user) return next();
  res.redirect("/login");
}
function isAdmin(req, res, next) {
  if (req.session.user && req.session.user.isAdmin) return next();
  res.status(403).send("Forbidden");
}

// ===== Routes =====

// Google login
app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));
app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    req.session.user = req.user;
    res.redirect("/");
  }
);

// Home
app.get("/", async (req, res) => {
  const assignments = await Assignment.find().populate("postedBy").sort({ createdAt: -1 });
  res.render("index", { assignments, user: req.session.user });
});

// Login
app.get("/login", (req, res) => res.render("login", { error: null, user: req.session.user || null }));
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.render("login", { error: "User does not exist" });
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.render("login", { error: "Wrong email or password" });
  req.session.user = user;
  res.redirect("/");
});

// Signup
app.get("/signup", (req, res) => res.render("signup", { error: null, user: req.session.user || null }));
app.post("/signup", async (req, res) => {
  const { name, email, password, college, course } = req.body;
  const existing = await User.findOne({ email });
  if (existing) return res.render("signup", { error: "User already exists" });
  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, password: hashed, college, course });
  req.session.user = user;
  res.redirect("/");
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

// Profile
app.get("/profile", isAuthenticated, async (req, res) => {
  const user = await User.findById(req.session.user._id);
  const assignments = await Assignment.find({ postedBy: user._id });
  res.render("profile", { user, assignments, loggedInUser: req.session.user });
});

// Post Assignment
app.get("/post", isAuthenticated, (req, res) => res.render("post", { user: req.session.user }));
app.post("/assignments", isAuthenticated, upload.single("attachment"), async (req, res) => {
  let { title, subject, customSubject, deadline, budget, description, comments, phone } = req.body;
  if (subject === "Other" && customSubject) subject = customSubject;
  await Assignment.create({
    title,
    subject,
    customSubject,
    deadline,
    budget,
    description,
    comments,
    phone,
    attachment: req.file ? req.file.filename : null,
    postedBy: req.session.user._id,
  });
  res.redirect("/");
});

// Admin
app.get("/admin/assignments", isAdmin, async (req, res) => {
  const assignments = await Assignment.find().populate("postedBy");
  res.render("admin_assignments", { assignments, user: req.session.user });
});
app.post("/admin/assignments/:id/:action", isAdmin, async (req, res) => {
  const { id, action } = req.params;
  const update = action === "accept" ? { status: "accepted" } : { status: "rejected" };
  await Assignment.findByIdAndUpdate(id, update);
  res.redirect("/admin/assignments");
});

// Health check (optional)
app.get("/health", (req, res) => res.json({ ok: true }));

// Export to Vercel
module.exports = serverless(app);


// If not running on Vercel, start a local server manually
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
}

