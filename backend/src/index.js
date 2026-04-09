import dotenv from "dotenv";
import connectDB from "./db/db.js";
import app from "./app.js";


dotenv.config({
    path: "./.env"
});


connectDB()
.then(() => {
    console.log("Connected to MongoDB");
    app.listen(process.env.PORT, () => {
        console.log(`Server is running on port ${process.env.PORT}`);
    });
    app.on("error", (error) => {
        console.error("Error in Express app:", error);
        throw error;
    });
})
.catch((error) => {
    console.error("Error connecting to MongoDB:", error);
    throw error;
});





























// import express from "express";
// const app = express();
// (async () => {
//   try {
//     await mongoose.connect(process.env.MONGODB_URI, {
//       dbName: DB_NAME
//     });
//     app.on("error", (error) => {
//       console.error("Error in Express app:", error);
//       throw error;
//     });
//     app.listen(process.env.PORT, () => {
//       console.log(`Server is running on port ${process.env.PORT}`);
//     });
//     console.log("Connected to MongoDB");
//   } catch (error) {
//     console.error("Error connecting to MongoDB:", error);
//     throw error;
//   }
// })();