const express = require('express');
const app = express();
const path = require('path');
const mongoose = require('mongoose');
const { listing } = require("./Models/listing.js");
const { Review } = require("./Models/reviews.js");
const { User } = require("./Models/User.js");
const { Booking } = require("./Models/Booking.js");
const { connectDb } = require('./Models/ConnectDb.js');
const { sampleListings } = require("./init/listingData.js");
const methodOverride = require('method-override');
const ejsMate = require('ejs-mate');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const jwt = require('jsonwebtoken');

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.engine("ejs", ejsMate);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));
app.use(cookieParser());

const JWT_SECRET = "your_jwt_secret_key_change_this_in_production";

app.use(session({
    secret: 'wonderlust_secret_key_change_in_production',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

const setFlash = (req, type, message) => {
    if (!req.session) req.session = {};
    if (!req.session.flash) req.session.flash = {};
    req.session.flash[type] = message;
};

const authMiddleware = async (req, res, next) => {
    try {
        const token = req.cookies.token;
        if (!token) { req.user = null; return next(); }
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');
        req.user = user;
        next();
    } catch (error) { req.user = null; next(); }
};

const isLoggedIn = (req, res, next) => {
    if (!req.user) {
        req.session.flash = { error: "You must be logged in to do that!" };
        return res.redirect("/login");
    }
    next();
};

const isOwner = async (req, res, next) => {
    try {
        const curr = await listing.findById(req.params.id);
        if (!curr) { setFlash(req, "error", "Listing not found"); return res.redirect("/listings"); }
        if (!curr.owner || !curr.owner.equals(req.user._id)) {
            setFlash(req, "error", "You do not have permission to do that!");
            return res.redirect(`/listings/${req.params.id}`);
        }
        next();
    } catch (err) { setFlash(req, "error", "Something went wrong"); res.redirect("/listings"); }
};

app.use(authMiddleware);
app.use(async (req, res, next) => {
    res.locals.currentUser = req.user || null;
    res.locals.currentPath = req.path;
    res.locals.formData = req.session.formData || null;
    delete req.session.formData;
    const flash = req.session?.flash || {};
    res.locals.successMsg = flash.success || null;
    res.locals.errorMsg = flash.error || null;
    delete req.session.flash;
    if (req.user) {
        try {
            res.locals.bookingCount = await Booking.countDocuments({ bookedBy: req.user._id, status: "confirmed" });
            res.locals.myListingCount = await listing.countDocuments({ owner: req.user._id });
        } catch (e) { res.locals.bookingCount = 0; res.locals.myListingCount = 0; }
    } else {
        res.locals.bookingCount = 0;
        res.locals.myListingCount = 0;
    }
    next();
});

connectDb();
(async () => {
    try {
        const count = await listing.countDocuments();
        if (count === 0) { await listing.insertMany(sampleListings); console.log("Sample listings seeded ✅"); }
    } catch (err) { console.error("Seed error:", err); }
})();

// ── AUTH ──────────────────────────────────────────────────────────────────────
app.get("/signup", (req, res) => res.render("Auth/signup"));
app.post("/signup", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) { req.session.formData = { email }; setFlash(req, "error", "Email and password are required"); return res.redirect("/signup"); }
        if (password.length < 6) { req.session.formData = { email }; setFlash(req, "error", "Password must be at least 6 characters"); return res.redirect("/signup"); }
        const existing = await User.findOne({ email: email.toLowerCase() });
        if (existing) { req.session.formData = { email }; setFlash(req, "error", "Email already registered"); return res.redirect("/signup"); }
        const user = new User({ email: email.toLowerCase(), password });
        await user.save();
        const token = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        res.cookie('token', token, { httpOnly: true, maxAge: 7*24*60*60*1000, sameSite: 'lax' });
        setFlash(req, "success", `Welcome to WonderLust, ${email}! 🎉`);
        res.redirect("/listings");
    } catch (e) { setFlash(req, "error", "Signup error"); res.redirect("/signup"); }
});

app.get("/login", (req, res) => res.render("Auth/login"));
app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) { req.session.formData = { email }; setFlash(req, "error", "Email and password are required"); return res.redirect("/login"); }
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user || !(await user.comparePassword(password))) {
            req.session.formData = { email }; setFlash(req, "error", "Invalid email or password"); return res.redirect("/login");
        }
        const token = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        res.cookie('token', token, { httpOnly: true, maxAge: 7*24*60*60*1000, sameSite: 'lax' });
        setFlash(req, "success", `Welcome back, ${email}! 👋`);
        res.redirect("/listings");
    } catch (e) { setFlash(req, "error", "Login error"); res.redirect("/login"); }
});

app.get("/logout", (req, res) => {
    res.clearCookie('token');
    setFlash(req, "success", "Logged out. See you soon!");
    res.redirect("/login");
});

// ── LISTINGS ──────────────────────────────────────────────────────────────────
app.get("/", (req, res) => res.redirect("/listings"));

