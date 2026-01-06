const express=require('express')
const app=express()
const mongoose=require('mongoose')
const path=require('path')
const {listing}=require("./Models/listing.js");
const {connectDb}=require('./Models/ConnectDb.js')

//setting paths 
app.set("view engine","ejs");
app.set("views",path.join(__dirname,"views"));

//setting parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


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


app.listen(2000,(req,res)=>{
    console.log("listening");
})