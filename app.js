const express = require("express");
const app = express();
app.use(express.json());

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
let db = null;

const path = require("path");
const dbPath = path.join(__dirname, "twitterClone.db");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is Running at http://localhost:3000");
    });
  } catch (e) {
    console.log(e.message);
    process.exit(1);
  }
};
initializeDBAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const getIfExistQuery = `SELECT * FROM user WHERE username = "${username}";`;

  const dbUser = await db.get(getIfExistQuery);
  if (dbUser === undefined) {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const createQuery = `INSERT INTO user(username,password,name,gender)
            VALUES('${username}','${hashedPassword}','${name}','${gender}');`;
      await db.run(createQuery);
      response.status(200);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(getUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getTweetsFeedQuery = `SELECT user.username,tweet.tweet,tweet.date_time AS dateTime from tweet 
  INNER JOIN follower ON tweet.user_id = follower.following_user_id 
  INNER JOIN user ON user.user_id = follower.following_user_id
  WHERE user.username = '${username}'
  GROUP BY tweet.user_id 
  ORDER BY tweet.date_time DESC LIMIT 4 OFFSET 0`;
  const dbResponse = await db.all(getTweetsFeedQuery);
  response.send(dbResponse);
});

app.get("/user/following/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getQuery = `SELECT name FROM user INNER JOIN follower
    ON user.user_id = follower.following_user_id
   GROUP BY user.user_id
    ;
    `;
  const dbResponse = await db.all(getQuery);
  response.send(dbResponse);
});

app.get("/user/followers/", authenticateToken, async (request, response) => {
  let { username } = request;
  console.log(username);
  const getQuery = `SELECT name FROM user INNER JOIN follower
    ON user.user_id = follower.follower_user_id
   GROUP BY user.user_id
    ;
    `;
  const dbResponse = await db.all(getQuery);
  response.send(dbResponse);
});

module.exports = app;
