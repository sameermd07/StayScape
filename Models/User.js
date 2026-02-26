const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, "Email is required"],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"]
    },
    password: {
        type: String,
        required: [true, "Password is required"],
        minlength: [6, "Password must be at least 6 characters"]
    }
}, { timestamps: true });

// Hash password before saving (promise-based middleware, no next())
userSchema.pre("save", async function() {
    if (!this.isModified("password")) return;

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Method to generate JWT token
userSchema.methods.generateToken = function() {
    return jwt.sign(
        { userId: this._id, email: this.email },
        process.env.JWT_SECRET || "your_jwt_secret_key_change_this",
        { expiresIn: '7d' }
    );
};

const User = mongoose.model("User", userSchema);
module.exports = { User };