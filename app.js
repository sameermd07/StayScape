const express = require('express');
const app = express();
const path = require('path');
const mongoose = require('mongoose');
const { listing } = require("./Models/listing.js");
const { Review } = require("./Models/reviews.js");
const { User } = require("./Models/User.js");
const { connectDb } = require('./Models/ConnectDb.js');
const { sampleListings } = require("./init/listingData.js");
const methodOverride = require('method-override');
const ejsMate = require('ejs-mate');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

// ─── View Engine ───────────────────────────────────────────────────────────────
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.engine("ejs", ejsMate);

// ─── Parsers ───────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));
app.use(cookieParser());

// ─── JWT Secret ────────────────────────────────────────────────────────────────
const JWT_SECRET = "your_jwt_secret_key_change_this_in_production";

// ─── Simple Session for Flash Messages ─────────────────────────────────────────
app.use((req, res, next) => {
    if (!req.session) req.session = {};
    next();
});

// ─── Authentication Middleware ─────────────────────────────────────────────────
const authMiddleware = async (req, res, next) => {
    try {
        const token = req.cookies.token;
        
        if (!token) {
            req.user = null;
            return next();
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');
        req.user = user;
        next();
    } catch (error) {
        req.user = null;
        next();
    }
};

// ─── isLoggedIn Middleware ────────────────────────────────────────────────────
const isLoggedIn = (req, res, next) => {
    if (!req.user) {
        req.session.flash = { error: "You must be logged in to do that!" };
        return res.redirect("/login");
    }
    next();
};

// ─── Flash Message Helper ──────────────────────────────────────────────────────
const setFlash = (req, type, message) => {
    if (!req.session) req.session = {};
    if (!req.session.flash) req.session.flash = {};
    req.session.flash[type] = message;
};

// ─── Globals in every view ────────────────────────────────────────────────────
app.use(authMiddleware);
app.use((req, res, next) => {
    res.locals.currentUser = req.user || null;
    res.locals.currentPath = req.path;
    res.locals.formData = req.session.formData || null;
    delete req.session.formData;

    // Handle flash messages
    const flash = req.session?.flash || {};
    res.locals.successMsg = flash.success || null;
    res.locals.errorMsg = flash.error || null;
    delete req.session.flash;

    next();
});

// ─── DB Connection ────────────────────────────────────────────────────────────
connectDb();

// Seed listings (optional - remove in production)
(async () => {
    try {
        const count = await listing.countDocuments();
        if (count === 0) {
            await listing.insertMany(sampleListings);
            console.log("Sample listings seeded ✅");
        }
    } catch (err) {
        console.error("Failed to seed listings:", err);
    }
})();

// ══════════════════════════════════════════════════════════════════════════════
//  AUTH ROUTES
// ══════════════════════════════════════════════════════════════════════════════

app.get("/signup", (req, res) => {
    res.render("Auth/signup");
});

app.post("/signup", async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            req.session.formData = { email };
            setFlash(req, "error", "Email and password are required");
            return res.redirect("/signup");
        }

        if (password.length < 6) {
            req.session.formData = { email };
            setFlash(req, "error", "Password must be at least 6 characters");
            return res.redirect("/signup");
        }

        // Check if user exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            req.session.formData = { email };
            setFlash(req, "error", "Email already registered");
            return res.redirect("/signup");
        }

        // Create user
        const user = new User({
            email: email.toLowerCase(),
            password
        });

        await user.save();

        // Generate token
        const token = jwt.sign(
            { userId: user._id, email: user.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Set cookie
        res.cookie('token', token, {
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60 * 1000,
            sameSite: 'lax'
        });

        setFlash(req, "success", `Welcome to WonderLust, ${email}! 🎉`);
        res.redirect("/listings");
        
    } catch (error) {
        console.error("Signup error:", error);
        setFlash(req, "error", "An error occurred during signup");
        res.redirect("/signup");
    }
});

app.get("/login", (req, res) => {
    res.render("Auth/login");
});

app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            req.session.formData = { email };
            setFlash(req, "error", "Email and password are required");
            return res.redirect("/login");
        }

        // Find user
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            req.session.formData = { email };
            setFlash(req, "error", "Invalid email or password");
            return res.redirect("/login");
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            req.session.formData = { email };
            setFlash(req, "error", "Invalid email or password");
            return res.redirect("/login");
        }

        // Generate token
        const token = jwt.sign(
            { userId: user._id, email: user.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Set cookie
        res.cookie('token', token, {
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60 * 1000,
            sameSite: 'lax'
        });

        setFlash(req, "success", `Welcome back, ${email}! 👋`);
        res.redirect("/listings");
        
    } catch (error) {
        console.error("Login error:", error);
        setFlash(req, "error", "An error occurred during login");
        res.redirect("/login");
    }
});

app.get("/logout", (req, res) => {
    res.clearCookie('token');
    setFlash(req, "success", "You have been logged out. See you soon!");
    res.redirect("/login");
});

// ══════════════════════════════════════════════════════════════════════════════
//  LISTING ROUTES
// ══════════════════════════════════════════════════════════════════════════════

