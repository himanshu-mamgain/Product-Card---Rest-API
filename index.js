require("dotenv").config();
const express = require("express");
const fs = require('fs');
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');

const app = express();

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.json());

app.use(express.static("public"));

app.set("view engine", "ejs");

app.use(session({
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

const db_url = process.env.DB_URL;

mongoose.connect(db_url, {useNewUrlParser: true, useUnifiedTopology: true});

//user collection
const userSchema = new mongoose.Schema ({
    firstName: String,
    lastName: String,
    googleId: String,
    userName: String,
    password: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findById(id, (err, user) => {
    done(err, user);
  });
});

// product collection
const productSchema = {
    name: String,
    description: String,
    quantity: Number,
    price: Number,
    creator: String
};

const Product = mongoose.model("Product", productSchema);

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/products",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);

    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get("/", (req, res) => {
    res.render("home");
});

app.get("/auth/google",
  passport.authenticate('google', { scope: ["profile"] })
);

app.get("/auth/google/products",
  passport.authenticate('google', { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect to secrets.
    res.redirect("/products");
});

app.get("/login", (req, res) => {
    res.render("login");
});

app.get("/register", (req, res) => {
    res.render("register");
});

app.get("/products", (req, res) => {
    Product.find({"name": {$ne: null}}, (err, products) => {
        if (err) {
            console.log(err);
        } else {
            if(products) {
                res.render("products", {products: products});
            }
        }
    });
});

app.get("/compose", (req, res) => {
    if (req.isAuthenticated()){
        res.render("compose");
    } else {
        res.redirect("/login");
    }   
});

app.post("/compose", (req, res) => {
    const product = new Product({
        name: req.body.name,
        description: req.body.description,
        quantity: req.body.quantity,
        price: req.body.price,
        creator: req.body.creator
    });

    User.findById(req.user.id, (err, foundUser) => {
        if(err) {
            console.log(err);
        } else {
            if(foundUser) {
                product.save((err) => {
                    if(err) throw err;
                    res.redirect("/products");
                });
            }
        }
    });
});

app.get("/logout", (req, res) => {
    req.logout();
    res.redirect("/");
});  

app.post("/register", (req, res) => {
    User.register({
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        userName: req.body.userName
    }), req.body.password, (err, user) => {
        if(err) {
            console.log(err);
            res.redirect("/register");
        } else {
            passport.authenticate("local")(req, res, () => {
                res.redirect("/");
            });
        }
    }
});



app.post("/login", (req, res) => {
    const user = new User({
        username: req.body.username,
        password: req.body.password
    });

    req.login(user, (err) => {
        if(err) {
            console.log(err);
        } else {
            passport.authenticate("local")(req, res, () => {
                res.redirect("/products");
            });
        }
    });
});






app.get("/upload", (req, res) => {
    res.render("upload");
});

const Port = process.env.port || 3000;

app.listen(Port, () => {
    console.log(`Sever is running on ${Port}`);
});