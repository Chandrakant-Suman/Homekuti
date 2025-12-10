const mongoose=require('mongoose');
const Schema=mongoose.Schema;

const listingSchema=new Schema({
    title: {
        type: String, 
        required: true
    },
    description: {
        type: String,
    },
    image: {
        type: String,
        required: true,
        // default: if image is undefined,null, not exists
        default: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ9_79VVhphnq0PIVsee9XCAfIeFLFqBu_pXw&s",
        // set: image is set when an empty string is provided // set for users/clients
        set: (value) => {
            return value && value.trim() !== ""
                ? value
                : "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ9_79VVhphnq0PIVsee9XCAfIeFLFqBu_pXw&s";
        }
    },
    price: {
        type: Number, 
        required: true
    },
    location: {
        type: String, 
        required: true
    },
    country: {
        type: String, 
        required: true
    },
});
const Listing =mongoose.model("Listing",listingSchema);
module.exports=Listing;