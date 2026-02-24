const mongoose=require('mongoose');
const {connectDb}=require('./Models/ConnectDb.js');
const { listing } = require('./Models/listing');
connectDb();
// console.log("Hello!!!");
let reviewSchema=new mongoose.Schema({
    comment:{
        type:String,
        required:true
    },
    rating:{
        type:Number,
        required:true
    }
})
const Reviews=mongoose.model("Review",reviewSchema);


let listingSchema=new mongoose.Schema({
    name:{
        type:String,
        required:true
    },
    reviews:[{
        type:mongoose.SchemaTypes.ObjectId,
        ref:"Review"
    }]
})
const listings=mongoose.model("Listing",listingSchema);

async function func(){
    let review1=new Reviews({comment:"this is agood place",rating:5});
    let review2=new Reviews({comment:"this is bad place",rating:3});
     await review1.save()
     await review2.save()

    let list=new listings({
        name:"Amer",
        reviews:[review1._id,review2._id]
    })
    await list.save()

    let populatestr=await listings.findById(list._id).populate("reviews")
    console.log(populatestr)

    let deleted=await Reviews.deleteMany({_id:{$in:list.reviews}})
    console.log(deleted)
}
func()