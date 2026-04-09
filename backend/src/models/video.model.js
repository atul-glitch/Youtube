import mongoose from "mongoose";
import mongooseAggregationPaginate from "mongoose-aggregate-paginate-v2";
const videoSchema = new Schema({

    videoFile:{
        type:String,
        required:true
    },
    thumbnail:{
        type:String,
        required:true
    },
    title:{
        type:String,
        required:true
    },
    description:{
        type:String,
        required:true
    },
    category:{
        type:String,
    },
    views:{
        type:Number,
        default:0
    },

    isPublished:{
        type:Boolean,
        default:false
    },
    owner:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User"
    }


},{timestamps:true})

videoSchema.plugin(mongooseAggregationPaginate)
export const Video = mongoose.model("video", videoSchema)