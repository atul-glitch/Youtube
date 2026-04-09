import mongoose,  {Schema} from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const userSchema = new Schema({
    username:{
        type: String,
        require: true,
        unique: true,
        lowercase: true,
        trim: true,
        index:true
    },
    email:{
        type: String,
        require: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    fullName:{
        type: String,
        require: true,
        trim: true,
        index:true
    },
    avatar:{
        type: String,
        require: true,
    },
    coverImage:{
        type: String, 
    },
    watchHistory:[
        {
            type: Schema.Types.ObjectId,
            ref: "video"
        }
    ],
    password:{
        type: String,
        required: [true,"password is required"]
    },
    refreshToken:{
        type: String
    }
    
},{timestamps:true})

userSchema.pre("save", async function () {
    if(!this.isModified("password")) return;

    this.password = await bcrypt.hash(this.password, 10)
})


userSchema.methods.isPasswordMatch = async function(password){
    return await bcrypt.compare(password, this.password)
}

userSchema.methods.generateAccessToken = function(){
    return jwt.sign({
        _id: this._id,
        username: this.username,
        email: this.email,
        fullName: this.fullName,
    },
     process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN
    })
}

userSchema.methods.generateRefreshToken = function(){
    return jwt.sign({
        id: this._id
    }, process.env.REFRESH_TOKEN_SECRET, {
        expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN
    })
}

export  const User = mongoose.model("User", userSchema)