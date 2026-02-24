const express=require('express')
const app=express()
const mongoose=require('mongoose')
const path=require('path')
const {listing}=require("./Models/listing.js");
const { Review } = require("./Models/reviews.js");
const {connectDb}=require('./Models/ConnectDb.js')
const methodOverride=require('method-override')
const ejsMate=require('ejs-mate')
const {customError}=require('./error');
const { error } = require('console');
//setting paths 
app.set("view engine","ejs");
app.set("views",path.join(__dirname,"views"));
app.engine("ejs",ejsMate);
//setting parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//middle wares 
app.use(methodOverride("_method"));

//database Connection!!!!
connectDb();

app.get("/", async (req,res,next)=>{
    try {
        res.send("Hello this is Home !!!");
    } catch (err) {
        next(new customError(500, "Server error on Home route"));
    }
});


app.get("/listings", async (req, res, next) => {
    try {
        let allListings = await listing.find({});
        res.render("Listing/index.ejs", { allListings });
    } catch (err) {
        // Wrap the database error in a custom error
        next(new customError(500, "Failed to fetch listings from DB"));
    }
});

//new form
app.get("/listings/new", (req,res,next)=>{
    try {
        res.render("Listing/new.ejs");
    } catch (err) {
        next(new customError(500, "Failed to load New Listing page"));
    }
});


//show 
app.get("/listings/:id", async (req, res, next) => {
    try {
        const { id } = req.params;
        const curr = await listing.findById(id).populate("reviews");
        if (!curr) {
            return next(new customError(404, "Listing not found"));
        }
        res.render("Listing/show.ejs", { curr });
    } catch (err) {
        if (err.name === "CastError") {
            return next(new customError(400, "Invalid Listing ID"));
        }
        next(new customError(500, "Database error while fetching listing"));
    }
});

//add review to a listing
app.post("/listings/:id/reviews", async (req, res, next) => {
    try {
        const { id } = req.params;
        const currListing = await listing.findById(id);

        if (!currListing) {
            return next(new customError(404, "Listing not found"));
        }

        const { comment, rating } = req.body;

        const review = new Review({
            comment,
            rating,
            listing: currListing._id,
        });

        await review.save();

        currListing.reviews.push(review._id);
        await currListing.save();

        res.redirect(`/listings/${id}`);
    } catch (err) {
        if (err.name === "CastError") {
            return next(new customError(400, "Invalid Listing ID for review"));
        }
        if (err.name === "ValidationError") {
            return next(new customError(400, "Invalid data submitted for review"));
        }
        next(new customError(500, "Database error while creating review"));
    }
});

//delete a review from a listing (via POST)
app.post("/listings/:id/reviews/:reviewId/delete", async (req, res, next) => {
    try {
        const { id, reviewId } = req.params;

        // remove review id from listing.reviews array
        await listing.findByIdAndUpdate(
            id,
            { $pull: { reviews: reviewId } },
            { new: true }
        );

        // delete the review document itself
        await Review.findByIdAndDelete(reviewId);

        res.redirect(`/listings/${id}`);
    } catch (err) {
        if (err.name === "CastError") {
            return next(new customError(400, "Invalid ID for review deletion"));
        }
        next(new customError(500, "Database error while deleting review"));
    }
});

//update listing !!!!!
app.put("/listings/:id", async (req, res, next) => {
    try {
        const { id } = req.params;

        const updatedListing = await listing.findByIdAndUpdate(
            id,
            { $set: req.body },
            { new: true, runValidators: true }
        );

        if (!updatedListing) {
            return next(new customError(404, "Listing not found")); // nothing to update
        }

        res.redirect(`/listings/${id}`);
    } catch (err) {
        if (err.name === "CastError") {
            return next(new customError(400, "Invalid Listing ID")); // malformed ID
        }
        if (err.name === "ValidationError") {
            return next(new customError(400, "Invalid data for update")); // failed validation
        }
        // unexpected DB error
        next(new customError(500, "Database error while updating listing"));
    }
});


// deleting route!!!
app.delete("/listings/:id", async (req, res, next) => {
    try {
        const { id } = req.params;

        const deletedListing = await listing.findByIdAndDelete(id);

        if (!deletedListing) {
            return next(new customError(404, "Listing not found"));
        }

        res.redirect("/listings");
    } catch (err) {
        if (err.name === "CastError") {
            return next(new customError(400, "Invalid Listing ID"));
        }
        next(new customError(500, "Database error while deleting listing"));
    }
});



//new listing insertion!!!
app.post("/listings", async (req, res, next) => {
    try {
        // Create a new listing from request body
        const newListing = new listing(req.body);

        // Save to database
        await newListing.save();

        // Redirect to the newly created listing's page
        res.redirect(`/listings/${newListing._id}`);
    } catch (err) {
        // Handle Mongoose validation errors (required fields, types, etc.)
        if (err.name === "ValidationError") {
            return next(new customError(400, "Invalid data submitted for listing"));
        }

        // Handle duplicate key errors (e.g., unique fields)
        if (err.code === 11000) {
            return next(new CustomError(400, "Listing with this unique value already exists"));
        }

        // Handle any other database errors
        next(new CustomError(500, "Database error while creating listing"));
    }
});

//edit listings route 
app.get("/listings/:id/edit", async (req, res, next) => {
    try {
        const { id } = req.params;

        // Attempt to find the listing by ID
        const curr = await listing.findById(id);

        // If no listing is found, send 404
        if (!curr) {
            return next(new CustomError(404, "Listing not found"));
        }

        // Render the edit form
        res.render("Listing/edit.ejs", { curr });
    } catch (err) {
        // Handle invalid MongoDB ObjectId
        if (err.name === "CastError") {
            return next(new CustomError(400, "Invalid Listing ID"));
        }

        // Handle any other database errors
        next(new CustomError(500, "Database error while fetching listing for edit"));
    }
});

app.use((req,res,next)=>{
    next(new customError(404,"Page not Found"));
})
app.use((err,req,res,next)=>{
    let obj={x:err.statusCode,y:err.message};
    res.status(err.statusCode).render("error",{obj});
})

app.listen(2000,(req,res)=>{
    console.log("listening");
})