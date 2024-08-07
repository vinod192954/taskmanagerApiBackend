const express = require('express');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const path = require('path');
const bcrypt = require('bcrypt');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const dbPath = path.join(__dirname, 'Taskmanager.db');
const app = express();
app.use(cors());
app.use(express.json());

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    const port = process.env.PORT || 4000;
    app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
    });
  } catch (error) {
    console.log(`DB error: ${error.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

app.post("/register", async (request, response) => {
  const { username, email, password, role } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  const selectedUserQuery = `SELECT * FROM users WHERE username = ?`;
  const dbUser = await db.get(selectedUserQuery, [username]);

  if (dbUser === undefined) {
    const createUserQuery = `
      INSERT INTO users (username, email, password, role) 
      VALUES (?, ?, ?, ?);
    `;
    const dbResponse = await db.run(createUserQuery, [username, email, hashedPassword, role]);
    const userId = dbResponse.lastID;
    response.send({ userId: userId });
  } else {
    response.status(400).send({ error: "User already exists" });
  }
});

app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectedUserQuery = `SELECT * FROM users WHERE username = ?`;
  const dbUser = await db.get(selectedUserQuery, [username]);

  if (dbUser === undefined) {
    response.status(400).send("User not exist");
  } else {
    const isPasswordMatch = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatch) {
      response.status(200).send("Login successfully");
    } else {
      response.status(400).send("Invalid Password");
    }
  }
});

app.post("/projects/:userId", async (request, response) => {
  const { projectName, projectDescription } = request.body;
  const { userId } = request.params;

  if (!projectName || !projectDescription || !userId) {
    response.status(400).send({ error: "Missing required fields" });
    return;
  }

  const createNewProject = `
    INSERT INTO projects (projectName, projectDescription, userId) 
    VALUES (?, ?, ?);
  `;

  try {
    const dbResponse = await db.run(createNewProject, [projectName, projectDescription, userId]);
    response.send({ projectId: dbResponse.lastID });
  } catch (error) {
    response.status(500).send({ error: error.message });
  }
});

app.get("/projects", async (request, response) => {
  try {
    const getProjectsQuery = `SELECT * FROM projects;`;
    const projects = await db.all(getProjectsQuery);
    response.send({ projects });
  } catch (error) {
    response.status(500).send({ error: error.message });
  }
});

app.put("/projects/:projectId", async (request, response) => {
  const { projectId } = request.params;
  const { projectName, projectDescription } = request.body;

  if (!projectName || !projectDescription) {
    return response.status(400).send({ error: "Project name and description are required" });
  }

  const updateProjectQuery = `
    UPDATE projects
    SET projectName = ?, projectDescription = ?
    WHERE projectId = ?;
  `;
  
  try {
    const result = await db.run(updateProjectQuery, [projectName, projectDescription, projectId]);
    if (result.changes === 0) {
      return response.status(404).send({ error: "Project not found" });
    }
    response.send({ message: "Project updated successfully" });
  } catch (error) {
    response.status(500).send({ error: error.message });
  }
});

app.delete("/projects/:projectId", async (request, response) => {
  const { projectId } = request.params;

  const deleteProjectQuery = `DELETE FROM projects WHERE projectId = ?;`;
  
  try {
    const result = await db.run(deleteProjectQuery, [projectId]);
    if (result.changes === 0) {
      return response.status(404).send({ error: "Project not found" });
    }
    response.send({ message: "Project deleted successfully" });
  } catch (error) {
    response.status(500).send({ error: error.message });
  }
});