app.get("/listings", async (req, res) => {
    try {
        const { location, minPrice, maxPrice, minRating, sort } = req.query;
        const filters = { location, minPrice, maxPrice, minRating, sort };

        // Build MongoDB query
        const query = {};
        if (location && location.trim()) {
            query.$or = [
                { location: { $regex: location.trim(), $options: 'i' } },
                { country:  { $regex: location.trim(), $options: 'i' } }
            ];
        }
        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice && !isNaN(minPrice)) query.price.$gte = Number(minPrice);
            if (maxPrice && !isNaN(maxPrice)) query.price.$lte = Number(maxPrice);
        }

        // Sort option
        let sortObj = {};
        if (sort === 'price_asc')  sortObj = { price:  1 };
        if (sort === 'price_desc') sortObj = { price: -1 };

        let allListings = await listing.find(query).populate('reviews').sort(sortObj);

        // Filter by average rating (in-memory after population)
        if (minRating && !isNaN(minRating)) {
            const min = Number(minRating);
            allListings = allListings.filter(l => {
                if (!l.reviews || l.reviews.length === 0) return min <= 0;
                const avg = l.reviews.reduce((s, r) => s + r.rating, 0) / l.reviews.length;
                return avg >= min;
            });
        }

        let bookedIds = new Set();
        if (req.user) {
            const ub = await Booking.find({ bookedBy: req.user._id, status: "confirmed" }).select("listing");
            ub.forEach(b => bookedIds.add(b.listing.toString()));
        }
        res.render("Listing/index", { allListings, bookedIds, filters });
    } catch (err) { setFlash(req, "error", "Failed to fetch listings"); res.redirect("/"); }
});

app.get("/listings/new", isLoggedIn, (req, res) => res.render("Listing/new"));

app.get("/my-listings", isLoggedIn, async (req, res) => {
    try {
        const myListings = await listing.find({ owner: req.user._id });
        const bookingMap = {};
        for (const l of myListings) {
            const bookings = await Booking.find({ listing: l._id, status: "confirmed" })
                .populate("bookedBy", "email").sort({ checkIn: 1 });
            bookingMap[l._id.toString()] = bookings;
        }
        res.render("Listing/myListings", { myListings, bookingMap });
    } catch (err) { setFlash(req, "error", "Failed to load your listings"); res.redirect("/listings"); }
});

app.get("/listings/:id", async (req, res) => {
    try {
        const curr = await listing.findById(req.params.id).populate("reviews").populate("owner");
        if (!curr) { setFlash(req, "error", "Listing not found"); return res.redirect("/listings"); }
        let myBookings = [];
        if (req.user) {
            myBookings = await Booking.find({ listing: req.params.id, bookedBy: req.user._id, status: "confirmed" }).sort({ checkIn: 1 });
        }
        const activeBookings = await Booking.find({ listing: req.params.id, status: "confirmed" })
            .populate("bookedBy", "email").sort({ checkIn: 1 });
        res.render("Listing/show", { curr, myBookings, activeBookings });
    } catch (err) { setFlash(req, "error", "Invalid listing ID"); res.redirect("/listings"); }
});

// Return booked date ranges for a listing (used by date picker)
app.get("/listings/:id/booked-dates", async (req, res) => {
    try {
        const bookings = await Booking.find({ listing: req.params.id, status: "confirmed" })
            .select("checkIn checkOut -_id");
        res.json(bookings);
    } catch (err) { res.json([]); }
});

app.post("/listings", isLoggedIn, async (req, res) => {
    try {
        const newL = new listing(req.body);
        newL.owner = req.user._id;
        await newL.save();
        setFlash(req, "success", "New listing created! 🏠");
        res.redirect(`/listings/${newL._id}`);
    } catch (err) { setFlash(req, "error", "Failed to create listing"); res.redirect("/listings/new"); }
});

app.get("/listings/:id/edit", isLoggedIn, isOwner, async (req, res) => {
    try {
        const curr = await listing.findById(req.params.id);
        if (!curr) { setFlash(req, "error", "Listing not found"); return res.redirect("/listings"); }
        res.render("Listing/edit", { curr });
    } catch (err) { setFlash(req, "error", "Error"); res.redirect("/listings"); }
});

app.put("/listings/:id", isLoggedIn, isOwner, async (req, res) => {
    try {
        const updated = await listing.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
        if (!updated) { setFlash(req, "error", "Listing not found"); return res.redirect("/listings"); }
        setFlash(req, "success", "Listing updated! ✅");
        res.redirect(`/listings/${req.params.id}`);
    } catch (err) { setFlash(req, "error", "Failed to update"); res.redirect(`/listings/${req.params.id}/edit`); }
});

app.delete("/listings/:id", isLoggedIn, isOwner, async (req, res) => {
    try {
        await listing.findByIdAndDelete(req.params.id);
        await Review.deleteMany({ listing: req.params.id });
        await Booking.deleteMany({ listing: req.params.id });
        setFlash(req, "success", "Listing deleted.");
        res.redirect("/listings");
    } catch (err) { setFlash(req, "error", "Failed to delete"); res.redirect("/listings"); }
});

