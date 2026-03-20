const mongoose = require("mongoose");
const User = require("./models/User.model.js");
require("dotenv").config();

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const users = await User.find({}, '_id username email');
    console.log("Users in DB:", users);
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
