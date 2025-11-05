/*require("dotenv").config();

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const path = require('path');
const Assignment = require('./models/Assignment');
const User = require('./models/User');
const methodOverride = require('method-override');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const app = express();

// Initialize basic middleware
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(methodOverride('_method'));

// MongoDB connection URLs
const MONGODB_ATLAS_URL = process.env.MONGO_URI;
const MONGODB_LOCAL_URL = 'mongodb://127.0.0.1:27017/assignmentlikho';

// MongoDB connection options
const mongoOptions = {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
  retryWrites: true,
  w: 'majority',
  maxPoolSize: 10,
  minPoolSize: 1
};

// Initialize the application with database connection
const initializeApp = async () => {
  let isAtlasConnection = false;

  // Try Atlas first
  try {
    await mongoose.connect(MONGODB_ATLAS_URL, {
      ...mongoOptions,
      ssl: true,
      tls: true,
    });
    console.log('✅ MongoDB Atlas Connected');
    isAtlasConnection = true;
  } catch (atlasErr) {
    console.log('⚠️ Could not connect to MongoDB Atlas. Error:', atlasErr.message);
    console.log('⏳ Trying local MongoDB connection...');
    
    // Try local as fallback
   try {
      await mongoose.connect(MONGODB_LOCAL_URL, {
        ...mongoOptions,
        ssl: false,
        tls: false
      });
      console.log('✅ Local MongoDB Connected');
    } catch (localErr) {
      console.error('❌ MongoDB Connection Failed');
      process.exit(1);
    }
  }

  // ✅ Session setup
  const sessionOptions = {
    secret: 'secret',
    resave: false,
    saveUninitialized: false
  };

  // Use different session stores based on connection type
  if (isAtlasConnection) {
    sessionOptions.store = MongoStore.create({
      mongoUrl: MONGODB_ATLAS_URL,
      collection: 'sessions',
      ttl: 24 * 60 * 60, // 1 day
      ssl: true,
      tls: true
    });
  } else {
    // Use memory store for local development
    const MemoryStore = require('memorystore')(session);
    sessionOptions.store = new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    });
  }

  app.use(session(sessionOptions));

  // Initialize Passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Start server
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
};

// Start the application
initializeApp().catch(err => {
  console.error('Failed to initialize application:', err);
  process.exit(1);
});
app.use(session({
  secret: 'secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    collectionName: 'sessions'
  })
}));

// ✅ Initialize passport after session middleware
app.use(passport.initialize());
app.use(passport.session());

// ✅ Passport configuration
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// ✅ Google OAuth Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
  },
  async function(accessToken, refreshToken, profile, done) {
    try {
      let user = await User.findOne({ googleId: profile.id });
      if (user) return done(null, user);

      user = new User({
        googleId: profile.id,
        name: profile.displayName,
        email: profile.emails[0].value,
        isAdmin: false
      });

      await user.save();
      done(null, user);
    } catch (err) {
      done(err);
    }
  }
));




app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(methodOverride('_method'));

// Google Auth Routes
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home
    req.session.user = req.user;
    res.redirect('/');
  }
);


// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

function isAdmin(req, res, next) {
    if (req.session.user && req.session.user.isAdmin) return next();
    res.status(403).send('Forbidden');
  }
  
  app.get('/admin/assignments', isAdmin, async (req, res) => {
    const assignments = await Assignment.find().populate('postedBy');
    res.render('admin_assignments', { assignments, user: req.session.user });
  });
  
  app.post('/admin/assignments/:id/:action', isAdmin, async (req, res) => {
    const { id, action } = req.params;
    if (action === 'accept') {
      await Assignment.findByIdAndUpdate(id, { status: 'accepted', notification: true });
    } else if (action === 'reject') {
      await Assignment.findByIdAndUpdate(id, { status: 'rejected', notification: true });
    }
    res.redirect('/admin/assignments');
  })

// Middleware for authentication
function isAuthenticated(req, res, next) {
  console.log('isAuthenticated:', req.session.user);
  if (req.session.user) return next();
  res.redirect('/login');
}

app.get('/profile', isAuthenticated, async (req, res) => {
    try {
        console.log('GET /profile route hit');
        if (!req.session.user) {
            console.log('No user in session');
            return res.redirect('/login');
        }
        const user = await User.findById(req.session.user._id);
        if (!user) {
            console.log('No user found in DB');
            return res.redirect('/login');
        }
        const assignments = await Assignment.find({ postedBy: user._id });
        console.log('User from DB:', JSON.stringify(user, null, 2));
        console.log('User college:', user.college);
        console.log('User course:', user.course);
        res.render('profile', { user, assignments, loggedInUser: req.session.user });
    } catch (err) {
        console.error('Error in /profile:', err);
        res.status(500).send('Server error');
    }
});

app.get('/profile/:id', async (req, res) => {
    try {
        console.log('GET /profile/:id route hit');
        const user = await User.findById(req.params.id);
        if (!user) {
            console.log('No user found in DB for id:', req.params.id);
            return res.status(404).send('User not found');
        }
        const assignments = await Assignment.find({ postedBy: user._id }).populate('postedBy');
        console.log('User from DB (by id):', user);
        res.render('profile', { user, assignments, loggedInUser: req.session.user });
    } catch (err) {
        console.error('Error in /profile/:id:', err);
        res.status(500).send('Server error');
    }
});

// server.js
app.get('/', async (req, res) => {
    const assignments = await Assignment.find().populate('postedBy').sort({ createdAt: -1 });
    res.render('index', { assignments, user: req.session.user });
  });

// Post Assignment page
app.get('/post', isAuthenticated, (req, res) => {
  res.render('post', { user: req.session.user });
});

// Handle assignment submission
app.post('/assignments', isAuthenticated, upload.single('attachment'), async (req, res) => {
  let { title, subject, customSubject, deadline, budget, description, comments, phone } = req.body;
  if (subject === 'Other' && customSubject) {
    subject = customSubject;
  }
  await Assignment.create({
    title,
    subject,
    customSubject: customSubject || '',
    deadline,
    budget,
    description,
    comments,
    phone,
    attachment: req.file ? req.file.filename : null,
    postedBy: req.session.user._id
  });
  res.redirect('/');
});





// Login page
app.get('/login', (req, res) => {
  console.log('GET /login route hit');
  res.render('login', { error: null, user: req.session.user || null });
});

// Handle login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    return res.render('login', { error: 'User does not exist', user: null });
  }
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.render('login', { error: 'Wrong email or password', user: null });
  }
  req.session.user = user;
  res.redirect('/');
});

// Signup page
app.get('/signup', (req, res) => {
  res.render('signup', { error: null, user: req.session.user || null });
});

// Handle signup
app.post('/signup', async (req, res) => {
  console.log('Signup form data:', req.body);
  const { name, email, password, college, course } = req.body;
  console.log('Extracted college:', college);
  console.log('Extracted course:', course);
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render('signup', { error: 'User already exists', user: null });
    }
    const user = await User.create({ name, email, password: hashedPassword, college, course });
    console.log('Created user:', JSON.stringify(user, null, 2));
    req.session.user = user;
    res.redirect('/');
  } catch (e) {
    console.error('Signup error:', e);
    res.render('signup', { error: 'An error occurred. Please try again.', user: null });
  }
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Profile image upload route
app.post('/profile/upload-image', isAuthenticated, upload.single('profileImage'), async (req, res) => {
  if (!req.file) return res.redirect('/profile');
  await User.findByIdAndUpdate(req.session.user._id, { profileImage: 'uploads/' + req.file.filename });
  // Update session user object
  req.session.user.profileImage = 'uploads/' + req.file.filename;
  res.redirect('/profile');
});

// Edit profile (name and image)
app.post('/profile/edit', isAuthenticated, upload.single('profileImage'), async (req, res) => {
  const update = { name: req.body.name, college: req.body.college, course: req.body.course };
  if (req.file) {
    update.profileImage = 'uploads/' + req.file.filename;
    req.session.user.profileImage = update.profileImage;
  }
  await User.findByIdAndUpdate(req.session.user._id, update);
  req.session.user.name = req.body.name;
  req.session.user.college = req.body.college;
  req.session.user.course = req.body.course;
  res.redirect('/profile');
});

// Edit assignment form
app.get('/assignments/:id/edit', isAuthenticated, async (req, res) => {
  const assignment = await Assignment.findById(req.params.id);
  if (!assignment || assignment.postedBy.toString() !== req.session.user._id.toString()) {
    return res.status(403).send('Forbidden');
  }
  res.render('edit_assignment', { assignment, user: req.session.user });
});

// Handle edit assignment
app.post('/assignments/:id/edit', isAuthenticated, upload.single('attachment'), async (req, res) => {
  const assignment = await Assignment.findById(req.params.id);
  if (!assignment || assignment.postedBy.toString() !== req.session.user._id.toString()) {
    return res.status(403).send('Forbidden');
  }
  let { title, subject, customSubject, deadline, description, comments, phone } = req.body;
  if (subject === 'Other' && customSubject) {
    subject = customSubject;
  }
  assignment.title = title;
  assignment.subject = subject;
  assignment.customSubject = customSubject || '';
  assignment.deadline = deadline;
  assignment.description = description;
  assignment.comments = comments;
  assignment.phone = phone;
  if (req.file) {
    assignment.attachment = req.file.filename;
  }
  await assignment.save();
  res.redirect('/profile');
});

// Delete assignment
app.delete('/assignments/:id', isAuthenticated, async (req, res) => {
  const assignment = await Assignment.findById(req.params.id);
  if (!assignment || assignment.postedBy.toString() !== req.session.user._id.toString()) {
    return res.status(403).send('Forbidden');
  }
  await Assignment.findByIdAndDelete(req.params.id);
  res.redirect('/profile');
});

app.listen(5000, () => console.log('Server started on http://localhost:5000'));*/


