import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import cookieParser from "cookie-parser";
import "dotenv/config";

const app = express();
const port = 3000;

const API_URL = "https://favqs.com/api/"; 
const token = process.env.TOKEN;
const config = {
  headers: {
    Authorization: `Token token="${process.env.TOKEN}"`,
    "Content-Type": "application/json",
  },
};

app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static("public"));
app.use(express.json());

app.use(cookieParser());
app.use((req, res, next) => {
  console.log("Session Data:", req.cookies);
  next();
});

app.get("/", (req, res) => {
  const userToken = req.cookies["User-Token"]; 
  const username = req.cookies["login"]; 
  if (userToken && username) {
    console.log("Session active for user:", userToken);
    // User is logged in, render home page with username
    res.render("index.ejs", { username: username });
  } else {
    // User is not logged in, redirect to login page
    res.redirect("/login");
  }
});

// Get about page
app.get("/about", (req, res) => { 
  res.render("about.ejs", {url : API_URL});
});

// Search result based on tag name
app.post("/quotes", async (req, res) => {
  const tagName = req.body["search"];
  const response = await axios.get(
    API_URL + `quotes/?filter=${tagName}&type=tag`,
    config
  );
  console.log(response.data);
  res.render("index.ejs", { data: response.data.quotes });
});

// To get single quote
app.get("/api/quotes/:quote_id", async (req, res) => {
  const id = req.params.quote_id;
  const response = await axios.get(`${API_URL}/quotes/${id}`, config);

  console.log(id);
  console.log(response.data);

  res.render("quote.ejs", { quote: response.data });
});

// Get login
app.get("/login", (req, res) => {
  res.render("login.ejs");
});

// User login
app.post("/login", async (req, res) => {
  const { login, password } = req.body;

  if (!login || !password) {
    console.error("Missing login or password.");
    return res.status(400).send("Missing login or password.");
  }

  try {
    const response = await axios.post(
      `${API_URL}session`,
      {
        user: {
          login,
          password,
        },
      },
      config
    );
    console.log("API Response:", response.data); // Log the API response
    // If the response is successful, redirect to home or a success page
    if (response.data && response.data["User-Token"]) {
      res.cookie("User-Token", response.data["User-Token"], {
        httpOnly: true, // Make sure the cookie is only accessible by the server
        secure: process.env.NODE_ENV === "production", // Only send cookie over HTTPS in production
        maxAge: 24 * 60 * 60 * 1000, // Set cookie to expire in 24 hours
        sameSite: "strict", // CSRF protection
      });

      res.cookie("login", response.data["login"], {
        httpOnly: false, // Allow access by frontend scripts if needed
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: "strict",
      });

      console.log(response.data["login"]);
      // Redirect to home on successful login
      return res.redirect(`/?login=${encodeURIComponent(login)}`);
    }
  } catch (error) {
    if (error.response) {
      // If the error response contains a message, capture and send it
      const errorMessage = error.response.data.message;
      console.error("Error response from API:", errorMessage);

      // Send the error message to the frontend to display it
      res.render("login.ejs", { error: errorMessage });
    } else {
      // If it's an unexpected error (e.g., network issue), handle it
      console.error("Unexpected error:", error);
      res.status(500).send("An unexpected error occurred.");
    }
  }
});

// Get signup form
app.get("/signup", async (req, res) => {
  res.render("signup.ejs");
});

// Create new user
app.post("/signup", async (req, res) => {
  const { login, email, password } = req.body;

  if (!login || !password) {
    console.error("Missing login or password.");
    return res.status(400).send("Missing login or password.");
  }

  try {
    const response = await axios.post(
      `${API_URL}users`,
      {
        user: {
          login,
          email,
          password,
        },
      },
      config
    );
    // If the response is successful, redirect to home or a success page
    if (response.data && response.data["User-Token"]) {
      res.cookie("User-Token", response.data["User-Token"], {
        httpOnly: true, // Make sure the cookie is only accessible by the server
        secure: process.env.NODE_ENV === "production", // Only send cookie over HTTPS in production
        maxAge: 24 * 60 * 60 * 1000, // Set cookie to expire in 24 hours
      });

      res.cookie("login", response.data["login"], {
        httpOnly: false, // Allow access by frontend scripts if needed
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: "strict",
      });

      res.redirect(`/?username=${encodeURIComponent(login)}`);
    }
  } catch (error) {
    if (error.response) {
      const errorMessage = error.response.data.message;
      res.render("signup.ejs", { error: errorMessage });
    } else {
      console.error("Unexpected error:", error);
      res.status(500).send("An unexpected error occurred.");
    }
  }
});

// User dashboard and profile
app.get("/dashboard", async (req, res) => {
  const userToken = req.cookies["User-Token"]; 
  const login = req.cookies["login"]; 
  const response = await axios.get(`${API_URL}users/${login}`, {
    headers: {
      Authorization: `Token token="${token}"`,
      "User-Token": `${userToken}`,
      "Content-Type": "application/json",
    },
  });

  if (userToken && login) {
    console.log("Session active for user:", userToken);
    // User is logged in, render home page with username
    res.render("dashboard.ejs", { username: login, data: response.data });
  } else {
    // User is not logged in, redirect to login/signup page
    res.redirect("/login");
  }
});

//Destroy user session
app.post("/dashboard", async (req, res) => {
  const response = await axios.delete(`${API_URL}session`, config);
  res.clearCookie("User-Token");
  res.render("login.ejs", { response: response.data });
});

// Get password reset page
app.get("/password", (req, res) => {
  res.render("password.ejs");
});

