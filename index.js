require("dotenv").config();
const express = require("express");
const app = express();
const connection = require("./db");
const userRoutes = require("./routes/users");
const orguserRoutes = require("./routes/orgusers");
const authRoutes = require("./routes/auth");
const endpointRoutes = require("./routes/endpoints");
const aiRoutes = require("./routes/ai");
const general = require("./routes/general");
const cors = require("cors");
// database connection
connection();

// middlewares
app.use(express.json());
app.get("/", (req, res) => {
    res.send("Hello");
  });
app.use(cors({
    origin: ["https://www.threatvisor.org"],
    credentials: true
}));


// routes
app.use("/api/users", userRoutes);
app.use("/api/orgusers", orguserRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/endpoints", endpointRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/", general);

const port = process.env.PORT || 8080;
app.listen(port, console.log(`Listening on port ${port}...`));
