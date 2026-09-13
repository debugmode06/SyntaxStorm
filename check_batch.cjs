const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/ai-studio').then(async () => {
  const { BatchMembership } = require('./server/models/mongoose.js'); // check path
  const mems = await mongoose.connection.collection('batchmemberships').find({}).toArray();
  console.log(mems);
  process.exit(0);
});
