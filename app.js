const express=require('express')
const app=express()
const mongoose=require('mongoose')
const path=require('path')
const {listing}=require("./Models/listing.js");
const {connectDb}=require('./Models/ConnectDb.js')
const methodOverride=require('method-override')
const ejsMate=require('ejs-mate')
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

app.get("/",async (req,res)=>{
    res.send("Hello this is Home !!!");
})
app.get("/listings",async (req,res)=>{
    let allListings=await listing.find({});
    console.log(allListings)
    res.render("Listing/index.ejs",{allListings});
})



//new form
app.get("/listings/new",(req,res)=>{
    res.render("Listing/new.ejs");
})


//show 
app.get("/listings/:id",async (req,res)=>{
    let {id}=req.params;
    let curr=await listing.findById(id);
    // console.log(curr)
    res.render("Listing/show.ejs",{curr});
})

//updating in database
app.put("/listings/:id", async (req, res) => {
    try {
        let { id } = req.params;

        await listing.findByIdAndUpdate(
            id,
            { $set: req.body },
            {
                new: true,
                runValidators: true
            }
        );

        res.redirect(`/listings/${id}`);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error updating listing");
    }
});

// deleting route!!!
app.delete("/listings/:id", async (req, res) => {
    try {
        let { id } = req.params;

        await listing.findByIdAndDelete(id);

        res.redirect("/listings");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error deleting listing");
    }
});


//new listing insertion!!!
app.post("/listings",async(req,res)=>{
    console.log("helooo!");
})


//edit listings route 
app.get("/listings/:id/edit",async (req,res)=>{
   let {id}=req.params;
    let curr=await listing.findById(id);
    // console.log(curr)
    res.render("Listing/edit.ejs",{curr});
})
app.listen(2000,(req,res)=>{
    console.log("listening");
})