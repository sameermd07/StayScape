const express=require('express')
const app=express();
const {customError}=require('./error');
app.get("/",(req,res)=>{
    // fuct
    res.send("hello");
})
app.get("/api",(req,res)=>{
    res.send("got the access");
})
app.use((req,res,next)=>{
    console.log("no such route!!!!")
    const err=new customError(404,"page not found!!!");
    // err.status=404;
    next(err);
})
app.use((err,req,res,next)=>{
    // console.log(err);
    res.status(err.statusCode||500).send(err.message);
})
app.listen(1000,()=>{
    console.log("listening");
})