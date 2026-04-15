 import  {asyncHandler}  from  '../utils/asyncHandler.js';
 import {ApiError} from '../utils/ApiError.js';
 import {User} from '../models/user.model.js';
 import { uploadOnCloudinary } from '../utils/cloudinary.js';
 import { ApiResponse } from '../utils/ApiResponse.js'; 
 import jwt from 'jsonwebtoken';
import { subscribe } from 'diagnostics_channel';


const generateAccessAndRefreshTokens = async(userId) =>{
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();
        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });
        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(500, 'Failed to generate tokens');
    }
}

 const registerUser = asyncHandler(async (req, res) => {

    const {fullName, email, username, password} = req.body;
    console.log('Received user registration data:', {fullName, email, username});

    //  if (!fullName || !email || !username || !password) {
    //     throw new ApiError(400, 'All fields are required');
    //  }
    if (
        [fullName, email, username, password].some((field) => field?.trim() === '')
    ) {
        throw new ApiError(400, 'All fields are required');
    }

    const existingUser  = await User.findOne({ 
        $or: [{ email }, { username }] 
    }).then(existingUser => {
        if (existingUser) {
            throw new ApiError(409, 'Email or username already exists');
        }
    })

    const avatarLocalPath = req.files?.avatar[0]?.path; // Access the uploaded avatar file path
    // const coverImageLocalPath = req.files?.coverImage[0]?.path; // Access the uploaded cover image file path

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0)
        {
        coverImageLocalPath = req.files.coverImage[0].path; // Access the uploaded cover image file path
    }

     if(!avatarLocalPath){
        throw new ApiError(400, 'Avatar image is required');
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath) 

    if (!avatar){
        throw new ApiError(500, 'Failed to upload avatar image');
    }

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        username: username.toLowerCase(),
        password
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUser) {
        throw new ApiError(500, 'Failed to create user');
    } 

    return res.status(201).json(new ApiResponse(200, createdUser, 'User registered successfully'));


 });

 const loginUser = asyncHandler(async (req, res) => {
    if (!req.body) {
        throw new ApiError(400, 'Request body is missing. Send data as JSON.');
    }

    const {email, username, password} = req.body;
    
    if (!username && !email) {
        throw new ApiError(400, 'Email or username is required');
    }

     const user = await User.findOne({
        $or: [{ email }, { username }]
    })

    if (!user) {
        throw new ApiError(404, "User does not exist")
    }

    const isPasswordValid = await user.isPasswordMatch(password);

    if (!isPasswordValid) {
        throw new ApiError(401, 'Invalid password');
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    const options = {
        httpOnly: true,
        secure: true, //process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    };

    return res.status(200)
        .cookie('refreshToken', refreshToken, options)
        .cookie('accessToken', accessToken, options)
        .json(new ApiResponse(200, {
             user: loggedInUser, accessToken,refreshToken 
            }, 
            'User logged in successfully'
        ));


 })

 const logoutUser = asyncHandler(async (req, res) => {
        
        await User.findByIdAndUpdate(req.user._id, { $set: { refreshToken: undefined } },{new: true});
       const options = {
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
       }
        return res.status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, null, 'User logged out successfully'));
    })

const refreshAcessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
    if (!incomingRefreshToken) {
        throw new ApiError(401, 'Unauthorized: No refresh token provided');
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
    
         const user = await user.findById(decodedToken?._id)
            if (!user) {
                throw new ApiError(401, 'Unauthorized: Invalid refresh token');
            }
            if (user?.refreshToken !== incomingRefreshToken) {
                throw new ApiError(401, 'Unauthorized: Refresh token does not match or expired');
            }
    
            const options = {
                httpOnly: true,
                secure: true, //process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            };
            const {accessToken, NewRefreshToken} = await  generateAccessAndRefreshTokens(user._id)
            return res.status(200).cookie('refreshToken', NewRefreshToken, options).cookie('accessToken', accessToken, options).json(
                new ApiResponse(200,
                     { accessToken, refreshToken: NewRefreshToken },
                'Access token refreshed successfully'
            ))
    } catch (error) {
        throw new ApiError(401, error?.message || 'Unauthorized: Invalid or expired refresh token');
    }
})

const changeCurrentUserPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user?._id);
    const isPasswordCorrect = await user.isPasswordMatch(oldPassword)
    if (!isPasswordCorrect) {
        throw new ApiError(401, 'Old password is incorrect');
    }


    user.password = newPassword;
    await user.save({validateBeforeSave: false})
    return res.status(200).json(new ApiResponse(200, null, 'Password changed successfully'));
})

const getCurrentUser = asyncHandler(async (req, res) => {
    return res.status(200).json(new ApiResponse(200, req.user, 'Current user retrieved successfully'));
})

const updateCurrentUser = asyncHandler(async (req, res) => {
    const { fullName, email, username } = req.body;
    if(!fullName || !email || !username){
        throw new ApiError(400, 'All fields are required for update');
    }
    const user = await User.findByIdAndUpdate(req.user?._id,
         { $set: { fullName, email, username } },
          { new: true }
          ).select("-password -refreshToken");

    return res.status(200).json(new ApiResponse(200, user, 'User updated successfully'));
})

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.files?.avatar[0]?.path; // Access the uploaded avatar file path
    if (!avatarLocalPath) {
        throw new ApiError(400, 'Avatar image is required');
    }
    //delete old avatar from cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    if (!avatar.url) {
        throw new ApiError(500, 'Failed to upload avatar image');
    }


        const user = await User.findByIdAndUpdate(req.user?._id,
            { $set: { avatar: avatar.url } },
            { new: true }
        ).select("-password -refreshToken");
        return res.status(200).json(new ApiResponse(200, user, 'User avatar updated successfully'));
})

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.files?.coverImage[0]?.path; // Access the uploaded cover image file path
    if (!coverImageLocalPath) {
        throw new ApiError(400, 'Cover image is required');
    }
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if (!coverImage.url) {
        throw new ApiError(500, 'Failed to upload cover image');
    }

    const user = await User.findByIdAndUpdate(req.user?._id,
        { $set: { coverImage: coverImage.url } },
        { new: true }
    ).select("-password -refreshToken");
    return res.status(200).json(new ApiResponse(200, user, 'User cover image updated successfully'));

})


const getUserChannelProfile = asyncHandler(async (req, res) => {
    const {username} = req.params;
   
    if (!username?.trim()) {
        throw new ApiError(400, 'Username is missing or empty');
    }

   const channel = await User.aggregate([
        { $match: { username: username?.toLowerCase() } },
        { $lookup: {
            from:"subscribers",
            localField: "_id",
            foreignField: "channel",
            as: "subscribers"
        }},
        {$lookup: {
            from: "subscribers",
            localField: "_id",
            foreignField: "subscriber",
            as: "subscribedTo"
        }},
        {
            $addFields: {
                subscribersCount: { $size: "$subscribers" },
                channelsSubscribedToCount: { $size: "$subscribedTo" },
                isSubscribed: {
                  $cond: {
                  if: { $in: [req.user?._id, "$subscribers.subscriber"]},
                    then: true,
                    else: false

                }
                }
            }
        },
        {
            $project:{
                fullName:1,
                username:1,
                subscribersCount:1,
                channelsSubscribedToCount:1,
                isSubscribed:1,
                avatar:1,
                coverImage:1,
                email:1
            }
        }
    ])

    if (!channel?.length){
        throw new ApiError(404, 'Channel not found');
    }
    return res.status(200).json(new ApiResponse(200, channel[0], 'Channel profile retrieved successfully'));
})

const getWatchHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
        {
            $match:{
                _id: new mongoose.Types.ObjectId(req.user?._id)
            }
        },
        {
            $lookup:{
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline:[
                    {
                        $lookup:{
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline:[
                                {
                                    $project:{
                                        fullName:1,
                                        username:1,
                                        avatar:1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner:{
                                $first: "$owner",
                            }
                        }
                    }
                ]
            
            }
        }
    ])
    
    return res.status(200).json(new ApiResponse(200, user[0]?.watchHistory || [], 'Watch history retrieved successfully'));
});


export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAcessToken,
    changeCurrentUserPassword, 
    getCurrentUser, 
    updateCurrentUser,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
};