const express = require("express");
const app = express();
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
app.use(express.json());
const path = require("path");
const filepath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;
const initializedbandserver = async () => {
  try {
    db = await open({
      filename: filepath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("server on");
    });
  } catch (e) {
    console.log(`error ${e.message}`);
  }
};

initializedbandserver();

const statedata = (object) => {
  return {
    stateId: object.state_id,
    stateName: object.state_name,
    population: object.population,
  };
};

const makedistrict = (object) => {
  return {
    districtId: object.district_id,
    districtName: object.district_name,
    stateId: object.state_id,
    cases: object.cases,
    cured: object.cured,
    active: object.active,
    deaths: object.deaths,
  };
};

function authorizationdetails(request, response, next) {
  let token;
  const verifytoken = request.headers["authorization"];
  if (verifytoken !== undefined) {
    token = verifytoken.split(" ")[1];
  }
  if (token === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(token, "thisscretmessage", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
}

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getuserdetails = `
    SELECT 
      * 
    FROM 
        user
    WHERE 
        username = '${username}';
      `;
  const getdetails = await db.get(getuserdetails);
  if (getdetails === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const checkpassword = await bcrypt.compare(password, getdetails.password);
    if (checkpassword === true) {
      const payload = { username: username };
      const generatetoken = jwt.sign(payload, "thisscretmessage");
      response.send({ generatetoken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

app.get("/states/", authorizationdetails, async (request, response) => {
  const queryss = `
    SELECT
      *  
    FROM
      state;`;
  const statesdetails = await db.all(queryss);
  response.send(statesdetails.map((object) => statedata(object)));
});

app.get(
  "/states/:stateId/",
  authorizationdetails,
  async (request, response) => {
    const { stateId } = request.params;
    const query = `
    SELECT
      *  
    FROM
      state
    WHERE 
      state_id='${stateId};`;
    const statesdetails = await db.get(query);
    response.send(statedata(statesdetails));
  }
);

app.post("/districts/", authorizationdetails, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;

  const query = `
    INSERT INTO
        district (district_name,state_id,cases,cured,active,deaths)
    VALUES(
        '${districtName}',
        ${stateId},
        ${cases},
        ${cured},
        ${active},
        ${deaths});`;
  await db.run(query);
  response.send("District Successfully Added");
});

app.get(
  "/districts/:districtId/",
  authorizationdetails,
  async (request, response) => {
    const { districtId } = request.params;
    const query = `
    SELECT
      *  
    FROM
      district
    WHERE 
      district_id=${districtId};`;
    const districtdetailsofparticular = await db.get(query);
    response.send(makedistrict(districtdetailsofparticular));
  }
);

app.delete(
  "/districts/:districtId/",
  authorizationdetails,
  async (request, response) => {
    const { districtId } = request.params;
    const query = `
    DELETE FROM
      district
    WHERE 
      district_id=${districtId};`;
    await db.run(query);
    response.send("District Removed");
  }
);

app.put(
  "/districts/:districtId/",
  authorizationdetails,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = requeset.body;
    const query = `
    UPDATE 
      district
    SET
      district_name= '${districtName}',
      state_id= ${stateId},
      cases= ${cases},
      cured=${cured},
      active=${active},
      deaths=${deaths}
    WHERE 
      district_id=${districtId};`;
    const districtdetailsofparticular = await db.run(query);
    response.send("District Details Updated");
  }
);

app.get(
  "/states/:stateId/stats/",
  authorizationdetails,
  async (request, response) => {
    const { stateId } = request.params;
    const queryss = `
    SELECT 
      SUM(cases),
      SUM(cured),
      SUM(active),
      SUM(deaths)
    FROM
        district
    WHERE 
        state_id=${stateId};
    `;
    const statusobject = await db.get(queryss);
    response.send({
      totalCases: statusobject["SUM(cases)"],
      totalCured: statusobject["SUM(cured)"],
      totalActive: statusobject["SUM(active)"],
      totalDeaths: statusobject["SUM(deaths)"],
    });
  }
);

module.exports = app;