//to request password reset
app.post("/password", async (req, res) => {
  const { email } = req.body;
  // console.log(email);
  try {
    const response = await axios.post(
      `${API_URL}users/forgot_password`,
      {
        user: {
          email,
        },
      },
      config
    );
    console.log(response.data);
    res.render("password.ejs", { data: response.data.message, email: email });
  } catch (error) {
    if (error.response) {
      const errorMessage = error.response.data.message;

      res.render("password.ejs", { error: errorMessage });
    } else {
      console.error("Unexpected error:", error);
      res.status(500).send("An unexpected error occurred.");
    }
  }
});

//Get edit/update form
app.get("/edit", async (req, res) => { 
  const userToken = req.cookies["User-Token"]; 
  const login = req.cookies["login"]; 

  const response = await axios.get(`${API_URL}users/${login}`, {
    headers: {
      Authorization: `Token token="${token}"`,
      "User-Token": `${userToken}`,
      "Content-Type": "application/json",
    },
  });
  res.render("edit.ejs", {data: response.data});
});

// User dashboard and profile
app.post("/edit", async (req, res) => {
  const userToken = req.cookies["User-Token"]; 
  const login = req.cookies["login"]; 

  try {
    const response = await axios.get(`${API_URL}users/${login}`, {
      headers: {
        Authorization: `Token token="${token}"`,
        "User-Token": `${userToken}`,
        "Content-Type": "application/json",
      },
    });

    res.render("dashboard.ejs", { username: login, data: response.data });
  } catch (error) {
    if (error.response) {
      const errorMessage = error.response.data.message;

      res.render("edit.ejs", { error: errorMessage });
    } else {
      console.error("Unexpected error:", error);
      res.status(500).send("An unexpected error occurred.");
    }
  }
});

// To get add post form
app.get("/api/quotes", (req, res) => {
  res.render("add.ejs");
});

// To add post 
app.post("/api/quotes", async (req, res) => {
  const userToken = req.cookies["User-Token"];
  const login = req.cookies["login"]; 
  const { author } = req.body;
  const { body } = req.body;

  try {
    const response = await axios.post(
      `${API_URL}quotes`,
      {
        quote: {
          author,
          body,
        },
      },
      {
        headers: {
          Authorization: `Token token="${token}"`,
          "User-Token": `${userToken}`,
          "Content-Type": "application/json",
        },
        validateStatus: function (status) {
          // Treat 500 as a valid response
          return status >= 200 && status <= 500;
        },
      }
    );

    console.log(response.data);
    console.log(author);

    res.render("index.ejs");
  } catch (error) {
    // Log the entire error object for debugging
    console.error("Error occurred:", error);

    if (error.response) {
      const errorMessage = error.response.data.message || "Unknown API error.";
      console.log("Error Message:", errorMessage);

      // Render the 'add.ejs' view with an error message
      res.render("add.ejs", { error: errorMessage });
    } else if (error.request) {
      console.error("No response received from API:", error.request);
      res.render("add.ejs", { error: "Failed to connect to the API." });
    } else {
      console.error("Unexpected error:", error.message);
      res.render("add.ejs", { error: "An unexpected error occurred." });
    }
  }
});

// To add to favorite
app.post("/api/quotes/:quote_id/fav", async (req, res) => {
  const userToken = req.cookies["User-Token"]; 
  const id = req.params.quote_id;
  const currentQuotes = JSON.parse(req.body.currentQuotes); 

  try {
    const response = await axios.put(`${API_URL}quotes/${id}/fav`, {},{
      headers: {
        Authorization: `Token token="${token}"`,
        "User-Token": `${userToken}`,
        "Content-Type": "application/json",
      },
    });

    // console.log(currentQuotes);
    // console.log(response.data);
    res.render("index.ejs", { data: currentQuotes });
  } catch (error) {
    if (error.response) {
      const errorMessage = error.response.data.message;

      res.render("index.ejs", { error: errorMessage });
    } else {
      console.error("Unexpected error:", error);
      res.status(500).send("An unexpected error occurred.");
    }
  }
});

// To upvote quote
app.post("/api/quotes/:quote_id/upvote", async (req, res) => {
  const userToken = req.cookies["User-Token"]; // Read the token from the cookie
  const id = req.params.quote_id;
  const currentQuotes = JSON.parse(req.body.currentQuotes);

  try {
    const response = await axios.put(
      `${API_URL}quotes/${id}/upvote`,
      {},
      {
        headers: {
          Authorization: `Token token="${token}"`,
          "User-Token": `${userToken}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log(currentQuotes);
    console.log(response.data);

    res.render("index.ejs", { data: currentQuotes });
  } catch (error) {
    if (error.response) {
      const errorMessage = error.response.data.message;

      res.render("index.ejs", { error: errorMessage });
    } else {
      console.error("Unexpected error:", error);
      res.status(500).send("An unexpected error occurred.");
    }
  }
});

// To downvote quote
app.post("/api/quotes/:quote_id/downvote", async (req, res) => {
  const userToken = req.cookies["User-Token"]; // Read the token from the cookie
  const id = req.params.quote_id;
  const currentQuote = JSON.parse(req.body.currentQuotes);

  try {
    const response = await axios.put(
      `${API_URL}quotes/${id}/downvote`,
      {},
      {
        headers: {
          Authorization: `Token token="${token}"`,
          "User-Token": `${userToken}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log(currentQuote);
 
    res.render("index.ejs", { data: currentQuote , quoted:  response.data});
  } catch (error) {
    if (error.response) {
      const errorMessage = error.response.data.message;

      res.render("index.ejs", { error: errorMessage });
    } else {
      console.error("Unexpected error:", error);
      res.status(500).send("An unexpected error occurred.");
    }
  }
});

// Express server setup
app.listen(port, () => {
  console.log(`Server is running on ${port}`);
});