// ── BOOKINGS ──────────────────────────────────────────────────────────────────
app.get("/my-bookings", isLoggedIn, async (req, res) => {
    try {
        const myBookings = await Booking.find({ bookedBy: req.user._id })
            .populate("listing")
            .sort({ createdAt: -1 });
        res.render("Bookings/myBookings", { myBookings });
    } catch (err) { setFlash(req, "error", "Failed to load bookings"); res.redirect("/listings"); }
});

app.post("/listings/:id/book", isLoggedIn, async (req, res) => {
    try {
        const curr = await listing.findById(req.params.id);
        if (!curr) { setFlash(req, "error", "Listing not found"); return res.redirect("/listings"); }
        if (curr.owner && curr.owner.equals(req.user._id)) {
            setFlash(req, "error", "You cannot book your own listing!");
            return res.redirect(`/listings/${req.params.id}`);
        }

        const checkInDate = new Date(req.body.checkIn);
        const checkOutDate = new Date(req.body.checkOut);
        const today = new Date(); today.setHours(0,0,0,0);
        if (checkInDate < today) { setFlash(req, "error", "Check-in date cannot be in the past"); return res.redirect(`/listings/${req.params.id}`); }
        if (checkOutDate <= checkInDate) { setFlash(req, "error", "Check-out must be after check-in"); return res.redirect(`/listings/${req.params.id}`); }

        // Check for date-range overlap with any existing confirmed booking
        const conflict = await Booking.findOne({
            listing: req.params.id,
            status: "confirmed",
            checkIn: { $lt: checkOutDate },
            checkOut: { $gt: checkInDate }
        });
        if (conflict) {
            const ci = new Date(conflict.checkIn).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
            const co = new Date(conflict.checkOut).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
            setFlash(req, "error", `Those dates clash with an existing booking (${ci} – ${co}). Please choose different dates.`);
            return res.redirect(`/listings/${req.params.id}`);
        }

        const totalNights = Math.round((checkOutDate - checkInDate) / (1000*60*60*24));
        const totalCost = totalNights * curr.price;

        await new Booking({ listing: req.params.id, bookedBy: req.user._id, checkIn: checkInDate, checkOut: checkOutDate, totalNights, totalCost, status: "confirmed" }).save();
        setFlash(req, "success", `Booking confirmed! 🎉 ${totalNights} night(s) · ₹${totalCost.toLocaleString("en-IN")}`);
        res.redirect(`/listings/${req.params.id}`);
    } catch (err) { console.error(err); setFlash(req, "error", "Failed to book"); res.redirect(`/listings/${req.params.id}`); }
});

app.delete("/bookings/:bookingId/cancel", isLoggedIn, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.bookingId);
        if (!booking) { setFlash(req, "error", "Booking not found"); return res.redirect("/my-bookings"); }
        if (!booking.bookedBy.equals(req.user._id)) { setFlash(req, "error", "Not your booking!"); return res.redirect("/my-bookings"); }
        booking.status = "cancelled";
        await booking.save();
        setFlash(req, "success", "Booking cancelled.");
        const referer = req.headers.referer || "/my-bookings";
        res.redirect(referer.includes("/listings/") ? referer : "/my-bookings");
    } catch (err) { setFlash(req, "error", "Failed to cancel"); res.redirect("/my-bookings"); }
});

// ── REVIEWS ───────────────────────────────────────────────────────────────────
app.post("/listings/:id/reviews", isLoggedIn, async (req, res) => {
    try {
        const currL = await listing.findById(req.params.id);
        if (!currL) { setFlash(req, "error", "Listing not found"); return res.redirect("/listings"); }
        const rev = new Review({ comment: req.body.comment, rating: req.body.rating, listing: req.params.id });
        await rev.save();
        currL.reviews.push(rev._id);
        await currL.save();
        setFlash(req, "success", "Review added! ⭐");
        res.redirect(`/listings/${req.params.id}`);
    } catch (err) { setFlash(req, "error", "Failed to add review"); res.redirect(`/listings/${req.params.id}`); }
});

app.delete("/listings/:id/reviews/:reviewId", isLoggedIn, async (req, res) => {
    try {
        await listing.findByIdAndUpdate(req.params.id, { $pull: { reviews: req.params.reviewId } });
        await Review.findByIdAndDelete(req.params.reviewId);
        setFlash(req, "success", "Review deleted.");
        res.redirect(`/listings/${req.params.id}`);
    } catch (err) { setFlash(req, "error", "Failed to delete review"); res.redirect(`/listings/${req.params.id}`); }
});

// ── ERRORS ────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).render("error", { obj: { x: 404, y: "Page not Found" } }));
app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.statusCode || 500).render("error", { obj: { x: err.statusCode || 500, y: err.message || "Something went wrong" } });
});

app.listen(2000, () => console.log("🚀 Server running on http://localhost:2000"));