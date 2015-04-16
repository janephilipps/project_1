// Require modules
var db = require('./models');
var bcrypt = require("bcrypt"),
	salt = bcrypt.genSaltSync(10),
	bodyParser = require("body-parser"),
	// need to check docs bootstrap = require("bootstrap"),
	ejs = require("ejs"),
	express = require("express"),
	methodOverride = require("method-override"),
	pgHstore = require("pg-hstore"),
	request = require("request"),
	session = require("express-session"),
	env = process.env;
	// need to check docs socket = require("socket.io");

// Instantiate express app
var app = express();

// Set view engine to EJS
app.set('view engine', 'ejs');

// Set up body parser
app.use(bodyParser.urlencoded({extended: true}));

// Set up sessions
app.use(session({
	secret: 'super secret',
	resave: false,
	saveUninitialized: true
}))

// Set up static assets

app.use(express.static('public'));

// Set up login
app.use("/", function (req, res, next) {

  req.login = function (user) {
    req.session.UserId = user.id;
  };

  req.currentUser = function () {
    return db.User.
      find({
        where: {
          id: req.session.UserId
       }
      }).
      then(function (user) {
        req.user = user;
        return user;
      })
  };

  req.logout = function () {
    req.session.UserId = null;
    req.user = null;
  }

  next(); 
});

// Set up method override to work with POST requests that have the parameter "_method=DELETE"
app.use(methodOverride('_method'))

// Route to site index
app.get('/', function(req, res) {
	res.render('site/index');
});

// Route to site about
app.get('/about', function(req, res) {
	res.render('site/about');
});

// Route to site contact
app.get('/contact', function(req, res) {
	res.render('site/contact');
});

// Route to login page
app.get('/login', function(req, res) {
	res.render('site/login');
});

// Route to login as a user
app.post('/login', function(req, res) {
	var user = req.body.user;
	var email = req.body.user.email;
	var password = req.body.user.password;

	db.User
		.authenticate(email, password)
		.then(function (user) {
			req.login(user);
			res.redirect('/profile');
		});
});

// Route to profile page with saved location list
app.get('/profile', function(req, res) {
	// Request current User
	req.currentUser()
			// Then find all Locations for current User
			.then(function(user) {
				db.Location.findAll({
					where: {
						UserId : user.id
					}
				})
				// Then render profile page with user, userId, and locationsList
				.then(function(locations) {
					(res.render('users/profile', {user: user, locationsList: locations, userId: user.id}));
				})
			})
});

// // Route to list users
// app.get('/users', function(req, res) {
// 	res.render('users/index')
// });

// Route to new user
app.get('/users/new/', function(req, res) {
	res.render('users/new');
});

// Route to create user via sign-up form
app.post('/users', function(req, res) {
	// grab the user from the form
  var email = req.body.email;
  var password = req.body.password;
  var zip = req.body.zip;

  // create the new user
  db.User.
    createSecure(email, password, zip).
    then(function(){
        res.redirect("/login");
      });

});

// Route to show user
app.get('/users/:id', function(req, res) {
	req.currentUser()
		.then(function (user) {
			res.render("profile", {user: user})
		})

	res.render('/users/id');
})

app.post('/users/:id', function(req, res) {
	// grab the user from the login page
	var email = req.body.email;
	var password = req.body.password;

	// check that the user exists in the db
	db.User.
		authenticate(email, password)
		.then(function(user){
			res.render('users/profile', {user: user});
		});

});

// Route to edit user
app.get('/users/:id/edit', function(req, res) {

});

// Route to update user - *PATCH*
app.get('/users/:id', function(req, res) {

});

// Route to delete user - *DELETE*
app.get('/users/:id', function(req, res) {

});

// Route to logout user
app.delete('/logout', function(req, res) {
	req.logout();
	res.redirect('/login');
})

// Route to page to add new location
app.get('/locations/new', function(req, res) {
	res.render('locations/new');
});

// Route to add new location
app.post('/locations', function(req, res) {
	var zipSearch = req.body.zip;
	console.log(zipSearch);
	if (!zipSearch) {
		// res.redirect('/locations');
	} else {
		var url = "http://api.openweathermap.org/data/2.5/weather?zip=" + zipSearch;
		request(url, function(err, resp, body) {
			console.log("I'm in here 1")
			if (!err && resp.statusCode === 200) {
				console.log("I'm in here 2");
				var jsonData = JSON.parse(body);
				// if (!jsonData) {
				// 	res.redirect('/locations', {zips: [], noZips: true});
				// }
				// Create data in Locations DB
				var lat = jsonData.coord.lat;
				var lon = jsonData.coord.lon;
				db.Location.create({zip: zipSearch, lat: lat, long: lon, UserId: req.session.UserId})
					.then(function(zip, lat, long) {
						// Redirect to locations
						res.redirect('/locations');
					})
				
			} else {
				console.log("I didn't make it");
			}
		});
	}
});

// Route to show location
app.get('/locations/:id', function(req, res) {
	// Set id variable
	var id = req.params.id;
	// Find location in the db by id
	db.Location.find(id)
		// Then call forecast.io API with that location's lat & long coords
		.then(function(id) {
			// Set url variable for API call
			var url = "https://api.forecast.io/forecast/" + env.MY_API_KEY + "/" + id.lat + "," + id.long;
			// Log API url
			console.log(url);
			// Call API
			request(url, function(err, resp, body) {
				// If no errors
				if (!err && resp.statusCode === 200) {
					// Set variable result to the parsed JSON data
					var result = JSON.parse(body);
					// Render the individual location view passing the location id and result
					res.render('locations/location', {id: id, results: result});
				}
			});
			//res.render('locations/location', {id: id});
		});
	
});

// Route to list locations
app.get('/locations', function(req, res) {
	req.currentUser()
		.then(function(user) {
			db.Location.findAll({
				where: {
					UserId : user.id
				}
			})
			.then(function(locations) {
				(res.render('locations/index', {locationsList: locations, userId: user.id}));
			})
		})
});

// Route to edit location
app.get('/locations/:id/edit', function(req, res) {

});

// Route to create location
app.post('/locations', function(req, res) {

});

// Route to update location - *PATCH*
app.get('/locations/:id', function(req, res) {

});

// Route to delete location - *DELETE*
app.get('/locations/:id', function(req, res) {

});

// *Brett's special code*

// app.get('/sync', function(req, res) {
// 	db.sequelize.sync( {force: true} )
// 	.then(function( {
// 		res.send("DB synced successfully");
// 	}))
// })

// Start the server
var server = app.listen(3000, function() {
// This part just adds a snazzy listening message:
	console.log(new Array(51).join("*"));
  console.log("\t LISTENING ON: \n\t\t localhost:3000");
  console.log(new Array(51).join("*")); 
 });