const {connectDb}=require('../Models/ConnectDb.js');
const {listing}=require('../Models/listing.js');
const data=require('./listingData.js')
const mongoose=require('mongoose');
//connection to db!!!!!
connectDb()
console.log(data);

let main=async()=>{
    await listing.deleteMany({});
    console.log("All data before is deleted !!!");
    await listing.insertMany(data.sampleListings);
    console.log("All data is inserted !!!");
}
main();


