const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');
// const Promise = require('promise');

// mongoose + mongodb setup
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true});
const User = require('./models/User.js');
const Exercise = require('./models/Exercise.js');

app.use(cors());
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.use(express.static('public'));
app.set('json spaces', 4);          // format json responses

// GET app root
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

// POST new user
app.post('/api/exercise/new-user', (req, res) => {
  console.log(req.headers);
  console.log(req);
  const newUser = new User({
    username: req.body.username
  });
  newUser.save()
    .then(result => {
      console.log(result);
      res.status(201).json(result);
    })
    .catch(err => {
      console.log(err);
      // res.status(403).json({error: 'Username already taken'});
      res.status(403).send('Username already taken');
    });
});

// GET all users
app.get('/api/exercise/users', (req, res) => {
  console.log(req.headers);
  User.find({}, (err, docs) => {      // empty search params should return all documents
    if (err) {
      res.status(500).json({error: err});
    } else {
      res.status(200).json(docs);
    }
  });
});

// POST new exercise
app.post('/api/exercise/add', (req, res) => {
  // validate that user exists and return error if not
  User.findById(req.body.userId, (err, user) => {
    if (err) {  // server error
      res.status(500).json({error: 'Failed to add new exercise', errorDescription: err});
    } else {
      // uf the user is not found
      if (user == null) {
        res.status(403).json({error: 'Unknown userId'});
      }
      // create the new exercise
      const newExercise = new Exercise({
        userId: req.body.userId,
        description: req.body.description,
        duration: req.body.duration,
        date: req.body.date ? req.body.date : undefined // send undefined if no date provided ('' aka null)
      });
      // save to db
      console.log(newExercise);
      newExercise.save()
        .then(result => {
          console.log(result);
          res.status(201).json(result);
        })
        .catch(err => {
          res.status(500).json({error: err});
        });
    }
  })
});

// GET user's exercise log
// userId is required. from, to, and limit params are optional.
// first clean the query input data
app.use((req, res, next) => {
  // check for query input errors
  if (!req.query.userId) {
    res.status(400).json({error: 'Must provide a userId to retrieve exercise logs'})
  }
  
  // parse optional inputs into correct types
  req.query.limit = parseInt(req.query.limit);
  req.query.from = req.query.from ? new Date(req.query.from) : undefined;  //
  req.query.to = req.query.to ? new Date(req.query.to) : undefined;
  console.log(req.query);
  // catch date errors IFF dates were actually provided (e.g. not undefined)
  if ((!isValidDate(req.query.from) && req.query.from != undefined) 
      || (!isValidDate(req.query.to) && req.query.to != undefined)) {
    throw res.status(500).json({error: 'Invalid date input(s)'});
  }
  
  next();
});

app.get('/api/exercise/log', (req, res) => {  
  // build query based on paramaters provided
  var logQuery = { userId: req.query.userId };
  if (req.query.from) {
    if (!logQuery.hasOwnProperty('date')) { 
      logQuery.date = {};  // add date object if it doesnt exist so we can nest the bounds
    }
    logQuery.date.$gt = req.query.from;
  } 
  if (req.query.from) {
    if (!logQuery.hasOwnProperty('date')) { 
      logQuery.date = {}; 
    }
    logQuery.date.$lt = req.query.to;
  }
  
  // execute queries simultaneously and await their output before sending json
  Promise.all([
    User.findById(req.query.userId)
        .select({_id: 1, username: 1}),
    Exercise.find(logQuery)
        .limit(req.query.limit)
        .select({_id: 0, description: 1, duration: 1, date: 1})
  ]).then(([userData, exerciseData]) => {
    res.status(200).json({ _id: userData._id, username: userData.username, count: exerciseData.length, log: exerciseData});
  }).catch((err) => {
    console.log(err);
    res.status(500).json({error: 'failed to retrieve exercise logs', errorDescription: err});
  });
});

// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
});

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
});


// helper function to validate dates
function isValidDate(d) {
  return d instanceof Date && !isNaN(d);
}

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port);
});
