const express=require('express');
const app=express();
const mongoose= require('mongoose');
const Listing =require("./models/listing.js")
const path=require("path");
const methodOverride = require('method-override');
const ejsMate=require('ejs-mate');
const MONGO_URL='mongodb://127.0.0.1:27017/Homekuti';

main()
.then(()=>{
    console.log("Connected to MongoDB");
})
.catch((err)=>{
    console.log("Error connecting to MongoDB:", err);
});

async function main(){
    await mongoose.connect(MONGO_URL);
}

app.set("view engine","ejs");
app.set("views",path.join(__dirname,"views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.engine('ejs',ejsMate);

// Middleware to set activeRoute for all views
app.use((req, res, next) => {
  res.locals.activeRoute = req.path;
  next();
});


app.get("/",(req,res)=>{
    res.render("home");  // views/home.ejs
});

// About page
app.get("/about", (req, res) => {
  res.render("about");   // views/about.ejs
});

// Contact page
app.get("/contact", (req, res) => {
  res.render("contact"); // views/contact.ejs
});


// Index Route
app.get("/listings", async (req, res) => {
    try {
        const allListings = await Listing.find({});
        res.render("listings/index", { allListings }); // send result to browser
        // console.log(allListings); // log in terminal
    } catch (err) {
        console.error("Error fetching listings:", err);
        res.status(500).send("Internal Server Error");
    }
});

// New Route
app.get("/listings/new",(req,res)=>{
    res.render("listings/new.ejs");
});

// Create Route
app.post("/listings", async (req, res) => {
    try {
        const newListing = new Listing(req.body.listing);
        await newListing.save();
        res.redirect("/listings");
    } catch (err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
    }
});

// Edit Route
app.get("/listings/:id/edit", async (req, res) => {
    const { id } = req.params;
    try {
        const listing = await Listing.findById(id);
        if (!listing) {
            return res.status(404).send("Listing not found");
        }
        res.render("listings/edit", { listing });
    } catch (err) {
        console.error("Error fetching listing for edit:", err);
        res.status(500).send("Internal Server Error");
    }
});

// Update Route
app.put("/listings/:id", async (req, res) => {
    const { id } = req.params;
    try {
        await Listing.findByIdAndUpdate(id, req.body.listing, {
            runValidators: true,
        });
        res.redirect(`/listings/${id}`);
    } catch (err) {
        console.error("Error updating listing:", err);
        res.status(500).send("Internal Server Error");
    }
});

// Delete Route
app.delete("/listings/:id", async (req, res) => {
    const { id } = req.params;
    try {
        let deletedListing = await Listing.findByIdAndDelete(id);
        console.log("Deleted listing:", deletedListing);
        res.redirect("/listings");
    } catch (err) {
        console.error("Error deleting listing:", err);
        res.status(500).send("Internal Server Error");
    }
});

// Show Route
app.get("/listings/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const listing = await Listing.findById(id);
        if (!listing) {
            return res.status(404).send("Listing not found");
        }
        res.render("listings/show", { listing }); // send result to browser
        // console.log(listing); // log in terminal
    }
    catch (err) {
        console.error("Error fetching listing:", err);
        res.status(500).send("Internal Server Error");
    }
});

// Test Route
// app.get("/testListing",async (req,res)=>{
//     let sampleListing=new Listing({
//         title: "Cozy Apartment in Downtown",
//         description: "A beautiful and cozy apartment located in the heart of the city.",
//         price: 1200,
//         location: "123 Main St, Downtown",
//         country: "USA"
//     });
//     await sampleListing.save();
//     console.log("Sample listing saved:", sampleListing);
//     res.send("Successfully tested.");
// });

// Start the server
app.listen(8080,()=>{
    console.log('Server is running on port 8080');
});