app.get("/", (req, res) => res.redirect("/listings"));

app.get("/listings", async (req, res, next) => {
    try {
        let allListings = await listing.find({});
        res.render("Listing/index", { allListings });
    } catch (err) {
        console.error(err);
        setFlash(req, "error", "Failed to fetch listings");
        res.redirect("/");
    }
});

app.get("/listings/new", isLoggedIn, (req, res) => {
    res.render("Listing/new");
});

app.get("/listings/:id",async (req, res, next) => {
    try {
        const { id } = req.params;
        const curr = await listing.findById(id).populate("reviews");
        if (!curr) {
            setFlash(req, "error", "Listing not found");
            return res.redirect("/listings");
        }
        res.render("Listing/show", { curr });
    } catch (err) {
        console.error(err);
        setFlash(req, "error", "Invalid listing ID");
        res.redirect("/listings");
    }
});

app.post("/listings", isLoggedIn, async (req, res, next) => {
    try {
        const newListing = new listing(req.body);
        await newListing.save();
        setFlash(req, "success", "New listing created successfully! 🏠");
        res.redirect(`/listings/${newListing._id}`);
    } catch (err) {
        console.error(err);
        setFlash(req, "error", "Failed to create listing");
        res.redirect("/listings/new");
    }
});

app.get("/listings/:id/edit", isLoggedIn, async (req, res, next) => {
    try {
        const { id } = req.params;
        const curr = await listing.findById(id);
        if (!curr) {
            setFlash(req, "error", "Listing not found");
            return res.redirect("/listings");
        }
        res.render("Listing/edit", { curr });
    } catch (err) {
        console.error(err);
        setFlash(req, "error", "Invalid listing ID");
        res.redirect("/listings");
    }
});

app.put("/listings/:id", isLoggedIn, async (req, res, next) => {
    try {
        const { id } = req.params;
        const updatedListing = await listing.findByIdAndUpdate(
            id, 
            { $set: req.body }, 
            { new: true, runValidators: true }
        );
        if (!updatedListing) {
            setFlash(req, "error", "Listing not found");
            return res.redirect("/listings");
        }
        setFlash(req, "success", "Listing updated successfully! ✅");
        res.redirect(`/listings/${id}`);
    } catch (err) {
        console.error(err);
        setFlash(req, "error", "Failed to update listing");
        res.redirect(`/listings/${req.params.id}/edit`);
    }
});

app.delete("/listings/:id", isLoggedIn, async (req, res, next) => {
    try {
        const { id } = req.params;
        const deletedListing = await listing.findByIdAndDelete(id);
        if (!deletedListing) {
            setFlash(req, "error", "Listing not found");
            return res.redirect("/listings");
        }
        await Review.deleteMany({ listing: id });
        setFlash(req, "success", "Listing deleted successfully.");
        res.redirect("/listings");
    } catch (err) {
        console.error(err);
        setFlash(req, "error", "Failed to delete listing");
        res.redirect("/listings");
    }
});

// ══════════════════════════════════════════════════════════════════════════════
//  REVIEW ROUTES
// ══════════════════════════════════════════════════════════════════════════════

app.post("/listings/:id/reviews", isLoggedIn, async (req, res, next) => {
    try {
        const { id } = req.params;
        const currListing = await listing.findById(id);
        if (!currListing) {
            setFlash(req, "error", "Listing not found");
            return res.redirect("/listings");
        }
        
        const newReview = new Review({
            comment: req.body.comment,
            rating: req.body.rating,
            listing: id
        });
        
        await newReview.save();
        currListing.reviews.push(newReview._id);
        await currListing.save();
        
        setFlash(req, "success", "Review added! ⭐");
        res.redirect(`/listings/${id}`);
    } catch (err) {
        console.error(err);
        setFlash(req, "error", "Failed to add review");
        res.redirect(`/listings/${id}`);
    }
});

app.delete("/listings/:id/reviews/:reviewId", isLoggedIn, async (req, res, next) => {
    try {
        const { id, reviewId } = req.params;
        await listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
        await Review.findByIdAndDelete(reviewId);
        setFlash(req, "success", "Review deleted.");
        res.redirect(`/listings/${id}`);
    } catch (err) {
        console.error(err);
        setFlash(req, "error", "Failed to delete review");
        res.redirect(`/listings/${id}`);
    }
});

// ══════════════════════════════════════════════════════════════════════════════
//  ERROR HANDLERS
// ══════════════════════════════════════════════════════════════════════════════

app.use((req, res) => {
    res.status(404).render("error", { 
        obj: { 
            x: 404, 
            y: "Page not Found" 
        } 
    });
});

app.use((err, req, res, next) => {
    console.error(err);
    const statusCode = err.statusCode || 500;
    const message = err.message || "Something went wrong";
    res.status(statusCode).render("error", { 
        obj: { x: statusCode, y: message } 
    });
});


// ─── Start Server ──────────────────────────────────────────────────────────────
const PORT = 2000;
app.listen(PORT, () => {
    console.log(`🚀 Server listening on port ${PORT}`);
});